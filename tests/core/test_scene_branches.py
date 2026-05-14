"""
Branch coverage tests for core.scene (base class).

Uses a minimal concrete subclass to test base class hooks,
action normalization, blocked paths, and network fallbacks.

Contains: TestSceneBaseHooks, TestParseAndHandleAction, TestSceneNetwork, TestSceneMisc
"""

from unittest.mock import MagicMock, patch

from socialsim4.core.agent import Agent
from socialsim4.core.scene import Scene


class ConcreteScene(Scene):
    """Minimal concrete subclass for testing base Scene behavior."""

    pass


# ---------------------------------------------------------------------------
# Base class hook methods
# ---------------------------------------------------------------------------


class TestSceneBaseHooks:
    """Test that base class hooks return expected defaults."""

    def setup_method(self):
        self.scene = ConcreteScene("test", "event")

    def test_get_behavior_guidelines(self):
        assert self.scene.get_behavior_guidelines() == ""

    def test_get_output_format(self):
        assert self.scene.get_output_format() == ""

    def test_get_examples(self):
        assert self.scene.get_examples() == ""

    def test_get_controlled_next_returns_none(self):
        assert self.scene.get_controlled_next(MagicMock()) is None

    def test_is_complete(self):
        assert self.scene.is_complete() is False

    def test_should_skip_turn(self):
        assert self.scene.should_skip_turn(MagicMock(), MagicMock()) is False


# ---------------------------------------------------------------------------
# parse_and_handle_action branches
# ---------------------------------------------------------------------------


class TestParseAndHandleAction:
    """Test dict-action normalization, blocked path, and fallback return."""

    def setup_method(self):
        self.scene = ConcreteScene("test", "event")
        self.agent = MagicMock(spec=Agent)
        self.agent.name = "TestAgent"
        self.agent.action_space = []
        self.sim = MagicMock()

    def test_dict_action_normalization(self, capsys):
        """LLM returns {action: {name: X}} — wrapper is stripped (lines 43-50)."""
        mock_validate = MagicMock(return_value=(True, None))
        self.scene.action_controller.validate_action = mock_validate
        ok, result, summary, meta, pc = self.scene.parse_and_handle_action(
            {"action": {"name": "speak", "message": "hi"}}, self.agent, self.sim
        )
        assert ok is False
        assert result == {}
        assert summary is None
        assert pc is False
        assert mock_validate.call_args[0][0] == "speak"

    def test_action_blocked_path(self, capsys):
        """validate_action rejects -> agent.add_env_feedback called (lines 67-69)."""
        with patch.object(
            self.scene.action_controller,
            "validate_action",
            return_value=(False, "forbidden"),
        ):
            ok, result, summary, meta, pc = self.scene.parse_and_handle_action(
                {"action": "speak"}, self.agent, self.sim
            )
        assert ok is False
        assert result == {"error": "forbidden"}
        assert "forbidden" in summary
        self.agent.add_env_feedback.assert_called_once_with("forbidden")

    def test_no_action_instance_fallback(self, capsys):
        """No matching action instance -> returns (False, {}, None, {}, False) (line 78)."""
        with patch.object(
            self.scene.action_controller,
            "validate_action",
            return_value=(True, None),
        ):
            ok, result, summary, meta, pc = self.scene.parse_and_handle_action(
                {"action": "nonexistent"}, self.agent, self.sim
            )
        assert (ok, result, summary, meta, pc) == (False, {}, None, {}, False)

    def test_dict_action_with_action_key_instead_of_name(self, capsys):
        """Dict action uses 'action' key instead of 'name' (line 44)."""
        mock_validate = MagicMock(return_value=(True, None))
        self.scene.action_controller.validate_action = mock_validate
        self.scene.parse_and_handle_action(
            {"action": {"action": "move"}}, self.agent, self.sim
        )
        assert mock_validate.call_args[0][0] == "move"


# ---------------------------------------------------------------------------
# Social network fallback
# ---------------------------------------------------------------------------


class TestSceneNetwork:
    """Test _get_recipients_by_social_network fallback (line 96)."""

    def test_sender_connections_not_list_fallback(self):
        """Non-list sender_connections -> empty recipients (line 96)."""
        scene = ConcreteScene("test", "event")
        scene.state["social_network"] = {"Alice": "not_a_list"}

        sender = MagicMock()
        sender.name = "Alice"
        sim = MagicMock()
        sim.agents = {"Alice": sender, "Bob": MagicMock()}

        recipients = scene._get_recipients_by_social_network(sender, sim)
        assert recipients == []

    def test_sender_connections_none_fallback(self):
        """None sender_connections -> empty recipients."""
        scene = ConcreteScene("test", "event")
        scene.state["social_network"] = {"Alice": None}

        sender = MagicMock()
        sender.name = "Alice"
        sim = MagicMock()
        sim.agents = {}

        recipients = scene._get_recipients_by_social_network(sender, sim)
        assert recipients == []

    def test_no_social_network_returns_all_agents(self):
        """No social_network -> global broadcast to all agents except sender."""
        scene = ConcreteScene("test", "event")
        sender = MagicMock()
        sender.name = "Alice"
        bob = MagicMock()
        bob.name = "Bob"
        sim = MagicMock()
        sim.agents = {"Alice": sender, "Bob": bob}

        recipients = scene._get_recipients_by_social_network(sender, sim)
        assert recipients == ["Bob"]


# ---------------------------------------------------------------------------
# log and miscellaneous
# ---------------------------------------------------------------------------


class TestSceneMisc:
    """Test log method, post_turn, and serialize/deserialize hooks."""

    def test_log_formats_and_prints(self, capsys):
        """log() prints time-formatted message (lines 180-181)."""
        scene = ConcreteScene("test", "event")
        scene.state["time"] = 1080  # 1080 % 24 = 0
        scene.log("hello world")
        output = capsys.readouterr().out
        assert "[0:00]" in output
        assert "hello world" in output

    def test_post_turn_advances_time(self):
        """post_turn advances state time by minutes_per_turn."""
        scene = ConcreteScene("test", "event")
        scene.minutes_per_turn = 5
        scene.state["time"] = 100
        scene.post_turn(MagicMock(), MagicMock())
        assert scene.state["time"] == 105

    def test_serialize_config_returns_empty(self):
        """Base serialize_config returns empty dict."""
        scene = ConcreteScene("test", "event")
        assert scene.serialize_config() == {}

    def test_deserialize_config_returns_empty(self):
        """Base deserialize_config returns empty dict."""
        assert ConcreteScene.deserialize_config({}) == {}

    def test_get_scene_actions_includes_yield(self):
        """Base scene provides YieldAction."""
        scene = ConcreteScene("test", "event")
        actions = scene.get_scene_actions(MagicMock())
        assert any(a.NAME == "yield" for a in actions)

    def test_initialize_agent_is_noop(self):
        """Base initialize_agent does nothing (no error)."""
        scene = ConcreteScene("test", "event")
        agent = MagicMock()
        scene.initialize_agent(agent)  # Should not raise
