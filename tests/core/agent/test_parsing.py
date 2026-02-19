"""Tests for core.agent.parsing module."""

import pytest
from socialsim4.core.agent.parsing import parse_agent_response, parse_actions


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


def test_parse_actions_without_action_key():
    """Should return empty list when no action key."""
    response = '{"reasoning": "thinking"}'
    result = parse_actions(response)
    assert result == []


def test_parse_actions_invalid_json():
    """Should return empty list on invalid JSON."""
    result = parse_actions("not json")
    assert result == []


def test_parse_multiple_json_objects_returns_first():
    """Should return the first valid JSON object found."""
    response = '{"action": "first"} some text {"action": "second"}'
    result = parse_agent_response(response)
    assert result == {"action": "first"}
