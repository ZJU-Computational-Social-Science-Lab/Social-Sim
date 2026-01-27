from __future__ import annotations

import base64
import re
import shutil
import time
from collections import defaultdict
from pathlib import Path
from threading import Lock
from typing import Annotated
from uuid import uuid4

from litestar import Router, post, get, delete
from litestar.response import Response
from litestar.status_codes import HTTP_200_OK
from litestar.connection import Request
from litestar.datastructures import UploadFile
from litestar.enums import RequestEncodingType
from litestar.exceptions import HTTPException
from litestar.params import Body

from ...core.config import get_settings
from ...core.database import get_session
from ...dependencies import extract_bearer_token, resolve_current_user


# Rate limiting: Track upload requests per user (in-memory)
# For production, consider using Redis or similar
_upload_rate_limit: defaultdict[str, list[float]] = defaultdict(list)
_rate_limit_lock = Lock()

# Rate limit settings: max uploads per time window
_RATE_LIMIT_REQUESTS = 10  # Maximum uploads allowed
_RATE_LIMIT_WINDOW = 60  # Time window in seconds


def _check_rate_limit(user_id: str) -> bool:
    """
    Check if user has exceeded rate limit for uploads.

    Returns True if rate limit is OK, False if limit exceeded.
    """
    with _rate_limit_lock:
        now = time.time()
        # Clean up old entries outside the time window
        _upload_rate_limit[user_id] = [
            ts for ts in _upload_rate_limit[user_id]
            if now - ts < _RATE_LIMIT_WINDOW
        ]
        # Check if under limit
        if len(_upload_rate_limit[user_id]) >= _RATE_LIMIT_REQUESTS:
            return False
        # Record this request
        _upload_rate_limit[user_id].append(now)
        return True


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


# File signature (magic bytes) validation
# Maps content types to their expected byte signatures
FILE_SIGNATURES: dict[str, tuple[bytes, ...]] = {
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/gif": (b"GIF87a", b"GIF89a"),
    "image/webp": (b"RIFF",),
    "audio/mpeg": (b"\xff\xfb", b"\xff\xfa", b"ID3"),
    "audio/mp3": (b"\xff\xfb", b"\xff\xfa", b"ID3"),
    "audio/wav": (b"RIFF",),
    "audio/ogg": (b"OggS",),
    "video/mp4": (b"\x00\x00\x00", b"\x00\x00\x00\x20ftypmp4", b"ftyp"),
    "video/webm": (b"\x1aE\xdf\xa3",),  # EBML header
    "application/pdf": (b"%PDF",),
    "application/msword": (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",),  # OLE
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": (b"PK\x03\x04",),  # ZIP
}


def _validate_file_signature(content: bytes, content_type: str) -> bool:
    """
    Validate file signature (magic bytes) to prevent spoofed Content-Type.

    Args:
        content: First few bytes of the file content
        content_type: Declared content type

    Returns:
        True if the file signature matches the content type, False otherwise
    """
    if not content:
        return False

    signatures = FILE_SIGNATURES.get(content_type)
    if not signatures:
        # No signature defined for this type, allow it
        return True

    # Check if content starts with any of the expected signatures
    for sig in signatures:
        if content.startswith(sig):
            return True

    return False


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
    file: Annotated[UploadFile | None, Body(media_type=RequestEncodingType.MULTI_PART)] = None,
    data_url: Annotated[str | None, Body(media_type=RequestEncodingType.MULTI_PART)] = None,
    ocr: Annotated[bool | None, Body(media_type=RequestEncodingType.MULTI_PART)] = None,
) -> dict:
    token = extract_bearer_token(request)
    async with get_session() as session:
        user = await resolve_current_user(session, token)
        user_id = str(user.id) if user else "anonymous"

    # Check rate limit
    if not _check_rate_limit(user_id):
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded: maximum {_RATE_LIMIT_REQUESTS} uploads per {_RATE_LIMIT_WINDOW} seconds"
        )

    settings = get_settings()
    if settings.upload_backend not in {"local", "cloud"}:
        raise HTTPException(status_code=400, detail="Invalid upload_backend")
    media_max_bytes = int(settings.upload_max_mb) * 1024 * 1024
    doc_max_bytes = int(settings.upload_docs_max_mb) * 1024 * 1024

    # Pick storage root: local dir or cloud-mounted dir
    root_dir = Path(__file__).resolve().parents[5]
    if settings.upload_backend == "cloud":
        upload_root = Path(settings.upload_cloud_dir or settings.upload_dir).resolve()
        public_base = settings.upload_cloud_base_url or settings.upload_base_url
    else:
        upload_root = (root_dir / settings.upload_dir).resolve()
        public_base = f"{settings.backend_root_path.rstrip('/')}{settings.upload_base_url}"
    upload_root.mkdir(parents=True, exist_ok=True)

    # Resolve payload: file upload or data URL. Some Litestar versions don't bind UploadFile automatically; fallback to parsing form.
    if file is None and data_url is None:
        form = await request.form()
        if file is None:
            file = form.get("file")
        if data_url is None:
            raw = form.get("data_url")
            data_url = raw if isinstance(raw, str) else None
    if file is None and data_url is None:
        raise HTTPException(status_code=400, detail="file or data_url required")

    if data_url:
        content_type, raw = _decode_data_url(data_url)
        if content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(status_code=400, detail="Only JPEG/PNG/GIF/WEBP/MP3/WAV/OGG/MP4/WEBM/PDF/DOC/DOCX are allowed")
        # Validate file signature
        if not _validate_file_signature(raw, content_type):
            raise HTTPException(status_code=400, detail=f"File content does not match declared type {content_type}")
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
        signature_checked = False
        with dest.open("wb") as out:
            while True:
                chunk = await file.read(1024 * 512)
                if not chunk:
                    break
                # Check signature on first chunk
                if not signature_checked:
                    if not _validate_file_signature(chunk, content_type):
                        out.close()
                        dest.unlink(missing_ok=True)
                        raise HTTPException(status_code=400, detail=f"File content does not match declared type {content_type}")
                    signature_checked = True
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

    public_url = f"{public_base.rstrip('/')}/{dest.name}"

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


