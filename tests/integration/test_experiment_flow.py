"""End-to-end test of experiment creation and execution."""

import pytest
from socialsim4.core.scenarios import get_scenario
from socialsim4.core.agent.agent import Agent
from socialsim4.core.context_builder import build_context_summary


def test_prisoners_dilemma_end_to_end():
    """Test full flow: scenario -> agents -> prompt -> parse."""
    # Get scenario
    scenario = get_scenario("prisoners_dilemma")
    assert scenario is not None

    # Create mock action space
    from unittest.mock import Mock
    action_cooperate = Mock()
    action_cooperate.NAME = "Cooperate"
    action_cooperate.DESC = "Stay silent."
    action_cooperate.INSTRUCTION = ""
    action_defect = Mock()
    action_defect.NAME = "Defect"
    action_defect.DESC = "Betray your partner."
    action_defect.INSTRUCTION = ""

    # Create agent - requires style parameter
    agent = Agent(
        name="Participant 1",
        user_profile="Psychology Student",
        style="neutral",
        role_prompt="You are participating in a study.",
        action_space=[action_cooperate, action_defect],
    )

    # Build prompt - pass scenario as scene-like object with description
    class MockScene:
        def get_compact_description(self):
            return scenario["description"]

    prompt = agent.system_prompt(MockScene(), context_summary=None)

    # Verify prompt structure
    assert "Participant 1" in prompt
    assert "Psychology Student" in prompt
    assert scenario["description"] in prompt
    assert "Cooperate: Stay silent." in prompt
    assert "Defect: Betray your partner." in prompt
    assert '"action"' in prompt
    # Verify JSON format section is present
    assert "thoughts" in prompt
    assert "response" in prompt
    assert "context_update" in prompt

    # Simulate LLM response - parse_actions returns list containing full data dict
    from socialsim4.core.agent.parsing import parse_actions
    response = '{"action": "Cooperate"}'
    actions = parse_actions(response)
    assert len(actions) == 1
    assert actions[0]["action"] == "Cooperate"
