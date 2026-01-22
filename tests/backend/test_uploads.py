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
