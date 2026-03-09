"""Preset scenarios for social simulation.

Provides 13 pre-configured scenarios across multiple categories:
- Game Theory: classic strategic interaction scenarios
- Discussion: conversation and deliberation scenarios
- Grid: location-based movement and interaction scenarios
- Social Dynamics: opinion formation and group behavior scenarios
- Social Deduction: hidden role and information scenarios
- Custom: user-defined scenario template

Functions:
    get_all_scenarios: Returns list of all scenarios
    get_scenario: Returns a specific scenario by ID
    get_scenario_actions: Returns actions available for a scenario
"""

from __future__ import annotations

from typing import Any

# =============================================================================
# Game Theory Scenarios
# =============================================================================

_PRISONERS_DILEMMA: dict[str, Any] = {
    "id": "prisoners_dilemma",
    "name": "Prisoner's Dilemma",
    "category": "game_theory",
    "description": (
        "Two prisoners must decide whether to cooperate with each other or defect. "
        "The optimal individual outcome is to defect while the other cooperates, "
        "but mutual cooperation yields better collective outcomes than mutual defection."
    ),
    "parameters": [
        {
            "name": "cooperate_reward",
            "type": "integer",
            "default": 3,
            "description": "Reward when both prisoners cooperate",
        },
        {
            "name": "defect_penalty",
            "type": "integer",
            "default": 1,
            "description": "Penalty when both prisoners defect",
        },
        {
            "name": "sucker_penalty",
            "type": "integer",
            "default": 5,
            "description": "Penalty for cooperating while other defects",
        },
    ],
    "actions": [
        {"id": "cooperate", "name": "Cooperate", "description": "Stay silent and cooperate with partner"},
        {"id": "defect", "name": "Defect", "description": "Betray partner for personal advantage"},
    ],
}

_STAG_HUNT: dict[str, Any] = {
    "id": "stag_hunt",
    "name": "Stag Hunt",
    "category": "game_theory",
    "description": (
        "Two hunters must choose between hunting a stag (requiring cooperation) "
        "or hunting a hare (individually). Hunting stag yields higher reward but "
        "requires both to choose it."
    ),
    "parameters": [
        {
            "name": "stag_reward",
            "type": "integer",
            "default": 5,
            "description": "Reward when both hunt stag together",
        },
        {
            "name": "hare_reward",
            "type": "integer",
            "default": 2,
            "description": "Reward for hunting hare alone",
        },
        {
            "name": "stag_failure_penalty",
            "type": "integer",
            "default": 0,
            "description": "Reward when hunting stag alone (fails)",
        },
    ],
    "actions": [
        {"id": "hunt_stag", "name": "Hunt Stag", "description": "Cooperate to hunt the stag"},
        {"id": "hunt_hare", "name": "Hunt Hare", "description": "Hunt hare individually"},
    ],
}

_PUBLIC_GOODS: dict[str, Any] = {
    "id": "public_goods",
    "name": "Public Goods Game",
    "category": "game_theory",
    "description": (
        "Participants decide how much to contribute to a public good. "
        "Contributions are multiplied and redistributed equally. "
        "Free-riding is individually rational but collectively suboptimal."
    ),
    "parameters": [
        {
            "name": "multiplier",
            "type": "float",
            "default": 1.5,
            "description": "Multiplier for total contributions",
        },
        {
            "name": "endowment",
            "type": "integer",
            "default": 10,
            "description": "Initial endowment per participant",
        },
        {
            "name": "max_contribution",
            "type": "integer",
            "default": 10,
            "description": "Maximum contribution allowed per participant",
        },
    ],
    "actions": [
        {"id": "contribute_full", "name": "Contribute Full", "description": "Contribute maximum amount"},
        {"id": "contribute_partial", "name": "Contribute Partial", "description": "Contribute some amount"},
        {"id": "contribute_none", "name": "Contribute None", "description": "Keep all endowment (free-ride)"},
    ],
}

