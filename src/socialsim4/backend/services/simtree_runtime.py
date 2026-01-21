from __future__ import annotations

import asyncio
import logging
from typing import Dict

from socialsim4.core.agent import Agent
from socialsim4.core.event import PublicEvent
from socialsim4.core.ordering import ControlledOrdering, CycledOrdering, SequentialOrdering
from socialsim4.core.registry import ACTION_SPACE_MAP, SCENE_ACTIONS, SCENE_MAP
from socialsim4.core.simtree import SimTree
from socialsim4.core.simulator import Simulator
from socialsim4.scenarios.basic import make_clients_from_env


logger = logging.getLogger(__name__)


def _normalize_language(value: str | None) -> str:
    lang = str(value or "").strip()
    return lang or "Simplified Chinese"


def _is_english_language(lang: str) -> bool:
    lower = lang.lower()
    return lower.startswith("en") or "english" in lower


class SimTreeRecord:
    def __init__(self, tree: SimTree):
        self.tree = tree
        # 用于“一棵树所有节点事件”的广播订阅（DevUI 左侧总线）
        self.subs: list[asyncio.Queue] = []
        # 正在运行的节点 ID 集合（用于只转发 running 节点的事件）
        self.running: set[int] = set()


def _quiet_logger(event_type: str, data: dict) -> None:
    return


def _build_tree_for_scene(scene_type: str, clients: dict | None = None) -> SimTree:
    # Normalize scene_type to registry keys (allow aliases like 'village' -> 'village_scene')
    scene_key = scene_type if scene_type in SCENE_MAP else f"{scene_type}_scene"
    scene_cls = SCENE_MAP.get(scene_key)
    if scene_cls is None:
        raise ValueError(f"Unsupported scene type: {scene_type}")
    active = clients or make_clients_from_env()
    scene = scene_cls("preview", "")
    agents = [
        # minimal placeholder agent; real agents come from agent_config at runtime
        Agent.deserialize(
            {
                "name": "Alice",
                "user_profile": "",
                "style": "",
                "initial_instruction": "",
                "role_prompt": "",
                "action_space": [],
                "properties": {},
            }
        )
    ]
    sim = Simulator(agents, scene, active, event_handler=_quiet_logger, ordering=SequentialOrdering())
    return SimTree.new(sim, active)


def _apply_agent_config(simulator, agent_config: dict | None):
    if not agent_config:
        return
    items = agent_config.get("agents") or []
    agents_list = list(simulator.agents.values())
    count = min(len(items), len(agents_list))
    # First apply names/profiles by position, then rebuild mapping
    for i in range(count):
        cfg = items[i] or {}
        agent = agents_list[i]
        new_name = str(cfg.get("name") or "").strip()
        if new_name:
            agent.name = new_name
        profile = str(cfg.get("profile") or "").strip()
        if profile:
            agent.user_profile = profile
        language = str(cfg.get("language") or "").strip()
        if language:
            agent.language = language
    # Rebuild agents mapping to reflect renames
    simulator.agents = {a.name: a for a in agents_list}
    # Now apply actions (scene common + selected) per agent
    for i in range(count):
        cfg = items[i] or {}
        agent = agents_list[i]
        selected = [str(a) for a in (cfg.get("action_space") or [])]
        scene_actions = simulator.scene.get_scene_actions(agent) or []
        picked = []
        for key in selected:
            act = ACTION_SPACE_MAP.get(key)
            if act is not None:
                picked.append(act)
        merged = []
        seen: set[str] = set()
        for act in list(scene_actions) + picked:
            n = getattr(act, "NAME", None)
            if n and n not in seen:
                merged.append(act)
                seen.add(n)
        agent.action_space = merged
    # Refresh ordering candidates after renames
    simulator.ordering.set_simulation(simulator)


