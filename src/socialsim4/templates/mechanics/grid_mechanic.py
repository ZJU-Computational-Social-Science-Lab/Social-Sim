"""Grid mechanic for spatial navigation and interaction.

Provides grid-based movement, looking around, and resting.
Uses GameMap from village_scene for terrain and pathfinding.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from socialsim4.core.actions.village_actions import (
    LookAroundAction,
    MoveToLocationAction,
    RestAction,
)
from socialsim4.core.scenes.village_scene import GameMap
from socialsim4.templates.mechanics.base import CoreMechanic

if TYPE_CHECKING:
    from socialsim4.core.agent import Agent
    from socialsim4.core.scene import Scene


class GridMechanic(CoreMechanic):
    """Grid-based spatial navigation mechanic.

    Provides agents with position on a 2D grid, energy management,
    and the ability to move, look around, and rest.

    Config:
        width: Grid width (default: 20)
        height: Grid height (default: 20)
        chat_range: Maximum distance for communication (default: 5)
        movement_cost: Movement energy multiplier (default: 1)
    """

    TYPE = "grid"

    def __init__(
        self,
        game_map: GameMap,
        chat_range: int = 5,
        movement_cost: int = 1,
    ):
        self.game_map = game_map
        self.chat_range = chat_range
        self.movement_cost = movement_cost
        self._actions = [
            MoveToLocationAction(),
            LookAroundAction(),
            RestAction(),
        ]

    @classmethod
    def from_config(cls, config: dict) -> "GridMechanic":
        """Create GridMechanic from config dict."""
        width = config.get("width", 20)
        height = config.get("height", 20)
        chat_range = config.get("chat_range", 5)
        movement_cost = config.get("movement_cost", 1)

        game_map = GameMap(width=width, height=height)

        # Add default spawn point
        game_map.add_location(
            "village_center",
            width // 2,
            height // 2,
            location_type="landmark",
            description="The central square of the village.",
        )

        return cls(
            game_map=game_map,
            chat_range=chat_range,
            movement_cost=movement_cost,
        )

    def initialize_agent(self, agent: Agent, scene: Scene) -> None:
        """Initialize agent with grid-based properties."""
        # Basic properties
        agent.properties.setdefault("hunger", 0)
        agent.properties.setdefault("energy", 100)
        agent.properties.setdefault("inventory", {})

        # Respect preset map_xy/map_position if provided
        xy = agent.properties.get("map_xy")
        pos_name = agent.properties.get("map_position")

        if xy:
            x, y = int(xy[0]), int(xy[1])
        elif pos_name and self.game_map.get_location(pos_name):
            loc = self.game_map.get_location(pos_name)
            x, y = loc.x, loc.y
            agent.properties["map_xy"] = [x, y]
        else:
            spawn = self.game_map.get_location("village_center")
            if spawn:
                x, y = spawn.x, spawn.y
                agent.properties["map_xy"] = [x, y]
                agent.properties["map_position"] = "village_center"
                spawn.add_agent(agent.name)
            else:
                cx, cy = self.game_map.width // 2, self.game_map.height // 2
                x, y = cx, cy
                agent.properties["map_xy"] = [x, y]
                agent.properties["map_position"] = f"{x},{y}"

        # Ensure map_position matches coordinates
        loc = self.game_map.get_location_at(x, y)
        agent.properties["map_position"] = loc.name if loc else f"{x},{y}"
        if loc:
            loc.add_agent(agent.name)

    def get_actions(self) -> list:
        """Return grid-based action classes."""
        return self._actions

    def get_scene_state(self) -> dict:
        """Return grid mechanic's contribution to scene state."""
        return {
            "game_map": self.game_map,
            "chat_range": self.chat_range,
            "movement_cost": self.movement_cost,
        }
