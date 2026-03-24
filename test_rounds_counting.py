"""
Quick test to verify rounds_in_cycle_phase is persisted correctly.
"""
import sys
sys.path.insert(0, r"C:\Users\Justin\Documents\ZJU_Work\Social-Sim\src")

from socialsim4.core.experiment.scenes.council_experiment import (
    CouncilExperimentScene,
    CouncilCyclePhase,
)
from socialsim4.core.experiment.config import ExperimentConfig

# Create scene with deliberation_rounds = 2
config = ExperimentConfig(
    agents=[
        {"name": "Alice", "properties": {}},
        {"name": "Bob", "properties": {}},
    ],
    actions=[{"name": "speak"}, {"name": "skip"}, {"name": "vote_yes"}],
    parameters={"deliberation_rounds": 2},
    description="Test",
    scenario_id="council",
)
scene = CouncilExperimentScene(config)

print(f"Initial state:")
print(f"  cycle_phase: {scene.cycle_phase}")
print(f"  rounds_in_cycle_phase: {scene.rounds_in_cycle_phase}")
print()

# Advance round 1
scene._advance_round()
print(f"After Round 1:")
print(f"  cycle_phase: {scene.cycle_phase}")
print(f"  rounds_in_cycle_phase: {scene.rounds_in_cycle_phase}")
print(f"  Expected: DELIBERATION, rounds=1")
print()

# Advance round 2
scene._advance_round()
print(f"After Round 2:")
print(f"  cycle_phase: {scene.cycle_phase}")
print(f"  rounds_in_cycle_phase: {scene.rounds_in_cycle_phase}")
print(f"  Expected: VOTING, rounds=0")
print()

# Test serialization/deserialization
print("Testing serialization...")
serialized = scene.serialize_config()
print(f"  Serialized cycle_phase: {serialized['extensions']['cycle_phase']}")

# Deserialize
scene2 = CouncilExperimentScene.deserialize_config(serialized)
print(f"After deserialization:")
print(f"  cycle_phase: {scene2.cycle_phase}")
print(f"  rounds_in_cycle_phase: {scene2.rounds_in_cycle_phase}")
print()

if scene2.cycle_phase == scene.cycle_phase and scene2.rounds_in_cycle_phase == scene.rounds_in_cycle_phase:
    print("✅ PASS: State persisted correctly")
else:
    print("❌ FAIL: State NOT persisted correctly!")
    print(f"  Expected: {scene.cycle_phase}, {scene.rounds_in_cycle_phase}")
    print(f"  Got: {scene2.cycle_phase}, {scene2.rounds_in_cycle_phase}")
