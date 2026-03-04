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


class TestMatrixPayoffPairwise:
    """Test matrix payoff calculation for pairwise mode."""

    @pytest.fixture
    def engine(self):
        return PayoffEngine()

    @pytest.fixture
    def pd_config(self):
        """Standard PD payoff matrix."""
        return {
            "matrix": {
                "cooperate_cooperate": {"value": 3},
                "cooperate_defect": {"row": 0, "col": 5},
                "defect_cooperate": {"row": 5, "col": 0},
                "defect_defect": {"value": 1},
            }
        }

    @pytest.fixture
    def pd_actions_both_cooperate(self):
        return [
            ActionResult(
                agent_name="Alice", action_name="cooperate",
                parameters={}, summary="", success=True, skipped=False, round_num=1,
            ),
            ActionResult(
                agent_name="Bob", action_name="cooperate",
                parameters={}, summary="", success=True, skipped=False, round_num=1,
            ),
        ]

    @pytest.fixture
    def pd_actions_mixed(self):
        """Alice cooperates, Bob defects."""
        return [
            ActionResult(
                agent_name="Alice", action_name="cooperate",
                parameters={}, summary="", success=True, skipped=False, round_num=1,
            ),
            ActionResult(
                agent_name="Bob", action_name="defect",
                parameters={}, summary="", success=True, skipped=False, round_num=1,
            ),
        ]

    def test_both_cooperate_symmetric_payoff(self, engine, pd_config, pd_actions_both_cooperate):
        """Both cooperate -> both get 3."""
        graph = {"edges": [("Alice", "Bob")]}
        result = engine.calculate_round_payoffs(
            payoff_type="matrix",
            actions=pd_actions_both_cooperate,
            config=pd_config,
            grouping_mode="pairwise",
            graph=graph,
        )

        assert result["Alice"] == 3
        assert result["Bob"] == 3

    def test_mixed_choices_asymmetric_payoff(self, engine, pd_config, pd_actions_mixed):
        """Alice cooperates, Bob defects -> Alice gets 0, Bob gets 5."""
        graph = {"edges": [("Alice", "Bob")]}
        result = engine.calculate_round_payoffs(
            payoff_type="matrix",
            actions=pd_actions_mixed,
            config=pd_config,
            grouping_mode="pairwise",
            graph=graph,
        )

        assert result["Alice"] == 0
        assert result["Bob"] == 5

    def test_both_defect_symmetric_payoff(self, engine, pd_config):
        """Both defect -> both get 1."""
        actions = [
            ActionResult(
                agent_name="Alice", action_name="defect",
                parameters={}, summary="", success=True, skipped=False, round_num=1,
            ),
            ActionResult(
                agent_name="Bob", action_name="defect",
                parameters={}, summary="", success=True, skipped=False, round_num=1,
            ),
        ]
        graph = {"edges": [("Alice", "Bob")]}

        result = engine.calculate_round_payoffs(
            payoff_type="matrix",
            actions=actions,
            config=pd_config,
            grouping_mode="pairwise",
            graph=graph,
        )

        assert result["Alice"] == 1
        assert result["Bob"] == 1

    def test_four_agents_two_pairs(self, engine, pd_config):
        """Four agents form two pairs, each pair calculates independently."""
        actions = [
            ActionResult(agent_name="Alice", action_name="cooperate",
                        parameters={}, summary="", success=True, skipped=False, round_num=1),
            ActionResult(agent_name="Bob", action_name="defect",
                        parameters={}, summary="", success=True, skipped=False, round_num=1),
            ActionResult(agent_name="Charlie", action_name="cooperate",
                        parameters={}, summary="", success=True, skipped=False, round_num=1),
            ActionResult(agent_name="Diana", action_name="cooperate",
                        parameters={}, summary="", success=True, skipped=False, round_num=1),
        ]
        # Alice-Bob pair, Charlie-Diana pair
        graph = {"edges": [("Alice", "Bob"), ("Charlie", "Diana")]}

        result = engine.calculate_round_payoffs(
            payoff_type="matrix",
            actions=actions,
            config=pd_config,
            grouping_mode="pairwise",
            graph=graph,
        )

        # Alice cooperates, Bob defects -> Alice 0, Bob 5
        assert result["Alice"] == 0
        assert result["Bob"] == 5
        # Both cooperate -> both 3
        assert result["Charlie"] == 3
        assert result["Diana"] == 3


