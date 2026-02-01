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
    dismiss_suggestions,
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

        # Calculate the current interval milestone (e.g., turns=7, interval=5 -> milestone=5)
        current_interval_milestone = (turns // interval) * interval

        # Check if this interval has already been viewed
        viewed_intervals = state.get("_suggestions_viewed_intervals", set())

        # Debug logging
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"[STATUS] sim={simulation_id} turns={turns} interval={interval} milestone={current_interval_milestone} viewed={viewed_intervals}")

        available = (
            turns > 0
            and turns >= interval
            and current_interval_milestone not in viewed_intervals
        )

        logger.info(f"[STATUS] available={available} (turns>0={turns>0}, turns>=interval={turns>=interval}, milestone_not_viewed={current_interval_milestone not in viewed_intervals})")
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
            # Debug logging
            logger = logging.getLogger(__name__)
            logger.info(f"[GENERATE] sim={simulation_id} generated {len(suggestions)} suggestions: {suggestions}")
            return {"suggestions": suggestions}
        except ValueError as e:
            logger.error(f"[GENERATE] sim={simulation_id} error: {e}")
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
            return {"success": True, "message": "Suggestions dismissed"}
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
