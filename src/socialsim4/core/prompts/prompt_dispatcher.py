"""
Prompt dispatcher for routing scenarios to appropriate prompt builders.

Provides a central dispatch mechanism to select the correct prompt
builder based on scenario ID. Returns None for scenarios that use
default prompt generation.

Contains: get_prompt_builder, build_prompt
"""

from typing import Callable, Optional

from socialsim4.core.prompts.game_theory_prompts import (
    build_battle_of_the_sexes_prompt,
    build_stag_hunt_prompt,
    build_public_goods_prompt,
)


# Map scenario IDs to their prompt builder functions
PROMPT_BUILDERS: dict[str, Callable] = {
    "battle_of_the_sexes": build_battle_of_the_sexes_prompt,
    "stag_hunt": build_stag_hunt_prompt,
    "public_goods": build_public_goods_prompt,
}


def get_prompt_builder(scenario_id: str) -> Optional[Callable]:
    """Get the prompt builder function for a scenario.

    Args:
        scenario_id: The scenario identifier

    Returns:
        Prompt builder function, or None if no custom builder exists
    """
    return PROMPT_BUILDERS.get(scenario_id)


def build_prompt(scenario_id: str, scenario_params: dict, language: str = "en") -> Optional[str]:
    """Build a prompt for the given scenario.

    Args:
        scenario_id: The scenario identifier
        scenario_params: Scenario parameters for prompt customization
        language: Language code ('en' or 'zh')

    Returns:
        Complete prompt string, or None if no custom builder exists
    """
    builder = get_prompt_builder(scenario_id)
    if builder is None:
        return None
    return builder(scenario_params, language)
