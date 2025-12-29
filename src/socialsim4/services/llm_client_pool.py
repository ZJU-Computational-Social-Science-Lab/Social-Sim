"""Preconfigured simulation scenarios used by CLI and demo scripts."""

from __future__ import annotations

import copy
import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Dict, List, NamedTuple

from socialsim4.core.agent import Agent
from socialsim4.core.event import PublicEvent
from socialsim4.core.llm import create_llm_client
from socialsim4.core.llm_config import LLMConfig
from socialsim4.core.ordering import ControlledOrdering, CycledOrdering, SequentialOrdering
from socialsim4.core.scenes.council_scene import CouncilScene
from socialsim4.core.scenes.landlord_scene import LandlordPokerScene
from socialsim4.core.scenes.simple_chat_scene import SimpleChatScene
from socialsim4.core.scenes.village_scene import GameMap, VillageScene
from socialsim4.core.scenes.werewolf_scene import WerewolfScene
from socialsim4.core.simulator import Simulator


def console_logger(event_type: str, data: dict) -> None:
    if event_type == "system_broadcast":
        sender = data.get("sender")
        if not sender:
            print(f"[Public Event] {data.get('text')}")
    elif event_type == "action_end":
        action_data = data.get("action") or {}
        action_name = action_data.get("action")
        if action_name and action_name != "yield":
            print(f"[{action_name}] {data.get('summary')}")
    elif event_type == "landlord_deal":
        players = data.get("players", {})
        bottom = data.get("bottom", [])
        print("[Deal] Bottom:", " ".join(bottom))
        for name, toks in players.items():
            print(f"[Deal] {name}:", " ".join(toks))


@dataclass(slots=True)
class LLMSettings:
    dialect: str
    api_key: str | None = None
    model: str | None = None
    base_url: str | None = None
    temperature: float | None = None
    top_p: float | None = None
    frequency_penalty: float | None = None
    presence_penalty: float | None = None
    max_tokens: int | None = None


def make_clients_from_env() -> Dict[str, object]:
    settings = LLMSettings(
        dialect=os.getenv("LLM_DIALECT", "mock"),
        api_key=os.getenv("LLM_API_KEY"),
        model=os.getenv("LLM_MODEL"),
        base_url=os.getenv("LLM_BASE_URL"),
        temperature=float(os.getenv("LLM_TEMPERATURE", "0.7")),
        top_p=float(os.getenv("LLM_TOP_P", "1.0")),
        frequency_penalty=float(os.getenv("LLM_FREQUENCY_PENALTY", "0.0")),
        presence_penalty=float(os.getenv("LLM_PRESENCE_PENALTY", "0.0")),
        max_tokens=int(os.getenv("LLM_MAX_TOKENS", "1024")),
    )
    return make_clients(settings)


def make_clients(settings: LLMSettings) -> Dict[str, object]:
    dialect = (settings.dialect or "").lower()
    if dialect not in {"openai", "gemini", "mock"}:
        raise ValueError(f"Unsupported LLM dialect: {settings.dialect}")

    default_models = {
        "openai": "gpt-4o-mini",
        "gemini": "gemini-2.0-flash-exp",
        "mock": "mock",
    }

    config = LLMConfig(
        dialect=dialect,
        api_key=settings.api_key or "",
        model=settings.model or default_models[dialect],
        base_url=settings.base_url,
        temperature=settings.temperature or 0.7,
        top_p=settings.top_p or 1.0,
        frequency_penalty=settings.frequency_penalty or 0.0,
        presence_penalty=settings.presence_penalty or 0.0,
        max_tokens=settings.max_tokens or 1024,
    )

    client = create_llm_client(config)
    return {"chat": client, "default": client}


