"""
End-to-end test for council cycle phase transitions with experiment runner.

This test verifies that the fix (calling scene._advance_round() in runner)
works correctly in the actual experiment execution flow.
"""
import asyncio
from socialsim4.core.experiment.scenes.council_experiment import (
    CouncilExperimentScene,
    CouncilCyclePhase,
)
from socialsim4.core.experiment.config import ExperimentConfig
from socialsim4.core.experiment.runner import ExperimentRunner
from socialsim4.core.experiment.agent import ExperimentAgent
from socialsim4.core.experiment.game_configs import GameConfig


async def test_e2e_phase_transition_with_runner():
    """
    Test that phase transitions work correctly when using the actual
    experiment runner (not just manual _advance_round calls).
    """
    print("=" * 70)
    print("END-TO-END TEST: Phase Transition with Experiment Runner")
    print("=" * 70)

    # Setup
    config = ExperimentConfig(
        agents=[
            {"name": "Alice", "properties": {"role": "Agent A"}},
            {"name": "Bob", "properties": {"role": "Agent B"}},
        ],
        actions=[
            {"name": "speak"},
            {"name": "skip"},
            {"name": "vote_yes"},
            {"name": "vote_no"},
            {"name": "abstain"},
        ],
        parameters={
            "deliberation_rounds": 3,
            "voting_threshold": 0.5,
            "proposal_text": "Test proposal"
        },
        description="Test council",
        scenario_id="council",
    )

    scene = CouncilExperimentScene(config)

    # Create agents
    agents = [
        ExperimentAgent(
            name=agent_config["name"],
            properties=agent_config["properties"],
            llm_config={},  # Empty config, not needed for this test
        )
        for agent_config in config.agents
    ]

    # Create game config
    game_config = GameConfig(
        name="council_test",
        description=config.description,
        action_type="discrete",
        actions=[action["name"] for action in config.actions],
    )

    # Create runner
    runner = ExperimentRunner(
        agents=agents,
        game_config=game_config,
        llm_client=None,  # Not needed for this test
        scene=scene,
        round_visibility="sequential",
    )

    print(f"\nInitial state:")
    print(f"  cycle_phase: {scene.cycle_phase}")
    print(f"  rounds_in_cycle_phase: {scene.rounds_in_cycle_phase}")

    # Run 3 rounds (should transition to VOTING)
    print(f"\nRunning 3 rounds...")
    results = await runner.run(max_rounds=3)

    print(f"\nAfter 3 rounds:")
    print(f"  cycle_phase: {scene.cycle_phase}")
    print(f"  rounds_in_cycle_phase: {scene.rounds_in_cycle_phase}")
    print(f"  available actions: {scene.get_scene_actions('Alice')}")

    # Verify transition occurred
    assert scene.cycle_phase == CouncilCyclePhase.VOTING, \
        f"Expected VOTING phase but got {scene.cycle_phase}"
    assert scene.rounds_in_cycle_phase == 0, \
        f"Expected rounds_in_cycle_phase=0 but got {scene.rounds_in_cycle_phase}"

    voting_actions = set(scene.get_scene_actions("Alice"))
    expected_actions = {"vote_yes", "vote_no", "abstain"}
    assert voting_actions == expected_actions, \
        f"Expected {expected_actions} but got {voting_actions}"

    print("\n[SUCCESS] Phase transitioned to VOTING after 3 rounds!")
    print("[SUCCESS] The fix works correctly with the experiment runner!")


if __name__ == "__main__":
    asyncio.run(test_e2e_phase_transition_with_runner())
