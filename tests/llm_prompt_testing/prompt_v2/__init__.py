"""
Prompt Engineering v2 - Three-layer architecture for LLM agent prompts.

This module provides:
- Game-agnostic prompt building
- JSON schema generation for constrained decoding
- Validation with fuzzy matching and fallback
- Comprehension checking

The design preserves flexibility - works with any game scenario configuration.
"""

from .game_configs import GameConfig
from .schema_builder import build_schema
from .prompt_builder import build_system_prompt, build_user_message
from .validation import (
    strip_markdown_fences,
    strip_think_tags,
    validate_and_clamp,
)
from .agent_caller import get_agent_action, random_valid_action
from .comprehension import verify_comprehension

__all__ = [
    "GameConfig",
    "build_schema",
    "build_system_prompt",
    "build_user_message",
    "strip_markdown_fences",
    "strip_think_tags",
    "validate_and_clamp",
    "get_agent_action",
    "random_valid_action",
    "verify_comprehension",
]
