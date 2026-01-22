import asyncio
import logging
from datetime import datetime, timezone

from jose import JWTError, jwt
from litestar import Router, delete, get, patch, post, websocket
from litestar.connection import Request, WebSocket
from litestar.exceptions import WebSocketDisconnect, HTTPException  # ✅ 新增 HTTPException
from sqlalchemy import select, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession

from socialsim4.core.llm import create_llm_client
from socialsim4.core.llm_config import LLMConfig, guess_supports_vision
from socialsim4.core.search_config import SearchConfig
from socialsim4.core.simtree import SimTree
from socialsim4.core.tools.web.search import create_search_client

from ...core.database import get_session
from ...dependencies import extract_bearer_token, resolve_current_user, settings
from ...models.simulation import Simulation, SimulationLog, SimulationSnapshot
from ...models.user import ProviderConfig, SearchProviderConfig, User
from ...schemas.common import Message
from ...schemas.simtree import (
    SimulationTreeAdvanceChainPayload,
    SimulationTreeAdvanceFrontierPayload,
    SimulationTreeAdvanceMultiPayload,
    SimulationTreeBranchPayload,
)
from ...schemas.simulation import (
    SimulationBase,
    SimulationCreate,
    SimulationLogEntry,
    SimulationUpdate,
    SnapshotBase,
    SnapshotCreate,
)
from ...services.simtree_runtime import SIM_TREE_REGISTRY, SimTreeRecord
from ...services.simulations import generate_simulation_id, generate_simulation_name


logger = logging.getLogger(__name__)


async def _get_simulation_for_owner(
    session: AsyncSession,
    owner_id: int,
    simulation_id: str,
) -> Simulation:
    result = await session.execute(
        select(Simulation).where(
            Simulation.owner_id == owner_id, Simulation.id == simulation_id.upper()
        )
    )
    return result.scalar_one()


async def _get_tree_record(
    sim: Simulation, session: AsyncSession, user_id: int
) -> SimTreeRecord:
    # 根据 user_id（也就是 sim.owner_id）加载对应的 LLM Provider
    result = await session.execute(
        select(ProviderConfig).where(ProviderConfig.user_id == user_id)
    )
    items = result.scalars().all()
    active = [p for p in items if (p.config or {}).get("active")]
    if len(active) != 1:
        raise HTTPException(status_code=400, detail="LLM provider not configured (need exactly one active)")
    provider = active[0]
    dialect = (provider.provider or "").lower()
    if dialect not in {"openai", "gemini", "mock", "ollama"}:
        raise HTTPException(status_code=400, detail="Invalid LLM provider dialect")
    if dialect in {"openai", "gemini"} and not provider.api_key:
        raise HTTPException(status_code=400, detail="LLM API key required")
    if not provider.model:
        raise HTTPException(status_code=400, detail="LLM model required")

    cfg = LLMConfig(
        dialect=dialect,
        api_key=provider.api_key or "",
        model=provider.model,
        base_url=provider.base_url or ("http://127.0.0.1:11434" if dialect == "ollama" else None),
        temperature=0.7,
        top_p=1.0,
        frequency_penalty=0.0,
        presence_penalty=0.0,
        max_tokens=1024,
        supports_vision=guess_supports_vision(provider.model),
    )
    llm_client = create_llm_client(cfg)

    # 搜索 Provider
    result_s = await session.execute(
        select(SearchProviderConfig).where(SearchProviderConfig.user_id == user_id)
    )
    sprov = result_s.scalars().first()
    if sprov is None:
        s_cfg = SearchConfig(dialect="ddg", api_key="", base_url=None, params={})
    else:
        s_cfg = SearchConfig(
            dialect=(sprov.provider or "ddg"),
            api_key=sprov.api_key or "",
            base_url=sprov.base_url,
            params=sprov.config or {},
        )
    search_client = create_search_client(s_cfg)
    clients = {"chat": llm_client, "default": llm_client, "search": search_client}
    return await SIM_TREE_REGISTRY.get_or_create_from_sim(sim, clients)


async def _get_simulation_and_tree(
    session: AsyncSession,
    owner_id: int,
    simulation_id: str,
) -> tuple[Simulation, SimTreeRecord]:
    sim = await _get_simulation_for_owner(session, owner_id, simulation_id)
    record = await _get_tree_record(sim, session, owner_id)
    return sim, record