_BATTLE_OF_SEXES: dict[str, Any] = {
    "id": "battle_of_sexes",
    "name": "Battle of the Sexes",
    "category": "game_theory",
    "description": (
        "Two partners prefer different activities but want to be together. "
        "Coordination is key - both prefer being together at their less-preferred "
        "activity to being apart."
    ),
    "parameters": [
        {
            "name": "preferred_payoff",
            "type": "integer",
            "default": 3,
            "description": "Payoff for preferred activity together",
        },
        {
            "name": "other_payoff",
            "type": "integer",
            "default": 2,
            "description": "Payoff for other's preferred activity together",
        },
        {
            "name": "miscoordination_payoff",
            "type": "integer",
            "default": 0,
            "description": "Payoff for choosing different activities",
        },
    ],
    "actions": [
        {"id": "choose_activity_a", "name": "Choose Activity A", "description": "Go to activity A (preferred by one)"},
        {"id": "choose_activity_b", "name": "Choose Activity B", "description": "Go to activity B (preferred by other)"},
    ],
}

# =============================================================================
# Discussion Scenarios
# =============================================================================

_OPEN_DISCUSSION: dict[str, Any] = {
    "id": "open_discussion",
    "name": "Open Discussion",
    "category": "discussion",
    "description": (
        "Free-form conversation on any topic. Participants can speak freely, "
        "respond to others, and explore ideas collaboratively."
    ),
    "parameters": [
        {
            "name": "topic",
            "type": "string",
            "default": "",
            "description": "Discussion topic or prompt",
        },
        {
            "name": "max_turns",
            "type": "integer",
            "default": 10,
            "description": "Maximum number of speaking turns",
        },
        {
            "name": "allow_web_search",
            "type": "boolean",
            "default": False,
            "description": "Whether web search is enabled",
        },
    ],
    "actions": [
        {"id": "speak", "name": "Speak", "description": "Contribute to the discussion"},
        {"id": "respond_to", "name": "Respond To", "description": "Respond directly to another participant"},
        {"id": "ask_question", "name": "Ask Question", "description": "Pose a question to the group"},
    ],
}

_COUNCIL_CHAMBER: dict[str, Any] = {
    "id": "council_chamber",
    "name": "Council Chamber",
    "category": "discussion",
    "description": (
        "Formal deliberation with voting and procedural rules. Participants "
        "debate proposals, call for votes, and make collective decisions."
    ),
    "parameters": [
        {
            "name": "proposal_text",
            "type": "string",
            "default": "",
            "description": "Text of the proposal being debated",
        },
        {
            "name": "voting_threshold",
            "type": "float",
            "default": 0.5,
            "description": "Fraction required to pass (0-1)",
        },
        {
            "name": "max_rounds",
            "type": "integer",
            "default": 5,
            "description": "Maximum debate rounds before vote",
        },
    ],
    "actions": [
        {"id": "speak", "name": "Speak", "description": "Make a statement"},
        {"id": "call_vote", "name": "Call Vote", "description": "Initiate a vote"},
        {"id": "vote_yes", "name": "Vote Yes", "description": "Vote in favor"},
        {"id": "vote_no", "name": "Vote No", "description": "Vote against"},
        {"id": "abstain", "name": "Abstain", "description": "Neither yes nor no"},
    ],
}

# =============================================================================
# Grid Scenarios
# =============================================================================

_VILLAGE: dict[str, Any] = {
    "id": "village",
    "name": "Village",
    "category": "grid",
    "description": (
        "Grid-based village with locations and resources. Agents move between "
        "locations, gather resources, and interact with others."
    ),
    "parameters": [
        {
            "name": "grid_size",
            "type": "integer",
            "default": 10,
            "description": "Size of the grid (N x N)",
        },
        {
            "name": "resource_count",
            "type": "integer",
            "default": 5,
            "description": "Number of resource locations",
        },
        {
            "name": "starting_locations",
            "type": "list",
            "default": [],
            "description": "Optional list of starting positions",
        },
    ],
    "actions": [
        {"id": "move_north", "name": "Move North", "description": "Move one cell north"},
        {"id": "move_south", "name": "Move South", "description": "Move one cell south"},
        {"id": "move_east", "name": "Move East", "description": "Move one cell east"},
        {"id": "move_west", "name": "Move West", "description": "Move one cell west"},
        {"id": "look_around", "name": "Look Around", "description": "Observe surroundings"},
        {"id": "gather", "name": "Gather", "description": "Gather resources at current location"},
        {"id": "rest", "name": "Rest", "description": "Skip turn and recover"},
    ],
}

