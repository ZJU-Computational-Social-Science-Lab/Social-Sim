"""
Unit tests for scenario registry.

Tests scenario metadata and parameter definitions.
"""

from socialsim4.core.scenarios.registry import BATTLE_OF_THE_SEXES


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
