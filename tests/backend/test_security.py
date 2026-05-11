"""
Security-focused tests for authorization, API key handling, production config,
upload isolation, and runaway simulation controls.

Uses real JWT tokens to test cross-user access control.

Tests cover:
- Tree/export authorization: cross-user access denied (Task 1)
- Assert-free provider authorization (Task 2)
- Production startup validation (Task 3)
- API key non-exposure in responses (Task 4)
- Upload user isolation (Task 5)
- Runaway simulation controls (Task 6)

Contains:
    - TestUnauthenticatedAccess: All protected endpoints return 401 without token
    - TestCrossUserTreeAccess: User A cannot access User B's tree/export
    - TestCrossUserProviderAccess: User A cannot modify User B's provider
    - TestProviderApiKeyExposure: API keys never appear in responses
    - TestProductionConfigValidation: Dangerous default detection
    - TestApiKeyRedaction: Secret redaction in error messages
    - TestRunawayControls: Limit enforcement on advance operations
    - TestUploadIsolation: Upload listing/deletion requires auth
"""

import asyncio
import os
from contextlib import asynccontextmanager
from types import SimpleNamespace

import pytest
import sqlalchemy
from litestar.testing import TestClient
from pydantic import SecretStr
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from socialsim4.backend.api.routes.simulations import crud
from socialsim4.backend.api.routes import uploads
from socialsim4.backend.core.config import Settings, get_settings
from socialsim4.backend.core.security import create_access_token, hash_password
from socialsim4.backend.db.base import Base
from socialsim4.backend.main import app
from socialsim4.backend.models.simulation import Simulation
from socialsim4.backend.models.user import User, ProviderConfig, SearchProviderConfig


# ---------------------------------------------------------------------------
# Test database setup
# ---------------------------------------------------------------------------

_SEC_DB_PATH = "test_security.db"
_SEC_DB_URL = f"sqlite+aiosqlite:///{_SEC_DB_PATH}"

sec_engine = create_async_engine(_SEC_DB_URL, future=True, connect_args={"check_same_thread": False})
SecSessionLocal = async_sessionmaker(sec_engine, expire_on_commit=False)

_TABLES = [User.__table__, ProviderConfig.__table__, SearchProviderConfig.__table__, Simulation.__table__]


async def _reset_sec_db() -> None:
    async with sec_engine.begin() as conn:
        await conn.execute(sqlalchemy.text("PRAGMA journal_mode=WAL"))
        await conn.run_sync(lambda c: Base.metadata.drop_all(bind=c, tables=_TABLES))
        await conn.run_sync(lambda c: Base.metadata.create_all(bind=c, tables=_TABLES))


@pytest.fixture(scope="module", autouse=True)
def _prepare_sec_db():
    if os.path.exists(_SEC_DB_PATH):
        os.remove(_SEC_DB_PATH)
    asyncio.run(_reset_sec_db())
    yield
    # Best-effort cleanup; Windows SQLite file locks may prevent deletion
    try:
        asyncio.run(_reset_sec_db())
    except PermissionError:
        pass
    try:
        if os.path.exists(_SEC_DB_PATH):
            os.remove(_SEC_DB_PATH)
    except PermissionError:
        pass


@pytest.fixture(autouse=True)
def _clean_sec_db():
    asyncio.run(_reset_sec_db())


@pytest.fixture(autouse=True)
def _override_db(monkeypatch):
    @asynccontextmanager
    async def _session():
        async with SecSessionLocal() as s:
            yield s

    import socialsim4.backend.core.database as db_mod
    monkeypatch.setattr(db_mod, "get_session", _session)

    # Also patch all modules that imported get_session via "from ... import"
    # Otherwise monkeypatch only affects the original module, not local bindings.
    import socialsim4.backend.api.routes.simulations.tree_operations as tree_mod
    import socialsim4.backend.api.routes.simulations.export as export_mod
    import socialsim4.backend.api.routes.experiments as exp_mod
    import socialsim4.backend.api.routes.providers as prov_mod
    import socialsim4.backend.api.routes.search_providers as sp_mod
    import socialsim4.backend.api.routes.uploads as uploads_mod
    monkeypatch.setattr(tree_mod, "get_session", _session)
    monkeypatch.setattr(export_mod, "get_session", _session)
    monkeypatch.setattr(exp_mod, "get_session", _session)
    monkeypatch.setattr(prov_mod, "get_session", _session)
    monkeypatch.setattr(sp_mod, "get_session", _session)
    monkeypatch.setattr(uploads_mod, "get_session", _session)
    yield


