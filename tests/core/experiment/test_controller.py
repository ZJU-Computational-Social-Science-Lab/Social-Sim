"""
Tests for ExperimentController (Layer 3 validation and execution).
"""

import pytest
from socialsim4.core.experiment.controller import ExperimentController, ActionResult
from socialsim4.core.experiment.game_configs import PRISONERS_DILEMMA
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
