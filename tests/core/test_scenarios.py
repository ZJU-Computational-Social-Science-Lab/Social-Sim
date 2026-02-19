"""Tests for core.scenarios module."""

import pytest
from socialsim4.core.scenarios import (
    get_all_scenarios,
    get_scenario,
    get_scenario_actions
)


def test_get_all_returns_list():
    """Should return a list of scenarios."""
    result = get_all_scenarios()
    assert isinstance(result, list)


def test_get_all_contains_expected_count():
    """Should return exactly 14 scenarios."""
    result = get_all_scenarios()
    assert len(result) == 14


def test_all_scenarios_have_required_fields():
    """Every scenario should have id, name, category, description, parameters, actions."""
    result = get_all_scenarios()
    for scenario in result:
        assert "id" in scenario
        assert "name" in scenario
        assert "category" in scenario
        assert "description" in scenario
        assert "parameters" in scenario
        assert "actions" in scenario


def test_get_scenario_by_id():
    """Should return specific scenario."""
    result = get_scenario("prisoners_dilemma")
    assert result is not None
    assert result["id"] == "prisoners_dilemma"
    assert result["name"] == "Prisoner's Dilemma"


def test_get_scenario_invalid_id_returns_none():
    """Should return None for invalid scenario ID."""
    result = get_scenario("nonexistent_scenario")
    assert result is None


def test_get_scenario_actions():
    """Should return only actions for a scenario."""
    result = get_scenario_actions("prisoners_dilemma")
    assert isinstance(result, list)
    assert len(result) == 2
    assert result[0]["name"] == "Cooperate"
    assert result[1]["name"] == "Defect"


def test_get_scenario_actions_invalid_id():
    """Should return empty list for invalid scenario."""
    result = get_scenario_actions("invalid")
    assert result == []


def test_prisoners_dilemma_structure():
    """Prisoner's Dilemma should have correct structure."""
    scenario = get_scenario("prisoners_dilemma")
    assert scenario["category"] == "game_theory"
    assert len(scenario["parameters"]) == 3
    assert len(scenario["actions"]) == 2


def test_custom_scenario_empty_actions():
    """Custom scenario should have empty actions list."""
    scenario = get_scenario("custom")
    assert scenario["actions"] == []


def test_all_scenario_ids_unique():
    """All scenario IDs should be unique."""
    scenarios = get_all_scenarios()
    ids = [s["id"] for s in scenarios]
    assert len(ids) == len(set(ids))
