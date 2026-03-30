"""Tests for export service."""
import pytest
from datetime import datetime
from socialsim4.backend.services.export_service import generate_export_filename


def test_generate_export_filename_csv():
    """Test filename generation for CSV format."""
    result = generate_export_filename("public_goods", "csv")
    # Pattern: Scenario_public_goods_YYYY_MM_DD_HH_MM.csv
    assert result.startswith("Scenario_public_goods_")
    assert result.endswith(".csv")
    assert len(result.split("_")) >= 7  # At least: Scenario, id, YYYY, MM, DD, HH, MM


def test_simplify_log_type_agent_action():
    """Test type simplification for agent actions."""
    from socialsim4.backend.services.export_service import simplify_log_type

    assert simplify_log_type("AGENT_SAY") == "AGENT_ACTION"
    assert simplify_log_type("AGENT_ACTION") == "AGENT_ACTION"


def test_simplify_log_type_system():
    """Test type simplification for system events."""
    from socialsim4.backend.services.export_service import simplify_log_type

    assert simplify_log_type("ENVIRONMENT") == "SYSTEM"
    assert simplify_log_type("SYSTEM") == "SYSTEM"
    assert simplify_log_type("AGENT_METADATA") == "SYSTEM"


def test_extract_action_and_follow_up_allocate():
    """Test extracting action and follow-up from allocate action."""
    from socialsim4.backend.services.export_service import extract_action_and_follow_up

    event = {
        "event_type": "action_end",
        "data": {
            "action": {"name": "allocate", "parameters": {"amount": 12}}
        }
    }
    action, follow_up = extract_action_and_follow_up(event)
    assert action == "allocate"
    assert follow_up == "12"


def test_extract_action_and_follow_up_deduct():
    """Test extracting action and follow-up with multiple parameters."""
    from socialsim4.backend.services.export_service import extract_action_and_follow_up

    event = {
        "event_type": "action_end",
        "data": {
            "action": {"name": "deduct", "parameters": {"target": "Agent 2", "amount": 3}}
        }
    }
    action, follow_up = extract_action_and_follow_up(event)
    assert action == "deduct"
    assert follow_up == "Agent 2; 3"


def test_transform_event_for_export():
    """Test transforming a log event into export format."""
    from socialsim4.backend.services.export_service import transform_event_for_export

    event = {
        "sequence": 1,
        "tree_node_id": 5,
        "event_type": "AGENT_ACTION",
        "payload": {
            "action": {"name": "allocate", "parameters": {"amount": 12}},
            "agent": "Agent 1"
        },
        "created_at": datetime(2026, 3, 30, 14, 30, 0)
    }

    scenario_params = {
        "tokens_per_round": 10,
        "multiplier": 1.3
    }

    result = transform_event_for_export(event, scenario_params)

    assert result["sequence"] == 1
    assert result["node_id"] == "5"
    assert result["agent_id"] == "Agent 1"
    assert result["type"] == "AGENT_ACTION"
    assert result["action"] == "allocate"
    assert result["follow_up"] == "12"
    assert result["tokens_per_round"] == 10
    assert result["multiplier"] == 1.3
