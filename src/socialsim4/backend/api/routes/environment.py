from typing import Dict, Any
from litestar import Router, get, post
from litestar.connection import Request
from litestar.exceptions import HTTPException
from litestar.params import Body
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_session
from ...dependencies import extract_bearer_token, resolve_current_user
from ...services.environment_suggestion_service import (
    get_simulation_state,
    generate_environment_suggestions,
    broadcast_environment_event,
)


@get("/simulations/{simulation_id:str}/suggestions/status")
async def get_suggestion_status(
    simulation_id: str,
    request: Request,
) -> Dict[str, Any]:
    """Check if environment suggestions are available for the current turn."""
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)
        state = await get_simulation_state(simulation_id, session, current_user.id)

        if not state:
            return {"available": False, "turn": None}

        # Check if suggestions should be available
        config = state["config"]
        if not config.get("enabled"):
            return {"available": False, "turn": None}

        turns = state["turns"]
        interval = config.get("turn_interval", 5)

        available = (
            turns > 0
            and turns >= interval
            and state.get("_suggestions_viewed_turn") != (turns // interval) * interval
        )

        return {"available": available, "turn": turns if available else None}


@post("/simulations/{simulation_id:str}/suggestions/generate")
async def generate_suggestions(
    simulation_id: str,
    request: Request,
) -> Dict[str, Any]:
    """Generate environment event suggestions based on current simulation context."""
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)
        try:
            suggestions = await generate_environment_suggestions(simulation_id, session, current_user.id)
            return {"suggestions": suggestions}
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))


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
            return {"success": True, "message": "Event broadcast to simulation"}
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))


router = Router(
    path="/api",
    route_handlers=[
        get_suggestion_status,
        generate_suggestions,
        apply_environment_event,
    ],
)
