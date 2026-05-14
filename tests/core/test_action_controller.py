"""
Tests for ActionController — validation paths not covered by existing tests.

Focuses on: explicit rules fallback, wildcard roles, case-insensitive matching,
no-scene path, agent without properties, and debug logging branch.
"""

import os
import pytest
from unittest.mock import MagicMock

from socialsim4.core.action_controller import ActionController, ActionConstraints
from socialsim4.core.action import Action
from socialsim4.core.agent import Agent


# --- Fixtures ---------------------------------------------------------------

@pytest.fixture
def controller():
    return ActionController()


@pytest.fixture
def agent():
    return Agent("Alice", "profile", "style", [], {})


@pytest.fixture
def host_agent():
    return Agent("HostBot", "profile", "style", [], {}, role="host")


# --- Helper: bare action with optional constraints --------------------------

def _make_action(allowed_roles=None, state_guard=None, param_validator=None,
                 state_error=None):
    """Create an action class with specific constraints."""
    attrs = {"NAME": "test_action"}
    if allowed_roles is not None:
        attrs["ALLOWED_ROLES"] = allowed_roles
    if state_guard is not None:
        attrs["STATE_GUARD"] = staticmethod(state_guard)
    if param_validator is not None:
        attrs["PARAMETER_VALIDATOR"] = staticmethod(param_validator)
    if state_error is not None:
        attrs["STATE_ERROR"] = state_error

    cls = type("TestAction", (Action, ActionConstraints), attrs)
    return cls()


# --- Tests: Explicit rules fallback path ------------------------------------

class TestExplicitRules:
    """_validate_with_explicit_rules branch (no action_instance)."""

    def test_explicit_role_blocks_wrong_role(self, controller, agent):
        controller._explicit_rules["grab"] = {
            "roles": {"thief"},
        }
        allowed, error = controller.validate_action("grab", {}, agent, {})
        assert not allowed
        assert "Permission denied" in error

    def test_explicit_role_allows_correct_role(self, controller):
        thief = Agent("Rogue", "profile", "style", [], {}, role="thief")
        controller._explicit_rules["grab"] = {"roles": {"thief"}}
        allowed, _ = controller.validate_action("grab", {}, thief, {})
        assert allowed

    def test_explicit_state_guard_rejects(self, controller, agent):
        controller._explicit_rules["open"] = {
            "state_guard": lambda s: s.get("door_open") is True,
            "state_error": "Door is locked",
        }
        allowed, error = controller.validate_action(
            "open", {}, agent, {"door_open": False}
        )
        assert not allowed
        assert "Door is locked" in error

    def test_explicit_param_validator_rejects(self, controller, agent):
        controller._explicit_rules["throw"] = {
            "param_validator": lambda d: d.get("force", 0) >= 10,
        }
        allowed, error = controller.validate_action(
            "throw", {"force": 3}, agent, {}
        )
        assert not allowed
        assert "Invalid parameters" in error

    def test_explicit_rules_all_pass(self, controller, agent):
        controller._explicit_rules["throw"] = {
            "roles": set(),
            "param_validator": lambda d: d.get("force", 0) >= 5,
        }
        allowed, _ = controller.validate_action(
            "throw", {"force": 10}, agent, {}
        )
        assert allowed


# --- Tests: Wildcard and case-insensitive roles -----------------------------

class TestRoleMatching:
    """Covers _check_role and _role_error branches."""

    def test_wildcard_allows_non_host(self, controller, agent):
        action = _make_action(allowed_roles={"*"})
        allowed, _ = controller.validate_action(
            "test_action", {}, agent, {}, action
        )
        assert allowed

    def test_wildcard_blocks_host_role(self, controller, host_agent):
        action = _make_action(allowed_roles={"*"})
        allowed, error = controller.validate_action(
            "test_action", {}, host_agent, {}, action
        )
        assert not allowed
        assert "Host cannot" in error

    def test_wildcard_blocks_uppercase_host(self, controller):
        """Case-insensitive host check: 'HOST' also blocked."""
        host = Agent("BigHost", "profile", "style", [], {}, role="HOST")
        action = _make_action(allowed_roles={"*"})
        allowed, _ = controller.validate_action(
            "test_action", {}, host, {}, action
        )
        assert not allowed

    def test_case_insensitive_role_match(self, controller):
        """Role matching ignores case."""
        admin = Agent("Admin", "profile", "style", [], {}, role="ADMIN")
        action = _make_action(allowed_roles={"admin"})
        allowed, _ = controller.validate_action(
            "test_action", {}, admin, {}, action
        )
        assert allowed

    def test_empty_allowed_roles_allows_anyone(self, controller, agent):
        action = _make_action(allowed_roles=set())
        allowed, _ = controller.validate_action(
            "test_action", {}, agent, {}, action
        )
        assert allowed


