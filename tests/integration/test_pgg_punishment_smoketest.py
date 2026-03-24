"""
Smoketest for Public Goods Game punishment phase features.

Tests FEAT-PGG-01 (Network Visibility):
- Agents only see contributions from agents they're connected to
- Isolated agents (no edges) see no contributions from others
- Visibility respects graph edges in both directions

Tests FEAT-PGG-03 (Punish Action):
- Agents can allocate punishment tokens to specific other agents
- Over-budget amounts are clamped to available budget
- Allocations stored in state.extensions["punishments"]
"""

import pytest
from socialsim4.core.experiment.state import ExperimentState, AgentState
from socialsim4.core.experiment.information_model import InformationModel


class TestPunishmentVisibility:
    """Tests for network-dependent contribution visibility (FEAT-PGG-01)."""

    @pytest.fixture
    def info_model(self):
        """Create InformationModel instance with neighborhood scope."""
        return InformationModel(scope_type="neighborhood")

    @pytest.fixture
    def isolated_state(self):
        """Agent Alice has no connections to Bob."""
        return ExperimentState(
            agents={
                "Alice": AgentState(
                    resources={"tokens": 20},
                    properties={"last_contribution": 10}
                ),
                "Bob": AgentState(
                    resources={"tokens": 20},
                    properties={"last_contribution": 15}
                ),
            }
        )

    @pytest.fixture
    def isolated_graph(self):
        """No edges - Alice is isolated."""
        return {"edges": []}

    def test_isolated_agent_sees_no_contributions(self, info_model, isolated_state, isolated_graph):
        """Isolated agent sees no contributions from others."""
        visible = info_model.get_visible_contributions(
            "Alice", isolated_state, isolated_graph
        )

        assert visible == {}, f"Isolated agent should see no contributions, got {visible}"

    def test_connected_agents_see_each_other(self, info_model):
        """Connected agents see each other's contributions."""
        state = ExperimentState(
            agents={
                "Alice": AgentState(
                    resources={"tokens": 20},
                    properties={"last_contribution": 10}
                ),
                "Bob": AgentState(
                    resources={"tokens": 20},
                    properties={"last_contribution": 15}
                ),
            }
        )
        graph = {"edges": [("Alice", "Bob")]}

        alice_visible = info_model.get_visible_contributions("Alice", state, graph)
        bob_visible = info_model.get_visible_contributions("Bob", state, graph)

        assert alice_visible == {"Bob": 15}, f"Alice should see Bob's 15, got {alice_visible}"
        assert bob_visible == {"Alice": 10}, f"Bob should see Alice's 10, got {bob_visible}"

    def test_partial_network_visibility(self, info_model):
        """Line network A-B-C-D: each agent sees only neighbors."""
        state = ExperimentState(
            agents={
                "Alice": AgentState(properties={"last_contribution": 10}),
                "Bob": AgentState(properties={"last_contribution": 15}),
                "Charlie": AgentState(properties={"last_contribution": 20}),
                "David": AgentState(properties={"last_contribution": 5}),
            }
        )
        # Line: A-B-C-D
        graph = {"edges": [("Alice", "Bob"), ("Bob", "Charlie"), ("Charlie", "David")]}

        # Alice only sees Bob
        assert info_model.get_visible_contributions("Alice", state, graph) == {"Bob": 15}

        # Bob sees Alice and Charlie
        bob_visible = info_model.get_visible_contributions("Bob", state, graph)
        assert bob_visible == {"Alice": 10, "Charlie": 20}

        # Charlie sees Bob and David
        charlie_visible = info_model.get_visible_contributions("Charlie", state, graph)
        assert charlie_visible == {"Bob": 15, "David": 5}

        # David only sees Charlie
        assert info_model.get_visible_contributions("David", state, graph) == {"Charlie": 20}

    def test_agent_not_in_state_handled_gracefully(self, info_model):
        """If a neighbor is not in state, it's skipped."""
        state = ExperimentState(
            agents={
                "Alice": AgentState(properties={"last_contribution": 10}),
                # Bob is in graph but not in state
            }
        )
        graph = {"edges": [("Alice", "Bob")]}

        alice_visible = info_model.get_visible_contributions("Alice", state, graph)

        # Alice's only neighbor Bob is not in state, so empty dict
        assert alice_visible == {}, f"Should be empty when neighbor not in state, got {alice_visible}"

    def test_missing_contribution_defaults_to_zero(self, info_model):
        """Agent without last_contribution property defaults to 0."""
        state = ExperimentState(
            agents={
                "Alice": AgentState(properties={}),  # No last_contribution
                "Bob": AgentState(properties={"last_contribution": 15}),
            }
        )
        graph = {"edges": [("Alice", "Bob")]}

        alice_visible = info_model.get_visible_contributions("Alice", state, graph)
        bob_visible = info_model.get_visible_contributions("Bob", state, graph)

        assert alice_visible == {"Bob": 15}
        assert bob_visible == {"Alice": 0}


