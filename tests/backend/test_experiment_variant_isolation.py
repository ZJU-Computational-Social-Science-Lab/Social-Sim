"""
Tests for experiment variant isolation in SimTree.

Verifies that design experiment variants:
- Preserve base config when branching
- Do not mutate base config when applying variant-specific changes
- Do not contaminate each other when running in parallel
- Maintain separate logs per variant
- Can be compared without mixing outputs

Config tests use ExperimentRunnerAdapter (no advance needed).
Run/log isolation tests use Simulator-based trees where advance works.

Contains:
    - test_variant_preserves_base_config
    - test_variant_specific_changes_do_not_mutate_base
    - test_variant_multi_branch_config_isolation
    - test_running_one_variant_does_not_mutate_another
    - test_logs_separated_by_variant
    - test_multi_variant_parallel_run_isolation
    - test_comparison_identifies_variants_separately
"""

from __future__ import annotations

import sys
from copy import deepcopy
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from socialsim4.core.simtree import SimTree
from socialsim4.core.simulator import Simulator
from socialsim4.core.experiment.config import ExperimentConfig
from socialsim4.core.experiment.scene import ExperimentScene
from socialsim4.backend.services.simtree_runtime import ExperimentRunnerAdapter
from socialsim4.scenarios.basic import build_simple_chat_sim_chinese


# ---------------------------------------------------------------------------
# Test fixtures
# ---------------------------------------------------------------------------


class _DummyLLM:
    """Minimal Dummy LLM that returns a valid response for legacy agents."""

    def chat(self, messages):
        return (
            "--- Thoughts ---\n"
            "Dummy thoughts.\n\n"
            "--- Plan ---\n"
            "1. Do nothing. [CURRENT]\n\n"
            "--- Action ---\n"
            '<Action name="yield" />\n\n'
            "--- Plan Update ---\n"
            "no change\n"
        )


def make_dummy_clients() -> dict:
    c = _DummyLLM()
    return {"chat": c, "default": c}


@pytest.fixture
def experiment_tree():
    """Create a SimTree with an ExperimentScene for config-level variant testing.

    Uses ExperimentRunnerAdapter which has empty .agents dict.
    Agents are accessed via scene.agents (ExperimentAgent list).
    """
    clients = make_dummy_clients()

    config = ExperimentConfig(
        scenario_id="test_variant_iso",
        agents=[
            {"name": "Alice", "properties": {"group": "A"}},
            {"name": "Bob", "properties": {"group": "B"}},
        ],
        actions=[
            {"name": "cooperate", "description": "Cooperate with partner"},
            {"name": "defect", "description": "Defect from partner"},
        ],
        parameters={
            "cooperate_reward": 3,
            "defect_reward": 5,
            "multiplier": 2.0,
            "n_rounds": 10,
        },
        social_network={"edges": [["Alice", "Bob"]], "preset": "ring", "seed": 1},
    )

    scene = ExperimentScene(config)
    adapter = ExperimentRunnerAdapter(scene, clients)
    tree = SimTree.new(adapter, clients)
    return tree, tree.root


@pytest.fixture
def simulator_tree():
    """Create a SimTree with a real Simulator (simple_chat_zh) for advance/run tests.

    The Simulator uses legacy agents where advance() and log handlers work correctly.
    """
    clients = make_dummy_clients()
    sim = build_simple_chat_sim_chinese(clients=clients, event_logger=None)
    tree = SimTree.new(sim, sim.clients)
    return tree, tree.root


# ---------------------------------------------------------------------------
# Config isolation tests (ExperimentRunnerAdapter)
# ---------------------------------------------------------------------------


def test_variant_preserves_base_config(experiment_tree):
    """Branching with config_params_patch must preserve all unpatched parameters,
    all actions, all agents, and the social network."""
    tree, root = experiment_tree

    child_id = tree.branch(root, [
        {"op": "config_params_patch", "updates": {"cooperate_reward": 10}}
    ])

    child_sim = tree.nodes[child_id]["sim"]
    child_config = child_sim.scene.config

    # Patched parameter
    assert child_config.parameters["cooperate_reward"] == 10
    # Unpatched parameters preserved
    assert child_config.parameters["defect_reward"] == 5
    assert child_config.parameters["multiplier"] == 2.0
    assert child_config.parameters["n_rounds"] == 10
    # Actions preserved
    assert len(child_config.actions) == 2
    assert child_config.actions[0]["name"] == "cooperate"
    assert child_config.actions[1]["name"] == "defect"
    # ExperimentScene agents (list of ExperimentAgent)
    agent_names = {a.name for a in child_sim.scene.agents}
    assert agent_names == {"Alice", "Bob"}
    # Network preserved
    assert child_config.social_network["edges"] == [["Alice", "Bob"]]


