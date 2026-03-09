"""
Game theory prompt builders with i18n support.

Generates agent prompts for game theory scenarios with customizable
action names, descriptions, and resource types. Supports English
and Chinese translations.

Contains: build_battle_of_the_sexes_prompt, build_stag_hunt_prompt,
          build_public_goods_prompt
"""

from socialsim4.core.scenarios.helpers import get_action_config, get_resource_name
from socialsim4.i18n import T


def build_battle_of_the_sexes_prompt(scenario_params: dict, language: str = "en") -> str:
    """Build Battle of the Sexes agent prompt with custom actions.

    Args:
        scenario_params: Scenario parameters including action names/descriptions
        language: Language code ('en' or 'zh')

    Returns:
        Complete prompt string for the agent
    """
    action_1 = get_action_config(scenario_params, 1)
    action_2 = get_action_config(scenario_params, 2)

    # Use defaults if not provided
    name_1 = action_1["name"] if action_1["name"] != "Action 1" else "Opera"
    name_2 = action_2["name"] if action_2["name"] != "Action 2" else "Football"
    desc_1 = action_1["description"] or "Go to the opera"
    desc_2 = action_2["description"] or "Go to the football game"

    lines = [
        T("prompts.game_theory.battle_of_the_sexes.intro", locale=language),
        T("prompts.game_theory.battle_of_the_sexes.choose_instruction",
          action_1=name_1, action_2=name_2, locale=language),
        T("prompts.game_theory.battle_of_the_sexes.action_format",
          action_name=name_1, action_description=desc_1, locale=language),
        T("prompts.game_theory.battle_of_the_sexes.action_format",
          action_name=name_2, action_description=desc_2, locale=language),
    ]

    return "\n".join(lines)


def build_stag_hunt_prompt(scenario_params: dict, language: str = "en") -> str:
    """Build Stag Hunt agent prompt with custom actions.

    Args:
        scenario_params: Scenario parameters including action names and payoff values
        language: Language code ('en' or 'zh')

    Returns:
        Complete prompt string for the agent
    """
    action_1 = get_action_config(scenario_params, 1)
    action_2 = get_action_config(scenario_params, 2)

    # Use defaults if not provided
    name_1 = action_1["name"] if action_1["name"] != "Action 1" else "Stag"
    name_2 = action_2["name"] if action_2["name"] != "Action 2" else "Hare"
    desc_1 = action_1["description"] or "Hunt the stag (requires all to cooperate)"
    desc_2 = action_2["description"] or "Hunt the hare (safe but lower reward)"

    stag_reward = scenario_params.get("stag_reward", 10)
    hare_reward = scenario_params.get("hare_reward", 3)

    lines = [
        T("prompts.game_theory.stag_hunt.intro", locale=language),
        T("prompts.game_theory.stag_hunt.choose_instruction",
          action_1=name_1, action_2=name_2, locale=language),
        T("prompts.game_theory.stag_hunt.action_format",
          action_name=name_1, action_description=desc_1, locale=language),
        T("prompts.game_theory.stag_hunt.action_format",
          action_name=name_2, action_description=desc_2, locale=language),
        T("prompts.game_theory.stag_hunt.payoff_context",
          action_1=name_1, action_2=name_2,
          stag_reward=stag_reward, hare_reward=hare_reward, locale=language),
    ]

    return "\n".join(lines)


def build_public_goods_prompt(scenario_params: dict, language: str = "en") -> str:
    """Build Public Goods agent prompt with custom resource and action names.

    Args:
        scenario_params: Scenario parameters including resource config
        language: Language code ('en' or 'zh')

    Returns:
        Complete prompt string for the agent
    """
    resource = get_resource_name(scenario_params)
    initial_amount = scenario_params.get("initial_amount", 20)
    multiplier = scenario_params.get("multiplier", 1.5)
    action_name = scenario_params.get("action_name", "Contribute")
    action_description = scenario_params.get("action_description", f"Contribute {resource.lower()} to the shared pool")

    # Lowercase resource for natural language flow
    resource_lower = resource.lower()

    lines = [
        T("prompts.game_theory.public_goods.intro",
          initial_amount=initial_amount, resource=resource_lower, locale=language),
        T("prompts.game_theory.public_goods.action_instruction",
          action_name=action_name.lower(), locale=language),
        T("prompts.game_theory.public_goods.action_description",
          action_description=action_description, locale=language),
        T("prompts.game_theory.public_goods.pool_mechanics",
          multiplier=multiplier, locale=language),
        T("prompts.game_theory.public_goods.choose_instruction",
          action_name=action_name.lower(), initial_amount=initial_amount, locale=language),
    ]

    return "\n".join(lines)
