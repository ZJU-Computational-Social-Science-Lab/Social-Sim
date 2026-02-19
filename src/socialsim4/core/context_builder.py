"""Build context summaries from round history."""

from typing import Dict, Any, List


def build_context_summary(
    round_history: List[Dict[str, Any]],
    max_rounds: int = 5,
    state_snapshot: Dict[str, Any] | None = None
) -> str:
    """Build brief summary of recent rounds.

    Args:
        round_history: List of dicts with "round" and "actions" keys.
                      Each action has "agent" and "action" keys.
        max_rounds: Number of recent rounds to include (default: 5).
        state_snapshot: Optional scenario-specific state to append.

    Returns:
        Summary string, or "This is the first round." if history is empty.
    """
    if not round_history:
        return "This is the first round."

    lines = []
    recent = round_history[-max_rounds:]

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
