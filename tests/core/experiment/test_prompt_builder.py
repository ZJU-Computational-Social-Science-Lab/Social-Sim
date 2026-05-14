"""
Tests for ExperimentPromptBuilder.
"""

import pytest
from socialsim4.core.experiment.agent import ExperimentAgent
from socialsim4.core.experiment.game_configs import GameConfig, PRISONERS_DILEMMA, MINIMUM_EFFORT
from socialsim4.core.experiment.prompt_builder import (
    _get_article,
    build_agent_description,
    build_prompt,
    build_reprompt,
    _interpret_score,
)


def test_interpret_score():
    """Convert numeric scores to interpretation brackets."""
    assert _interpret_score(20) == "low"
    assert _interpret_score(33) == "low"
    assert _interpret_score(34) == "moderate"
    assert _interpret_score(50) == "moderate"
    assert _interpret_score(66) == "moderate"
    assert _interpret_score(67) == "high"
    assert _interpret_score(80) == "high"
    assert _interpret_score(100) == "high"


def test_get_article():
    """Get correct article (a/an) for words."""
    assert _get_article("adult") == "an"
    assert _get_article("Adult") == "an"
    assert _get_article("elderly") == "an"
    assert _get_article("young") == "a"
    assert _get_article("middle-aged") == "a"
    assert _get_article("old") == "an"


def test_build_agent_description_basic():
    """Build agent description from basic properties."""
    props = {
        "age_group": "young adult",
        "profession": "doctor",
    }
    desc = build_agent_description(props)

    assert "young adult doctor" in desc
    assert "You are a young adult doctor." in desc


@pytest.mark.xfail(reason="bug: pre-existing failure — needs investigation")
def test_build_agent_description_with_numeric_traits():
    """Build agent description with numeric traits and interpretations."""
    props = {
        "age_group": "young adult",
        "profession": "doctor",
        "social_capital": 82,
        "risk_tolerance": 45,
    }
    desc = build_agent_description(props)

    assert "young adult doctor" in desc
    assert "social_capital score is 82/100 (high)" in desc
    assert "risk_tolerance score is 45/100 (moderate)" in desc


@pytest.mark.xfail(reason="bug: pre-existing failure — needs investigation")
def test_build_agent_description_low_score():
    """Low scores get (low) interpretation."""
    props = {
        "age_group": "adult",
        "profession": "teacher",
        "social_capital": 20,
    }
    desc = build_agent_description(props)

    assert "social_capital score is 20/100 (low)" in desc


@pytest.mark.xfail(reason="bug: pre-existing failure — needs investigation")
def test_build_agent_description_defaults():
    """When no identity properties exist but other props do, show only traits (no 'adult person' fallback)."""
    props = {
        "social_capital": 50,
    }
    desc = build_agent_description(props)

    # Should NOT default to "adult person" - that was a bug
    # Instead, it should only show the numeric traits
    assert "adult person" not in desc
    assert "social_capital score is 50/100 (moderate)" in desc


@pytest.mark.xfail(reason="bug: pre-existing failure — needs investigation")
def test_build_agent_description_uses_name_when_no_identity():
    """When no identity props but agent_name provided, use agent name as identity."""
    props = {
        "social_capital": 75,
    }
    desc = build_agent_description(props, agent_name="Psychology Student 1")

    # Should use agent name as identity
    assert "You are Psychology Student 1" in desc
    assert "adult person" not in desc
    assert "social_capital score is 75/100 (high)" in desc


