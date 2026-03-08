"""
Unit tests for contagion actions (MoveAdjacentAction).

Tests the action classes that enable agent movement in contagion scenarios.
MoveAdjacentAction allows agents to move one cell at a time in 8 compass
directions with validation for boundaries and collisions.
"""
import pytest
from unittest.mock import MagicMock

from socialsim4.core.contagion.scene import ContagionScene
from socialsim4.core.scenes.village_scene import GameMap


class TestMoveAdjacentAction:
    """Tests for MoveAdjacentAction single-cell movement."""

    def test_move_to_valid_adjacent_cell(self, game_map, mock_agent_at_position):
        """Test that move to valid adjacent cell succeeds and updates position."""
        from socialsim4.core.contagion.actions import MoveAdjacentAction

        # Create scene and action
        rules = []
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules,
            initial_infected_count=0
        )

        # Create agent at center position (5, 5)
        agent = mock_agent_at_position("alice", 5, 5)

        # Create simulator mock
        simulator = MagicMock()
        simulator.agents = {"alice": agent}

        # Execute move action north
        action = MoveAdjacentAction()
        action_data = {"direction": "north"}
        success, result, summary, meta, pass_control = action.handle(
            action_data, agent, simulator, scene
        )

        # Verify success
        assert success is True
        # Verify position updated
        assert agent.properties["map_xy"] == [5, 4]
        # Verify result contains from/to
        assert result["from"] == [5, 5]
        assert result["to"] == [5, 4]
        assert result["direction"] == "north"
        # Verify feedback was added
        agent.add_env_feedback.assert_called()

    def test_move_blocked_by_occupied_cell(self, game_map, mock_agent_at_position):
        """Test that move to occupied cell fails with feedback."""
        from socialsim4.core.contagion.actions import MoveAdjacentAction

        # Create scene
        rules = []
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules,
            initial_infected_count=0
        )

        # Create two agents - one blocking
        alice = mock_agent_at_position("alice", 5, 5)
        bob = mock_agent_at_position("bob", 5, 4)  # North of alice

        # Create simulator with both agents
        simulator = MagicMock()
        simulator.agents = {"alice": alice, "bob": bob}

        # Execute move action north (should be blocked by bob)
        action = MoveAdjacentAction()
        action_data = {"direction": "north"}
        success, result, summary, meta, pass_control = action.handle(
            action_data, alice, simulator, scene
        )

        # Verify failure
        assert success is False
        assert result["error"] == "occupied"
        assert result["by"] == "bob"
        # Verify position NOT updated
        assert alice.properties["map_xy"] == [5, 5]
        # Verify feedback mentions bob
        alice.add_env_feedback.assert_called()

    def test_move_blocked_by_boundary(self, game_map, mock_agent_at_position):
        """Test that move at grid boundary fails with feedback."""
        from socialsim4.core.contagion.actions import MoveAdjacentAction

        # Create scene
        rules = []
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules,
            initial_infected_count=0
        )

        # Create agent at northern edge (y=0)
        alice = mock_agent_at_position("alice", 5, 0)

        # Create simulator
        simulator = MagicMock()
        simulator.agents = {"alice": alice}

        # Execute move action north (should be blocked by boundary)
        action = MoveAdjacentAction()
        action_data = {"direction": "north"}
        success, result, summary, meta, pass_control = action.handle(
            action_data, alice, simulator, scene
        )

        # Verify failure
        assert success is False
        assert result["error"] == "boundary"
        assert result["direction"] == "north"
        # Verify position NOT updated
        assert alice.properties["map_xy"] == [5, 0]
        # Verify feedback mentions boundary
        alice.add_env_feedback.assert_called()

    def test_move_invalid_direction(self, game_map, mock_agent_at_position):
        """Test that move with invalid direction fails with feedback."""
        from socialsim4.core.contagion.actions import MoveAdjacentAction

        # Create scene
        rules = []
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules,
            initial_infected_count=0
        )

        # Create agent at center
        alice = mock_agent_at_position("alice", 5, 5)

        # Create simulator
        simulator = MagicMock()
        simulator.agents = {"alice": alice}

        # Execute move with invalid direction
        action = MoveAdjacentAction()
        action_data = {"direction": "diagonal"}  # Invalid
        success, result, summary, meta, pass_control = action.handle(
            action_data, alice, simulator, scene
        )

        # Verify failure
        assert success is False
        assert result["error"] == "invalid_direction"
        assert result["direction"] == "diagonal"
        # Verify position NOT updated
        assert alice.properties["map_xy"] == [5, 5]
        # Verify feedback mentions valid directions
        alice.add_env_feedback.assert_called()

    def test_move_returns_valid_tuple(self, game_map, mock_agent_at_position):
        """Test that successful move returns valid 5-tuple."""
        from socialsim4.core.contagion.actions import MoveAdjacentAction

        # Create scene
        rules = []
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules,
            initial_infected_count=0
        )

        # Create agent
        alice = mock_agent_at_position("alice", 5, 5)

        # Create simulator
        simulator = MagicMock()
        simulator.agents = {"alice": alice}

        # Execute move
        action = MoveAdjacentAction()
        action_data = {"direction": "southeast"}
        result_tuple = action.handle(action_data, alice, simulator, scene)

        # Verify 5-tuple structure
        assert len(result_tuple) == 5
        success, result, summary, meta, pass_control = result_tuple

        # Verify types
        assert isinstance(success, bool)
        assert isinstance(result, dict)
        assert isinstance(summary, str)
        assert isinstance(meta, dict)
        assert isinstance(pass_control, bool)

        # Verify success values
        assert success is True
        assert result["from"] == [5, 5]
        assert result["to"] == [6, 6]
        assert result["direction"] == "southeast"
        assert meta == {}
        assert pass_control is False


class TestDirectionDeltas:
    """Tests for DIRECTION_DELTAS constant."""

    def test_direction_deltas_has_all_8_directions(self):
        """Test that DIRECTION_DELTAS contains all 8 compass directions."""
        from socialsim4.core.contagion.actions import DIRECTION_DELTAS

        expected_directions = {
            "north", "northeast", "east", "southeast",
            "south", "southwest", "west", "northwest"
        }
        assert set(DIRECTION_DELTAS.keys()) == expected_directions

    def test_direction_deltas_values_are_correct(self):
        """Test that DIRECTION_DELTAS values are correct (dx, dy) tuples."""
        from socialsim4.core.contagion.actions import DIRECTION_DELTAS

        # Verify key directions
        assert DIRECTION_DELTAS["north"] == (0, -1)
        assert DIRECTION_DELTAS["south"] == (0, 1)
        assert DIRECTION_DELTAS["east"] == (1, 0)
        assert DIRECTION_DELTAS["west"] == (-1, 0)
        assert DIRECTION_DELTAS["northeast"] == (1, -1)
        assert DIRECTION_DELTAS["northwest"] == (-1, -1)
        assert DIRECTION_DELTAS["southeast"] == (1, 1)
        assert DIRECTION_DELTAS["southwest"] == (-1, 1)
