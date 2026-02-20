"""
Action registry for agent tool/action space mapping.

Maps action names to their implementations for agent deserialization.

This module re-exports the main ACTION_SPACE_MAP from core.registry
for backwards compatibility.

Uses lazy import to avoid circular dependency issues.
"""

# Lazy import to avoid circular dependency
def _get_action_space_map():
    from socialsim4.core.registry import ACTION_SPACE_MAP
    return ACTION_SPACE_MAP


# Create a module-level proxy that lazily loads the map
import sys
from types import ModuleType
from typing import Any

class _ActionSpaceModuleProxy(ModuleType):
    """Module proxy that lazily provides ACTION_SPACE_MAP."""

    def __getattr__(self, name: str) -> Any:
        if name == "ACTION_SPACE_MAP":
            return _get_action_space_map()
        return super().__getattr__(name)

# Replace this module with the proxy
_current_module = sys.modules[__name__]
_proxy = _ActionSpaceModuleProxy(__name__)
_proxy.__dict__.update(_current_module.__dict__)
sys.modules[__name__] = _proxy


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
    action_map = _get_action_space_map()
    action_map[name] = action_class

__all__ = ["ACTION_SPACE_MAP", "register_action"]
