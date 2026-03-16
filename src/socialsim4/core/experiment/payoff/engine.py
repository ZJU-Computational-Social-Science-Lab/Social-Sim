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
        if not edges:
            return [agent_names] if agent_names else []

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
        """Calculate payoffs using matrix lookup.

        Handles both pairwise and group modes.
        """
        if graph is None:
            graph = {"edges": []}

        payoffs = {}
        action_map = {
            a.agent_name: str(a.action_name).lower()
            for a in actions if not a.skipped
        }
        agent_names = list(action_map.keys())

        if grouping_mode == "pairwise":
            pairs = self.get_pairs_from_graph(graph, agent_names)
            payoffs = self._calculate_matrix_payoffs_pairwise(
                actions, config, pairs, action_map
            )
        elif grouping_mode == "group":
            groups = self.get_groups_from_graph(graph, agent_names)
            payoffs = self._calculate_matrix_payoffs_group(
                actions, config, groups, action_map
            )

        return payoffs

    def _calculate_matrix_payoffs_pairwise(
        self,
        actions: List[ActionResult],
        config: Dict[str, Any],
        pairs: List[Tuple[str, str]],
        action_map: Dict[str, str],
    ) -> Dict[str, int]:
        """Calculate payoffs for pairwise matrix games."""
        payoffs = {}
        matrix = config.get("matrix", {})

        for agent1, agent2 in pairs:
            choice1 = action_map.get(agent1)
            choice2 = action_map.get(agent2)

            if not choice1 or not choice2:
                continue

            key = f"{choice1}_{choice2}"
            cell = matrix.get(key, {"value": 0})

            if "value" in cell:
                # Symmetric: both get same
                payoffs[agent1] = cell["value"]
                payoffs[agent2] = cell["value"]
            else:
                # Asymmetric: row/col payoffs
                payoffs[agent1] = cell.get("row", 0)
                payoffs[agent2] = cell.get("col", 0)

        return payoffs

    def _calculate_matrix_payoffs_group(
        self,
        actions: List[ActionResult],
        config: Dict[str, Any],
        groups: List[List[str]],
        action_map: Dict[str, str],
    ) -> Dict[str, int]:
        """Calculate payoffs for group matrix games.

        Supports threshold mode for games like Stag Hunt.
        """
        payoffs = {}

        if config.get("group_payoff_mode") != "threshold":
            return payoffs

        threshold_action = config.get("threshold_action", "cooperate")
        threshold_reward = config.get("threshold_reward", 5)
        threshold_failure = config.get("threshold_failure", 0)
        safe_reward = config.get("safe_reward", 1)

        for group in groups:
            choices = [action_map.get(a) for a in group if a in action_map]
            all_chose_target = all(c == threshold_action for c in choices)

            for agent in group:
                choice = action_map.get(agent)
                if choice == threshold_action:
                    payoffs[agent] = threshold_reward if all_chose_target else threshold_failure
                else:
                    payoffs[agent] = safe_reward

        return payoffs

    def _calculate_pool_payoffs(
        self,
        actions: List[ActionResult],
        config: Dict[str, Any],
    ) -> Dict[str, int | float]:
        """Calculate payoffs for contribution games.

        Formula: payoff = (initial_tokens - contribution) + (total_contributions * multiplier / n)

        This equals: tokens_kept + share_of_pool

        Config:
            multiplier: float (e.g., 1.5)
            initial_tokens: int (starting tokens per agent)
        """
        payoffs = {}
        total_contribution = 0
        contributions = {}

        for action in actions:
            if not action.skipped:
                if action.action_name == "contribute":
                    amount = action.parameters.get("amount", 0)
                else:
                    amount = 0  # Non-contribute actions contribute 0
                contributions[action.agent_name] = amount
                total_contribution += amount

        num_agents = len([a for a in actions if not a.skipped])
        if num_agents == 0:
            return payoffs

        multiplier = config.get("multiplier", 1.5)
        initial_tokens = config.get("initial_tokens", 20)

        pool_return = (total_contribution * multiplier) / num_agents

        for agent_name, contribution in contributions.items():
            tokens_kept = initial_tokens - contribution
            payoffs[agent_name] = round(tokens_kept + pool_return, 2)

        return payoffs
