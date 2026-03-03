"""
Scenario registry for SocialSim4 experiment builder.

Provides static scenario metadata for all available experiment templates.
Each scenario defines parameters, actions, and settings for the frontend.
"""

from typing import Dict, List, Any
from .actions import CATEGORY_ACTION_LIBRARIES


# ============================================================================
# Game Theory Scenarios
# ============================================================================

PRISONERS_DILEMMA: Dict[str, Any] = {
    "id": "prisoners_dilemma",
    "name": "Prisoner's Dilemma",
    "category": "game_theory",
    "description": "Two suspects are arrested and held separately. Each must decide whether to betray the other or remain silent. Your payoff depends on both your choice and your partner's choice.",
    "interaction_mode": "simultaneous",
    "display_type": "payoff_matrix",
    "matrix_meta": {
        "symmetric": False,
        "rows": ["Cooperate", "Defect"],
        "cols": ["Cooperate", "Defect"],
        "cells": {
            "cooperate_cooperate": {"row": 1, "col": 1},
            "cooperate_defect": {"row": 5, "col": 0},
            "defect_cooperate": {"row": 0, "col": 5},
            "defect_defect": {"row": 3, "col": 3},
        }
    },
    "parameters": [
        {
            "id": "cooperate_reward",
            "key": "cooperate_reward",
            "label": "Both Cooperate",
            "type": "integer",
            "default": 3,
            "ui_hint": "number",
            "min": 0,
            "max": 10,
        },
        {
            "id": "sucker_penalty",
            "key": "sucker_penalty",
            "label": "You Cooperate, They Defect",
            "type": "integer",
            "default": 0,
            "ui_hint": "number",
            "min": 0,
            "max": 10,
        },
        {
            "id": "temptation_reward",
            "key": "temptation_reward",
            "label": "You Defect, They Cooperate",
            "type": "integer",
            "default": 5,
            "ui_hint": "number",
            "min": 0,
            "max": 10,
        },
        {
            "id": "defect_penalty",
            "key": "defect_penalty",
            "label": "Both Defect",
            "type": "integer",
            "default": 1,
            "ui_hint": "number",
            "min": 0,
            "max": 10,
        },
    ],
    "actions": [
        {"id": "cooperate", "name": "Cooperate", "description": "Work together with your partner"},
        {"id": "defect", "name": "Defect", "description": "Pursue your own interest"},
    ],
}

BATTLE_OF_THE_SEXES: Dict[str, Any] = {
    "id": "battle_of_the_sexes",
    "name": "Battle of the Sexes",
    "category": "game_theory",
    "description": "A couple wants to coordinate on an evening activity. One prefers opera, the other prefers football. They get positive payoff if they coordinate, but each prefers their own activity.",
    "interaction_mode": "simultaneous",
    "display_type": "payoff_matrix",
    "matrix_meta": {
        "symmetric": False,
        "rows": ["Opera", "Football"],
        "cols": ["Opera", "Football"],
        "cells": {
            "opera_opera": {"row": 3, "col": 1},
            "opera_football": {"row": 0, "col": 0},
            "football_opera": {"row": 0, "col": 0},
            "football_football": {"row": 1, "col": 3},
        }
    },
    "parameters": [
        {
            "id": "preferred_mispreferred",
            "key": "preferred_mispreferred",
            "label": "Preferred / Mispreferred Payoff",
            "type": "integer",
            "default": "3",
            "ui_hint": "slider",
            "min": 1,
            "max": 5,
        },
        {
            "id": "mispreferred_payoff",
            "key": "mispreferred_payoff",
            "label": "Mispreferred Alone Payoff",
            "type": "integer",
            "default": "0",
            "ui_hint": "slider",
            "min": 0,
            "max": 5,
        },
    ],
    "actions": [
        {"id": "opera", "name": "Opera", "description": "Go to the opera"},
        {"id": "football", "name": "Football", "description": "Go to the football game"},
    ],
}

