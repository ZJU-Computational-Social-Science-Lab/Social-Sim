from contextlib import asynccontextmanager
from types import SimpleNamespace
from typing import List
import importlib.util
from io import BytesIO

import pytest

if importlib.util.find_spec("litestar") is None:  # pragma: no cover - optional dep
    pytest.skip("litestar not installed", allow_module_level=True)

from litestar.exceptions import HTTPException
from socialsim4.backend.api.routes import uploads


class _DummyFile:
    def __init__(self, content_type: str, filename: str, chunks: List[bytes]):
        self.content_type = content_type
        self.filename = filename
        self._chunks = list(chunks)

    async def read(self, size: int) -> bytes:
        return self._chunks.pop(0) if self._chunks else b""

    async def close(self) -> None:  # pragma: no cover - no-op
        return None


@asynccontextmanager
async def _dummy_session():
    yield None


def _patch_auth(monkeypatch):
    monkeypatch.setattr(uploads, "extract_bearer_token", lambda req: "token")

    async def _resolve_current_user(session, token):
        return None

    monkeypatch.setattr(uploads, "resolve_current_user", _resolve_current_user)
    monkeypatch.setattr(uploads, "get_session", _dummy_session)


def _handler():
    return uploads.upload_image.fn


@pytest.mark.asyncio
async def test_upload_cloud_backend_returns_cloud_url(monkeypatch, tmp_path):
    settings = SimpleNamespace(
        upload_backend="cloud",
        upload_cloud_base_url="https://cdn.example",
        upload_cloud_dir=str(tmp_path / "cloud"),
        upload_max_mb=5,
        upload_docs_max_mb=10,
        upload_enable_ocr=False,
        upload_ocr_lang=None,
        upload_dir=str(tmp_path),
        upload_base_url="/uploads",
        backend_root_path="",
    )
    monkeypatch.setattr(uploads, "get_settings", lambda: settings)
    _patch_auth(monkeypatch)

    dummy = _DummyFile("image/png", "foo.png", [b"abc", b""])

    result = await _handler()(None, dummy)

    assert result["url"].startswith("https://cdn.example/")
    assert result["filename"] == "foo.png"


@pytest.mark.asyncio
async def test_upload_enforces_size_limit(monkeypatch, tmp_path):
    settings = SimpleNamespace(
        upload_backend="local",
        upload_max_mb=0,  # 0 bytes allowed triggers size guard immediately
        upload_docs_max_mb=10,
        upload_enable_ocr=False,
        upload_ocr_lang=None,
        upload_dir=str(tmp_path),
        upload_base_url="/uploads",
        backend_root_path="",
    )
    monkeypatch.setattr(uploads, "get_settings", lambda: settings)
    _patch_auth(monkeypatch)

    dummy = _DummyFile("image/png", "foo.png", [b"abc", b""])

    with pytest.raises(HTTPException) as exc:
        await _handler()(None, dummy)

    assert exc.value.status_code == 413
    assert "limit" in exc.value.detail


@pytest.mark.asyncio
async def test_upload_rejects_invalid_content_type(monkeypatch, tmp_path):
    settings = SimpleNamespace(
        upload_backend="local",
        upload_max_mb=5,
        upload_docs_max_mb=10,
        upload_enable_ocr=False,
        upload_ocr_lang=None,
        upload_dir=str(tmp_path),
        upload_base_url="/uploads",
        backend_root_path="",
    )
    monkeypatch.setattr(uploads, "get_settings", lambda: settings)
    _patch_auth(monkeypatch)

    dummy = _DummyFile("text/plain", "foo.txt", [b"hello", b""])

    with pytest.raises(HTTPException) as exc:
        await _handler()(None, dummy)

    assert exc.value.status_code == 400
    assert "Only" in exc.value.detail


@pytest.mark.asyncio
async def test_upload_empty_file_rejected(monkeypatch, tmp_path):
    settings = SimpleNamespace(
        upload_backend="local",
        upload_max_mb=5,
        upload_docs_max_mb=10,
        upload_enable_ocr=False,
        upload_ocr_lang=None,
        upload_dir=str(tmp_path),
        upload_base_url="/uploads",
        backend_root_path="",
    )
    monkeypatch.setattr(uploads, "get_settings", lambda: settings)
    _patch_auth(monkeypatch)

    dummy = _DummyFile("image/png", "foo.png", [b""])

    with pytest.raises(HTTPException) as exc:
        await _handler()(None, dummy)

    assert exc.value.status_code == 400
    assert "Empty" in exc.value.detail


@pytest.mark.asyncio
async def test_upload_accepts_data_url(monkeypatch, tmp_path):
    settings = SimpleNamespace(
        upload_backend="local",
        upload_max_mb=1,
        upload_docs_max_mb=10,
        upload_enable_ocr=False,
        upload_ocr_lang=None,
        upload_dir=str(tmp_path),
        upload_base_url="/uploads",
        backend_root_path="",
    )
    monkeypatch.setattr(uploads, "get_settings", lambda: settings)
    _patch_auth(monkeypatch)

    png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\x00" * 20
    import base64

    data_url = "data:image/png;base64," + base64.b64encode(png_bytes).decode()

    result = await _handler()(None, None, data_url)

    assert result["url"].endswith(".png")
    assert result["size"] == len(png_bytes)


