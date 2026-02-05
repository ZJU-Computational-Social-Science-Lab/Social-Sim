"""
Unit tests for ActionController with phase-based validation.

Tests both the new phase-based facilitator validation and backward compatibility
with role-based validation for scenes without a facilitator.
"""

import pytest
from socialsim4.core.action_controller import ActionController, ActionConstraints
from socialsim4.core.action import Action
from socialsim4.core.agent import Agent


# Mock scene with facilitator
class MockSceneWithFacilitator:
    def __init__(self):
        from socialsim4.core.phase_controller import SystemFacilitator, CouncilPhase
        self.facilitator = SystemFacilitator(self)
        self.state = {"voting_started": False}


# Example actions with constraints for testing
class HostOnlyAction(Action, ActionConstraints):
    """Example action with role restriction (deprecated pattern)."""
    NAME = "host_only_action"
    ALLOWED_ROLES = {"Host"}

    def handle(self, action_data, agent, simulator, scene):
        return True, {}, "done", {}, False


class StateGuardedAction(Action, ActionConstraints):
    """Example action with state guard (phase-based pattern)."""
    NAME = "state_guarded_action"

    @staticmethod
    def state_guard(state):
        return state.get("active", False)

    STATE_GUARD = state_guard
    STATE_ERROR = "Cannot act: session not active"

    def handle(self, action_data, agent, simulator, scene):
        return True, {}, "done", {}, False


class ParameterValidatedAction(Action, ActionConstraints):
    """Example action with parameter validation."""
    NAME = "param_action"

    @staticmethod
    def validate_params(data):
        return data.get("value", 0) > 0

    PARAMETER_VALIDATOR = validate_params

    def handle(self, action_data, agent, simulator, scene):
        return True, {}, "done", {}, False


class UnconstrainedAction(Action):
    """Action without constraints - should always be allowed."""
    NAME = "unconstrained_action"

    def handle(self, action_data, agent, simulator, scene):
        return True, {}, "done", {}, False


class TestActionController:
    """Test suite for ActionController with phase-based validation."""

    def test_facilitator_blocks_actions_in_wrong_phase(self):
        """Actions blocked by facilitator when phase is inappropriate."""
        controller = ActionController()
        scene = MockSceneWithFacilitator()

        # In discussion phase, voting actions should be blocked
        agent = Agent("Agent 1", "profile", "style", [], {})

        # vote action should be blocked (voting not started)
        allowed, error = controller.validate_action(
            "vote", {"vote": "yes"}, agent, scene.state, None, scene
        )
        assert not allowed
        assert "not started" in error.lower()

    def test_facilitator_allows_actions_in_correct_phase(self):
        """Actions allowed by facilitator when phase is appropriate."""
        controller = ActionController()
        scene = MockSceneWithFacilitator()

        # Set voting started
        scene.state["voting_started"] = True

        agent = Agent("Agent 1", "profile", "style", [], {})

        # vote action should be allowed now
        allowed, error = controller.validate_action(
            "vote", {"vote": "yes"}, agent, scene.state, None, scene
        )
        assert allowed
        assert error is None

    def test_state_guard_blocks_invalid_state(self):
        """State guard function blocks actions in wrong state."""
        controller = ActionController()
        action = StateGuardedAction()
        agent = Agent("Agent 1", "profile", "style", [], {})
        scene = MockSceneWithFacilitator()

        # Inactive state blocked
        allowed, error = controller.validate_action(
            "state_guarded_action", {}, agent, {"active": False}, action, scene
        )
        assert not allowed
        assert "session not active" in error

        # Active state allowed
        allowed, error = controller.validate_action(
            "state_guarded_action", {}, agent, {"active": True}, action, scene
        )
        assert allowed

    def test_parameter_validator_blocks_invalid_params(self):
        """Parameter validator rejects invalid parameters."""
        controller = ActionController()
        action = ParameterValidatedAction()
        agent = Agent("Agent 1", "profile", "style", [], {})
        scene = MockSceneWithFacilitator()

        # Invalid param (value <= 0)
        allowed, error = controller.validate_action(
            "param_action", {"value": 0}, agent, {}, action, scene
        )
        assert not allowed
        assert "Invalid parameters" in error

        # Valid param (value > 0)
        allowed, error = controller.validate_action(
            "param_action", {"value": 5}, agent, {}, action, scene
        )
        assert allowed

    def test_unconstrained_action_always_allowed(self):
        """Actions without constraints pass validation."""
        controller = ActionController()
        action = UnconstrainedAction()
        agent = Agent("Agent 1", "profile", "style", [], {})
        scene = MockSceneWithFacilitator()

        allowed, error = controller.validate_action(
            "unconstrained_action", {}, agent, {}, action, scene
        )
        assert allowed
        assert error is None

    def test_backward_compatible_role_validation(self):
        """Role-based validation still works for actions with ALLOWED_ROLES."""
        controller = ActionController()
        action = HostOnlyAction()
        scene = MockSceneWithFacilitator()

        # Create agents with role property
        host = Agent("Host", "profile", "style", [], {}, role="host")
        member = Agent("Agent 1", "profile", "style", [], {}, role="member")

        # Host allowed
        allowed, error = controller.validate_action(
            "host_only_action", {}, host, {}, action, scene
        )
        assert allowed

        # Member rejected
        allowed, error = controller.validate_action(
            "host_only_action", {}, member, {}, action, scene
        )
        assert not allowed
        assert "Permission denied" in error