def _build_tree_for_sim(sim_record, clients: dict | None = None) -> SimTree:
    print(f"[KB-DEBUG] _build_tree_for_sim: Building tree for sim {sim_record.id}")
    scene_type = sim_record.scene_type
    # Normalize scene_type to registry keys (allow aliases like 'village' -> 'village_scene')
    scene_key = scene_type if scene_type in SCENE_MAP else f"{scene_type}_scene"
    scene_cls = SCENE_MAP.get(scene_key)
    if scene_cls is None:
        raise ValueError(f"Unsupported scene type: {scene_type}")

    cfg = getattr(sim_record, "scene_config", {}) or {}
    name = getattr(sim_record, "name", scene_type)

    agent_config = getattr(sim_record, "agent_config", {}) or {}
    print(f"[KB-DEBUG] _build_tree_for_sim: agent_config keys: {list(agent_config.keys())}")
    items = agent_config.get("agents") or []
    print(f"[KB-DEBUG] _build_tree_for_sim: Found {len(items)} agents in config")
    for i, agent in enumerate(items):
        kb = agent.get("knowledgeBase", [])
        print(f"[KB-DEBUG]   Agent {i} '{agent.get('name', 'unknown')}': {len(kb)} knowledge items, keys: {list(agent.keys())}")
        for j, item in enumerate(kb):
            print(f"[KB-DEBUG]     KB Item {j}: id={item.get('id')}, title='{item.get('title', '')[:50]}', enabled={item.get('enabled')}")
    first_language = None
    for cfg_agent in items:
        lang = str(cfg_agent.get("language") or "").strip()
        if lang:
            first_language = lang
            break
    preferred_language = _normalize_language(cfg.get("language") or first_language)

    def _localized(en_text: str, zh_text: str) -> str:
        return en_text if _is_english_language(preferred_language) else zh_text

    # Build scene via constructor based on type
    # Use normalized scene_key for matching below
    if scene_key in {"simple_chat_scene", "emotional_conflict_scene"}:
        # Use generalized initial events; constructor initial can be empty
        scene = scene_cls(name, "")
    elif scene_key == "council_scene":
        draft = str(cfg.get("draft_text") or "")
        scene = scene_cls(name, "")
    elif scene_key == "village_scene":
        from socialsim4.core.scenes.village_scene import GameMap

        # 如果未提供 map 配置，则使用 GameMap 的默认空地图
        map_data = cfg.get("map") or {}
        game_map = GameMap.deserialize(map_data)
        movement_cost = int(cfg.get("movement_cost", 1))
        chat_range = int(cfg.get("chat_range", 5))
        print_map_each_turn = bool(cfg.get("print_map_each_turn", False))
        scene = scene_cls(
            name,
            _localized("Welcome to the village.", "欢迎来到村庄。"),
            game_map=game_map,
            movement_cost=movement_cost,
            chat_range=chat_range,
            print_map_each_turn=print_map_each_turn,
        )
    elif scene_key == "landlord_scene":
        num_decks = int(cfg.get("num_decks", 1))
        seed = cfg.get("seed")
        seed_int = int(seed) if seed is not None else None
        scene = scene_cls(
            name,
            _localized("New game: Dou Dizhu.", "新一局斗地主开始。"),
            seed=seed_int,
            num_decks=num_decks,
        )
    elif scene_key == "werewolf_scene":
        initial_cfg = str(cfg.get("initial_event") or "").strip()
        initial = initial_cfg or _localized("Welcome to Werewolf.", "欢迎来到狼人游戏。")
        role_map = cfg.get("role_map") or None
        moderator_names = cfg.get("moderator_names") or None
        scene = scene_cls(name, initial, role_map=role_map, moderator_names=moderator_names)
    else:
        scene = scene_cls(name, str(cfg.get("initial_event") or ""))

    # 存储社交网络拓扑到场景状态中（如果配置了的话）
    social_network = cfg.get("social_network") or {}
    if social_network:
        scene.state["social_network"] = social_network

    if hasattr(scene, "initial_event") and isinstance(scene.initial_event, PublicEvent):
        if not getattr(scene.initial_event, "code", None):
            scene.initial_event.code = "initial_event"
        if not getattr(scene.initial_event, "params", None):
            content = getattr(scene.initial_event, "content", "")
            scene.initial_event.params = {"content": content, "lang": preferred_language}

    # Build agents from agent_config
    built_agents = []
    emotion_enabled = cfg["emotion_enabled"] if ("emotion_enabled" in cfg) else False
    for cfg_agent in items:
        aname = str(cfg_agent.get("name") or "").strip() or "Agent"
        profile = str(cfg_agent.get("profile") or "")
        selected = [str(a) for a in (cfg_agent.get("action_space") or [])]
        props = dict(cfg_agent.get("properties") or {})
        if "emotion_enabled" not in props:
            props["emotion_enabled"] = emotion_enabled
        language = _normalize_language(cfg_agent.get("language") or preferred_language)
        # scene common actions from registry (fallback to scene introspection)
        # Use normalized scene_key so short names (e.g., 'village') map correctly.
        reg = SCENE_ACTIONS.get(scene_key, {})
        basic_names = list(reg.get("basic", []))

        seen = set()
        merged_names = []
        for n in basic_names + selected:
            if n and n not in seen:
                seen.add(n)
                merged_names.append(n)
        # Get knowledge base from agent config
        knowledge_base = list(cfg_agent.get("knowledgeBase") or cfg_agent.get("knowledge_base") or [])
        # Get documents from agent config
        documents = dict(cfg_agent.get("documents") or {})
        print(f"[KB-DEBUG] Building agent '{aname}': passing {len(knowledge_base)} KB items, {len(documents)} documents to Agent.deserialize")
        agent_data = {
            "name": aname,
            "user_profile": profile,
            "style": "",
            "initial_instruction": "",
            "role_prompt": "",
            "language": language,
            "action_space": merged_names,
            "properties": props,
            "knowledge_base": knowledge_base,
            "documents": documents,
        }
        new_agent = Agent.deserialize(agent_data)
        print(f"[KB-DEBUG] After deserialize, agent '{aname}' has {len(new_agent.knowledge_base)} KB items, {len(new_agent.documents)} documents")
        built_agents.append(new_agent)

    ordering = SequentialOrdering()
    if scene_type == "landlord_scene":

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

        ordering = ControlledOrdering(next_fn=next_active)
    elif scene_type == "werewolf_scene":
        # Build cycled schedule similar to scenario builder
        roles = cfg.get("role_map") or {}
        names = [a.name for a in built_agents]
        wolves = [n for n in names if roles.get(n) == "werewolf"]
        witches = [n for n in names if roles.get(n) == "witch"]
        seers = [n for n in names if roles.get(n) == "seer"]
        seq = wolves + wolves + seers + witches + names + names + ["Moderator"]
        ordering = CycledOrdering(seq)

    sim = Simulator(
        built_agents,
        scene,
        clients or make_clients_from_env(),
        event_handler=_quiet_logger,
        ordering=ordering,
        max_steps_per_turn=3 if scene_type == "landlord_scene" else 5,
        emotion_enabled=emotion_enabled,
    )
    # Set global knowledge reference on all agents
    global_knowledge = cfg.get("global_knowledge", {})
    if global_knowledge:
        for agent in built_agents:
            agent.set_global_knowledge(global_knowledge)
        print(f"[KB-DEBUG] Set global knowledge ({len(global_knowledge)} items) on {len(built_agents)} agents")

    # Broadcast configured initial events as public events
    for text in cfg.get("initial_events") or []:
        if isinstance(text, str) and text.strip():
            ev = PublicEvent(text)
            ev.code = "initial_event"
            ev.params = {"content": text, "lang": preferred_language}
            sim.broadcast(ev)
    # For council, include draft announcement as an initial event if provided
    if scene_type == "council_scene":
        draft = str(cfg.get("draft_text") or "").strip()
        if draft:
            text = _localized(
                "The chamber will now consider the following draft for debate and vote:\n{draft}",
                "议事厅将讨论并表决以下草案：\n{draft}",
            ).format(draft=draft)
            ev = PublicEvent(text)
            ev.code = "council_draft"
            ev.params = {"draft": draft, "lang": preferred_language}
            sim.broadcast(ev)
    return SimTree.new(sim, sim.clients)