def test_variant_specific_changes_do_not_mutate_base(experiment_tree):
    """Applying variant ops must not change the base node's config."""
    tree, root = experiment_tree

    original_params = deepcopy(
        tree.nodes[root]["sim"].scene.config.parameters
    )

    tree.branch(root, [
        {"op": "config_params_patch", "updates": {"cooperate_reward": 99, "new_param": True}}
    ])

    assert tree.nodes[root]["sim"].scene.config.parameters == original_params, (
        "Base node config was mutated by variant branch"
    )


def test_variant_multi_branch_config_isolation(experiment_tree):
    """Multiple branches with different config patches must each maintain
    their own independent config without affecting siblings or root."""
    tree, root = experiment_tree

    variant_a = tree.branch(root, [
        {"op": "config_params_patch", "updates": {"cooperate_reward": 10}}
    ])
    variant_b = tree.branch(root, [
        {"op": "config_params_patch", "updates": {"cooperate_reward": 20, "extra": True}}
    ])
    variant_c = tree.branch(root, [
        {"op": "config_params_patch", "updates": {"multiplier": 5.0}}
    ])

    # Each variant has its own config
    a_params = tree.nodes[variant_a]["sim"].scene.config.parameters
    b_params = tree.nodes[variant_b]["sim"].scene.config.parameters
    c_params = tree.nodes[variant_c]["sim"].scene.config.parameters

    assert a_params["cooperate_reward"] == 10
    assert b_params["cooperate_reward"] == 20
    assert b_params["extra"] is True
    assert c_params["multiplier"] == 5.0
    assert c_params["cooperate_reward"] == 3  # Inherited from base

    # Root unchanged
    assert tree.nodes[root]["sim"].scene.config.parameters["cooperate_reward"] == 3
    assert tree.nodes[root]["sim"].scene.config.parameters["multiplier"] == 2.0


# ---------------------------------------------------------------------------
# Run/log isolation tests (Simulator-based tree)
# ---------------------------------------------------------------------------


def test_running_one_variant_does_not_mutate_another(simulator_tree):
    """Advancing one variant must not change another variant's state."""
    tree, root = simulator_tree

    # Create two variant branches
    variant_a = tree.branch(root, [])
    variant_b = tree.branch(root, [])

    # Snapshot variant B before advancing A
    b_agents_before = {
        name: deepcopy(agent.properties)
        for name, agent in tree.nodes[variant_b]["sim"].agents.items()
    }

    # Advance variant A by 1 turn (creates a child node from variant_a)
    advance_a = tree.advance(variant_a, turns=1)

    # Variant B must be unchanged
    for name, props in b_agents_before.items():
        assert tree.nodes[variant_b]["sim"].agents[name].properties == props, (
            f"Variant B agent {name} was mutated by advancing Variant A"
        )

    # Root must also be unchanged
    assert tree.nodes[root]["sim"].turns == 0, (
        "Root turns changed when variant was advanced"
    )

    # Advance A's child node should have progressed
    assert tree.nodes[advance_a]["sim"].turns >= 1


