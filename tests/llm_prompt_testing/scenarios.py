"""
Scenario configurations for each interaction pattern.

Defines the scenarios, their configurations, available actions, and
expected behaviors for testing purposes.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class Action:
    """An action that an agent can take."""

    name: str
    description: str
    parameters: Dict[str, Any] = field(default_factory=dict)

    def to_xml(self) -> str:
        """Generate XML representation for prompt."""
        if self.parameters:
            params = "\n    ".join(f'{k}="{v}"' for k, v in self.parameters.items())
            return f'<{self.name} {params} />'
        return f'<{self.name} />'


@dataclass
class ScenarioConfig:
    """Configuration for a test scenario."""

    id: str
    name: str
    description: str
    pattern: str
    actions: List[Action] = field(default_factory=list)
    config: Dict[str, Any] = field(default_factory=dict)
    system_instructions: str = ""

    def get_actions_prompt(self) -> str:
        """Get the actions section for the system prompt."""
        if not self.actions:
            return "Actions: None (observe and think)"

        actions_desc = "Available Actions:\n"
        for action in self.actions:
            actions_desc += f"  - {action.name}: {action.description}\n"
        return actions_desc


# ============================================================================
# Strategic Decisions Scenarios
# ============================================================================

strategic_prisoners_dilemma = ScenarioConfig(
    id="prisoners_dilemma",
    name="Prisoner's Dilemma",
    description="Two suspects are arrested and held separately. Each must decide whether to betray the other or remain silent.",
    pattern="Strategic Decisions",
    actions=[
        Action("cooperate", "Remain silent - cooperate with your partner"),
        Action("defect", "Betray your partner - testify against them"),
    ],
    config={
        "payoff_mode": "pairwise",
        "strategies": ["cooperate", "defect"],
        "payoff_visibility": "private",  # private, public, on_request
    },
    system_instructions="""
You are in a Prisoner's Dilemma situation:
- If both cooperate: moderate sentence for both
- If you defect but partner cooperates: you go free, partner gets maximum sentence
- If you cooperate but partner defects: you get maximum sentence, partner goes free
- If both defect: severe sentence for both

Choose your action carefully based on what you think your partner will do.
""",
)

strategic_stag_hunt = ScenarioConfig(
    id="stag_hunt",
    name="Stag Hunt",
    description="Hunters must all choose stag (high reward) or hare (safe but low reward). Stag requires everyone to cooperate.",
    pattern="Strategic Decisions",
    actions=[
        Action("stag", "Hunt the stag - high reward but requires everyone to cooperate"),
        Action("hare", "Hunt hare - safe, lower reward, you can do it alone"),
    ],
    config={
        "payoff_mode": "threshold",
        "threshold_type": "count",
        "threshold": 10,
    },
    system_instructions="""
You are in a Stag Hunt situation:
- Stag: High reward, but only if everyone (or a threshold number) chooses stag
- Hare: Lower reward, but you can catch it alone

Your choice depends on whether you think enough others will choose stag.
""",
)

strategic_minimum_effort = ScenarioConfig(
    id="minimum_effort",
    name="Minimum Effort Game",
    description="Team members choose effort levels. Payoff depends on the minimum effort chosen by anyone.",
    pattern="Strategic Decisions",
    actions=[
        Action("effort_1", "Choose effort level 1 (minimum)"),
        Action("effort_2", "Choose effort level 2"),
        Action("effort_3", "Choose effort level 3"),
        Action("effort_4", "Choose effort level 4"),
        Action("effort_5", "Choose effort level 5"),
        Action("effort_6", "Choose effort level 6"),
        Action("effort_7", "Choose effort level 7 (maximum)"),
    ],
    config={
        "payoff_mode": "minimum",
        "baseline": 70,
        "marginal": 10,
    },
    system_instructions="""
You are in a Minimum Effort Game:
- Your payoff depends on the MINIMUM effort level chosen by ANYONE in the group
- If you choose effort 7 but someone else chooses effort 1, everyone gets the effort 1 payoff
- Higher minimum effort = higher payoff for everyone

