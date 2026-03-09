"""
Tests for game theory prompt builders.

Verifies that prompts correctly substitute custom action names,
descriptions, and resource names with i18n support.
"""

import pytest
from socialsim4.core.prompts.game_theory_prompts import (
    build_battle_of_the_sexes_prompt,
    build_stag_hunt_prompt,
    build_public_goods_prompt,
)


class TestBattleOfTheSexesPrompt:
    """Tests for Battle of the Sexes prompt builder."""

    def test_uses_default_action_names(self):
        """Should use Opera/Football when no custom names provided."""
        params = {}
        prompt = build_battle_of_the_sexes_prompt(params, language="en")
        assert "Opera" in prompt
        assert "Football" in prompt

    def test_uses_custom_action_names(self):
        """Should use custom names when provided."""
        params = {
            "action_1_name": "Communism",
            "action_1_description": "Collective ownership",
            "action_2_name": "Capitalism",
            "action_2_description": "Private ownership",
        }
        prompt = build_battle_of_the_sexes_prompt(params, language="en")
        assert "Communism" in prompt
        assert "Capitalism" in prompt
        assert "Collective ownership" in prompt
        assert "Private ownership" in prompt
        assert "Opera" not in prompt
        assert "Football" not in prompt

    def test_chinese_translation(self):
        """Should return Chinese prompt when language is zh."""
        params = {
            "action_1_name": "共产主义",
            "action_1_description": "支持资源的集体所有制",
            "action_2_name": "资本主义",
            "action_2_description": "支持资源的私有制",
        }
        prompt = build_battle_of_the_sexes_prompt(params, language="zh")
        assert "性别博弈" in prompt
        assert "共产主义" in prompt
        assert "资本主义" in prompt


class TestStagHuntPrompt:
    """Tests for Stag Hunt prompt builder."""

    def test_uses_default_action_names(self):
        """Should use Stag/Hare when no custom names provided."""
        params = {"stag_reward": 10, "hare_reward": 3}
        prompt = build_stag_hunt_prompt(params, language="en")
        assert "Stag" in prompt
        assert "Hare" in prompt

    def test_uses_custom_action_names(self):
        """Should use custom names when provided."""
        params = {
            "action_1_name": "Cooperate",
            "action_1_description": "Work together",
            "action_2_name": "Defect",
            "action_2_description": "Act alone",
            "stag_reward": 10,
            "hare_reward": 3,
        }
        prompt = build_stag_hunt_prompt(params, language="en")
        assert "Cooperate" in prompt
        assert "Defect" in prompt
        assert "Work together" in prompt
        assert "Act alone" in prompt

    def test_includes_payoff_values(self):
        """Should include payoff values in prompt."""
        params = {"stag_reward": 10, "hare_reward": 3}
        prompt = build_stag_hunt_prompt(params, language="en")
        assert "10" in prompt
        assert "3" in prompt


class TestPublicGoodsPrompt:
    """Tests for Public Goods prompt builder."""

    def test_uses_default_resource_name(self):
        """Should use Tokens when no custom name provided."""
        params = {"initial_amount": 20, "multiplier": 1.5}
        prompt = build_public_goods_prompt(params, language="en")
        assert "20" in prompt
        assert "tokens" in prompt.lower()

    def test_uses_custom_resource_name(self):
        """Should use custom resource name when provided."""
        params = {
            "resource_name": "Money",
            "initial_amount": 100,
            "multiplier": 2.0,
            "action_name": "Donate",
            "action_description": "Give money to the fund",
        }
        prompt = build_public_goods_prompt(params, language="en")
        assert "100" in prompt
        assert "money" in prompt.lower()
        assert "donate" in prompt.lower()  # Action name is lowercased for natural language flow

    def test_handles_custom_resource_option(self):
        """Should resolve Custom resource_name to resource_name_custom."""
        params = {
            "resource_name": "Custom",
            "resource_name_custom": "Carbon Credits",
            "initial_amount": 50,
            "multiplier": 1.5,
        }
        prompt = build_public_goods_prompt(params, language="en")
        assert "carbon credits" in prompt.lower()  # Resource is lowercased for natural language flow

    def test_includes_multiplier(self):
        """Should include multiplier in prompt."""
        params = {"initial_amount": 20, "multiplier": 2.0}
        prompt = build_public_goods_prompt(params, language="en")
        assert "2.0" in prompt or "2" in prompt
