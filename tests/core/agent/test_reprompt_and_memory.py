"""
Tests for agent reprompt system and assistant memory assembly.

Covers:
  - Reprompt flow: when LLM returns action with empty REPROMPT_PARAM field,
    a second LLM call fills it and result is injected into action_data.
  - REPROMPT_SCENE_TYPES / REPROMPT_TASK_MODES filtering.
  - Assistant memory assembly (response, message, context_update, fallback).

Contains: TestRepromptFlow, TestRepromptSceneFilter, TestAssistantMemoryAssembly
"""

import json
import pytest
from unittest.mock import MagicMock, patch, call

from socialsim4.core.agent import Agent
from socialsim4.core.action import Action


class RepromptAction(Action):
    """Test action with REPROMPT_PARAM set."""
    NAME = "speak"
    REPROMPT_PARAM = "message"

    def handle(self, action_data, agent, simulator, scene):
        return True, {}, "", {}, False


class FilteredRepromptAction(Action):
    """Test action with scene-type and task-mode filters."""
    NAME = "feedback"
    REPROMPT_PARAM = "message"
    REPROMPT_SCENE_TYPES = {"test_scene"}
    REPROMPT_TASK_MODES = {"active"}

    def handle(self, action_data, agent, simulator, scene):
        return True, {}, "", {}, False


def _agent(**kw):
    """Create a minimal agent with sensible defaults."""
    defaults = dict(
        name="T",
        user_profile="p",
        style="neutral",
        action_space=[RepromptAction()],
    )
    defaults.update(kw)
    return Agent(**defaults)


def _json_with_empty_message():
    """Return JSON response where speak action has empty message."""
    return json.dumps({
        "thoughts": "t",
        "response": "r",
        "action": {"name": "speak", "message": ""},
        "context_update": "",
        "metadata": {},
    })


class TestRepromptFlow:
    """Reprompt is triggered when REPROMPT_PARAM field is empty."""

    def test_reprompt_triggers_second_llm_call(self):
        """When action has empty reprompt param, LLM is called again."""
        a = _agent()
        a.add_env_feedback("Event")

        mc = MagicMock()
        mc.chat.side_effect = [_json_with_empty_message(), "Hello world"]

        a.process({"chat": mc}, initiative=True)
        assert mc.chat.call_count == 2

    def test_reprompt_result_injected_into_action(self):
        """Reprompt output fills the empty param in action_data."""
        a = _agent()
        a.add_env_feedback("Event")

        mc = MagicMock()
        mc.chat.side_effect = [_json_with_empty_message(), "Filled content"]

        result = a.process({"chat": mc}, initiative=True)
        assert result is not None
        assert len(result) > 0
        action_payload = result[0].get("action", {})
        assert action_payload.get("message") == "Filled content"

    def test_reprompt_skipped_when_param_filled(self):
        """When action already has message, no second LLM call."""
        filled_json = json.dumps({
            "thoughts": "t",
            "response": "r",
            "action": {"name": "speak", "message": "already here"},
            "context_update": "",
            "metadata": {},
        })
        a = _agent()
        a.add_env_feedback("Event")

        mc = MagicMock()
        mc.chat.return_value = filled_json

        a.process({"chat": mc}, initiative=True)
        assert mc.chat.call_count == 1

    def test_reprompt_skipped_for_unknown_action(self):
        """Actions not in action_lookup are ignored (no reprompt)."""
        json_unknown = json.dumps({
            "thoughts": "t",
            "response": "r",
            "action": {"name": "unknown_action"},
            "context_update": "",
            "metadata": {},
        })
        a = _agent()
        a.add_env_feedback("Event")

        mc = MagicMock()
        mc.chat.return_value = json_unknown

        a.process({"chat": mc}, initiative=True)
        assert mc.chat.call_count == 1


