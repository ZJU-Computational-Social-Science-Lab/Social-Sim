"""
Export service for simulation data.

Handles transformation of simulation events into clean CSV/JSON export format
with scenario parameters and simplified log types.
"""
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
