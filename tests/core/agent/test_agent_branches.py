"""
Tests for uncovered agent.py branch paths.

Targets: KB truncation/overflow, scene fallback, summarize regex,
RAG inject, continuation hint, LLM error recovery, offline marking.
"""

import json
import pytest
from unittest.mock import MagicMock, patch
from socialsim4.core.agent import Agent


def _agent(**kw):
    """Create a minimal agent with sensible defaults."""
    defaults = dict(name="T", user_profile="p", style="neutral", action_space=[])
    defaults.update(kw)
    return Agent(**defaults)


def _valid_json_response():
    """Return a valid LLM JSON response string."""
    return json.dumps({
        "thoughts": "t", "response": "r",
        "action": {"name": "yield"},
        "context_update": "", "metadata": {},
    })


# ---------------------------------------------------------------------------
# Knowledge Base Truncation & Overflow
# ---------------------------------------------------------------------------


class TestKBTruncation:
    """KB content >80 chars gets truncated with '...'."""

    def test_long_content_truncated(self):
        content = "x" * 120
        a = _agent(knowledge_base=[
            {"id": "k1", "title": "Long", "content": content, "enabled": True}
        ])
        prompt = a.system_prompt()
        # First 80 chars present, truncation marker appears
        assert "x" * 80 in prompt
        assert "..." in prompt

    def test_short_content_shown_full(self):
        a = _agent(knowledge_base=[
            {"id": "k1", "title": "Short", "content": "hi", "enabled": True}
        ])
        prompt = a.system_prompt()
        assert "hi" in prompt


class TestKBOverflow:
    """When >5 KB entries, only first 5 shown with 'more' suffix."""

    def test_seven_entries_hides_later_items(self):
        kb = [
            {"id": f"k{i}", "title": f"UT{i}", "content": f"UC{i}", "enabled": True}
            for i in range(7)
        ]
        a = _agent(knowledge_base=kb)
        prompt = a.system_prompt()
        # First 5 titles visible
        assert "UT0" in prompt
        assert "UT4" in prompt
        # 6th and 7th titles NOT visible
        assert "UT5" not in prompt
        assert "UT6" not in prompt

    def test_five_entries_all_shown(self):
        kb = [
            {"id": f"k{i}", "title": f"UT{i}", "content": f"UC{i}", "enabled": True}
            for i in range(5)
        ]
        a = _agent(knowledge_base=kb)
        prompt = a.system_prompt()
        assert "UT0" in prompt
        assert "UT4" in prompt


# ---------------------------------------------------------------------------
# Scene Description Fallback
# ---------------------------------------------------------------------------


class TestSceneFallback:
    """When scene lacks get_compact_description, uses get_scenario_description."""

    def test_fallback_to_scenario_description(self):
        class MinimalScene:
            def get_scenario_description(self):
                return "Fallback scene desc"

        a = _agent()
        assert "Fallback scene desc" in a.system_prompt(scene=MinimalScene())

    def test_compact_description_preferred(self):
        class RichScene:
            def get_compact_description(self):
                return "Compact desc"
            def get_scenario_description(self):
                return "Should not appear"

        a = _agent()
        assert "Compact desc" in a.system_prompt(scene=RichScene())

    def test_no_scene_methods_gives_empty_block(self):
        class BareScene:
            pass

        a = _agent()
        prompt = a.system_prompt(scene=BareScene())
        # Agent name still present, but no scene description
        assert "T" in prompt


# ---------------------------------------------------------------------------
# Summarize History Regex
# ---------------------------------------------------------------------------


class TestSummarizeRegex:
    """Regex extracts 'Summary:' prefix; fallback to raw output."""

    def test_summary_prefix_extracted(self):
        a = _agent()
        a.short_memory.append("user", "hello")
        a.short_memory.append("assistant", "hi")
        mc = MagicMock()
        mc.chat.return_value = "Summary: Key points discussed."
        a.summarize_history(mc)  # takes client directly, not dict
        content = a.short_memory.get_all()[0]["content"]
        assert "Key points discussed." in content

    def test_no_prefix_uses_raw_output(self):
        a = _agent()
        a.short_memory.append("user", "hello")
        mc = MagicMock()
        mc.chat.return_value = "Just raw output text."
        a.summarize_history(mc)
        content = a.short_memory.get_all()[0]["content"]
        assert "Just raw output text." in content


