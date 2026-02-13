"""
Action registry for agent tool/action space mapping.

Maps action names to their implementations for agent deserialization.

This module re-exports the main ACTION_SPACE_MAP from core.registry
for backwards compatibility.
"""

# Import the main action registry from core.registry
from socialsim4.core.registry import ACTION_SPACE_MAP

# Define register_action function for backwards compatibility
def register_action(name: str, action_class):
    """
    Register an action class in the registry.

    Note: This modifies the global ACTION_SPACE_MAP in-place.
    For thread safety, actions should be registered at module import time.

    Args:
        name: Action name identifier
        action_class: Action class to register
    """
    ACTION_SPACE_MAP[name] = action_class

__all__ = ["ACTION_SPACE_MAP", "register_action"]
