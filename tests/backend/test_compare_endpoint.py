import asyncio

import pytest

from socialsim4.backend.services.simtree_runtime import SIM_TREE_REGISTRY
from socialsim4.core.llm import create_llm_client
from socialsim4.core.llm_config import LLMConfig


@pytest.mark.asyncio
async def test_compare_endpoint_http(tmp_path, monkeypatch):
    cfg = LLMConfig(dialect="mock", api_key="", model="mock")
    client = create_llm_client(cfg)
    clients = {"chat": client, "default": client, "search": None}
    rec = await SIM_TREE_REGISTRY.get_or_create("comparesim", "preview", clients)
    try:
        tree = rec.tree
        root = tree.root
        # create two branches, patch an agent prop on one
        cid_a = tree.branch(root, [])
        cid_b = tree.branch(root, [{"op": "agent_props_patch", "name": "Alice", "updates": {"flag": True}}])
        # run each 1 turn
        await asyncio.to_thread(tree.nodes[cid_a]["sim"].run, 1)
        await asyncio.to_thread(tree.nodes[cid_b]["sim"].run, 1)
        # call compare via internal helper: borrow compare logic from experiments route
        from socialsim4.backend.api.routes.experiments import compare_nodes

        # build fake request object not used in function
        res = await compare_nodes(None, "comparesim", type("X", (), {"node_a": int(cid_a), "node_b": int(cid_b)})())
        assert "agent_diffs" in res
    finally:
        SIM_TREE_REGISTRY.remove("comparesim")