# Council action imports for integration testing
from socialsim4.core.actions.council_actions import (
    StartVotingAction,
    VoteAction,
    FinishMeetingAction,
    RequestBriefAction,
)


class TestCouncilActionValidation:
    """Integration tests for council actions with phase-based validation."""

    def test_start_voting_any_agent_can_start(self):
        """StartVotingAction can be initiated by any agent when in discussion phase."""
        controller = ActionController()
        action = StartVotingAction()
        scene = MockSceneWithFacilitator()

        agent = Agent("Rep. Chen", "profile", "style", [], {})

        # Any agent should be able to start voting
        allowed, error = controller.validate_action(
            "start_voting", {"title": "Budget 2024"}, agent, scene.state, action, scene
        )
        assert allowed

    def test_start_voting_blocked_when_voting_active(self):
        """StartVotingAction blocked when voting already started."""
        controller = ActionController()
        action = StartVotingAction()
        scene = MockSceneWithFacilitator()
        scene.state["voting_started"] = True

        agent = Agent("Rep. Chen", "profile", "style", [], {})

        allowed, error = controller.validate_action(
            "start_voting", {"title": "Budget"}, agent, scene.state, action, scene
        )
        assert not allowed
        assert "already in progress" in error.lower()

    def test_start_voting_requires_title(self):
        """StartVotingAction requires non-empty title."""
        controller = ActionController()
        action = StartVotingAction()
        scene = MockSceneWithFacilitator()

        agent = Agent("Rep. Chen", "profile", "style", [], {})

        # Empty title rejected
        allowed, error = controller.validate_action(
            "start_voting", {"title": "   "}, agent, scene.state, action, scene
        )
        assert not allowed
        assert "Invalid parameters" in error

    def test_vote_requires_voting_started(self):
        """VoteAction requires voting state."""
        controller = ActionController()
        action = VoteAction()
        scene = MockSceneWithFacilitator()

        agent = Agent("Rep. Chen", "profile", "style", [], {})

        allowed, error = controller.validate_action(
            "vote", {"vote": "yes"}, agent, scene.state, action, scene
        )
        assert not allowed
        assert "not started" in error.lower()

    def test_vote_valid_values(self):
        """VoteAction accepts yes/no/abstain."""
        controller = ActionController()
        action = VoteAction()
        scene = MockSceneWithFacilitator()
        scene.state["voting_started"] = True

        agent = Agent("Rep. Chen", "profile", "style", [], {})

        for vote in ["yes", "no", "abstain"]:
            allowed, error = controller.validate_action(
                "vote", {"vote": vote}, agent, scene.state, action, scene
            )
            assert allowed, f"Vote '{vote}' should be allowed"

    def test_vote_rejects_invalid_values(self):
        """VoteAction rejects invalid vote values."""
        controller = ActionController()
        action = VoteAction()
        scene = MockSceneWithFacilitator()
        scene.state["voting_started"] = True

        agent = Agent("Rep. Chen", "profile", "style", [], {})

        for vote in ["maybe", "I vote yes", "", "present"]:
            allowed, error = controller.validate_action(
                "vote", {"vote": vote}, agent, scene.state, action, scene
            )
            assert not allowed, f"Vote '{vote}' should be rejected"

    def test_vote_any_agent_can_vote(self):
        """VoteAction allows any agent to vote (not just non-Host)."""
        controller = ActionController()
        action = VoteAction()
        scene = MockSceneWithFacilitator()
        scene.state["voting_started"] = True

        # Even an agent named "Host" can vote in the new system
        host = Agent("Host", "profile", "style", [], {})
        member = Agent("Rep. Chen", "profile", "style", [], {})

        # Both should be allowed
        allowed, _ = controller.validate_action(
            "vote", {"vote": "yes"}, host, scene.state, action, scene
        )
        assert allowed, "Host should be allowed to vote"

        allowed, _ = controller.validate_action(
            "vote", {"vote": "yes"}, member, scene.state, action, scene
        )
        assert allowed, "Member should be allowed to vote"

    def test_finish_meeting_any_agent_can_finish(self):
        """FinishMeetingAction can be called by any agent when no vote is active."""
        controller = ActionController()
        action = FinishMeetingAction()
        scene = MockSceneWithFacilitator()

        agent = Agent("Rep. Chen", "profile", "style", [], {})

        # Any agent should be able to finish meeting
        allowed, error = controller.validate_action(
            "finish_meeting", {}, agent, scene.state, action, scene
        )
        assert allowed

    def test_finish_meeting_blocked_during_vote(self):
        """FinishMeetingAction blocked while voting active."""
        controller = ActionController()
        action = FinishMeetingAction()
        scene = MockSceneWithFacilitator()
        scene.state["voting_started"] = True

        agent = Agent("Rep. Chen", "profile", "style", [], {})

        allowed, error = controller.validate_action(
            "finish_meeting", {}, agent, scene.state, action, scene
        )
        assert not allowed
        assert "voting is still in progress" in error.lower()

    def test_request_brief_any_agent_can_request(self):
        """RequestBriefAction can be requested by any agent."""
        controller = ActionController()
        action = RequestBriefAction()
        scene = MockSceneWithFacilitator()

        agent = Agent("Rep. Chen", "profile", "style", [], {})

        # Any agent should be able to request brief
        allowed, error = controller.validate_action(
            "request_brief", {"desc": "Climate policy"}, agent, scene.state, action, scene
        )
        assert allowed