STAG_HUNT: Dict[str, Any] = {
    "id": "stag_hunt",
    "name": "Stag Hunt",
    "category": "game_theory",
    "description": "Hunters must all choose stag (high reward) or hare (safe but low reward). Stag requires everyone to cooperate. If even one person chooses hare, the stag escapes and stag hunters get nothing.",
    "interaction_mode": "simultaneous",
    "display_type": "payoff_matrix",
    "matrix_meta": {
        "symmetric": True,
        "rows": ["Stag", "Hare"],
        "cols": ["Stag", "Hare"],
        "cells": {
            "stag_stag": {"value": 5},
            "stag_hare": {"value": 0},
            "hare_stag": {"value": 1},
            "hare_hare": {"value": 1},
        }
    },
    "parameters": [
        {
            "id": "stag_reward",
            "key": "stag_reward",
            "label": "Stag Reward (if all choose)",
            "type": "integer",
            "default": 5,
            "ui_hint": "slider",
            "min": 1,
            "max": 10,
        },
        {
            "id": "hare_reward",
            "key": "hare_reward",
            "label": "Hare Reward (always)",
            "type": "integer",
            "default": 1,
            "ui_hint": "slider",
            "min": 0,
            "max": 5,
        },
    ],
    "actions": [
        {"id": "stag", "name": "Stag", "description": "Hunt the stag (requires all to cooperate)"},
        {"id": "hare", "name": "Hare", "description": "Hunt the hare (safe but lower reward)"},
    ],
}

# ============================================================================
# Sociology Scenarios
# ============================================================================

SOCIAL_NORM_DISRUPTION: Dict[str, Any] = {
    "id": "social_norm_disruption",
    "name": "Social Norm Disruption",
    "category": "sociology",
    "description": "A new rule is suddenly imposed on the group. Agents with different social status and temperament must decide how to respond.",
    "interaction_mode": "simultaneous",
    "display_type": "params",
    "parameters": [
        {
            "id": "norm_strength",
            "key": "norm_strength",
            "label": "Norm Strength",
            "type": "number",
            "default": 0.8,
            "ui_hint": "percentage",
        },
        {
            "id": "agent_status_distribution",
            "key": "agent_status_distribution",
            "label": "Agent Status Distribution",
            "type": "string",
            "default": "mixed",
            "ui_hint": "select",
            "options": ["high_status", "low_status", "mixed"],
        },
    ],
    "actions": [],
    "category_actions": "sociology",
    "default_action_ids": ["comply_publicly", "comply_covertly_resist", "resist_openly", "persuade_others"],
}

POLICY_EROSION: Dict[str, Any] = {
    "id": "policy_erosion",
    "name": "Policy Meaning Erosion",
    "category": "sociology",
    "description": "A 3-tier hierarchy must transmit a policy from top to bottom. At each level, subordinates may reinterpret or resist the directive.",
    "interaction_mode": "sequential",
    "display_type": "params",
    "parameters": [
        {
            "id": "num_agents_per_tier",
            "key": "num_agents_per_tier",
            "label": "Agents per Tier",
            "type": "integer",
            "default": 5,
            "ui_hint": "slider",
            "min": 2,
            "max": 10,
        },
        {
            "id": "policy_text",
            "key": "policy_text",
            "label": "Policy Text",
            "type": "string",
            "default": "All employees must complete mandatory training by Friday",
            "ui_hint": "text",
        },
    ],
    "actions": [],
    "category_actions": "sociology",
    "default_action_ids": ["transmit_faithfully", "reinterpret_downward", "comply_directive", "resist_quietly"],
}

ECHO_CHAMBER: Dict[str, Any] = {
    "id": "echo_chamber",
    "name": "Echo Chamber",
    "category": "sociology",
    "description": "Agents with initial opinions interact and share information. They prefer connections with similar views, leading to potential polarization.",
    "interaction_mode": "simultaneous",
    "display_type": "params",
    "parameters": [
        {
            "id": "connection_homogeneity",
            "key": "connection_homogeneity",
            "label": "Connection Homogeneity",
            "type": "number",
            "default": 0.7,
            "ui_hint": "percentage",
        },
        {
            "id": "opinion_distribution",
            "key": "opinion_distribution",
            "label": "Initial Opinion Distribution",
            "type": "string",
            "default": "balanced",
            "ui_hint": "select",
            "options": ["balanced", "polarized", "random"],
        },
    ],
    "actions": [],
    "category_actions": "sociology",
    "default_action_ids": ["express_opinion", "reinforce_ingroup", "share_content", "disengage"],
}