class TestMatrixPayoffGroupThreshold:
    """Test matrix payoff for group mode with threshold (Stag Hunt)."""

    @pytest.fixture
    def engine(self):
        return PayoffEngine()

    @pytest.fixture
    def stag_hunt_config(self):
        """Stag Hunt threshold configuration."""
        return {
            "group_payoff_mode": "threshold",
            "threshold_action": "stag",
            "threshold_reward": 5,
            "threshold_failure": 0,
            "safe_reward": 1,
        }

    @pytest.fixture
    def all_stag_actions(self):
        return [
            ActionResult(agent_name="Alice", action_name="stag",
                        parameters={}, summary="", success=True, skipped=False, round_num=1),
            ActionResult(agent_name="Bob", action_name="stag",
                        parameters={}, summary="", success=True, skipped=False, round_num=1),
            ActionResult(agent_name="Charlie", action_name="stag",
                        parameters={}, summary="", success=True, skipped=False, round_num=1),
        ]

    @pytest.fixture
    def mixed_actions(self):
        """Two stag, one hare."""
        return [
            ActionResult(agent_name="Alice", action_name="stag",
                        parameters={}, summary="", success=True, skipped=False, round_num=1),
            ActionResult(agent_name="Bob", action_name="stag",
                        parameters={}, summary="", success=True, skipped=False, round_num=1),
            ActionResult(agent_name="Charlie", action_name="hare",
                        parameters={}, summary="", success=True, skipped=False, round_num=1),
        ]

    @pytest.fixture
    def all_hare_actions(self):
        return [
            ActionResult(agent_name="Alice", action_name="hare",
                        parameters={}, summary="", success=True, skipped=False, round_num=1),
            ActionResult(agent_name="Bob", action_name="hare",
                        parameters={}, summary="", success=True, skipped=False, round_num=1),
            ActionResult(agent_name="Charlie", action_name="hare",
                        parameters={}, summary="", success=True, skipped=False, round_num=1),
        ]

    def test_all_stag_gets_threshold_reward(self, engine, stag_hunt_config, all_stag_actions):
        """All choose stag -> everyone gets threshold_reward (5)."""
        graph = {"edges": [
            ("Alice", "Bob"), ("Bob", "Charlie"), ("Alice", "Charlie")
        ]}

        result = engine.calculate_round_payoffs(
            payoff_type="matrix",
            actions=all_stag_actions,
            config=stag_hunt_config,
            grouping_mode="group",
            graph=graph,
        )

        assert result["Alice"] == 5
        assert result["Bob"] == 5
        assert result["Charlie"] == 5

    def test_mixed_choices_stag_gets_failure(self, engine, stag_hunt_config, mixed_actions):
        """Not all stag -> stag choosers get threshold_failure (0), hare gets safe (1)."""
        graph = {"edges": [
            ("Alice", "Bob"), ("Bob", "Charlie"), ("Alice", "Charlie")
        ]}

        result = engine.calculate_round_payoffs(
            payoff_type="matrix",
            actions=mixed_actions,
            config=stag_hunt_config,
            grouping_mode="group",
            graph=graph,
        )

        # Alice and Bob chose stag but Charlie chose hare
        assert result["Alice"] == 0  # threshold_failure
        assert result["Bob"] == 0    # threshold_failure
        assert result["Charlie"] == 1  # safe_reward

    def test_all_hare_gets_safe_reward(self, engine, stag_hunt_config, all_hare_actions):
        """All choose hare -> everyone gets safe_reward (1)."""
        graph = {"edges": [
            ("Alice", "Bob"), ("Bob", "Charlie"), ("Alice", "Charlie")
        ]}

        result = engine.calculate_round_payoffs(
            payoff_type="matrix",
            actions=all_hare_actions,
            config=stag_hunt_config,
            grouping_mode="group",
            graph=graph,
        )

        assert result["Alice"] == 1
        assert result["Bob"] == 1
        assert result["Charlie"] == 1
