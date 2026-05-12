"""
Deterministic tests for Grid World scenario actions.

Verifies that Grid World exposes an honest action set:
- move: executable, mutates AgentState.position via handle_move
- look_around: record-only (observation, no state mutation by design)
- rest: record-only (explicit no-op)

No LLM calls — pure state/handler tests.

Contains: TestGridWorldActionRegistry, TestGridWorldRecordOnlyExecution,
          TestGridWorldMoveExecution, TestGridWorldMoveEdgeCases,
          TestGridWorldScenarioMetadata
"""
import pytest
from socialsim4.core.experiment.action_handler import ActionHandler
from socialsim4.core.experiment.actions.registry import (
    ACTION_REGISTRY,
    get_action,
)
from socialsim4.core.experiment.state import ExperimentState, AgentState
from socialsim4.core.scenarios.registry import get_scenario, get_scenario_actions
from socialsim4.core.registry import get_information_model


# Grid World v1 supported action set
GRID_WORLD_ACTION_IDS = {"move", "look_around", "rest"}
GRID_WORLD_EXECUTABLE = {"move"}
GRID_WORLD_RECORD_ONLY = {"look_around", "rest"}


class TestGridWorldActionRegistry:
    """All Grid World scenario actions are registered and correctly classified."""

    @pytest.mark.parametrize("action_id", sorted(GRID_WORLD_ACTION_IDS))
    def test_action_is_registered(self, action_id: str):
        """Each Grid World action ID exists in ACTION_REGISTRY."""
        assert action_id in ACTION_REGISTRY, f"{action_id} not in ACTION_REGISTRY"

    def test_move_has_handler(self):
        """The move action has a handler that mutates position."""
        action = get_action("move")
        assert action is not None
        assert action.handler is not None

    def test_move_is_not_record_only(self):
        """Move is an executable action, not record-only."""
        action = get_action("move")
        assert action is not None
        assert action.record_only is False

    def test_move_requires_spatial(self):
        """Move requires the spatial feature (agent must have position)."""
        action = get_action("move")
        assert action is not None
        assert "spatial" in (action.requires or [])

    @pytest.mark.parametrize("action_id", sorted(GRID_WORLD_RECORD_ONLY))
    def test_record_only_action_has_no_handler(self, action_id: str):
        """Record-only actions have no handler."""
        action = get_action(action_id)
        assert action is not None
        assert action.handler is None

    @pytest.mark.parametrize("action_id", sorted(GRID_WORLD_RECORD_ONLY))
    def test_record_only_action_flagged(self, action_id: str):
        """Record-only actions have record_only=True."""
        action = get_action(action_id)
        assert action is not None
        assert action.record_only is True

    def test_removed_actions_not_in_registry(self):
        """move_to_location and gather_resource are NOT in ACTION_REGISTRY.

        These were removed from active metadata because they had no runtime
        support. They should not be registered to avoid silent no-ops.
        """
        assert "move_to_location" not in ACTION_REGISTRY
        assert "gather_resource" not in ACTION_REGISTRY


class TestGridWorldRecordOnlyExecution:
    """Record-only Grid World actions succeed without mutating state."""

    def setup_method(self):
        self.handler = ActionHandler()
        self.state = ExperimentState()
        self.state.agents["Observer"] = AgentState(
            position=(3, 3),
            resources={},
        )

    @pytest.mark.parametrize("action_id", sorted(GRID_WORLD_RECORD_ONLY))
    def test_record_only_succeeds(self, action_id: str):
        """Record-only actions return success."""
        result = self.handler.execute(action_id, "Observer", {}, self.state)
        assert result["success"] is True

    @pytest.mark.parametrize("action_id", sorted(GRID_WORLD_RECORD_ONLY))
    def test_record_only_returns_flags(self, action_id: str):
        """Record-only actions set record_only=True, effect_applied=False."""
        result = self.handler.execute(action_id, "Observer", {}, self.state)
        assert result.get("record_only") is True
        assert result.get("effect_applied") is False

    @pytest.mark.parametrize("action_id", sorted(GRID_WORLD_RECORD_ONLY))
    def test_record_only_does_not_mutate_position(self, action_id: str):
        """Record-only actions do not change agent position."""
        pos_before = self.state.get_agent_position("Observer")
        self.handler.execute(action_id, "Observer", {}, self.state)
        pos_after = self.state.get_agent_position("Observer")
        assert pos_before == pos_after