RESOURCE_SCARCITY: Dict[str, Any] = {
    "id": "resource_scarcity",
    "name": "Resource Scarcity",
    "category": "sociology",
    "description": "A community has limited resources. Agents must decide whether to cooperate by sharing or compete by hoarding. Tests trust and collective action.",
    "interaction_mode": "simultaneous",
    "display_type": "params",
    "parameters": [
        {
            "id": "resource_amount",
            "key": "resource_amount",
            "label": "Total Resources",
            "type": "integer",
            "default": 100,
            "ui_hint": "slider",
            "min": 10,
            "max": 200,
        },
        {
            "id": "initial_distribution",
            "key": "initial_distribution",
            "label": "Initial Distribution",
            "type": "string",
            "default": "equal",
            "ui_hint": "select",
            "options": ["equal", "random", "skewed"],
        },
    ],
    "actions": [],
    "category_actions": "sociology",
    "default_action_ids": ["share_resources", "hoard", "propose_trade", "form_contract"],
}

# ============================================================================
# Discussion / Open Scenarios
# ============================================================================

OPEN_DISCUSSION: Dict[str, Any] = {
    "id": "open_discussion",
    "name": "Open Discussion",
    "category": "discussion",
    "description": "Agents discuss a topic freely. No structured decisions - just conversation.",
    "interaction_mode": "simultaneous",
    "display_type": "params",
    "parameters": [
        {
            "id": "topic",
            "key": "topic",
            "label": "Discussion Topic",
            "type": "string",
            "default": "What should we have for lunch?",
            "ui_hint": "textarea",
        },
        {
            "id": "max_turns",
            "key": "max_turns",
            "label": "Maximum Turns",
            "type": "integer",
            "default": 10,
            "ui_hint": "slider",
            "min": 5,
            "max": 30,
        },
    ],
    "actions": [
        {"id": "speak", "name": "Speak", "description": "Say something to the group"},
    ],
}

GRID_WORLD: Dict[str, Any] = {
    "id": "grid_world",
    "name": "Grid World",
    "category": "grid_world",
    "description": "Agents move on a grid, collecting resources and observing their environment.",
    "interaction_mode": "simultaneous",
    "display_type": "params",
    "parameters": [
        {
            "id": "grid_size",
            "key": "grid_size",
            "label": "Grid Size",
            "type": "integer",
            "default": 10,
            "ui_hint": "slider",
            "min": 5,
            "max": 20,
        },
        {
            "id": "resource_count",
            "key": "resource_count",
            "label": "Resource Count",
            "type": "integer",
            "default": 5,
            "ui_hint": "slider",
            "min": 1,
            "max": 20,
        },
    ],
    "actions": [
        {"id": "move_to_location", "name": "Move", "description": "Move to a location"},
        {"id": "look_around", "name": "Look Around", "description": "Observe surroundings"},
        {"id": "gather_resource", "name": "Gather", "description": "Collect a resource"},
        {"id": "rest", "name": "Rest", "description": "Do nothing this turn"},
    ],
}

# ============================================================================
# Social Deduction
# ============================================================================

WEREWOLF: Dict[str, Any] = {
    "id": "werewolf",
    "name": "Werewolf",
    "category": "social_deduction",
    "description": "A social deduction game where villagers try to identify werewolves among them while werewolves try to eliminate villagers at night.",
    "interaction_mode": "sequential",
    "display_type": "params",
    "parameters": [
        {
            "id": "num_werewolves",
            "key": "num_werewolves",
            "label": "Number of Werewolves",
            "type": "integer",
            "default": 1,
            "ui_hint": "slider",
            "min": 1,
            "max": 3,
        },
        {
            "id": "num_villagers",
            "key": "num_villagers",
            "label": "Number of Villagers",
            "type": "integer",
            "default": 5,
            "ui_hint": "slider",
            "min": 3,
            "max": 10,
        },
    ],
    "actions": [
        {"id": "vote", "name": "Vote", "description": "Vote to eliminate a suspect"},
        {"id": "speak", "name": "Speak", "description": "Share your thoughts"},
    ],
}

