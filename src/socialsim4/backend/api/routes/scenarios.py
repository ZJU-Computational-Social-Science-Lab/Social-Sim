"""Scenario API routes.

Provides endpoints for fetching scenario definitions and actions.
"""

from litestar import Router, get
from litestar.exceptions import NotFoundException

from socialsim4.core.scenarios import get_all_scenarios, get_scenario, get_scenario_actions


@get()
async def list_scenarios() -> list[dict]:
    """Get all scenario definitions.

    Returns list of scenarios with id, name, category, description,
    parameters shape, and actions.
    """
    return get_all_scenarios()


@get("/{scenario_id:str}")
async def get_scenario_detail(scenario_id: str) -> dict:
    """Get full details of a single scenario.

    Args:
        scenario_id: The unique scenario identifier

    Returns:
        Full scenario dict

    Raises:
        NotFoundException: If scenario not found
    """
    scenario = get_scenario(scenario_id)
    if not scenario:
        raise NotFoundException(f"Scenario '{scenario_id}' not found")
    return scenario


@get("/{scenario_id:str}/actions")
async def get_scenario_actions_endpoint(scenario_id: str) -> list[dict]:
    """Get actions for a specific scenario.

    Args:
        scenario_id: The unique scenario identifier

    Returns:
        List of action dicts with name and description.
        Returns empty list if scenario not found.
    """
    return get_scenario_actions(scenario_id)


router = Router(
    path="/scenarios",
    route_handlers=[
        list_scenarios,
        get_scenario_detail,
        get_scenario_actions_endpoint,
    ],
)
