"""Integration tests for council cycle phase flow."""
import pytest
from socialsim4.core.experiment.scenes.council_experiment import (
    CouncilExperimentScene,
    CouncilCyclePhase,
)
from socialsim4.core.experiment.config import ExperimentConfig


def test_full_cycle_flow_threshold_met():
    """Test complete cycle: Deliberation → Voting → Post-Vote → Deliberation when threshold met."""
    config = ExperimentConfig(
        agents=[
            {"name": "Alice", "properties": {}},
            {"name": "Bob", "properties": {}},
        ],
        actions=[{"name": "speak"}, {"name": "skip"}, {"name": "vote_yes"}, {"name": "vote_no"}, {"name": "abstain"}],
        parameters={"deliberation_rounds": 2, "voting_threshold": 0.5},
        description="Test council",
        scenario_id="council",
    )
    scene = CouncilExperimentScene(config)

    # Initial state
    assert scene.cycle_phase == CouncilCyclePhase.DELIBERATION
    assert set(scene.get_scene_actions("Alice")) == {"speak", "skip"}

    # Round 1 of deliberation
    scene._advance_round()
    assert scene.cycle_phase == CouncilCyclePhase.DELIBERATION

    # Round 2 of deliberation - transition to voting
    scene._advance_round()
    assert scene.cycle_phase == CouncilCyclePhase.VOTING
    assert set(scene.get_scene_actions("Alice")) == {"vote_yes", "vote_no", "abstain"}

    # All agents vote (threshold met: 100% yes > 50%)
    scene.record_vote("Alice", "yes")
    scene.record_vote("Bob", "yes")

    # Check transition - should go to post-vote
    scene._advance_round()
    assert scene.cycle_phase == CouncilCyclePhase.POST_VOTE_DISCUSSION
    assert set(scene.get_scene_actions("Alice")) == {"speak", "skip"}

    # Post-vote rounds
    scene._advance_round()  # Round 1 of post-vote
    assert scene.cycle_phase == CouncilCyclePhase.POST_VOTE_DISCUSSION

    scene._advance_round()  # Round 2 of post-vote - back to deliberation
    assert scene.cycle_phase == CouncilCyclePhase.DELIBERATION


def test_full_cycle_flow_threshold_not_met():
    """Test cycle when voting threshold is not met (skips post-vote)."""
    config = ExperimentConfig(
        agents=[
            {"name": "Alice", "properties": {}},
            {"name": "Bob", "properties": {}},
        ],
        actions=[{"name": "speak"}, {"name": "skip"}, {"name": "vote_yes"}, {"name": "vote_no"}, {"name": "abstain"}],
        parameters={"deliberation_rounds": 2, "voting_threshold": 0.6},
        description="Test council",
        scenario_id="council",
    )
    scene = CouncilExperimentScene(config)

    # Advance to voting
    scene._advance_round()
    scene._advance_round()
    assert scene.cycle_phase == CouncilCyclePhase.VOTING

    # Vote: 1 yes, 1 no (50% < 60% threshold)
    scene.record_vote("Alice", "yes")
    scene.record_vote("Bob", "no")

    # Should skip post-vote and go back to deliberation
    scene._advance_round()
    assert scene.cycle_phase == CouncilCyclePhase.DELIBERATION
    assert set(scene.get_scene_actions("Alice")) == {"speak", "skip"}


def test_brevity_instruction_in_cycle():
    """Test that brevity instruction is present during deliberation phases."""
    config = ExperimentConfig(
        agents=[{"name": "Alice", "properties": {}}],
        actions=[{"name": "speak"}, {"name": "skip"}],
        parameters={"deliberation_rounds": 2},
        description="Test council",
        scenario_id="council",
    )
    scene = CouncilExperimentScene(config)

    # Deliberation phase - should have brevity instruction
    assert scene.get_speak_instruction() == "You must respond with only 1-2 sentences."

    # Advance to voting
    scene._advance_round()
    scene._advance_round()
    assert scene.cycle_phase == CouncilCyclePhase.VOTING

    # Voting phase - no brevity instruction
    assert scene.get_speak_instruction() is None

    # Vote and advance to post-vote
    scene.record_vote("Alice", "yes")
    scene._advance_round()
    assert scene.cycle_phase == CouncilCyclePhase.POST_VOTE_DISCUSSION

    # Post-vote phase - brevity instruction returns
    assert scene.get_speak_instruction() == "You must respond with only 1-2 sentences."
