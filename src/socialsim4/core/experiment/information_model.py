"""
InformationModel — declarative knowledge rules per scenario.

Each scenario declares what its agents can observe, how many rounds to show,
and how to format context. INFORMATION_MODEL_MAP in registry.py maps scene
keys to InformationModel instances.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Callable, List, Optional


@dataclass
class InformationModel:
    """Declarative specification of agent knowledge rules for a scenario.

    Attributes:
        scope_type: One of "self" | "pair" | "neighborhood" | "all" | "role_based"
        scope_fn: For "neighborhood"/"role_based": (agent, state, all_agents) -> list[str]
                  "neighborhood" without scope_fn falls back to state["social_network"].
        pairing_fn: For "pair": (agents: list[str], round_num: int) -> list[tuple[str,str]]
        recent_window: Rounds of full detail to include (default 3)
        primacy_keep: Always include round 1 even outside recent_window (default True)
        context_budget_chars: Max chars for Section 4 of prompt; 0 = no limit (default 0)
        payoff_template: Template for per-round line. Variables: {N}, {my_action},
                         {partner_action}, {payoff}. Replaces the default "Round N: ..."
                         line entirely — do NOT add a round prefix separately.
        include_scores: Show cumulative score in context (default True)
    """
    scope_type: str
    scope_fn: Optional[Callable] = None
    pairing_fn: Optional[Callable] = None
    recent_window: int = 3
    primacy_keep: bool = True
    context_budget_chars: int = 0
    payoff_template: Optional[str] = None
    include_scores: bool = True

    def __post_init__(self):
        valid = {"self", "pair", "neighborhood", "all", "role_based"}
        if self.scope_type not in valid:
            raise ValueError(
                f"scope_type must be one of {valid}, got {self.scope_type!r}"
            )

    def get_observers(
        self,
        for_agent: str,
        scene_state: dict,
        all_agent_names: List[str],
        round_num: int = 0,
    ) -> List[str]:
        """Return agents who observe for_agent's action this round.

        This list is stored as event.observed_by at write-time. Agent B
        sees an event iff B in event.observed_by at read-time.
        """
        if self.scope_type == "all":
            return list(all_agent_names)

        if self.scope_type == "self":
            return [for_agent]

        if self.scope_type == "pair":
            if self.pairing_fn and round_num and all_agent_names:
                for a, b in self.pairing_fn(all_agent_names, round_num):
                    if a == for_agent:
                        return [for_agent, b]
                    if b == for_agent:
                        return [for_agent, a]
            return [for_agent]

        if self.scope_type == "neighborhood":
            if self.scope_fn:
                neighbors = self.scope_fn(for_agent, scene_state, all_agent_names)
            else:
                neighbors = scene_state.get("social_network", {}).get(for_agent, [])
            return list(set([for_agent] + list(neighbors)))

        if self.scope_type == "role_based":
            if self.scope_fn:
                return self.scope_fn(for_agent, scene_state, all_agent_names)
            return [for_agent]

        return list(all_agent_names)  # safe fallback