# ============================================================================
# Custom Scenario
# ============================================================================

CUSTOM: Dict[str, Any] = {
    "id": "custom",
    "name": "Custom Scenario",
    "category": "discussion",
    "description": "Build your own custom experiment from scratch.",
    "interaction_mode": "simultaneous",
    "display_type": "params",
    "parameters": [],
    "actions": [],
}

# ============================================================================
# Spatial Prisoner's Dilemma
# ============================================================================

SPATIAL_PD: Dict[str, Any] = {
    "id": "spatial_pd",
    "name": "Spatial Prisoner's Dilemma",
    "category": "game_theory",
    "description": "Agents arranged on a grid play Prisoner's Dilemma with their immediate neighbors. You can see your neighbors' last choices. Your payoff is the sum of outcomes with all adjacent agents.",
    "interaction_mode": "simultaneous",
    "display_type": "params",
    "parameters": [
        {
            "id": "grid_width",
            "key": "grid_width",
            "label": "Grid Width",
            "type": "integer",
            "default": 5,
            "ui_hint": "slider",
            "min": 3,
            "max": 10,
        },
        {
            "id": "grid_height",
            "key": "grid_height",
            "label": "Grid Height",
            "type": "integer",
            "default": 5,
            "ui_hint": "slider",
            "min": 3,
            "max": 10,
        },
        {
            "id": "cooperate_reward",
            "key": "cooperate_reward",
            "label": "Both Cooperate",
            "type": "integer",
            "default": 3,
            "ui_hint": "number",
            "min": 0,
            "max": 10,
        },
        {
            "id": "sucker_penalty",
            "key": "sucker_penalty",
            "label": "You Cooperate, They Defect",
            "type": "integer",
            "default": 0,
            "ui_hint": "number",
            "min": 0,
            "max": 10,
        },
        {
            "id": "temptation_reward",
            "key": "temptation_reward",
            "label": "You Defect, They Cooperate",
            "type": "integer",
            "default": 5,
            "ui_hint": "number",
            "min": 0,
            "max": 10,
        },
        {
            "id": "defect_penalty",
            "key": "defect_penalty",
            "label": "Both Defect",
            "type": "integer",
            "default": 1,
            "ui_hint": "number",
            "min": 0,
            "max": 10,
        },
    ],
    "actions": [
        {"id": "cooperate", "name": "Cooperate", "description": "Work together with neighbors"},
        {"id": "defect", "name": "Defect", "description": "Act independently"},
    ],
    "state_schema": {
        "spatial": {"width": 5, "height": 5},
        "visibility": "neighbors",
    },
}

# ============================================================================
# Public Goods Game
# ============================================================================

PUBLIC_GOODS: Dict[str, Any] = {
    "id": "public_goods",
    "name": "Public Goods Game",
    "category": "game_theory",
    "description": "Each agent has tokens and decides how much to contribute to a shared pool. The pool is multiplied and distributed equally among all agents, regardless of contribution.",
    "interaction_mode": "simultaneous",
    "display_type": "params",
    "parameters": [
        {
            "id": "initial_tokens",
            "key": "initial_tokens",
            "label": "Initial Tokens",
            "type": "integer",
            "default": 20,
            "ui_hint": "slider",
            "min": 10,
            "max": 50,
        },
        {
            "id": "multiplier",
            "key": "multiplier",
            "label": "Pool Multiplier",
            "type": "number",
            "default": 1.5,
            "ui_hint": "slider",
            "min": 1.0,
            "max": 3.0,
        },
        {
            "id": "num_rounds",
            "key": "num_rounds",
            "label": "Number of Rounds",
            "type": "integer",
            "default": 10,
            "ui_hint": "slider",
            "min": 1,
            "max": 20,
        },
    ],
    "actions": [
        {"id": "contribute", "name": "Contribute", "description": "Contribute some tokens to the pool"},
    ],
    "state_schema": {
        "extensions": {"pools": {"main": 0}},
        "resources": {"tokens": 20},
    },
}

