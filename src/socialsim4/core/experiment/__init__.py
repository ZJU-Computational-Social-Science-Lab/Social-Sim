"""
Experiment platform for social science simulations.

Implements Three-Layer Architecture:
- Layer 1: Constrained Decoding (API-level JSON mode)
- Layer 2: 5-section structured prompts
- Layer 3: Validation with re-prompt logic
"""

# Imports will be added as modules are implemented
from socialsim4.core.experiment.agent import ExperimentAgent
from socialsim4.core.experiment.game_configs import GameConfig
from socialsim4.core.experiment.kernel import (
    ChoiceAction,
    ExperimentAction,
    ExperimentKernel,
    NumericalAction,
    SpeakAction,
    VoteAction,
)
from socialsim4.core.experiment.prompt_builder import (
    build_agent_description,
    build_prompt,
    build_reprompt,
)
from socialsim4.core.experiment.schema_builder import build_schema
from socialsim4.core.experiment.round_context import (
    RoundContextManager,
    RoundEvent,
)
from socialsim4.core.experiment.validation import (
    strip_markdown_fences,
    strip_think_tags,
    validate_and_clamp,
)

__all__ = [
    "ExperimentAgent",
    "ExperimentAction",
    "ExperimentKernel",
    "ChoiceAction",
    "SpeakAction",
    "VoteAction",
    "NumericalAction",
    "GameConfig",
    "build_schema",
    "build_agent_description",
    "build_prompt",
    "build_reprompt",
    "strip_markdown_fences",
    "strip_think_tags",
    "validate_and_clamp",
    "RoundContextManager",
    "RoundEvent",
]
