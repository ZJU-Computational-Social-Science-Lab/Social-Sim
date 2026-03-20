"""
Unit tests for voting phase action filtering (BUG-CTX-02).

Verifies that agents only see Vote actions during voting phase.
"""

import pytest
from socialsim4.core.phase_controller import SystemFacilitator, CouncilPhase


class MockScene:
    """Mock scene for testing with ExperimentState-like state."""

    def __init__(self):
        # Use extensions dict to match ExperimentState structure
        self.state = type('MockState', (), {})()
        self.state.extensions = {"voting_started": False}


class TestVotingPhaseFiltering:
    """Test voting phase action constraints."""

    def test_vote_allowed_during_voting(self):
        """Vote action should be allowed during voting phase."""
        facilitator = SystemFacilitator(MockScene())
        facilitator.phase = CouncilPhase.VOTING
        facilitator.scene.state.extensions["voting_started"] = True

        allowed, error = facilitator.is_action_allowed("vote")

        assert allowed is True
        assert error is None

    def test_speak_blocked_during_voting(self):
        """Speak/send_message should be blocked during voting phase."""
        facilitator = SystemFacilitator(MockScene())
        facilitator.phase = CouncilPhase.VOTING
        facilitator.scene.state.extensions["voting_started"] = True

        allowed, error = facilitator.is_action_allowed("send_message")

        assert allowed is False
        assert "voting phase" in error.lower()

    def test_vote_blocked_during_discussion(self):
        """Vote should be blocked during discussion phase."""
        facilitator = SystemFacilitator(MockScene())
        facilitator.phase = CouncilPhase.DISCUSSION

        allowed, error = facilitator.is_action_allowed("vote")

        assert allowed is False
        assert "discussion phase" in error.lower()

    def test_phaseless_actions_always_allowed(self):
        """Actions like yield and voting_status should work in any phase."""
        facilitator = SystemFacilitator(MockScene())

        for phase in [CouncilPhase.DISCUSSION, CouncilPhase.VOTING, CouncilPhase.CONCLUDED]:
            facilitator.phase = phase

            for action in ["yield", "voting_status"]:
                allowed, _ = facilitator.is_action_allowed(action)
                assert allowed is True, f"{action} should be allowed in {phase.value}"

    def test_no_actions_allowed_after_conclusion(self):
        """No voting or discussion actions after meeting concludes."""
        facilitator = SystemFacilitator(MockScene())
        facilitator.phase = CouncilPhase.CONCLUDED

        for action in ["vote", "send_message", "start_voting"]:
            allowed, error = facilitator.is_action_allowed(action)
            assert allowed is False, f"{action} should be blocked in concluded phase"

    def test_discussion_actions_allowed_in_discussion(self):
        """Discussion actions should be allowed during discussion phase."""
        facilitator = SystemFacilitator(MockScene())
        facilitator.phase = CouncilPhase.DISCUSSION

        allowed, _ = facilitator.is_action_allowed("send_message")
        assert allowed is True

        allowed, _ = facilitator.is_action_allowed("start_voting")
        assert allowed is True

        allowed, _ = facilitator.is_action_allowed("finish_meeting")
        assert allowed is True

    def test_start_voting_blocked_when_voting_in_progress(self):
        """Cannot start voting when a vote is already in progress."""
        facilitator = SystemFacilitator(MockScene())
        facilitator.phase = CouncilPhase.DISCUSSION
        facilitator.scene.state.extensions["voting_started"] = True

        allowed, error = facilitator.is_action_allowed("start_voting")

        assert allowed is False
        assert "already in progress" in error.lower()

    def test_start_voting_blocked_during_deliberation(self):
        """start_voting should be blocked when deliberation rounds remaining."""
        facilitator = SystemFacilitator(MockScene())
        facilitator.phase = CouncilPhase.DISCUSSION
        facilitator.scene.state.extensions["voting_started"] = False

        # Set deliberation_rounds to 2, currently in round 1
        facilitator.set_deliberation_rounds(2)
        facilitator.current_round_num = 1

        allowed, error = facilitator.is_action_allowed("start_voting")

        assert allowed is False, "start_voting should be blocked during deliberation"
        assert "remaining" in error.lower(), f"Error should mention remaining rounds, got: {error}"
        assert "1" in error, f"Error should show 1 round remaining, got: {error}"

    def test_start_voting_allowed_after_deliberation_complete(self):
        """start_voting should be allowed after deliberation rounds complete."""
        facilitator = SystemFacilitator(MockScene())
        facilitator.phase = CouncilPhase.DISCUSSION
        facilitator.scene.state.extensions["voting_started"] = False

        # Set deliberation_rounds to 2, now in round 3 (past deliberation)
        facilitator.set_deliberation_rounds(2)
        facilitator.current_round_num = 3

        allowed, error = facilitator.is_action_allowed("start_voting")

        assert allowed is True, "start_voting should be allowed after deliberation completes"
        assert error is None

    def test_start_voting_allowed_when_no_fixed_deliberation(self):
        """start_voting should be allowed anytime when deliberation_rounds is None."""
        facilitator = SystemFacilitator(MockScene())
        facilitator.phase = CouncilPhase.DISCUSSION
        facilitator.scene.state.extensions["voting_started"] = False

        # Default: deliberation_rounds is None (agent-controlled)
        assert facilitator._deliberation_rounds is None

        # Round 1: should allow start_voting
        facilitator.current_round_num = 1
        allowed, error = facilitator.is_action_allowed("start_voting")
        assert allowed is True, "start_voting should be allowed when no fixed deliberation"

        # Round 5: should still allow start_voting
        facilitator.current_round_num = 5
        allowed, error = facilitator.is_action_allowed("start_voting")
        assert allowed is True, "start_voting should always be allowed when no fixed deliberation"
