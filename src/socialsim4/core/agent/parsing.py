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

    return text.strip()


def _extract_json_objects(text: str) -> list[dict]:
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
                    results.append(json.loads(candidate))
                except json.JSONDecodeError:
                    pass
                start = None

    return results


def parse_agent_response(response_text: str) -> dict:
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
                return json.loads(match.strip())
            except json.JSONDecodeError:
                continue

    # Use robust brace matching for plain JSON objects
    json_objects = _extract_json_objects(cleaned_text)
    if json_objects:
        return json_objects[0]

    return {}


def parse_actions(response_text: str) -> list:
    """Parse actions from LLM response using JSON format.

    Returns [data] if "action" key present, else [].
    Maintains compatibility with existing code expecting list return.

    Args:
        response_text: Raw LLM response string

    Returns:
        List containing action dict, or empty list
    """
    data = parse_agent_response(response_text)
    if data and 'action' in data:
        return [data]
    return []
