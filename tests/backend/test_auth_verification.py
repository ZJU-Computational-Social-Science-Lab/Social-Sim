import asyncio
import os
from contextlib import asynccontextmanager
from urllib.parse import parse_qs, urlparse

import pytest
from litestar.testing import TestClient
from pydantic import SecretStr
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from socialsim4.backend.core.config import get_settings
from socialsim4.backend.db.base import Base
from socialsim4.backend.models.token import RefreshToken, VerificationToken
from socialsim4.backend.models.user import User
from socialsim4.backend.main import app


TEST_DB_PATH = "test_auth.db"
TEST_DB_URL = f"sqlite+aiosqlite:///{TEST_DB_PATH}"

test_engine = create_async_engine(TEST_DB_URL, future=True)
TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False)

TABLES = [User.__table__, RefreshToken.__table__, VerificationToken.__table__]

async def _reset_database() -> None:
    async with test_engine.begin() as conn:
        await conn.run_sync(lambda sync_conn: Base.metadata.drop_all(bind=sync_conn, tables=TABLES))
        await conn.run_sync(lambda sync_conn: Base.metadata.create_all(bind=sync_conn, tables=TABLES))


@pytest.fixture(scope="module", autouse=True)
def _prepare_database() -> None:
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)
    asyncio.run(_reset_database())
    yield
    asyncio.run(_reset_database())
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)


@pytest.fixture(autouse=True)
def _clean_database() -> None:
    asyncio.run(_reset_database())


@pytest.fixture(scope="module", autouse=True)
def override_db_session(monkeypatch) -> None:
    @asynccontextmanager
    async def _test_get_session():
        async with TestSessionLocal() as session:
            yield session

    monkeypatch.setattr("socialsim4.backend.core.database.get_session", _test_get_session)
    monkeypatch.setattr("socialsim4.backend.api.routes.auth.get_session", _test_get_session)
    yield


@pytest.fixture(autouse=True)
def patch_password_hashing(monkeypatch):
    from socialsim4.backend.core import security

    def fake_hash(password: str) -> str:
        return f"hashed::{password}"

    def fake_verify(password: str, hashed: str) -> bool:
        return hashed == f"hashed::{password}"

    monkeypatch.setattr(security, "hash_password", fake_hash)
    monkeypatch.setattr(security, "verify_password", fake_verify)
    from socialsim4.backend.api.routes import auth as auth_routes

    monkeypatch.setattr(auth_routes, "hash_password", fake_hash)
    monkeypatch.setattr(auth_routes, "verify_password", fake_verify)
    yield


@pytest.fixture
def email_stub():
    class DummySender:
        def __init__(self) -> None:
            self.sent: list[tuple[str, str]] = []

        async def send_verification_email(self, recipient: str, link: str) -> bool:
            self.sent.append((recipient, link))
            return True

    sender = DummySender()
    monkeypatch.setattr("socialsim4.backend.dependencies.get_email_sender", lambda: sender)
    monkeypatch.setattr("socialsim4.backend.api.routes.auth.get_email_sender", lambda: sender)
    yield sender


@pytest.fixture
def client(email_stub):
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def enable_verification():
    settings = get_settings()
    original = {
        "require_email_verification": settings.require_email_verification,
        "email_smtp_host": settings.email_smtp_host,
        "email_smtp_port": settings.email_smtp_port,
        "email_smtp_username": settings.email_smtp_username,
        "email_smtp_password": settings.email_smtp_password,
        "email_from": settings.email_from,
        "app_base_url": settings.app_base_url,
    }

    settings.require_email_verification = True
    settings.email_smtp_host = "smtp.test"
    settings.email_smtp_port = 587
    settings.email_smtp_username = "tester"
    settings.email_smtp_password = SecretStr("secret")
    settings.email_from = "noreply@test.local"
    settings.app_base_url = "http://localhost:3000"

    yield settings

    settings.require_email_verification = original["require_email_verification"]
    settings.email_smtp_host = original["email_smtp_host"]
    settings.email_smtp_port = original["email_smtp_port"]
    settings.email_smtp_username = original["email_smtp_username"]
    settings.email_smtp_password = original["email_smtp_password"]
    settings.email_from = original["email_from"]
    settings.app_base_url = original["app_base_url"]


def extract_token(sent_items: list[tuple[str, str]]) -> str:
    assert sent_items, "No verification email sent"
    _, link = sent_items[-1]
    parsed = urlparse(link)
    token = parse_qs(parsed.query).get("token")
    assert token, "Token missing from verification link"
    return token[0]


def test_registration_with_email_verification_flow(client: TestClient, enable_verification, email_stub) -> None:
    payload = {
        "organization": "Acme",
        "email": "alice@example.com",
        "username": "alice",
        "full_name": "Alice Example",
        "phone_number": "1234567890",
        "password": "s3cret",
    }

    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["is_verified"] is False
    assert len(email_stub.sent) == 1

    login_before = client.post("/api/auth/login", json={"email": payload["email"], "password": payload["password"]})
    assert login_before.status_code == 403

    token_value = extract_token(email_stub.sent)
    verify_response = client.post("/api/auth/verify", json={"token": token_value})
    assert verify_response.status_code == 200
    assert verify_response.json()["message"] == "Email verified"

    login_after = client.post("/api/auth/login", json={"email": payload["email"], "password": payload["password"]})
    assert login_after.status_code == 200
    tokens = login_after.json()
    assert tokens["access_token"]
    assert tokens["refresh_token"]


def test_registration_without_verification(client: TestClient, email_stub) -> None:
    settings = get_settings()
    original_flag = settings.require_email_verification
    settings.require_email_verification = False

    try:
        payload = {
            "organization": "Beta",
            "email": "bob@example.com",
            "username": "bob",
            "full_name": "Bob Example",
            "phone_number": "9876543210",
            "password": "s3cret",
        }

        response = client.post("/api/auth/register", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["is_verified"] is True
        assert email_stub.sent == []

        login_response = client.post("/api/auth/login", json={"email": payload["email"], "password": payload["password"]})
        assert login_response.status_code == 200
    finally:
        settings.require_email_verification = original_flag
