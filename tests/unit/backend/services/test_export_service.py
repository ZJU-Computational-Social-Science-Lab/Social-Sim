"""Tests for export service."""
import pytest
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