class TestGridWorldMoveExecution:
    """The 'move' action is the executable spatial primitive for Grid World.

    handle_move takes {"direction": "north|south|east|west"} and
    updates AgentState.position accordingly.
    """

    def setup_method(self):
        self.handler = ActionHandler()
        self.state = ExperimentState()
        self.state.agents["Walker"] = AgentState(
            position=(5, 5),
            resources={},
        )

    def test_move_north(self):
        result = self.handler.execute("move", "Walker", {"direction": "north"}, self.state)
        assert result["success"] is True
        assert result["effect_applied"] is True
        assert result["new_position"] == (5, 4)
        assert self.state.get_agent_position("Walker") == (5, 4)

    def test_move_south(self):
        result = self.handler.execute("move", "Walker", {"direction": "south"}, self.state)
        assert result["success"] is True
        assert result["effect_applied"] is True
        assert result["new_position"] == (5, 6)

    def test_move_east(self):
        result = self.handler.execute("move", "Walker", {"direction": "east"}, self.state)
        assert result["success"] is True
        assert result["effect_applied"] is True
        assert result["new_position"] == (6, 5)

    def test_move_west(self):
        result = self.handler.execute("move", "Walker", {"direction": "west"}, self.state)
        assert result["success"] is True
        assert result["effect_applied"] is True
        assert result["new_position"] == (4, 5)

    def test_move_returns_old_position(self):
        result = self.handler.execute("move", "Walker", {"direction": "east"}, self.state)
        assert result["old_position"] == (5, 5)

    def test_sequential_moves_accumulate(self):
        """Multiple moves update position cumulatively."""
        self.handler.execute("move", "Walker", {"direction": "north"}, self.state)
        self.handler.execute("move", "Walker", {"direction": "east"}, self.state)
        assert self.state.get_agent_position("Walker") == (6, 4)


class TestGridWorldMoveEdgeCases:
    """Edge case behavior for the move action."""

    def setup_method(self):
        self.handler = ActionHandler()
        self.state = ExperimentState()
        self.state.agents["Walker"] = AgentState(
            position=(0, 0),
            resources={},
        )

    def test_move_west_from_origin_allows_negative(self):
        """KNOWN BUG: No boundary checking. Move to (-1, 0) succeeds.

        This is documented as a known limitation. Boundary validation
        would require grid dimensions from scenario config.
        """
        result = self.handler.execute("move", "Walker", {"direction": "west"}, self.state)
        assert result["success"] is True
        assert result["new_position"] == (-1, 0)

    def test_move_north_from_origin_allows_negative(self):
        """KNOWN BUG: No boundary checking. Move to (0, -1) succeeds."""
        result = self.handler.execute("move", "Walker", {"direction": "north"}, self.state)
        assert result["success"] is True
        assert result["new_position"] == (0, -1)

    def test_move_unknown_direction_noop(self):
        """Unknown direction results in (0,0) delta — position unchanged."""
        result = self.handler.execute("move", "Walker", {"direction": "up"}, self.state)
        assert result["success"] is True
        assert self.state.get_agent_position("Walker") == (0, 0)

    def test_move_empty_direction_noop(self):
        """Empty direction string results in no movement."""
        result = self.handler.execute("move", "Walker", {"direction": ""}, self.state)
        assert result["success"] is True
        assert self.state.get_agent_position("Walker") == (0, 0)

    def test_move_no_position_fails(self):
        """Agent without position cannot move."""
        self.state.agents["Ghost"] = AgentState(position=None)
        result = self.handler.execute("move", "Ghost", {"direction": "north"}, self.state)
        assert result["success"] is False


class TestGridWorldScenarioMetadata:
    """Grid World scenario metadata is internally consistent."""

    def test_scenario_exists(self):
        scenario = get_scenario("grid_world")
        assert scenario is not None
        assert scenario["id"] == "grid_world"

    def test_category_is_spatial(self):
        assert get_scenario("grid_world")["category"] == "spatial"

    def test_payoff_type_is_none(self):
        assert get_scenario("grid_world")["payoff_type"] == "none"

    def test_interaction_mode_is_simultaneous(self):
        assert get_scenario("grid_world")["interaction_mode"] == "simultaneous"

    def test_grouping_mode_is_neighbor(self):
        assert get_scenario("grid_world")["grouping_mode"] == "neighbor"

    def test_actions_match_supported_set(self):
        """Scenario exposes exactly the v1 supported actions."""
        actions = get_scenario_actions("grid_world")
        action_ids = {a["id"] for a in actions}
        assert action_ids == GRID_WORLD_ACTION_IDS

    def test_move_action_has_direction_description(self):
        """Move action description mentions directional movement."""
        actions = get_scenario_actions("grid_world")
        move_action = next(a for a in actions if a["id"] == "move")
        desc = move_action["description"].lower()
        assert "north" in desc or "direction" in desc

    def test_actions_have_id_name_description(self):
        actions = get_scenario_actions("grid_world")
        for action in actions:
            assert action["id"]
            assert action["name"]
            assert action["description"]

    def test_information_model_is_neighborhood(self):
        model = get_information_model("grid_world")
        assert model.scope_type == "neighborhood"
        assert model.include_scores is False

    def test_parameters_have_expected_keys(self):
        scenario = get_scenario("grid_world")
        param_ids = {p["id"] for p in scenario["parameters"]}
        assert "grid_size" in param_ids
        assert "resource_count" in param_ids

    def test_no_removed_actions_in_metadata(self):
        """move_to_location and gather_resource are not in active metadata."""
        actions = get_scenario_actions("grid_world")
        action_ids = {a["id"] for a in actions}
        assert "move_to_location" not in action_ids
        assert "gather_resource" not in action_ids
