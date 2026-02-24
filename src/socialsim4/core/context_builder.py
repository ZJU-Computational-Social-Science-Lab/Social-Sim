"""Build context summaries from round history."""

from typing import Dict, Any, List, Optional


def build_context_summary(
    round_history: List[Dict[str, Any]],
    max_rounds: int = 5,
    state_snapshot: Dict[str, Any] | None = None,
    for_agent: str | None = None,
    visibility_mode: str = "all"  # "all", "sequential", or custom
) -> str:
    """Build brief summary of recent rounds.

    Args:
        round_history: List of dicts with "round" and "actions" keys.
                      Each action has "agent" and "action" keys.
        max_rounds: Number of recent rounds to include (default: 5).
        state_snapshot: Optional scenario-specific state to append.
        for_agent: Optional agent name to filter visible actions for.
        visibility_mode: How to filter visible actions:
            - "all": Show all actions (default, for backward compatibility)
            - "sequential": In sequential mode, agents see earlier agents' actions
            - "previous_rounds": Show only previous rounds, not current round actions

    Returns:
        Summary string, or "This is the first round." if history is empty.
    """
    if not round_history:
        return "This is the first round."

    # Filter round history based on visibility rules
    filtered_history = _filter_round_history(
        round_history,
        for_agent,
        visibility_mode
    )

    if not filtered_history:
        return "This is the first round."

    lines = []
    recent = filtered_history[-max_rounds:]

    # Summarize each round
    for round_data in recent:
        round_num = round_data["round"]
        actions = round_data["actions"]

        action_strs = [f"{a['agent']} chose {a['action']}" for a in actions]
        actions_desc = ", ".join(action_strs)

        lines.append(f"Round {round_num}: {actions_desc}.")

    # Detect dominant action patterns (3+ occurrences in 3+ rounds)
    agent_actions: Dict[str, Dict[str, int]] = {}

    for round_data in recent:
        for action_data in round_data["actions"]:
            agent = action_data["agent"]
            action = action_data["action"]

            if agent not in agent_actions:
                agent_actions[agent] = {}
            agent_actions[agent][action] = agent_actions[agent].get(action, 0) + 1

    for agent, counts in agent_actions.items():
        total = sum(counts.values())
        if total >= 3:
            dominant_action = max(counts, key=counts.get)
            dominant_count = counts[dominant_action]
            if dominant_count >= 3:
                lines.append(
                    f"{agent} has chosen {dominant_action} in "
                    f"{dominant_count} of the last {total} rounds."
                )

    # Append state snapshot if provided
    if state_snapshot:
        lines.append("\nState:")
        for key, value in state_snapshot.items():
            lines.append(f"- {key}: {value}")

    return "\n".join(lines)


def _filter_round_history(
    round_history: List[Dict[str, Any]],
    for_agent: str | None,
    visibility_mode: str
) -> List[Dict[str, Any]]:
    """Filter round history based on visibility rules for an agent.

    Args:
        round_history: Full round history
        for_agent: Agent name to filter for (None = show all)
        visibility_mode: How to determine visibility

    Returns:
        Filtered round history
    """
    if not for_agent or visibility_mode == "all":
        # No filtering - show all history
        return round_history.copy()

    filtered = []

    for round_data in round_history:
        round_num = round_data["round"]
        actions = round_data["actions"]

        if visibility_mode == "previous_rounds":
            # Show all actions from previous rounds, but not current round
            # This is used when agents in simultaneous mode shouldn't see each other
            if round_num < max(r["round"] for r in round_history):
                filtered.append(round_data)
        elif visibility_mode == "sequential":
            # In sequential mode, agents see:
            # 1. All previous rounds (full history)
            # 2. Current round: only actions from agents before them in sequence
            current_round_num = max(r["round"] for r in round_history)
            if round_num < current_round_num:
                # Previous rounds - show all
                filtered.append(round_data)
            else:
                # Current round - filter to show only earlier agents' actions
                earlier_actions = []
                for action in actions:
                    # Agent can see actions from agents that went before them
                    # This is a simplified version - assumes sequential order is alphabetical
                    if action["agent"] < for_agent:
                        earlier_actions.append(action)
                if earlier_actions:
                    filtered.append({
                        "round": round_num,
                        "actions": earlier_actions
                    })
        else:
            # Default - no filtering
            filtered.append(round_data)

    return filtered