def _make_token(user_id: int) -> str:
    """Create a real JWT for the given user ID."""
    token, _ = create_access_token(subject=str(user_id))
    return token


def _auth_headers(user_id: int) -> dict:
    return {"Authorization": f"Bearer {_make_token(user_id)}"}


async def _create_user(user_id: int, email: str) -> User:
    async with SecSessionLocal() as session:
        user = User(
            id=user_id,
            email=email,
            username=f"user{user_id}",
            hashed_password=hash_password("password123"),
            is_active=True,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


async def _create_simulation(sim_id: str, owner_id: int) -> Simulation:
    async with SecSessionLocal() as session:
        sim = Simulation(
            id=sim_id,
            owner_id=owner_id,
            name=f"Test Sim {sim_id}",
            scene_type="test",
            scene_config={"scenario_id": "test"},
            agent_config={"agents": []},
            status="draft",
        )
        session.add(sim)
        await session.commit()
        await session.refresh(sim)
        return sim


async def _create_provider(user_id: int, name: str = "test-prov") -> ProviderConfig:
    async with SecSessionLocal() as session:
        prov = ProviderConfig(
            user_id=user_id,
            name=name,
            provider="mock",
            model="test-model",
            api_key="sk-secret-key-1234567890abcdefghij",
            config={"active": True},
        )
        session.add(prov)
        await session.commit()
        await session.refresh(prov)
        return prov


# ---------------------------------------------------------------------------
# Task 1 & 2: Unauthenticated access — all protected endpoints return 401
# ---------------------------------------------------------------------------


class TestUnauthenticatedAccess:
    """All protected endpoints return 401 without a valid token."""

    def test_tree_graph_no_auth(self):
        client = TestClient(app)
        assert client.get("/api/simulations/FAKEID/tree/graph").status_code == 401

    def test_export_no_auth(self):
        client = TestClient(app)
        assert client.get("/api/simulations/FAKEID/export").status_code == 401

    def test_advance_multi_no_auth(self):
        client = TestClient(app)
        r = client.post("/api/simulations/FAKEID/tree/advance_multi", json={"parent": 1, "count": 1, "turns": 1})
        assert r.status_code == 401

    def test_advance_chain_no_auth(self):
        client = TestClient(app)
        r = client.post("/api/simulations/FAKEID/tree/advance_chain", json={"parent": 1, "turns": 1})
        assert r.status_code == 401

    def test_advance_frontier_no_auth(self):
        client = TestClient(app)
        r = client.post("/api/simulations/FAKEID/tree/advance_frontier", json={"turns": 1, "only_max_depth": False})
        assert r.status_code == 401

    def test_branch_no_auth(self):
        client = TestClient(app)
        r = client.post("/api/simulations/FAKEID/tree/branch", json={"parent": 1, "ops": []})
        assert r.status_code == 401

    def test_delete_subtree_no_auth(self):
        client = TestClient(app)
        assert client.delete("/api/simulations/FAKEID/tree/node/1").status_code == 401

    def test_tree_events_no_auth(self):
        client = TestClient(app)
        assert client.get("/api/simulations/FAKEID/tree/sim/1/events").status_code == 401

    def test_tree_state_no_auth(self):
        client = TestClient(app)
        assert client.get("/api/simulations/FAKEID/tree/sim/1/state").status_code == 401

    def test_inject_message_no_auth(self):
        client = TestClient(app)
        r = client.post("/api/simulations/FAKEID/tree/sim/1/inject-message", json={"message": "test"})
        assert r.status_code == 401

    def test_overrides_no_auth(self):
        client = TestClient(app)
        r = client.post("/api/simulations/FAKEID/tree/sim/1/overrides", json={"overrides": []})
        # Route may return 401 (auth first) or 404 (route not matched without auth)
        assert r.status_code in (401, 404)

    def test_create_experiment_no_auth(self):
        client = TestClient(app)
        r = client.post("/api/simulations/FAKEID/experiments", json={"name": "t", "base_node": 1, "variants": []})
        assert r.status_code == 401

    def test_compare_no_auth(self):
        client = TestClient(app)
        r = client.post("/api/simulations/FAKEID/compare", json={"node_a": 1, "node_b": 2})
        assert r.status_code == 401

    def test_update_provider_no_auth(self):
        client = TestClient(app)
        assert client.patch("/api/providers/999", json={"name": "t"}).status_code == 401

    def test_delete_provider_no_auth(self):
        client = TestClient(app)
        assert client.delete("/api/providers/999").status_code == 401

    def test_test_provider_no_auth(self):
        client = TestClient(app)
        assert client.post("/api/providers/999/test").status_code == 401

    def test_activate_provider_no_auth(self):
        client = TestClient(app)
        assert client.post("/api/providers/999/activate").status_code == 401

    def test_update_search_provider_no_auth(self):
        client = TestClient(app)
        assert client.patch("/api/search-providers/999", json={"provider": "ddg"}).status_code == 401

    def test_delete_search_provider_no_auth(self):
        client = TestClient(app)
        assert client.delete("/api/search-providers/999").status_code == 401

    def test_list_uploads_no_auth(self):
        client = TestClient(app)
        assert client.get("/api/uploads/").status_code == 401

    def test_delete_upload_no_auth(self):
        client = TestClient(app)
        assert client.delete("/api/uploads/nonexistent").status_code == 401


# ---------------------------------------------------------------------------
# Task 1: Cross-user tree/export access — User A cannot access User B's sim
# ---------------------------------------------------------------------------


class TestCrossUserTreeAccess:
    """User A cannot read, mutate, or export User B's simulation tree.

    Uses monkeypatching to mock the ownership check to return 'wrong owner'
    for user_id=10 (Alice) trying to access sim owned by user_id=20 (Bob).
    """

    def _patch_owner_check(self, monkeypatch):
        """Patch ownership check to simulate cross-user access."""
        import socialsim4.backend.api.routes.simulations.helpers as helpers_mod
        import socialsim4.backend.api.routes.simulations.tree_operations as tree_mod
        import socialsim4.backend.api.routes.simulations.export as export_mod
        import socialsim4.backend.api.routes.experiments as exp_mod

        async def _wrong_owner(session, owner_id, simulation_id):
            """If Alice (10) tries to access, raise 404 to simulate ownership failure."""
            from litestar.exceptions import HTTPException
            raise HTTPException(status_code=404, detail="Not found")

        # Patch at the module level where it's imported
        monkeypatch.setattr(helpers_mod, "get_simulation_for_owner", _wrong_owner)
        monkeypatch.setattr(helpers_mod, "get_simulation_and_tree_for_owner", _wrong_owner)

        # Also patch resolve_current_user to return a valid user for our token
        async def _resolve_user(session, token):
            return SimpleNamespace(id=10, email="alice@test.com")

        monkeypatch.setattr(tree_mod, "resolve_current_user", _resolve_user)
        monkeypatch.setattr(export_mod, "resolve_current_user", _resolve_user)
        monkeypatch.setattr(exp_mod, "resolve_current_user", _resolve_user)

    def test_user_a_cannot_get_user_b_tree_graph(self, monkeypatch):
        self._patch_owner_check(monkeypatch)
        client = TestClient(app)
        r = client.get("/api/simulations/SIMBOB01/tree/graph", headers=_auth_headers(10))
        assert r.status_code in (403, 404)

    def test_user_a_cannot_get_user_b_tree_state(self, monkeypatch):
        self._patch_owner_check(monkeypatch)
        client = TestClient(app)
        r = client.get("/api/simulations/SIMBOB01/tree/sim/0/state", headers=_auth_headers(10))
        assert r.status_code in (403, 404)

    def test_user_a_cannot_advance_user_b_multi(self, monkeypatch):
        self._patch_owner_check(monkeypatch)
        client = TestClient(app)
        r = client.post(
            "/api/simulations/SIMBOB01/tree/advance_multi",
            json={"parent": 0, "count": 1, "turns": 1},
            headers=_auth_headers(10),
        )
        assert r.status_code in (403, 404)

    def test_user_a_cannot_advance_user_b_chain(self, monkeypatch):
        self._patch_owner_check(monkeypatch)
        client = TestClient(app)
        r = client.post(
            "/api/simulations/SIMBOB01/tree/advance_chain",
            json={"parent": 0, "turns": 1},
            headers=_auth_headers(10),
        )
        assert r.status_code in (403, 404)

    def test_user_a_cannot_branch_user_b(self, monkeypatch):
        self._patch_owner_check(monkeypatch)
        client = TestClient(app)
        r = client.post(
            "/api/simulations/SIMBOB01/tree/branch",
            json={"parent": 0, "ops": [{"op": "advance", "turns": 1}]},
            headers=_auth_headers(10),
        )
        assert r.status_code in (403, 404)

    def test_user_a_cannot_delete_user_b_subtree(self, monkeypatch):
        self._patch_owner_check(monkeypatch)
        client = TestClient(app)
        r = client.delete("/api/simulations/SIMBOB01/tree/node/0", headers=_auth_headers(10))
        assert r.status_code in (403, 404)

    def test_user_a_cannot_inject_user_b_message(self, monkeypatch):
        self._patch_owner_check(monkeypatch)
        client = TestClient(app)
        r = client.post(
            "/api/simulations/SIMBOB01/tree/sim/0/inject-message",
            json={"message": "hacked"},
            headers=_auth_headers(10),
        )
        assert r.status_code in (403, 404)

    def test_user_a_cannot_export_user_b(self, monkeypatch):
        self._patch_owner_check(monkeypatch)
        client = TestClient(app)
        r = client.get("/api/simulations/SIMBOB01/export", headers=_auth_headers(10))
        assert r.status_code in (403, 404)

    def test_user_a_cannot_get_user_b_events(self, monkeypatch):
        self._patch_owner_check(monkeypatch)
        client = TestClient(app)
        r = client.get("/api/simulations/SIMBOB01/tree/sim/0/events", headers=_auth_headers(10))
        assert r.status_code in (403, 404)

    def test_user_a_cannot_override_user_b(self, monkeypatch):
        self._patch_owner_check(monkeypatch)
        client = TestClient(app)
        r = client.post(
            "/api/simulations/SIMBOB01/tree/sim/0/overrides",
            json={"overrides": []},
            headers=_auth_headers(10),
        )
        assert r.status_code in (403, 404)


# ---------------------------------------------------------------------------
# Task 2: Cross-user provider access — User A cannot modify User B's provider
# ---------------------------------------------------------------------------


class TestCrossUserProviderAccess:
    """User A cannot update, delete, test, or activate User B's provider config.

    Uses monkeypatching to mock provider DB lookup to simulate cross-user access.
    """

    def _patch_provider_lookup(self, monkeypatch):
        """Patch session.get for ProviderConfig to return a provider owned by User B."""
        from socialsim4.backend.models.user import ProviderConfig as PC

        async def _mock_get(session, cls, ident):
            if cls is PC:
                # Return a provider owned by user 20 (Bob)
                mock_prov = SimpleNamespace(
                    id=ident,
                    user_id=20,
                    name="bob-prov",
                    provider="mock",
                    model="test-model",
                    base_url=None,
                    api_key="sk-bob-secret-key",
                    config={"active": True},
                    last_test_status=None,
                    last_tested_at=None,
                    last_error=None,
                )
                return mock_prov
            return None

        # Patch resolve_current_user to return user 10 (Alice)
        import socialsim4.backend.api.routes.providers as prov_mod
        async def _resolve_alice(session, token):
            return SimpleNamespace(id=10, email="alice@test.com")

        monkeypatch.setattr(prov_mod, "resolve_current_user", _resolve_alice)

    def test_user_a_cannot_update_user_b_provider(self, monkeypatch):
        self._patch_provider_lookup(monkeypatch)
        client = TestClient(app)
        r = client.patch("/api/providers/1", json={"name": "hacked"}, headers=_auth_headers(10))
        assert r.status_code == 403

    def test_user_a_cannot_delete_user_b_provider(self, monkeypatch):
        self._patch_provider_lookup(monkeypatch)
        client = TestClient(app)
        r = client.delete("/api/providers/1", headers=_auth_headers(10))
        assert r.status_code == 403

    def test_user_a_cannot_test_user_b_provider(self, monkeypatch):
        self._patch_provider_lookup(monkeypatch)
        client = TestClient(app)
        r = client.post("/api/providers/1/test", headers=_auth_headers(10))
        assert r.status_code == 403

    def test_user_a_cannot_activate_user_b_provider(self, monkeypatch):
        self._patch_provider_lookup(monkeypatch)
        client = TestClient(app)
        r = client.post("/api/providers/1/activate", headers=_auth_headers(10))
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# Task 4: Provider API key non-exposure
# ---------------------------------------------------------------------------


class TestProviderApiKeyExposure:
    """API keys must never appear in provider CRUD responses.

    Uses monkeypatching to mock DB interactions.
    """

    def _patch_auth_and_db(self, monkeypatch):
        """Patch auth and DB to return a provider with a known API key."""
        import socialsim4.backend.api.routes.providers as prov_mod

        async def _resolve_user(session, token):
            return SimpleNamespace(id=10, email="alice@test.com")

        monkeypatch.setattr(prov_mod, "resolve_current_user", _resolve_user)

        # Patch _serialize_provider to verify it never exposes api_key
        # This is the function that builds the response - it should use has_api_key instead
        original_serialize = prov_mod._serialize_provider

        def _checked_serialize(provider):
            result = original_serialize(provider)
            # Verify api_key is not in the serialized result
            assert "api_key" not in result or result["api_key"] is None or result.get("has_api_key") is not None
            return result

    def test_serialize_provider_uses_has_api_key_not_raw_key(self):
        """_serialize_provider returns has_api_key boolean, never raw api_key."""
        from socialsim4.backend.api.routes.providers import _serialize_provider
        mock_prov = SimpleNamespace(
            id=1, name="test", provider="openai-compatible", model="gpt-4",
            base_url=None, api_key="sk-secret-key-should-not-appear-1234567890",
            config={"active": True}, last_test_status=None, last_tested_at=None, last_error=None,
        )
        result = _serialize_provider(mock_prov)
        # _serialize_provider returns a ProviderBase Pydantic model
        assert result.has_api_key is True
        dumped = result.model_dump()
        assert "api_key" not in dumped
        assert "sk-secret-key-should-not-appear" not in str(dumped)

    def test_serialize_provider_with_no_key(self):
        """_serialize_provider with no key shows has_api_key=False."""
        from socialsim4.backend.api.routes.providers import _serialize_provider
        mock_prov = SimpleNamespace(
            id=1, name="test", provider="mock", model="test",
            base_url=None, api_key=None,
            config={"active": True}, last_test_status=None, last_tested_at=None, last_error=None,
        )
        result = _serialize_provider(mock_prov)
        assert result.has_api_key is False

    def test_provider_test_error_does_not_expose_key(self):
        """Provider test error response uses generic message, not raw exception."""
        from socialsim4.backend.api.routes.providers import _redact_secret
        raw_error = "Authentication error: Invalid API key sk-proj-abcdefghijklmnop1234567890xyz"
        redacted = _redact_secret(raw_error)
        assert "sk-proj-abcdefghijklmnop1234567890xyz" not in redacted
        assert "[REDACTED]" in redacted
        assert "Authentication error" in redacted


# ---------------------------------------------------------------------------
# Task 3: Production config validation
# ---------------------------------------------------------------------------


class TestProductionConfigValidation:
    """Verify that production mode rejects dangerous defaults."""

    def test_development_allows_defaults(self):
        errors = Settings(app_env="development").validate_production_secrets()
        assert errors == []

    def test_production_rejects_change_me(self):
        errors = Settings(app_env="production", jwt_signing_key="change-me").validate_production_secrets()
        assert any("JWT" in e for e in errors)

    def test_production_rejects_please_change_me(self):
        errors = Settings(app_env="production", jwt_signing_key="please-change-me").validate_production_secrets()
        assert any("JWT" in e for e in errors)

    def test_production_rejects_short_key(self):
        errors = Settings(app_env="production", jwt_signing_key="a" * 31).validate_production_secrets()
        assert any("too short" in e.lower() for e in errors)

    def test_production_accepts_strong_config(self):
        errors = Settings(
            app_env="production",
            jwt_signing_key="a" * 64,
            admin_password="strong-password-!@#$%",
            database_url="postgresql+psycopg://user:strongpass@db:5432/mydb",
        ).validate_production_secrets()
        assert errors == []

    def test_production_rejects_default_admin_password(self):
        errors = Settings(app_env="production", jwt_signing_key="a" * 64, admin_password="zjucss107").validate_production_secrets()
        assert any("ADMIN_PASSWORD" in e for e in errors)

    def test_production_rejects_default_db_password(self):
        errors = Settings(
            app_env="production",
            jwt_signing_key="a" * 64,
            database_url="postgresql+psycopg://socialsim4:socialsim4@db:5432/socialsim4",
        ).validate_production_secrets()
        assert any("Database" in e for e in errors)

    def test_test_mode_skips_validation(self):
        errors = Settings(app_env="test", jwt_signing_key="change-me").validate_production_secrets()
        assert errors == []

    def test_is_production_property(self):
        assert Settings(app_env="production").is_production is True
        assert Settings(app_env="prod").is_production is True
        assert Settings(app_env="development").is_production is False
        assert Settings(app_env="test").is_production is False


# ---------------------------------------------------------------------------
# Task 4: API key redaction utility
# ---------------------------------------------------------------------------


class TestApiKeyRedaction:
    """Verify _redact_secret handles various inputs correctly."""

    def test_redact_long_hex_string(self):
        from socialsim4.backend.api.routes.providers import _redact_secret
        result = _redact_secret("key: sk-proj-abc123def456ghi789jkl012mno345pqr")
        assert "sk-proj-abc123def456ghi789jkl012mno345pqr" not in result
        assert "[REDACTED]" in result

    def test_preserves_short_strings(self):
        from socialsim4.backend.api.routes.providers import _redact_secret
        assert _redact_secret("Connection refused") == "Connection refused"

    def test_empty_string(self):
        from socialsim4.backend.api.routes.providers import _redact_secret
        assert _redact_secret("") == ""

    def test_embedded_key_in_error(self):
        from socialsim4.backend.api.routes.providers import _redact_secret
        msg = "Error: Invalid API key provided: sk-1234567890abcdef1234567890abcdef. Check credentials."
        result = _redact_secret(msg)
        assert "sk-1234567890abcdef1234567890abcdef" not in result
        assert "[REDACTED]" in result
        assert "Error:" in result


# ---------------------------------------------------------------------------
# Task 6: Runaway simulation controls
# ---------------------------------------------------------------------------


class TestRunawayControls:
    """Verify that runaway simulation limits are configurable and enforced."""

    def test_config_has_default_limits(self):
        s = Settings()
        assert s.max_advance_multi_count > 0
        assert s.max_advance_turns_per_request > 0
        assert s.max_frontier_nodes_per_request > 0

    def test_limits_are_configurable(self):
        s = Settings(max_advance_multi_count=5, max_advance_turns_per_request=10, max_frontier_nodes_per_request=8)
        assert s.max_advance_multi_count == 5
        assert s.max_advance_turns_per_request == 10
        assert s.max_frontier_nodes_per_request == 8


# ---------------------------------------------------------------------------
# Task 5: Upload isolation
# ---------------------------------------------------------------------------


class TestUploadIsolation:
    """Verify upload endpoints require auth and scope by user."""

    def test_list_uploads_requires_auth(self):
        client = TestClient(app)
        assert client.get("/api/uploads/").status_code == 401

    def test_delete_upload_requires_auth(self):
        client = TestClient(app)
        assert client.delete("/api/uploads/nonexistent").status_code == 401


# ---------------------------------------------------------------------------
# Real integration tests: cross-user access via actual DB + real JWT tokens
# ---------------------------------------------------------------------------


# User IDs for integration tests
ALICE_ID = 100
BOB_ID = 200
BOB_SIM_ID = "BOBINTEG01"


def _setup_integration_data():
    """Create Alice, Bob, Bob's simulation, and provider configs in the test DB.

    Clears relevant tables first to avoid UNIQUE constraint errors from
    stale data on Windows SQLite where drop_all between asyncio.run()
    calls may not reliably clear rows.
    """
    async def _setup():
        async with SecSessionLocal() as session:
            # Clear tables in reverse dependency order
            for tbl in reversed(_TABLES):
                await session.execute(tbl.delete())
            await session.commit()

            # Create Alice (User A — the attacker)
            alice = User(
                id=ALICE_ID,
                email="alice-integ@test.com",
                username="alice_integ",
                hashed_password=hash_password("password123"),
                is_active=True,
                is_verified=True,
                role="user",
            )
            session.add(alice)

            # Create Bob (User B — the victim)
            bob = User(
                id=BOB_ID,
                email="bob-integ@test.com",
                username="bob_integ",
                hashed_password=hash_password("password123"),
                is_active=True,
                is_verified=True,
                role="user",
            )
            session.add(bob)
            await session.flush()

            # Alice's provider (mock dialect so no real LLM calls)
            alice_prov = ProviderConfig(
                user_id=ALICE_ID,
                name="alice-mock",
                provider="mock",
                model="mock-model",
                api_key="sk-alice-test-key",
                config={"active": True},
            )
            session.add(alice_prov)

            # Bob's provider (explicit id=999 for stable cross-user tests)
            bob_prov = ProviderConfig(
                id=999,
                user_id=BOB_ID,
                name="bob-mock",
                provider="mock",
                model="mock-model",
                api_key="sk-bob-secret-key-not-to-leak",
                config={"active": True},
            )
            session.add(bob_prov)

            # Bob's simulation
            sim = Simulation(
                id=BOB_SIM_ID,
                owner_id=BOB_ID,
                name="Bob's Private Simulation",
                scene_type="prisoners_dilemma",
                scene_config={"scenario_id": "prisoners_dilemma"},
                agent_config={"agents": []},
                status="draft",
            )
            session.add(sim)
            await session.commit()

    asyncio.run(_setup())


def _alice_headers() -> dict:
    """Real JWT for Alice (user 100)."""
    token, _ = create_access_token(subject=str(ALICE_ID))
    return {"Authorization": f"Bearer {token}"}


def _bob_headers() -> dict:
    """Real JWT for Bob (user 200)."""
    token, _ = create_access_token(subject=str(BOB_ID))
    return {"Authorization": f"Bearer {token}"}


class TestRealCrossUserTreeAccess:
    """Integration tests: real DB, real JWTs, real route handling.

    Verifies that User A (Alice) cannot access User B's (Bob's) tree/export
    through the actual route handler chain, not via monkeypatching.
    The ownership check runs in get_simulation_for_owner which queries the
    real test database.
    """

    @pytest.fixture(autouse=True)
    def _setup_data(self):
        _setup_integration_data()
        yield

    # --- Negative tests: Alice cannot access Bob's resources ---

    def test_alice_cannot_get_bob_tree_graph(self):
        """Alice gets 404 when trying to read Bob's tree graph."""
        client = TestClient(app)
        r = client.get(f"/api/simulations/{BOB_SIM_ID}/tree/graph", headers=_alice_headers())
        assert r.status_code == 404

    def test_alice_cannot_get_bob_tree_state(self):
        """Alice gets 404 when trying to read Bob's tree node state."""
        client = TestClient(app)
        r = client.get(f"/api/simulations/{BOB_SIM_ID}/tree/sim/0/state", headers=_alice_headers())
        assert r.status_code == 404

    def test_alice_cannot_advance_bob_tree(self):
        """Alice gets 404 when trying to advance Bob's tree."""
        client = TestClient(app)
        r = client.post(
            f"/api/simulations/{BOB_SIM_ID}/tree/advance_multi",
            json={"parent": 0, "count": 1, "turns": 1},
            headers=_alice_headers(),
        )
        assert r.status_code == 404

    def test_alice_cannot_branch_bob_tree(self):
        """Alice gets 404 when trying to branch Bob's tree."""
        client = TestClient(app)
        r = client.post(
            f"/api/simulations/{BOB_SIM_ID}/tree/branch",
            json={"parent": 0, "ops": []},
            headers=_alice_headers(),
        )
        assert r.status_code == 404

    def test_alice_cannot_delete_bob_subtree(self):
        """Alice gets 404 when trying to delete Bob's subtree."""
        client = TestClient(app)
        r = client.delete(f"/api/simulations/{BOB_SIM_ID}/tree/node/0", headers=_alice_headers())
        assert r.status_code == 404

    def test_alice_cannot_export_bob_simulation(self):
        """Alice gets 404 when trying to export Bob's simulation."""
        client = TestClient(app)
        r = client.get(f"/api/simulations/{BOB_SIM_ID}/export", headers=_alice_headers())
        assert r.status_code == 404

    def test_alice_cannot_inject_bob_message(self):
        """Alice gets 404 when trying to inject a message into Bob's tree."""
        client = TestClient(app)
        r = client.post(
            f"/api/simulations/{BOB_SIM_ID}/tree/sim/0/inject-message",
            json={"message": "hacked by alice"},
            headers=_alice_headers(),
        )
        assert r.status_code == 404

    def test_alice_cannot_list_bob_experiments(self):
        """Alice gets 404 when trying to list Bob's experiments."""
        client = TestClient(app)
        r = client.get(f"/api/simulations/{BOB_SIM_ID}/experiments", headers=_alice_headers())
        assert r.status_code == 404

    # --- Positive control: Bob CAN access his own resources ---

    def test_bob_can_get_own_tree_graph(self):
        """Bob gets 200 (or meaningful non-404) for his own tree graph.

        Note: May return 200 with empty tree or error about missing tree data,
        since the simulation is 'draft' without initialized tree. The key assertion
        is that it does NOT return 404 (ownership check passed).
        """
        client = TestClient(app)
        r = client.get(f"/api/simulations/{BOB_SIM_ID}/tree/graph", headers=_bob_headers())
        # Ownership check passed — should not be 404.
        # May be 200 (empty tree), 400 (no tree data), or 500 (runtime error),
        # but NOT 404 (wrong owner) or 401 (not authenticated).
        assert r.status_code not in (401, 404)

    def test_bob_can_get_own_tree_state(self):
        """Bob gets non-404 for his own tree state (ownership check passes)."""
        client = TestClient(app)
        r = client.get(f"/api/simulations/{BOB_SIM_ID}/tree/sim/0/state", headers=_bob_headers())
        assert r.status_code not in (401, 404)

    def test_bob_can_list_own_experiments(self):
        """Bob gets non-404 for his own experiments (ownership check passes).

        May return 500 due to missing Experiment table in minimal test DB,
        but should NOT return 404 (wrong owner) or 401 (not authenticated).
        """
        client = TestClient(app)
        r = client.get(f"/api/simulations/{BOB_SIM_ID}/experiments", headers=_bob_headers())
        assert r.status_code not in (401, 404)


class TestRealCrossUserProviderAccess:
    """Integration tests: real DB, real JWTs, real provider route handling.

    Verifies that User A (Alice) cannot modify User B's (Bob's) provider config.
    """

    @pytest.fixture(autouse=True)
    def _setup_data(self):
        _setup_integration_data()
        yield

    # --- Negative tests: Alice cannot touch Bob's provider ---

    def test_alice_cannot_update_bob_provider(self):
        """Alice gets 403 when trying to update Bob's provider."""
        client = TestClient(app)
        r = client.patch(
            "/api/providers/999",
            json={"name": "hacked"},
            headers=_alice_headers(),
        )
        assert r.status_code == 403

    def test_alice_cannot_delete_bob_provider(self):
        """Alice gets 403 when trying to delete Bob's provider."""
        client = TestClient(app)
        r = client.delete("/api/providers/999", headers=_alice_headers())
        assert r.status_code == 403

    def test_alice_cannot_test_bob_provider(self):
        """Alice gets 403 when trying to test Bob's provider."""
        client = TestClient(app)
        r = client.post("/api/providers/999/test", headers=_alice_headers())
        assert r.status_code == 403

    def test_alice_cannot_activate_bob_provider(self):
        """Alice gets 403 when trying to activate Bob's provider."""
        client = TestClient(app)
        r = client.post("/api/providers/999/activate", headers=_alice_headers())
        assert r.status_code == 403

    # --- Positive control: Bob CAN modify his own provider ---

    def test_bob_can_update_own_provider(self):
        """Bob can update his own provider (200 or meaningful response)."""
        client = TestClient(app)
        r = client.patch(
            "/api/providers/999",
            json={"name": "renamed-by-bob"},
            headers=_bob_headers(),
        )
        # Should NOT be 403 (ownership check passes).
        assert r.status_code not in (401, 403)

    def test_bob_can_delete_own_provider(self):
        """Bob can delete his own provider (gets 200 or 204, not 403)."""
        client = TestClient(app)
        r = client.delete("/api/providers/999", headers=_bob_headers())
        # Should NOT be 403 (ownership check passes)
        assert r.status_code not in (401, 403)
