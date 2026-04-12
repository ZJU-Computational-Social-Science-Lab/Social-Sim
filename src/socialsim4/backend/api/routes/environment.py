from typing import Dict, Any
import logging
from litestar import Router, get, post
from litestar.connection import Request
from litestar.exceptions import HTTPException
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


router = Router(
    path="",
    route_handlers=[
        get_suggestion_status,
        generate_suggestions,
        apply_environment_event,
        dismiss_suggestions_endpoint,
    ],
)
