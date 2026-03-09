"""
Context builder utilities for experiment history.

Provides functions to build context summaries from round history,
with support for visibility filtering and structured output.

Contains: build_context_summary, build_structured_context
"""

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
            # Show all actions from previous rounds
            # round_history contains only completed rounds, so current round = max + 1
            # This is used when agents in simultaneous/paired mode shouldn't see current round
            current_round = max(r["round"] for r in round_history) + 1
            if round_num < current_round:
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


def build_structured_context(
    for_agent: str,
    events: list,
    info_model: "InformationModel",
    agent_score: "int | None" = None,
) -> str:
    """Build deterministic, budget-bounded structured context for an agent.

    Tiered history: recent_window rounds of full detail, optionally with
    round 1 always kept (primacy_keep=True). Applies payoff_template when set.

    Args:
        for_agent: Agent receiving the context (used to identify "my" action)
        events: Pre-filtered RoundEvent list (caller must filter by observed_by)
        info_model: InformationModel controlling window/primacy/template
        agent_score: Agent's cumulative score (shown if info_model.include_scores)

    Returns:
        Formatted context string
    """
    if not events:
        return "This is the first round."

    # Group events by round
    rounds_seen = sorted(set(e.round_num for e in events))
    events_by_round: Dict[int, list] = {r: [] for r in rounds_seen}
    for e in events:
        events_by_round[e.round_num].append(e)

    # Determine which rounds to show (recent window + optional primacy)
    max_round = max(rounds_seen)
    cutoff = max_round - info_model.recent_window + 1
    included = [r for r in rounds_seen if r >= cutoff]
    if info_model.primacy_keep and rounds_seen and rounds_seen[0] < cutoff:
        included = [rounds_seen[0]] + included

    lines = []
    for r in sorted(set(included)):
        round_events = events_by_round.get(r, [])
        if not round_events:
            continue

        my_event = next((e for e in round_events if e.agent_name == for_agent), None)
        # FIX: Filter other_events by visibility (observed_by)
        other_events = [e for e in round_events if e.agent_name != for_agent and for_agent in e.observed_by]

        if info_model.payoff_template and my_event is not None:
            # Template IS the complete line — no round prefix added separately
            partner_action = other_events[0].action_name if other_events else ""
            line = info_model.payoff_template.format(
                N=r,
                my_action=my_event.action_name,
                partner_action=partner_action,
                payoff=my_event.payoff if my_event.payoff is not None else "",
            )
        elif my_event is not None and my_event.feedback is not None:
            # Feedback-type games: show action + coordination feedback
            parts = [f"Round {r}: I chose {my_event.action_name}."]
            # Show what neighbors chose
            for e in other_events:
                parts.append(f"{e.agent_name} chose {e.action_name}")
            # Add coordination feedback
            parts.append(f"→ {my_event.feedback}")
            line = " ".join(parts)
        else:
            parts = []
            if my_event:
                parts.append(f"I {my_event.action_name}")
            for e in other_events:
                parts.append(f"{e.agent_name} {e.action_name}")
            line = f"Round {r}: {', '.join(parts)}." if parts else f"Round {r}: (no actions)"

        lines.append(line)

    if agent_score is not None and info_model.include_scores:
        lines.append(f"My score: {agent_score}")

    return "\n".join(lines)
