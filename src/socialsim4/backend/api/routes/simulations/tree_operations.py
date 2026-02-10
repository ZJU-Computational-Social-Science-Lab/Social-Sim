"""
Simulation tree manipulation API routes.

Handles operations on the branching timeline structure of simulations.
Includes graph queries, tree advancement, branching, and subtree deletion.

The tree structure allows for exploring alternate simulation paths
by creating branches at any node.

Contains:
    - simulation_tree_graph: Get tree structure visualization
    - simulation_tree_advance_frontier: Advance leaf nodes
    - simulation_tree_advance_multi: Batch advance multiple nodes
    - simulation_tree_advance_chain: Advance following parent chain
    - simulation_tree_branch: Create new branch from node
    - simulation_tree_delete_subtree: Delete branch from node
    - simulation_tree_events: Get events for node
    - simulation_tree_state: Get state at node
    - test_agent_knowledge: Test RAG retrieval for agent
    - ask_agents_question: Broadcast question to agents
"""

import asyncio
import logging
from typing import Any

from litestar import get, post, delete
from litestar.connection import Request
from litestar.exceptions import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from socialsim4.backend.core.database import get_session
from socialsim4.backend.schemas.simtree import (
    SimulationTreeAdvanceChainPayload,
    SimulationTreeAdvanceFrontierPayload,
    SimulationTreeAdvanceMultiPayload,
    SimulationTreeBranchPayload,
)

from .helpers import (
    get_simulation_and_tree_any,
    broadcast_tree_event,
)
from socialsim4.backend.services.simtree_runtime import SIM_TREE_REGISTRY
from socialsim4.backend.services.documents import composite_rag_retrieval, format_rag_context


logger = logging.getLogger(__name__)


@get("/{simulation_id:str}/tree/graph")
async def simulation_tree_graph(
    request: Request,
    simulation_id: str,
) -> dict:
    """
    Get the simulation tree structure for visualization.

    Returns nodes, edges, and metadata about the tree including
    the root node, frontier nodes (leaves at max depth), and
    currently running nodes.

    Args:
        request: Litestar request
        simulation_id: Simulation identifier

    Returns:
        Dictionary with tree structure:
        - root: Root node ID
        - frontier: Leaf nodes at maximum depth
        - running: Currently executing node IDs
        - nodes: List of all nodes with depth
        - edges: List of edges between nodes

    Raises:
        HTTPException: If simulation not found
    """
    try:
        async with get_session() as session:
            sim, record = await get_simulation_and_tree_any(session, simulation_id)
            tree = record.tree

            logger.debug(f"[TREE_GRAPH] sim={simulation_id} tree.root={tree.root} nodes.count={len(tree.nodes)}")

            # Get attached nodes (nodes with depth)
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

            # Calculate depth map and find leaves
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

            result = {
                "root": int(tree.root) if tree.root is not None else None,
                "frontier": frontier,
                "running": [int(n) for n in record.running],
                "nodes": nodes,
                "edges": edges,
            }
            logger.debug(f"[TREE_GRAPH] returning root={result['root']} nodes={len(result['nodes'])} edges={len(result['edges'])}")
            return result
    except Exception as e:
        logger.exception(f"[TREE_GRAPH] Error building graph for sim {simulation_id}: {e}")
        raise


