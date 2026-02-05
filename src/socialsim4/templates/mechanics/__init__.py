"""Core mechanics module for the generic template system.

This module provides modular mechanics that can be composed to build
template scenes. Each mechanic handles agent initialization, provides
actions, and contributes to scene state.
"""

from __future__ import annotations

from typing import Any

from socialsim4.templates.mechanics.base import CoreMechanic


# Mechanic registry: maps mechanic type to class
MECHANIC_REGISTRY: dict[str, type[CoreMechanic]] = {}


def register_mechanic(cls: type[CoreMechanic]) -> type[CoreMechanic]:
    """Decorator to register a mechanic class in the registry."""
    MECHANIC_REGISTRY[cls.TYPE] = cls
    return cls


def create_mechanic(type_: str, config: dict[str, Any]) -> CoreMechanic:
    """Factory function to create a mechanic from type and config.

    Args:
        type_: The mechanic type (e.g., "grid", "voting", "resources").
        config: Mechanic-specific configuration options.

    Returns:
        A new instance of the requested mechanic.

    Raises:
        ValueError: If the mechanic type is not registered.
    """
    mechanic_class = MECHANIC_REGISTRY.get(type_)
    if mechanic_class is None:
        raise ValueError(
            f"Unknown mechanic type: '{type_}'. "
            f"Available types: {list(MECHANIC_REGISTRY.keys())}"
        )
    return mechanic_class.from_config(config)


def get_registered_mechanics() -> list[str]:
    """Return list of all registered mechanic types."""
    return list(MECHANIC_REGISTRY.keys())


# Import all mechanics to register them (each uses @register_mechanic decorator)
from socialsim4.templates.mechanics.discussion_mechanic import DiscussionMechanic
from socialsim4.templates.mechanics.grid_mechanic import GridMechanic
from socialsim4.templates.mechanics.hierarchy_mechanic import HierarchyMechanic
from socialsim4.templates.mechanics.resource_mechanic import ResourceMechanic
from socialsim4.templates.mechanics.voting_mechanic import VotingMechanic

__all__ = [
    "CoreMechanic",
    "MECHANIC_REGISTRY",
    "register_mechanic",
    "create_mechanic",
    "get_registered_mechanics",
    "GridMechanic",
    "VotingMechanic",
    "ResourceMechanic",
    "HierarchyMechanic",
    "DiscussionMechanic",
]
