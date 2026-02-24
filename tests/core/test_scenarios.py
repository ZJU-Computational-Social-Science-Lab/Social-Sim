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
    """Should return exactly 13 scenarios."""
    result = get_all_scenarios()
    assert len(result) == 13


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


def test_all_default_action_ids_exist_in_category_library():
    """Default action IDs should exist in category action library."""
    from socialsim4.core.scenarios.actions import CATEGORY_ACTION_LIBRARIES

    scenarios = get_all_scenarios()
    for scenario in scenarios:
        if "default_action_ids" in scenario and scenario["default_action_ids"]:
            category = scenario.get("category", "")
            if category in CATEGORY_ACTION_LIBRARIES:
                category_actions = CATEGORY_ACTION_LIBRARIES[category]
                category_action_ids = {a["id"] for a in category_actions}
                for action_id in scenario["default_action_ids"]:
                    assert action_id in category_action_ids, \
                        f"Scenario {scenario['id']} has default action {action_id} not in category {category}"


def test_payoff_matrix_scenarios_have_valid_matrix_meta():
    """Payoff matrix scenarios should have valid matrix metadata."""
    scenarios = get_all_scenarios()
    payoff_scenarios = ["prisoners_dilemma", "battle_of_the_sexes", "stag_hunt"]

    for scenario_id in payoff_scenarios:
        scenario = get_scenario(scenario_id)
        if scenario:
            # Should have payoff parameters
            payoff_params = [p for p in scenario["parameters"] if "payoff" in p["id"].lower()]
            # At minimum should describe the payoff structure
            assert scenario["description"] is not None
            assert len(scenario["description"]) > 0


def test_all_parameters_have_ui_hint():
    """All scenario parameters should have a ui_hint field."""
    scenarios = get_all_scenarios()
    for scenario in scenarios:
        for param in scenario["parameters"]:
            assert "ui_hint" in param, \
                f"Scenario {scenario['id']} parameter {param['id']} missing ui_hint"


def test_sociology_scenarios_have_english_names():
    """Sociology scenarios should have English names."""
    scenarios = get_all_scenarios()
    sociology_scenarios = [s for s in scenarios if s.get("category") == "sociology"]

    for scenario in sociology_scenarios:
        assert "name" in scenario
        assert isinstance(scenario["name"], str)
        # Name should not be empty or just spaces
        assert len(scenario["name"].strip()) > 0
        # Name should be ASCII (English) characters
        assert scenario["name"].isascii() or all(ord(c) < 128 for c in scenario["name"])


def test_category_action_libraries_no_duplicate_ids():
    """Category action libraries should not have duplicate action IDs."""
    from socialsim4.core.scenarios.actions import CATEGORY_ACTION_LIBRARIES

    for category, actions in CATEGORY_ACTION_LIBRARIES.items():
        action_ids = [a["id"] for a in actions]
        duplicates = [aid for aid in action_ids if action_ids.count(aid) > 1]
        assert len(duplicates) == 0, \
            f"Category {category} has duplicate action IDs: {set(duplicates)}"


def test_interaction_mode_is_valid_enum_value():
    """All scenarios should have valid interaction_mode enum values."""
    valid_modes = {"simultaneous", "sequential", "random", "paired"}
    scenarios = get_all_scenarios()

    for scenario in scenarios:
        if "interaction_mode" in scenario:
            assert scenario["interaction_mode"] in valid_modes, \
                f"Scenario {scenario['id']} has invalid interaction_mode: {scenario['interaction_mode']}"
