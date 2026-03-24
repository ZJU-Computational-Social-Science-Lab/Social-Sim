"""
Action registry for experiments.

Contains all pre-built actions that scenarios can use.
Actions are registered by name and looked up during execution.

Contains: ACTION_REGISTRY, get_action, register_action
"""
from socialsim4.core.experiment.actions.definitions import (
    ActionDefinition,
    ParameterSpec,
    EffectSpec,
)


# Pre-built action definitions
CHOOSE_ACTION = ActionDefinition(
    name="choose",
    description="Select an option from available choices",
    parameters=[
        ParameterSpec("choice", "enum", [], required=True),
    ],
    effects=[],
    requires=None,
    handler=None,
)

MOVE_ACTION = ActionDefinition(
    name="move",
    description="Move to an adjacent tile on the grid",
    parameters=[
        ParameterSpec("direction", "enum", ["north", "south", "east", "west"], required=True),
    ],
    effects=[
        EffectSpec("agent.position", "update_spatial", None),
    ],
    requires=["spatial"],
    handler=None,  # Will be set after handlers module is loaded
)

CONTRIBUTE_ACTION = ActionDefinition(
    name="contribute",
    description="Contribute resources to a pool",
    parameters=[
        ParameterSpec("amount", "number", [], required=True),
        ParameterSpec("pool", "enum", ["main"], required=False),
    ],
    effects=[
        EffectSpec("agent.resources.tokens", "subtract", "amount"),
        EffectSpec("extensions.pools.main", "add", "amount"),
    ],
    requires=["resources", "pools"],
    handler=None,
)

TALK_ACTION = ActionDefinition(
    name="talk",
    description="Send a message to another agent",
    parameters=[
        ParameterSpec("target", "agent", [], required=True),
        ParameterSpec("message", "text", [], required=True),
    ],
    effects=[],
    requires=None,
    handler=None,  # Will be set after handlers module is loaded
)

ESTIMATE_ACTION = ActionDefinition(
    name="estimate",
    description="Provide a numerical estimate",
    parameters=[
        ParameterSpec("value", "number", [], required=True),
    ],
    effects=[],
    requires=None,
    handler=None,
)

VOTE_ACTION = ActionDefinition(
    name="vote",
    description="Vote for an option",
    parameters=[
        ParameterSpec("choice", "enum", [], required=True),
    ],
    effects=[],
    requires=["voting"],
    handler=None,
)


# === Council Action Definitions ===

COUNCIL_SPEAK_ACTION = ActionDefinition(
    name="speak",
    description="Share your thoughts with the council",
    parameters=[
        ParameterSpec("message", "text", [], required=True),
    ],
    effects=[
        EffectSpec("all", "broadcast", None),
    ],
    requires=None,
    handler=None,  # Will be bound in _bind_handlers
)

COUNCIL_SKIP_ACTION = ActionDefinition(
    name="skip",
    description="Pass your turn without speaking",
    parameters=[],
    effects=[],
    requires=None,
    handler=None,  # Simple action, no handler needed
)

START_VOTING_ACTION = ActionDefinition(
    name="start_voting",
    description="Initiate voting on the proposal",
    parameters=[
        ParameterSpec("title", "text", [], required=False),
    ],
    effects=[
        EffectSpec("voting_started", "state_change", None),
    ],
    requires=None,
    handler=None,  # Will be bound in _bind_handlers
)

COUNCIL_VOTE_ACTION = ActionDefinition(
    name="council_vote",
    description="Cast your vote (yes/no/abstain)",
    parameters=[
        ParameterSpec("choice", "enum", ["yes", "no", "abstain"], required=True),
    ],
    effects=[
        EffectSpec("votes", "state_change", None),
    ],
    requires=["voting_started"],
    handler=None,  # Will be bound in _bind_handlers
)

CONCLUDE_ACTION = ActionDefinition(
    name="conclude",
    description="End the meeting after voting",
    parameters=[],
    effects=[
        EffectSpec("concluded", "state_change", None),
    ],
    requires=["voting_started"],
    handler=None,  # Will be bound in _bind_handlers
)