# ✅ 新增：不依赖当前登录用户，而是直接按 simulation_id + sim.owner_id 找树
async def _get_simulation_and_tree_any(
    session: AsyncSession,
    simulation_id: str,
) -> tuple[Simulation, SimTreeRecord]:
    sim = await session.get(Simulation, simulation_id.upper())
    if sim is None:
        raise HTTPException(status_code=404, detail="Simulation not found")
    record = await _get_tree_record(sim, session, sim.owner_id)
    return sim, record


async def _resolve_user_from_token(token: str, session: AsyncSession) -> User | None:
    if not token:
        return None
    try:
        payload = jwt.decode(
            token,
            settings.jwt_signing_key.get_secret_value(),
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError:
        return None
    subject = payload.get("sub")
    if subject is None:
        return None
    user = await session.get(User, int(subject))
    if user is None or not user.is_active:
        return None
    return user


def _broadcast(record: SimTreeRecord, event: dict) -> None:
    # 树级广播：仅用于 HTTP 触发的 run_start / run_finish / attached 等事件
    for queue in list(record.subs):
        try:
            queue.put_nowait(event)
        except Exception:
            logger.exception("failed to enqueue tree-level broadcast event")


# -------------------------------------------------------------------
# 基本 Simulation CRUD（仍然需要鉴权）
# -------------------------------------------------------------------


@get("/")
async def list_simulations(request: Request) -> list[SimulationBase]:
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)
        result = await session.execute(
            select(Simulation)
            .where(Simulation.owner_id == current_user.id)
            .order_by(Simulation.created_at.desc())
        )
        sims = result.scalars().all()
        return [SimulationBase.model_validate(sim) for sim in sims]


@post("/", status_code=201)
async def create_simulation(request: Request, data: SimulationCreate) -> SimulationBase:
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)
        result = await session.execute(
            select(ProviderConfig).where(ProviderConfig.user_id == current_user.id)
        )
        provider = result.scalars().first()
        if provider is None:
            raise RuntimeError("LLM provider not configured")
        dialect = (provider.provider or "").lower()
        if dialect not in {"openai", "gemini", "mock", "ollama"}:
            raise RuntimeError("Invalid LLM provider dialect")
        if dialect in {"openai", "gemini"} and not provider.api_key:
            raise RuntimeError("LLM API key required")
        if not provider.model:
            raise RuntimeError("LLM model required")

        sim_id = generate_simulation_id()
        name = data.name or generate_simulation_name(sim_id)
        sim = Simulation(
            id=sim_id,
            owner_id=current_user.id,
            name=name,
            scene_type=data.scene_type,
            scene_config=data.scene_config,
            agent_config=data.agent_config,
            status="draft",
        )
        session.add(sim)
        await session.commit()
        await session.refresh(sim)
        return SimulationBase.model_validate(sim)


@get("/{simulation_id:str}")
async def read_simulation(request: Request, simulation_id: str) -> SimulationBase:
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)
        sim = await _get_simulation_for_owner(session, current_user.id, simulation_id)
        return SimulationBase.model_validate(sim)


@patch("/{simulation_id:str}")
async def update_simulation(
    request: Request, simulation_id: str, data: SimulationUpdate
) -> SimulationBase:
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)
        sim = await _get_simulation_for_owner(session, current_user.id, simulation_id)

        if data.name is not None:
            sim.name = data.name
        if data.status is not None:
            sim.status = data.status
        if data.notes is not None:
            sim.notes = data.notes

        await session.commit()
        await session.refresh(sim)
        return SimulationBase.model_validate(sim)


@delete("/{simulation_id:str}", status_code=204)
async def delete_simulation(request: Request, simulation_id: str) -> None:
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)
        sim = await _get_simulation_for_owner(session, current_user.id, simulation_id)
        await session.delete(sim)
        await session.commit()
        SIM_TREE_REGISTRY.remove(simulation_id)


@post("/{simulation_id:str}/reset")
async def reset_simulation(request: Request, simulation_id: str) -> Message:
    """重新构建仿真树，清空日志/快照并返回成功消息。"""
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)
        sim = await _get_simulation_for_owner(session, current_user.id, simulation_id)

        # 清空日志与快照，移除运行态树
        await session.execute(sa_delete(SimulationLog).where(SimulationLog.simulation_id == sim.id))
        await session.execute(sa_delete(SimulationSnapshot).where(SimulationSnapshot.simulation_id == sim.id))
        await session.commit()
        SIM_TREE_REGISTRY.remove(sim.id)

        # 重新创建树并登记
        await _get_tree_record(sim, session, current_user.id)

        return Message(message="Simulation reset and tree rebuilt")


