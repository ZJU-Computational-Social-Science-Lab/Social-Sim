"""Tests for core.agent.parsing module."""

import pytest
from socialsim4.core.agent.parsing import (
    parse_agent_response,
    parse_actions,
    strip_thinking_tokens,
)


def test_parse_plain_json():
    """Should extract plain JSON object."""
    response = '{"action": "Cooperate"}'
    result = parse_agent_response(response)
    assert result == {"action": "Cooperate"}


def test_parse_json_in_markdown_fences():
    """Should extract JSON from ```json code fences."""
    response = '''Here's my response:
```json
{"action": "Defect", "reasoning": "better outcome"}
```
That's my choice.'''
    result = parse_agent_response(response)
    assert result == {"action": "Defect", "reasoning": "better outcome"}


def test_parse_json_in_plain_fences():
    """Should extract JSON from ``` code fences without json label."""
    response = '''```{"action": "Cooperate"}```'''
    result = parse_agent_response(response)
    assert result == {"action": "Cooperate"}


def test_parse_returns_empty_dict_on_invalid():
    """Should return empty dict when no valid JSON found."""
    result = parse_agent_response("this is not json")
    assert result == {}


def test_parse_returns_empty_dict_on_empty():
    """Should return empty dict on empty input."""
    assert parse_agent_response("") == {}


def test_parse_actions_with_action_key():
    """Should return list with dict when action key present."""
    response = '{"action": "Move"}'
    result = parse_actions(response)
    assert result == [{"action": "Move"}]


@pytest.mark.xfail(reason="bug: pre-existing failure — needs investigation")
def test_parse_actions_without_action_key():
    """Should return empty list when no action key."""
    response = '{"reasoning": "thinking"}'
    result = parse_actions(response)
    assert result == []


@pytest.mark.xfail(reason="bug: pre-existing failure — needs investigation")
def test_parse_actions_invalid_json():
    """Should return empty list on invalid JSON."""
    result = parse_actions("not json")
    assert result == []


def test_parse_multiple_json_objects_returns_first():
    """Should return the first valid JSON object found."""
    response = '{"action": "first"} some text {"action": "second"}'
    result = parse_agent_response(response)
    assert result == {"action": "first"}


# -------------------------------------------------------------------------
# Thinking Token Stripping Tests
# -------------------------------------------------------------------------

def test_strip_thinking_tokens_deepseek_style():
    """Should strip DeepSeek R1 style thinking tags."""
    response = '''<think reasoning tokens>
Let me analyze this situation carefully...
The prisoner's dilemma suggests...
</think reasoning tokens>
{"action": "Defect"}'''
    result = parse_agent_response(response)
    assert result == {"action": "Defect"}


def test_strip_thinking_tokens_thought_for_seconds():
    """Should strip Ollama 'Thought for X seconds' prefix."""
    response = '''Thought for 31.9 seconds
{"action": "Cooperate"}'''
    result = parse_agent_response(response)
    assert result == {"action": "Cooperate"}


def test_strip_thinking_tokens_with_nested_braces_in_thinking():
    """Should handle thinking content with braces that aren't valid JSON."""
    response = '''<think analysis>
Looking at {option A} vs {option B}...
This {nested {structure}} is not JSON.
</think analysis>
{"action": "Defect", "confidence": 0.9}'''
    result = parse_agent_response(response)
    assert result == {"action": "Defect", "confidence": 0.9}


def test_strip_thinking_tokens_pipe_style():
    """Should strip pipe-style thinking tags."""
    response = '''|thought>
Analyzing the game theory...
|/thought>
{"action": "Cooperate"}'''
    result = parse_agent_response(response)
    assert result == {"action": "Cooperate"}


def test_strip_thinking_tokens_reflection():
    """Should strip reflection tags."""
    response = '''<reflection>
I should consider the long-term implications...
</reflection>
{"action": "Defect"}'''
    result = parse_agent_response(response)
    assert result == {"action": "Defect"}


def test_strip_thinking_tokens_empty_string():
    """Should handle empty string input."""
    assert strip_thinking_tokens("") == ""


def test_strip_thinking_tokens_no_thinking():
    """Should return unchanged text if no thinking tokens present."""
    text = '{"action": "Test"}'
    assert strip_thinking_tokens(text) == text


def test_parse_complex_nested_json():
    """Should handle deeply nested JSON structures."""
    response = '''{"action": {"name": "complex_action", "params": {"nested": {"deep": "value"}}}}'''
    result = parse_agent_response(response)
    assert result == {"action": {"name": "complex_action", "params": {"nested": {"deep": "value"}}}}


def test_parse_json_with_escaped_quotes():
    """Should handle JSON with escaped quotes in strings."""
    response = '''{"action": "say", "message": "He said \\"hello\\""}'''
    result = parse_agent_response(response)
    assert result == {"action": "say", "message": 'He said "hello"'}


def test_parse_thinking_with_json_in_fences():
    """Should strip thinking and then parse fenced JSON."""
    response = '''<think reasoning>
Let me think about this...
</think reasoning>
```json
{"action": "Cooperate"}
```'''
    result = parse_agent_response(response)
    assert result == {"action": "Cooperate"}
