"""
Branch coverage tests for core.agent.parsing.

Targets untested branches in _merge_action_values, _extract_json_objects,
_coerce_dirty_action_alias, and parse_agent_response.

Contains: TestMergeActionValues, TestExtractAndParse, TestCoerceDirtyActionAlias
"""

import pytest

from socialsim4.core.agent.parsing import (
    DuplicateActionError,
    _coerce_dirty_action_alias,
    _extract_json_objects,
    _load_json_object,
    _merge_action_values,
    parse_agent_response,
)


# ---------------------------------------------------------------------------
# _merge_action_values branches
# ---------------------------------------------------------------------------


class TestMergeActionValues:
    """Branch coverage for _merge_action_values (lines 22-69)."""

    @pytest.mark.parametrize(
        "existing,new_val,expected",
        [
            # Line 24: non-dict existing -> return new_value
            ("string", {"name": "foo"}, {"name": "foo"}),
            # Line 26: non-dict new_value -> return existing
            ({"name": "foo"}, "string", {"name": "foo"}),
        ],
        ids=["non_dict_existing", "non_dict_new"],
    )
    def test_non_dict_short_circuits(self, existing, new_val, expected):
        result = _merge_action_values(existing, new_val, strict_duplicate_actions=False)
        assert result == expected

    def test_strict_duplicate_conflict_raises(self):
        """DuplicateActionError in strict mode with conflicting names (line 34)."""
        with pytest.raises(DuplicateActionError, match="conflicting duplicate"):
            _merge_action_values(
                {"name": "speak"}, {"name": "move"}, strict_duplicate_actions=True
            )

    @pytest.mark.parametrize(
        "existing,new_val",
        [
            ({"name": "send_message", "message": "hi"}, {"name": "yield"}),
            ({"name": "yield"}, {"name": "send_message", "message": "hi"}),
        ],
        ids=["send_message_then_yield", "yield_then_send_message"],
    )
    def test_send_message_yield_alias_merge(self, existing, new_val):
        """yield + send_message resolves to send_message (lines 38-50)."""
        result = _merge_action_values(existing, new_val, strict_duplicate_actions=False)
        assert result["name"] == "send_message"

    @pytest.mark.parametrize(
        "existing,new_val,expected_msg",
        [
            # Lines 52-57: existing has message, new doesn't
            ({"name": "speak", "message": "hello"}, {"name": "speak"}, "hello"),
            # Lines 59-64: new has message, existing doesn't
            ({"name": "speak"}, {"name": "speak", "message": "world"}, "world"),
            # Lines 66-69: default merge, new overwrites
            (
                {"name": "speak", "message": "old"},
                {"name": "speak", "message": "new"},
                "new",
            ),
        ],
        ids=["existing_has_msg", "new_has_msg", "both_have_msg"],
    )
    def test_message_preference_merge(self, existing, new_val, expected_msg):
        result = _merge_action_values(existing, new_val, strict_duplicate_actions=False)
        assert result["message"] == expected_msg


# ---------------------------------------------------------------------------
# _load_json_object with duplicate keys
# ---------------------------------------------------------------------------


class TestLoadJsonObjectStrict:
    """Branch coverage for strict duplicate actions via _load_json_object."""

    def test_strict_duplicate_raises(self):
        json_text = '{"action": {"name": "speak"}, "action": {"name": "move"}}'
        with pytest.raises(DuplicateActionError):
            _load_json_object(json_text, strict_duplicate_actions=True)

    def test_duplicate_same_name_merges(self):
        json_text = '{"action": {"name": "speak", "a": 1}, "action": {"name": "speak", "b": 2}}'
        result = _load_json_object(json_text, strict_duplicate_actions=False)
        assert result["action"]["name"] == "speak"
        assert result["action"]["b"] == 2


# ---------------------------------------------------------------------------
# _extract_json_objects & parse_agent_response skip paths
# ---------------------------------------------------------------------------


class TestExtractAndParse:
    """Branch coverage for skip-invalid paths in extraction and parsing."""

    def test_skip_invalid_brace_json(self):
        """Invalid JSON objects skipped during brace extraction (lines 213-214)."""
        results = _extract_json_objects('{not valid} {"action": "found"}')
        assert len(results) == 1
        assert results[0] == {"action": "found"}

    def test_skip_invalid_code_fence_continues(self):
        """First invalid code fence skipped, second returned (lines 343-344)."""
        text = "```json\n{bad}\n```\n```json\n{\"action\": \"ok\"}\n```"
        result = parse_agent_response(text)
        assert result == {"action": "ok"}


# ---------------------------------------------------------------------------
# _coerce_dirty_action_alias yield normalization branches
# ---------------------------------------------------------------------------


class TestCoerceDirtyActionAlias:
    """Branch coverage for yield normalization paths in _coerce_dirty_action_alias."""

    def test_nested_yield_with_message_to_send_message(self):
        """Nested yield action with message -> send_message (lines 267-269)."""
        data = {
            "action": {"name": "yield", "action": {"name": "inner"}},
            "message": "hello",
        }
        result = _coerce_dirty_action_alias(data)
        assert result["action"]["name"] == "send_message"
        assert result["action"]["message"] == "hello"
        assert result["message"] == "hello"

    def test_nested_action_extracts_context_update(self):
        """Nested action hoists context_update to top level (lines 270-272)."""
        data = {
            "action": {
                "name": "speak",
                "action": {"name": "inner"},
                "context_update": "ctx",
            }
        }
        result = _coerce_dirty_action_alias(data)
        assert result["context_update"] == "ctx"

    def test_bare_yield_with_message_to_send_message(self):
        """String yield + message -> send_message (lines 301-304)."""
        data = {"action": "yield", "message": "hello"}
        result = _coerce_dirty_action_alias(data)
        assert result["action"]["name"] == "send_message"
        assert result["message"] == "hello"

    def test_bare_yield_without_message_to_yield_dict(self):
        """String yield without message -> yield dict (lines 305-308)."""
        data = {"action": "yield"}
        result = _coerce_dirty_action_alias(data)
        assert result["action"] == {"name": "yield"}

    def test_bare_send_message_without_message(self):
        """String send_message without message -> dict payload, no message key."""
        data = {"action": "send_message"}
        result = _coerce_dirty_action_alias(data)
        assert result["action"]["name"] == "send_message"
        assert "message" not in result["action"]

    def test_nested_send_message_with_message(self):
        """Nested send_message + message -> hoists message (lines 263-265)."""
        data = {
            "action": {
                "name": "send_message",
                "action": {"name": "inner"},
            },
            "message": "hello",
        }
        result = _coerce_dirty_action_alias(data)
        assert result["action"]["name"] == "send_message"
        assert result["action"]["message"] == "hello"
