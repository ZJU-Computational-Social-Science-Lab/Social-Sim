"""
Python handlers for complex action logic.

Some actions need more than declarative effects - they need
actual code to compute state changes. This module provides
those handlers.

Contains: handle_move, handle_talk, handle_council_speak,
          handle_start_voting, handle_vote, handle_conclude,
          handle_punish
"""
import logging
from typing import Any
from socialsim4.core.experiment.state import ExperimentState

logger = logging.getLogger(__name__)


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
        state: Current experiment state (unused, but required for handler signature)

    Returns:
        Result dict with success status
    """
    _ = state  # State not needed for talk action
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


# === Council Action Handlers ===

def handle_council_speak(action_data: dict, agent_name: str, state: ExperimentState, scene) -> dict[str, Any]:
    """Handler for council speak action.

    Records speech to round context manager for multi-round deliberation.
    Agents can reference previous speeches in follow-up turns.

    Args:
        action_data: Action parameters with 'message' field
        agent_name: Name of agent speaking
        state: Current experiment state
        scene: CouncilExperimentScene instance

    Returns:
        Result dict with success status and summary
    """
    message = action_data.get("message", "")

    # Create summary (truncate long messages)
    summary = f"{agent_name} spoke: {message[:100]}{'...' if len(message) > 100 else ''}"

    # Record to round context manager if available
    if hasattr(scene, 'round_context_manager'):
        all_agents = list(state.agents.keys())
        scene.round_context_manager.record_action(
            agent_name=agent_name,
            action_name="speak",
            parameters={"message": message},
            round_num=getattr(scene, 'round_num', 1),
            summary=summary,
            observed_by=all_agents
        )

    return {"success": True, "summary": summary}


def handle_start_voting(action_data: dict, agent_name: str, state: ExperimentState, scene) -> dict[str, Any]:
    """Handler for start_voting action.

    Transitions scene to voting phase. Only allowed if voting not already started.

    Args:
        action_data: Action parameters with 'title' field
        agent_name: Name of agent initiating vote (unused, any agent can start)
        state: Current experiment state
        scene: CouncilExperimentScene instance

    Returns:
        Result dict with success status and summary
    """
    _ = agent_name  # Any agent can start voting
    # State guard: voting not already started
    if state.extensions.get("voting_started", False):
        return {"success": False, "message": "Voting has already started"}

    title = action_data.get("title", "the proposal")

    # Update state
    state.extensions["voting_started"] = True
    state.extensions["vote_title"] = title
    state.extensions["votes"] = {}

    # Transition facilitator if available
    if hasattr(scene, 'facilitator'):
        scene.facilitator.transition_to_voting(title)

    summary = f"Voting started on: {title}"
    return {"success": True, "summary": summary}


def handle_vote(action_data: dict, agent_name: str, state: ExperimentState, scene) -> dict[str, Any]:
    """Handler for vote action.

    Records vote choice to state.extensions['votes'] dict.
    Only allowed if voting phase has started.

    Args:
        action_data: Action parameters with 'choice' field (yes/no/abstain)
        agent_name: Name of agent voting
        state: Current experiment state
        scene: CouncilExperimentScene instance

    Returns:
        Result dict with success status and summary
    """
    # State guard: voting must be started
    if not state.extensions.get("voting_started", False):
        return {"success": False, "message": "Voting has not started yet"}

    choice = action_data.get("choice", "abstain")
    if choice not in ["yes", "no", "abstain"]:
        return {"success": False, "message": f"Invalid vote choice: {choice}"}

    # Record vote
    votes = state.extensions.get("votes", {})
    votes[agent_name] = choice
    state.extensions["votes"] = votes

    summary = f"{agent_name} voted {choice}"

    # Record to context manager
    if hasattr(scene, 'round_context_manager'):
        all_agents = list(state.agents.keys())
        scene.round_context_manager.record_action(
            agent_name=agent_name,
            action_name="vote",
            parameters={"choice": choice},
            round_num=getattr(scene, 'round_num', 1),
            summary=summary,
            observed_by=all_agents
        )

    return {"success": True, "summary": summary}


def handle_vote_yes(action_data: dict, agent_name: str, state: ExperimentState, scene) -> dict[str, Any]:
    """Handler for vote_yes action.

    Records 'yes' vote to state.extensions['votes'] dict.
    Only allowed if voting phase has started.

    Args:
        action_data: Empty dict (no parameters)
        agent_name: Name of agent voting
        state: Current experiment state
        scene: CouncilExperimentScene instance

    Returns:
        Result dict with success status and summary
    """
    # Delegate to handle_vote with choice='yes'
    return handle_vote({"choice": "yes"}, agent_name, state, scene)


def handle_vote_no(action_data: dict, agent_name: str, state: ExperimentState, scene) -> dict[str, Any]:
    """Handler for vote_no action.

    Records 'no' vote to state.extensions['votes'] dict.
    Only allowed if voting phase has started.

    Args:
        action_data: Empty dict (no parameters)
        agent_name: Name of agent voting
        state: Current experiment state
        scene: CouncilExperimentScene instance

    Returns:
        Result dict with success status and summary
    """
    # Delegate to handle_vote with choice='no'
    return handle_vote({"choice": "no"}, agent_name, state, scene)


def handle_abstain(action_data: dict, agent_name: str, state: ExperimentState, scene) -> dict[str, Any]:
    """Handler for abstain action.

    Records 'abstain' vote to state.extensions['votes'] dict.
    Only allowed if voting phase has started.

    Args:
        action_data: Empty dict (no parameters)
        agent_name: Name of agent voting
        state: Current experiment state
        scene: CouncilExperimentScene instance

    Returns:
        Result dict with success status and summary
    """
    # Delegate to handle_vote with choice='abstain'
    return handle_vote({"choice": "abstain"}, agent_name, state, scene)


def handle_conclude(action_data: dict, agent_name: str, state: ExperimentState, scene) -> dict[str, Any]:
    """Handler for conclude action.

    Marks experiment as complete after voting. Checks threshold
    to determine if proposal passed.

    Args:
        action_data: Action parameters (unused for conclude)
        agent_name: Name of agent concluding (unused, any agent can conclude)
        state: Current experiment state
        scene: CouncilExperimentScene instance

    Returns:
        Result dict with success status, summary, and threshold check result
    """
    _ = action_data, agent_name  # Conclude doesn't need parameters
    # State guard: voting must be complete
    if not state.extensions.get("voting_started", False):
        return {"success": False, "message": "Cannot conclude before voting"}

    votes = state.extensions.get("votes", {})
    total_votes = len(votes)
    yes_votes = sum(1 for v in votes.values() if v == "yes")

    # Check threshold (from config or default 0.5)
    threshold = 0.5
    if hasattr(scene, 'game_config') and hasattr(scene.game_config, 'voting_threshold'):
        threshold = scene.game_config.voting_threshold
    elif hasattr(scene, 'voting_threshold'):
        threshold = scene.voting_threshold

    passed = (yes_votes / total_votes >= threshold) if total_votes > 0 else False

    # Update state
    state.extensions["concluded"] = True
    state.extensions["proposal_passed"] = passed

    result = "passed" if passed else "rejected"
    summary = f"Meeting concluded. Proposal {result} ({yes_votes}/{total_votes} yes votes)"

    return {"success": True, "summary": summary, "passed": passed}


# === PGG Punishment Action Handler ===

def handle_punish(action_data: dict, agent_name: str, state: ExperimentState, scene) -> dict[str, Any]:
    """Handle punish action with validation.

    Validates:
    - Agent cannot punish themselves
    - Target must exist in state.agents
    - Amount is clamped to available punishment budget

    Stores allocation in state.extensions["punishments"] for
    end-of-round payoff calculation.

    Args:
        action_data: {"target": agent_name, "amount": int}
        agent_name: Name of punishing agent
        state: Current experiment state
        scene: Scene reference (unused)

    Returns:
        {"success": bool, "amount": int, "target": str} or
        {"success": False, "error": str}
    """
    _ = scene  # Scene not needed for punish action
    target = action_data.get("target")
    amount = action_data.get("amount", 0)

    # Validation 1: No self-punishment
    if target == agent_name:
        return {"success": False, "error": "Cannot punish yourself"}

    # Validation 2: Target exists
    if target not in state.agents:
        return {"success": False, "error": f"Unknown target: {target}"}

    # Validation 3: Clamp to budget
    agent = state.agents.get(agent_name)
    if not agent:
        return {"success": False, "error": "Agent not found in state"}

    current_budget = agent.resources.get("punishment_budget", 0)
    actual_amount = max(0, min(amount, current_budget))

    if actual_amount < amount:
        logger.debug(f"Punishment clamped: {agent_name} attempted {amount}, has {current_budget}")

    # Store punishment allocation for end-of-round processing
    if "punishments" not in state.extensions:
        state.extensions["punishments"] = {}
    if agent_name not in state.extensions["punishments"]:
        state.extensions["punishments"][agent_name] = []

    state.extensions["punishments"][agent_name].append({
        "target": target,
        "amount": actual_amount,
    })

    # Deduct from budget
    agent.resources["punishment_budget"] = current_budget - actual_amount

    return {
        "success": True,
        "amount": actual_amount,
        "target": target,
    }