def build_landlord_sim(
    clients: Dict[str, object] | None = None,
    *,
    event_logger: Callable[[str, dict], None] = console_logger,
    num_decks: int | None = None,
) -> Simulator:
    agents = [
        Agent.deserialize(
            {
                "name": "Alice",
                "user_profile": (
                    "You are Alice, an aggressive Dou Dizhu player. You favor bold bidding and pressure opponents with bombs or sequences."
                ),
                "style": "decisive and succinct",
                "initial_instruction": "",
                "role_prompt": (
                    "Evaluate your hand honestly; call or rob when strong. Lead efficient combinations and conserve bombs for leverage."
                ),
                "action_space": ["yield"],
                "properties": {},
            }
        ),
        Agent.deserialize(
            {
                "name": "Bob",
                "user_profile": (
                    "You are Bob, a cautious Dou Dizhu player focused on safe, team-oriented play."
                ),
                "style": "calm and methodical",
                "initial_instruction": "",
                "role_prompt": "Conserve strength and avoid risky contests; cooperate when farmer, press when landlord.",
                "action_space": ["yield"],
                "properties": {},
            }
        ),
        Agent.deserialize(
            {
                "name": "Carol",
                "user_profile": (
                    "You are Carol, building plays around straights and double sequences while protecting combo potential."
                ),
                "style": "analytical and concise",
                "initial_instruction": "",
                "role_prompt": "Favor sequences and airplanes. Avoid breaking triples unless required.",
                "action_space": ["yield"],
                "properties": {},
            }
        ),
        Agent.deserialize(
            {
                "name": "Dave",
                "user_profile": (
                    "You are Dave, a power player who leverages rockets and bombs to control the board."
                ),
                "style": "direct and assertive",
                "initial_instruction": "",
                "role_prompt": "Use bombs judiciously to break landlord control; push tempo as landlord.",
                "action_space": ["yield"],
                "properties": {},
            }
        ),
    ]

    decks = num_decks or int(os.getenv("LDDZ_DECKS", "2"))
    scene = LandlordPokerScene(
        "landlord",
        "New game: Dou Dizhu (4 players). Call/rob bidding, doubling stage, full combos.",
        num_decks=decks,
    )

    active_clients = clients or make_clients_from_env()

    def next_active(sim):
        s = sim.scene
        p = s.state.get("phase")
        if p == "bidding":
            if s.state.get("bidding_stage") == "call":
                i = s.state.get("bid_turn_index")
                return (s.state.get("players") or [None])[i]
            elig = list(s.state.get("rob_eligible") or [])
            acted = dict(s.state.get("rob_acted") or {})
            if not elig:
                return None
            names = list(s.state.get("players") or [])
            start = s.state.get("bid_turn_index", 0)
            for off in range(len(names)):
                idx = (start + off) % len(names)
                name = names[idx]
                if name in elig and not acted.get(name, False):
                    return name
            return None
        if p == "doubling":
            order = list(s.state.get("doubling_order") or [])
            acted = dict(s.state.get("doubling_acted") or {})
            for name in order:
                if not acted.get(name, False):
                    return name
            return None
        if p == "playing":
            players = s.state.get("players") or []
            idx = s.state.get("current_turn", 0)
            if players:
                return players[idx % len(players)]
        return None

    sim = Simulator(
        agents,
        scene,
        active_clients,
        event_handler=event_logger,
        ordering=ControlledOrdering(next_fn=next_active),
        max_steps_per_turn=3,
    )
    sim.broadcast(PublicEvent("Players: " + ", ".join(a.name for a in agents)))
    return sim


def build_simple_chat_sim(
    clients: Dict[str, object] | None = None,
    *,
    event_logger: Callable[[str, dict], None] = console_logger,
) -> Simulator:
    agents = [
        Agent.deserialize(
            {
                "name": "Host",
                "user_profile": "You are the host of a chat room. Facilitate conversation and remain neutral.",
                "style": "welcoming and clear",
                "action_space": ["web_search", "view_page"],
                "initial_instruction": "",
                "role_prompt": "",
                "properties": {},
            }
        ),
        Agent.deserialize(
            {
                "name": "Alice",
                "user_profile": "You are Alice, an optimist excited about new technology.",
                "style": "enthusiastic and inquisitive",
                "action_space": ["web_search", "view_page"],
                "initial_instruction": "",
                "role_prompt": "",
                "properties": {},
            }
        ),
        Agent.deserialize(
            {
                "name": "Bob",
                "user_profile": "You are Bob, a pragmatic skeptic who probes potential downsides.",
                "style": "cynical and questioning",
                "action_space": ["web_search", "view_page"],
                "initial_instruction": "",
                "role_prompt": "",
                "properties": {},
            }
        ),
    ]

    scene = SimpleChatScene("room", "Welcome to the chat room.")
    active_clients = clients or make_clients_from_env()

    sim = Simulator(
        agents,
        scene,
        active_clients,
        ordering=SequentialOrdering(),
        event_handler=event_logger,
    )
    sim.broadcast(PublicEvent("Participants: " + ", ".join(a.name for a in agents)))
    sim.broadcast(
        PublicEvent(
            "News: A new study suggests AI models now match human-level performance in creative writing benchmarks."
        )
    )
    return sim