class TestRepromptSceneFilter:
    """REPROMPT_SCENE_TYPES and REPROMPT_TASK_MODES gate the reprompt."""

    def test_scene_type_mismatch_skips_reprompt(self):
        """Reprompt skipped when scene TYPE not in REPROMPT_SCENE_TYPES."""
        a = _agent(action_space=[FilteredRepromptAction()])

        class WrongScene:
            TYPE = "other_scene"
            state = {}

        a.add_env_feedback("Event")
        mc = MagicMock()
        mc.chat.side_effect = [
            json.dumps({
                "thoughts": "t", "response": "r",
                "action": {"name": "feedback", "message": ""},
                "context_update": "", "metadata": {},
            }),
            "Should not be called",
        ]

        a.process({"chat": mc}, initiative=True, scene=WrongScene())
        assert mc.chat.call_count == 1

    def test_no_scene_skips_filtered_action(self):
        """Filtered reprompt action skipped when no scene provided."""
        a = _agent(action_space=[FilteredRepromptAction()])
        a.add_env_feedback("Event")

        mc = MagicMock()
        mc.chat.side_effect = [
            json.dumps({
                "thoughts": "t", "response": "r",
                "action": {"name": "feedback", "message": ""},
                "context_update": "", "metadata": {},
            }),
            "Should not be called",
        ]

        a.process({"chat": mc}, initiative=True)
        assert mc.chat.call_count == 1


class TestAssistantMemoryAssembly:
    """Covers lines 674-720: memory composition from response, message, context_update."""

    def test_response_included_in_memory(self):
        """Response field is stored in short_memory."""
        a = _agent(action_space=[])
        a.add_env_feedback("Event")

        mc = MagicMock()
        mc.chat.return_value = json.dumps({
            "thoughts": "t",
            "response": "My answer",
            "action": {"name": "yield"},
            "context_update": "",
            "metadata": {},
        })

        a.process({"chat": mc}, initiative=True)
        mem_items = a.short_memory.get_all()
        assistant_msgs = [m for m in mem_items if m["role"] == "assistant"]
        assert any("My answer" in m["content"] for m in assistant_msgs)

    def test_context_update_included_in_memory(self):
        """context_update field prefixed with [Remember]."""
        a = _agent(action_space=[])
        a.add_env_feedback("Event")

        mc = MagicMock()
        mc.chat.return_value = json.dumps({
            "thoughts": "t",
            "response": "r",
            "action": {"name": "yield"},
            "context_update": "Important fact",
            "metadata": {},
        })

        a.process({"chat": mc}, initiative=True)
        mem_items = a.short_memory.get_all()
        assistant_msgs = [m for m in mem_items if m["role"] == "assistant"]
        assert any("[Remember] Important fact" in m["content"] for m in assistant_msgs)

    def test_fallback_memory_when_no_response(self):
        """When response is empty, action names compose fallback memory."""
        a = _agent(action_space=[])
        a.add_env_feedback("Event")

        mc = MagicMock()
        mc.chat.return_value = json.dumps({
            "thoughts": "t",
            "response": "",
            "action": {"name": "move", "target": "kitchen"},
            "context_update": "",
            "metadata": {},
        })

        a.process({"chat": mc}, initiative=True)
        mem_items = a.short_memory.get_all()
        assistant_msgs = [m for m in mem_items if m["role"] == "assistant"]
        assert any("[Action] move -> kitchen" in m["content"] for m in assistant_msgs)

    def test_fallback_memory_action_without_target(self):
        """Fallback memory for action without target field."""
        a = _agent(action_space=[])
        a.add_env_feedback("Event")

        mc = MagicMock()
        mc.chat.return_value = json.dumps({
            "thoughts": "t",
            "response": "",
            "action": {"name": "observe"},
            "context_update": "",
            "metadata": {},
        })

        a.process({"chat": mc}, initiative=True)
        mem_items = a.short_memory.get_all()
        assistant_msgs = [m for m in mem_items if m["role"] == "assistant"]
        assert any("[Action] observe" in m["content"] for m in assistant_msgs)

    def test_yield_action_excluded_from_fallback(self):
        """Yield actions are skipped in fallback memory."""
        a = _agent(action_space=[])
        a.add_env_feedback("Event")

        mc = MagicMock()
        mc.chat.return_value = json.dumps({
            "thoughts": "t",
            "response": "",
            "action": {"name": "yield"},
            "context_update": "",
            "metadata": {},
        })

        a.process({"chat": mc}, initiative=True)
        mem_items = a.short_memory.get_all()
        assistant_msgs = [m for m in mem_items if m["role"] == "assistant"]
        assert all("[Action] yield" not in m["content"] for m in assistant_msgs)
