"""
Agent response parsing utilities.

This module contains functions for parsing LLM responses into
structured data including thoughts, plans, actions, plan updates,
and emotion updates.

Contains:
    - parse_full_response: Extract all sections from LLM response
    - parse_emotion_update: Parse emotion from Emotion Update block
    - parse_plan_update: Parse plan update from XML-style tags
    - parse_actions: Parse Action XML block into action dict
    - parse_agent_response: Extract JSON from LLM output
"""

import json
import re
import xml.etree.ElementTree as ET


def parse_full_response(full_response: str) -> tuple:
    """
    Extracts thoughts, plan, action block, and optional plan/emotion updates from response.

    Parses a structured LLM response containing:
    - Thoughts section
    - Plan section
    - Action section
    - Optional Plan Update section
    - Optional Emotion Update section

    Args:
        full_response: Raw LLM response string

    Returns:
        Tuple of (thoughts, plan, action, plan_update_block, emotion_update_block)
        Each element is a string, empty if section not found
    """
    thoughts_match = re.search(
        r"--- Thoughts ---\s*(.*?)\s*--- Plan ---",
        full_response,
        re.DOTALL
    )
    plan_match = re.search(
        r"--- Plan ---\s*(.*?)\s*--- Action ---",
        full_response,
        re.DOTALL
    )
    action_match = re.search(
        r"--- Action ---\s*(.*?)(?:\n--- Plan Update ---|\Z)",
        full_response,
        re.DOTALL
    )
    plan_update_match = re.search(
        r"--- Plan Update ---\s*(.*?)(?:\n--- Emotion Update ---|\Z)",
        full_response,
        re.DOTALL
    )
    emotion_update_match = re.search(
        r"--- Emotion Update ---\s*(.*)$",
        full_response,
        re.DOTALL
    )

    thoughts = thoughts_match.group(1).strip() if thoughts_match else ""
    plan = plan_match.group(1).strip() if plan_match else ""
    action = action_match.group(1).strip() if action_match else ""
    plan_update_block = plan_update_match.group(1).strip() if plan_update_match else ""
    emotion_update_block = emotion_update_match.group(1).strip() if emotion_update_match else ""

    return thoughts, plan, action, plan_update_block, emotion_update_block


def parse_emotion_update(block: str) -> str | None:
    """
    Parse Emotion Update block.

    Returns the emotion string or None for 'no change'.

    Args:
        block: The Emotion Update block content

    Returns:
        Emotion string like "Joy", "Sadness", etc., or None if no change

    Examples:
        >>> parse_emotion_update("Joy")
        'Joy'
        >>> parse_emotion_update("no change")
        None
    """
    if not block:
        return None
    text = block.strip()
    if text.lower().startswith("no change"):
        return None
    return text


def _parse_numbered_lines(txt: str) -> list:
    """Parse numbered lines into a list of items.

    Args:
        txt: Text with numbered lines (e.g., "1. First item\\n2. Second item")

    Returns:
        List of item strings (without numbers)

    Raises:
        ValueError: If a line is malformed
    """
    if txt.strip() == "" or txt.strip().lower() == "(none)":
        return []
    items = []
    lines = [l.strip() for l in (txt or "").splitlines() if l.strip()]
    for l in lines:
        m = re.match(r"^(\d+)\.\s*(.*)$", l)
        if not m:
            raise ValueError("Malformed Plan Update list line: " + l)
        items.append(m.group(2).strip())
    return items


