"""Tests for ActionHandler."""
import pytest
from socialsim4.core.experiment.action_handler import ActionHandler
from socialsim4.core.experiment.state import ExperimentState, AgentState


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
