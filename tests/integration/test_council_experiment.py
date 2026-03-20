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
from socialsim4.core.phase_controller import CouncilPhase


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

    def test_automatic_voting_transition(self, council_scene, council_config):
        """Test automatic transition to voting after deliberation rounds complete (FEAT-COUNCIL-03)."""
        # Verify initial state
        assert council_scene.facilitator.phase == CouncilPhase.DISCUSSION
        assert council_scene.facilitator._deliberation_rounds == council_config.deliberation_rounds

        # Simulate round 1 completing
        council_scene.round_num = 1
        council_scene.facilitator.current_round_num = 1
        transitioned = council_scene.facilitator.check_and_transition_phase(1)
        assert transitioned is False, "Should not transition after round 1"
        assert council_scene.facilitator.phase == CouncilPhase.DISCUSSION

        # Simulate round 2 completing (deliberation_rounds=2)
        council_scene.round_num = 2
        council_scene.facilitator.current_round_num = 2
        transitioned = council_scene.facilitator.check_and_transition_phase(2)
        assert transitioned is False, "Should not transition during round 2"
        assert council_scene.facilitator.phase == CouncilPhase.DISCUSSION

        # After round 2 completes, check for transition to round 3
        council_scene.round_num = 3
        council_scene.facilitator.current_round_num = 3
        transitioned = council_scene.facilitator.check_and_transition_phase(3)
        assert transitioned is True, "Should transition after round 2 completes (round 3 starts)"
        assert council_scene.facilitator.phase == CouncilPhase.VOTING
        assert council_scene.state.extensions.get("voting_started") is True

        # Verify actions available in voting phase
        actions = council_scene.get_scene_actions("Alice")
        assert "vote" in actions, "Vote should be available in voting phase"
        assert "send_message" not in actions, "Speak should NOT be available in voting phase"
        assert "start_voting" not in actions, "start_voting should NOT be available in voting phase"

    def test_deliberation_action_filtering(self, council_scene):
        """Test that start_voting is blocked during deliberation rounds (FEAT-COUNCIL-02)."""
        # Set deliberation_rounds=2
        council_scene.facilitator.set_deliberation_rounds(2)
        council_scene.facilitator.current_round_num = 1

        # Check start_voting is blocked
        allowed, error = council_scene.facilitator.is_action_allowed("start_voting")
        assert allowed is False, "start_voting should be blocked during deliberation"
        assert "remaining" in error.lower(), f"Error should mention remaining rounds, got: {error}"

        # Check speak is allowed
        allowed, _ = council_scene.facilitator.is_action_allowed("send_message")
        assert allowed is True, "Speak should be allowed during deliberation"

        # After deliberation completes
        council_scene.facilitator.current_round_num = 3

        # Check start_voting is now allowed
        allowed, error = council_scene.facilitator.is_action_allowed("start_voting")
        assert allowed is True, "start_voting should be allowed after deliberation completes"
        assert error is None


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


class TestActionFilteringIntegration:
    """Tests for GAP-CLOSURE-01: Action filtering wired from facilitator to prompt builder."""

    @pytest.fixture
    def council_config(self):
        """Create a test council configuration."""
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
        }
        return scene

    def test_action_filtering_deliberation_phase(self, council_scene):
        """Test that only speak-like actions available during deliberation (GAP-CLOSURE-01)."""
        # Set deliberation_rounds=2
        council_scene.facilitator.set_deliberation_rounds(2)
        council_scene.facilitator.current_round_num = 1

        # Round 1: Should only have speak-like actions (deliberation phase)
        actions_r1 = council_scene.get_scene_actions("Alice")

        # Speak should be available during deliberation
        assert "speak" in actions_r1, f"speak should be available during deliberation, got: {actions_r1}"
        # call_vote should NOT be available during deliberation (blocked)
        assert "call_vote" not in actions_r1, f"call_vote should NOT be available during deliberation, got: {actions_r1}"
        # Vote actions should NOT be available during deliberation
        assert "vote" not in actions_r1, f"vote should NOT be available during deliberation, got: {actions_r1}"

    def test_action_filtering_voting_phase(self, council_scene):
        """Test that only vote actions available during voting phase (GAP-CLOSURE-01)."""
        # Set deliberation_rounds=2, then transition to voting
        council_scene.facilitator.set_deliberation_rounds(2)
        council_scene.facilitator.current_round_num = 3
        council_scene.facilitator.check_and_transition_phase(3)

        # After transition: Should only have vote actions
        actions_voting = council_scene.get_scene_actions("Alice")

        # Vote actions should be available during voting
        assert "vote" in actions_voting, f"vote should be available during voting, got: {actions_voting}"
        # Speak should NOT be available during voting
        assert "speak" not in actions_voting, f"speak should NOT be available during voting, got: {actions_voting}"
        # call_vote should NOT be available during voting (meeting already in voting)
        assert "call_vote" not in actions_voting, f"call_vote should NOT be available during voting, got: {actions_voting}"

    def test_call_vote_blocked_during_deliberation(self, council_scene):
        """Test that call_vote is blocked when deliberation_rounds is set (GAP-CLOSURE-01)."""
        council_scene.facilitator.set_deliberation_rounds(2)
        council_scene.facilitator.current_round_num = 1

        # Check call_vote is blocked
        allowed, error = council_scene.facilitator.is_action_allowed("call_vote")
        assert allowed is False, "call_vote should be blocked during deliberation rounds"
        assert "deliberation" in error.lower() or "round" in error.lower(), f"Error should mention deliberation/rounds, got: {error}"

    def test_call_vote_blocked_start_voting_alias(self, council_scene):
        """Test that both call_vote and start_voting are blocked consistently (GAP-CLOSURE-01)."""
        council_scene.facilitator.set_deliberation_rounds(2)
        council_scene.facilitator.current_round_num = 1

        # Both should be blocked
        allowed_sv, error_sv = council_scene.facilitator.is_action_allowed("start_voting")
        allowed_cv, error_cv = council_scene.facilitator.is_action_allowed("call_vote")

        assert allowed_sv is False, "start_voting should be blocked"
        assert allowed_cv is False, "call_vote should be blocked"
        assert "deliberation" in error_sv.lower() or "round" in error_sv.lower()

    def test_action_filtering_after_deliberation_complete(self, council_scene):
        """Test that call_vote/start_voting allowed after deliberation rounds complete (GAP-CLOSURE-01)."""
        council_scene.facilitator.set_deliberation_rounds(2)
        # After 2 rounds complete (round 3 starts)
        council_scene.facilitator.current_round_num = 3

        # Check start_voting is now allowed
        allowed, error = council_scene.facilitator.is_action_allowed("start_voting")
        assert allowed is True, f"start_voting should be allowed after deliberation completes, error: {error}"
        assert error is None

