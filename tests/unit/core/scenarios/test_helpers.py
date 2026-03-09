"""
Tests for scenario helper functions.

Tests name resolution and fallback logic for custom action/resource names.
"""

import pytest
from socialsim4.core.scenarios.helpers import get_action_config, get_resource_name


class TestGetActionConfig:
    """Tests for get_action_config helper."""

    def test_returns_custom_name_when_present(self):
        """Should return custom name when provided."""
        params = {"action_1_name": "Communism", "action_1_description": "Collective ownership"}
        result = get_action_config(params, 1)
        assert result["name"] == "Communism"
        assert result["description"] == "Collective ownership"

    def test_falls_back_to_default_name(self):
        """Should fall back to default when custom name missing."""
        params = {}
        result = get_action_config(params, 1)
        assert result["name"] == "Action 1"
        assert result["description"] == ""

    def test_handles_action_2(self):
        """Should work for action index 2."""
        params = {"action_2_name": "Capitalism", "action_2_description": "Private ownership"}
        result = get_action_config(params, 2)
        assert result["name"] == "Capitalism"
        assert result["description"] == "Private ownership"

    def test_empty_string_uses_fallback(self):
        """Empty string should trigger fallback."""
        params = {"action_1_name": "", "action_1_description": ""}
        result = get_action_config(params, 1)
        assert result["name"] == "Action 1"
        assert result["description"] == ""


class TestGetResourceName:
    """Tests for get_resource_name helper."""

    def test_returns_custom_resource_name(self):
        """Should return resource name when provided."""
        params = {"resource_name": "Money"}
        result = get_resource_name(params)
        assert result == "Money"

    def test_defaults_to_tokens(self):
        """Should default to Tokens when not provided."""
        params = {}
        result = get_resource_name(params)
        assert result == "Tokens"

    def test_handles_custom_option(self):
        """Should return custom resource when Custom is selected."""
        params = {"resource_name": "Custom", "resource_name_custom": "Carbon Credits"}
        result = get_resource_name(params)
        assert result == "Carbon Credits"

    def test_custom_falls_back_to_tokens(self):
        """Should fall back to Tokens if custom not provided."""
        params = {"resource_name": "Custom"}
        result = get_resource_name(params)
        assert result == "Tokens"