@post("/{simulation_id:str}/tree/advance_frontier")
async def simulation_tree_advance_frontier(
    request: Request,
    simulation_id: str,
    data: SimulationTreeAdvanceFrontierPayload,
) -> dict:
    """
    Advance the frontier (leaf nodes) of the simulation tree.

    Creates new child nodes from all frontier nodes (or just
    max-depth leaves if only_max_depth is True) and runs them
    for the specified number of turns.

    Args:
        request: Litestar request
        simulation_id: Simulation identifier
        data: Advance parameters (turns, only_max_depth)

    Returns:
        Dictionary with list of created child node IDs

    Raises:
        HTTPException: If simulation not found
    """
    async with get_session() as session:
        sim, record = await get_simulation_and_tree_any(session, simulation_id)
        tree = record.tree

        parents = tree.frontier(True) if data.only_max_depth else tree.leaves()
        turns = int(data.turns)

        # Create copies for each parent
        allocations = {pid: tree.copy_sim(pid) for pid in parents}

        for pid, cid in allocations.items():
            tree.attach(pid, [{"op": "advance", "turns": turns}], cid)
            node = tree.nodes[cid]
            broadcast_tree_event(
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
            broadcast_tree_event(record, {"type": "run_start", "data": {"node": int(cid)}})

        await asyncio.sleep(0)

        async def _run(parent_id: int) -> tuple[int, int, bool]:
            child_id = allocations[parent_id]
            simulator = tree.nodes[child_id]["sim"]
            total_turns = max(1, turns) * max(1, len(simulator.agents))
            await asyncio.to_thread(simulator.run, max_turns=total_turns)
            return parent_id, child_id, False

        results = await asyncio.gather(*[_run(pid) for pid in parents])
        produced: list[int] = []

        for *_pid, cid, _err in results:
            produced.append(cid)
            if cid in record.running:
                record.running.remove(cid)
            broadcast_tree_event(record, {"type": "run_finish", "data": {"node": int(cid)}})

        # Persist latest tree state
        sim.latest_state = tree.serialize()
        await session.commit()

        return {"children": [int(c) for c in produced]}


@post("/{simulation_id:str}/tree/advance_multi")
async def simulation_tree_advance_multi(
    request: Request,
    simulation_id: str,
    data: SimulationTreeAdvanceMultiPayload,
) -> dict:
    """
    Advance multiple copies from a single parent node.

    Creates multiple child nodes from the same parent and runs
    them in parallel. Useful for exploring multiple what-if
    scenarios from the same starting point.

    Args:
        request: Litestar request
        simulation_id: Simulation identifier
        data: Advance parameters (parent, count, turns)

    Returns:
        Dictionary with list of created child node IDs

    Raises:
        HTTPException: If simulation not found
    """
    async with get_session() as session:
        sim, record = await get_simulation_and_tree_any(session, simulation_id)
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
            broadcast_tree_event(
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
            broadcast_tree_event(record, {"type": "run_start", "data": {"node": int(cid)}})

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
            broadcast_tree_event(record, {"type": "run_finish", "data": {"node": int(cid)}})

        sim.latest_state = tree.serialize()
        await session.commit()

        return {"children": [int(c) for c in result_children]}


@post("/{simulation_id:str}/tree/advance_chain")
async def simulation_tree_advance_chain(
    request: Request,
    simulation_id: str,
    data: SimulationTreeAdvanceChainPayload,
) -> dict:
    """
    Advance in a chain from a parent node.

    Creates a linear chain of nodes, each advancing one turn
    from the previous. Useful for sequential "what happens next"
    exploration.

    Args:
        request: Litestar request
        simulation_id: Simulation identifier
        data: Advance parameters (parent, turns)

    Returns:
        Dictionary with the final child node ID

    Raises:
        HTTPException: If simulation not found
    """
    async with get_session() as session:
        sim, record = await get_simulation_and_tree_any(session, simulation_id)
        tree = record.tree

        parent = int(data.parent)
        steps = max(1, int(data.turns))
        last = parent

        for _ in range(steps):
            cid = tree.copy_sim(last)
            tree.attach(last, [{"op": "advance", "turns": 1}], cid)
            node = tree.nodes[cid]
            broadcast_tree_event(
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
            broadcast_tree_event(record, {"type": "run_start", "data": {"node": int(cid)}})
            await asyncio.sleep(0)

            simulator = tree.nodes[cid]["sim"]
            total_turns = 1 * max(1, len(simulator.agents))
            await asyncio.to_thread(simulator.run, max_turns=total_turns)

            if cid in record.running:
                record.running.remove(cid)
            broadcast_tree_event(record, {"type": "run_finish", "data": {"node": int(cid)}})
            last = cid

        sim.latest_state = tree.serialize()
        await session.commit()

        return {"child": int(last)}


@post("/{simulation_id:str}/tree/branch")
async def simulation_tree_branch(
    request: Request,
    simulation_id: str,
    data: SimulationTreeBranchPayload,
) -> dict:
    """
    Create a new branch from a node.

    Creates a child node with custom operations (not just advance).
    Allows for more complex tree manipulations.

    Args:
        request: Litestar request
        simulation_id: Simulation identifier
        data: Branch parameters (parent, ops)

    Returns:
        Dictionary with the created child node ID

    Raises:
        HTTPException: If simulation not found
    """
    async with get_session() as session:
        sim, record = await get_simulation_and_tree_any(session, simulation_id)
        tree = record.tree

        cid = tree.branch(int(data.parent), [dict(op) for op in data.ops])
        node = tree.nodes[cid]

        broadcast_tree_event(
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

        sim.latest_state = tree.serialize()
        await session.commit()

        return {"child": int(cid)}


@delete("/{simulation_id:str}/tree/node/{node_id:int}")
async def simulation_tree_delete_subtree(
    request: Request,
    simulation_id: str,
    node_id: int,
) -> None:
    """
    Delete a subtree from a node.

    Removes the specified node and all its descendants from
    the tree structure.

    Args:
        request: Litestar request
        simulation_id: Simulation identifier
        node_id: ID of node to delete (root not allowed)

    Raises:
        HTTPException: If simulation not found or trying to delete root
    """
    async with get_session() as session:
        _, record = await get_simulation_and_tree_any(session, simulation_id)
        record.tree.delete_subtree(int(node_id))
        broadcast_tree_event(record, {"type": "deleted", "data": {"node": int(node_id)}})


@get("/{simulation_id:str}/tree/sim/{node_id:int}/events")
async def simulation_tree_events(
    request: Request,
    simulation_id: str,
    node_id: int,
) -> list:
    """
    Get events for a specific tree node.

    Returns the event log for the simulator state at the
    specified node.

    Args:
        request: Litestar request
        simulation_id: Simulation identifier
        node_id: Tree node ID

    Returns:
        List of event dictionaries

    Raises:
        HTTPException: If simulation or node not found
    """
    async with get_session() as session:
        _, record = await get_simulation_and_tree_any(session, simulation_id)
        node = record.tree.nodes.get(int(node_id))

        if node is None:
            raise HTTPException(status_code=404, detail="Tree node not found")

        return node.get("logs", [])


@get("/{simulation_id:str}/tree/sim/{node_id:int}/state")
async def simulation_tree_state(
    request: Request,
    simulation_id: str,
    node_id: int,
) -> dict:
    """
    Get the simulator state at a specific tree node.

    Returns detailed information about the simulation state
    including all agents, their properties, memories, and
    knowledge bases.

    Args:
        request: Litestar request
        simulation_id: Simulation identifier
        node_id: Tree node ID

    Returns:
        Dictionary with simulation state:
        - turns: Number of turns executed
        - agents: List of agent states
        - scene_config: Scene configuration including social_network

    Raises:
        HTTPException: If simulation or node not found
    """
    logger.debug(f"simulation_tree_state: Fetching state for sim={simulation_id}, node={node_id}")

    async with get_session() as session:
        sim, record = await get_simulation_and_tree_any(session, simulation_id)
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
            kb = getattr(agent, "knowledge_base", [])
            docs = getattr(agent, "documents", {})

            logger.debug(f"Agent '{name}' has {len(kb)} KB items, {len(docs)} documents")

            agents.append(
                {
                    "name": name,
                    "profile": profile,
                    "role": role,
                    "properties": props,
                    "emotion": agent.emotion,
                    "plan_state": agent.plan_state,
                    "short_memory": agent.short_memory.get_all(),
                    "knowledgeBase": kb,
                    "documents": docs,
                }
            )

        # Include scene_config for social_network access
        scene_config = sim.scene_config or {}
        social_network = scene_config.get("social_network", {})

        logger.debug(f"returning scene_config with social_network: {social_network}")

        return {
            "turns": simulator.turns,
            "agents": agents,
            "scene_config": scene_config
        }


@get("/{simulation_id:str}/tree/sim/{node_id:int}/test-knowledge")
async def test_agent_knowledge(
    request: Request,
    simulation_id: str,
    node_id: int,
) -> dict:
    """
    Test endpoint to verify agent knowledge bases are working.

    Query params:
        agent_name: Optional specific agent name to test (tests all if not provided)
        query: Optional search query to test knowledge retrieval

    Returns:
        Dict with agent knowledge details and query results

    Raises:
        HTTPException: If simulation or node not found
    """
    agent_name = request.query_params.get("agent_name")
    query = request.query_params.get("query")

    logger.debug(f"test_agent_knowledge: sim={simulation_id}, node={node_id}, agent={agent_name}, query={query}")

    async with get_session() as session:
        _, record = await get_simulation_and_tree_any(session, simulation_id)
        node = record.tree.nodes.get(int(node_id))

        if node is None:
            raise HTTPException(status_code=404, detail="Tree node not found")

        simulator = node["sim"]
        results = []

        for name, agent in simulator.agents.items():
            if agent_name and name != agent_name:
                continue

            kb = getattr(agent, "knowledge_base", [])
            enabled_kb = [item for item in kb if item.get("enabled", True)]

            agent_result = {
                "name": name,
                "total_knowledge_items": len(kb),
                "enabled_knowledge_items": len(enabled_kb),
                "knowledge_base": kb,
            }

            # Test query_knowledge method if query provided
            if query and hasattr(agent, "query_knowledge"):
                query_results = agent.query_knowledge(query, top_k=5)
                agent_result["query"] = query
                agent_result["query_results"] = query_results

            # Get knowledge context preview
            if hasattr(agent, "get_knowledge_context"):
                context = agent.get_knowledge_context(query or "test")
                agent_result["knowledge_context_preview"] = context[:500] if context else ""

            results.append(agent_result)

        return {
            "simulation_id": simulation_id,
            "node_id": node_id,
            "agent_count": len(simulator.agents),
            "agents": results
        }


@post("/{simulation_id:str}/tree/sim/{node_id:int}/ask-agents")
async def ask_agents_question(
    request: Request,
    simulation_id: str,
    node_id: int,
    data: dict,
) -> dict:
    """
    Ask all agents a question and get their responses based on their knowledge.

    This demonstrates that each agent uses their individual RAG knowledge
    including documents and global knowledge.

    POST body: {"question": "What is the village budget?", "agent_name": "optional"}

    Returns each agent's response showing they use their specific knowledge.

    Raises:
        HTTPException: If simulation or node not found
    """
    question = data.get("question", "What do you know?")
    target_agent = data.get("agent_name")

    logger.debug(f"ask_agents_question: sim={simulation_id}, node={node_id}")
    logger.debug(f"Question: '{question}'")
    logger.debug(f"Target agent: {target_agent or 'ALL'}")

    async with get_session() as session:
        sim, record = await get_simulation_and_tree_any(session, simulation_id)
        node = record.tree.nodes.get(int(node_id))

        if node is None:
            raise HTTPException(status_code=404, detail="Tree node not found")

        simulator = node["sim"]
        llm_client = simulator.clients.get("chat") or simulator.clients.get("default")

        if llm_client is None:
            raise HTTPException(status_code=500, detail="No LLM client available")

        # Get global knowledge from scene_config
        scene_config = sim.scene_config or {}
        global_knowledge = scene_config.get("global_knowledge", {})

        results = []

        for name, agent in simulator.agents.items():
            if target_agent and name != target_agent:
                continue

            # Gather all knowledge sources
            kb_items = getattr(agent, "knowledge_base", [])
            enabled_kb = [item for item in kb_items if item.get("enabled", True)]
            documents = getattr(agent, "documents", {})
            agent_config = sim.agent_config or {}
            agents_list = agent_config.get("agents", [])
            agent_cfg = next((a for a in agents_list if a.get("name") == name), {})
            cfg_documents = agent_cfg.get("documents", {})

            logger.debug(f"--- Agent: {name} ---")
            logger.debug(f"Free-text KB items: {len(enabled_kb)}")
            logger.debug(f"Private documents: {len(cfg_documents)}")
            logger.debug(f"Global knowledge items: {len(global_knowledge)}")

            # Build knowledge context
            knowledge_context = ""
            knowledge_sources = []

            # 1. Add free-text knowledge base items
            if enabled_kb:
                kb_items_list = []
                for i, item in enumerate(enabled_kb, 1):
                    title = item.get("title", "Untitled")
                    content = item.get("content", "")
                    kb_items_list.append(f"[KB-{i}] {title}:\n{content}")
                    knowledge_sources.append(title)
                knowledge_context += "\n\n### Your Free-text Knowledge:\n" + "\n\n".join(kb_items_list)

            # 2. Use composite_rag_retrieval for documents and global knowledge
            retrieval_result = await asyncio.to_thread(
                composite_rag_retrieval,
                question,
                agent_documents=cfg_documents,
                global_knowledge=global_knowledge,
                top_k=5
            )

            if retrieval_result:
                formatted_context = await asyncio.to_thread(
                    format_rag_context,
                    retrieval_result
                )
                if formatted_context:
                    knowledge_context += "\n\n### Retrieved Knowledge:\n" + formatted_context
                    for chunk in retrieval_result:
                        source = chunk.get("source", "Unknown")
                        if source not in knowledge_sources:
                            knowledge_sources.append(source)

            # Build prompt with knowledge
            if knowledge_context:
                prompt = f"""You are {name}. {agent.user_profile}

{knowledge_context}

Based on your knowledge above, please answer this question concisely:
{question}

If you have specific information in your knowledge base about this, use it. If not, say you don't have that information."""
            else:
                prompt = f"""You are {name}. {agent.user_profile}

Based on your knowledge (if any), please answer this question concisely:
{question}

If you don't have specific information about this, say so."""

            logger.debug(f"Knowledge sources: {knowledge_sources}")

            try:
                messages = [{"role": "user", "content": prompt}]
                response = await asyncio.to_thread(llm_client.chat, messages)

                # Extract response text
                if isinstance(response, str):
                    answer = response
                elif hasattr(response, 'choices') and response.choices:
                    answer = response.choices[0].message.content
                elif isinstance(response, dict):
                    answer = response.get("choices", [{}])[0].get("message", {}).get("content", str(response))
                else:
                    answer = str(response)

                logger.debug(f"Response from {name}: {answer[:200]}")

                results.append({
                    "agent_name": name,
                    "knowledge_count": len(enabled_kb) + len(cfg_documents) + len(global_knowledge),
                    "knowledge_sources": knowledge_sources,
                    "question": question,
                    "answer": answer,
                    "success": True
                })

            except Exception as e:
                logger.error(f"ERROR for {name}: {e}")
                results.append({
                    "agent_name": name,
                    "knowledge_count": len(enabled_kb) + len(cfg_documents),
                    "question": question,
                    "answer": f"Error: {str(e)}",
                    "success": False
                })

        return {
            "simulation_id": simulation_id,
            "node_id": node_id,
            "question": question,
            "responses": results
        }
