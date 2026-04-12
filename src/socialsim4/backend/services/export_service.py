"""
Export service for simulation data.

Handles transformation of simulation events into clean CSV/JSON export format
with scenario parameters and simplified log types.
"""
import csv
import io
import json
from datetime import datetime


def generate_export_filename(scenario_id: str, format: str) -> str:
    """Generate export filename with scenario ID and timestamp.

    Args:
        scenario_id: Scenario identifier (e.g., "public_goods")
        format: Export format ("csv" or "json")

    Returns:
        Filename like "Scenario_public_goods_2026_03_30_1430.csv"
    """
    now = datetime.now()
    date_str = now.strftime("%Y_%m_%d")
    time_str = now.strftime("%H_%M")
    return f"Scenario_{scenario_id}_{date_str}_{time_str}.{format}"


def simplify_log_type(event_type: str) -> str:
    """Simplify log types to AGENT_ACTION or SYSTEM.

    Args:
        event_type: Original event type from logs

    Returns:
        Simplified type: "AGENT_ACTION" or "SYSTEM"
    """
    # Agent-related action types
    if event_type in ("AGENT_SAY", "AGENT_ACTION", "experiment_action", "agent_action"):
        return "AGENT_ACTION"
    return "SYSTEM"


def extract_action_and_follow_up(event: dict) -> tuple[str, str]:
    """Extract action name and follow-up value from event.

    Args:
        event: Event dictionary with action data

    Returns:
        Tuple of (action_name, follow_up_value)
        follow_up_value is semicolon-separated for multiple params
    """
    data = event.get("data", {})

    # Handle multiple formats:
    # 1. Nested action: data = {"action": {"name": "allocate", "parameters": {...}}}
    # 2. Direct action: data = {"action": "allocate", "parameters": {...}}
    # 3. Direct fields: data = {"agent": "Agent 1", "action": "allocate", ...}
    action_field = data.get("action")

    if isinstance(action_field, dict):
        # Nested action format
        action_name = action_field.get("name", "")
        parameters = action_field.get("parameters", {})
    elif isinstance(action_field, str):
        # Direct action string
        action_name = action_field
        parameters = data.get("parameters", {})
    else:
        action_name = ""
        parameters = {}

    if not parameters:
        return (action_name, "")

    # Extract parameter values, semicolon-separated
    values = [str(v) for v in parameters.values()]
    follow_up = "; ".join(values)

    return (action_name, follow_up)


def transform_event_for_export(event: dict, scenario_params: dict) -> dict:
    """Transform a log event into export format with scenario params.

    Args:
        event: Log event dictionary
        scenario_params: Scenario parameters to include in export

    Returns:
        Dictionary with export columns
    """
    payload = event.get("payload", {})

    # Extract basic fields
    # Normalize agent_id to lowercase with underscores (e.g., "Agent 1" -> "agent_1")
    # This ensures consistent merging with agent demographic data
    raw_agent_id = payload.get("agent", "")
    normalized_agent_id = raw_agent_id.lower().replace(" ", "_") if raw_agent_id else ""

    result = {
        "sequence": event.get("sequence"),
        "timestamp": event.get("created_at").isoformat() if hasattr(event.get("created_at"), "isoformat") else (str(event.get("created_at")) if event.get("created_at") is not None else ""),
        "node_id": str(event.get("tree_node_id", "")),
        "round": payload.get("round", event.get("round", "")),
        "agent_id": normalized_agent_id,
        "type": simplify_log_type(event.get("event_type", "SYSTEM")),
    }

    # extract_action_and_follow_up expects {"data": <action-containing-dict>}
    # payload is the event's payload, which contains the "action" key at top level
    action, follow_up = extract_action_and_follow_up({"data": payload})
    result["action"] = action
    result["follow_up"] = follow_up

    # Add scenario parameters
    result.update(scenario_params)

    return result


def deduplicate_events(events: list[dict]) -> list[dict]:
    """Deduplicate events that appear in multiple tree nodes due to log inheritance.

    When child nodes are created, they inherit all parent logs. This causes
    the same event to appear in multiple nodes. We deduplicate based on
    the actual event content (agent, round, action, parameters).

    Args:
        events: List of transformed events (output from transform_event_for_export)

    Returns:
        Deduplicated list of events, keeping the first occurrence
    """
    seen = set()
    deduplicated = []

    for event in events:
        # Create a deduplication key based on meaningful event content
        # We exclude node_id, sequence, and timestamp as these differ across nodes
        key = (
            event.get("round"),
            event.get("agent_id"),
            event.get("type"),
            event.get("action"),
            event.get("follow_up"),
        )

        if key not in seen:
            seen.add(key)
            deduplicated.append(event)

    return deduplicated


def export_events(events: list[dict], scenario_params: dict, format: str) -> str:
    """Export events to CSV or JSON format.

    Args:
        events: List of log events
        scenario_params: Scenario parameters to include
        format: "csv" or "json"

    Returns:
        Formatted export content
    """
    transformed = [transform_event_for_export(e, scenario_params) for e in events]

    # Deduplicate events that appear in multiple tree nodes
    transformed = deduplicate_events(transformed)

    if format == "json":
        return json.dumps(transformed, indent=2, default=str)

    # CSV format
    if not transformed:
        # Return header row only, using scenario params as column reference
        output = io.StringIO()
        base_cols = ["timestamp", "node_id", "round", "agent_id", "type", "action", "follow_up"]
        fieldnames = base_cols + list(scenario_params.keys())
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        return output.getvalue()

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=transformed[0].keys())
    writer.writeheader()
    writer.writerows(transformed)

    return output.getvalue()
