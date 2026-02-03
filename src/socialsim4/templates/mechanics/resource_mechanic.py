"""Resource mechanic for managing collectible resources.

Provides inventory management and resource gathering actions.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from socialsim4.core.actions.village_actions import GatherResourceAction
from socialsim4.templates.mechanics.base import CoreMechanic
from socialsim4.templates.mechanics import register_mechanic

if TYPE_CHECKING:
    from socialsim4.core.agent import Agent
    from socialsim4.core.scene import Scene


@register_mechanic
class ResourceMechanic(CoreMechanic):
    """Resource mechanic for inventory and gathering.

    Agents have an inventory of resources and can gather resources
    from their current location.

    Config:
        resources: List of resource types available (default: ["food", "wood", "water"])
        initial_amount: Starting amount of each resource (default: 0)
        max_stack_size: Maximum amount per resource type (default: 100)
    """

    TYPE = "resources"

    def __init__(
        self,
        resources: list[str] | None = None,
        initial_amount: int = 0,
        max_stack_size: int = 100,
    ):
        self.resources = resources or ["food", "wood", "water"]
        self.initial_amount = initial_amount
        self.max_stack_size = max_stack_size
        self._actions = [
            GatherResourceAction(),
        ]

    @classmethod
    def from_config(cls, config: dict) -> "ResourceMechanic":
        """Create ResourceMechanic from config dict."""
        return cls(
            resources=config.get("resources"),
            initial_amount=config.get("initial_amount", 0),
            max_stack_size=config.get("max_stack_size", 100),
        )

    def initialize_agent(self, agent: Agent, scene: Scene) -> None:
        """Initialize agent with inventory properties."""
        agent.properties.setdefault("inventory", {})

        # Initialize inventory with configured resources
        for resource in self.resources:
            if resource not in agent.properties["inventory"]:
                agent.properties["inventory"][resource] = self.initial_amount

    def get_actions(self) -> list:
        """Return resource action classes."""
        return self._actions

    def get_scene_state(self) -> dict:
        """Return resource mechanic's contribution to scene state."""
        return {
            "available_resources": self.resources,
            "max_stack_size": self.max_stack_size,
        }

    def add_resource(
        self, agent: Agent, resource: str, amount: int
    ) -> tuple[bool, str]:
        """Add resources to agent's inventory.

        Returns:
            (success, message)
        """
        if resource not in self.resources:
            return False, f"Unknown resource type: {resource}"

        current = agent.properties["inventory"].get(resource, 0)
        new_amount = min(self.max_stack_size, current + amount)
        added = new_amount - current

        agent.properties["inventory"][resource] = new_amount

        if added < amount:
            return True, f"Added {added} {resource} (inventory full at {new_amount})."
        return True, f"Added {added} {resource}."

    def remove_resource(
        self, agent: Agent, resource: str, amount: int
    ) -> tuple[bool, str]:
        """Remove resources from agent's inventory.

        Returns:
            (success, message)
        """
        current = agent.properties["inventory"].get(resource, 0)
        if current < amount:
            return False, f"Not enough {resource} (have {current}, need {amount})."

        agent.properties["inventory"][resource] = current - amount
        return True, f"Removed {amount} {resource}."

    def get_resource_count(self, agent: Agent, resource: str) -> int:
        """Get agent's current count of a resource."""
        return agent.properties["inventory"].get(resource, 0)
