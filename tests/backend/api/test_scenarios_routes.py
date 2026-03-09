"""Tests for scenarios API routes."""

import pytest
from litestar import testing
from socialsim4.backend.main import app


def test_get_scenarios_returns_list():
    """GET /scenarios should return list of scenarios."""
    response = testing.TestClient(app).get("/api/scenarios")
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    assert len(body) == 13


def test_get_scenarios_structure():
    """Each scenario should have required fields."""
    response = testing.TestClient(app).get("/api/scenarios")
    body = response.json()
    for scenario in body:
        assert "id" in scenario
        assert "name" in scenario
        assert "category" in scenario
        assert "description" in scenario
        assert "parameters" in scenario
        assert "actions" in scenario


def test_get_scenario_by_id():
    """GET /scenarios/{id} should return specific scenario."""
    response = testing.TestClient(app).get("/api/scenarios/prisoners_dilemma")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == "prisoners_dilemma"
    assert body["name"] == "Prisoner's Dilemma"


def test_get_scenario_not_found():
    """GET /scenarios/{id} should return 404 for invalid ID."""
    response = testing.TestClient(app).get("/api/scenarios/nonexistent")
    assert response.status_code == 404


def test_get_scenario_actions():
    """GET /scenarios/{id}/actions should return actions only."""
    response = testing.TestClient(app).get("/api/scenarios/prisoners_dilemma/actions")
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    assert len(body) == 2
    assert body[0]["name"] == "Cooperate"


def test_get_scenario_actions_not_found():
    """GET /scenarios/{id}/actions should return empty list for invalid ID."""
    response = testing.TestClient(app).get("/api/scenarios/nonexistent/actions")
    assert response.status_code == 200
    body = response.json()
    assert body == []


def test_get_all_includes_sociology():
    """GET /scenarios should include sociology scenarios."""
    response = testing.TestClient(app).get("/api/scenarios")
    assert response.status_code == 200
    body = response.json()
    sociology_scenarios = [s for s in body if s.get("category") == "sociology"]
    assert len(sociology_scenarios) > 0, "Should have at least one sociology scenario"


def test_all_scenarios_have_interaction_mode():
    """All scenarios should have a valid interaction_mode field."""
    valid_modes = {"simultaneous", "sequential", "random", "paired"}
    response = testing.TestClient(app).get("/api/scenarios")
    assert response.status_code == 200
    body = response.json()

    for scenario in body:
        # All scenarios should have interaction_mode
        assert "interaction_mode" in scenario, \
            f"Scenario {scenario.get('id')} missing interaction_mode"
        # interaction_mode should be a valid value
        assert scenario["interaction_mode"] in valid_modes, \
            f"Scenario {scenario.get('id')} has invalid interaction_mode: {scenario['interaction_mode']}"


def test_defaults_subset_of_category_actions():
    """Scenario default actions should be a subset of category actions."""
    from socialsim4.core.scenarios.actions import CATEGORY_ACTION_LIBRARIES

    response = testing.TestClient(app).get("/api/scenarios")
    assert response.status_code == 200
    body = response.json()

    for scenario in body:
        if "default_action_ids" in scenario and scenario["default_action_ids"]:
            category = scenario.get("category", "")
            if category in CATEGORY_ACTION_LIBRARIES:
                category_actions = CATEGORY_ACTION_LIBRARIES[category]
                category_action_ids = {a["id"] for a in category_actions}
                for action_id in scenario["default_action_ids"]:
                    assert action_id in category_action_ids, \
                        f"Scenario {scenario['id']} default action {action_id} not in category {category}"