@post("/{simulation_id:str}/save", status_code=201)
async def create_snapshot(
    request: Request, simulation_id: str, data: SnapshotCreate
) -> SnapshotBase:
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)
        sim = await _get_simulation_for_owner(session, current_user.id, simulation_id)
        record = SIM_TREE_REGISTRY.get(simulation_id)
        if record is None:
            record = await _get_tree_record(sim, session, current_user.id)
        tree_state = record.tree.serialize()
        max_turns = 0
        for node in tree_state.get("nodes", []):
            sim_snap = node.get("sim") or {}
            t = int(sim_snap.get("turns", 0)) if isinstance(sim_snap, dict) else 0
            if t > max_turns:
                max_turns = t
        label = data.label or f"Snapshot {datetime.now(timezone.utc).isoformat()}"
        snapshot = SimulationSnapshot(
            simulation_id=sim.id,
            label=label,
            state=tree_state,
            turns=max_turns,
            meta={},
        )
        session.add(snapshot)
        await session.commit()
        await session.refresh(snapshot)
        return SnapshotBase.model_validate(snapshot)


@get("/{simulation_id:str}/snapshots")
async def list_snapshots(request: Request, simulation_id: str) -> list[SnapshotBase]:
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)
        sim = await _get_simulation_for_owner(session, current_user.id, simulation_id)
        result = await session.execute(
            select(SimulationSnapshot)
            .where(SimulationSnapshot.simulation_id == sim.id)
            .order_by(SimulationSnapshot.created_at.desc())
        )
        snapshots = result.scalars().all()
        return [SnapshotBase.model_validate(s) for s in snapshots]


@get("/{simulation_id:str}/logs")
async def list_logs(
    request: Request, simulation_id: str, limit: int = 200
) -> list[SimulationLogEntry]:
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)
        sim = await _get_simulation_for_owner(session, current_user.id, simulation_id)
        result = await session.execute(
            select(SimulationLog)
            .where(SimulationLog.simulation_id == sim.id)
            .order_by(SimulationLog.sequence.desc())
            .limit(limit)
        )
        logs = list(reversed(result.scalars().all()))
        return [SimulationLogEntry.model_validate(log) for log in logs]


@post("/{simulation_id:str}/start")
async def start_simulation(request: Request, simulation_id: str) -> Message:
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)
        sim = await _get_simulation_for_owner(session, current_user.id, simulation_id)
        sim.status = "running"
        sim.updated_at = datetime.now(timezone.utc)
        await session.commit()
        return Message(message="Simulation start enqueued")


@post("/{simulation_id:str}/resume")
async def resume_simulation(
    request: Request, simulation_id: str, snapshot_id: int | None = None
) -> Message:
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)
        sim = await _get_simulation_for_owner(session, current_user.id, simulation_id)
        record = await _get_tree_record(sim, session, current_user.id)

        if snapshot_id is not None:
            snapshot = await session.get(SimulationSnapshot, snapshot_id)
            assert snapshot is not None and snapshot.simulation_id == sim.id
            tree_state = snapshot.state
            new_tree = SimTree.deserialize(tree_state, record.tree.clients)
            loop = asyncio.get_running_loop()
            new_tree.attach_event_loop(loop)

            def _fanout(event: dict) -> None:
                if int(event.get("node", -1)) not in record.running:
                    return
                for q in list(record.subs):
                    try:
                        loop.call_soon_threadsafe(q.put_nowait, event)
                    except Exception:
                        logger.exception("failed to fanout event to tree subscriber")

            new_tree.set_tree_broadcast(_fanout)
            record.running.clear()
            record.tree = new_tree

        sim.status = "running"
        sim.updated_at = datetime.now(timezone.utc)
        await session.commit()
        return Message(message="Simulation resume enqueued")


@post("/{simulation_id:str}/copy", status_code=201)
async def copy_simulation(request: Request, simulation_id: str) -> SimulationBase:
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)
        sim = await _get_simulation_for_owner(session, current_user.id, simulation_id)

        new_id = generate_simulation_id()
        new_sim = Simulation(
            id=new_id,
            owner_id=current_user.id,
            name=generate_simulation_name(new_id),
            scene_type=sim.scene_type,
            scene_config=sim.scene_config,
            agent_config=sim.agent_config,
            status="draft",
        )
        session.add(new_sim)
        await session.commit()
        await session.refresh(new_sim)
        return SimulationBase.model_validate(new_sim)


