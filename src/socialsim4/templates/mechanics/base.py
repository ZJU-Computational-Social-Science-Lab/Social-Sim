"""Base class for core mechanics in the generic template system.

Core mechanics are modular components that provide:
1. Agent initialization (setting initial properties)
2. Actions that the mechanic enables
3. Scene state contributions
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from socialsim4.core.agent import Agent
    from socialsim4.core.scene import Scene


class CoreMechanic(ABC):
    """Base class for core mechanics.

    A core mechanic defines a fundamental interaction pattern in a simulation.
    Each mechanic type implements the methods below to provide agent properties,
    available actions, and scene state contributions.

    Attributes:
        TYPE: Unique string identifier for this mechanic type (used in registry).
    """

    TYPE: str = "base"

    @classmethod
    @abstractmethod
    def from_config(cls, config: dict[str, Any]) -> "CoreMechanic":
        """Create mechanic from config dict.

        Args:
            config: Mechanic-specific configuration options.

        Returns:
            A new instance of this mechanic.
        """
        pass

    @abstractmethod
    def initialize_agent(self, agent: Agent, scene: Scene) -> None:
        """Initialize agent with mechanic's properties.

        Called when an agent joins a scene using this mechanic.

        Args:
            agent: The agent to initialize.
            scene: The scene the agent is joining.
        """
        pass

    @abstractmethod
    def get_actions(self) -> list:
        """Return list of action classes this mechanic provides.

        Returns:
            A list of action class instances that agents can use.
        """
        pass

    @abstractmethod
    def get_scene_state(self) -> dict[str, Any]:
        """Return mechanic's contribution to scene state.

        Returns:
            A dictionary of state values that should be added to the scene.
        """
        pass
