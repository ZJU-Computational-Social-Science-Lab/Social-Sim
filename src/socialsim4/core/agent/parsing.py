"""
Agent response parsing utilities.

This module provides functions for parsing LLM responses into
structured JSON data, with support for stripping thinking/reasoning
tokens from various reasoning models.

Contains:
    - strip_thinking_tokens: Remove thinking tags from model output
    - parse_agent_response: Extract JSON from LLM output
    - parse_actions: Parse actions from JSON response
"""

import json
import re


class DuplicateActionError(ValueError):
    pass


def _merge_action_values(existing, new_value, *, strict_duplicate_actions: bool):
    if type(existing) is not dict:
        return new_value
    if type(new_value) is not dict:
        return existing

    existing_name = str(existing.get("name") or existing.get("action") or "").strip()
    new_name = str(new_value.get("name") or new_value.get("action") or "").strip()
    existing_has_message = bool(str(existing.get("message", "") or "").strip())
    new_has_message = bool(str(new_value.get("message", "") or "").strip())

    if strict_duplicate_actions and existing_name and new_name and existing_name != new_name:
        raise DuplicateActionError(
            f"LLM response contains conflicting duplicate action fields: '{existing_name}' and '{new_name}'."
        )

    if existing_name == "send_message" and new_name == "yield":
        merged = dict(existing)
        for key, value in new_value.items():
            if key not in merged:
                merged[key] = value
        return merged

    if existing_name == "yield" and new_name == "send_message":
        merged = dict(new_value)
        for key, value in existing.items():
            if key not in merged:
                merged[key] = value
        return merged

    if existing_has_message and not new_has_message:
        merged = dict(existing)
        for key, value in new_value.items():
            if key not in merged:
                merged[key] = value
        return merged

    if new_has_message and not existing_has_message:
        merged = dict(new_value)
        for key, value in existing.items():
            if key not in merged:
                merged[key] = value
        return merged

    merged = dict(existing)
    for key, value in new_value.items():
        merged[key] = value
    return merged


def _merge_object_pairs(pairs, *, strict_duplicate_actions: bool):
    merged = {}
    for key, value in pairs:
        if key == "action" and key in merged:
            merged[key] = _merge_action_values(merged[key], value, strict_duplicate_actions=strict_duplicate_actions)
            continue
        merged[key] = value
    return merged


def _load_json_object(text: str, *, strict_duplicate_actions: bool = False) -> dict:
    return json.loads(
        text,
        object_pairs_hook=lambda pairs: _merge_object_pairs(
            pairs,
            strict_duplicate_actions=strict_duplicate_actions,
        ),
    )


def strip_thinking_tokens(text: str) -> str:
    """Strip thinking/reasoning tokens from model output.

    Handles formats from various reasoning models:
    - XML-style tags: <think/>, <reasoning/>, <thought/>, etc.
    - Pipe tags: |thought>...|/thought>
    - Generic prefixes: "Thought for X seconds", etc.

    Args:
        text: Raw LLM response that may contain thinking tokens

    Returns:
        Text with thinking tokens removed
    """
    if not text:
        return text

    original_text = text

    # Pattern 1: XML-style thinking tags (DeepSeek R1, Qwen, etc.)
    # Handles: <think/>, <reasoning/>, <thought/>, <reflection/>, <analysis/>
    text = re.sub(
        r'<(?:think|reasoning|thought|reflection|analysis)\b[^>]*>.*?</(?:think|reasoning|thought|reflection|analysis)\b[^>]*>',
        '',
        text,
        flags=re.DOTALL | re.IGNORECASE
    )

    # Pattern 2: Self-closing or malformed tags
    text = re.sub(
        r'<(?:think|reasoning|thought|reflection|analysis)[^>]*/>',
        '',
        text,
        flags=re.IGNORECASE
    )

    # Pattern 3: Pipe-style tags (some models)
    text = re.sub(
        r'\|(?:think|thought|reasoning)\>.*?\|/(?:think|thought|reasoning)\>',
        '',
        text,
        flags=re.DOTALL | re.IGNORECASE
    )

    # Pattern 4: "Thought for X seconds" prefixes (Ollama display format)
    text = re.sub(
        r'^Thought for \d+\.?\d*\s*(?:seconds?|ms)?\s*',
        '',
        text,
        flags=re.IGNORECASE
    )

    # Pattern 5: Markdown headers that might indicate thinking sections
    text = re.sub(
        r'^#{1,3}\s*(?:Thinking|Reasoning|Thought|Analysis)\s*\n.*?(?=\n#{1,3}|\Z)',
        '',
        text,
        flags=re.DOTALL | re.IGNORECASE | re.MULTILINE
    )

    # Pattern 6: bare /think markers or trailing reasoning commands
    text = re.sub(
        r'(^|\n)\s*/(?:think|reasoning|analysis)\b.*?(?=\n|\Z)',
        '\\1',
        text,
        flags=re.IGNORECASE | re.DOTALL
    )

    # Pattern 7: dangling inline reasoning markers that slip into final text
    text = re.sub(
        r'(?i)\s+/(?:think|reasoning|analysis)\b(?=\s|$)',
        '',
        text,
    )

    return text.strip()