class TestPhaseController:
    """Test the SystemFacilitator phase management."""

    def test_phase_transitions(self):
        """Test phase transitions work correctly."""
        from socialsim4.core.phase_controller import SystemFacilitator, CouncilPhase

        scene = MockSceneWithFacilitator()
        facilitator = scene.facilitator

        # Start in discussion phase
        assert facilitator.get_phase() == CouncilPhase.DISCUSSION

        # Transition to voting
        facilitator.transition_to_voting("Test Proposal")
        assert facilitator.get_phase() == CouncilPhase.VOTING
        assert scene.state["voting_started"] == True

    def test_action_allowed_by_phase(self):
        """Test is_action_allowed respects phases."""
        from socialsim4.core.phase_controller import SystemFacilitator, CouncilPhase

        scene = MockSceneWithFacilitator()
        facilitator = scene.facilitator

        # In discussion phase, voting is not allowed
        allowed, error = facilitator.is_action_allowed("vote")
        assert not allowed
        assert "not started" in error.lower()

        # start_voting is allowed
        allowed, _ = facilitator.is_action_allowed("start_voting")
        assert allowed

        # Transition to voting
        facilitator.transition_to_voting("Test")

        # Now vote is allowed
        allowed, _ = facilitator.is_action_allowed("vote")
        assert allowed

        # start_voting is not allowed (already voting)
        allowed, _ = facilitator.is_action_allowed("start_voting")
        assert not allowed
