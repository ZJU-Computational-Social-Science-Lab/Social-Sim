"""
Game configuration for experiment prompts.

Adapted from tests/llm_prompt_testing/prompt_v2/game_configs.py
"""

from dataclasses import dataclass
from typing import Literal


@dataclass
class GameConfig:
    """Configuration for a game/experiment.

    Attributes:
        name: Game name
        description: Full rules/payoffs description
        action_type: Type of action - "discrete" (enum) or "integer" (range)
        actions: List of valid action names (for discrete type)
        output_field: JSON field name for the action
        min: Minimum value (for integer type)
        max: Maximum value (for integer type)
        payoff_summary: Optional payoff description
    """
    name: str
    description: str
    action_type: Literal["discrete", "integer"]
    actions: list[str]
    output_field: str = "action"
    min: int = 0
    max: int = 10
    payoff_summary: str = ""


# Predefined game configs for the 6 social science patterns

PRISONERS_DILEMMA = GameConfig(
    name="Prisoner's Dilemma",
    description=(
        "Two suspects are arrested and held separately. Each must decide "
        "whether to betray the other or remain silent.\n"
        "Payoffs: If both cooperate (remain silent), both get 1 year. "
        "If one defects (betrays) and other cooperates, defector goes free, "
        "cooperator gets 5 years. If both defect, both get 3 years."
    ),
    action_type="discrete",
    actions=["cooperate", "defect"],
    payoff_summary="Your payoff depends on both your choice and your partner's choice.",
)

STAG_HUNT = GameConfig(
    name="Stag Hunt",
    description=(
        "Hunters must all choose stag (high reward) or hare (safe but low reward). "
        "Stag requires everyone to cooperate. If even one person chooses hare, "
        "the stag escapes and stag hunters get nothing."
    ),
    action_type="discrete",
    actions=["stag", "hare"],
    payoff_summary="Stag pays 5 if ALL choose it, else 0. Hare always pays 1.",
)

MINIMUM_EFFORT = GameConfig(
    name="Minimum Effort Game",
    description=(
        "Team members choose effort levels from 1-7. Your payoff depends on "
        "the MINIMUM effort chosen by anyone in the group, minus your effort cost. "
        "Higher effort = higher potential reward but requires everyone to coordinate."
    ),
    action_type="integer",
    actions=[],
    output_field="effort",
    min=1,
    max=7,
    payoff_summary="Payoff = (minimum group effort * 2) - (your effort * 0.1)",
)

INFORMATION_CASCADE = GameConfig(
    name="Information Cascade (Urn Experiment)",
    description=(
        "An urn contains either 70% red balls (majority-red) or 70% blue balls "
        "(majority-blue). You will privately draw a ball, see its color, replace it. "
        "Then you must guess the urn type. You also see all previous participants' "
        "public guesses (but not their private draws)."
    ),
    action_type="discrete",
    actions=["majority_red", "majority_blue"],
    payoff_summary="You earn $1 if correct, $0 if wrong.",
)

CONSENSUS_GAME = GameConfig(
    name="Consensus Game",
    description=(
        "Participants coordinate to select the same number from 0-100 through "
        "local negotiation. You can see your neighbors' current values. "
        "Success when all agents converge on the same value (within +/-2)."
    ),
    action_type="integer",
    actions=[],
    output_field="value",
    min=0,
    max=100,
    payoff_summary="All agents earn $10 if consensus achieved, else $0.",
)

SPATIAL_COOPERATION = GameConfig(
    name="Spatial Cooperation Game",
    description=(
        "Agents arranged on a grid play Prisoner's Dilemma with immediate neighbors. "
        "You can see your neighbors' last choices (cooperate/defect). "
        "Cooperate: both get 1. Defect vs cooperate: defector gets 2, cooperator gets 0. "
        "Both defect: both get 0."
    ),
    action_type="discrete",
    actions=["cooperate", "defect"],
    payoff_summary="Your payoff is the sum of outcomes with all neighbors.",
)
