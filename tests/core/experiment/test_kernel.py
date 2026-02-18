"""
Tests for ExperimentKernel and built-in action types.
"""

import pytest
from socialsim4.core.experiment.kernel import (
    ExperimentKernel,
    ChoiceAction,
    SpeakAction,
    VoteAction,
    NumericalAction,
)


def test_kernel_registers_actions():
    """Built-in actions are registered at module load."""
    assert ExperimentKernel.get_action("choice") == ChoiceAction
    assert ExperimentKernel.get_action("speak") == SpeakAction
    assert ExperimentKernel.get_action("vote") == VoteAction
    assert ExperimentKernel.get_action("numerical") == NumericalAction


def test_kernel_get_available_actions():
    """Build action list from scenario template."""
    scenario_actions = [
        {"type": "choice", "config": {"choice_name": "cooperate", "choice_description": "Cooperate"}},
        {"type": "choice", "config": {"choice_name": "defect", "choice_description": "Defect"}},
    ]
    actions = ExperimentKernel.get_available_actions(scenario_actions)

    assert len(actions) == 2
    assert all(isinstance(a, ChoiceAction) for a in actions)


def test_speak_action_is_plain_text_mode():
    """SpeakAction uses plain_text mode for freeform content."""
    assert SpeakAction.parameter_mode() == "plain_text"


def test_vote_action_is_json_mode():
    """VoteAction uses json mode for structured parameters."""
    assert VoteAction.parameter_mode() == "json"


def test_action_execution():
    """Actions return one-line summaries."""
    choice = ChoiceAction("cooperate", "Cooperate with partner")
    summary = choice.execute("Alice", {}, {})
    assert summary == "Alice chose cooperate"

    speak = SpeakAction()
    summary = speak.execute("Bob", {"message": "Hello world"}, {})
    assert summary == 'Bob: "Hello world"'
