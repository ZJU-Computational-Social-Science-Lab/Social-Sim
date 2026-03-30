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
    if event_type in ("AGENT_SAY", "AGENT_ACTION"):
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
    action_data = data.get("action", {})

    action_name = action_data.get("name", "")
    parameters = action_data.get("parameters", {})

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
    result = {
        "sequence": event.get("sequence"),
        "timestamp": event.get("created_at", "").isoformat() if hasattr(event.get("created_at", ""), "isoformat") else str(event.get("created_at", "")),
        "node_id": str(event.get("tree_node_id", "")),
        "round": payload.get("round", event.get("round", "")),
        "agent_id": payload.get("agent", ""),
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
