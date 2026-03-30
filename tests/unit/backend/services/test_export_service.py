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