class TestPunishAction:
    """Unit tests for punish action handler validation."""

    @pytest.fixture
    def state_with_budget(self):
        """Create state with two agents having punishment budgets."""
        return ExperimentState(
            agents={
                "Alice": AgentState(resources={"tokens": 20, "punishment_budget": 5}),
                "Bob": AgentState(resources={"tokens": 20, "punishment_budget": 5}),
            }
        )

    def test_valid_punish_action(self, state_with_budget):
        """Valid punish action with sufficient budget succeeds."""
        from socialsim4.core.experiment.actions.registry import get_action
        from socialsim4.core.experiment.actions.handlers import handle_punish

        action = get_action("punish")
        assert action is not None, "PUNISH_ACTION not registered"

        result = handle_punish(
            {"target": "Bob", "amount": 3},
            "Alice",
            state_with_budget,
            None  # scene
        )

        assert result["success"] is True
        assert result["amount"] == 3
        assert result["target"] == "Bob"

    def test_cannot_punish_self(self, state_with_budget):
        """Agent cannot punish themselves."""
        from socialsim4.core.experiment.actions.handlers import handle_punish

        result = handle_punish(
            {"target": "Alice", "amount": 3},
            "Alice",
            state_with_budget,
            None
        )

        assert result["success"] is False
        assert "self" in result.get("error", "").lower()

    def test_cannot_punish_unknown_agent(self, state_with_budget):
        """Cannot punish agent that doesn't exist."""
        from socialsim4.core.experiment.actions.handlers import handle_punish

        result = handle_punish(
            {"target": "Charlie", "amount": 3},
            "Alice",
            state_with_budget,
            None
        )

        assert result["success"] is False
        assert "unknown" in result.get("error", "").lower()

    def test_cannot_exceed_budget(self, state_with_budget):
        """Over-budget amount is clamped to available budget."""
        from socialsim4.core.experiment.actions.handlers import handle_punish

        # Alice has 5 budget, attempts 10
        result = handle_punish(
            {"target": "Bob", "amount": 10},
            "Alice",
            state_with_budget,
            None
        )

        assert result["success"] is True
        assert result["amount"] == 5  # Clamped to budget
        assert result["target"] == "Bob"


class TestPunishActionRegistry:
    """Tests for punish action registration in ACTION_REGISTRY."""

    def test_punish_action_in_registry(self):
        """PUNISH_ACTION is registered in ACTION_REGISTRY."""
        from socialsim4.core.experiment.actions.registry import ACTION_REGISTRY

        assert "punish" in ACTION_REGISTRY, "punish action not in ACTION_REGISTRY"
        action = ACTION_REGISTRY["punish"]
        assert action.name == "punish"

    def test_punish_action_has_required_parameters(self):
        """PUNISH_ACTION has target and amount parameters."""
        from socialsim4.core.experiment.actions.registry import get_action

        action = get_action("punish")
        assert action is not None

        param_names = [p.name for p in action.parameters]
        assert "target" in param_names, "punish action missing 'target' parameter"
        assert "amount" in param_names, "punish action missing 'amount' parameter"

    def test_punish_action_handler_bound(self):
        """PUNISH_ACTION has handler bound."""
        from socialsim4.core.experiment.actions.registry import get_action

        action = get_action("punish")
        assert action is not None
        assert action.handler is not None, "punish action handler not bound"


class TestPunishmentStateTracking:
    """Tests for punishment allocation storage in state.extensions."""

    @pytest.fixture
    def state_with_budget(self):
        """Create state with two agents having punishment budgets."""
        return ExperimentState(
            agents={
                "Alice": AgentState(resources={"tokens": 20, "punishment_budget": 5}),
                "Bob": AgentState(resources={"tokens": 20, "punishment_budget": 5}),
            }
        )

    def test_punishment_stored_in_extensions(self, state_with_budget):
        """Punishment allocation is stored in state.extensions['punishments']."""
        from socialsim4.core.experiment.actions.handlers import handle_punish

        handle_punish(
            {"target": "Bob", "amount": 3},
            "Alice",
            state_with_budget,
            None
        )

        assert "punishments" in state_with_budget.extensions
        assert "Alice" in state_with_budget.extensions["punishments"]

        punishments = state_with_budget.extensions["punishments"]["Alice"]
        assert len(punishments) == 1
        assert punishments[0]["target"] == "Bob"
        assert punishments[0]["amount"] == 3

    def test_multiple_punishments_tracked(self, state_with_budget):
        """Multiple punishments from same agent are tracked."""
        from socialsim4.core.experiment.actions.handlers import handle_punish

        # First punishment
        handle_punish(
            {"target": "Bob", "amount": 2},
            "Alice",
            state_with_budget,
            None
        )

        # Second punishment (different target would need another agent)
        # Add Charlie to state
        state_with_budget.agents["Charlie"] = AgentState(
            resources={"tokens": 20, "punishment_budget": 5}
        )

        handle_punish(
            {"target": "Charlie", "amount": 2},
            "Alice",
            state_with_budget,
            None
        )

        punishments = state_with_budget.extensions["punishments"]["Alice"]
        assert len(punishments) == 2

    def test_clamped_amount_stored_not_requested(self, state_with_budget):
        """Clamped amount is stored, not requested amount."""
        from socialsim4.core.experiment.actions.handlers import handle_punish

        # Alice has 5 budget, requests 10
        result = handle_punish(
            {"target": "Bob", "amount": 10},
            "Alice",
            state_with_budget,
            None
        )

        # Result shows clamped amount
        assert result["amount"] == 5

        # State also stores clamped amount
        punishments = state_with_budget.extensions["punishments"]["Alice"]
        assert punishments[0]["amount"] == 5  # Not 10
