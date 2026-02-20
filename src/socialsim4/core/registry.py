from .actions.base_actions import SendMessageAction, TalkToAction, YieldAction, SpeakAction
from .actions.council_actions import (
    FinishMeetingAction,
    RequestBriefAction,
    StartVotingAction,
    VoteAction,
    VotingStatusAction,
)
from .actions.landlord_actions import (
    CallLandlordAction,
    DoubleAction,
    NoDoubleAction,
    PassAction,
    PlayCardsAction,
    RobLandlordAction,
)
from .actions.moderation_actions import ScheduleOrderAction
from .actions.village_actions import (
    # ExploreAction,
    GatherResourceAction,
    LookAroundAction,
    MoveToLocationAction,
    # QuickMoveAction,
    RestAction,
)
from .actions.web_actions import ViewPageAction, WebSearchAction
from .actions.rag_actions import QueryKnowledgeAction, ListKnowledgeAction
from .actions.werewolf_actions import (
    CloseVotingAction,
    InspectAction,
    NightKillAction,
    OpenVotingAction,
    VoteLynchAction,
    WitchPoisonAction,
    WitchSaveAction,
)
from .ordering import ORDERING_MAP as _ORDERING_MAP
from .scenes.council_scene import CouncilScene
from .scenes.landlord_scene import LandlordPokerScene
from .scenes.simple_chat_scene import SimpleChatScene
from .scenes.village_scene import VillageScene
from .scenes.werewolf_scene import WerewolfScene
# Note: ExperimentScene and RunExperimentAction are imported lazily to avoid circular import
from socialsim4.templates.loader import GenericScene

ACTION_SPACE_MAP = {
    "speak": SpeakAction(),
    "send_message": SendMessageAction(),
    # "speak": removed in favor of targeted talk_to
    "talk_to": TalkToAction(),
    "yield": YieldAction(),
    "move_to_location": MoveToLocationAction(),
    "look_around": LookAroundAction(),
    "gather_resource": GatherResourceAction(),
    "rest": RestAction(),
    # "quick_move": QuickMoveAction(),
    # "explore": ExploreAction(),
    "start_voting": StartVotingAction(),
    "finish_meeting": FinishMeetingAction(),
    "request_brief": RequestBriefAction(),
    "voting_status": VotingStatusAction(),
    "vote": VoteAction(),
    # Web actions
    "web_search": WebSearchAction(),
    "view_page": ViewPageAction(),
    # RAG actions (knowledge base)
    "query_knowledge": QueryKnowledgeAction(),
    "list_knowledge": ListKnowledgeAction(),
    # Moderation actions
    "schedule_order": ScheduleOrderAction(),
    # Werewolf actions
    "vote_lynch": VoteLynchAction(),
    "night_kill": NightKillAction(),
    "inspect": InspectAction(),
    "witch_save": WitchSaveAction(),
    "witch_poison": WitchPoisonAction(),
    # Moderator actions
    "open_voting": OpenVotingAction(),
    "close_voting": CloseVotingAction(),
    # Landlord poker actions
    "call_landlord": CallLandlordAction(),
    "rob_landlord": RobLandlordAction(),
    "pass": PassAction(),
    "play_cards": PlayCardsAction(),
    "double": DoubleAction(),
    "no_double": NoDoubleAction(),
}

# Lazy loading for RunExperimentAction to avoid circular import
def _get_run_experiment_action():
    from .scenes.experiment_scene import RunExperimentAction
    return RunExperimentAction()

# Add run_experiment action after defining the lazy loader
ACTION_SPACE_MAP["run_experiment"] = _get_run_experiment_action()

# Lazy loading for ExperimentScene to avoid circular import
def _get_experiment_scene():
    from .scenes.experiment_scene import ExperimentScene
    return ExperimentScene


SCENE_MAP = {
    "simple_chat_scene": SimpleChatScene,
    "emotional_conflict_scene": SimpleChatScene,
    "council_scene": CouncilScene,
    "village_scene": VillageScene,
    "werewolf_scene": WerewolfScene,
    "landlord_scene": LandlordPokerScene,
    "generic_scene": GenericScene,
    "experiment_template": _get_experiment_scene,
}