@pytest.mark.asyncio
async def test_upload_extracts_docx(monkeypatch, tmp_path):
    settings = SimpleNamespace(
        upload_backend="local",
        upload_max_mb=5,
        upload_docs_max_mb=10,
        upload_enable_ocr=False,
        upload_ocr_lang=None,
        upload_dir=str(tmp_path),
        upload_base_url="/uploads",
        backend_root_path="",
    )
    monkeypatch.setattr(uploads, "get_settings", lambda: settings)
    _patch_auth(monkeypatch)

    try:
        import docx
    except ImportError:
        pytest.skip("python-docx not installed")

    document = docx.Document()
    document.add_paragraph("Hello from docx")
    buf = BytesIO()
    document.save(buf)
    data = buf.getvalue()

    dummy = _DummyFile(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "note.docx",
        [data, b""],
    )

    result = await _handler()(None, dummy)

    assert "Hello" in (result.get("extracted_text") or "")
    assert result["content_type"].endswith("document")


@pytest.mark.asyncio
async def test_upload_doc_respects_doc_limit(monkeypatch, tmp_path):
    settings = SimpleNamespace(
        upload_backend="local",
        upload_max_mb=5,
        upload_docs_max_mb=0,
        upload_enable_ocr=False,
        upload_ocr_lang=None,
        upload_dir=str(tmp_path),
        upload_base_url="/uploads",
        backend_root_path="",
    )
    monkeypatch.setattr(uploads, "get_settings", lambda: settings)
    _patch_auth(monkeypatch)

    data = b"a" * 1024
    dummy = _DummyFile("application/pdf", "tiny.pdf", [data, b""])

    with pytest.raises(HTTPException) as exc:
        await _handler()(None, dummy)

    assert exc.value.status_code == 413


# New tests for file signature validation, rate limiting, and file management


@pytest.mark.asyncio
async def test_upload_rejects_invalid_file_signature(monkeypatch, tmp_path):
    """Test that files with mismatched content-type and magic bytes are rejected."""
    settings = SimpleNamespace(
        upload_backend="local",
        upload_max_mb=5,
        upload_docs_max_mb=10,
        upload_enable_ocr=False,
        upload_ocr_lang=None,
        upload_dir=str(tmp_path),
        upload_base_url="/uploads",
        backend_root_path="",
    )
    monkeypatch.setattr(uploads, "get_settings", lambda: settings)
    _patch_auth(monkeypatch)

    # PNG header but claimed to be JPEG
    fake_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\x00" * 20
    dummy = _DummyFile("image/jpeg", "fake.jpg", [fake_png, b""])

    with pytest.raises(HTTPException) as exc:
        await _handler()(None, dummy)

    assert exc.value.status_code == 400
    assert "does not match declared type" in exc.value.detail


@pytest.mark.asyncio
async def test_upload_accepts_valid_file_signature(monkeypatch, tmp_path):
    """Test that files with correct magic bytes are accepted."""
    settings = SimpleNamespace(
        upload_backend="local",
        upload_max_mb=5,
        upload_docs_max_mb=10,
        upload_enable_ocr=False,
        upload_ocr_lang=None,
        upload_dir=str(tmp_path),
        upload_base_url="/uploads",
        backend_root_path="",
    )
    monkeypatch.setattr(uploads, "get_settings", lambda: settings)
    _patch_auth(monkeypatch)

    # Valid PNG header
    valid_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\x00" * 20
    dummy = _DummyFile("image/png", "valid.png", [valid_png, b""])

    result = await _handler()(None, dummy)

    assert result["content_type"] == "image/png"
    assert result["url"].endswith(".png")


@pytest.mark.asyncio
async def test_upload_enforces_rate_limit(monkeypatch, tmp_path):
    """Test that rate limiting works after exceeding the limit."""
    settings = SimpleNamespace(
        upload_backend="local",
        upload_max_mb=5,
        upload_docs_max_mb=10,
        upload_enable_ocr=False,
        upload_ocr_lang=None,
        upload_dir=str(tmp_path),
        upload_base_url="/uploads",
        backend_root_path="",
    )
    monkeypatch.setattr(uploads, "get_settings", lambda: settings)

    # Mock user with ID
    class MockUser:
        id = "test_user_123"

    async def _resolve_current_user_with_id(session, token):
        return MockUser()

    monkeypatch.setattr(uploads, "resolve_current_user", _resolve_current_user_with_id)
    monkeypatch.setattr(uploads, "get_session", _dummy_session)
    monkeypatch.setattr(uploads, "extract_bearer_token", lambda req: "token")

    # Reset rate limiter
    uploads._upload_rate_limit.clear()
    uploads._RATE_LIMIT_REQUESTS = 3  # Lower limit for testing
    uploads._RATE_LIMIT_WINDOW = 60

    handler = _handler()

    # First 3 requests should succeed
    valid_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\x00" * 20
    for i in range(3):
        dummy = _DummyFile("image/png", f"test{i}.png", [valid_png, b""])
        result = await handler(None, dummy)
        assert result["content_type"] == "image/png"

    # 4th request should be rate limited
    dummy = _DummyFile("image/png", "test4.png", [valid_png, b""])
    with pytest.raises(HTTPException) as exc:
        await handler(None, dummy)

    assert exc.value.status_code == 429
    assert "Rate limit exceeded" in exc.value.detail

    # Reset rate limit to original value
    uploads._RATE_LIMIT_REQUESTS = 10


