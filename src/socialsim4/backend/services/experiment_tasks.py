from __future__ import annotations

import concurrent.futures
import json
from typing import List

from socialsim4.backend.celery_app import celery_app
from socialsim4.core.database import get_session
from socialsim4.backend.models.experiment import Experiment, ExperimentVariant, ExperimentRun
from socialsim4.backend.models.simulation import Simulation
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from socialsim4.backend.services.simtree_runtime import SimTree
from socialsim4.core.llm import create_llm_client
from socialsim4.core.llm_config import LLMConfig
from socialsim4.backend.models.user import ProviderConfig, SearchProviderConfig
from socialsim4.core.tools.web.search import create_search_client
from socialsim4.core.search_config import SearchConfig


@celery_app.task(bind=True)
def run_experiment_task(self, simulation_id: str, exp_id: str, run_id: int, turns: int, tree_state: dict, variants: List[dict]) -> dict:
    """Celery task: runs experiment variants on a deserialized SimTree copy and updates DB.

    - Recreates LLM + search clients from DB ProviderConfig for the sim owner.
    - Deserializes tree_state into a SimTree instance local to worker.
    - Branches each variant if needed and runs each branch's simulator (in parallel threads).
    - Writes back ExperimentRun.status/result_meta.
    """

    # Worker body
    async def _worker():
        async with get_session() as session:
            # Eager-load variants to avoid triggering lazy-loads outside the session
            stmt = select(Experiment).options(selectinload(Experiment.variants)).where(Experiment.id == exp_id)
            res = await session.execute(stmt)
            exp = res.scalars().first()
            if exp is None:
                raise RuntimeError("Experiment not found")

            # Load simulation to determine owner and provider configs
            sim = await session.get(Simulation, simulation_id.upper())
            if sim is None:
                raise RuntimeError("Simulation not found")

            # Build clients (LLM + search) from provider configs for the sim owner
            result = await session.execute(
                select(ProviderConfig).where(ProviderConfig.user_id == sim.owner_id)
            )
            items = result.scalars().all()
            active = [p for p in items if (p.config or {}).get("active")]
            if len(active) != 1:
                # fallback to empty clients
                clients = {}
            else:
                provider = active[0]
                dialect = (provider.provider or "").lower()
                cfg = LLMConfig(
                    dialect=dialect,
                    api_key=provider.api_key or "",
                    model=provider.model,
                    base_url=provider.base_url,
                    temperature=0.0,
                    top_p=1.0,
                    frequency_penalty=0.0,
                    presence_penalty=0.0,
                    max_tokens=1024,
                )
                llm_client = create_llm_client(cfg)

                # search provider
                result_s = await session.execute(
                    select(SearchProviderConfig).where(SearchProviderConfig.user_id == sim.owner_id)
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

            # create local SimTree from provided tree_state
            tree = SimTree.deserialize(tree_state, clients=clients)

            # Reserve a conservative per-run budget if provider configured
            per_run_budget = int((provider.config or {}).get("per_run_budget", 1024)) if 'provider' in locals() and provider is not None else 0
            if per_run_budget and node_ids:
                try:
                    from ..models.llm_usage import LLMUsage
                    async with get_session() as s2:
                        stmt = select(LLMUsage).where(LLMUsage.user_id == sim.owner_id, LLMUsage.provider_id == provider.id).with_for_update()
                        resu = await s2.execute(stmt)
                        usage = resu.scalars().first()
                        if usage is None:
                            usage = LLMUsage(user_id=sim.owner_id, provider_id=provider.id, tokens_used=0, tokens_reserved=0)
                            s2.add(usage)
                            await s2.flush()
                        total_needed = per_run_budget * len(node_ids)
                        available = int((provider.config or {}).get("quota", 100000)) - ((usage.tokens_used or 0) + (usage.tokens_reserved or 0))
                        if available < total_needed:
                            # Not enough quota for full reservation; disable LLM for this run
                            clients = {}
                        else:
                            usage.tokens_reserved = (usage.tokens_reserved or 0) + total_needed
                            await s2.flush()
                except Exception:
                    # on error, be conservative and disable LLM usage during run
                    clients = {}

            # Branch variants if needed. Materialize variant data into plain dicts
            node_ids = []
            for v in variants:
                ops = v.get("ops") or []
                cid = tree.branch(int(v.get("base_node", tree.root)), [dict(op) for op in ops])
                node_ids.append(int(cid))

            # create thread pool to run simulators in parallel
            def run_sim(nid: int):
                sim = tree.nodes[int(nid)]["sim"]
                # sim.run is synchronous and may call LLM clients configured in tree.clients
                sim.run(int(turns))
                return int(nid)

            finished = []
            with concurrent.futures.ThreadPoolExecutor(max_workers=min(8, max(1, len(node_ids)))) as ex:
                futs = [ex.submit(run_sim, nid) for nid in node_ids]
                for f in concurrent.futures.as_completed(futs):
                    try:
                        finished.append(f.result())
                    except Exception as e:
                        # mark error and continue
                        async with get_session() as s2:
                            run = await s2.get(ExperimentRun, run_id)
                            if run:
                                run.status = "error"
                                run.result_meta = {"error": str(e)}
                                await s2.commit()
                        raise

            # collect summaries
            summaries = {}
            for nid in node_ids:
                node = tree.nodes.get(int(nid))
                if node is None:
                    continue
                sim = node.get("sim")
                logs = node.get("logs") or []
                agents = {}
                for name, ag in (sim.agents.items() if sim else []):
                    agents[name] = getattr(ag, "properties", {})
                summaries[int(nid)] = {
                    "node_id": int(nid),
                    "turns": getattr(sim, "turns", 0) if sim else 0,
                    "agents": agents,
                    "sample_events": logs[-200:],
                }
            # compute lightweight aggregated metrics for each summary
            for nid, s in summaries.items():
                evs = s.get("sample_events", []) or []
                # voting distribution
                votes = {}
                # emotion time series per agent
                emotion_series = {}
                for ev in evs:
                    etype = ev.get("type") or ev.get("event_type")
                    data = ev.get("data") or {}
                    # simple vote detection heuristics
                    if etype == "action_end":
                        action = (data.get("action") or {}).get("action") if isinstance(data.get("action"), dict) else data.get("action")
                        if action == "vote" or data.get("vote") or data.get("candidate"):
                            cand = data.get("candidate") or data.get("vote") or str(data.get("choice") or "unknown")
                            votes[cand] = votes.get(cand, 0) + 1
                    # emotion updates
                    if etype == "emotion_update" or data.get("emotion"):
                        actor = data.get("actor") or data.get("agent") or ev.get("agent")
                        if actor:
                            emotion_series.setdefault(actor, []).append({"t": ev.get("timestamp"), "emotion": data.get("emotion") or data.get("value")})

                s["metrics"] = {
                    "voting_distribution": votes,
                    "emotion_series": emotion_series,
                }

            async with get_session() as session2:
                run = await session2.get(ExperimentRun, run_id)
                if run:
                    run.status = "finished"
                    run.result_meta = {"finished_nodes": finished, "summaries": summaries}
                    await session2.commit()
            return {"finished": finished}

    # run the async worker synchronously in Celery process
    import asyncio as _asyncio
    return _asyncio.run(_worker())
