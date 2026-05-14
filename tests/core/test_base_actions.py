"""
Tests for base_actions.py — Speak, SendMessage, Yield, TalkTo handlers.

Covers happy paths, missing-parameter branches, TalkTo range check,
and event delivery for each action type.
"""

import pytest
from unittest.mock import MagicMock, call

from socialsim4.core.actions.base_actions import (
    SpeakAction,
    SendMessageAction,
    YieldAction,
    TalkToAction,
)


# --- Fixtures ---------------------------------------------------------------

@pytest.fixture
def agent():
    a = MagicMock()
    a.name = "Alice"
    a.language = "en"
    a.properties = {}
    a.add_env_feedback = MagicMock()
    return a


@pytest.fixture
def simulator():
    sim = MagicMock()
    sim.agents = {}
    return sim


@pytest.fixture
def scene():
    s = MagicMock()
    s.state = {"time": 120}
    s.chat_range = 5
    s.deliver_message = MagicMock()
    return s


# --- SpeakAction ------------------------------------------------------------

class TestSpeakAction:

    def test_success(self, agent, simulator, scene):
        result = SpeakAction().handle(
            {"message": "Hello world"}, agent, simulator, scene
        )
        success, data, summary, meta, pass_control = result
        assert success is True
        assert data == {"message": "Hello world"}
        assert pass_control is False
        scene.deliver_message.assert_called_once()

    def test_missing_message(self, agent, simulator, scene):
        result = SpeakAction().handle({}, agent, simulator, scene)
        success, data, summary, meta, pass_control = result
        assert success is False
        assert "error" in data
        agent.add_env_feedback.assert_called_once()

    def test_empty_message_fails(self, agent, simulator, scene):
        """Empty string is falsy — triggers the error branch."""
        result = SpeakAction().handle(
            {"message": ""}, agent, simulator, scene
        )
        assert result[0] is False
        agent.add_env_feedback.assert_called_once()


# --- SendMessageAction ------------------------------------------------------

class TestSendMessageAction:

    def test_success(self, agent, simulator, scene):
        result = SendMessageAction().handle(
            {"message": "Secret"}, agent, simulator, scene
        )
        success, data, summary, meta, pass_control = result
        assert success is True
        assert data == {"message": "Secret"}
        assert pass_control is False
        scene.deliver_message.assert_called_once()

    def test_missing_message(self, agent, simulator, scene):
        result = SendMessageAction().handle({}, agent, simulator, scene)
        assert result[0] is False
        agent.add_env_feedback.assert_called_once()

    def test_speak_vs_sendmessage_use_different_events(
        self, agent, simulator, scene
    ):
        """Speak produces SpeakEvent; SendMessage produces MessageEvent."""
        SpeakAction().handle({"message": "hi"}, agent, simulator, scene)
        delivered_event = scene.deliver_message.call_args[0][0]
        assert delivered_event.__class__.__name__ == "SpeakEvent"

        scene.deliver_message.reset_mock()
        SendMessageAction().handle({"message": "hi"}, agent, simulator, scene)
        delivered_event = scene.deliver_message.call_args[0][0]
        assert delivered_event.__class__.__name__ == "MessageEvent"


# --- YieldAction ------------------------------------------------------------

class TestYieldAction:

    def test_returns_pass_control_true(self, agent, simulator, scene):
        result = YieldAction().handle({}, agent, simulator, scene)
        success, data, summary, meta, pass_control = result
        assert success is True
        assert pass_control is True
        assert data == {}

    def test_action_data_ignored(self, agent, simulator, scene):
        """Yield doesn't care about action_data contents."""
        result = YieldAction().handle(
            {"anything": "value"}, agent, simulator, scene
        )
        assert result[0] is True
        assert result[4] is True  # pass_control


# --- TalkToAction -----------------------------------------------------------

class TestTalkToAction:

    def _setup_agents(self, simulator, agent, target_pos=(2, 2), sender_pos=(1, 1)):
        """Place sender and target on map for range check."""
        target = MagicMock()
        target.name = "Bob"
        target.properties = {"map_xy": target_pos}
        simulator.agents = {"Bob": target}
        agent.properties = {"map_xy": sender_pos}
        return target

    def test_success_in_range(self, agent, simulator, scene):
        target = self._setup_agents(simulator, agent)
        result = TalkToAction().handle(
            {"target": "Bob", "message": "Hey"}, agent, simulator, scene
        )
        success, data, summary, meta, pass_control = result
        assert success is True
        assert data == {"to": "Bob", "message": "Hey"}
        assert pass_control is False
        # Both sender and target receive feedback
        assert agent.add_env_feedback.call_count == 1
        target.add_env_feedback.assert_called_once()

    def test_success_with_to_param(self, agent, simulator, scene):
        """'to' key also works as target."""
        target = self._setup_agents(simulator, agent)
        result = TalkToAction().handle(
            {"to": "Bob", "message": "Hi"}, agent, simulator, scene
        )
        assert result[0] is True

    def test_missing_target(self, agent, simulator, scene):
        result = TalkToAction().handle(
            {"message": "Hi"}, agent, simulator, scene
        )
        assert result[0] is False
        agent.add_env_feedback.assert_called_once()

    def test_missing_message(self, agent, simulator, scene):
        result = TalkToAction().handle(
            {"target": "Bob"}, agent, simulator, scene
        )
        assert result[0] is False
        agent.add_env_feedback.assert_called_once()

    def test_unknown_target(self, agent, simulator, scene):
        agent.properties = {}
        simulator.agents = {}
        result = TalkToAction().handle(
            {"target": "Nobody", "message": "Hi"}, agent, simulator, scene
        )
        assert result[0] is False
        assert "error" in result[1]

    def test_out_of_range(self, agent, simulator, scene):
        """Manhattan distance > chat_range: blocked."""
        self._setup_agents(
            simulator, agent, target_pos=(10, 10), sender_pos=(0, 0)
        )
        result = TalkToAction().handle(
            {"target": "Bob", "message": "Shout!"}, agent, simulator, scene
        )
        assert result[0] is False
        assert "error" in result[1]