# -------------------------------------------------------------------
# SimTree HTTP 接口（✅ 改成不再依赖当前登录用户，直接按 simulation_id + owner_id）
# -------------------------------------------------------------------


@get("/{simulation_id:str}/tree/graph")
async def simulation_tree_graph(request: Request, simulation_id: str) -> dict:
    async with get_session() as session:
        # ✅ 不再强制 extract_bearer_token，直接按 simulation_id 找 sim + tree
        sim, record = await _get_simulation_and_tree_any(session, simulation_id)
        tree = record.tree

        attached_ids = {
            int(nid)
            for nid, node in tree.nodes.items()
            if node.get("depth") is not None
        }
        nodes = [
            {"id": int(node["id"]), "depth": int(node["depth"])}
            for node in tree.nodes.values()
            if node.get("depth") is not None
        ]
        edges = []
        for pid, children in tree.children.items():
            if pid not in attached_ids:
                continue
            for cid in children:
                if cid not in attached_ids:
                    continue
                et = tree.nodes[cid]["edge_type"]
                edges.append({"from": int(pid), "to": int(cid), "type": et})

        depth_map = {
            int(node["id"]): int(node["depth"])
            for node in tree.nodes.values()
            if node.get("depth") is not None
        }
        outdeg = {i: 0 for i in depth_map}
        for edge in edges:
            outdeg[edge["from"]] = outdeg.get(edge["from"], 0) + 1
        leaves = [i for i, degree in outdeg.items() if degree == 0]
        max_depth = max(depth_map.values()) if depth_map else 0
        frontier = [i for i in leaves if depth_map.get(i) == max_depth]

        return {
            "root": int(tree.root) if tree.root is not None else None,
            "frontier": frontier,
            "running": [int(n) for n in record.running],
            "nodes": nodes,
            "edges": edges,
        }


@post("/{simulation_id:str}/tree/advance_frontier")
async def simulation_tree_advance_frontier(
    request: Request,
    simulation_id: str,
    data: SimulationTreeAdvanceFrontierPayload,
) -> dict:
    async with get_session() as session:
        _, record = await _get_simulation_and_tree_any(session, simulation_id)
        tree = record.tree
        parents = tree.frontier(True) if data.only_max_depth else tree.leaves()
        turns = int(data.turns)
        allocations = {pid: tree.copy_sim(pid) for pid in parents}
        for pid, cid in allocations.items():
            tree.attach(pid, [{"op": "advance", "turns": turns}], cid)
            node = tree.nodes[cid]
            _broadcast(
                record,
                {
                    "type": "attached",
                    "data": {
                        "node": int(cid),
                        "parent": int(pid),
                        "depth": int(node["depth"]),
                        "edge_type": node["edge_type"],
                        "ops": node["ops"],
                    },
                },
            )
            record.running.add(cid)
            _broadcast(record, {"type": "run_start", "data": {"node": int(cid)}})
        await asyncio.sleep(0)

        async def _run(parent_id: int) -> tuple[int, int, bool]:
            child_id = allocations[parent_id]
            simulator = tree.nodes[child_id]["sim"]
            # Ensure one advance step covers all agents once
            total_turns = max(1, turns) * max(1, len(simulator.agents))
            await asyncio.to_thread(simulator.run, max_turns=total_turns)
            return parent_id, child_id, False

        results = await asyncio.gather(*[_run(pid) for pid in parents])
        produced: list[int] = []
        for *_pid, cid, _err in results:
            produced.append(cid)
            if cid in record.running:
                record.running.remove(cid)
            _broadcast(record, {"type": "run_finish", "data": {"node": int(cid)}})
        return {"children": [int(c) for c in produced]}


