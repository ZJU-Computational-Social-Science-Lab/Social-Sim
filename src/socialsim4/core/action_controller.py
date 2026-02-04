"""
Action validation with declarative metadata.

Each action declares its role requirements, state guards, and parameter validators.
The ActionController simply checks what each action declares.
"""

from typing import Tuple, Optional, Dict, Any, Callable, Set
from socialsim4.core.agent import Agent


class ActionConstraints:
    """
    Mixin/base for actions to declare their validation constraints.
    Actions can inherit from this to declare requirements declaratively.
    """

    # Override in subclasses: set of roles allowed (empty = any agent)
    ALLOWED_ROLES: Set[str] = set()

    # Override in subclasses: state guard function
    STATE_GUARD: Optional[Callable[[Dict[str, Any]], bool]] = None

    # Override in subclasses: parameter validator function
    PARAMETER_VALIDATOR: Optional[Callable[[Dict[str, Any]], bool]] = None

    # Override in subclasses: error message for state violations
    STATE_ERROR: Optional[str] = None


class ActionController:
    """
    Validates agent actions before execution.

    Reads constraints from Action classes (via ActionConstraints).
    No need to update this controller when adding new actions!
    """

    def __init__(self):
        # Optional: explicit overrides for actions without constraints
        self._explicit_rules: Dict[str, dict] = {}

    def validate_action(
        self,
        action_name: str,
        action_data: Dict[str, Any],
        agent: Agent,
        scene_state: Dict[str, Any],
        action_instance: Any = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate an action before execution.

        If action_instance is provided, reads constraints from it.
        Otherwise falls back to explicit rules.
        """
        # Try to get constraints from the action instance
        if action_instance and hasattr(action_instance, 'ALLOWED_ROLES'):
            return self._validate_with_constraints(
                action_instance, action_data, agent, scene_state
            )

        # Fall back to explicit rules (for backward compatibility)
        if action_name in self._explicit_rules:
            return self._validate_with_explicit_rules(
                action_name, action_data, agent, scene_state
            )

        # No constraints defined - allow the action
        return True, None

    def _validate_with_constraints(
        self, action: Any, action_data: Dict[str, Any],
        agent: Agent, scene_state: Dict[str, Any]
    ) -> Tuple[bool, Optional[str]]:
        """Validate using constraints declared on the Action class."""
        # Check 1: Role permission
        if hasattr(action, 'ALLOWED_ROLES') and action.ALLOWED_ROLES:
            if not self._check_role(agent, action.ALLOWED_ROLES):
                return False, self._role_error(agent, action.ALLOWED_ROLES)

        # Check 2: State guard
        if hasattr(action, 'STATE_GUARD') and action.STATE_GUARD:
            if not action.STATE_GUARD(scene_state):
                error = getattr(action, 'STATE_ERROR', 'Invalid state for this action')
                return False, error

        # Check 3: Parameter validation
        if hasattr(action, 'PARAMETER_VALIDATOR') and action.PARAMETER_VALIDATOR:
            if not action.PARAMETER_VALIDATOR(action_data):
                return False, f"Invalid parameters for '{action.NAME}'"

        return True, None

    def _validate_with_explicit_rules(
        self, action_name: str, action_data: Dict[str, Any],
        agent: Agent, scene_state: Dict[str, Any]
    ) -> Tuple[bool, Optional[str]]:
        """Validate using explicit rules (backward compatibility)."""
        rules = self._explicit_rules[action_name]

        if 'roles' in rules:
            if not self._check_role(agent, rules['roles']):
                return False, self._role_error(agent, rules['roles'])

        if 'state_guard' in rules:
            if not rules['state_guard'](scene_state):
                return False, rules.get('state_error', 'Invalid state')

        if 'param_validator' in rules:
            if not rules['param_validator'](action_data):
                return False, f"Invalid parameters for '{action_name}'"

        return True, None

    def _check_role(self, agent: Agent, allowed_roles: Set[str]) -> bool:
        """Check if agent's role allows this action."""
        if "*" in allowed_roles:
            return agent.name != "Host"  # '*' means non-Host only
        if not allowed_roles:
            return True  # Empty set = anyone allowed
        return agent.name in allowed_roles

    def _role_error(self, agent: Agent, allowed_roles: Set[str]) -> str:
        """Generate role error message."""
        if "*" in allowed_roles:
            return f"Permission denied: Host cannot perform this action"
        roles_str = ", ".join(allowed_roles)
        return f"Permission denied: Agent '{agent.name}' is not allowed (requires: {roles_str})"
