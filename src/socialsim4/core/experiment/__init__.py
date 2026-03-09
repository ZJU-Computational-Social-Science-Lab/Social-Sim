"""
Experiment module - Three-Layer Architecture for strategic experiments.

Layer 1: ExperimentAgent (lightweight agent with properties)
Layer 2: PromptBuilder (5-section structured prompts)
Layer 3: ExperimentController (action validation and execution)

Orchestrated by: ExperimentRunner
Configured by: ExperimentConfig, ExperimentScene
"""

from socialsim4.core.experiment.agent import ExperimentAgent
from socialsim4.core.experiment.config import ExperimentConfig
from socialsim4.core.experiment.controller import ExperimentController
from socialsim4.core.experiment.game_configs import GameConfig
from socialsim4.core.experiment.kernel import ExperimentKernel
from socialsim4.core.experiment.prompt_builder import build_prompt, build_reprompt
from socialsim4.core.experiment.runner import ExperimentRunner, RoundResult
from socialsim4.core.experiment.scene import ExperimentScene

__all__ = [
    "ExperimentAgent",
    "ExperimentConfig",
    "ExperimentController",
    "ExperimentKernel",
    "ExperimentRunner",
    "ExperimentScene",
    "GameConfig",
    "RoundResult",
    "build_prompt",
    "build_reprompt",
]