@post("/{simulation_id:str}/tree/advance_multi")
async def simulation_tree_advance_multi(
    request: Request,
    simulation_id: str,
    data: SimulationTreeAdvanceMultiPayload,
) -> dict:
    async with get_session() as session:
        _, record = await _get_simulation_and_tree_any(session, simulation_id)
        tree = record.tree
        parent = int(data.parent)
        count = int(data.count)
        if count <= 0:
            return {"children": []}
        turns = int(data.turns)
        children = [tree.copy_sim(parent) for _ in range(count)]
        for cid in children:
            tree.attach(parent, [{"op": "advance", "turns": turns}], cid)
            node = tree.nodes[cid]
            _broadcast(
                record,
                {
                    "type": "attached",
                    "data": {
                        "node": int(cid),
                        "parent": int(parent),
                        "depth": int(node["depth"]),
                        "edge_type": node["edge_type"],
                        "ops": node["ops"],
                    },
                },
            )
            record.running.add(cid)
            _broadcast(record, {"type": "run_start", "data": {"node": int(cid)}})
        await asyncio.sleep(0)

        async def _run(child_id: int) -> tuple[int, bool]:
            simulator = tree.nodes[child_id]["sim"]
            total_turns = max(1, turns) * max(1, len(simulator.agents))
            await asyncio.to_thread(simulator.run, max_turns=total_turns)
            return child_id, False

        finished = await asyncio.gather(*[_run(cid) for cid in children])
        result_children: list[int] = []
        for cid, _err in finished:
            result_children.append(cid)
            if cid in record.running:
                record.running.remove(cid)
            _broadcast(record, {"type": "run_finish", "data": {"node": int(cid)}})
        return {"children": [int(c) for c in result_children]}


@post("/{simulation_id:str}/tree/advance_chain")
async def simulation_tree_advance_chain(
    request: Request,
    simulation_id: str,
    data: SimulationTreeAdvanceChainPayload,
) -> dict:
    async with get_session() as session:
        _, record = await _get_simulation_and_tree_any(session, simulation_id)
        tree = record.tree
        parent = int(data.parent)
        steps = max(1, int(data.turns))
        last = parent
        for _ in range(steps):
            cid = tree.copy_sim(last)
            tree.attach(last, [{"op": "advance", "turns": 1}], cid)
            node = tree.nodes[cid]
            _broadcast(
                record,
                {
                    "type": "attached",
                    "data": {
                        "node": int(cid),
                        "parent": int(last),
                        "depth": int(node["depth"]),
                        "edge_type": node["edge_type"],
                        "ops": node["ops"],
                    },
                },
            )
            record.running.add(cid)
            _broadcast(record, {"type": "run_start", "data": {"node": int(cid)}})
            await asyncio.sleep(0)

            simulator = tree.nodes[cid]["sim"]
            total_turns = 1 * max(1, len(simulator.agents))
            await asyncio.to_thread(simulator.run, max_turns=total_turns)

            if cid in record.running:
                record.running.remove(cid)
            _broadcast(record, {"type": "run_finish", "data": {"node": int(cid)}})
            last = cid
        return {"child": int(last)}


@post("/{simulation_id:str}/tree/branch")
async def simulation_tree_branch(
    request: Request,
    simulation_id: str,
    data: SimulationTreeBranchPayload,
) -> dict:
    async with get_session() as session:
        _, record = await _get_simulation_and_tree_any(session, simulation_id)
        tree = record.tree
        cid = tree.branch(int(data.parent), [dict(op) for op in data.ops])
        node = tree.nodes[cid]
        _broadcast(
            record,
            {
                "type": "attached",
                "data": {
                    "node": int(cid),
                    "parent": int(node["parent"]),
                    "depth": int(node["depth"]),
                    "edge_type": node["edge_type"],
                    "ops": node["ops"],
                },
            },
        )
        return {"child": int(cid)}


@delete("/{simulation_id:str}/tree/node/{node_id:int}")
async def simulation_tree_delete_subtree(
    request: Request,
    simulation_id: str,
    node_id: int,
) -> None:
    async with get_session() as session:
        _, record = await _get_simulation_and_tree_any(session, simulation_id)
        record.tree.delete_subtree(int(node_id))
        _broadcast(record, {"type": "deleted", "data": {"node": int(node_id)}})


@get("/{simulation_id:str}/tree/sim/{node_id:int}/events")
async def simulation_tree_events(
    request: Request, simulation_id: str, node_id: int
) -> list:
    async with get_session() as session:
        _, record = await _get_simulation_and_tree_any(session, simulation_id)
        node = record.tree.nodes.get(int(node_id))
        if node is None:
            raise HTTPException(status_code=404, detail="Tree node not found")
        return node.get("logs", [])


@get("/{simulation_id:str}/tree/sim/{node_id:int}/state")
async def simulation_tree_state(
    request: Request, simulation_id: str, node_id: int
) -> dict:
    async with get_session() as session:
        _, record = await _get_simulation_and_tree_any(session, simulation_id)
        node = record.tree.nodes.get(int(node_id))
        if node is None:
            raise HTTPException(status_code=404, detail="Tree node not found")
        simulator = node["sim"]
        agents = []
        for name, agent in simulator.agents.items():
            props = dict(agent.properties)
            role = props.get("role") or getattr(agent, "role_prompt", "") or ""
            if role and "role" not in props:
                props["role"] = role
            profile = agent.user_profile or props.get("profile") or props.get("description") or ""
            agents.append(
                {
                    "name": name,
                    "profile": profile,
                    "role": role,
                    "properties": props,
                    "emotion": agent.emotion,
                    "plan_state": agent.plan_state,
                    "short_memory": agent.short_memory.get_all(),
                }
            )
        return {"turns": simulator.turns, "agents": agents}


