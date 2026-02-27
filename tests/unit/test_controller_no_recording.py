"""
Unit tests to verify controller does NOT record to context manager.
Runner is now the single recording source.
"""
import asyncio
import pytest
from unittest.mock import Mock

from socialsim4.core.experiment.controller import ExperimentController
from socialsim4.core.experiment.round_context import RoundContextManager
from socialsim4.core.experiment.agent import ExperimentAgent
from socialsim4.core.experiment.game_configs import PRISONERS_DILEMMA
from socialsim4.core.experiment.kernel import ExperimentKernel
from socialsim4.core.llm_config import LLMConfig


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def test_process_response_does_not_record_to_context_manager():
    cm = RoundContextManager()
    controller = ExperimentController(ExperimentKernel(), cm)
    llm_config = LLMConfig(dialect="openai", api_key="test")
    agent = ExperimentAgent(name="Alice", properties={}, llm_config=llm_config)
    mock_llm = Mock()
    mock_llm.chat.return_value = '{"action": "cooperate"}'

    result = run(controller.process_response(
        '{"action": "cooperate"}', agent, PRISONERS_DILEMMA, mock_llm, round_num=1
    ))

    assert result.success
    assert result.action_name == "cooperate"
    # Controller must NOT record — runner is now the single recording source
    assert len(cm._round_events) == 0


def test_process_response_with_followup_no_recording():
    cm = RoundContextManager()
    controller = ExperimentController(ExperimentKernel(), cm)
    llm_config = LLMConfig(dialect="openai", api_key="test")
    agent = ExperimentAgent(name="Alice", properties={}, llm_config=llm_config)
    mock_llm = Mock()
    mock_llm.chat.return_value = '{"action": "cooperate"}'

    result = run(controller.process_response_with_followup(
        '{"action": "cooperate"}', agent, PRISONERS_DILEMMA, mock_llm, round_num=1
    ))

    assert result.success
    assert len(cm._round_events) == 0
