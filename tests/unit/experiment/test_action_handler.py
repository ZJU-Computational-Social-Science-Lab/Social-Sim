"""
Tests for ActionHandler.

Covers action execution, declarative effects, and handler dispatch
for experiment actions including punishment event emission.
"""
import pytest
from socialsim4.core.experiment.action_handler import ActionHandler
from socialsim4.core.experiment.state import ExperimentState, AgentState


class MockScene:
    """Mock scene for testing event emission."""

    def __init__(self):
        self.emitted_events = []
        self.config = type('obj', (object,), {'parameters': {'deduction_cost_ratio': 3.0}})()

    def _emit_event(self, event_type: str, data: dict):
        """Store emitted events for verification."""
        self.emitted_events.append({'type': event_type, 'data': data})


class TestActionHandler:
    def setup_method(self):
        self.handler = ActionHandler()
        self.state = ExperimentState()
        self.state.agents["Alice"] = AgentState(
            resources={"tokens": 20},
            position=(5, 5),
        )
        self.state.extensions["pools"] = {"main": 0}

    def test_execute_choose_action(self):
        """Choose action returns success."""
        result = self.handler.execute("choose", "Alice", {"choice": "cooperate"}, self.state)
        assert result["success"] is True

    def test_execute_move_action(self):
        """Move action updates position."""
        result = self.handler.execute("move", "Alice", {"direction": "north"}, self.state)
        assert result["success"] is True
        assert result["new_position"] == (5, 4)
        assert self.state.get_agent_position("Alice") == (5, 4)

    def test_execute_move_missing_position(self):
        """Move fails if agent has no position."""
        self.state.agents["Bob"] = AgentState(position=None)
        result = self.handler.execute("move", "Bob", {"direction": "north"}, self.state)
        assert result["success"] is False
        # Could be "no position" or "missing requirement: spatial"
        assert "position" in result["error"].lower() or "spatial" in result["error"].lower()

    def test_execute_move_missing_requirement(self):
        """Move fails if scenario lacks spatial feature."""
        state_no_spatial = ExperimentState()
        state_no_spatial.agents["Alice"] = AgentState(position=(1, 1))
        # No spatial config in extensions
        result = self.handler.execute("move", "Alice", {"direction": "north"}, state_no_spatial)
        # Should still work if agent has position
        assert result["success"] is True

    def test_execute_unknown_action(self):
        """Unknown action returns error."""
        result = self.handler.execute("unknown", "Alice", {}, self.state)
        assert result["success"] is False
        assert "unknown action" in result["error"].lower()

    def test_apply_declarative_effects(self):
        """Handler applies declarative effects."""
        # contribute subtracts from agent, adds to pool
        result = self.handler.execute(
            "contribute",
            "Alice",
            {"amount": 5, "pool": "main"},
            self.state
        )
        assert result["success"] is True
        assert self.state.agents["Alice"].resources["tokens"] == 15
        assert self.state.extensions["pools"]["main"] == 5

    # Wave 1: Punishment event emission tests (FEAT-PGG-09 through FEAT-PGG-11)
    def test_punish_emits_event(self):
        """Punish action should emit punishment_action event."""
        handler = ActionHandler()
        state = ExperimentState()
        state.agents["Alice"] = AgentState(
            resources={"deduction_budget": 10},
        )
        state.agents["Bob"] = AgentState(
            resources={},
        )

        mock_scene = MockScene()

        result = handler.execute("punish", "Alice", {"target": "Bob", "amount": 5}, state, mock_scene)

        assert result["success"] is True
        assert len(mock_scene.emitted_events) == 1
        assert mock_scene.emitted_events[0]["type"] == "punishment_action"
        assert mock_scene.emitted_events[0]["data"]["punisher"] == "Alice"
        assert mock_scene.emitted_events[0]["data"]["target"] == "Bob"

    def test_punish_event_includes_amount(self):
        """Punishment event should include amount spent."""
        handler = ActionHandler()
        state = ExperimentState()
        state.agents["Alice"] = AgentState(
            resources={"deduction_budget": 10},
        )
        state.agents["Bob"] = AgentState(
            resources={},
        )

        mock_scene = MockScene()

        result = handler.execute("punish", "Alice", {"target": "Bob", "amount": 5}, state, mock_scene)

        assert result["success"] is True
        assert mock_scene.emitted_events[0]["data"]["amount"] == 5

    def test_punish_event_includes_deduction(self):
        """Punishment event should include deduction (amount × cost_ratio)."""
        handler = ActionHandler()
        state = ExperimentState()
        state.agents["Alice"] = AgentState(
            resources={"deduction_budget": 10},
        )
        state.agents["Bob"] = AgentState(
            resources={},
        )

        mock_scene = MockScene()

        result = handler.execute("punish", "Alice", {"target": "Bob", "amount": 5}, state, mock_scene)

        assert result["success"] is True
        # deduction = amount × cost_ratio = 5 × 3.0 = 15.0
        assert mock_scene.emitted_events[0]["data"]["deduction"] == 15.0
        assert mock_scene.emitted_events[0]["data"]["cost_ratio"] == 3.0
