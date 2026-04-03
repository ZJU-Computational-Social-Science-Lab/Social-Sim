"""
Test to check if scenes are being reused incorrectly during auto-advance.

This reproduces the exact scenario from the user's bug report.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

import asyncio
from socialsim4.core.experiment.config import ExperimentConfig
from socialsim4.core.experiment.scene import ExperimentScene
from socialsim4.core.llm.client import LLMClient
from socialsim4.core.llm_config import LLMConfig
from socialsim4.backend.services.simtree_runtime import ExperimentRunnerAdapter
from socialsim4.core.simtree import SimTree

# Create a config with 10 agents
agents_config = [
    {
        "name": f"Agent {i+1}",
        "properties": {"Trust": 50, "Risk Tolerance": 50},
    }
    for i in range(10)
]

config = ExperimentConfig(
    agents=agents_config,
    actions=[{"name": "allocate"}, {"name": "keep"}],
    parameters={
        "tokens_per_round": 10,
        "multiplier": 1.3,
        "resource_name": "tokens",
    },
    description="Public Goods Game",
    scenario_id="public_goods",
    round_visibility="simultaneous",
)

# Create LLM client
llm_config = LLMConfig(dialect="mock", model="test")
llm_client = LLMClient(llm_config)

# Create scene and adapter
scene = ExperimentScene(config)
adapter = ExperimentRunnerAdapter(scene, {"chat": llm_client})

print(f"=== Initial state ===")
print(f"Scene id: {id(scene)}")
print(f"Scene.agents id: {id(scene.agents)}")
print(f"Scene.agents: {len(scene.agents)}")
print(f"Scene.runner: {scene.runner}")
if scene.runner:
    print(f"Scene.runner.agents id: {id(scene.runner.agents)}")
    print(f"Scene.runner.agents: {len(scene.runner.agents)}")
    print(f"Same list? {scene.agents is scene.runner.agents}")

# Create a SimTree
tree = SimTree.new(adapter, adapter.clients)

# Run 5 rounds
print(f"\n=== Running first 5 rounds ===")
parent = tree.root
for i in range(5):
    # Clone the simulator
    cid = tree.copy_sim(parent)
    tree.attach(parent, [{"op": "advance", "turns": 1}], cid)

    # Get the simulator for this node
    simulator = tree.nodes[cid]["sim"]

    # Check scene state BEFORE running
    print(f"\n--- Node {cid} (Round {i+1}) BEFORE run ---")
    print(f"  Simulator type: {type(simulator).__name__}")
    print(f"  Scene id: {id(simulator.scene)}")
    print(f"  Scene.agents id: {id(simulator.scene.agents)}")
    print(f"  Scene.agents count: {len(simulator.scene.agents)}")
    if simulator.scene.runner:
        print(f"  Scene.runner.agents id: {id(simulator.scene.runner.agents)}")
        print(f"  Scene.runner.agents count: {len(simulator.scene.runner.agents)}")
        print(f"  Same list? {simulator.scene.agents is simulator.scene.runner.agents}")
    else:
        print(f"  Scene.runner: None")

    # Run the round
    simulator.run(max_turns=1)

    # Check scene state AFTER running
    print(f"  --- AFTER run ---")
    print(f"  Logs count: {len(tree.nodes[cid]['logs'])}")
    print(f"  Scene.current_round: {simulator.scene.current_round}")
    print(f"  Scene.runner.agents count: {len(simulator.scene.runner.agents) if simulator.scene.runner else 'None'}")

    parent = cid

# Now run rounds 6-10 (this is where the bug happens)
print(f"\n=== Running rounds 6-10 ===")
for i in range(5, 10):
    # Clone the simulator
    cid = tree.copy_sim(parent)
    tree.attach(parent, [{"op": "advance", "turns": 1}], cid)

    # Get the simulator for this node
    simulator = tree.nodes[cid]["sim"]

    # Check scene state BEFORE running
    print(f"\n--- Node {cid} (Round {i+1}) BEFORE run ---")
    print(f"  Scene id: {id(simulator.scene)}")
    print(f"  Scene.agents id: {id(simulator.scene.agents)}")
    print(f"  Scene.agents count: {len(simulator.scene.agents)}")
    if simulator.scene.runner:
        print(f"  Scene.runner.agents id: {id(simulator.scene.runner.agents)}")
        print(f"  Scene.runner.agents count: {len(simulator.scene.runner.agents)}")
        print(f"  Same list? {simulator.scene.agents is simulator.scene.runner.agents}")
    else:
        print(f"  Scene.runner: None")

    # Run the round
    simulator.run(max_turns=1)

    # Check scene state AFTER running
    print(f"  --- AFTER run ---")
    print(f"  Logs count: {len(tree.nodes[cid]['logs'])}")
    print(f"  Scene.current_round: {simulator.scene.current_round}")
    print(f"  Scene.runner.agents count: {len(simulator.scene.runner.agents) if simulator.scene.runner else 'None'}")

    parent = cid

# Summary
print(f"\n=== Summary ===")
for nid, node in tree.nodes.items():
    if nid == tree.root:
        continue
    logs = node.get("logs", [])
    rounds_in_logs = set()
    for log in logs:
        if log.get("type") == "experiment_action":
            round_num = log.get("data", {}).get("round")
            if round_num:
                rounds_in_logs.add(round_num)
    print(f"Node {nid}: {len(logs)} logs, rounds={sorted(rounds_in_logs)}")
