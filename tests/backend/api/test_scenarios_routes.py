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
