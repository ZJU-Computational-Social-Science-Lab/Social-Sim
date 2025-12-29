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

SCENE_MAP = {
    "simple_chat_scene": SimpleChatScene,
    "emotional_conflict_scene": SimpleChatScene,
    "council_scene": CouncilScene,
    "village_scene": VillageScene,
    "werewolf_scene": WerewolfScene,
    "landlord_scene": LandlordPokerScene,
}

ORDERING_MAP = _ORDERING_MAP

# Scene action registry: declares common (basic) actions provided by the scene
# and optional per-agent actions that can be toggled. Keep action names aligned
# with ACTION_SPACE_MAP keys.
SCENE_ACTIONS: dict[str, dict[str, list[str]]] = {
    "simple_chat_scene": {
        "basic": ["send_message", "yield"],
        "allowed": ["web_search", "view_page"],
    },
    "emotional_conflict_scene": {
        "basic": ["send_message", "yield"],
        "allowed": ["web_search", "view_page"],
    },
    "council_scene": {
        "basic": ["send_message", "voting_status", "yield"],
        "allowed": ["start_voting", "finish_meeting", "request_brief", "vote", "web_search", "view_page"],
    },
    "village_scene": {
        "basic": ["talk_to", "move_to_location", "look_around", "gather_resource", "rest", "yield"],
        "allowed": [],
    },
    "werewolf_scene": {
        "basic": ["speak", "vote_lynch", "yield"],
        "allowed": ["open_voting", "close_voting", "night_kill", "inspect", "witch_save", "witch_poison"],
    },
    "landlord_scene": {
        "basic": ["yield"],
        "allowed": ["call_landlord", "rob_landlord", "pass", "play_cards", "double", "no_double"],
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
}