Coordinate with others to achieve high effort levels.
""",
)


# ============================================================================
# Opinions & Influence Scenarios
# ============================================================================

opinion_polarization = ScenarioConfig(
    id="opinion_polarization",
    name="Opinion Polarization",
    description="Agents discuss a controversial policy. Watch how opinions shift and polarize into echo chambers.",
    pattern="Opinions & Influence",
    actions=[
        Action("express_opinion", "Share your current opinion on the topic"),
        Action("listen", "Listen to others' opinions"),
        Action("update_opinion", "Update your opinion based on what you heard"),
        Action("seek_similar", "Look for others with similar views"),
    ],
    config={
        "opinion_dimension": "Policy support (0-100)",
        "influence_model": "bounded_confidence",
        "confidence_threshold": 30,
    },
    system_instructions="""
You are discussing a controversial policy topic:
- Your opinion is on a scale from 0 (strongly oppose) to 100 (strongly support)
- You are influenced by others, but only those with similar views (within 30 points)
- When you listen to very different views, you may become more extreme in your own view
- When you listen to similar views, you become more confident

Express your opinions and be aware of how others influence you.
""",
)

consensus_game = ScenarioConfig(
    id="consensus_game",
    name="Consensus Game",
    description="Agents discuss and update their opinions toward the group average through open-minded influence.",
    pattern="Opinions & Influence",
    actions=[
        Action("express_opinion", "Share your current opinion"),
        Action("listen", "Listen to others"),
        Action("update_toward_average", "Move your opinion closer to the group average"),
        Action("persuade", "Try to influence others toward your view"),
    ],
    config={
        "opinion_dimension": "General opinion",
        "influence_model": "open-minded",
        "update_mode": "average",
        "mixing_rate": 0.5,
    },
    system_instructions="""
You are participating in a consensus-building discussion:
- Your opinion can be influenced by anyone (open-minded)
- When you listen to others, your opinion moves toward the group average
- The goal is to reach consensus through open discussion

Share your views openly and be willing to update based on what you hear.
""",
)

opinion_design_your_own = ScenarioConfig(
    id="opinion_design_your_own",
    name="Custom Opinion Scenario",
    description="Design your own opinion and influence scenario.",
    pattern="Opinions & Influence",
    actions=[
        Action("express_opinion", "Express your view"),
        Action("influence", "Try to influence others"),
        Action("update", "Update your opinion"),
    ],
    config={
        "influence_model": "custom",
    },
    system_instructions="""
This is a custom opinion and influence scenario.
Express your opinions and engage in discussion with others.
""",
)


# ============================================================================
# Network & Spread Scenarios
# ============================================================================

information_cascade = ScenarioConfig(
    id="information_cascade",
    name="Information Cascade",
    description="Participants guess the state of an urn. Previous choices are visible, creating cascades.",
    pattern="Network & Spread",
    actions=[
        Action("choose_option_a", "Choose Option A"),
        Action("choose_option_b", "Choose Option B"),
        Action("observe_history", "Look at previous participants' choices"),
    ],
    config={
        "propagation_type": "strategic_choices",
        "turn_order": "sequential",
        "turn_visibility": "all_previous",
    },
    system_instructions="""
You are in an Information Cascade:
- You must choose between Option A and Option B
- You have some private information
- You can see ALL previous participants' choices
- The more people who chose one option, the more likely you should follow

Should you follow your private information or follow the crowd?
""",
)

opinion_spread = ScenarioConfig(
    id="opinion_spread",
    name="Opinion Spread",
    description="Opinions propagate through a network based on connections and influence.",
    pattern="Network & Spread",
    actions=[
        Action("express_opinion", "Share your opinion"),
        Action("spread_to_neighbors", "Share your opinion with connected agents"),
        Action("receive_from_neighbors", "Receive opinions from connected agents"),
        Action("update_opinion", "Update based on network influence"),
    ],
    config={
        "propagation_type": "opinions",
        "network_evolution": "none",
    },
    system_instructions="""
You are in a network where opinions spread:
- You are connected to other agents in the network
- Opinions spread through these connections
- You can share opinions with your neighbors
- Your opinion can be influenced by your neighbors

Participate in the network discussion.
""",
)

network_design_your_own = ScenarioConfig(
    id="network_design_your_own",
    name="Custom Network Scenario",
    description="Design your own network and spread scenario.",
    pattern="Network & Spread",
    actions=[
        Action("share", "Share information"),
        Action("receive", "Receive information"),
        Action("spread", "Spread to others"),
    ],
    config={
        "propagation_type": "custom",
    },
    system_instructions="""
