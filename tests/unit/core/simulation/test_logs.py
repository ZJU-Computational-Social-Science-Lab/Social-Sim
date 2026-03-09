"""
Tests for simulation log formatting.

Verifies that log messages correctly display custom action names
and resource names with i18n support.
"""

import pytest
from socialsim4.core.simulation.logs import format_action_log


class TestCustomActionNames:
    """Tests for log messages with custom action names."""

    def test_log_uses_custom_action_name_battle_of_the_sexes(self):
        """Should use custom action names in log messages."""
        scenario_params = {
            "action_1_name": "Communism",
            "action_2_name": "Capitalism",
        }
        log = format_action_log(
            agent_name="Alice",
            action="Communism",
            scenario_id="battle_of_the_sexes",
            scenario_params=scenario_params,
            language="en",
        )
        assert "Alice" in log
        assert "Communism" in log

    def test_log_uses_custom_resource_name_public_goods(self):
        """Should use custom resource name in log messages."""
        scenario_params = {
            "resource_name": "Money",
            "action_name": "Donate",
        }
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

    def test_log_supports_chinese(self):
        """Should format log in Chinese when language is zh."""
        scenario_params = {
            "action_1_name": "共产主义",
        }
        log = format_action_log(
            agent_name="张三",
            action="共产主义",
            scenario_id="battle_of_the_sexes",
            scenario_params=scenario_params,
            language="zh",
        )
        assert "张三" in log
        assert "共产主义" in log

    def test_log_default_action_format(self):
        """Should use default format for non-public_goods scenarios."""
        log = format_action_log(
            agent_name="Alice",
            action="Cooperate",
            scenario_id="prisoners_dilemma",
            scenario_params={},
            language="en",
        )
        assert "Alice" in log
        assert "Cooperate" in log
