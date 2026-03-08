"""
Unit tests for contagion actions (MoveAdjacentAction, SpeakToAction).

Tests the action classes for grid-based movement and communication with
Moore neighborhood adjacency validation and message delivery.

Contains: TestMoveAdjacentAction, TestDirectionDeltas, TestSpeakToAction
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


class TestSpeakToAction:
    """Tests for SpeakToAction with Moore neighborhood validation and message delivery."""

    def test_speak_to_adjacent_agent_succeeds_and_delivers_message(self, game_map, mock_agent_at_position):
        """Test that speak to adjacent agent succeeds and delivers message via add_env_feedback."""
        from socialsim4.core.contagion.actions import SpeakToAction

        # Agent at (5,5), target at (6,5) - adjacent
        alice = mock_agent_at_position("Alice", 5, 5)
        bob = mock_agent_at_position("Bob", 6, 5)

        simulator = MagicMock()
        simulator.agents = {"Alice": alice, "Bob": bob}

        rules = []
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules,
            initial_infected_count=0
        )
        scene.state = {"time": 0}

        action = SpeakToAction()
        action_data = {"target": "Bob", "message": "Hello!"}
        success, result, summary, meta, pass_control = action.handle(
            action_data, alice, simulator, scene
        )

        assert success is True
        assert result["to"] == "Bob"
        assert result["message"] == "Hello!"
        # Both sender and target should receive the message
        assert alice.add_env_feedback.called
        assert bob.add_env_feedback.called

    def test_speak_blocked_by_non_adjacent_agent(self, game_map, mock_agent_at_position):
        """Test that speak to non-adjacent agent fails with not in adjacent cell error."""
        from socialsim4.core.contagion.actions import SpeakToAction

        # Agent at (5,5), target at (7,5) - 2 cells away, not adjacent
        alice = mock_agent_at_position("Alice", 5, 5)
        bob = mock_agent_at_position("Bob", 7, 5)

        simulator = MagicMock()
        simulator.agents = {"Alice": alice, "Bob": bob}

        rules = []
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules,
            initial_infected_count=0
        )
        scene.state = {"time": 0}

        action = SpeakToAction()
        action_data = {"target": "Bob", "message": "Hello!"}
        success, result, summary, meta, pass_control = action.handle(
            action_data, alice, simulator, scene
        )

        assert success is False
        assert "error" in result
        # Target should NOT receive message
        assert bob.add_env_feedback.called is False

    def test_speak_to_unknown_agent_fails(self, game_map, mock_agent_at_position):
        """Test that speak to non-existent agent fails with no such agent error."""
        from socialsim4.core.contagion.actions import SpeakToAction

        alice = mock_agent_at_position("Alice", 5, 5)

        simulator = MagicMock()
        simulator.agents = {"Alice": alice}  # No Bob

        rules = []
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules,
            initial_infected_count=0
        )
        scene.state = {"time": 0}

        action = SpeakToAction()
        action_data = {"target": "Bob", "message": "Hello!"}
        success, result, summary, meta, pass_control = action.handle(
            action_data, alice, simulator, scene
        )

        assert success is False
        assert "error" in result

    def test_speak_missing_target_fails(self, game_map, mock_agent_at_position):
        """Test that speak without target fails with missing target error."""
        from socialsim4.core.contagion.actions import SpeakToAction

        alice = mock_agent_at_position("Alice", 5, 5)

        simulator = MagicMock()
        simulator.agents = {"Alice": alice}

        rules = []
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules,
            initial_infected_count=0
        )
        scene.state = {"time": 0}

        action = SpeakToAction()
        action_data = {"message": "Hello!"}  # No target
        success, result, summary, meta, pass_control = action.handle(
            action_data, alice, simulator, scene
        )

        assert success is False
        assert "error" in result

    def test_speak_missing_message_fails(self, game_map, mock_agent_at_position):
        """Test that speak without message fails with missing message error."""
        from socialsim4.core.contagion.actions import SpeakToAction

        alice = mock_agent_at_position("Alice", 5, 5)
        bob = mock_agent_at_position("Bob", 6, 5)

        simulator = MagicMock()
        simulator.agents = {"Alice": alice, "Bob": bob}

        rules = []
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules,
            initial_infected_count=0
        )
        scene.state = {"time": 0}

        action = SpeakToAction()
        action_data = {"target": "Bob"}  # No message
        success, result, summary, meta, pass_control = action.handle(
            action_data, alice, simulator, scene
        )

        assert success is False
        assert "error" in result

    def test_message_delivered_to_target_via_add_env_feedback(self, game_map, mock_agent_at_position):
        """Test that message is delivered to target via add_env_feedback with TalkToEvent format (COMM-04)."""
        from socialsim4.core.contagion.actions import SpeakToAction

        alice = mock_agent_at_position("Alice", 5, 5)
        bob = mock_agent_at_position("Bob", 6, 5)

        simulator = MagicMock()
        simulator.agents = {"Alice": alice, "Bob": bob}

        rules = []
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules,
            initial_infected_count=0
        )
        scene.state = {"time": 0}

        action = SpeakToAction()
        action_data = {"target": "Bob", "message": "Hello!"}
        action.handle(action_data, alice, simulator, scene)

        # Verify target received the message
        assert bob.add_env_feedback.called

        # Check that the message format contains both sender and message
        feedback_call = bob.add_env_feedback.call_args[0][0]
        assert "Alice" in feedback_call
        assert "Bob" in feedback_call
        assert "Hello!" in feedback_call

    def test_speak_returns_valid_5_tuple(self, game_map, mock_agent_at_position):
        """Test that speak action returns valid 5-tuple with correct format."""
        from socialsim4.core.contagion.actions import SpeakToAction

        alice = mock_agent_at_position("Alice", 5, 5)
        bob = mock_agent_at_position("Bob", 6, 5)

        simulator = MagicMock()
        simulator.agents = {"Alice": alice, "Bob": bob}

        rules = []
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules,
            initial_infected_count=0
        )
        scene.state = {"time": 0}

        action = SpeakToAction()
        action_data = {"target": "Bob", "message": "Hello!"}
        result = action.handle(action_data, alice, simulator, scene)

        # Verify 5-tuple
        assert len(result) == 5
        success, result_dict, summary, meta, pass_control = result

        assert isinstance(success, bool)
        assert isinstance(result_dict, dict)
        assert isinstance(summary, str)
        assert isinstance(meta, dict)
        assert isinstance(pass_control, bool)

        # Verify result dict has correct keys
        assert "to" in result_dict
        assert "message" in result_dict
        assert result_dict["to"] == "Bob"
        assert result_dict["message"] == "Hello!"

    def test_speak_diagonal_adjacent_succeeds(self, game_map, mock_agent_at_position):
        """Test that speak to diagonally adjacent agent succeeds (Moore neighborhood includes diagonals)."""
        from socialsim4.core.contagion.actions import SpeakToAction

        # Agent at (5,5), target at (6,6) - diagonal, should be adjacent
        alice = mock_agent_at_position("Alice", 5, 5)
        bob = mock_agent_at_position("Bob", 6, 6)

        simulator = MagicMock()
        simulator.agents = {"Alice": alice, "Bob": bob}

        rules = []
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules,
            initial_infected_count=0
        )
        scene.state = {"time": 0}

        action = SpeakToAction()
        action_data = {"target": "Bob", "message": "Hello!"}
        success, result, summary, meta, pass_control = action.handle(
            action_data, alice, simulator, scene
        )

        assert success is True
        assert bob.add_env_feedback.called

    def test_speak_action_has_correct_name_and_instruction(self):
        """Test that SpeakToAction has correct NAME and INSTRUCTION attributes."""
        from socialsim4.core.contagion.actions import SpeakToAction

        assert SpeakToAction.NAME == "speak"
        assert "speak" in SpeakToAction.INSTRUCTION.lower()
        assert "target" in SpeakToAction.INSTRUCTION.lower()