# -------------------------------------------------------------------
# WebSocket：仍然沿用 token 鉴权（给后台 DevUI 用）
# -------------------------------------------------------------------


@websocket("/{simulation_id:str}/tree/events")
async def simulation_tree_events_ws(socket: WebSocket, simulation_id: str) -> None:
    token = socket.query_params.get("token")
    async with get_session() as session:
        user = await _resolve_user_from_token(token or "", session)
        if user is None:
            await socket.close(code=1008)
            return
        sim = await _get_simulation_for_owner(session, user.id, simulation_id)
        record = await _get_tree_record(sim, session, user.id)

    await socket.accept()
    queue: asyncio.Queue = asyncio.Queue()
    record.subs.append(queue)
    logger.debug("WS tree events subscribed: sim=%s", simulation_id)
    try:
        while True:
            event = await queue.get()
            try:
                await socket.send_json(event)
            except WebSocketDisconnect as e:
                logger.info(
                    "WebSocket disconnected (tree events) for sim %s: %s",
                    simulation_id,
                    e,
                )
                break
            except Exception:
                logger.exception("WS send_json failed for sim %s (tree events)", simulation_id)
                break
    finally:
        if queue in record.subs:
            record.subs.remove(queue)
        logger.debug("WS tree events unsubscribed: sim=%s", simulation_id)


@websocket("/{simulation_id:str}/tree/{node_id:int}/events")
async def simulation_tree_node_events_ws(
    socket: WebSocket,
    simulation_id: str,
    node_id: int,
) -> None:
    # Accept token from query param, Authorization header, or cookie (dev-friendly fallback)
    token = socket.query_params.get("token")
    if not token:
        auth_header = None
        try:
            auth_header = socket.headers.get("authorization") or socket.headers.get("Authorization")
        except Exception:
            auth_header = None
        if auth_header and isinstance(auth_header, str) and auth_header.lower().startswith("bearer "):
            token = auth_header.split(" ", 1)[1].strip()

    if not token:
        try:
            token = socket.cookies.get("socialsim4.access")
        except Exception:
            token = None

    async with get_session() as session:
        user = await _resolve_user_from_token(token or "", session)
        if user is None:
            await socket.close(code=1008)
            return
        sim = await _get_simulation_for_owner(session, user.id, simulation_id)
        record = await _get_tree_record(sim, session, user.id)

        if int(node_id) not in record.tree.nodes:
            await socket.close(code=1008)
            return

    await socket.accept()
    queue: asyncio.Queue = asyncio.Queue()
    record.tree.add_node_sub(int(node_id), queue)
    logger.debug("WS node events subscribed: sim=%s node=%s", simulation_id, node_id)
    try:
        while True:
            event = await queue.get()
            try:
                await socket.send_json(event)
            except WebSocketDisconnect as e:
                logger.info(
                    "WebSocket disconnected (node events) for sim %s node %s: %s",
                    simulation_id,
                    node_id,
                    e,
                )
                break
            except Exception:
                logger.exception(
                    "WS send_json failed for sim %s node %s (node events)",
                    simulation_id,
                    node_id,
                )
                break
    finally:
        record.tree.remove_node_sub(int(node_id), queue)
        logger.debug("WS node events unsubscribed: sim=%s node=%s", simulation_id, node_id)


router = Router(
    path="/simulations",
    route_handlers=[
        list_simulations,
        create_simulation,
        read_simulation,
        update_simulation,
        delete_simulation,
        reset_simulation,
        create_snapshot,
        list_snapshots,
        list_logs,
        start_simulation,
        resume_simulation,
        copy_simulation,
        simulation_tree_graph,
        simulation_tree_advance_frontier,
        simulation_tree_advance_multi,
        simulation_tree_advance_chain,
        simulation_tree_branch,
        simulation_tree_delete_subtree,
        simulation_tree_events,
        simulation_tree_state,
        simulation_tree_events_ws,
        simulation_tree_node_events_ws,
    ],
)
