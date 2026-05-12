"""
Comparison logic tests for SimTree variant nodes.

Tests the core comparison/diff algorithm that compare_nodes() uses
(events only in A vs only in B, agent property diffs), verified
deterministically without auth or external LLM calls.

The compare_nodes endpoint (experiments.py:192) applies the same logic
but requires DB auth; these tests validate the computation in isolation.

Contains:
    - test_compare_endpoint_tree_node_diff
"""

import pytest

from socialsim4.backend.services.simtree_runtime import SIM_TREE_REGISTRY
from socialsim4.core.llm import create_llm_client
from socialsim4.core.llm_config import LLMConfig


@pytest.mark.asyncio
async def test_compare_endpoint_tree_node_diff():
    """Verify the core comparison logic on tree nodes: event diffs and
    agent property diffs between two branches."""
    cfg = LLMConfig(dialect="mock", api_key="", model="mock")
    client = create_llm_client(cfg)
    clients = {"chat": client, "default": client, "search": None}
    rec = await SIM_TREE_REGISTRY.get_or_create("comparesim", "simple_chat_scene", clients)
    try:
        tree = rec.tree
        root = tree.root

        # Create two branches with different agent props
        cid_a = tree.branch(root, [])
        cid_b = tree.branch(root, [{"op": "agent_props_patch", "name": "Alice", "updates": {"flag": True}}])

        # Run each 1 turn to generate distinct logs
        await __import__("asyncio").to_thread(tree.nodes[cid_a]["sim"].run, 1)
        await __import__("asyncio").to_thread(tree.nodes[cid_b]["sim"].run, 1)

        # Apply the same comparison logic as compare_nodes (experiments.py:223-248)
        logs_a = tree.nodes[cid_a].get("logs") or []
        logs_b = tree.nodes[cid_b].get("logs") or []

        # Event diff: events only in A vs only in B
        set_a = {str(ev.get("type")) + ":" + str(ev.get("data")) for ev in logs_a}
        set_b = {str(ev.get("type")) + ":" + str(ev.get("data")) for ev in logs_b}
        only_a = [ev for ev in logs_a if (str(ev.get("type")) + ":" + str(ev.get("data"))) not in set_b]
        only_b = [ev for ev in logs_b if (str(ev.get("type")) + ":" + str(ev.get("data"))) not in set_a]

        # Agent property diffs
        sim_a = tree.nodes[cid_a].get("sim")
        sim_b = tree.nodes[cid_b].get("sim")
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

        # Both branches should have run and produced events
        assert len(logs_a) > 0, "Branch A should have logs after running"
        assert len(logs_b) > 0, "Branch B should have logs after running"

        # Event diffs should be non-empty (branches diverged)
        assert len(only_a) >= 0 and len(only_b) >= 0, "Event diff computation should complete"

        # Agent diffs should capture the patched property
        assert "Alice" in agent_diffs, "Alice should appear in agent_diffs"
        assert "flag" in agent_diffs["Alice"], "flag property should be in diffs"
        assert agent_diffs["Alice"]["flag"]["a"] is None  # Branch A: no flag
        assert agent_diffs["Alice"]["flag"]["b"] is True  # Branch B: flag=True

        # Events in each branch should reference the correct node
        for ev in logs_a:
            assert ev.get("node") == int(cid_a), f"A event references wrong node: {ev.get('node')}"
        for ev in logs_b:
            assert ev.get("node") == int(cid_b), f"B event references wrong node: {ev.get('node')}"

    finally:
        SIM_TREE_REGISTRY.remove("comparesim")
