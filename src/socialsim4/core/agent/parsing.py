"""
Agent response parsing utilities.

This module provides functions for parsing LLM responses into
structured JSON data.

Contains:
    - parse_agent_response: Extract JSON from LLM output
    - parse_actions: Parse actions from JSON response
"""

import json
import re


def parse_agent_response(response_text: str) -> dict:
    """Extract the first valid JSON object from LLM output.

    Handles:
    - ```json ... ``` code fences
    - ``` ... ``` code fences
    - Plain JSON objects

    Returns {} if no valid JSON found.

    Args:
        response_text: Raw LLM response string

    Returns:
        Parsed JSON dict, or empty dict if parsing fails
    """
    if not response_text:
        return {}

    # Try code fences first
    fence_pattern = r'```(?:json)?\s*\n?(.*?)\n?```'
    matches = re.findall(fence_pattern, response_text, re.DOTALL)

    if matches:
        for match in matches:
            try:
                return json.loads(match.strip())
            except json.JSONDecodeError:
                continue

    # Try finding first {...} in text
    brace_pattern = r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}'
    matches = re.findall(brace_pattern, response_text, re.DOTALL)

    for match in matches:
        try:
            return json.loads(match)
        except json.JSONDecodeError:
            continue

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
