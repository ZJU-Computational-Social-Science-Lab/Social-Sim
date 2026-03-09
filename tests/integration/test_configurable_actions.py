"""
Integration tests for configurable scenario actions.

Tests the full flow from UI configuration to agent prompts to logs.
"""

import pytest
from socialsim4.core.prompts.prompt_dispatcher import build_prompt
from socialsim4.core.simulation.logs import format_action_log


class TestEndToEndConfigurableActions:
    """Tests for complete configurable actions flow."""

    def test_battle_of_the_sexes_full_flow(self):
        """Should flow custom names from params to prompt to log."""
        # 1. Configure custom actions
        scenario_params = {
            "action_1_name": "Communism",
            "action_1_description": "Support collective ownership",
            "action_2_name": "Capitalism",
            "action_2_description": "Support private ownership",
        }

        # 2. Build agent prompt
        prompt = build_prompt("battle_of_the_sexes", scenario_params, language="en")
        assert prompt is not None
        assert "Communism" in prompt
        assert "Capitalism" in prompt
        assert "collective ownership" in prompt
        assert "Opera" not in prompt

        # 3. Format log message
        log = format_action_log(
            agent_name="Alice",
            action="Communism",
            scenario_id="battle_of_the_sexes",
            scenario_params=scenario_params,
            language="en",
        )
        assert "Alice" in log
        assert "Communism" in log

    def test_public_goods_full_flow(self):
        """Should flow custom resource name from params to prompt to log."""
        # 1. Configure custom resource
        scenario_params = {
            "resource_name": "Money",
            "initial_amount": 100,
            "multiplier": 2.0,
            "action_name": "Donate",
        }

        # 2. Build agent prompt
        prompt = build_prompt("public_goods", scenario_params, language="en")
        assert prompt is not None
        assert "100" in prompt
        assert "money" in prompt.lower()
        assert "donate" in prompt.lower()

        # 3. Format log message
        log = format_action_log(
            agent_name="Bob",
            action="contribute",
            amount=50,
            scenario_id="public_goods",
            scenario_params=scenario_params,
            language="en",
        )
        assert "Bob" in log
        assert "50" in log
        assert "money" in log.lower()

    def test_chinese_localization_flow(self):
        """Should localize prompts and logs to Chinese."""
        scenario_params = {
            "action_1_name": "共产主义",
            "action_2_name": "资本主义",
        }

        # Chinese prompt
        prompt = build_prompt("battle_of_the_sexes", scenario_params, language="zh")
        assert "性别博弈" in prompt

        # Chinese log
        log = format_action_log(
            agent_name="张三",
            action="共产主义",
            scenario_id="battle_of_the_sexes",
            scenario_params=scenario_params,
            language="zh",
        )
        assert "张三" in log
        assert "共产主义" in log

    def test_stag_hunt_with_custom_names(self):
        """Should use custom names in stag hunt prompts."""
        scenario_params = {
            "action_1_name": "Collaborate",
            "action_1_description": "Work together for big reward",
            "action_2_name": "Go Solo",
            "action_2_description": "Safe individual effort",
            "stag_reward": 15,
            "hare_reward": 4,
        }

        prompt = build_prompt("stag_hunt", scenario_params, language="en")
        assert prompt is not None
        assert "Collaborate" in prompt
        assert "Go Solo" in prompt
        assert "15" in prompt
        assert "4" in prompt