_TRADING_POST: dict[str, Any] = {
    "id": "trading_post",
    "name": "Trading Post",
    "category": "grid",
    "description": (
        "Market setting where agents trade resources. Agents move to trading "
        "locations, negotiate deals, and exchange items."
    ),
    "parameters": [
        {
            "name": "initial_resources",
            "type": "object",
            "default": {},
            "description": "Starting resources for each agent",
        },
        {
            "name": "trade_tax",
            "type": "float",
            "default": 0.0,
            "description": "Tax rate on trades (0-1)",
        },
        {
            "name": "max_trades",
            "type": "integer",
            "default": 10,
            "description": "Maximum trades per agent",
        },
    ],
    "actions": [
        {"id": "move_to_trader", "name": "Move to Trader", "description": "Move to a trading partner"},
        {"id": "offer_trade", "name": "Offer Trade", "description": "Propose a trade"},
        {"id": "accept_trade", "name": "Accept Trade", "description": "Accept proposed trade"},
        {"id": "reject_trade", "name": "Reject Trade", "description": "Decline trade offer"},
        {"id": "look_inventory", "name": "Check Inventory", "description": "View current resources"},
    ],
}

# =============================================================================
# Social Dynamics Scenarios
# =============================================================================

_OPINION_SPREAD: dict[str, Any] = {
    "id": "opinion_spread",
    "name": "Opinion Spread",
    "category": "social_dynamics",
    "description": (
        "Models how opinions propagate through a network. Agents hold beliefs, "
        "influence neighbors, and may update their views based on interactions."
    ),
    "parameters": [
        {
            "name": "initial_opinions",
            "type": "object",
            "default": {},
            "description": "Starting opinion values per agent",
        },
        {
            "name": "influence_strength",
            "type": "float",
            "default": 0.1,
            "description": "How much interactions change opinions (0-1)",
        },
        {
            "name": "threshold",
            "type": "float",
            "default": 0.5,
            "description": "Opinion threshold for behavior change",
        },
    ],
    "actions": [
        {"id": "express_opinion", "name": "Express Opinion", "description": "Share current view"},
        {"id": "listen", "name": "Listen", "description": "Receive others' opinions"},
        {"id": "persuade", "name": "Persuade", "description": "Attempt to influence others"},
        {"id": "update_view", "name": "Update View", "description": "Revise opinion based on input"},
    ],
}

_MARKET_NEGOTIATION: dict[str, Any] = {
    "id": "market_negotiation",
    "name": "Market Negotiation",
    "category": "social_dynamics",
    "description": (
        "Buyers and sellers negotiate prices. Agents have private valuations, "
        "make offers, and reach deals through bargaining."
    ),
    "parameters": [
        {
            "name": "buyer_valuation",
            "type": "integer",
            "default": 100,
            "description": "Maximum buyer is willing to pay",
        },
        {
            "name": "seller_cost",
            "type": "integer",
            "default": 50,
            "description": "Minimum seller is willing to accept",
        },
        {
            "name": "max_rounds",
            "type": "integer",
            "default": 10,
            "description": "Maximum negotiation rounds",
        },
    ],
    "actions": [
        {"id": "make_offer", "name": "Make Offer", "description": "Propose a price"},
        {"id": "accept_offer", "name": "Accept Offer", "description": "Accept current offer"},
        {"id": "reject_offer", "name": "Reject Offer", "description": "Reject and counter-offer"},
        {"id": "walk_away", "name": "Walk Away", "description": "End negotiations without deal"},
    ],
}

_COLLECTIVE_VOTING: dict[str, Any] = {
    "id": "collective_voting",
    "name": "Collective Voting",
    "category": "social_dynamics",
    "description": (
        "Group decision-making through voting. Agents may have preferences, "
        "form coalitions, and vote strategically."
    ),
    "parameters": [
        {
            "name": "options",
            "type": "list",
            "default": ["A", "B", "C"],
            "description": "Available voting options",
        },
        {
            "name": "voting_rule",
            "type": "string",
            "default": "plurality",
            "description": "Voting rule: plurality, majority, unanimous",
        },
        {
            "name": "secret_ballot",
            "type": "boolean",
            "default": True,
            "description": "Whether votes are secret or public",
        },
    ],
    "actions": [
        {"id": "cast_vote", "name": "Cast Vote", "description": "Vote for an option"},
        {"id": "abstain_vote", "name": "Abstain", "description": "Choose not to vote"},
        {"id": "propose_option", "name": "Propose Option", "description": "Add a new option"},
        {"id": "discuss", "name": "Discuss", "description": "Debate before voting"},
    ],
}