def parse_plan_update(block: str) -> dict | None:
    """
    Parse Plan Update block in strict tag format.

    Expects XML-style tags:
    <Goals>
        1. [CURRENT] Goal one
        2. Goal two
    </Goals>
    <Milestones>...</Milestones>
    <Strategy>...</Strategy>
    <Notes>...</Notes>

    Returns a plan_state dict or None for 'no change'.

    Args:
        block: Plan Update block content

    Returns:
        Dictionary with keys: goals, milestones, strategy, notes
        Each contains appropriate data structures

    Raises:
        ValueError: If unknown tag encountered
        ET.ParseError: If XML is malformed

    Examples:
        >>> result = parse_plan_update('''
        <Goals>
        1. First goal
        </Goals>
        ''')
        >>> result['goals'][0]['desc']
        'First goal'
    """
    if not block:
        return None
    text = block.strip()
    if text.lower().startswith("no change"):
        return None

    xml_text = "<Update>" + text + "</Update>"
    # Normalize bare ampersands so XML parser won't choke
    xml_text = re.sub(
        r"&(?!#\d+;|#x[0-9A-Fa-f]+;|[A-Za-z][A-Za-z0-9]*;)",
        "&amp;",
        xml_text,
    )

    root = ET.fromstring(xml_text)
    if root.tag != "Update":
        return None

    goals_el = None
    milestones_el = None
    strategy_el = None
    notes_el = None

    for child in list(root):
        t = child.tag
        if t == "Goals":
            goals_el = child
        elif t == "Milestones":
            milestones_el = child
        elif t == "Strategy":
            strategy_el = child
        elif t == "Notes":
            notes_el = child
        else:
            raise ValueError(f"Unknown Plan Update tag: {t}")

    result = {
        "goals": [],
        "milestones": [],
        "strategy": "",
        "notes": "",
    }

    # Parse goals
    if goals_el is not None:
        items = _parse_numbered_lines(goals_el.text or "")
        goals = []
        for i, desc in enumerate(items):
            is_cur = "[CURRENT]" in desc
            clean = desc.replace("[CURRENT]", "").strip()
            gid = f"g{i + 1}"
            goals.append({
                "id": gid,
                "desc": clean,
                "priority": "normal",
                "status": "current" if is_cur else "pending",
            })
        result["goals"] = goals

    # Parse milestones
    if milestones_el is not None:
        items = _parse_numbered_lines(milestones_el.text or "")
        ms = []
        for i, desc in enumerate(items):
            done = "[DONE]" in desc
            clean = desc.replace("[DONE]", "").strip()
            ms.append({
                "id": f"m{i + 1}",
                "desc": clean,
                "status": "done" if done else "pending",
            })
        result["milestones"] = ms

    # Parse strategy
    if strategy_el is not None:
        result["strategy"] = (strategy_el.text or "").strip()

    # Parse notes
    if notes_el is not None:
        result["notes"] = (notes_el.text or "").strip()

    return result


def parse_actions_xml(action_block: str) -> list:
    """
    Parse the Action XML block and returns a list of action dicts.

    Expected format:
        <Action name="send_message"><message>Hi</message></Action>
        <Action name="yield"></Action>
        <Action name="move"><direction>north</direction></Action>

    Args:
        action_block: The Action block content from LLM response

    Returns:
        List of dicts with keys: 'action' and child tags as top-level fields
        Returns empty list if no valid action found

    Examples:
        >>> result = parse_actions_xml('<Action name="test"><param>value</param></Action>')
        >>> result[0]['action']
        'test'
        >>> result[0]['param']
        'value'
    """
    if not action_block:
        return []

    text = action_block.strip()

    # Find Action tags
    m1 = re.search(r"<Action.*?>.*</Action>", text, re.DOTALL)
    m2 = re.search(r"<Action.*?/>", text, re.DOTALL)
    m = m1 or m2

    if m:
        text = m.group(0).strip()
    else:
        return []

    # Strip code fences
    if text.startswith("```xml") and text.endswith("```"):
        text = text[6:-3].strip()
    elif text.startswith("```") and text.endswith("```"):
        text = text[3:-3].strip()
    elif text.startswith("`") and text.endswith("`"):
        text = text.strip("`")
    text = text.strip("`")

    # Normalize bare ampersands
    text = re.sub(
        r"&(?!#\d+;|#x[0-9A-Fa-f]+;|[A-Za-z][A-Za-z0-9]*;)",
        "&amp;",
        text,
    )

    # Parse Action element
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        return []

    if root is None or root.tag.lower() != "action":
        return []

    name = root.attrib.get("name") or root.attrib.get("NAME")
    if not name:
        return []

    result = {"action": name}
    # Copy child elements as top-level params
    for child in list(root):
        tag = child.tag
        val = (child.text or "").strip()
        if tag and val is not None:
            result[tag] = val

    return [result]


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