def build_simple_chat_sim_chinese(
    clients: Dict[str, object] | None = None,
    *,
    event_logger: Callable[[str, dict], None] = console_logger,
) -> Simulator:
    agents = [
        Agent.deserialize(
            {
                "name": "主持人",
                "user_profile": "你是聊天室的主持人，负责引导讨论并确保每个人都有发言机会。",
                "style": "亲切而清晰",
                "action_space": ["web_search", "view_page"],
                "initial_instruction": "",
                "role_prompt": "",
                "properties": {},
            }
        ),
        Agent.deserialize(
            {
                "name": "小李",
                "user_profile": "你是小李，对前沿科技充满热情，喜欢分享积极的观点。",
                "style": "乐观而好奇",
                "action_space": ["web_search", "view_page"],
                "initial_instruction": "",
                "role_prompt": "",
                "properties": {},
            }
        ),
        Agent.deserialize(
            {
                "name": "老周",
                "user_profile": "你是老周，更关注现实挑战和潜在风险，喜欢提出尖锐问题。",
                "style": "冷静而审慎",
                "action_space": ["web_search", "view_page"],
                "initial_instruction": "",
                "role_prompt": "",
                "properties": {},
            }
        ),
    ]

    scene = SimpleChatScene("聊天室", "欢迎来到聊天室。")
    active_clients = clients or make_clients_from_env()

    sim = Simulator(
        agents,
        scene,
        active_clients,
        ordering=SequentialOrdering(),
        event_handler=event_logger,
    )
    sim.broadcast(PublicEvent("讨论者: " + ", ".join(a.name for a in agents)))
    sim.broadcast(
        PublicEvent(
            "讨论话题：AI 是否像电力一样具备“通用性”，可以广泛赋能各个行业？请用中文展开讨论。"
        )
    )
    return sim


def build_council_sim(
    clients: Dict[str, object] | None = None,
    *,
    event_logger: Callable[[str, dict], None] = console_logger,
) -> Simulator:
    reps = [
        Agent.deserialize(
            {
                "name": "Host",
                "user_profile": (
                    "You chair the legislative council. Remain neutral, enforce procedure, and summarize fairly."
                ),
                "style": "formal and neutral",
                "initial_instruction": (
                    "Open the session by summarizing the draft, invite opening remarks, and proceed to a vote when discussion is adequate."
                ),
                "role_prompt": "",
                "action_space": ["start_voting", "finish_meeting", "request_brief"],
                "properties": {},
            }
        ),
        Agent.deserialize(
            {
                "name": "Rep. Chen Wei",
                "user_profile": "Centrist economist focused on fiscal responsibility and transit efficiency.",
                "style": "measured and data-driven",
                "initial_instruction": "",
                "role_prompt": "Support pragmatic compromises balancing budgets and benefits.",
                "action_space": ["vote"],
                "properties": {},
            }
        ),
        Agent.deserialize(
            {
                "name": "Rep. Li Na",
                "user_profile": "Progressive voice emphasizing equity and climate action.",
                "style": "principled and empathetic",
                "initial_instruction": "",
                "role_prompt": "Press for environmental standards and equity safeguards.",
                "action_space": ["vote"],
                "properties": {},
            }
        ),
        Agent.deserialize(
            {
                "name": "Rep. Zhang Rui",
                "user_profile": "Conservative representative concerned about small businesses and unintended consequences.",
                "style": "direct and skeptical",
                "initial_instruction": "",
                "role_prompt": "Highlight risks to businesses and drivers.",
                "action_space": ["vote"],
                "properties": {},
            }
        ),
        Agent.deserialize(
            {
                "name": "Rep. Wang Mei",
                "user_profile": "Business-aligned representative focused on competitiveness and logistics.",
                "style": "pragmatic and concise",
                "initial_instruction": "",
                "role_prompt": "Seek exemptions that protect merchants and logistics.",
                "action_space": ["vote"],
                "properties": {},
            }
        ),
        Agent.deserialize(
            {
                "name": "Rep. Qiao Jun",
                "user_profile": "Environmentalist pushing for ambitious climate policy and rapid emissions reduction.",
                "style": "assertive and analytical",
                "initial_instruction": "",
                "role_prompt": "Push for strong air-quality targets and transparency.",
                "action_space": ["send_message", "yield", "vote"],
                "properties": {},
            }
        ),
    ]

    draft_text = (
        "Draft Ordinance: Urban Air Quality and Congestion Management (Pilot).\n"
        "1) Establish a 12-month congestion charge pilot in the CBD with base fee 30 CNY per entry.\n"
        "2) Revenue ring-fenced for transit upgrades and air-quality programs.\n"
        "3) Monthly public dashboard on PM2.5/NOx, traffic speed, ridership.\n"
        "4) Camera enforcement with strict privacy limits.\n"
        "5) Independent evaluation at 12 months with target reductions."
    )

    scene = CouncilScene(
        "council",
        f"The chamber will now consider the following draft for debate and vote:\n{draft_text}",
    )

    active_clients = clients or make_clients_from_env()

    # 注意这里的参数顺序要和 Simulator 的签名匹配
    sim = Simulator(
        reps,
        scene,
        active_clients,
        event_handler=event_logger,
        ordering=SequentialOrdering(),
    )
    sim.broadcast(PublicEvent("Participants: " + ", ".join(a.name for a in reps)))
    return sim


