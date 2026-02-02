"""Hierarchy mechanic for structured role relationships.

Provides tree or flat organizational structures with command chains.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from socialsim4.templates.mechanics.base import CoreMechanic

if TYPE_CHECKING:
    from socialsim4.core.agent import Agent
    from socialsim4.core.scene import Scene


class HierarchyMechanic(CoreMechanic):
    """Hierarchy mechanic for role-based organization.

    Defines a command structure with levels and roles.
    Supports both tree (hierarchical) and flat (egalitarian) structures.

    Config:
        hierarchy_type: "tree" for hierarchical, "flat" for egalitarian
        levels: Dict mapping role names to their level (higher = more authority)
            e.g., {"leader": 3, "manager": 2, "worker": 1}
        can_command: Whether higher levels can command lower levels (default: True)
    """

    TYPE = "hierarchy"

    def __init__(
        self,
        hierarchy_type: str = "tree",
        levels: dict | None = None,
        can_command: bool = True,
    ):
        if hierarchy_type not in ("tree", "flat"):
            raise ValueError(f"Invalid hierarchy_type: {hierarchy_type}")

        self.hierarchy_type = hierarchy_type
        self.levels = levels or {}
        self.can_command = can_command

    @classmethod
    def from_config(cls, config: dict) -> "HierarchyMechanic":
        """Create HierarchyMechanic from config dict."""
        return cls(
            hierarchy_type=config.get("hierarchy_type", "tree"),
            levels=config.get("levels"),
            can_command=config.get("can_command", True),
        )

    def initialize_agent(self, agent: Agent, scene: Scene) -> None:
        """Initialize agent with hierarchy properties."""
        agent.properties.setdefault("role_level", 1)
        agent.properties.setdefault("can_command", False)

        # Determine authority from role if provided
        role = agent.properties.get("role", "")
        if role and role in self.levels:
            agent.properties["role_level"] = self.levels[role]
            # Top level can command others if enabled
            if self.hierarchy_type == "tree" and self.can_command:
                max_level = max(self.levels.values()) if self.levels else 1
                agent.properties["can_command"] = (
                    agent.properties["role_level"] >= max_level
                )

    def get_actions(self) -> list:
        """Hierarchy provides no direct actions - just state management."""
        return []

    def get_scene_state(self) -> dict:
        """Return hierarchy mechanic's contribution to scene state."""
        return {
            "hierarchy_type": self.hierarchy_type,
            "role_levels": self.levels,
            "can_command": self.can_command,
        }

    def get_level(self, agent: Agent) -> int:
        """Get an agent's hierarchy level."""
        return agent.properties.get("role_level", 1)

    def can_agent_command(self, agent: Agent, target: Agent) -> bool:
        """Check if agent can command target."""
        if not self.can_command or self.hierarchy_type != "tree":
            return False
        return self.get_level(agent) > self.get_level(target)

    def get_superiors(self, agent: Agent, all_agents: list[Agent]) -> list[Agent]:
        """Get all agents superior to the given agent."""
        my_level = self.get_level(agent)
        return [a for a in all_agents if self.get_level(a) > my_level]

    def get_subordinates(self, agent: Agent, all_agents: list[Agent]) -> list[Agent]:
        """Get all agents subordinate to the given agent."""
        my_level = self.get_level(agent)
        return [a for a in all_agents if self.get_level(a) < my_level]
