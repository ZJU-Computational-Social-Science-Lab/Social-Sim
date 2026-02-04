"""
Unit tests for ActionController with declarative action constraints.
"""

import pytest
from socialsim4.core.action_controller import ActionController, ActionConstraints
from socialsim4.core.action import Action
from socialsim4.core.agent import Agent


# Example actions with constraints for testing
class HostOnlyAction(Action, ActionConstraints):
    NAME = "host_only_action"
    ALLOWED_ROLES = {"Host"}

    def handle(self, action_data, agent, simulator, scene):
        return True, {}, "done", {}, False


class MemberOnlyAction(Action, ActionConstraints):
    NAME = "member_only_action"
    ALLOWED_ROLES = {"*"}  # Non-Host only

    @staticmethod
    def state_guard(state):
        return state.get("active", False)

    STATE_GUARD = state_guard
    STATE_ERROR = "Cannot act: session not active"

    def handle(self, action_data, agent, simulator, scene):
        return True, {}, "done", {}, False


class ParameterValidatedAction(Action, ActionConstraints):
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
    """Test suite for ActionController with declarative constraints."""

    def test_host_only_action_rejects_non_host(self):
        """Actions with ALLOWED_ROLES={'Host'} reject non-Host agents."""
        controller = ActionController()
        action = HostOnlyAction()
        host = Agent("Host", "profile", "style", [], {})
        agent = Agent("Agent 1", "profile", "style", [], {})

        # Host allowed
        allowed, error = controller.validate_action(
            "host_only_action", {}, host, {}, action
        )
        assert allowed
        assert error is None

        # Non-host rejected
        allowed, error = controller.validate_action(
            "host_only_action", {}, agent, {}, action
        )
        assert not allowed
        assert "Permission denied" in error

    def test_member_only_action_excludes_host(self):
        """Actions with ALLOWED_ROLES={'*'} allow non-Host, reject Host."""
        controller = ActionController()
        action = MemberOnlyAction()
        host = Agent("Host", "profile", "style", [], {})
        agent = Agent("Agent 1", "profile", "style", [], {})

        # Host rejected
        allowed, error = controller.validate_action(
            "member_only_action", {}, host, {"active": True}, action
        )
        assert not allowed
        assert "Host cannot perform" in error

        # Member allowed
        allowed, error = controller.validate_action(
            "member_only_action", {}, agent, {"active": True}, action
        )
        assert allowed

    def test_state_guard_blocks_invalid_state(self):
        """State guard function blocks actions in wrong state."""
        controller = ActionController()
        action = MemberOnlyAction()
        agent = Agent("Agent 1", "profile", "style", [], {})

        # Inactive state blocked
        allowed, error = controller.validate_action(
            "member_only_action", {}, agent, {"active": False}, action
        )
        assert not allowed
        assert "session not active" in error

        # Active state allowed
        allowed, error = controller.validate_action(
            "member_only_action", {}, agent, {"active": True}, action
        )
        assert allowed

    def test_parameter_validator_blocks_invalid_params(self):
        """Parameter validator rejects invalid parameters."""
        controller = ActionController()
        action = ParameterValidatedAction()
        agent = Agent("Agent 1", "profile", "style", [], {})

        # Invalid param (value <= 0)
        allowed, error = controller.validate_action(
            "param_action", {"value": 0}, agent, {}, action
        )
        assert not allowed
        assert "Invalid parameters" in error

        # Valid param (value > 0)
        allowed, error = controller.validate_action(
            "param_action", {"value": 5}, agent, {}, action
        )
        assert allowed

    def test_unconstrained_action_always_allowed(self):
        """Actions without constraints pass validation."""
        controller = ActionController()
        action = UnconstrainedAction()
        agent = Agent("Agent 1", "profile", "style", [], {})

        allowed, error = controller.validate_action(
            "unconstrained_action", {}, agent, {}, action
        )
        assert allowed
        assert error is None


# Council action imports for integration testing
from socialsim4.core.actions.council_actions import (
    StartVotingAction,
    VoteAction,
    FinishMeetingAction,
    RequestBriefAction,
)


