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
