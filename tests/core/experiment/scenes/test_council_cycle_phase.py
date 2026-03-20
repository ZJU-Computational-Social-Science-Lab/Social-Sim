"""Tests for council cycle phase action filtering."""
import pytest
from socialsim4.core.experiment.scenes.council_experiment import (
    CouncilExperimentScene,
    CouncilCyclePhase,
)
from socialsim4.core.experiment.config import ExperimentConfig


def test_cycle_phase_enum_exists():
    """Test that CouncilCyclePhase enum has expected values."""
    assert CouncilCyclePhase.DELIBERATION.value == "deliberation"
    assert CouncilCyclePhase.VOTING.value == "voting"
    assert CouncilCyclePhase.POST_VOTE_DISCUSSION.value == "post_vote_discussion"


def test_get_scene_actions_deliberation():
    """Test that deliberation phase allows speak and skip only."""
    config = ExperimentConfig(
        agents=[{"name": "Alice", "properties": {}}],
        actions=[{"name": "speak"}, {"name": "skip"}, {"name": "vote_yes"}],
        parameters={"deliberation_rounds": 3},
        description="Test council",
        scenario_id="council",
    )
    scene = CouncilExperimentScene(config)
    scene.cycle_phase = CouncilCyclePhase.DELIBERATION

    actions = scene.get_scene_actions("Alice")
    assert set(actions) == {"speak", "skip"}


def test_get_scene_actions_voting():
    """Test that voting phase allows vote_yes, vote_no, abstain only."""
    config = ExperimentConfig(
        agents=[{"name": "Alice", "properties": {}}],
        actions=[{"name": "speak"}, {"name": "skip"}, {"name": "vote_yes"}, {"name": "vote_no"}, {"name": "abstain"}],
        parameters={"deliberation_rounds": 3},
        description="Test council",
        scenario_id="council",
    )
    scene = CouncilExperimentScene(config)
    scene.cycle_phase = CouncilCyclePhase.VOTING

    actions = scene.get_scene_actions("Alice")
    assert set(actions) == {"vote_yes", "vote_no", "abstain"}


def test_get_scene_actions_post_vote_discussion():
    """Test that post-vote discussion phase allows speak and skip only."""
    config = ExperimentConfig(
        agents=[{"name": "Alice", "properties": {}}],
        actions=[{"name": "speak"}, {"name": "skip"}, {"name": "vote_yes"}],
        parameters={"deliberation_rounds": 3},
        description="Test council",
        scenario_id="council",
    )
    scene = CouncilExperimentScene(config)
    scene.cycle_phase = CouncilCyclePhase.POST_VOTE_DISCUSSION

    actions = scene.get_scene_actions("Alice")
    assert set(actions) == {"speak", "skip"}