class SimTreeRegistry:
    def __init__(self) -> None:
        self._records: Dict[str, SimTreeRecord] = {}
        self._lock = asyncio.Lock()

    async def get_or_create(self, simulation_id: str, scene_type: str, clients: dict | None = None) -> SimTreeRecord:
        key = simulation_id.upper()
        record = self._records.get(key)
        if record is not None:
            return record
        async with self._lock:
            record = self._records.get(key)
            if record is not None:
                return record
            tree = await asyncio.to_thread(_build_tree_for_scene, scene_type, clients)
            record = SimTreeRecord(tree)
            # Wire event loop for thread-safe fanout
            loop = asyncio.get_running_loop()
            tree.attach_event_loop(loop)

            def _fanout(event: dict) -> None:
                # 只转发当前 running 的节点事件
                if int(event.get("node", -1)) not in record.running:
                    return
                for q in list(record.subs):
                    try:
                        loop.call_soon_threadsafe(q.put_nowait, event)
                    except Exception:  # 极端情况保护，避免某个坏订阅拖垮其他订阅
                        logger.exception("failed to fanout event to tree subscriber")

            tree.set_tree_broadcast(_fanout)
            self._records[key] = record
            return record

    async def get_or_create_from_sim(self, sim_record, clients: dict | None = None) -> SimTreeRecord:
        key = sim_record.id.upper()
        record = self._records.get(key)
        if record is not None:
            return record
        async with self._lock:
            record = self._records.get(key)
            if record is not None:
                return record
            tree = await asyncio.to_thread(_build_tree_for_sim, sim_record, clients)
            record = SimTreeRecord(tree)
            loop = asyncio.get_running_loop()
            tree.attach_event_loop(loop)

            def _fanout(event: dict) -> None:
                if int(event.get("node", -1)) not in record.running:
                    return
                for q in list(record.subs):
                    try:
                        loop.call_soon_threadsafe(q.put_nowait, event)
                    except Exception:
                        logger.exception("failed to fanout event to tree subscriber")

            tree.set_tree_broadcast(_fanout)
            self._records[key] = record
            return record

    def remove(self, simulation_id: str) -> None:
        self._records.pop(simulation_id.upper(), None)

    def get(self, simulation_id: str) -> SimTreeRecord | None:
        return self._records.get(simulation_id.upper())

    def update_agent_knowledge(self, simulation_id: str, agent_config: dict) -> bool:
        """
        Update agent knowledge bases and documents in all nodes of an existing tree.
        This preserves simulation state while updating knowledge.

        IMPORTANT: This function MERGES knowledge/documents - it only updates agents
        that are explicitly in the config, and preserves existing data for agents
        not in the config.

        Returns True if tree was found and updated, False if no tree exists.
        """
        key = simulation_id.upper()
        record = self._records.get(key)
        if record is None:
            print(f"[KB-DEBUG] update_agent_knowledge: No cached tree for sim {simulation_id}")
            return False

        # Build a mapping of agent name -> knowledge base and documents from the new config
        # Only include agents that have the respective keys defined
        agents_config = agent_config.get("agents", [])
        kb_by_name = {}
        docs_by_name = {}
        for agent_cfg in agents_config:
            name = agent_cfg.get("name", "")
            # Only update knowledge base if explicitly present in config
            if "knowledgeBase" in agent_cfg:
                kb_by_name[name] = agent_cfg["knowledgeBase"]
            # Only update documents if explicitly present in config
            if "documents" in agent_cfg:
                docs_by_name[name] = agent_cfg["documents"]
            print(f"[KB-DEBUG] update_agent_knowledge: {name} -> {len(kb_by_name.get(name, []))} KB items, {len(docs_by_name.get(name, {}))} documents")

        # Update knowledge base and documents in all tree nodes
        tree = record.tree
        nodes_updated = 0
        for node_id, node_data in tree.nodes.items():
            sim = node_data.get("sim")
            if sim is None:
                continue
            for agent_name, agent in sim.agents.items():
                # Only update knowledge base if we have new data for this agent
                if agent_name in kb_by_name:
                    old_kb_count = len(agent.knowledge_base)
                    agent.knowledge_base = list(kb_by_name[agent_name])
                    new_kb_count = len(agent.knowledge_base)
                    print(f"[KB-DEBUG] update_agent_knowledge: Node {node_id}, agent '{agent_name}': {old_kb_count} -> {new_kb_count} KB items")
                # Only update documents if we have new data for this agent
                if agent_name in docs_by_name:
                    old_docs_count = len(agent.documents)
                    agent.documents = dict(docs_by_name[agent_name])
                    new_docs_count = len(agent.documents)
                    print(f"[KB-DEBUG] update_agent_knowledge: Node {node_id}, agent '{agent_name}': {old_docs_count} -> {new_docs_count} documents")
            nodes_updated += 1

        print(f"[KB-DEBUG] update_agent_knowledge: Updated {nodes_updated} nodes in tree for sim {simulation_id}")
        return True

    def update_global_knowledge(self, simulation_id: str, global_knowledge: dict) -> bool:
        """
        Update global knowledge reference in all agents of an existing tree.

        Returns True if tree was found and updated, False if no tree exists.
        """
        key = simulation_id.upper()
        record = self._records.get(key)
        if record is None:
            print(f"[KB-DEBUG] update_global_knowledge: No cached tree for sim {simulation_id}")
            return False

        # Update global knowledge in all tree nodes
        tree = record.tree
        nodes_updated = 0
        agents_updated = 0
        for node_id, node_data in tree.nodes.items():
            sim = node_data.get("sim")
            if sim is None:
                continue
            for agent_name, agent in sim.agents.items():
                agent.set_global_knowledge(global_knowledge)
                agents_updated += 1
            nodes_updated += 1

        print(f"[KB-DEBUG] update_global_knowledge: Updated {agents_updated} agents in {nodes_updated} nodes for sim {simulation_id}")
        return True


SIM_TREE_REGISTRY = SimTreeRegistry()