def build_village_sim(
    clients: Dict[str, object] | None = None,
    *,
    event_logger: Callable[[str, dict], None] = console_logger,
) -> Simulator:
    agents = [
        Agent.deserialize(
            {
                "name": "Elias Thorne",
                "user_profile": "Reclusive scholar investigating local mysteries with rigorous observation.",
                "style": "academic and precise",
                "initial_instruction": "Investigate the ancient ruins for signs of disturbance.",
                "role_prompt": "Focus on evidence, share findings succinctly.",
                "action_space": [
                    "talk_to",
                    "yield",
                    "move_to_location",
                    "look_around",
                    "gather_resource",
                    "rest",
                ],
                "properties": {"map_xy": [3, 3]},
            }
        ),
        Agent.deserialize(
            {
                "name": "Seraphina",
                "user_profile": "Village herbalist attuned to environmental changes and healing plants.",
                "style": "gentle and mystical",
                "initial_instruction": "Collect samples near the forest edge and brew a diagnostic infusion.",
                "role_prompt": "Act sustainably and note environmental cues.",
                "action_space": [
                    "talk_to",
                    "yield",
                    "move_to_location",
                    "look_around",
                    "gather_resource",
                    "rest",
                ],
                "properties": {"map_xy": [18, 12]},
            }
        ),
        Agent.deserialize(
            {
                "name": "Kaelen",
                "user_profile": "Village blacksmith focused on practical solutions for community needs.",
                "style": "terse and direct",
                "initial_instruction": "Gather iron from the mine and reinforce the village well's pump.",
                "role_prompt": "Prioritize tasks that help the village; keep messages brief.",
                "action_space": [
                    "talk_to",
                    "yield",
                    "move_to_location",
                    "look_around",
                    "gather_resource",
                    "rest",
                ],
                "properties": {"map_xy": [10, 8]},
            }
        ),
        Agent.deserialize(
            {
                "name": "Lyra",
                "user_profile": "Adventurous cartographer mapping the region's landmarks.",
                "style": "enthusiastic and inquisitive",
                "initial_instruction": "Update maps with forest paths and locate the waterfall.",
                "role_prompt": "Explore efficiently and share wayfinding notes.",
                "action_space": [
                    "talk_to",
                    "yield",
                    "move_to_location",
                    "look_around",
                    "gather_resource",
                    "rest",
                ],
                "properties": {"map_xy": [15, 15]},
            }
        ),
    ]

    map_path = Path(__file__).resolve().parents[2] / "scripts" / "default_map.json"
    with open(map_path, "r", encoding="utf-8") as f:
        map_data = json.load(f)
    game_map = GameMap.deserialize(map_data)

    scene = VillageScene(
        "village",
        "The sun rises over Silverwood village, bringing whisper of new mysteries.",
        game_map=game_map,
    )

    active_clients = clients or make_clients_from_env()

    sim = Simulator(
        agents,
        scene,
        active_clients,
        event_handler=event_logger,
        ordering=SequentialOrdering(),
    )
    sim.broadcast(PublicEvent("Participants: " + ", ".join(a.name for a in agents)))
    sim.broadcast(
        PublicEvent(
            "Word spreads: the village well runs weak, and humming echoes near the ancient ruins after dusk."
        )
    )
    return sim


