"""
Tests for scenario registry functions.

Tests bug fixes and correct behavior of registry functions.
"""

import pytest
from socialsim4.core.scenarios.registry import get_all_scenarios, ALL_SCENARIOS


class TestScenarioRegistry:
    """Test scenario registry functions."""

    def test_get_all_scenarios_does_not_mutate_original(self):
        """Calling get_all_scenarios() should not mutate ALL_SCENARIOS."""
        # Find a sociology scenario before calling get_all_scenarios
        sociology_scenario = None
        for scenario in ALL_SCENARIOS:
            if scenario.get("category_actions") == "sociology":
                sociology_scenario = scenario
                break

        if sociology_scenario is None:
            pytest.skip("No sociology scenarios found")

        # Record the original type
        original_type = type(sociology_scenario["category_actions"]).__name__
        assert original_type == "str", f"Expected str, got {original_type}"

        # Call get_all_scenarios - this might mutate if bug exists
        _ = get_all_scenarios()

        # Check that the original scenario wasn't mutated
        after_type = type(sociology_scenario["category_actions"]).__name__
        assert after_type == "str", \
            f"Scenario was mutated from str to {after_type}!"
