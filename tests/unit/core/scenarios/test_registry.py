"""
Unit tests for scenario registry.

Tests scenario metadata and parameter definitions.
"""

from socialsim4.core.scenarios.registry import BATTLE_OF_THE_SEXES, STAG_HUNT, PUBLIC_GOODS


class TestBattleOfTheSexesParameters:
    """Tests for Battle of the Sexes scenario parameters."""

    def test_has_action_name_parameters(self):
        """Should have action_1_name and action_2_name parameters."""
        param_keys = [p["key"] for p in BATTLE_OF_THE_SEXES["parameters"]]
        assert "action_1_name" in param_keys
        assert "action_2_name" in param_keys

    def test_has_action_description_parameters(self):
        """Should have action description parameters."""
        param_keys = [p["key"] for p in BATTLE_OF_THE_SEXES["parameters"]]
        assert "action_1_description" in param_keys
        assert "action_2_description" in param_keys

    def test_action_defaults_match_hardcoded_actions(self):
        """Action parameter defaults should match the actions array."""
        params = {p["key"]: p["default"] for p in BATTLE_OF_THE_SEXES["parameters"]}
        assert params["action_1_name"] == "Opera"
        assert params["action_2_name"] == "Football"


class TestStagHuntParameters:
    """Tests for Stag Hunt scenario parameters."""

    def test_has_action_name_parameters(self):
        """Should have action_1_name and action_2_name parameters."""
        param_keys = [p["key"] for p in STAG_HUNT["parameters"]]
        assert "action_1_name" in param_keys
        assert "action_2_name" in param_keys

    def test_has_action_description_parameters(self):
        """Should have action description parameters."""
        param_keys = [p["key"] for p in STAG_HUNT["parameters"]]
        assert "action_1_description" in param_keys
        assert "action_2_description" in param_keys

    def test_action_defaults_match_hardcoded_actions(self):
        """Action parameter defaults should match the actions array."""
        params = {p["key"]: p["default"] for p in STAG_HUNT["parameters"]}
        assert params["action_1_name"] == "Stag"
        assert params["action_2_name"] == "Hare"


class TestPublicGoodsParameters:
    """Tests for Public Goods scenario parameters."""

    def test_has_resource_name_parameter(self):
        """Should have resource_name parameter."""
        param_keys = [p["key"] for p in PUBLIC_GOODS["parameters"]]
        assert "resource_name" in param_keys

    def test_has_custom_resource_parameter(self):
        """Should have resource_name_custom parameter."""
        param_keys = [p["key"] for p in PUBLIC_GOODS["parameters"]]
        assert "resource_name_custom" in param_keys

    def test_has_action_parameters(self):
        """Should have action name and description parameters."""
        param_keys = [p["key"] for p in PUBLIC_GOODS["parameters"]]
        assert "action_name" in param_keys
        assert "action_description" in param_keys

    def test_initial_amount_replaces_initial_tokens(self):
        """Should use initial_amount instead of initial_tokens."""
        param_keys = [p["key"] for p in PUBLIC_GOODS["parameters"]]
        assert "initial_amount" in param_keys
        assert "initial_tokens" not in param_keys