def build_werewolf_sim(
    clients: Dict[str, object] | None = None,
    *,
    event_logger: Callable[[str, dict], None] = console_logger,
) -> Simulator:
    names = [
        "Moderator",
        "Elena",
        "Bram",
        "Ronan",
        "Mira",
        "Pia",
        "Taro",
        "Ava",
        "Niko",
    ]

    role_map = {
        "Elena": "werewolf",
        "Mira": "werewolf",
        "Niko": "werewolf",
        "Bram": "witch",
        "Ronan": "seer",
    }

    def role_prompt(name: str) -> str:
        role = role_map.get(name, "villager")
        if name == "Moderator":
            return (
                "You are the Moderator. Stay neutral, manage phases, and ensure fair play."
            )
        if role == "werewolf":
            return "You are a Werewolf. Coordinate discreetly at night to eliminate villagers."
        if role == "seer":
            return "You are the Seer. Each night inspect one player to learn if they are a werewolf."
        if role == "witch":
            return "You are the Witch. You have one healing and one poison potion to use over the game."
        return "You are a Villager. Use discussion and voting to find the werewolves."

    def actions_for(name: str) -> List[str]:
        role = role_map.get(name)
        if name == "Moderator":
            return ["open_voting", "close_voting"]
        if role == "werewolf":
            return ["night_kill"]
        if role == "seer":
            return ["inspect"]
        if role == "witch":
            return ["witch_save", "witch_poison"]
        return []

    agents = [
        Agent.deserialize(
            {
                "name": name,
                "user_profile": role_prompt(name),
                "style": "concise and natural",
                "initial_instruction": "",
                "role_prompt": "",
                "action_space": actions_for(name),
                "properties": {"role": role_map.get(name)},
            }
        )
        for name in names
    ]

    participants_line = "Participants: " + ", ".join(names)
    initial_text = (
        f"Welcome to Werewolf. {participants_line}. Roles are assigned privately.\n"
        "Night has fallen. Please close your eyes."
    )
    scene = WerewolfScene("werewolf_village", initial_text, role_map=role_map, moderator_names=["Moderator"])
    active_clients = clients or make_clients_from_env()

    wolves = [n for n in names if role_map.get(n) == "werewolf"]
    witches = [n for n in names if role_map.get(n) == "witch"]
    seers = [n for n in names if role_map.get(n) == "seer"]

    ordering = CycledOrdering(wolves + wolves + seers + witches + names + names + ["Moderator"])

    sim = Simulator(
        agents,
        scene,
        active_clients,
        event_handler=event_logger,
        ordering=ordering,
    )
    return sim


class SceneSpec(NamedTuple):
    builder: Callable[[Dict[str, object], Callable[[str, dict], None]], Simulator]
    default_turns: int


SCENES: Dict[str, SceneSpec] = {
    "simple_chat_scene": SceneSpec(
        builder=lambda clients, logger=console_logger: build_simple_chat_sim(clients, event_logger=logger),
        default_turns=50,
    ),
    "simple_chat_zh": SceneSpec(
        builder=lambda clients, logger=console_logger: build_simple_chat_sim_chinese(clients, event_logger=logger),
        default_turns=50,
    ),
    "council_scene": SceneSpec(
        builder=lambda clients, logger=console_logger: build_council_sim(clients, event_logger=logger),
        default_turns=120,
    ),
    "village_scene": SceneSpec(
        builder=lambda clients, logger=console_logger: build_village_sim(clients, event_logger=logger),
        default_turns=40,
    ),
    "landlord_scene": SceneSpec(
        builder=lambda clients, logger=console_logger: build_landlord_sim(clients, event_logger=logger),
        default_turns=200,
    ),
    "werewolf_scene": SceneSpec(
        builder=lambda clients, logger=console_logger: build_werewolf_sim(clients, event_logger=logger),
        default_turns=400,
    ),
}