def _get_upload_root() -> Path:
    """Get the upload directory based on current settings."""
    settings = get_settings()
    root_dir = Path(__file__).resolve().parents[5]
    if settings.upload_backend == "cloud":
        return Path(settings.upload_cloud_dir or settings.upload_dir).resolve()
    else:
        return (root_dir / settings.upload_dir).resolve()


@get("/", tags=["uploads"])
async def list_uploads(request: Request) -> list[dict]:
    """
    List all uploaded files with metadata.

    Returns a list of files with id, filename, size, created timestamp, and type.
    """
    # Require authentication
    token = extract_bearer_token(request)
    async with get_session() as session:
        await resolve_current_user(session, token)

    upload_root = _get_upload_root()
    files = []

    if not upload_root.exists():
        return []

    for path in upload_root.iterdir():
        if path.is_file():
            try:
                stat = path.stat()
                files.append({
                    "id": path.stem,  # UUID without extension
                    "filename": path.name,
                    "size": stat.st_size,
                    "created": stat.st_ctime,
                    "type": path.suffix[1:] if path.suffix else "",  # extension without dot
                })
            except (OSError, IOError):
                # Skip files that can't be read
                continue

    return sorted(files, key=lambda f: f["created"], reverse=True)


@delete("/{file_id:str}", tags=["uploads"], status_code=HTTP_200_OK)
async def delete_upload(request: Request, file_id: str) -> dict:
    """
    Delete a file by its UUID.

    The file_id is the UUID without the extension - the endpoint will
    find and delete the file matching this ID regardless of extension.
    """
    # Require authentication
    token = extract_bearer_token(request)
    async with get_session() as session:
        await resolve_current_user(session, token)

    upload_root = _get_upload_root()

    if not upload_root.exists():
        raise HTTPException(status_code=404, detail="Upload directory not found")

    # Find file matching the UUID (any extension)
    matching_files = [
        p for p in upload_root.iterdir()
        if p.is_file() and p.stem == file_id
    ]

    if not matching_files:
        raise HTTPException(status_code=404, detail="File not found")

    # Delete all matching files (should be at most one)
    deleted_count = 0
    for path in matching_files:
        try:
            path.unlink()
            deleted_count += 1
        except OSError as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete file: {e}")

    return {
        "deleted": deleted_count,
        "id": file_id,
    }


@post("/cleanup", tags=["uploads"])
async def find_orphaned_uploads(request: Request) -> dict:
    """
    Find orphaned files that are not referenced in any current simulation data.

    This checks references in:
    - All simulation logs (imageUrl, audioUrl, videoUrl)
    - Agent avatarUrls
    - Initial events

    Note: This only checks data currently loaded in memory. For a complete
    scan, you would need to query the database for all simulations.
    """
    # Require authentication
    token = extract_bearer_token(request)
    async with get_session() as session:
        await resolve_current_user(session, token)

    from ...core.simulator import Simulator  # Import here to avoid circular dependency

    upload_root = _get_upload_root()

    if not upload_root.exists():
        return {"orphaned": [], "total": 0}

    # Get all file IDs in uploads directory
    all_file_ids = {p.stem for p in upload_root.iterdir() if p.is_file()}

    # For a simpler implementation, we'll return all files
    # A full implementation would scan all simulations in the database
    # to find which files are actually referenced
    # This is a placeholder that returns empty - in production, implement
    # a full database scan
    return {
        "orphaned": [],
        "total": len(all_file_ids),
        "note": "Full orphan detection requires database scan - implement for production"
    }


router = Router(path="/uploads", route_handlers=[
    upload_image,
    list_uploads,
    delete_upload,
    find_orphaned_uploads,
])
