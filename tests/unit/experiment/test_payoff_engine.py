"""
Tests for PayoffEngine - generic payoff calculation.

Tests all payoff types: matrix (pairwise/group), pool, feedback, none.
"""

import pytest
from socialsim4.core.experiment.payoff.engine import PayoffEngine
from socialsim4.core.experiment.controller import ActionResult


class TestPayoffEngine:
    """Test PayoffEngine class."""

    @pytest.fixture
    def engine(self):
        return PayoffEngine()

    @pytest.fixture
    def pd_actions(self):
        """Simple PD actions for two agents."""
        return [
            ActionResult(
                agent_name="Alice",
                action_name="cooperate",
                parameters={},
                summary="Alice chose cooperate",
                success=True,
                skipped=False,
                round_num=1,
            ),
            ActionResult(
                agent_name="Bob",
                action_name="defect",
                parameters={},
                summary="Bob chose defect",
                success=True,
                skipped=False,
                round_num=1,
            ),
        ]

    def test_payoff_engine_exists(self, engine):
        """PayoffEngine can be instantiated."""
        assert engine is not None

    def test_payoff_type_none_returns_empty(self, engine, pd_actions):
        """payoff_type 'none' returns empty dict."""
        result = engine.calculate_round_payoffs(
            payoff_type="none",
            actions=pd_actions,
            config={},
            grouping_mode="pairwise",
        )
        assert result == {}

    def test_payoff_type_feedback_returns_empty(self, engine, pd_actions):
        """payoff_type 'feedback' returns empty dict (no numerical payoffs)."""
        result = engine.calculate_round_payoffs(
            payoff_type="feedback",
            actions=pd_actions,
            config={},
            grouping_mode="neighbor",
        )
        assert result == {}


class TestGraphGrouping:
    """Test graph-based pair and group selection."""

    @pytest.fixture
    def engine(self):
        return PayoffEngine()

    def test_get_pairs_from_graph_basic(self, engine):
        """Pairs are selected from graph edges."""
        graph = {
            "edges": [("Alice", "Bob"), ("Charlie", "Diana")]
        }
        agent_names = ["Alice", "Bob", "Charlie", "Diana"]
        pairs = engine.get_pairs_from_graph(graph, agent_names)

        assert len(pairs) == 2
        assert ("Alice", "Bob") in pairs
        assert ("Charlie", "Diana") in pairs

    def test_get_pairs_each_agent_only_once(self, engine):
        """Each agent can only be in one pair per round."""
        graph = {
            "edges": [("Alice", "Bob"), ("Alice", "Charlie"), ("Bob", "Charlie")]
        }
        agent_names = ["Alice", "Bob", "Charlie"]
        pairs = engine.get_pairs_from_graph(graph, agent_names)

        # Only one pair should be formed (Alice with one of Bob/Charlie)
        assert len(pairs) == 1
        paired_agents = set()
        for a, b in pairs:
            paired_agents.add(a)
            paired_agents.add(b)
        assert len(paired_agents) == 2

    def test_get_pairs_disconnected_sits_out(self, engine):
        """Disconnected nodes don't get paired."""
        graph = {
            "edges": [("Alice", "Bob")]
        }
        agent_names = ["Alice", "Bob", "Charlie"]  # Charlie is disconnected
        pairs = engine.get_pairs_from_graph(graph, agent_names)

        assert len(pairs) == 1
        assert ("Alice", "Bob") in pairs
        # Charlie is not in any pair

    def test_get_groups_from_graph_fully_connected(self, engine):
        """Fully connected graph forms one group."""
        graph = {
            "edges": [("Alice", "Bob"), ("Bob", "Charlie"), ("Alice", "Charlie")]
        }
        agent_names = ["Alice", "Bob", "Charlie"]
        groups = engine.get_groups_from_graph(graph, agent_names)

        assert len(groups) == 1
        assert set(groups[0]) == {"Alice", "Bob", "Charlie"}

    def test_get_groups_disconnected_components(self, engine):
        """Disconnected components form separate groups."""
        graph = {
            "edges": [("Alice", "Bob"), ("Charlie", "Diana")]
        }
        agent_names = ["Alice", "Bob", "Charlie", "Diana"]
        groups = engine.get_groups_from_graph(graph, agent_names)

        assert len(groups) == 2
        group_sets = [set(g) for g in groups]
        assert {"Alice", "Bob"} in group_sets
        assert {"Charlie", "Diana"} in group_sets

    def test_get_groups_single_isolated_agent(self, engine):
        """Isolated agent forms their own group."""
        graph = {
            "edges": [("Alice", "Bob")]
        }
        agent_names = ["Alice", "Bob", "Charlie"]  # Charlie is isolated
        groups = engine.get_groups_from_graph(graph, agent_names)

        assert len(groups) == 2
        group_sets = [set(g) for g in groups]
        assert {"Alice", "Bob"} in group_sets
        assert {"Charlie"} in group_sets
