"""
Python handlers for complex action logic.

Some actions need more than declarative effects - they need
actual code to compute state changes. This module provides
those handlers.

Contains: handle_move, handle_talk
"""
from typing import Any
from socialsim4.core.experiment.state import ExperimentState


def handle_move(agent_name: str, params: dict, state: ExperimentState) -> dict[str, Any]:
    """Handle move action - update agent position on grid.

    Args:
        agent_name: Agent moving
        params: {"direction": "north"|"south"|"east"|"west"}
        state: Current experiment state

    Returns:
        Result dict with success status and new position
    """
    direction = params.get("direction", "")
    current_pos = state.get_agent_position(agent_name)

    if current_pos is None:
        return {"success": False, "error": "Agent has no position"}

    x, y = current_pos
    dx, dy = {
        "north": (0, -1),
        "south": (0, 1),
        "east": (1, 0),
        "west": (-1, 0),
    }.get(direction, (0, 0))

    new_pos = (x + dx, y + dy)

    # TODO: Add boundary checking when we have grid dimensions

    state.update_agent_position(agent_name, new_pos)

    return {
        "success": True,
        "old_position": current_pos,
        "new_position": new_pos,
    }


def handle_talk(agent_name: str, params: dict, state: ExperimentState) -> dict[str, Any]:
    """Handle talk action - record message for context.

    Args:
        agent_name: Agent sending message
        params: {"target": "AgentName", "message": "text"}
        state: Current experiment state

    Returns:
        Result dict with success status
    """
    target = params.get("target", "")
    message = params.get("message", "")

    if not target or not message:
        return {"success": False, "error": "Missing target or message"}

    # Messages are added to context, not state
    # The runner will add this to the event history
    return {
        "success": True,
        "from": agent_name,
        "to": target,
        "message": message,
    }