# =============================================================================
# Social Deduction Scenarios
# =============================================================================

_WEREWOLF: dict[str, Any] = {
    "id": "werewolf",
    "name": "Werewolf",
    "category": "social_deduction",
    "description": (
        "Hidden role game where werewolves eliminate villagers at night, "
        "and villagers vote to eliminate suspects during the day. Special "
        "roles add complexity to the deduction."
    ),
    "parameters": [
        {
            "name": "werewolf_count",
            "type": "integer",
            "default": 2,
            "description": "Number of werewolves",
        },
        {
            "name": "special_roles",
            "type": "list",
            "default": ["seer", "witch"],
            "description": "Special roles to include",
        },
        {
            "name": "night_action_order",
            "type": "list",
            "default": ["werewolf", "seer", "witch"],
            "description": "Order of night actions",
        },
    ],
    "actions": [
        {"id": "speak", "name": "Speak", "description": "Make a statement (day)"},
        {"id": "accuse", "name": "Accuse", "description": "Accuse a player (day)"},
        {"id": "vote_lynch", "name": "Vote", "description": "Vote to eliminate (day)"},
        {"id": "night_kill", "name": "Night Kill", "description": "Choose target to eliminate"},
        {"id": "inspect", "name": "Inspect", "description": "Check player's role (seer)"},
        {"id": "save", "name": "Save", "description": "Save a player (witch)"},
        {"id": "poison", "name": "Poison", "description": "Poison a player (witch)"},
    ],
}

# =============================================================================
# Custom Scenario
# =============================================================================

_CUSTOM: dict[str, Any] = {
    "id": "custom",
    "name": "Custom Scenario",
    "category": "custom",
    "description": (
        "A blank template for user-defined scenarios. Configure all parameters, "
        "actions, and rules according to specific experimental requirements."
    ),
    "parameters": [],
    "actions": [],
}

# =============================================================================
# Scenario Registry
# =============================================================================

_SCENARIOS: list[dict[str, Any]] = [
    # Game Theory
    _PRISONERS_DILEMMA,
    _STAG_HUNT,
    _PUBLIC_GOODS,
    _BATTLE_OF_SEXES,
    # Discussion
    _OPEN_DISCUSSION,
    _COUNCIL_CHAMBER,
    # Grid
    _VILLAGE,
    _TRADING_POST,
    # Social Dynamics
    _OPINION_SPREAD,
    _MARKET_NEGOTIATION,
    _COLLECTIVE_VOTING,
    # Social Deduction
    _WEREWOLF,
    # Custom
    _CUSTOM,
]

# Build lookup dict for O(1) access
_SCENARIO_MAP: dict[str, dict[str, Any]] = {s["id"]: s for s in _SCENARIOS}


# =============================================================================
# Public API
# =============================================================================

def get_all_scenarios() -> list[dict[str, Any]]:
    """Return all available scenarios.

    Returns:
        A list of scenario dictionaries, each containing:
        - id: Unique scenario identifier
        - name: Human-readable name
        - category: Scenario category (game_theory, discussion, grid, etc.)
        - description: Detailed description
        - parameters: List of configurable parameters
        - actions: List of available actions
    """
    return _SCENARIOS.copy()


def get_scenario(scenario_id: str) -> dict[str, Any] | None:
    """Get a specific scenario by ID.

    Args:
        scenario_id: The unique identifier of the scenario

    Returns:
        The scenario dictionary if found, None otherwise
    """
    return _SCENARIO_MAP.get(scenario_id)


def get_scenario_actions(scenario_id: str) -> list[dict[str, Any]]:
    """Get the available actions for a scenario.

    Args:
        scenario_id: The unique identifier of the scenario

    Returns:
        A list of action dictionaries, or an empty list if the scenario
        is not found or has no actions
    """
    scenario = _SCENARIO_MAP.get(scenario_id)
    if scenario is None:
        return []
    return scenario.get("actions", []).copy()