@pytest.mark.asyncio
async def test_list_uploads_returns_file_metadata(monkeypatch, tmp_path):
    """Test that list endpoint returns correct file metadata."""
    settings = SimpleNamespace(
        upload_backend="local",
        upload_max_mb=5,
        upload_docs_max_mb=10,
        upload_enable_ocr=False,
        upload_ocr_lang=None,
        upload_dir=str(tmp_path),
        upload_base_url="/uploads",
        backend_root_path="",
    )
    monkeypatch.setattr(uploads, "get_settings", lambda: settings)
    _patch_auth(monkeypatch)

    # Create a test file
    test_file = tmp_path / "test_upload.png"
    test_file.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)

    result = await uploads.list_uploads.fn(None)

    assert isinstance(result, list)
    # Should find at least the file we created
    assert len(result) >= 1
    file_entry = next((f for f in result if f["filename"] == "test_upload.png"), None)
    assert file_entry is not None
    assert file_entry["size"] == len(test_file.read_bytes())
    assert file_entry["type"] == "png"


@pytest.mark.asyncio
async def test_delete_upload_removes_file(monkeypatch, tmp_path):
    """Test that delete endpoint removes the file."""
    settings = SimpleNamespace(
        upload_backend="local",
        upload_max_mb=5,
        upload_docs_max_mb=10,
        upload_enable_ocr=False,
        upload_ocr_lang=None,
        upload_dir=str(tmp_path),
        upload_base_url="/uploads",
        backend_root_path="",
    )
    monkeypatch.setattr(uploads, "get_settings", lambda: settings)
    _patch_auth(monkeypatch)

    # Create a test file with known UUID
    file_id = "abc123test"
    test_file = tmp_path / f"{file_id}.png"
    test_file.write_bytes(b"test content")

    # Delete the file
    result = await uploads.delete_upload.fn(None, file_id)

    assert result["deleted"] == 1
    assert result["id"] == file_id
    assert not test_file.exists()


@pytest.mark.asyncio
async def test_delete_upload_returns_404_for_missing_file(monkeypatch, tmp_path):
    """Test that delete returns 404 for non-existent files."""
    settings = SimpleNamespace(
        upload_backend="local",
        upload_max_mb=5,
        upload_docs_max_mb=10,
        upload_enable_ocr=False,
        upload_ocr_lang=None,
        upload_dir=str(tmp_path),
        upload_base_url="/uploads",
        backend_root_path="",
    )
    monkeypatch.setattr(uploads, "get_settings", lambda: settings)
    _patch_auth(monkeypatch)

    with pytest.raises(HTTPException) as exc:
        await uploads.delete_upload.fn(None, "nonexistent")

    assert exc.value.status_code == 404
    assert "not found" in exc.value.detail


# Tests for SSRF prevention in llm.py
def test_validate_media_url_accepts_valid_urls():
    """Test that valid URLs pass validation."""
    from socialsim4.core.llm import validate_media_url

    assert validate_media_url("https://example.com/image.jpg") == "valid"
    assert validate_media_url("http://cdn.example.org/file.png") == "valid"
    assert validate_media_url("data:image/png;base64,iVBORw0KG...") == "valid"


def test_validate_media_url_rejects_private_networks():
    """Test that private network URLs are rejected."""
    from socialsim4.core.llm import validate_media_url

    assert validate_media_url("http://127.0.0.1/image.jpg") == "private_network"
    assert validate_media_url("http://localhost/file.png") == "private_network"
    assert validate_media_url("http://10.0.0.1/image.jpg") == "private_network"
    assert validate_media_url("http://192.168.1.1/image.jpg") == "private_network"
    assert validate_media_url("http://172.16.0.1/image.jpg") == "private_network"
    assert validate_media_url("http://169.254.169.254/image.jpg") == "private_network"  # AWS metadata


def test_validate_media_url_rejects_invalid_schemes():
    """Test that URLs with invalid schemes are rejected."""
    from socialsim4.core.llm import validate_media_url

    assert validate_media_url("file:///etc/passwd") == "invalid_scheme"
    assert validate_media_url("ftp://example.com/file.jpg") == "invalid_scheme"
    assert validate_media_url("javascript:alert(1)") == "invalid_scheme"
