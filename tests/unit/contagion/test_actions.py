"""
Unit tests for contagion actions (MoveAdjacentAction, SpeakToAction).

Tests the action classes for grid-based movement and communication with
Moore neighborhood adjacency validation and message delivery.

Contains: TestMoveAdjacentAction, TestDirectionDeltas, TestSpeakToAction
"""
import pytest
from unittest.mock import MagicMock

from socialsim4.core.contagion.actions import (
    MoveAdjacentAction,
    SpeakToAction,
    DIRECTION_DELTAS,
    _is_english_language,
    _localized,
)
from socialsim4.core.event import TalkToEvent


class TestDirectionDeltas:
    """Tests for DIRECTION_DELTAS constant."""

    def test_has_eight_directions(self):
        """Verify all 8 compass directions are defined."""
        assert len(DIRECTION_DELTAS) == 8

    def test_cardinal_directions(self):
        """Verify cardinal directions have correct deltas."""
        assert DIRECTION_DELTAS["north"] == (0, -1)
        assert DIRECTION_DELTAS["east"] == (1, 0)
        assert DIRECTION_DELTAS["south"] == (0, 1)
        assert DIRECTION_DELTAS["west"] == (-1, 0)

    def test_diagonal_directions(self):
        """Verify diagonal directions have correct deltas."""
        assert DIRECTION_DELTAS["northeast"] == (1, -1)
        assert DIRECTION_DELTAS["southeast"] == (1, 1)
        assert DIRECTION_DELTAS["southwest"] == (-1, 1)
        assert DIRECTION_DELTAS["northwest"] == (-1, -1)


class TestLocalizedHelper:
    """Tests for _localized helper function."""

    def test_english_language(self):
        """English language returns English text."""
        agent = MagicMock()
        agent.language = "en"
        result = _localized(agent, "English text", "中文文本")
        assert result == "English text"

    def test_chinese_language(self):
        """Chinese language returns Chinese text."""
        agent = MagicMock()
        agent.language = "zh"
        result = _localized(agent, "English text", "中文文本")
        assert result == "中文文本"

    def test_none_language_defaults_to_chinese(self):
        """None language defaults to Chinese."""
        agent = MagicMock()
        agent.language = None
        result = _localized(agent, "English text", "中文文本")
        assert result == "中文文本"


class TestMoveAdjacentAction:
    """Tests for MoveAdjacentAction."""

    @pytest.fixture
    def action(self):
        return MoveAdjacentAction()

    @pytest.fixture
    def mock_setup(self):
        """Create mock agent, simulator, and scene."""
        agent = MagicMock()
        agent.name = "TestAgent"
        agent.language = "en"
        agent.properties = {"map_xy": [5, 5], "map_position": "5,5"}
        agent.add_env_feedback = MagicMock()

        target_agent = MagicMock()
        target_agent.name = "TargetAgent"
        target_agent.properties = {"map_xy": [6, 5]}

        simulator = MagicMock()
        simulator.agents = {"TestAgent": agent, "TargetAgent": target_agent}

        game_map = MagicMock()
        game_map.in_bounds = MagicMock(return_value=True)
        game_map.get_location_at = MagicMock(return_value=None)

        scene = MagicMock()
        scene.game_map = game_map

        return {"agent": agent, "simulator": simulator, "scene": scene}

    def test_move_to_valid_adjacent_cell(self, action, mock_setup):
        """Move to valid adjacent cell succeeds and updates position."""
        # Move north (clear direction - TargetAgent is east at (6,5))
        result = action.handle(
            {"direction": "north"},
            mock_setup["agent"],
            mock_setup["simulator"],
            mock_setup["scene"],
        )

        success, data, summary, meta, pass_control = result
        assert success is True
        assert data["from"] == [5, 5]
        assert data["to"] == [5, 4]
        assert data["direction"] == "north"
        assert pass_control is False

    def test_move_blocked_by_occupied_cell(self, action, mock_setup):
        """Move to occupied cell fails with feedback."""
        # Target agent is at (6, 5), which is east of TestAgent at (5, 5)
        result = action.handle(
            {"direction": "east"},
            mock_setup["agent"],
            mock_setup["simulator"],
            mock_setup["scene"],
        )

        success, data, summary, meta, pass_control = result
        assert success is False
        assert data["error"] == "occupied"
        assert data["by"] == "TargetAgent"

    def test_move_blocked_by_boundary(self, action, mock_setup):
        """Move at grid boundary fails with feedback."""
        mock_setup["agent"].properties["map_xy"] = [0, 0]
        mock_setup["scene"].game_map.in_bounds = lambda x, y: x >= 0 and y >= 0 and x < 10 and y < 10

        result = action.handle(
            {"direction": "west"},
            mock_setup["agent"],
            mock_setup["simulator"],
            mock_setup["scene"],
        )

        success, data, summary, meta, pass_control = result
        assert success is False
        assert data["error"] == "boundary"

    def test_move_invalid_direction(self, action, mock_setup):
        """Move with invalid direction fails with feedback."""
        result = action.handle(
            {"direction": "diagonal"},
            mock_setup["agent"],
            mock_setup["simulator"],
            mock_setup["scene"],
        )

        success, data, summary, meta, pass_control = result
        assert success is False
        assert data["error"] == "invalid_direction"

    def test_move_returns_valid_tuple(self, action, mock_setup):
        """Verify move action returns 5-tuple."""
        result = action.handle(
            {"direction": "north"},
            mock_setup["agent"],
            mock_setup["simulator"],
            mock_setup["scene"],
        )

        assert len(result) == 5
        success, data, summary, meta, pass_control = result
        assert isinstance(success, bool)
        assert isinstance(data, dict)
        assert isinstance(summary, str)
        assert isinstance(meta, dict)
        assert isinstance(pass_control, bool)


