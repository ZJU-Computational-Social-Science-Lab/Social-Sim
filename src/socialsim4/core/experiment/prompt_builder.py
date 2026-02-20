"""
Experiment Prompt Builder - builds 5-section prompts (Layer 2).

The prompt builder constructs structured prompts from:
1. Agent Description (demographics)
2. Scenario (researcher-defined)
3. Available Actions (from kernel)
4. Context (cumulative per-agent summary)
5. JSON format instruction
"""

import logging
import sys
from typing import Dict, Any, Literal

from socialsim4.core.experiment.agent import ExperimentAgent
from socialsim4.core.experiment.game_configs import GameConfig

# Configure debug logging to stdout
logger = logging.getLogger(__name__)
_handler = logging.StreamHandler(sys.stdout)
_handler.setLevel(logging.DEBUG)
_handler.setFormatter(logging.Formatter('[EXPERIMENT PROMPT] %(message)s'))
logger.addHandler(_handler)
logger.setLevel(logging.DEBUG)


def _interpret_score(value: int) -> str:
    """Convert numeric score to interpretation bracket.

    Args:
        value: Numeric score from 0-100

    Returns:
        "low", "moderate", or "high"
    """
    if value <= 33:
        return "low"
    elif value <= 66:
        return "moderate"
    else:
        return "high"


def _get_article(word: str) -> str:
    """Get the appropriate article (a/an) for a word.

    Args:
        word: The word to get an article for

    Returns:
        "an" if word starts with a vowel sound, "a" otherwise
    """
    vowels = ("a", "e", "i", "o", "u")
    return "an" if word.lower().startswith(vowels) else "a"


def build_agent_description(agent_properties: Dict[str, Any]) -> str:
    """Build agent description section from demographic properties.

    Formats numeric traits with interpretation brackets:
    - 0-33 -> (low)
    - 34-66 -> (moderate)
    - 67-100 -> (high)

    Args:
        agent_properties: Dict of demographic properties

    Returns:
        Formatted agent description string

    Example:
        >>> build_agent_description({"age_group": "young adult", "social_capital": 82})
        "You are a young adult person. Your social_capital score is 82/100 (high)."
    """
    parts = []

    # Start with identity
    age_group = agent_properties.get("age_group", "adult")
    profession = agent_properties.get("profession", "person")
    article = _get_article(age_group)
    parts.append(f"You are {article} {age_group} {profession}.")

    # Add numeric traits with interpretation
    for key, value in agent_properties.items():
        if key in ["age_group", "profession"]:
            continue  # Already handled
        if isinstance(value, (int, float)):
            interpretation = _interpret_score(int(value))
            parts.append(f"Your {key} score is {value}/100 ({interpretation}).")
        elif isinstance(value, str):
            parts.append(f"Your {key} is {value}.")

    return " ".join(parts)


def build_prompt(
    agent: ExperimentAgent,
    game_config: GameConfig,
    context_summary: str
) -> str:
    """Build the 5-section structured prompt.

    Args:
        agent: The agent acting
        game_config: Game/scenario configuration
        context_summary: Cumulative context summary for this agent

    Returns:
        Complete prompt string
    """
    sections = []

    # Section 1: Agent Description
    agent_desc = build_agent_description(agent.get_properties_dict())
    sections.append(agent_desc)

    # Section 2: Scenario
    sections.append(f"\n## Scenario\n{game_config.description}")

    # Section 3: Available Actions
    if game_config.action_type == "discrete":
        actions_list = "\n".join(f"- {a}: {a}" for a in game_config.actions)
        sections.append(f"\n## Available Actions\n{actions_list}")
    else:  # integer
        sections.append(f"\n## Your Action\nChoose a value from {game_config.min} to {game_config.max}.")

    # Section 4: Context
    if context_summary:
        sections.append(f"\n## Context\n{context_summary}")
    else:
        sections.append("\n## Context\nThis is the first round - no previous context.")

    # Section 5: Output Format
    field = game_config.output_field
    if game_config.action_type == "discrete":
        actions_str = ", ".join(f'"{a}"' for a in game_config.actions)
        sections.append(f'\n## Your Response\nRespond ONLY with valid JSON: {{"reasoning": "one sentence", "{field}": "<{actions_str}>"}}')
    else:  # integer
        sections.append(f'\n## Your Response\nRespond ONLY with valid JSON: {{"reasoning": "one sentence", "{field}": <integer from {game_config.min}-{game_config.max}>}}')

    sections.append("\nNo markdown. No explanation. Only JSON.")

    prompt = "\n".join(sections)

    # Log the full prompt for debugging
    logger.debug(f"\n{'='*60}")
    logger.debug(f"PROMPT FOR AGENT: {agent.name}")
    logger.debug(f"{'='*60}")
    logger.debug(prompt)
    logger.debug(f"{'='*60}\n")

    return prompt


def build_reprompt(
    agent: ExperimentAgent,
    game_config: GameConfig,
    context_summary: str,
    chosen_action: str,
    parameter_schema: Dict[str, Any],
    mode: Literal["json", "plain_text"] = "json"
) -> str:
    """Build a re-prompt for collecting missing parameters.

    Args:
        agent: The agent acting
        game_config: Game/scenario configuration
        context_summary: Cumulative context (same as original prompt)
        chosen_action: The action the agent chose
        parameter_schema: JSON schema of required parameters
        mode: json or plain_text

    Returns:
        Re-prompt string
    """
    # Reuse the base prompt (all 5 sections)
    base_prompt = build_prompt(agent, game_config, context_summary)

    # Add re-prompt instruction
    if mode == "json":
        params_desc = ", ".join(f'"{k}": <{v.get("description", k)}>' for k, v in parameter_schema.items())
        reprompt = f"\n\nYou chose to {chosen_action}. This action requires parameters.\nRespond ONLY with valid JSON: {{\"action\": \"{chosen_action}\", {params_desc}}}"
    else:  # plain_text
        reprompt = f"\n\nYou chose to {chosen_action}. Please provide your response.\nYour response:"

    return base_prompt + reprompt