# ---------------------------------------------------------------------------
# RAG Auto-Inject
# ---------------------------------------------------------------------------


class TestRAGAutoInject:
    """RAG context is appended to system prompt when enabled."""

    @patch("socialsim4.core.config.RAG_AUTO_INJECT", True)
    @patch("socialsim4.core.agent.agent._get_auto_rag_context")
    def test_rag_context_appended_to_system_prompt(self, mock_rag):
        mock_rag.return_value = "Retrieved RAG context here"
        a = _agent()
        a.add_env_feedback("Event")
        mc = MagicMock()
        mc.chat.return_value = _valid_json_response()
        a.process({"chat": mc}, initiative=True)

        mock_rag.assert_called_once()
        msgs = mc.chat.call_args[0][0]
        sys_content = msgs[0]["content"]
        assert "Retrieved RAG context here" in sys_content


# ---------------------------------------------------------------------------
# Continuation Hint
# ---------------------------------------------------------------------------


class TestContinuationHint:
    """'Continue.' hint appended when initiative or last role was assistant."""

    def test_initiative_adds_continue_hint(self):
        a = _agent()
        mc = MagicMock()
        mc.chat.return_value = _valid_json_response()
        a.process({"chat": mc}, initiative=True)

        msgs = mc.chat.call_args[0][0]
        assert any("Continue." in m.get("content", "") for m in msgs)

    def test_last_assistant_role_adds_hint(self):
        a = _agent()
        a.add_env_feedback("Event")
        a.short_memory.append("assistant", "Previous reply")
        a.last_history_length = 1  # ensure process doesn't skip

        mc = MagicMock()
        mc.chat.return_value = _valid_json_response()
        a.process({"chat": mc})

        msgs = mc.chat.call_args[0][0]
        assert any("Continue." in m.get("content", "") for m in msgs)


# ---------------------------------------------------------------------------
# LLM Error Recovery in Process Loop
# ---------------------------------------------------------------------------


class TestLLMErrorRecovery:
    """Error handling: retry with feedback, offline break, reset on success."""

    def test_llm_error_marks_offline_at_threshold(self):
        a = _agent(max_consecutive_llm_errors=1, max_repeat=0)
        a.add_env_feedback("Event")
        mc = MagicMock()
        mc.chat.side_effect = Exception("API down")

        result = a.process({"chat": mc}, initiative=True)
        assert result == {}
        assert a.is_offline is True

    def test_success_resets_error_counter(self):
        a = _agent(max_repeat=0)
        a.add_env_feedback("Event")
        a.consecutive_llm_errors = 2

        mc = MagicMock()
        mc.chat.return_value = _valid_json_response()
        a.process({"chat": mc}, initiative=True)
        assert a.consecutive_llm_errors == 0

    def test_llm_call_retries_with_feedback(self):
        a = _agent(max_repeat=1)  # 2 attempts
        a.add_env_feedback("Event")
        mc = MagicMock()
        mc.chat.side_effect = [Exception("err"), _valid_json_response()]

        a.process({"chat": mc}, initiative=True)
        assert mc.chat.call_count == 2

    def test_parse_failure_on_final_attempt(self):
        a = _agent(max_repeat=1)  # 2 attempts
        a.add_env_feedback("Event")
        mc = MagicMock()
        mc.chat.return_value = "not json"

        with patch("socialsim4.core.agent.agent.parse_actions",
                    side_effect=ValueError("bad json")):
            result = a.process({"chat": mc}, initiative=True)

        assert result == {}
        assert a.consecutive_llm_errors > 0

    def test_offline_mid_retries_breaks_loop(self):
        """When agent goes offline during retries, loop breaks immediately."""
        a = _agent(max_consecutive_llm_errors=1, max_repeat=2)
        a.add_env_feedback("Event")
        call_count = 0

        def fail_then_offline(msgs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise Exception("first fail")
            # Second call: agent is now offline from first error's side effect
            raise Exception("second fail")

        mc = MagicMock()
        mc.chat.side_effect = fail_then_offline

        # max_repeat=2 → 3 attempts; max_consecutive_llm_errors=1
        # i=0: raises → _record(final=False) → no increment → retry
        # i=1: raises → _record(final=False) → no increment → retry
        # i=2: raises → _record(final=True) → consecutive=1 → offline=True → break
        a.process({"chat": mc}, initiative=True)
        assert a.is_offline is True
        assert call_count == 3