def get_scene_class(scene_key: str):
    """Get a scene class from SCENE_MAP, handling lazy loading.

    Args:
        scene_key: The key to look up in SCENE_MAP

    Returns:
        The scene class (callable if it was a lazy loader)
    """
    scene_cls = SCENE_MAP.get(scene_key)
    if scene_cls is None:
        return None
    # If it's a callable (lazy loader), call it to get the actual class
    if callable(scene_cls) and not isinstance(scene_cls, type):
        return scene_cls()
    return scene_cls


ORDERING_MAP = _ORDERING_MAP

# Scene action registry: declares common (basic) actions provided by the scene
# and optional per-agent actions that can be toggled. Keep action names aligned
# with ACTION_SPACE_MAP keys.
SCENE_ACTIONS: dict[str, dict[str, list[str]]] = {
    "simple_chat_scene": {
        "basic": ["send_message", "yield"],
        "allowed": ["web_search", "view_page", "query_knowledge", "list_knowledge"],
    },
    "emotional_conflict_scene": {
        "basic": ["send_message", "yield"],
        "allowed": ["web_search", "view_page", "query_knowledge", "list_knowledge"],
    },
    "council_scene": {
        "basic": ["send_message", "voting_status", "yield"],
        "allowed": ["start_voting", "finish_meeting", "request_brief", "vote", "web_search", "view_page", "query_knowledge", "list_knowledge"],
    },
    "village_scene": {
        "basic": ["talk_to", "move_to_location", "look_around", "gather_resource", "rest", "yield"],
        "allowed": ["query_knowledge", "list_knowledge"],
    },
    "werewolf_scene": {
        "basic": ["speak", "vote_lynch", "yield"],
        "allowed": ["open_voting", "close_voting", "night_kill", "inspect", "witch_save", "witch_poison"],
    },
    "landlord_scene": {
        "basic": ["yield"],
        "allowed": ["call_landlord", "rob_landlord", "pass", "play_cards", "double", "no_double"],
    },
    "generic_scene": {
        "basic": ["yield"],
        "allowed": [
            # Communication
            "send_message", "talk_to", "speak",
            # Movement
            "move_to_location",
            # Observation
            "look_around",
            # Resources
            "gather_resource", "rest",
            # Tools
            "web_search", "view_page", "query_knowledge", "list_knowledge",
            # Council
            "start_voting", "vote", "finish_meeting", "request_brief", "voting_status", "schedule_order",
            # Werewolf
            "vote_lynch", "night_kill", "inspect", "witch_save", "witch_poison", "open_voting", "close_voting",
            # Landlord
            "call_landlord", "rob_landlord", "pass", "play_cards", "double", "no_double",
        ],
    },
    "experiment_template": {
        "basic": ["run_experiment"],
        "allowed": [],
    },
}

# Scene descriptions for selection UI and docs
SCENE_DESCRIPTIONS: dict[str, str] = {
    "simple_chat_scene": "Open chat room with optional web tools. Agents converse naturally; use search/page tools when needed.",
    "emotional_conflict_scene": "Guided emotional dialogue among participants in a chat room; designed to surface and reconcile feelings.",
    "council_scene": "Legislative council debate and voting around a draft text; supports voting and status actions.",
    "village_scene": "Grid-based village simulation with movement, looking around, gathering, and resting.",
    "werewolf_scene": "Social deduction game with night/day phases and role-specific actions (moderated flow).",
    "landlord_scene": "Dou Dizhu (Landlord) card game flow with bidding, playing, and scoring stages.",
    "generic_scene": "A flexible scene type composed from template configuration. Supports custom mechanics and semantic actions.",
    "experiment_template": "Social science experiment using Three-Layer Architecture (constrained decoding, structured prompts, validation). Supports custom actions and simultaneous/sequential rounds.",
}