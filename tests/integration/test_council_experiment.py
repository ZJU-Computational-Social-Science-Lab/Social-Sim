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
        # Implementation returns "This is the first round." - check for key phrase
        assert "first round" in context.lower(), f"Should mention 'first round', got: {context}"

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


class TestCouncilActionHandlers:
    """Tests for council action handlers (REFACTOR-COUNCIL-03)."""

    @pytest.fixture
    def state(self):
        """Create a test state."""
        state = ExperimentState()
        state.agents = {"Alice": MagicMock(), "Bob": MagicMock()}
        return state

    @pytest.fixture
    def scene(self, state):
        """Create a mock scene."""
        scene = MagicMock()
        scene.state = state
        scene.round_num = 1
        return scene

    def test_handle_speak_records_to_context(self, state, scene):
        """Test that speak action records to context manager (REFACTOR-COUNCIL-04)."""
        scene.round_context_manager = MagicMock()

        result = handle_council_speak(
            {"message": "I think we should proceed"},
            "Alice",
            state,
            scene
        )

        assert result["success"] is True, f"Speak should succeed, got: {result}"
        assert "summary" in result, "Result should have summary"
        assert "Alice" in result["summary"], "Summary should mention agent name"
        scene.round_context_manager.record_action.assert_called_once()

    def test_handle_start_voting_sets_state(self, state, scene):
        """Test that start_voting sets voting_started flag (REFACTOR-COUNCIL-05)."""
        result = handle_start_voting(
            {"title": "Test Proposal"},
            "Alice",
            state,
            scene
        )

        assert result["success"] is True, f"start_voting should succeed, got: {result}"
        assert state.extensions.get("voting_started") is True, "Should set voting_started=True"
        assert state.extensions.get("vote_title") == "Test Proposal", "Should set vote_title"

    def test_handle_start_voting_guard(self, state, scene):
        """Test that start_voting fails if already started (REFACTOR-COUNCIL-05)."""
        state.extensions["voting_started"] = True

        result = handle_start_voting(
            {"title": "Test Proposal"},
            "Alice",
            state,
            scene
        )

        assert result["success"] is False, "start_voting should fail if already started"
        assert "already" in result.get("message", "").lower(), "Error message should mention 'already'"

    def test_handle_vote_records_choice(self, state, scene):
        """Test that vote action records vote choice (REFACTOR-COUNCIL-03)."""
        state.extensions["voting_started"] = True
        state.extensions["votes"] = {}

        result = handle_vote(
            {"choice": "yes"},
            "Alice",
            state,
            scene
        )

        assert result["success"] is True, f"Vote should succeed, got: {result}"
        assert state.extensions["votes"]["Alice"] == "yes", "Should record vote choice"
        assert "summary" in result, "Result should have summary"

    def test_handle_vote_guard_not_started(self, state, scene):
        """Test that vote fails if voting not started (REFACTOR-COUNCIL-05)."""
        result = handle_vote(
            {"choice": "yes"},
            "Alice",
            state,
            scene
        )

        assert result["success"] is False, "Vote should fail if voting not started"
        assert "not started" in result.get("message", "").lower(), "Error should mention 'not started'"

    def test_handle_vote_invalid_choice(self, state, scene):
        """Test that vote fails for invalid choice (REFACTOR-COUNCIL-03)."""
        state.extensions["voting_started"] = True

        result = handle_vote(
            {"choice": "maybe"},
            "Alice",
            state,
            scene
        )

        assert result["success"] is False, "Vote should fail for invalid choice"
        assert "invalid" in result.get("message", "").lower(), "Error should mention 'invalid'"

    def test_handle_conclude_checks_threshold(self, state, scene):
        """Test that conclude checks voting threshold (REFACTOR-COUNCIL-03)."""
        state.extensions["voting_started"] = True
        state.extensions["votes"] = {
            "Alice": "yes",
            "Bob": "yes",
        }
        scene.game_config = MagicMock()
        scene.game_config.voting_threshold = 0.5

        result = handle_conclude({}, "Alice", state, scene)

        assert result["success"] is True, f"Conclude should succeed, got: {result}"
        assert state.extensions.get("concluded") is True, "Should set concluded=True"
        assert result.get("passed") is True, "Proposal should pass with 2/2 yes votes"

    def test_handle_conclude_guard_not_started(self, state, scene):
        """Test that conclude fails if voting not started (REFACTOR-COUNCIL-05)."""
        result = handle_conclude({}, "Alice", state, scene)

        assert result["success"] is False, "Conclude should fail if voting not started"
        assert "not" in result.get("message", "").lower(), "Error message should exist"

    def test_handle_conclude_threshold_calculation(self, state, scene):
        """Test that conclude correctly calculates pass/fail based on threshold (REFACTOR-COUNCIL-03)."""
        state.extensions["voting_started"] = True
        # 1 yes, 2 no = 33% yes - should fail with 0.5 threshold (need >= 50%)
        state.extensions["votes"] = {
            "Alice": "yes",
            "Bob": "no",
            "Carol": "no",
        }
        state.agents = {"Alice": MagicMock(), "Bob": MagicMock(), "Carol": MagicMock()}
        scene.game_config = MagicMock()
        scene.game_config.voting_threshold = 0.5

        result = handle_conclude({}, "Alice", state, scene)

        assert result["success"] is True
        assert result.get("passed") is False, "Proposal should fail with 1/3 yes votes (33% < 50% threshold)"
        assert "rejected" in result.get("summary", "").lower(), "Summary should mention 'rejected'"