# ============================================================================
# Graph Coloring
# ============================================================================

GRAPH_COLORING: Dict[str, Any] = {
    "id": "graph_coloring",
    "name": "Graph Coloring",
    "category": "game_theory",
    "description": "Agents are nodes in a graph and must choose a color. No two adjacent nodes should have the same color. Agents can see their neighbors' current colors.",
    "interaction_mode": "sequential",
    "display_type": "params",
    "parameters": [
        {
            "id": "num_colors",
            "key": "num_colors",
            "label": "Number of Colors",
            "type": "integer",
            "default": 3,
            "ui_hint": "slider",
            "min": 2,
            "max": 5,
        },
        {
            "id": "graph_type",
            "key": "graph_type",
            "label": "Graph Type",
            "type": "string",
            "default": "random",
            "ui_hint": "select",
            "options": ["random", "grid", "cycle", "complete"],
        },
        {
            "id": "edge_probability",
            "key": "edge_probability",
            "label": "Edge Probability (random)",
            "type": "number",
            "default": 0.3,
            "ui_hint": "slider",
            "min": 0.1,
            "max": 0.9,
        },
    ],
    "actions": [
        {"id": "choose_color", "name": "Choose Color", "description": "Select a color for your node"},
    ],
    "state_schema": {
        "extensions": {"colors": {}, "graph": {"edges": []}},
        "visibility": "neighbors",
    },
}

# ============================================================================
# Registry
# ============================================================================

ALL_SCENARIOS: List[Dict[str, Any]] = [
    PRISONERS_DILEMMA,
    BATTLE_OF_THE_SEXES,
    STAG_HUNT,
    SOCIAL_NORM_DISRUPTION,
    POLICY_EROSION,
    ECHO_CHAMBER,
    RESOURCE_SCARCITY,
    OPEN_DISCUSSION,
    GRID_WORLD,
    WEREWOLF,
    SPATIAL_PD,
    PUBLIC_GOODS,
    GRAPH_COLORING,
    CUSTOM,
]


def get_all_scenarios() -> List[Dict[str, Any]]:
    """Get all available scenario definitions.

    Returns:
        List of scenario dictionaries with metadata.
    """
    scenarios = []
    for scenario in ALL_SCENARIOS:
        # Add category_actions for sociology scenarios
        if scenario.get("category_actions") and isinstance(scenario["category_actions"], str):
            category = scenario["category_actions"]
            if category in CATEGORY_ACTION_LIBRARIES:
                scenario["category_actions"] = CATEGORY_ACTION_LIBRARIES[category]
        scenarios.append(scenario)
    return scenarios


def get_scenario(scenario_id: str) -> Dict[str, Any] | None:
    """Get a specific scenario by ID.

    Args:
        scenario_id: The unique scenario identifier

    Returns:
        Scenario dict, or None if not found.
    """
    for scenario in ALL_SCENARIOS:
        if scenario["id"] == scenario_id:
            # Add category_actions if needed
            if scenario.get("category_actions") and isinstance(scenario["category_actions"], str):
                category = scenario["category_actions"]
                if category in CATEGORY_ACTION_LIBRARIES:
                    scenario = scenario.copy()
                    scenario["category_actions"] = CATEGORY_ACTION_LIBRARIES[category]
            return scenario
    return None


def get_scenario_actions(scenario_id: str) -> List[Dict[str, Any]]:
    """Get actions for a specific scenario.

    Args:
        scenario_id: The unique scenario identifier

    Returns:
        List of action dicts with 'id' and 'description' keys.
        Returns empty list if scenario not found.
    """
    scenario = get_scenario(scenario_id)
    if not scenario:
        return []

    # If using category_actions
    if scenario.get("category_actions"):
        category_actions = scenario["category_actions"]
        if isinstance(category_actions, list):
            return [{"id": a["id"], "name": a["name"], "description": a["description"]} for a in category_actions]
        return []

    # If using direct actions
    return [
        {"id": a["id"], "name": a["name"], "description": a["description"]}
        for a in scenario.get("actions", [])
    ]
