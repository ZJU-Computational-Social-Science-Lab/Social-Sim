"""
PayoffEngine - generic payoff calculation for all game types.

Handles matrix (pairwise/group), pool, feedback, and none payoff types.
"""

import random
from typing import Dict, List, Any, Tuple
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

    def get_pairs_from_graph(
        self,
        graph: Dict[str, Any],
        agent_names: List[str],
    ) -> List[Tuple[str, str]]:
        """Select pairs from graph edges for pairwise mode.

        Rules:
            1. Each agent can only be in ONE pair per round
            2. Randomly select from available edges
            3. Disconnected nodes sit out

        Args:
            graph: {"edges": [(A, B), (A, C), ...]}
            agent_names: List of all agent names

        Returns:
            List of (agent1, agent2) tuples
        """
        edges = graph.get("edges", [])
        available_edges = [
            (a, b) for a, b in edges
            if a in agent_names and b in agent_names
        ]
        random.shuffle(available_edges)

        paired = set()
        pairs = []

        for agent1, agent2 in available_edges:
            if agent1 not in paired and agent2 not in paired:
                pairs.append((agent1, agent2))
                paired.add(agent1)
                paired.add(agent2)

        return pairs

    def get_groups_from_graph(
        self,
        graph: Dict[str, Any],
        agent_names: List[str],
    ) -> List[List[str]]:
        """Find connected components for group mode.

        If graph is fully connected -> one big group
        If graph has disconnected components -> separate groups

        Args:
            graph: {"edges": [(A, B), ...]}
            agent_names: List of all agent names

        Returns:
            List of groups, each group is a list of agent names
        """
        edges = graph.get("edges", [])

        # Build adjacency list
        adjacency = {name: set() for name in agent_names}
        for a, b in edges:
            if a in agent_names and b in agent_names:
                adjacency[a].add(b)
                adjacency[b].add(a)

        # BFS to find connected components
        visited = set()
        groups = []

        for agent in agent_names:
            if agent not in visited:
                group = []
                queue = [agent]
                while queue:
                    current = queue.pop(0)
                    if current not in visited:
                        visited.add(current)
                        group.append(current)
                        queue.extend(adjacency[current] - visited)
                groups.append(group)

        return groups

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