# --- Tests: No-constraints and no-scene paths --------------------------------

class TestFallbackPaths:

    def test_no_action_instance_no_rules_allows(self, controller, agent):
        """Unknown action with no instance or rules: allowed."""
        allowed, error = controller.validate_action(
            "unknown", {}, agent, {}
        )
        assert allowed
        assert error is None

    def test_scene_without_facilitator_skips_facilitator_check(
        self, controller, agent
    ):
        """Scene object without facilitator attribute skips that branch."""
        scene = MagicMock()
        del scene.facilitator
        action = _make_action()
        allowed, _ = controller.validate_action(
            "test_action", {}, agent, {}, action, scene
        )
        assert allowed

    def test_facilitator_allows_passes_to_constraints(self, controller, agent):
        """If facilitator allows, constraints still checked."""
        scene = MagicMock()
        scene.facilitator.is_action_allowed.return_value = (True, None)
        action = _make_action(
            allowed_roles={"admin"},
        )
        admin = Agent("Admin", "profile", "style", [], {}, role="admin")
        allowed, _ = controller.validate_action(
            "test_action", {}, admin, {}, action, scene
        )
        assert allowed

    def test_agent_without_properties_uses_name_as_role(self, controller):
        """Agent lacking .properties falls back to agent.name."""
        bare_agent = MagicMock()
        bare_agent.name = "Bob"
        # No .properties attribute at all
        del bare_agent.properties
        action = _make_action(allowed_roles={"Bob"})
        allowed, _ = controller.validate_action(
            "test_action", {}, bare_agent, {}, action
        )
        assert allowed


# --- Tests: State guard with custom error -----------------------------------

class TestStateGuard:

    def test_state_guard_uses_custom_error(self, controller, agent):
        action = _make_action(
            state_guard=lambda s: s.get("powered"),
            state_error="System is offline",
        )
        allowed, error = controller.validate_action(
            "test_action", {}, agent, {"powered": False}, action
        )
        assert not allowed
        assert "offline" in error

    def test_state_guard_passes_when_true(self, controller, agent):
        action = _make_action(
            state_guard=lambda s: s.get("powered"),
            state_error="System is offline",
        )
        allowed, _ = controller.validate_action(
            "test_action", {}, agent, {"powered": True}, action
        )
        assert allowed


# --- Tests: Parameter validator ---------------------------------------------

class TestParameterValidator:

    def test_param_validator_rejects_includes_action_name(self, controller, agent):
        action = _make_action(
            param_validator=lambda d: "target" in d,
        )
        allowed, error = controller.validate_action(
            "test_action", {}, agent, {}, action
        )
        assert not allowed
        assert "test_action" in error

    def test_param_validator_passes(self, controller, agent):
        action = _make_action(
            param_validator=lambda d: "target" in d,
        )
        allowed, _ = controller.validate_action(
            "test_action", {"target": "enemy"}, agent, {}, action
        )
        assert allowed


# --- Tests: Debug logging branch --------------------------------------------

class TestDebugLogging:

    def test_debug_branch_executes_without_error(self, controller, agent, monkeypatch):
        """When DEBUG_ACTION_VALIDATION is true, no crash from print paths."""
        import socialsim4.core.action_controller as mod
        monkeypatch.setattr(mod, "DEBUG_ACTION_VALIDATION", True)

        action = _make_action(allowed_roles={"admin"})
        admin = Agent("Admin", "profile", "style", [], {}, role="admin")
        # Should not raise
        allowed, _ = controller.validate_action(
            "test_action", {}, admin, {}, action
        )
        assert allowed

    def test_debug_blocked_path_logs_reason(self, controller, agent, monkeypatch):
        import socialsim4.core.action_controller as mod
        monkeypatch.setattr(mod, "DEBUG_ACTION_VALIDATION", True)

        action = _make_action(
            state_guard=lambda s: False,
            state_error="bad state",
        )
        # Blocked path should also not crash
        controller.validate_action("test_action", {}, agent, {}, action)

    def test_debug_explicit_rules_path(self, controller, agent, monkeypatch):
        import socialsim4.core.action_controller as mod
        monkeypatch.setattr(mod, "DEBUG_ACTION_VALIDATION", True)

        controller._explicit_rules["x"] = {"roles": set()}
        controller.validate_action("x", {}, agent, {})