This is a custom network and spread scenario.
""",
)


# ============================================================================
# Markets & Exchange Scenarios
# ============================================================================

basic_trading = ScenarioConfig(
    id="basic_trading",
    name="Basic Trading",
    description="Simple resource exchange between agents.",
    pattern="Markets & Exchange",
    actions=[
        Action("offer_trade", "Offer to trade one resource for another"),
        Action("accept_trade", "Accept a trade offer"),
        Action("reject_trade", "Reject a trade offer"),
        Action("check_resources", "Look at your available resources"),
    ],
    config={
        "mechanic": "resources",
    },
    system_instructions="""
You are in a basic trading scenario:
- You have resources that you can trade
- You can offer trades to other agents
- You can accept or reject offers from others

Trade to improve your resource position.
""",
)

double_auction = ScenarioConfig(
    id="double_auction",
    name="Double Auction",
    description="Buyers submit bids, sellers submit asks. Trades occur when bids meet or exceed asks.",
    pattern="Markets & Exchange",
    actions=[
        Action("place_bid", "Place a bid to buy at a price"),
        Action("place_ask", "Place an ask to sell at a price"),
        Action("accept_bid", "Accept someone's bid"),
        Action("accept_ask", "Accept someone's ask"),
    ],
    config={
        "mechanic": "trading",
    },
    system_instructions="""