class TestCouncilActionValidation:
    """Integration tests for council actions with declarative constraints."""

    def test_start_voting_host_only(self):
        """StartVotingAction only allows Host agent."""
        controller = ActionController()
        action = StartVotingAction()
        host = Agent("Host", "profile", "style", [], {})
        agent = Agent("Rep. Chen", "profile", "style", [], {})

        # Host allowed with valid title
        allowed, error = controller.validate_action(
            "start_voting", {"title": "Budget 2024"}, host, {}, action
        )
        assert allowed

        # Non-host rejected
        allowed, error = controller.validate_action(
            "start_voting", {"title": "Budget 2024"}, agent, {}, action
        )
        assert not allowed
        assert "Permission denied" in error

    def test_start_voting_cannot_start_twice(self):
        """StartVotingAction blocked when voting already started."""
        controller = ActionController()
        action = StartVotingAction()
        host = Agent("Host", "profile", "style", [], {})

        allowed, error = controller.validate_action(
            "start_voting", {"title": "Budget"}, host, {"voting_started": True}, action
        )
        assert not allowed
        assert "already in progress" in error.lower()

    def test_start_voting_requires_title(self):
        """StartVotingAction requires non-empty title."""
        controller = ActionController()
        action = StartVotingAction()
        host = Agent("Host", "profile", "style", [], {})

        # Empty title rejected
        allowed, error = controller.validate_action(
            "start_voting", {"title": "   "}, host, {}, action
        )
        assert not allowed
        assert "Invalid parameters" in error

    def test_vote_requires_voting_started(self):
        """VoteAction requires voting state."""
        controller = ActionController()
        action = VoteAction()
        agent = Agent("Rep. Chen", "profile", "style", [], {})

        allowed, error = controller.validate_action(
            "vote", {"vote": "yes"}, agent, {}, action
        )
        assert not allowed
        assert "not started" in error.lower()

    def test_vote_valid_values(self):
        """VoteAction accepts yes/no/abstain."""
        controller = ActionController()
        action = VoteAction()
        agent = Agent("Rep. Chen", "profile", "style", [], {})
        state = {"voting_started": True}

        for vote in ["yes", "no", "abstain"]:
            allowed, error = controller.validate_action(
                "vote", {"vote": vote}, agent, state, action
            )
            assert allowed, f"Vote '{vote}' should be allowed"

    def test_vote_rejects_invalid_values(self):
        """VoteAction rejects invalid vote values."""
        controller = ActionController()
        action = VoteAction()
        agent = Agent("Rep. Chen", "profile", "style", [], {})
        state = {"voting_started": True}

        for vote in ["maybe", "I vote yes", "", "present"]:
            allowed, error = controller.validate_action(
                "vote", {"vote": vote}, agent, state, action
            )
            assert not allowed, f"Vote '{vote}' should be rejected"

    def test_vote_excludes_host(self):
        """VoteAction excludes Host with '*' role restriction."""
        controller = ActionController()
        action = VoteAction()
        host = Agent("Host", "profile", "style", [], {})
        agent = Agent("Rep. Chen", "profile", "style", [], {})
        state = {"voting_started": True}

        # Host rejected
        allowed, error = controller.validate_action(
            "vote", {"vote": "yes"}, host, state, action
        )
        assert not allowed
        assert "Host cannot perform" in error

        # Member allowed
        allowed, error = controller.validate_action(
            "vote", {"vote": "yes"}, agent, state, action
        )
        assert allowed

    def test_finish_meeting_host_only(self):
        """FinishMeetingAction only allows Host."""
        controller = ActionController()
        action = FinishMeetingAction()
        host = Agent("Host", "profile", "style", [], {})
        agent = Agent("Rep. Chen", "profile", "style", [], {})

        # Host allowed
        allowed, error = controller.validate_action(
            "finish_meeting", {}, host, {}, action
        )
        assert allowed

        # Non-host rejected
        allowed, error = controller.validate_action(
            "finish_meeting", {}, agent, {}, action
        )
        assert not allowed
        assert "Permission denied" in error

    def test_finish_meeting_blocked_during_vote(self):
        """FinishMeetingAction blocked while voting active."""
        controller = ActionController()
        action = FinishMeetingAction()
        host = Agent("Host", "profile", "style", [], {})

        allowed, error = controller.validate_action(
            "finish_meeting", {}, host, {"voting_started": True}, action
        )
        assert not allowed
        assert "voting is still in progress" in error.lower()

    def test_request_brief_host_only(self):
        """RequestBriefAction only allows Host."""
        controller = ActionController()
        action = RequestBriefAction()
        host = Agent("Host", "profile", "style", [], {})
        agent = Agent("Rep. Chen", "profile", "style", [], {})

        # Host allowed
        allowed, error = controller.validate_action(
            "request_brief", {"desc": "Climate policy"}, host, {}, action
        )
        assert allowed

        # Non-host rejected
        allowed, error = controller.validate_action(
            "request_brief", {"desc": "Climate policy"}, agent, {}, action
        )
        assert not allowed
        assert "Permission denied" in error
