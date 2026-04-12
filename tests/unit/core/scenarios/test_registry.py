"""
Unit tests for scenario registry.

Tests scenario metadata and parameter definitions.
"""

from socialsim4.core.scenarios.registry import (
    BATTLE_OF_THE_SEXES,
    STAG_HUNT,
    PUBLIC_GOODS,
    XIHU_YILIANBAO,
)


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

    def test_has_tokens_per_round_parameter(self):
        """Should expose tokens_per_round in the registry."""
        param_keys = [p["key"] for p in PUBLIC_GOODS["parameters"]]
        assert "tokens_per_round" in param_keys

    def test_has_multiplier_parameter(self):
        """Should expose multiplier for pooled returns."""
        param_keys = [p["key"] for p in PUBLIC_GOODS["parameters"]]
        assert "multiplier" in param_keys

    def test_tokens_per_round_replaces_initial_tokens(self):
        """Current registry uses tokens_per_round instead of initial_tokens."""
        param_keys = [p["key"] for p in PUBLIC_GOODS["parameters"]]
        assert "tokens_per_round" in param_keys
        assert "initial_tokens" not in param_keys


class TestXihuYilianbaoParameters:
    """Tests for Xihu Yilianbao scenario parameters."""

    def test_has_intervention_arm_parameter(self):
        param_keys = [p["key"] for p in XIHU_YILIANBAO["parameters"]]
        assert "intervention_arm" in param_keys

    def test_has_deadline_and_account_cues(self):
        param_keys = [p["key"] for p in XIHU_YILIANBAO["parameters"]]
        assert "personal_account_cue" in param_keys
        assert "deadline_cue" in param_keys

    def test_defaults_include_a0_to_a8_logic(self):
        intervention_param = next(
            param for param in XIHU_YILIANBAO["parameters"]
            if param["key"] == "intervention_arm"
        )
        assert intervention_param["default"] == "A2 简明图文"
        assert len(intervention_param["options"]) == 9
    def test_pgg_deduction_params(self):
        """Should have all three deduction parameters."""
        param_keys = [p["key"] for p in PUBLIC_GOODS["parameters"]]
        assert "deduction_budget_per_phase" in param_keys
        assert "deduction_cost_ratio" in param_keys
        assert "deduction_anonymous" in param_keys

    def test_pgg_deduction_cost_ratio_default(self):
        """Should have cost_ratio default to 3.0."""
        params = {p["key"]: p["default"] for p in PUBLIC_GOODS["parameters"]}
        assert params["deduction_cost_ratio"] == 3.0

    def test_pgg_deduction_budget_param(self):
        """Should have deduction_budget_per_phase default to 0."""
        params = {p["key"]: p["default"] for p in PUBLIC_GOODS["parameters"]}
        assert params["deduction_budget_per_phase"] == 0

    def test_pgg_deduction_anonymous_param(self):
        """Should have deduction_anonymous default to False."""
        params = {p["key"]: p["default"] for p in PUBLIC_GOODS["parameters"]}
        assert params["deduction_anonymous"] is False

    def test_pgg_deduction_category(self):
        """All deduction parameters should have category='deduction'."""
        deduction_params = [
            p for p in PUBLIC_GOODS["parameters"]
            if p["key"].startswith("deduction_")
        ]
        for param in deduction_params:
            assert param.get("category") == "deduction", (
                f"{param['key']} should have category='deduction'"
            )