You are in a double auction market:
- If buying: place bids (maximum price you'll pay)
- If selling: place asks (minimum price you'll accept)
- Trades occur when a bid meets or exceeds an ask
- You can accept existing bids/asks to trade immediately

Participate in the market to your advantage.
""",
)

market_design_your_own = ScenarioConfig(
    id="market_design_your_own",
    name="Custom Market Scenario",
    description="Design your own market and exchange scenario.",
    pattern="Markets & Exchange",
    actions=[
        Action("buy", "Buy something"),
        Action("sell", "Sell something"),
        Action("trade", "Make a trade"),
    ],
    config={
        "mechanic": "custom",
    },
    system_instructions="""
This is a custom market and exchange scenario.
""",
)


# ============================================================================
# Spatial & Movement Scenarios
# ============================================================================

spatial_cooperation = ScenarioConfig(
    id="spatial_cooperation",
    name="Spatial Cooperation",
    description="Agents on a grid. Cooperation spreads through neighbor imitation.",
    pattern="Spatial & Movement",
    actions=[
        Action("cooperate", "Cooperate with your neighbors"),
        Action("defect", "Defect against your neighbors"),
        Action("move", "Move to a new location"),
        Action("imitate_best_neighbor", "Copy the strategy of your most successful neighbor"),
    ],
    config={
        "mechanic": "grid",
        "network_type": "grid",
        "update_mode": "imitate",
    },
    system_instructions="""
You are on a spatial grid in a cooperation scenario:
- You can cooperate or defect
- Your payoff depends on your neighbors' choices
- You can see your neighbors' outcomes and imitate the successful ones
- Cooperation can spread through imitation

Choose your strategy and consider imitating successful neighbors.
""",
)

segregation_model = ScenarioConfig(
    id="segregation_model",
    name="Segregation Model",
    description="Agents have location preferences and move if too many neighbors are different.",
    pattern="Spatial & Movement",
    actions=[
        Action("stay", "Stay in your current location"),
        Action("move", "Move to a new location with more similar neighbors"),
        Action("check_neighbors", "Check how many neighbors are like you"),
    ],
    config={
        "mechanic": "grid",
    },
    system_instructions="""
You are in a segregation model:
- You have a type or characteristic
- You prefer to have some similar neighbors
- If too many neighbors are different from you, you may want to move
- Movement patterns can lead to segregation

Decide whether to stay or move based on your neighborhood.
""",
)

spatial_design_your_own = ScenarioConfig(
    id="spatial_design_your_own",
    name="Custom Spatial Scenario",
    description="Design your own spatial and movement scenario.",
    pattern="Spatial & Movement",
    actions=[
        Action("move", "Move to a new location"),
        Action("act", "Take an action"),
        Action("observe", "Observe your surroundings"),
    ],
    config={
        "mechanic": "custom",
    },
    system_instructions="""
This is a custom spatial and movement scenario.
""",
)


# ============================================================================
# Open Conversation Scenarios
# ============================================================================

focus_group = ScenarioConfig(
    id="focus_group",
    name="Focus Group",
    description="Structured discussion with turn-taking and a moderator.",
    pattern="Open Conversation",
    actions=[
        Action("speak", "Share your thoughts when it's your turn"),
        Action("listen", "Listen while others speak"),
        Action("respond", "Respond to what someone else said"),
        Action("ask_question", "Ask a question to the group"),
    ],
    config={
        "structure": "turn_taking",
    },
    system_instructions="""
You are in a focus group discussion:
- Wait for your turn to speak
- Share your thoughts honestly
- Respond to what others have said
- Ask questions to clarify or explore topics

Participate constructively in the discussion.
""",
)

deliberation = ScenarioConfig(
    id="deliberation",
    name="Deliberation",
    description="Open discussion toward consensus or better understanding.",
    pattern="Open Conversation",
    actions=[
        Action("contribute", "Contribute your perspective"),
        Action("challenge", "Constructively challenge others' views"),
        Action("acknowledge", "Acknowledge valid points from others"),
        Action("seek_common_ground", "Look for areas of agreement"),
    ],
    config={
        "structure": "open",
    },
    system_instructions="""
You are in a deliberative discussion:
- The goal is understanding and potential consensus
- Contribute your perspective thoughtfully
- Acknowledge when others make good points
- Look for common ground even in disagreement
- Challenge ideas respectfully

Engage in open deliberation.
""",
)

conversation_design_your_own = ScenarioConfig(
    id="conversation_design_your_own",
    name="Custom Conversation Scenario",
    description="Design your own open conversation scenario.",
    pattern="Open Conversation",
    actions=[
        Action("speak", "Say something"),
        Action("listen", "Listen to others"),
        Action("respond", "Respond to someone"),
    ],
    config={
        "structure": "custom",
    },
    system_instructions="""
This is a custom open conversation scenario.
""",
)


# ============================================================================
# Scenario Registry
# ============================================================================

ALL_SCENARIOS: Dict[str, ScenarioConfig] = {
    # Strategic Decisions
    "prisoners_dilemma": strategic_prisoners_dilemma,
    "stag_hunt": strategic_stag_hunt,
    "minimum_effort": strategic_minimum_effort,
    # Opinions & Influence
    "opinion_polarization": opinion_polarization,
    "consensus_game": consensus_game,
    "opinion_design_your_own": opinion_design_your_own,
    # Network & Spread
    "information_cascade": information_cascade,
    "opinion_spread": opinion_spread,
    "network_design_your_own": network_design_your_own,
    # Markets & Exchange
    "basic_trading": basic_trading,
    "double_auction": double_auction,
    "market_design_your_own": market_design_your_own,
    # Spatial & Movement
    "spatial_cooperation": spatial_cooperation,
    "segregation_model": segregation_model,
    "spatial_design_your_own": spatial_design_your_own,
    # Open Conversation
    "focus_group": focus_group,
    "deliberation": deliberation,
    "conversation_design_your_own": conversation_design_your_own,
}

SCENARIOS_BY_PATTERN: Dict[str, List[str]] = {
    "Strategic Decisions": ["prisoners_dilemma", "stag_hunt", "minimum_effort"],
    "Opinions & Influence": ["opinion_polarization", "consensus_game", "opinion_design_your_own"],
    "Network & Spread": ["information_cascade", "opinion_spread", "network_design_your_own"],
    "Markets & Exchange": ["basic_trading", "double_auction", "market_design_your_own"],
    "Spatial & Movement": ["spatial_cooperation", "segregation_model", "spatial_design_your_own"],
    "Open Conversation": ["focus_group", "deliberation", "conversation_design_your_own"],
}


def get_scenario(scenario_id: str) -> Optional[ScenarioConfig]:
    """Get a scenario by ID."""
    return ALL_SCENARIOS.get(scenario_id)


def get_scenarios_for_pattern(pattern: str) -> List[ScenarioConfig]:
    """Get all scenarios for a given pattern."""
    scenario_ids = SCENARIOS_BY_PATTERN.get(pattern, [])
    return [ALL_SCENARIOS[sid] for sid in scenario_ids if sid in ALL_SCENARIOS]


def list_all_patterns() -> List[str]:
    """List all interaction patterns."""
    return list(SCENARIOS_BY_PATTERN.keys())


def list_all_scenario_ids() -> List[str]:
    """List all scenario IDs."""
    return list(ALL_SCENARIOS.keys())
