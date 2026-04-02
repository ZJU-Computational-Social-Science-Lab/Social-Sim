"""
Test using ExperimentRunnerAdapter (the CORRECT runner used by the backend).

This test verifies the fix works with the ACTUAL code path the web UI uses.
"""
import sys
sys.path.insert(0, r"C:\Users\Justin\Documents\ZJU_Work\Social-Sim\src")

from socialsim4.core.experiment.scenes.council_experiment import CouncilCyclePhase
from socialsim4.core.experiment.config import ExperimentConfig
from socialsim4.backend.services.simtree_runtime import ExperimentRunnerAdapter
from socialsim4.scenarios.basic import make_clients_from_env
import os

# Set up minimal LLM client config
os.environ.setdefault("OPENAI_API_KEY", "test")
os.environ.setdefault("OPENAI_MODEL", "gpt-4")

# Create scene with deliberation_rounds = 2
config = ExperimentConfig(
    agents=[
        {"name": "Alice", "properties": {"role": "Test agent"}},
        {"name": "Bob", "properties": {"role": "Test agent"}},
    ],
    actions=[{"name": "speak"}, {"name": "skip"}, {"name": "vote_yes"}, {"name": "vote_no"}, {"name": "abstain"}],
    parameters={"deliberation_rounds": 2, "voting_threshold": 0.5},
    description="Test council",
    scenario_id="council",
)

print("="*80)
print("TESTING WITH EXPERIMENTRUNNERADAPTER (Used by Web UI)")
print("="*80)

# Create adapter (this is what the backend uses)
from socialsim4.core.experiment.scenes.council_experiment import CouncilExperimentScene
scene = CouncilExperimentScene(config)

# Mock LLM client (we won't actually call it)
class MockLLMClient:
    def chat(self, *args, **kwargs):
        return '{"action": "skip"}'

mock_clients = {"chat": MockLLMClient(), "default": MockLLMClient()}
adapter = ExperimentRunnerAdapter(scene, mock_clients)

print(f"\nInitial state:")
print(f"  Node 1 (before any rounds):")
print(f"  cycle_phase: {scene.cycle_phase}")
print(f"  rounds_in_cycle_phase: {scene.rounds_in_cycle_phase}")
print(f"  available actions: {scene.get_scene_actions('Alice')}")

# Run Round 1
print(f"\nRunning Round 1...")
try:
    adapter.run(max_turns=1)
except:
    pass  # Will fail because no real LLM, but state should update
print(f"  After Round 1 (Node 2):")
print(f"  cycle_phase: {scene.cycle_phase}")
print(f"  rounds_in_cycle_phase: {scene.rounds_in_cycle_phase}")
print(f"  available actions: {scene.get_scene_actions('Alice')}")

# Run Round 2
print(f"\nRunning Round 2...")
try:
    adapter.run(max_turns=1)
except:
    pass
print(f"  After Round 2 (Node 3):")
print(f"  cycle_phase: {scene.cycle_phase}")
print(f"  rounds_in_cycle_phase: {scene.rounds_in_cycle_phase}")
print(f"  available actions: {scene.get_scene_actions('Alice')}")

# Run Round 3
print(f"\nRunning Round 3...")
try:
    adapter.run(max_turns=1)
except:
    pass
print(f"  After Round 3 (Node 4):")
print(f"  cycle_phase: {scene.cycle_phase}")
print(f"  rounds_in_cycle_phase: {scene.rounds_in_cycle_phase}")
print(f"  available actions: {scene.get_scene_actions('Alice')}")

print("\n" + "="*80)
print("EXPECTED BEHAVIOR with deliberation_rounds=2:")
print("  Node 1: Initial state (DELIBERATION)")
print("  Node 2: After Round 1 (DELIBERATION)")
print("  Node 3: After Round 2 → VOTING transition")
print("  Node 4: After Round 3 (VOTING)")
print("="*80)