# ----------------------------------------------------------------------
# LLMClientPool: 为 SimTree / runtime 提供“可选强隔离”的 LLM 客户端池
# ----------------------------------------------------------------------

logger = logging.getLogger(__name__)


class LLMClientPool:
    """
    轻量级 LLM 客户端池。

    模式：
    - shared（默认）：所有分支共享同一套 LLMClient 实例（但每次 acquire 都返回新的 dict）；
    - isolated：每次 acquire() 返回一份深拷贝的 clients dict，每个分支一套独立 LLMClient。

    模式来源优先级：
    1）显式传入 mode 参数；
    2）环境变量 SIMTREE_CLIENT_POOL_MODE；
    3）默认 'shared'。
    """

    def __init__(
        self,
        base_clients: Dict[str, object],
        mode: str | None = None,
        clone_fn: Callable[[object], object] | None = None,
    ) -> None:
        # 模式解析
        if mode is None:
            mode = os.getenv("SIMTREE_CLIENT_POOL_MODE", "shared") # "isolated" "shared"

        mode = (mode or "").strip().lower()
        if mode not in ("shared", "isolated"):
            mode = "shared"

        self.mode = mode
        # 保存一份基准 clients；外面不要直接修改这份
        self._base_clients: Dict[str, object] = dict(base_clients)
        # 可选：自定义单个 client 的克隆函数
        self._clone_fn = clone_fn

        logger.info("LLMClientPool initialized with mode=%s", self.mode)

    @classmethod
    def from_base_clients(cls, base_clients: Dict[str, object]) -> "LLMClientPool":
        """
        默认工厂方法：给 SimTree 使用。

        - 若未设置环境变量 SIMTREE_CLIENT_POOL_MODE，则默认为 shared。
        - 若设置 SIMTREE_CLIENT_POOL_MODE=isolated，则启用强隔离。
        """
        return cls(base_clients, mode=None)

    def _clone_client(self, client: object) -> object:
        """
        克隆单个 client 的策略：

        1) 如果有自定义 clone_fn，则优先使用；
        2) 如果对象本身有 .clone() 方法（比如 LLMClient），则调用它；
        3) 否则退回到 deepcopy，确保内部可变状态不会共享；
        4) 再不行就直接返回原对象。
        """
        # 1) 有自定义 clone_fn 就优先用
        if self._clone_fn is not None:
            try:
                return self._clone_fn(client)
            except Exception:
                logger.exception("custom clone_fn failed; fallback to default clone strategy")

        # 2) client 自己有 clone() 方法的话，尝试调用
        clone_method = getattr(client, "clone", None)
        if callable(clone_method):
            try:
                return clone_method()
            except Exception:
                logger.exception("client.clone() failed; fallback to deepcopy")

        # 3) 使用 deepcopy，确保像 DummyClient.state 这样的内部 dict 不会共享
        try:
            return copy.deepcopy(client)
        except Exception:
            # 4) 实在不行就直接返回原对象——至少 dict 本身是新的，不会交叉修改 key/value
            return client

    def acquire(self, branch_id: str | None = None) -> Dict[str, object]:
        """
        为一个“分支”申请一份 clients dict。

        - shared 模式：返回一个新的 dict，但 value 指向同一批 LLMClient 实例；
        - isolated 模式：返回一份新的 dict，每个 value 是克隆出来的 client。
        """
        if branch_id:
            logger.debug("LLMClientPool.acquire for branch %s (mode=%s)", branch_id, self.mode)

        if self.mode == "shared":
            # 注意：这里返回的是“新的 dict”，但里面的 client 实例与 base_clients 相同。
            # 这样：
            # - 测试可以验证 dict 不同；
            # - 真实运行中仍然是“共享同一批 LLMClient 实例”，性能和原来一致。
            return dict(self._base_clients)

        # 强隔离模式：每次深拷贝 clients
        return {name: self._clone_client(c) for name, c in self._base_clients.items()}
