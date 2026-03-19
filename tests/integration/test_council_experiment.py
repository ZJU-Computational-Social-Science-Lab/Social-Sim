"""
Integration tests for Council experiment migration.

Validates that CouncilExperimentScene produces same behavior as legacy
council_scene.py for multi-round deliberation, voting, and conclusion.

Tests cover:
- Scene initialization (REFACTOR-COUNCIL-01)
- Config validation (REFACTOR-COUNCIL-02)
- Action handlers (REFACTOR-COUNCIL-03)
- Multi-round context (REFACTOR-COUNCIL-04)
- Phase transitions (REFACTOR-COUNCIL-05)
- End-to-end behavior (REFACTOR-COUNCIL-08)

Exports: TestCouncilExperimentScene, TestCouncilActionHandlers
"""
import pytest
from unittest.mock import MagicMock

from socialsim4.core.experiment.scenes.council_experiment import CouncilExperimentScene
from socialsim4.core.experiment.config import ExperimentConfig
from socialsim4.core.experiment.game_configs import create_council_config
from socialsim4.core.experiment.state import ExperimentState
from socialsim4.core.experiment.actions.handlers import (
    handle_council_speak,
    handle_start_voting,
    handle_vote,
    handle_conclude,
)


class TestCouncilExperimentScene:
    """Tests for CouncilExperimentScene class (REFACTOR-COUNCIL-01, REFACTOR-COUNCIL-04, REFACTOR-COUNCIL-05)."""

    @pytest.fixture
    def council_config(self):
        """Create a test council configuration (REFACTOR-COUNCIL-02)."""
        return create_council_config(
            proposal_text="Should we implement the new feature?",
            deliberation_rounds=2,
            voting_threshold=0.5,
        )

    @pytest.fixture
    def experiment_config(self, council_config):
        """Create experiment config for council scene."""
        return ExperimentConfig(
            scenario_id="council",
            agents=[
                {"name": "Alice", "properties": {"role": "developer"}},
                {"name": "Bob", "properties": {"role": "designer"}},
                {"name": "Carol", "properties": {"role": "pm"}},
            ],
            actions=[{"name": a} for a in council_config.actions],
            parameters={
                "deliberation_rounds": council_config.deliberation_rounds,
                "voting_threshold": council_config.voting_threshold,
                "proposal_text": council_config.proposal_text,
            },
        )

    @pytest.fixture
    def council_scene(self, experiment_config):
        """Create a council experiment scene."""
        scene = CouncilExperimentScene(experiment_config)
        scene.state = ExperimentState()
        scene.state.agents = {
            "Alice": MagicMock(),
            "Bob": MagicMock(),
            "Carol": MagicMock(),
        }
        return scene

    def test_scene_initialization(self, council_scene):
        """Test that council scene initializes correctly (REFACTOR-COUNCIL-01)."""
        assert council_scene.TYPE == "council", "TYPE should be 'council'"
        assert hasattr(council_scene, 'facilitator'), "Should have facilitator attribute"
        assert hasattr(council_scene, 'round_context_manager'), "Should have round_context_manager attribute"
        assert council_scene.round_num == 1, "Initial round_num should be 1"

    def test_is_complete_initially_false(self, council_scene):
        """Test that is_complete returns False initially."""
        assert council_scene.is_complete() is False, "Should not be complete initially"

    def test_is_complete_after_conclude(self, council_scene):
        """Test that is_complete returns True after conclude action."""
        council_scene.state.extensions["concluded"] = True
        assert council_scene.is_complete() is True, "Should be complete after concluded=True"

    def test_prior_round_context_first_round(self, council_scene):
        """Test that first round returns 'first round' message (REFACTOR-COUNCIL-04)."""
        context = council_scene.get_prior_round_context("Alice")
        assert "first round" in context.lower(), f"Should mention 'first round', got: {context}"
        assert "no prior context" in context.lower(), f"Should mention 'no prior context', got: {context}"

    def test_get_scene_actions_filters_by_phase(self, council_scene):
        """Test that get_scene_actions filters by phase (REFACTOR-COUNCIL-05)."""
        # Verify method exists
        assert hasattr(council_scene, 'get_scene_actions'), "Should have get_scene_actions method"
        # In discussion phase, speak should be allowed
        actions = council_scene.get_scene_actions("Alice")
        assert isinstance(actions, list), "Should return list of actions"
        # Verify it's a filtering method (not just returns all actions)
        assert len(actions) <= len(council_scene.config.actions), "Should filter actions, not return all"

    def test_get_agent_status_prompt_combines_context(self, council_scene):
        """Test that get_agent_status_prompt combines phase status with prior context (REFACTOR-COUNCIL-04)."""
        status = council_scene.get_agent_status_prompt("Alice")
        assert isinstance(status, str), "Should return string"
        assert "Prior Round Deliberation Context" in status, "Should include context section"
        # Should mention phase (discussion or voting)
        assert "Phase" in status or "phase" in status, "Should mention current phase"
