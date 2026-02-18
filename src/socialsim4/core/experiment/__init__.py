"""
Experiment platform for social science simulations.

Implements Three-Layer Architecture:
- Layer 1: Constrained Decoding (API-level JSON mode)
- Layer 2: 5-section structured prompts
- Layer 3: Validation with re-prompt logic
"""

# Imports will be added as modules are implemented
from socialsim4.core.experiment.game_configs import GameConfig
from socialsim4.core.experiment.schema_builder import build_schema

__all__ = [
    "GameConfig",
    "build_schema",
]