def _extract_json_objects(text: str, *, strict_duplicate_actions: bool = False) -> list[dict]:
    """Extract all valid JSON objects from text using balanced brace matching.

    This is more robust than regex for deeply nested JSON structures.

    Args:
        text: Text that may contain JSON objects

    Returns:
        List of parsed JSON objects (in order of appearance)
    """
    results = []
    depth = 0
    start = None
    in_string = False
    escape_next = False

    for i, char in enumerate(text):
        if escape_next:
            escape_next = False
            continue

        if char == '\\' and in_string:
            escape_next = True
            continue

        if char == '"' and not escape_next:
            in_string = not in_string
            continue

        if in_string:
            continue

        if char == '{':
            if depth == 0:
                start = i
            depth += 1
        elif char == '}':
            depth -= 1
            if depth == 0 and start is not None:
                candidate = text[start:i + 1]
                try:
                    results.append(_load_json_object(candidate, strict_duplicate_actions=strict_duplicate_actions))
                except (json.JSONDecodeError, DuplicateActionError):
                    pass
                start = None

    return results


def _coerce_dirty_action_alias(data: dict) -> dict:
    raw_action = data.get("action")
    alias_names = {"action", "response", "confirm"}

    if type(raw_action) is dict:
        action_name = str(raw_action.get("name") or raw_action.get("action") or "").strip().lower()
        message = str(
            raw_action.get("message")
            or raw_action.get("content")
            or data.get("message")
            or data.get("content")
            or data.get("response")
            or ""
        ).strip()
        if action_name in alias_names and message:
            normalized = dict(data)
            action_payload = dict(raw_action)
            action_payload["name"] = "send_message"
            action_payload["message"] = message
            action_payload.pop("action", None)
            normalized["action"] = action_payload
            normalized["message"] = message
            return normalized
        return data

    action_name = str(raw_action or "").strip().lower()
    message = str(data.get("message") or data.get("content") or data.get("response") or "").strip()
    if action_name in alias_names and message:
        normalized = dict(data)
        normalized["action"] = {"name": "send_message", "message": message}
        normalized["message"] = message
        return normalized
    return data


def parse_agent_response(response_text: str, *, strict_duplicate_actions: bool = False) -> dict:
    """Extract the first valid JSON object from LLM output.

    Handles:
    - Thinking/reasoning tokens from various models (stripped first)
    - ```json ... ``` code fences
    - ``` ... ``` code fences
    - Plain JSON objects with robust brace matching

    Returns {} if no valid JSON found.

    Args:
        response_text: Raw LLM response string

    Returns:
        Parsed JSON dict, or empty dict if parsing fails
    """
    if not response_text:
        return {}

    # Strip thinking tokens first (handles all reasoning models)
    cleaned_text = strip_thinking_tokens(response_text)

    # Try code fences first
    fence_pattern = r'```(?:json)?\s*\n?(.*?)\n?```'
    matches = re.findall(fence_pattern, cleaned_text, re.DOTALL)

    if matches:
        for match in matches:
            try:
                return _load_json_object(match.strip(), strict_duplicate_actions=strict_duplicate_actions)
            except (json.JSONDecodeError, DuplicateActionError):
                continue

    # Use robust brace matching for plain JSON objects
    json_objects = _extract_json_objects(cleaned_text, strict_duplicate_actions=strict_duplicate_actions)
    if json_objects:
        return json_objects[0]

    return {}


def parse_actions(response_text: str, *, strict_duplicate_actions: bool = False) -> list:
    """Parse actions from LLM response using JSON format.
    Enforces presence of an action with a non-empty name.

    Args:
        response_text: Raw LLM response string

    Returns:
        List containing the parsed action dict.

    Raises:
        ValueError: If the response JSON is missing or lacks a valid action name.
    """
    data = parse_agent_response(response_text, strict_duplicate_actions=strict_duplicate_actions)
    if not data:
        raise ValueError("LLM response is missing the required JSON object with an action.")

    data = _coerce_dirty_action_alias(data)

    if "action" not in data:
        raise ValueError("LLM response must include an 'action' field with a valid name.")

    raw_action = data["action"]
    action_name = None
    if isinstance(raw_action, dict):
        action_name = raw_action.get("name") or raw_action.get("action")
    else:
        action_name = raw_action

    if not action_name or not isinstance(action_name, str):
        raise ValueError("LLM response action is missing a valid 'name' from the Action Space.")

    return [data]
