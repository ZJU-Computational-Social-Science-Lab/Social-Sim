from __future__ import annotations

import base64
import re
import shutil
from pathlib import Path
from uuid import uuid4

from litestar import Router, post
from litestar.connection import Request
from litestar.datastructures import UploadFile
from litestar.exceptions import HTTPException
from litestar.params import Body

from ...core.config import get_settings
from ...core.database import get_session
from ...dependencies import extract_bearer_token, resolve_current_user


ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/ogg",
    "video/mp4",
    "video/webm",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

DOC_CONTENT_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def _safe_suffix(filename: str | None) -> str:
    if not filename:
        return ""
    suffix = Path(filename).suffix.lower()
    return suffix if suffix else ""


def _decode_data_url(data_url: str):
    match = re.match(r"data:([a-zA-Z0-9./+-]+);base64,(.+)", data_url)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid data URL")
    mime, b64 = match.groups()
    try:
        data = base64.b64decode(b64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 payload")
    return mime.lower(), data


def _extract_doc_text(path: Path, content_type: str, enable_ocr: bool, ocr_lang: str | None) -> str:
    if content_type == "application/pdf":
        try:
            import pdfplumber
        except Exception as exc:
            raise HTTPException(status_code=500, detail="pdfplumber not installed for PDF extraction") from exc

        with pdfplumber.open(path) as pdf:
            pages = [page.extract_text() or "" for page in pdf.pages]
        text = "\n".join([p for p in pages if p]).strip()
        if text:
            return text
        if not enable_ocr:
            return ""
        if shutil.which("tesseract") is None:
            raise HTTPException(status_code=500, detail="Tesseract not available for OCR")
        try:
            import pytesseract
        except Exception as exc:
            raise HTTPException(status_code=500, detail="pytesseract not installed for OCR") from exc
        # OCR every page as an image at a modest DPI to avoid huge memory use
        with pdfplumber.open(path) as pdf:
            texts: list[str] = []
            for page in pdf.pages:
                img = page.to_image(resolution=200).original
                texts.append(pytesseract.image_to_string(img, lang=ocr_lang or "eng"))
        return "\n".join(texts).strip()

    if content_type in {
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }:
        try:
            import docx
        except Exception as exc:
            raise HTTPException(status_code=500, detail="python-docx not installed for DOC/DOCX extraction") from exc
        doc = docx.Document(path)
        paragraphs = [p.text for p in doc.paragraphs if p.text]
        return "\n".join(paragraphs).strip()

    return ""


@post("/", tags=["uploads"])
async def upload_image(
    request: Request,
    file: UploadFile | None = Body(media_type="multipart/form-data", default=None),
    data_url: str | None = Body(media_type="multipart/form-data", default=None),
    ocr: bool | None = Body(media_type="multipart/form-data", default=None),
) -> dict:
    token = extract_bearer_token(request)
    async with get_session() as session:
        await resolve_current_user(session, token)

    settings = get_settings()
    if settings.upload_backend not in {"local", "cloud"}:
        raise HTTPException(status_code=400, detail="Invalid upload_backend")
    media_max_bytes = int(settings.upload_max_mb) * 1024 * 1024
    doc_max_bytes = int(settings.upload_docs_max_mb) * 1024 * 1024

    # Pick storage root: local dir or cloud-mounted dir
    root_dir = Path(__file__).resolve().parents[5]
    if settings.upload_backend == "cloud":
        if not settings.upload_cloud_base_url:
            raise HTTPException(status_code=400, detail="upload_cloud_base_url required for cloud backend")
        upload_root = Path(settings.upload_cloud_dir or settings.upload_dir).resolve()
    else:
        upload_root = (root_dir / settings.upload_dir).resolve()
    upload_root.mkdir(parents=True, exist_ok=True)

    # Resolve payload: file upload or data URL
    if file is None and data_url is None:
        raise HTTPException(status_code=400, detail="file or data_url required")

    if data_url:
        content_type, raw = _decode_data_url(data_url)
        if content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(status_code=400, detail="Only JPEG/PNG/GIF/WEBP/MP3/WAV/OGG/MP4/WEBM/PDF/DOC/DOCX are allowed")
        max_bytes = doc_max_bytes if content_type in DOC_CONTENT_TYPES else media_max_bytes
        if len(raw) > max_bytes:
            limit_mb = settings.upload_docs_max_mb if content_type in DOC_CONTENT_TYPES else settings.upload_max_mb
            raise HTTPException(status_code=413, detail=f"File exceeds {limit_mb}MB limit")
        filename = f"{uuid4().hex}{_safe_suffix(None)}"
        dest = upload_root / f"{filename or uuid4().hex}{_safe_suffix('data.' + content_type.split('/')[-1])}"
        dest.write_bytes(raw)
        written = len(raw)
    else:
        content_type = (file.content_type or "").lower()
        if content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(status_code=400, detail="Only JPEG/PNG/GIF/WEBP/MP3/WAV/OGG/MP4/WEBM/PDF/DOC/DOCX are allowed")
        max_bytes = doc_max_bytes if content_type in DOC_CONTENT_TYPES else media_max_bytes
        filename = f"{uuid4().hex}{_safe_suffix(file.filename)}"
        dest = upload_root / filename
        written = 0
        with dest.open("wb") as out:
            while True:
                chunk = await file.read(1024 * 512)
                if not chunk:
                    break
                if written + len(chunk) > max_bytes:
                    out.close()
                    dest.unlink(missing_ok=True)
                    limit_mb = settings.upload_docs_max_mb if content_type in DOC_CONTENT_TYPES else settings.upload_max_mb
                    raise HTTPException(status_code=413, detail=f"File exceeds {limit_mb}MB limit")
                out.write(chunk)
                written += len(chunk)
        await file.close()

        if written == 0:
            dest.unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail="Empty file")

    if settings.upload_backend == "cloud":
        base = settings.upload_cloud_base_url or settings.upload_base_url
        public_url = f"{base.rstrip('/')}/{dest.name}"
    else:
        public_url = f"{settings.backend_root_path.rstrip('/')}{settings.upload_base_url}/{dest.name}"

    extracted_text = None
    use_ocr = bool(settings.upload_enable_ocr or ocr)
    if content_type in DOC_CONTENT_TYPES:
        extracted_text = _extract_doc_text(dest, content_type, use_ocr, settings.upload_ocr_lang)

    return {
        "url": public_url,
        "filename": (file.filename if file else dest.name) or dest.name,
        "size": written,
        "content_type": content_type,
        "extracted_text": extracted_text,
    }


router = Router(path="/uploads", route_handlers=[upload_image])
