"""
Test script to verify cycle phase transition bug and fix.

This script simulates the experiment runner's behavior to demonstrate
that _advance_round() is not being called, causing the phase to never
transition from DELIBERATION to VOTING.
"""
from socialsim4.core.experiment.scenes.council_experiment import (
    CouncilExperimentScene,
    CouncilCyclePhase,
)
from socialsim4.core.experiment.config import ExperimentConfig


def test_without_advance_round():
    """Demonstrates the bug: phase never transitions without _advance_round()."""
    print("=" * 60)
    print("TEST 1: Without _advance_round() (BUGGY BEHAVIOR)")
    print("=" * 60)

    config = ExperimentConfig(
        agents=[
            {"name": "Alice", "properties": {}},
            {"name": "Bob", "properties": {}},
        ],
        actions=[{"name": "speak"}, {"name": "skip"}, {"name": "vote_yes"}],
        parameters={"deliberation_rounds": 3},
        description="Test council",
        scenario_id="council",
    )
    scene = CouncilExperimentScene(config)

    print(f"\nInitial state:")
    print(f"  cycle_phase: {scene.cycle_phase}")
    print(f"  rounds_in_cycle_phase: {scene.rounds_in_cycle_phase}")
    print(f"  available actions: {scene.get_scene_actions('Alice')}")

    # Simulate 3 rounds WITHOUT calling _advance_round()
    for i in range(1, 5):
        print(f"\nRound {i} (simulated, no _advance_round call):")
        print(f"  cycle_phase: {scene.cycle_phase}")
        print(f"  rounds_in_cycle_phase: {scene.rounds_in_cycle_phase}")
        print(f"  available actions: {scene.get_scene_actions('Alice')}")

    print("\n[BUG] After Round 3, agents should see voting actions but still see speak/skip!")


def test_with_advance_round():
    """Demonstrates the fix: phase transitions correctly with _advance_round()."""
    print("\n" + "=" * 60)
    print("TEST 2: With _advance_round() (CORRECT BEHAVIOR)")
    print("=" * 60)

    config = ExperimentConfig(
        agents=[
            {"name": "Alice", "properties": {}},
            {"name": "Bob", "properties": {}},
        ],
        actions=[{"name": "speak"}, {"name": "skip"}, {"name": "vote_yes"}],
        parameters={"deliberation_rounds": 3},
        description="Test council",
        scenario_id="council",
    )
    scene = CouncilExperimentScene(config)

    print(f"\nInitial state:")
    print(f"  cycle_phase: {scene.cycle_phase}")
    print(f"  rounds_in_cycle_phase: {scene.rounds_in_cycle_phase}")
    print(f"  available actions: {scene.get_scene_actions('Alice')}")

    # Simulate rounds WITH calling _advance_round()
    for i in range(1, 5):
        print(f"\nAfter Round {i} completes (calling _advance_round):")
        scene._advance_round()
        print(f"  cycle_phase: {scene.cycle_phase}")
        print(f"  rounds_in_cycle_phase: {scene.rounds_in_cycle_phase}")
        print(f"  available actions: {scene.get_scene_actions('Alice')}")

        if scene.cycle_phase == CouncilCyclePhase.VOTING:
            print("\n[SUCCESS] Phase transitioned to VOTING after 3 rounds!")
            break


if __name__ == "__main__":
    test_without_advance_round()
    test_with_advance_round()
