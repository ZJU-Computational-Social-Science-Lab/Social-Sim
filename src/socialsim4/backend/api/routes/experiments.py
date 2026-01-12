from __future__ import annotations

from typing import Any, List
from pydantic import BaseModel
from litestar import post, get, Router
from litestar.exceptions import HTTPException
from litestar.connection import Request
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_session
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from .simulations import _get_simulation_and_tree_any, _broadcast
from ...models.simulation import Simulation
from ...models.user import ProviderConfig
from ...models.llm_usage import LLMUsage
from ...services.experiment_runner import (
    EXPERIMENT_REGISTRY,
    create_experiment_db,
    start_experiment_run_background,
)
from ...models.experiment import Experiment


class VariantSpec(BaseModel):
    name: str
    ops: List[dict] = []


class CreateExperimentRequest(BaseModel):
    name: str
    # Accept numeric base_node (float allowed) and coerce to int in handler.
    base_node: float
    variants: List[VariantSpec]


class RunExperimentRequest(BaseModel):
    turns: int = 1


class CompareRequest(BaseModel):
    node_a: int
    node_b: int
    use_llm: bool = False


@post("/{simulation_id:str}/experiments")
async def create_experiment(request: Request, simulation_id: str, data: CreateExperimentRequest) -> dict:
    async with get_session() as session:  # validate simulation exists and tree built
        await _get_simulation_and_tree_any(session, simulation_id)
    # persist experiment to DB
    # coerce base_node to int (floor) to tolerate frontend float inputs like 2.1
    exp_id = await create_experiment_db(simulation_id, int(data.base_node), data.name, None, [v.dict() for v in data.variants])
    return {"experiment_id": exp_id}


@post("/{simulation_id:str}/experiments/{exp_id:str}/run")
async def run_experiment(request: Request, simulation_id: str, exp_id: str, data: RunExperimentRequest) -> dict:
    async with get_session() as session:
        _, record = await _get_simulation_and_tree_any(session, simulation_id)
        # broadcast run starts for visibility
        _broadcast(record, {"type": "experiment_run_start", "data": {"experiment": exp_id}})
    # start background run (Celery if configured)
    run_id = await start_experiment_run_background(simulation_id, exp_id, int(data.turns))
    # attempt to return any already-assigned variant->node mapping if available
    node_mapping = []
    async with get_session() as session:
        # Eager-load variants to avoid lazy loading side-effects
        from sqlalchemy.orm import selectinload
        stmt = select(Experiment).options(selectinload(Experiment.variants)).where(Experiment.id == exp_id)
        res = await session.execute(stmt)
        exp = res.scalars().first()
        if exp is not None:
            for v in (exp.variants or []):
                if getattr(v, "node_id", None):
                    node_mapping.append({"variant_id": v.id, "node_id": int(v.node_id)})

    res = {"run_id": run_id, "node_mapping": node_mapping}
    async with get_session() as session:
        _, record = await _get_simulation_and_tree_any(session, simulation_id)
        _broadcast(record, {"type": "experiment_run_finish", "data": {"experiment": exp_id, "nodes": res.get("finished", [])}})
    return res


@get("/{simulation_id:str}/experiments")
async def list_experiments(request: Request, simulation_id: str) -> dict:
    async with get_session() as session:
        await _get_simulation_and_tree_any(session, simulation_id)
        result = await session.execute(
            select(Experiment).where(Experiment.simulation_id == simulation_id.upper())
        )
        items = result.scalars().all()
        data = [
            {
                "id": e.id,
                "name": e.name,
                "base_node": e.base_node,
                "created_at": getattr(e, "created_at", None),
                "status": e.status,
            }
            for e in items
        ]
    return {"experiments": data}


@get("/{simulation_id:str}/experiments/{exp_id:str}")
async def get_experiment(request: Request, simulation_id: str, exp_id: str) -> dict:
    async with get_session() as session:
        await _get_simulation_and_tree_any(session, simulation_id)
        # Eager-load variants and runs to avoid lazy-loading outside session
        stmt = select(Experiment).options(selectinload(Experiment.variants), selectinload(Experiment.runs)).where(Experiment.id == exp_id)
        res = await session.execute(stmt)
        exp = res.scalars().first()
        if exp is None:
            return {"error": "not_found"}
        # serialize minimal experiment info
        return {
            "experiment": {
                "id": exp.id,
                "name": exp.name,
                "base_node": exp.base_node,
                "variants": [{"id": v.id, "name": v.name, "ops": v.ops, "node_id": v.node_id} for v in (exp.variants or [])],
                "runs": [{"id": r.id, "turns": r.turns, "status": r.status, "result_meta": r.result_meta} for r in (exp.runs or [])],
            }
        }


