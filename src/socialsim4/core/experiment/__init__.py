"""
Experiment platform for social science simulations.

Implements Three-Layer Architecture:
- Layer 1: Constrained Decoding (API-level JSON mode)
- Layer 2: 5-section structured prompts
- Layer 3: Validation with re-prompt logic
"""

from socialsim4.core.experiment.kernel import ExperimentKernel, ExperimentAction
from socialsim4.core.experiment.agent import ExperimentAgent
from socialsim4.core.experiment.runner import ExperimentRunner
from socialsim4.core.experiment.controller import ExperimentController, ActionResult
from socialsim4.core.experiment.round_context import RoundContextManager, RoundEvent
from socialsim4.core.experiment.prompt_builder import ExperimentPromptBuilder
from socialsim4.core.experiment.game_configs import GameConfig
from socialsim4.core.experiment.schema_builder import build_schema
from socialsim4.core.experiment.validation import validate_and_clamp

__all__ = [
    "ExperimentKernel",
    "ExperimentAction",
    "ExperimentAgent",
    "ExperimentRunner",
    "ExperimentController",
    "ActionResult",
    "RoundContextManager",
    "RoundEvent",
    "ExperimentPromptBuilder",
    "GameConfig",
    "build_schema",
    "validate_and_clamp",
]