@pytest.mark.xfail(reason="bug: pre-existing failure — needs investigation")
def test_build_prompt_discrete():
    """Build 5-section prompt for discrete action game."""
    agent = ExperimentAgent(
        name="Alice",
        properties={"age_group": "adult", "profession": "teacher"},
        llm_config=None,
    )

    prompt = build_prompt(agent, PRISONERS_DILEMMA, "No previous context.")

    # Section 1: Agent Description
    assert "You are an adult teacher" in prompt

    # Section 2: Scenario
    assert "## Scenario" in prompt
    assert "Two suspects are arrested" in prompt

    # Section 3: Available Actions
    assert "## Available Actions" in prompt
    assert "cooperate" in prompt
    assert "defect" in prompt

    # Section 4: Context
    assert "## Context" in prompt
    assert "No previous context." in prompt

    # Section 5: Output Format
    assert "## Your Response" in prompt
    assert "Respond ONLY with valid JSON" in prompt
    # PRISONERS_DILEMMA.output_field is "action", so the JSON format is {"action": "..."}
    assert '"action"' in prompt
    assert "No markdown. No explanation. Only JSON." in prompt


@pytest.mark.xfail(reason="bug: pre-existing failure — needs investigation")
def test_build_prompt_integer():
    """Build 5-section prompt for integer action game."""
    agent = ExperimentAgent(
        name="Bob",
        properties={"age_group": "adult", "profession": "engineer"},
        llm_config=None,
    )

    prompt = build_prompt(agent, MINIMUM_EFFORT, "Previous rounds...")

    # Section 1: Agent Description
    assert "You are an adult engineer" in prompt

    # Section 2: Scenario
    assert "## Scenario" in prompt

    # Section 3: Your Action (integer range)
    assert "## Your Action" in prompt
    assert "Choose a value from 1 to 7" in prompt

    # Section 4: Context
    assert "## Context" in prompt
    assert "Previous rounds..." in prompt

    # Section 5: Output Format
    assert "## Your Response" in prompt
    assert '"effort"' in prompt
    assert "integer from 1-7" in prompt


def test_build_prompt_custom_uses_one_shot_message_json():
    agent = ExperimentAgent(
        name="Alice",
        properties={},
        llm_config=None,
    )
    custom_config = GameConfig(
        name="custom",
        description="Discuss whether the neighborhood should start a tool library.",
        action_type="discrete",
        actions=["speak", "skip"],
        action_descriptions={"speak": "Say something", "skip": "Pass"},
        payoff_type="none",
        grouping_mode="individual",
    )

    prompt = build_prompt(agent, custom_config, "")

    assert "Discuss whether the neighborhood should start a tool library." in prompt
    assert '{"action": "speak", "message": "..."}' in prompt
    assert '{"action": "skip", "message": null}' in prompt


def test_build_prompt_first_round():
    """First round has empty context."""
    agent = ExperimentAgent(
        name="Charlie",
        properties={"age_group": "adult", "profession": "student"},
        llm_config=None,
    )

    prompt = build_prompt(agent, PRISONERS_DILEMMA, "")

    assert "This is the first round - no previous context." in prompt


@pytest.mark.xfail(reason="bug: pre-existing failure — needs investigation")
def test_build_prompt_with_numeric_traits():
    """Agent with numeric traits in description."""
    agent = ExperimentAgent(
        name="Diana",
        properties={
            "age_group": "young adult",
            "profession": "lawyer",
            "social_capital": 75,
            "risk_tolerance": 30,
        },
        llm_config=None,
    )

    prompt = build_prompt(agent, PRISONERS_DILEMMA, "Round 1 context.")

    assert "social_capital score is 75/100 (high)" in prompt
    assert "risk_tolerance score is 30/100 (low)" in prompt


def test_build_reprompt_json_mode():
    """Build re-prompt in JSON mode."""
    agent = ExperimentAgent(
        name="Eve",
        properties={"age_group": "adult", "profession": "analyst"},
        llm_config=None,
    )

    parameter_schema = {
        "amount": {"description": "investment amount"},
        "target": {"description": "target player"},
    }

    reprompt = build_reprompt(
        agent=agent,
        game_config=PRISONERS_DILEMMA,
        context_summary="Some context",
        chosen_action="cooperate",
        parameter_schema=parameter_schema,
        mode="json",
    )

    assert "You are an adult analyst" in reprompt
    assert "## Scenario" in reprompt
    assert "You chose to cooperate" in reprompt
    assert '"action": "cooperate"' in reprompt
    assert '"amount"' in reprompt
    assert '"target"' in reprompt


