"""
Simulation export API route.

Provides clean CSV/JSON export with scenario parameters and simplified column structure.
"""
import logging

from litestar import get, Request
from litestar.exceptions import HTTPException
from litestar.response import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from socialsim4.backend.core.database import get_session
from socialsim4.backend.dependencies import extract_bearer_token, resolve_current_user
from socialsim4.backend.models.simulation import SimulationLog
from socialsim4.backend.services.export_service import export_events, generate_export_filename
from socialsim4.core.scenarios.registry import SCENARIO_REGISTRY

from .helpers import get_simulation_for_owner


logger = logging.getLogger(__name__)


@get("/{simulation_id:str}/export")
async def export_simulation(
    request: Request,
    simulation_id: str,
    format: str = "csv",
    node_id: str | None = None,
) -> Response:
    """Export simulation logs in CSV or JSON format.

    Args:
        request: Litestar request with auth token
        simulation_id: Simulation identifier
        format: Export format ("csv" or "json")
        node_id: Optional node filter for branch-specific export

    Returns:
        File download response with proper filename
    """
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)

        # Fetch simulation
        sim = await get_simulation_for_owner(session, current_user.id, simulation_id)

        if not sim:
            raise HTTPException(status_code=404, detail="Simulation not found")

        # Get scenario config
        scene_config = sim.scene_config or {}
        scenario_id = scene_config.get("scenario_id", "unknown")

        # Fetch scenario parameters from registry
        scenario_def = SCENARIO_REGISTRY.get(scenario_id, {})
        param_defs = scenario_def.get("parameters", [])

        # Extract scenario parameter values from scene_config
        scenario_params = {"scenario_id": scenario_id}
        for param_def in param_defs:
            key = param_def.get("key", param_def.get("id"))
            if key in scene_config:
                scenario_params[key] = scene_config[key]
            elif "default" in param_def:
                scenario_params[key] = param_def["default"]

        # Fetch logs
        query = select(SimulationLog).where(
            SimulationLog.simulation_id == sim.id
        ).order_by(SimulationLog.sequence)

        if node_id:
            query = query.where(SimulationLog.tree_node_id == int(node_id))

        result = await session.execute(query)
        logs = result.scalars().all()

        # Convert to dict format
        events = [
            {
                "sequence": log.sequence,
                "tree_node_id": log.tree_node_id,
                "event_type": log.event_type,
                "payload": log.payload,
                "created_at": log.created_at,
            }
            for log in logs
        ]

        # Export
        content = export_events(events, scenario_params, format)
        filename = generate_export_filename(scenario_id, format)

        # Return with proper headers
        media_type = "text/csv" if format == "csv" else "application/json"
        return Response(
            content=content,
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