def test_logs_separated_by_variant(simulator_tree):
    """Logs generated by advancing one variant must not appear in another
    variant's or the root's log array.

    advance() creates a new child node; logs go to the child, not the variant.
    """
    tree, root = simulator_tree

    variant_a = tree.branch(root, [])
    variant_b = tree.branch(root, [])

    root_logs_before = len(tree.nodes[root]["logs"])
    variant_b_logs_before = len(tree.nodes[variant_b]["logs"])

    # Advance variant A (creates a child node from variant_a)
    advance_a = tree.advance(variant_a, turns=1)

    advance_a_logs = tree.nodes[advance_a]["logs"]
    b_logs = tree.nodes[variant_b]["logs"]
    root_logs = tree.nodes[root]["logs"]

    # The advance_a child should have new log entries from the run
    assert len(advance_a_logs) > 0, (
        "Advance child should have log entries after advance"
    )

    # Variant B logs unchanged
    assert len(b_logs) == variant_b_logs_before, (
        "Variant B logs changed when Variant A was advanced"
    )
    # Root logs unchanged
    assert len(root_logs) == root_logs_before, (
        "Root logs changed when variant was advanced"
    )
    # All logs in advance_a must reference the advance_a node
    for entry in advance_a_logs:
        assert entry.get("node") == int(advance_a), (
            f"Advance A log entry has wrong node: expected {advance_a}, got {entry.get('node')}"
        )


def test_multi_variant_parallel_run_isolation(simulator_tree):
    """Two variants with different property patches, each advanced, must maintain
    independent state and logs."""
    tree, root = simulator_tree

    # Get first agent name for property patching
    first_agent = next(iter(tree.nodes[root]["sim"].agents.keys()))

    variant_a = tree.branch(root, [
        {"op": "agent_props_patch", "name": first_agent, "updates": {"variant_tag": "A"}}
    ])
    variant_b = tree.branch(root, [
        {"op": "agent_props_patch", "name": first_agent, "updates": {"variant_tag": "B"}}
    ])

    # Advance both (creates child nodes from each variant)
    advance_a = tree.advance(variant_a, turns=1)
    advance_b = tree.advance(variant_b, turns=1)

    # Each variant must have its own tagged property
    assert tree.nodes[variant_a]["sim"].agents[first_agent].properties.get("variant_tag") == "A", (
        "Variant A property was overwritten by Variant B"
    )
    assert tree.nodes[variant_b]["sim"].agents[first_agent].properties.get("variant_tag") == "B", (
        "Variant B property was overwritten by Variant A"
    )
    # Advance children inherit variant properties
    assert tree.nodes[advance_a]["sim"].agents[first_agent].properties.get("variant_tag") == "A"
    assert tree.nodes[advance_b]["sim"].agents[first_agent].properties.get("variant_tag") == "B"
    # Root must not have the variant_tag
    assert tree.nodes[root]["sim"].agents[first_agent].properties.get("variant_tag") is None, (
        "Root agent was mutated by variant runs"
    )

    # Logs must not cross-contaminate between advance children
    a_node_ids = {entry.get("node") for entry in tree.nodes[advance_a]["logs"]}
    b_node_ids = {entry.get("node") for entry in tree.nodes[advance_b]["logs"]}

    assert all(nid == int(advance_a) for nid in a_node_ids if nid is not None), (
        "Advance A logs contain events from another variant"
    )
    assert all(nid == int(advance_b) for nid in b_node_ids if nid is not None), (
        "Advance B logs contain events from another variant"
    )


def test_comparison_identifies_variants_separately(simulator_tree):
    """When comparing logs from two advance child nodes, each variant's events
    should be identifiable by their node_id, and the sets should not overlap."""
    tree, root = simulator_tree

    variant_a = tree.branch(root, [])
    variant_b = tree.branch(root, [])

    # Advance both (creates child nodes)
    advance_a = tree.advance(variant_a, turns=1)
    advance_b = tree.advance(variant_b, turns=1)

    # Collect events from each advance child
    a_logs = tree.nodes[advance_a]["logs"]
    b_logs = tree.nodes[advance_b]["logs"]

    a_events = [e for e in a_logs if e.get("node") == int(advance_a)]
    b_events = [e for e in b_logs if e.get("node") == int(advance_b)]

    # Both advance children should have their own events
    assert len(a_events) > 0, "Advance A should have its own events after advance"
    assert len(b_events) > 0, "Advance B should have its own events after advance"

    # No cross-contamination: A events should not reference B's node and vice versa
    a_node_ids = {e.get("node") for e in a_events}
    b_node_ids = {e.get("node") for e in b_events}
    assert a_node_ids == {int(advance_a)}, f"A events reference wrong nodes: {a_node_ids}"
    assert b_node_ids == {int(advance_b)}, f"B events reference wrong nodes: {b_node_ids}"
