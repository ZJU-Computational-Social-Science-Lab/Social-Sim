"""
Action validation with declarative metadata.

Each action can declare state guards and parameter validators.
When a scene has a facilitator, it handles phase-based validation.
Otherwise, falls back to role-based validation for backward compatibility.
"""

import os
from typing import Tuple, Optional, Dict, Any, Callable, Set
from socialsim4.core.agent import Agent

# Debug flag for action validation logging
DEBUG_ACTION_VALIDATION = os.getenv("DEBUG_ACTION_VALIDATION", "false").lower() == "true"


class ActionConstraints:
    """
    Mixin/base for actions to declare their validation constraints.
    Actions can inherit from this to declare requirements declaratively.
    """

    # Override in subclasses: set of roles allowed (empty = any agent)
    # Deprecated: Prefer phase-based validation via facilitator
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
    Delegates to scene facilitator for phase-based validation when available.
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
        action_instance: Any = None,
        scene: Any = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate an action before execution.

        Args:
            action_name: Name of the action being validated
            action_data: Action parameters
            agent: Agent attempting the action
            scene_state: Current scene state
            action_instance: Action instance with constraints
            scene: Scene reference (for facilitator access)

        Returns:
            (allowed, error): Tuple of permission status and error message if not allowed
        """
        if DEBUG_ACTION_VALIDATION:
            agent_info = agent.name
            if hasattr(agent, 'properties') and agent.properties.get('role'):
                agent_info += f" (role: {agent.properties.get('role')})"
            print(f"\n[ACTION-VALIDATION] Agent '{agent_info}' attempting action: '{action_name}'")

        # Try facilitator-based validation first (if scene has one)
        if scene and hasattr(scene, 'facilitator') and scene.facilitator:
            allowed, error = scene.facilitator.is_action_allowed(action_name)
            if not allowed:
                if DEBUG_ACTION_VALIDATION:
                    print(f"[ACTION-VALIDATION]   Result: [BLOCKED] (facilitator)")
                    print(f"[ACTION-VALIDATION]   Reason: {error}")
                return False, error

        # Try to get constraints from the action instance
        if action_instance:
            result = self._validate_with_constraints(
                action_instance, action_data, agent, scene_state
            )
            if DEBUG_ACTION_VALIDATION:
                allowed, error = result
                status = "[ALLOWED]" if allowed else "[BLOCKED]"
                constraints_info = []
                if hasattr(action_instance, 'ALLOWED_ROLES') and action_instance.ALLOWED_ROLES:
                    constraints_info.append(f"roles={action_instance.ALLOWED_ROLES}")
                if hasattr(action_instance, 'STATE_GUARD') and action_instance.STATE_GUARD:
                    constraints_info.append("state_guard=True")
                if hasattr(action_instance, 'PARAMETER_VALIDATOR') and action_instance.PARAMETER_VALIDATOR:
                    constraints_info.append("param_validator=True")
                if constraints_info:
                    print(f"[ACTION-VALIDATION]   Constraints: {', '.join(constraints_info)}")
                print(f"[ACTION-VALIDATION]   Result: {status}")
                if error:
                    print(f"[ACTION-VALIDATION]   Reason: {error}")
            return result

        # Fall back to explicit rules (for backward compatibility)
        if action_name in self._explicit_rules:
            result = self._validate_with_explicit_rules(
                action_name, action_data, agent, scene_state
            )
            if DEBUG_ACTION_VALIDATION:
                allowed, error = result
                status = "[ALLOWED]" if allowed else "[BLOCKED]"
                print(f"[ACTION-VALIDATION]   Result: {status} (explicit rules)")
                if error:
                    print(f"[ACTION-VALIDATION]   Reason: {error}")
            return result

        # No constraints defined - allow the action
        if DEBUG_ACTION_VALIDATION:
            print(f"[ACTION-VALIDATION]   Result: [ALLOWED] (no constraints)")
        return True, None

    def _validate_with_constraints(
        self, action: Any, action_data: Dict[str, Any],
        agent: Agent, scene_state: Dict[str, Any]
    ) -> Tuple[bool, Optional[str]]:
        """Validate using constraints declared on the Action class."""
        # Skip role-based validation if action has no ALLOWED_ROLES set
        # (This means any agent can use it in the appropriate phase)
        if hasattr(action, 'ALLOWED_ROLES') and action.ALLOWED_ROLES:
            if not self._check_role(agent, action.ALLOWED_ROLES):
                return False, self._role_error(agent, action.ALLOWED_ROLES)

        # Check state guard
        if hasattr(action, 'STATE_GUARD') and action.STATE_GUARD:
            if not action.STATE_GUARD(scene_state):
                error = getattr(action, 'STATE_ERROR', 'Invalid state for this action')
                return False, error

        # Check parameter validation
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
        """Check if agent's role allows this action.

        Uses agent.properties.get("role") if available, otherwise falls back to agent.name.
        """
        # Get the agent's role - either from properties or use name as fallback
        agent_role = agent.properties.get("role", agent.name) if hasattr(agent, 'properties') else agent.name

        if "*" in allowed_roles:
            return agent_role.lower() != "host"  # '*' means non-host only (case-insensitive)
        if not allowed_roles:
            return True  # Empty set = anyone allowed
        # Case-insensitive role check for flexibility
        agent_role_lower = agent_role.lower()
        allowed_roles_lower = {r.lower() for r in allowed_roles}
        return agent_role_lower in allowed_roles_lower

    def _role_error(self, agent: Agent, allowed_roles: Set[str]) -> str:
        """Generate role error message."""
        agent_role = agent.properties.get("role", agent.name) if hasattr(agent, 'properties') else agent.name

        if "*" in allowed_roles:
            return f"Permission denied: Host cannot perform this action"
        roles_str = ", ".join(allowed_roles)
        return f"Permission denied: Agent '{agent.name}' (role: '{agent_role}') is not allowed (requires: {roles_str})"