class TestSpeakToAction:
    """Tests for SpeakToAction."""

    @pytest.fixture
    def action(self):
        return SpeakToAction()

    @pytest.fixture
    def mock_setup(self):
        """Create mock agent, target, simulator, and scene."""
        agent = MagicMock()
        agent.name = "TestAgent"
        agent.language = "en"
        agent.properties = {"map_xy": [5, 5]}
        agent.add_env_feedback = MagicMock()

        target = MagicMock()
        target.name = "TargetAgent"
        target.properties = {"map_xy": [6, 5]}  # Adjacent (east)
        target.add_env_feedback = MagicMock()

        distant_agent = MagicMock()
        distant_agent.name = "DistantAgent"
        distant_agent.properties = {"map_xy": [10, 10]}  # Not adjacent

        simulator = MagicMock()
        simulator.agents = {
            "TestAgent": agent,
            "TargetAgent": target,
            "DistantAgent": distant_agent,
        }

        scene = MagicMock()
        scene.state = {"time": 0}

        return {
            "agent": agent,
            "target": target,
            "distant_agent": distant_agent,
            "simulator": simulator,
            "scene": scene,
        }

    def test_speak_to_adjacent_agent(self, action, mock_setup):
        """Speak to adjacent agent with message succeeds and delivers message."""
        result = action.handle(
            {"target": "TargetAgent", "message": "Hello!"},
            mock_setup["agent"],
            mock_setup["simulator"],
            mock_setup["scene"],
        )

        success, data, summary, meta, pass_control = result
        assert success is True
        assert data["to"] == "TargetAgent"
        assert data["message"] == "Hello!"
        # Verify message delivered to both parties
        mock_setup["agent"].add_env_feedback.assert_called()
        mock_setup["target"].add_env_feedback.assert_called()

    def test_speak_blocked_by_non_adjacent(self, action, mock_setup):
        """Speak to non-adjacent agent fails with 'not in adjacent cell'."""
        result = action.handle(
            {"target": "DistantAgent", "message": "Hello!"},
            mock_setup["agent"],
            mock_setup["simulator"],
            mock_setup["scene"],
        )

        success, data, summary, meta, pass_control = result
        assert success is False
        assert data["error"] == "not_adjacent"

    def test_speak_to_unknown_agent(self, action, mock_setup):
        """Speak to non-existent agent fails with 'no such agent'."""
        result = action.handle(
            {"target": "UnknownAgent", "message": "Hello!"},
            mock_setup["agent"],
            mock_setup["simulator"],
            mock_setup["scene"],
        )

        success, data, summary, meta, pass_control = result
        assert success is False
        assert data["error"] == "no_such_agent"

    def test_speak_missing_target(self, action, mock_setup):
        """Speak without target fails with missing target error."""
        result = action.handle(
            {"message": "Hello!"},
            mock_setup["agent"],
            mock_setup["simulator"],
            mock_setup["scene"],
        )

        success, data, summary, meta, pass_control = result
        assert success is False
        assert data["error"] == "missing_target"

    def test_speak_missing_message(self, action, mock_setup):
        """Speak without message fails with missing message error."""
        result = action.handle(
            {"target": "TargetAgent"},
            mock_setup["agent"],
            mock_setup["simulator"],
            mock_setup["scene"],
        )

        success, data, summary, meta, pass_control = result
        assert success is False
        assert data["error"] == "missing_message"

    def test_message_delivered_to_target(self, action, mock_setup):
        """Verify message appears in target.add_env_feedback() calls."""
        action.handle(
            {"target": "TargetAgent", "message": "Test message"},
            mock_setup["agent"],
            mock_setup["simulator"],
            mock_setup["scene"],
        )

        # Verify target received feedback
        mock_setup["target"].add_env_feedback.assert_called_once()
        call_args = mock_setup["target"].add_env_feedback.call_args[0][0]
        assert "Test message" in call_args

    def test_speak_returns_valid_tuple(self, action, mock_setup):
        """Verify speak action returns 5-tuple with correct format."""
        result = action.handle(
            {"target": "TargetAgent", "message": "Hello"},
            mock_setup["agent"],
            mock_setup["simulator"],
            mock_setup["scene"],
        )

        assert len(result) == 5
        success, data, summary, meta, pass_control = result
        assert isinstance(success, bool)
        assert isinstance(data, dict)
        assert "to" in data
        assert "message" in data
        assert isinstance(summary, str)
        assert isinstance(meta, dict)
        assert isinstance(pass_control, bool)