@post("/{simulation_id:str}/compare")
async def compare_nodes(request: Request, simulation_id: str, data: dict) -> dict:
    # Accept a flexible payload (node ids may be strings in the frontend). Validate and coerce here.
    # Log incoming body to help debug invalid requests from older frontend bundles
    try:
        logger.debug("compare_nodes payload: %s", data)
    except Exception:
        pass
    node_a_raw = data.get("node_a")
    node_b_raw = data.get("node_b")
    use_llm = bool(data.get("use_llm", False))

    if node_a_raw is None or node_b_raw is None:
        raise HTTPException(status_code=400, detail="Missing node_a or node_b in request body")

    try:
        node_a = int(node_a_raw)
        node_b = int(node_b_raw)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid node id(s); must be integers")

    async with get_session() as session:
        sim, record = await _get_simulation_and_tree_any(session, simulation_id)
        tree = record.tree

    a = tree.nodes.get(int(node_a))
    b = tree.nodes.get(int(node_b))
    if a is None or b is None:
        raise HTTPException(status_code=400, detail="node_not_found")

    logs_a = a.get("logs") or []
    logs_b = b.get("logs") or []

    # lightweight event sequence diff: events only in A / only in B based on stringified content
    set_a = set((str(ev.get("type")) + ":" + str(ev.get("data")) for ev in logs_a))
    set_b = set((str(ev.get("type")) + ":" + str(ev.get("data")) for ev in logs_b))
    only_a = [ev for ev in logs_a if (str(ev.get("type")) + ":" + str(ev.get("data")) ) not in set_b]
    only_b = [ev for ev in logs_b if (str(ev.get("type")) + ":" + str(ev.get("data")) ) not in set_a]

    # agent property diffs (compare numeric properties when possible)
    sim_a = a.get("sim")
    sim_b = b.get("sim")
    agents_a = {name: getattr(ag, "properties", {}) for name, ag in (sim_a.agents.items() if sim_a else [])}
    agents_b = {name: getattr(ag, "properties", {}) for name, ag in (sim_b.agents.items() if sim_b else [])}
    agent_diffs = {}
    for name in set(list(agents_a.keys()) + list(agents_b.keys())):
        pa = agents_a.get(name, {})
        pb = agents_b.get(name, {})
        diffs = {}
        for k in set(list(pa.keys()) + list(pb.keys())):
            va = pa.get(k)
            vb = pb.get(k)
            if va != vb:
                diffs[k] = {"a": va, "b": vb}
        if diffs:
            agent_diffs[name] = diffs

    # construct a conservative natural-language summary from diffs (no external LLM by default)
    parts: List[str] = []
    if only_a:
        parts.append(f"节点 {node_a} 有 {len(only_a)} 条独有事件。")
    if only_b:
        parts.append(f"节点 {node_b} 有 {len(only_b)} 条独有事件。")
    if agent_diffs:
        parts.append(f"{len(agent_diffs)} 个代理的属性存在差异。")
    if not parts:
        parts.append("未发现明显差异（基于事件内容与属性的快速比对）。")

    summary = "；".join(parts)

    # Optional: use LLM to produce a short, conservative summary if requested and safe
    if use_llm:
        # Safety checks / usage guards
        total_events = len(only_a) + len(only_b)
        if total_events > 200 or len(agent_diffs) > 50:
            # Avoid expensive/hallucination-prone calls for very large diffs
            summary = summary + "（注意：差异过大，已禁用 LLM 摘要以节省资源）"
        else:
            # Try to get an LLM client from the tree's clients if available
            llm_client = None
            try:
                llm_client = getattr(tree, "clients", {}).get("chat") if hasattr(tree, "clients") else None
            except Exception:
                llm_client = None

            if llm_client is None:
                summary = summary + "（未配置可用的 LLM 客户端）"
            else:
                # Build compact prompt with counts and a few examples (limit length)
                def stringify_event(ev: dict) -> str:
                    try:
                        t = ev.get("type") or ev.get("event_type") or ""
                        d = ev.get("data") or {}
                        return f"{t}: {str(d)[:200]}"
                    except Exception:
                        return str(ev)[:200]

                examples_a = "\n".join([stringify_event(e) for e in only_a[:8]])
                examples_b = "\n".join([stringify_event(e) for e in only_b[:8]])
                agent_diff_lines = []
                for name, diffs in list(agent_diffs.items())[:20]:
                    for k, v in list(diffs.items())[:5]:
                        agent_diff_lines.append(f"{name}.{k}: A={v.get('a')} B={v.get('b')}")
                agent_diff_text = "\n".join(agent_diff_lines[:200])

                system_msg = {
                    "role": "system",
                    "content": (
                        "You are a concise and conservative summarizer for simulation diffs. "
                        "Given only the provided diff examples and agent property differences, produce a short (<=3 sentences) summary in Chinese describing the most likely notable differences and avoid hallucinating any facts not present in the input. "
                        "If uncertain, say so briefly."
                    ),
                }
                user_msg = {
                    "role": "user",
                    "content": (
                        f"Node A id={node_a}, unique events count={len(only_a)}. Examples:\n{examples_a}\n\n"
                        f"Node B id={node_b}, unique events count={len(only_b)}. Examples:\n{examples_b}\n\n"
                        f"Agent property differences (sample):\n{agent_diff_text}\n\n"
                        "Please respond in Chinese, <= 3 sentences. Use only the above information."
                    ),
                }

                # Estimate token consumption (very conservative): chars/4
                prompt_text = (system_msg["content"] + "\n" + user_msg["content"]) if isinstance(system_msg, dict) else str(system_msg) + "\n" + str(user_msg)
                est_tokens = max(1, int(len(prompt_text) / 4))

                # Check per-user/provider quota before calling LLM and reserve tokens (DB-level lock)
                try:
                    result = await session.execute(select(ProviderConfig).where(ProviderConfig.user_id == sim.owner_id))
                    providers = result.scalars().all()
                    active = [p for p in providers if (p.config or {}).get("active")]
                    provider = active[0] if active else (providers[0] if providers else None)
                except Exception:
                    provider = None

                quota_allowed = True
                usage = None
                if provider is not None:
                    quota = int((provider.config or {}).get("quota", 100000))
                    # Acquire a DB lock on the LLMUsage row to reserve tokens
                    try:
                        async with session.begin():
                            stmt = select(LLMUsage).where(LLMUsage.user_id == sim.owner_id, LLMUsage.provider_id == provider.id).with_for_update()
                            res = await session.execute(stmt)
                            usage = res.scalars().first()
                            if usage is None:
                                usage = LLMUsage(user_id=sim.owner_id, provider_id=provider.id, tokens_used=0, tokens_reserved=0)
                                session.add(usage)
                                await session.flush()
                            # check available tokens (used + reserved cannot exceed quota)
                            available = quota - ((usage.tokens_used or 0) + (usage.tokens_reserved or 0))
                            if available < est_tokens:
                                quota_allowed = False
                            else:
                                # reserve tokens
                                usage.tokens_reserved = (usage.tokens_reserved or 0) + est_tokens
                                await session.flush()
                    except Exception:
                        # If any DB locking error, fall back to denying LLM to be safe
                        quota_allowed = False

                if not quota_allowed:
                    summary = summary + "（注意：用户 LLM 配额已耗尽，已禁用 LLM 摘要）"
                else:
                    try:
                        text = llm_client.chat([system_msg, user_msg])
                        if isinstance(text, str) and text.strip():
                            # Truncate to reasonable length
                            summary = (text.strip()[:1000])
                        # on success, consume reserved tokens (best-effort)
                        if provider is not None and usage is not None:
                            try:
                                async with session.begin():
                                    # re-load with lock
                                    stmt2 = select(LLMUsage).where(LLMUsage.user_id == sim.owner_id, LLMUsage.provider_id == provider.id).with_for_update()
                                    r2 = await session.execute(stmt2)
                                    u2 = r2.scalars().first()
                                    if u2 is not None:
                                        u2.tokens_reserved = max(0, (u2.tokens_reserved or 0) - est_tokens)
                                        u2.tokens_used = (u2.tokens_used or 0) + est_tokens
                                        await session.flush()
                            except Exception:
                                # best-effort: ignore usage persist errors
                                pass
                    except Exception:
                        # On LLM failure, release reserved tokens
                        if provider is not None and usage is not None:
                            try:
                                async with session.begin():
                                    stmt3 = select(LLMUsage).where(LLMUsage.user_id == sim.owner_id, LLMUsage.provider_id == provider.id).with_for_update()
                                    r3 = await session.execute(stmt3)
                                    u3 = r3.scalars().first()
                                    if u3 is not None:
                                        u3.tokens_reserved = max(0, (u3.tokens_reserved or 0) - est_tokens)
                                        await session.flush()
                            except Exception:
                                pass

    return {
        "node_a": int(node_a),
        "node_b": int(node_b),
        "only_in_a": only_a,
        "only_in_b": only_b,
        "agent_diffs": agent_diffs,
        "summary": summary,
    }


router = Router(path="/simulations", route_handlers=[create_experiment, run_experiment, list_experiments, get_experiment, compare_nodes])