VOTE_YES_ACTION = ActionDefinition(
    name="vote_yes",
    description="Vote in favor of the proposal",
    parameters=[],
    effects=[
        EffectSpec("votes", "state_change", None),
    ],
    requires=["voting_started"],
    handler=None,  # Will be bound in _bind_handlers
)

VOTE_NO_ACTION = ActionDefinition(
    name="vote_no",
    description="Vote against the proposal",
    parameters=[],
    effects=[
        EffectSpec("votes", "state_change", None),
    ],
    requires=["voting_started"],
    handler=None,  # Will be bound in _bind_handlers
)

ABSTAIN_ACTION = ActionDefinition(
    name="abstain",
    description="Abstain from voting (neither yes nor no)",
    parameters=[],
    effects=[
        EffectSpec("votes", "state_change", None),
    ],
    requires=["voting_started"],
    handler=None,  # Will be bound in _bind_handlers
)


# === PGG Punishment Action ===

PUNISH_ACTION = ActionDefinition(
    name="punish",
    description="Spend punishment tokens to reduce another agent's payoff",
    parameters=[
        ParameterSpec("target", "agent", [], required=True),
        ParameterSpec("amount", "number", [], required=True),
    ],
    effects=[
        EffectSpec("agent.resources.punishment_budget", "subtract", "amount"),
    ],
    requires=["resources"],
    handler=None,  # Will be bound in _bind_handlers
)


# The registry dictionary
ACTION_REGISTRY: dict[str, ActionDefinition] = {
    "choose": CHOOSE_ACTION,
    "move": MOVE_ACTION,
    "contribute": CONTRIBUTE_ACTION,
    "talk": TALK_ACTION,
    "estimate": ESTIMATE_ACTION,
    "vote": VOTE_ACTION,
    # Council actions - minimal set for controlled experiments
    "speak": COUNCIL_SPEAK_ACTION,
    "skip": COUNCIL_SKIP_ACTION,
    "start_voting": START_VOTING_ACTION,  # Keep for backward compatibility
    "council_vote": COUNCIL_VOTE_ACTION,  # Keep for backward compatibility
    "vote_yes": VOTE_YES_ACTION,  # NEW - explicit vote action
    "vote_no": VOTE_NO_ACTION,    # NEW - explicit vote action
    "abstain": ABSTAIN_ACTION,    # NEW - explicit vote action
    "conclude": CONCLUDE_ACTION,  # Keep for backward compatibility
    # PGG punishment action
    "punish": PUNISH_ACTION,
}


def get_action(name: str) -> ActionDefinition | None:
    """Get action definition by name.

    Args:
        name: Action name

    Returns:
        ActionDefinition or None if not found
    """
    return ACTION_REGISTRY.get(name)


def register_action(action: ActionDefinition) -> None:
    """Register a new action or override existing.

    Args:
        action: ActionDefinition to register
    """
    ACTION_REGISTRY[action.name] = action


# Late binding of handlers to avoid circular imports
def _bind_handlers():
    """Bind handler functions to actions after module load."""
    from socialsim4.core.experiment.actions.handlers import (
        handle_move,
        handle_talk,
        handle_council_speak,
        handle_start_voting,
        handle_vote,
        handle_vote_yes,
        handle_vote_no,
        handle_abstain,
        handle_conclude,
        handle_punish,
    )
    ACTION_REGISTRY["move"].handler = handle_move
    ACTION_REGISTRY["talk"].handler = handle_talk
    # Council action handlers
    ACTION_REGISTRY["speak"].handler = handle_council_speak
    ACTION_REGISTRY["start_voting"].handler = handle_start_voting
    ACTION_REGISTRY["council_vote"].handler = handle_vote
    ACTION_REGISTRY["vote_yes"].handler = handle_vote_yes
    ACTION_REGISTRY["vote_no"].handler = handle_vote_no
    ACTION_REGISTRY["abstain"].handler = handle_abstain
    ACTION_REGISTRY["conclude"].handler = handle_conclude
    # PGG punishment action handler
    ACTION_REGISTRY["punish"].handler = handle_punish


# Bind handlers on first import
_bind_handlers()
