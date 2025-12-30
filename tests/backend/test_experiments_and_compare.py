import asyncio
import os
import json

import pytest

from socialsim4.backend.services.experiment_runner import (
    ExperimentRegistry,
    create_and_branch,
    run_variants_parallel,
)
from socialsim4.backend.services.simtree_runtime import SIM_TREE_REGISTRY
from socialsim4.core.llm import create_llm_client
from socialsim4.core.llm_config import LLMConfig
from socialsim4.backend.api.routes.simulations import _align_event_sequences


@pytest.mark.asyncio
async def test_experiment_registry_create_get_list():
    reg = ExperimentRegistry()
    sid = "S1"
    exp = {"name": "myexp", "base_node": 0}
    exp_id = await reg.create_experiment(sid, exp)
    assert exp_id.startswith("exp-")
    await reg.set_experiment(sid, exp_id, {"status": "ready"})
    got = await reg.get_experiment(sid, exp_id)
    assert got is not None
    assert got["status"] == "ready"
    lst = await reg.list_experiments(sid)
    assert any(x["id"] == exp_id for x in lst)


@pytest.fixture
async def simtree_record_fixture():
    # ensure a mock LLM client is used so sim.run does not call external APIs
    cfg = LLMConfig(dialect="mock", api_key="", model="mock")
    client = create_llm_client(cfg)
    clients = {"chat": client, "default": client, "search": None}
    # create a sim tree for scene "preview"
    rec = await SIM_TREE_REGISTRY.get_or_create("testsims", "preview", clients)
    try:
        yield rec
    finally:
        # cleanup registry entry to avoid test interference
        SIM_TREE_REGISTRY.remove("testsims")


@pytest.mark.asyncio
async def test_create_and_branch_and_agent_props(simtree_record_fixture):
    rec = simtree_record_fixture
    tree = rec.tree
    root = tree.root
    # create two variants: control (no-op) and experiment (patch Alice property)
    variants = [
        {"name": "control", "ops": []},
        {
            "name": "treatment",
            "ops": [
                {"op": "agent_props_patch", "name": "Alice", "updates": {"initial_val": 123}}
            ],
        },
    ]
    mapping = await create_and_branch("testsims", root, variants)
    assert "control" in mapping and "treatment" in mapping
    control_n = mapping["control"]
    treat_n = mapping["treatment"]
    # Verify agent property was patched on treatment branch
    tnode = tree.nodes[int(treat_n)]
    agents = tnode["sim"].agents
    assert "Alice" in agents
    assert agents["Alice"].properties.get("initial_val") == 123


@pytest.mark.asyncio
async def test_run_variants_parallel_and_metrics(simtree_record_fixture):
    rec = simtree_record_fixture
    tree = rec.tree
    root = tree.root
    # create two simple variants
    variants = [
        {"name": "v1", "ops": []},
        {"name": "v2", "ops": []},
    ]
    mapping = await create_and_branch("testsims", root, variants)
    node_ids = [int(mapping["v1"]), int(mapping["v2"])]
    # ensure running set empty
    assert all(n not in rec.running for n in node_ids)
    finished = await run_variants_parallel("testsims", node_ids, 1)
    # both should finish
    assert set(finished) == set(node_ids)
    # running set cleared
    assert all(n not in rec.running for n in node_ids)
    # each node should have turns >= 1
    for nid in node_ids:
        node = tree.nodes.get(int(nid))
        assert node is not None
        assert getattr(node["sim"], "turns", 0) >= 1


def make_event(ev_type: str, data: dict = None):
    if data is None:
        data = {}
    return {"type": ev_type, "data": data}


def test_align_event_sequences_basic():
    logs_a = [make_event("m", {"x": 1}), make_event("n", {}), make_event("o", {})]
    logs_b = [make_event("m", {"x": 1}), make_event("o", {}), make_event("p", {})]
    res = _align_event_sequences(logs_a, logs_b, max_evidences=3)
    assert "added" in res and "removed" in res and "evidence_segments" in res
    # expect one added (p) and one removed (n)
    added_types = [e["type"] for e in res["added"]]
    removed_types = [e["type"] for e in res["removed"]]
    assert any(t == "p" for t in added_types)
    assert any(t == "n" for t in removed_types)


def test_llm_mock_client_chat():
    cfg = LLMConfig(dialect="mock", api_key="", model="mock")
    client = create_llm_client(cfg)
    messages = [
        {"role": "system", "content": "You are Alice in a voting scene."},
        {"role": "user", "content": "Say hello."},
    ]
    resp = client.chat(messages)
    assert isinstance(resp, str)
    assert len(resp) > 0
