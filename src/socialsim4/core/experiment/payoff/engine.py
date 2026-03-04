"""
PayoffEngine - generic payoff calculation for all game types.

Handles matrix (pairwise/group), pool, feedback, and none payoff types.
"""

from typing import Dict, List, Any
from socialsim4.core.experiment.controller import ActionResult


class PayoffEngine:
    """Calculates payoffs based on payoff_type and configuration.

    Supported payoff types:
    - matrix: NxN payoff matrix lookup (pairwise or group)
    - pool: Contribution to shared pool with multiplier
    - feedback: No numerical payoffs, coordination feedback only
    - none: No scoring
    """

    def calculate_round_payoffs(
        self,
        payoff_type: str,
        actions: List[ActionResult],
        config: Dict[str, Any],
        grouping_mode: str,
        graph: Dict[str, Any] | None = None,
    ) -> Dict[str, int | float]:
        """Calculate payoffs for all agents in a round.

        Args:
            payoff_type: "matrix" | "pool" | "feedback" | "none"
            actions: List of action results from the round
            config: Scenario-specific configuration
            grouping_mode: How agents are grouped
            graph: Network graph for neighbor-based calculations

        Returns:
            Dict mapping agent_name to payoff earned this round
        """
        if payoff_type == "matrix":
            return self._calculate_matrix_payoffs(actions, config, grouping_mode, graph)
        elif payoff_type == "pool":
            return self._calculate_pool_payoffs(actions, config)
        elif payoff_type == "feedback":
            return {}  # No numerical payoffs
        else:  # "none"
            return {}

    def _calculate_matrix_payoffs(
        self,
        actions: List[ActionResult],
        config: Dict[str, Any],
        grouping_mode: str,
        graph: Dict[str, Any] | None,
    ) -> Dict[str, int]:
        """Calculate payoffs using matrix lookup."""
        # Placeholder - will be implemented in Task 3
        return {}

    def _calculate_pool_payoffs(
        self,
        actions: List[ActionResult],
        config: Dict[str, Any],
    ) -> Dict[str, int | float]:
        """Calculate payoffs for contribution games."""
        # Placeholder - will be implemented in Task 5
        return {}