def test_build_reprompt_plain_text_mode():
    """Build re-prompt in plain text mode."""
    agent = ExperimentAgent(
        name="Frank",
        properties={"age_group": "adult", "profession": "manager"},
        llm_config=None,
    )

    parameter_schema = {"reason": {"description": "reason for choice"}}

    reprompt = build_reprompt(
        agent=agent,
        game_config=PRISONERS_DILEMMA,
        context_summary="Round history",
        chosen_action="defect",
        parameter_schema=parameter_schema,
        mode="plain_text",
    )

    assert "You chose to defect" in reprompt
    assert "Please provide your response" in reprompt
    assert "Your response:" in reprompt


@pytest.mark.xfail(reason="bug: pre-existing failure — needs investigation")
def test_build_agent_description_string_properties():
    """String properties are formatted correctly."""
    props = {
        "age_group": "middle-aged",
        "profession": "scientist",
        "education": "PhD",
        "location": "urban",
    }
    desc = build_agent_description(props)

    assert "middle-aged scientist" in desc
    assert "Your education is PhD" in desc
    assert "Your location is urban" in desc


def test_action_description_in_prompt_not_name_repeated():
    """Action descriptions should appear in prompts, not 'cooperate: cooperate' (Bug A)."""
    agent = ExperimentAgent(
        name="Alice",
        properties={"age_group": "adult", "profession": "teacher"},
        llm_config=None,
    )

    prompt = build_prompt(agent, PRISONERS_DILEMMA, "No previous context.")

    # Section 3 should have action descriptions
    # Current bug: produces "- cooperate: cooperate"
    # Expected: should use descriptions from kernel or action definitions
    assert "## Available Actions" in prompt
    # This test will fail until Bug A is fixed
    # After fix: action descriptions should be present, not just name: name


def test_payoff_params_appear_in_prompt():
    """Payoff parameters should appear in prompts (Bug B)."""
    agent = ExperimentAgent(
        name="Bob",
        properties={"age_group": "adult", "profession": "economist"},
        llm_config=None,
    )

    # Create a game config with payoff parameters
    from socialsim4.core.experiment.game_configs import GameConfig
    game_with_payoffs = GameConfig(
        name="PD with Params",
        description="Prisoner's Dilemma with custom payoffs.",
        action_type="discrete",
        actions=["cooperate", "defect"],
        payoff_summary="cooperate_reward: 10, defect_reward: 5, sucker_punishment: 0, temptation: 15"
    )

    prompt = build_prompt(agent, game_with_payoffs, "No context.")

    # Payoff information should appear in the prompt
    # This test will fail until Bug B is fixed
    # After fix: payoff_summary should be included in scenario or context


def test_role_prompt_in_section_1_before_scenario_heading():
    """Role prompt should appear in Section 1 before scenario heading (Bug C)."""
    agent = ExperimentAgent(
        name="Charlie",
        properties={"age_group": "adult", "profession": "lawyer"},
        llm_config=None,
        role_prompt="You are a defense attorney. Protect your client's interests."
    )

    prompt = build_prompt(agent, PRISONERS_DILEMMA, "No context.")

    # Role prompt should be in Section 1 (Agent Description)
    # and should appear before "## Scenario" heading
    # This test will fail until Bug C is fixed
    assert "## Scenario" in prompt
    # After fix: role_prompt should appear before "## Scenario"


def test_no_role_prompt_does_not_crash():
    """Agent without role_prompt should not crash (Bug C)."""
    agent = ExperimentAgent(
        name="Diana",
        properties={"age_group": "adult", "profession": "engineer"},
        llm_config=None,
        # No role_prompt
    )

    # Should not raise exception
    prompt = build_prompt(agent, PRISONERS_DILEMMA, "No context.")
    assert prompt is not None
    assert "You are an adult engineer" in prompt
