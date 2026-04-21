from typing import Dict, Any
import logging
import mimetypes
import uuid
from pathlib import Path
from litestar import Router, get, post
from litestar.connection import Request
from litestar.exceptions import HTTPException
from litestar.params import Body
from sqlalchemy.ext.asyncio import AsyncSession

from socialsim4.i18n import T
from ...core.database import get_session
from ...dependencies import extract_bearer_token, resolve_current_user
from ...services.environment_suggestion_service import (
    get_simulation_state,
    generate_environment_suggestions,
    broadcast_environment_event,
    dismiss_suggestions,
)

logger = logging.getLogger(__name__)

# Media upload configuration
MEDIA_UPLOAD_DIR = Path("./uploads/environment_media")
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_AUDIO_TYPES = {"audio/mpeg", "audio/wav", "audio/ogg", "audio/webm", "audio/m4a"}


def _parse_node_id_param(request: Request) -> int | None:
    node_id_param = request.query_params.get("node_id")
    if node_id_param is None:
        return None
    try:
        return int(node_id_param)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid 'node_id' query parameter: expected an integer.")


@get("/simulations/{simulation_id:str}/suggestions/status")
async def get_suggestion_status(
    simulation_id: str,
    request: Request,
) -> Dict[str, Any]:
    """Check if environment suggestions are available for the current turn."""
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)
        node_id = _parse_node_id_param(request)
        state = await get_simulation_state(simulation_id, session, current_user.id, node_id)

        if not state:
            return {"available": False, "turn": None, "enabled": False}

        config = state["config"]
        if not config.get("enabled"):
            return {"available": False, "turn": None, "enabled": False}

        turns = state["turns"]
        interval = config.get("turn_interval", 5)
        current_interval_milestone = (turns // interval) * interval
        viewed_intervals = state.get("_suggestions_viewed_intervals", set())

        available = (
            turns > 0
            and turns >= interval
            and current_interval_milestone not in viewed_intervals
        )
        return {"available": available, "turn": turns if available else None, "enabled": True}


@post("/simulations/{simulation_id:str}/suggestions/generate")
async def generate_suggestions(
    simulation_id: str,
    request: Request,
) -> Dict[str, Any]:
    """Generate environment event suggestions based on current simulation context."""
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)
        node_id = _parse_node_id_param(request)
        suggestions = await generate_environment_suggestions(simulation_id, session, current_user.id, node_id)

        # Ensure suggestions are JSON-serializable (convert to list of dicts with str values)
        cleaned_suggestions = [
            {
                "event_type": str(s.get("event_type", "")),
                "description": str(s.get("description", "")),
                "severity": str(s.get("severity", "mild")),
            }
            for s in suggestions
        ]
        return {"suggestions": cleaned_suggestions}


@post("/simulations/{simulation_id:str}/events/environment")
async def apply_environment_event(
    simulation_id: str,
    data: Dict[str, Any],
    request: Request,
) -> Dict[str, Any]:
    """Apply an environment event to the simulation."""
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)
        try:
            await broadcast_environment_event(
                simulation_id,
                data,
                session,
                current_user.id,
            )
            return {"success": True, "message": T('api.environment.event_broadcast')}
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))


@post("/simulations/{simulation_id:str}/suggestions/dismiss")
async def dismiss_suggestions_endpoint(
    simulation_id: str,
    request: Request,
) -> Dict[str, Any]:
    """Dismiss environment suggestions for the current interval."""
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)
        try:
            await dismiss_suggestions(simulation_id, session, current_user.id)
            return {"success": True, "message": T('api.environment.suggestions_dismissed')}
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))


@post("/simulations/{simulation_id:str}/events/upload-media")
async def upload_media_endpoint(
    simulation_id: str,
    request: Request,
) -> Dict[str, Any]:
    """Upload media (image or audio) for environment events."""
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)

        try:
            # Parse multipart form data
            form_data = await request.form()
            file = form_data.get("file")
            media_type = form_data.get("media_type")

            if not file:
                raise HTTPException(status_code=400, detail="File is required")
            if media_type not in ["image", "audio"]:
                raise HTTPException(status_code=400, detail="media_type must be 'image' or 'audio'")

            # Check file size
            file_content = await file.read()
            if len(file_content) > MAX_FILE_SIZE:
                raise HTTPException(status_code=413, detail=f"File too large. Max: {MAX_FILE_SIZE / 1024 / 1024}MB")

            # Determine MIME type
            content_type = file.content_type or mimetypes.guess_type(file.filename)[0]
            allowed_types = ALLOWED_IMAGE_TYPES if media_type == "image" else ALLOWED_AUDIO_TYPES

            if content_type not in allowed_types:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid {media_type} type. Allowed: {', '.join(allowed_types)}"
                )

            # Save file
            MEDIA_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
            file_ext = Path(file.filename).suffix if file.filename else ".bin"
            unique_filename = f"{uuid.uuid4()}{file_ext}"
            file_path = MEDIA_UPLOAD_DIR / unique_filename

            with open(file_path, "wb") as f:
                f.write(file_content)

            # Return relative URL for storage
            relative_url = f"/uploads/environment_media/{unique_filename}"
            return {"success": True, "url": relative_url}

        except Exception as e:
            logger.error(f"Media upload error: {e}")
            raise HTTPException(status_code=500, detail="Media upload failed")


@post("/simulations/{simulation_id:str}/events/custom-environment")
async def create_custom_environment_event(
    simulation_id: str,
    data: Dict[str, Any],
    request: Request,
) -> Dict[str, Any]:
    """Create and apply a custom environment event or configuration.
    
    Supports two modes:
    - global: Apply to all agents or specified receivers
    - agent: Apply to a specific agent only
    """
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)

        try:
            # Validate required fields
            if not data.get("event_type"):
                raise ValueError("event_type is required")
            if not data.get("severity"):
                raise ValueError("severity is required")

            # Ensure at least one content type
            multimodal = data.get("multimodal", {})
            if not (data.get("description") or multimodal.get("image_url") or multimodal.get("audio_url")):
                raise ValueError("Event must have description or multimodal content")

            # Get configuration mode and target agent
            config_mode = data.get("config_mode", "global")
            target_agent_id = data.get("target_agent_id")

            # Validate agent mode
            if config_mode == "agent":
                if not target_agent_id:
                    raise ValueError("target_agent_id is required for agent mode")
                # Force receivers to be just the target agent
                receivers = [target_agent_id]
            else:
                # Global mode: use specified receivers or broadcast to all
                receivers = data.get("receivers")

            # Prepare event data with configuration metadata
            event_data = {
                "event_type": data["event_type"],
                "description": data.get("description", ""),
                "severity": data["severity"],
                "notice_only": data.get("notice_only", False),
                "receivers": receivers,
                "multimodal": multimodal if multimodal else None,
                "is_custom": True,
                "created_by": current_user.id,
                "config_mode": config_mode,
                "target_agent_id": target_agent_id if config_mode == "agent" else None,
            }

            # Broadcast the custom event
            await broadcast_environment_event(
                simulation_id,
                event_data,
                session,
                current_user.id,
            )

            return {
                "success": True,
                "message": f"{'Agent-specific' if config_mode == 'agent' else 'Global'} configuration created and applied",
                "event": event_data,
            }

        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            logger.error(f"Custom event creation error: {e}")
            raise HTTPException(status_code=500, detail="Failed to create custom event")


router = Router(
    path="",
    route_handlers=[
        get_suggestion_status,
        generate_suggestions,
        apply_environment_event,
        dismiss_suggestions_endpoint,
        upload_media_endpoint,
        create_custom_environment_event,
    ],
)
