"""
Tests for ExperimentController (Layer 3 validation and execution).
"""

import pytest
from socialsim4.core.experiment.controller import ExperimentController, ActionResult
from socialsim4.core.experiment.game_configs import GameConfig, PRISONERS_DILEMMA
from socialsim4.core.experiment.kernel import ExperimentKernel
from socialsim4.core.experiment.round_context import RoundContextManager
from socialsim4.core.experiment.agent import ExperimentAgent
from socialsim4.core.llm_config import LLMConfig


@pytest.mark.asyncio
async def test_process_valid_response():
    """Process a valid LLM response."""
    kernel = ExperimentKernel()
    context_manager = RoundContextManager()
    controller = ExperimentController(kernel, context_manager)

    agent = ExperimentAgent(
        name="Alice",
        properties={},
        llm_config=LLMConfig(dialect="mock")
    )

    raw_json = '{"reasoning": "I want to cooperate", "action": "cooperate"}'
    result = await controller.process_response(
        raw_json, agent, PRISONERS_DILEMMA, None, round_num=1
    )

    assert result.success is True
    assert result.action_name == "cooperate"
    assert result.skipped is False
    assert "Alice chose cooperate" in result.summary


@pytest.mark.asyncio
async def test_process_invalid_action():
    """Invalid action results in skipped turn."""
    kernel = ExperimentKernel()
    context_manager = RoundContextManager()
    controller = ExperimentController(kernel, context_manager)

    agent = ExperimentAgent(
        name="Bob",
        properties={},
        llm_config=LLMConfig(dialect="mock")
    )

    raw_json = '{"reasoning": "...", "action": "invalid_action"}'
    result = await controller.process_response(
        raw_json, agent, PRISONERS_DILEMMA, None, round_num=1
    )

    assert result.success is False
    assert result.skipped is True
    assert "not in allowed set" in result.error


@pytest.mark.asyncio
async def test_process_json_with_markdown():
    """Handle JSON wrapped in markdown fences."""
    kernel = ExperimentKernel()
    context_manager = RoundContextManager()
    controller = ExperimentController(kernel, context_manager)

    agent = ExperimentAgent(
        name="Charlie",
        properties={},
        llm_config=LLMConfig(dialect="mock")
    )

    raw_json = '```json\n{"action": "defect"}\n```'
    result = await controller.process_response(
        raw_json, agent, PRISONERS_DILEMMA, None, round_num=1
    )

    assert result.success is True
    assert result.action_name == "defect"


@pytest.mark.asyncio
async def test_malformed_json_skipped_with_raw_text_in_error():
    """Malformed JSON results in skipped turn with raw text in error."""
    kernel = ExperimentKernel()
    context_manager = RoundContextManager()
    controller = ExperimentController(kernel, context_manager)

    agent = ExperimentAgent(
        name="Diana",
        properties={},
        llm_config=LLMConfig(dialect="mock")
    )

    malformed_json = '{"reasoning": "I think", "action": "cooperate"'  # Missing closing brace
    result = await controller.process_response(
        malformed_json, agent, PRISONERS_DILEMMA, None, round_num=1
    )

    assert result.success is False
    assert result.skipped is True
    # Error should contain the raw text for debugging
    assert result.error is not None


@pytest.mark.asyncio
async def test_think_tags_stripped_before_parse():
    """Think tags should be stripped before parsing JSON."""
    kernel = ExperimentKernel()
    context_manager = RoundContextManager()
    controller = ExperimentController(kernel, context_manager)

    agent = ExperimentAgent(
        name="Eve",
        properties={},
        llm_config=LLMConfig(dialect="mock")
    )

    response_with_think = '<|thinking|>I should cooperate<|/thinking|>\n{"reasoning": "cooperate", "action": "cooperate"}'
    result = await controller.process_response(
        response_with_think, agent, PRISONERS_DILEMMA, None, round_num=1
    )

    assert result.success is True
    assert result.action_name == "cooperate"


@pytest.mark.asyncio
async def test_action_result_contains_required_fields():
    """Controller should return ActionResult with all required fields for recording.

    Note: Recording to context_manager happens in the runner, not the controller.
    The controller's job is to validate and return an ActionResult.
    """
    kernel = ExperimentKernel()
    context_manager = RoundContextManager()
    controller = ExperimentController(kernel, context_manager)

    agent = ExperimentAgent(
        name="Frank",
        properties={},
        llm_config=LLMConfig(dialect="mock")
    )

    raw_json = '{"reasoning": "I choose to defect", "action": "defect"}'
    result = await controller.process_response(
        raw_json, agent, PRISONERS_DILEMMA, None, round_num=2
    )

    # Verify the ActionResult has all fields needed for recording
    assert result.success is True
    assert result.agent_name == "Frank"
    assert result.action_name == "defect"
    assert result.round_num == 2
    assert result.summary == "Frank chose defect"
    assert result.skipped is False


@pytest.mark.asyncio
async def test_custom_speak_accepts_message_in_initial_json():
    kernel = ExperimentKernel()
    context_manager = RoundContextManager()
    controller = ExperimentController(kernel, context_manager)
    agent = ExperimentAgent(name="Alice", properties={}, llm_config=LLMConfig(dialect="mock"))
    custom_config = GameConfig(
        name="custom",
        description="Open discussion",
        action_type="discrete",
        actions=["speak", "skip"],
        payoff_type="none",
        grouping_mode="individual",
    )

    result = await controller.process_response(
        '{"action": "speak", "message": "I support starting with a pilot."}',
        agent,
        custom_config,
        None,
        round_num=1,
    )

    assert result.success is True
    assert result.action_name == "speak"
    assert result.parameters == {"message": "I support starting with a pilot."}
    assert result.skipped is False


@pytest.mark.asyncio
async def test_custom_skip_is_successful_recordable_skip():
    kernel = ExperimentKernel()
    context_manager = RoundContextManager()
    controller = ExperimentController(kernel, context_manager)
    agent = ExperimentAgent(name="Bob", properties={}, llm_config=LLMConfig(dialect="mock"))
    custom_config = GameConfig(
        name="custom",
        description="Open discussion",
        action_type="discrete",
        actions=["speak", "skip"],
        payoff_type="none",
        grouping_mode="individual",
    )

    result = await controller.process_response(
        '{"action": "skip", "message": null}',
        agent,
        custom_config,
        None,
        round_num=1,
    )

    assert result.success is True
    assert result.action_name == "skip"
    assert result.parameters == {"message": None}
    assert result.skipped is True
