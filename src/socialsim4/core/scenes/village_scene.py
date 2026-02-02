import heapq
import math
from typing import Dict, Iterable, List, Optional, Tuple

from socialsim4.core.actions.base_actions import TalkToAction
from socialsim4.core.actions.village_actions import (
    GatherResourceAction,
    LookAroundAction,
    MoveToLocationAction,
    RestAction,
)
from socialsim4.core.agent import Agent
from socialsim4.core.event import StatusEvent
from socialsim4.core.scene import Scene
from socialsim4.core.simulator import Simulator


class MapLocation:
    """地图上的一个位置点"""

    def __init__(
        self,
        name: str,
        x: int,
        y: int,
        location_type: str = "generic",
        description: str = "",
        resources: Dict = None,
        capacity: int = -1,
    ):
        self.name = name
        self.x = x
        self.y = y
        self.location_type = (
            location_type  # "building", "resource", "landmark", "generic"
        )
        self.description = description
        self.resources = resources or {}  # 可采集的资源
        self.capacity = capacity  # 最大容纳人数，-1表示无限制
        self.agents_here = set()  # 当前在此位置的智能体

    def add_agent(self, agent_name: str) -> bool:
        """添加智能体到此位置"""
        if self.capacity == -1 or len(self.agents_here) < self.capacity:
            self.agents_here.add(agent_name)
            return True
        return False

    def remove_agent(self, agent_name: str):
        """从此位置移除智能体"""
        self.agents_here.discard(agent_name)

    def get_distance_to(self, other_x: int, other_y: int) -> float:
        """计算到另一个坐标的距离"""
        return math.sqrt((self.x - other_x) ** 2 + (self.y - other_y) ** 2)


class Tile:
    """A single grid tile."""

    def __init__(
        self,
        passable: bool = True,
        movement_cost: int = 1,
        terrain: str = "plain",
        resources: Optional[Dict] = None,
    ):
        self.passable = passable
        self.movement_cost = movement_cost
        self.terrain = terrain
        self.resources = resources or {}

    def serialize(self):
        return {
            "passable": self.passable,
            "movement_cost": self.movement_cost,
            "terrain": self.terrain,
            "resources": self.resources,
        }

    @classmethod
    def deserialize(cls, data: Dict):
        return cls(
            passable=data.get("passable", True),
            movement_cost=data.get("movement_cost", 1),
            terrain=data.get("terrain", "plain"),
            resources=data.get("resources", {}),
        )


class GameMap:
    """游戏地图管理器"""

    def __init__(self, width: int = 20, height: int = 20):
        self.width = width
        self.height = height
        self.locations: Dict[str, MapLocation] = {}
        self.grid = {}  # 坐标到位置名称的映射
        # Sparse storage of tiles: only store non-default tiles explicitly
        self.tiles: Dict[Tuple[int, int], Tile] = {}

    def serialize(self):
        """Serializes the map to a dictionary."""
        tiles = []
        for (x, y), tile in self.tiles.items():
            tiles.append({"x": x, "y": y, **tile.serialize()})
        return {
            "width": self.width,
            "height": self.height,
            "tiles": tiles,
            "locations": [
                {
                    "name": loc.name,
                    "x": loc.x,
                    "y": loc.y,
                    "type": loc.location_type,
                    "description": loc.description,
                    "resources": loc.resources,
                    "capacity": loc.capacity,
                }
                for loc in self.locations.values()
            ],
        }

    def render_ascii(self, agents: Dict[str, Agent] = None, color: bool = True) -> str:
        """Render an ASCII diagram of the map.
        Legend: '.' passable, '#' blocked, 'L' named location, 'A' agent, '*' multiple agents.
        If color=True, apply ANSI colors to improve readability.
        """
        # Build quick lookups
        loc_by_xy = {(loc.x, loc.y): loc for loc in self.locations.values()}
        agents_xy: Dict[Tuple[int, int], int] = {}
        if agents:
            for a in agents.values():
                xy = a.properties.get("map_xy") or [None, None]
                if xy and xy[0] is not None and xy[1] is not None:
                    key = (int(xy[0]), int(xy[1]))
                    agents_xy[key] = agents_xy.get(key, 0) + 1

        rows: List[str] = []
        for y in range(self.height):
            row = []
            for x in range(self.width):
                ch = "." if self.is_passable(x, y) else "#"
                if (x, y) in loc_by_xy:
                    ch = "L"
                cnt = agents_xy.get((x, y), 0)
                if cnt == 1:
                    ch = "A"
                elif cnt > 1:
                    ch = "*"
                if color:
                    if ch == ".":
                        ch = "\x1b[2m.\x1b[0m"  # dim
                    elif ch == "#":
                        ch = "\x1b[90m#\x1b[0m"  # gray
                    elif ch == "L":
                        ch = "\x1b[33mL\x1b[0m"  # yellow
                    elif ch == "A":
                        ch = "\x1b[36mA\x1b[0m"  # cyan
                    elif ch == "*":
                        ch = "\x1b[35m*\x1b[0m"  # magenta
                row.append(ch)
            rows.append("".join(row))
        header = f"Map {self.width}x{self.height}"
        if color:
            legend = (
                "Legend: "
                + "\x1b[2m.\x1b[0m passable, "
                + "\x1b[90m#\x1b[0m blocked, "
                + "\x1b[33mL\x1b[0m location, "
                + "\x1b[36mA\x1b[0m agent, "
                + "\x1b[35m*\x1b[0m multiple"
            )
        else:
            legend = "Legend: . passable, # blocked, L location, A agent, * multiple"
        return "\n".join([header, legend] + rows)

    @classmethod
    def deserialize(cls, data: Dict):
        """Creates a map from a dictionary."""
        width = data.get("width", 20)
        height = data.get("height", 20)
        game_map = cls(width, height)

        for t in data.get("tiles", []):
            x, y = t["x"], t["y"]
            tile = Tile.deserialize(t)
            game_map.tiles[(x, y)] = tile

        for loc in data.get("locations", []):
            game_map.add_location(
                loc.get("name"),
                loc.get("x"),
                loc.get("y"),
                location_type=loc.get("type", "generic"),
                description=loc.get("description", ""),
                resources=loc.get("resources", {}),
                capacity=loc.get("capacity", -1),
            )
        return game_map

    def add_location(
        self,
        name: str,
        x: int,
        y: int,
        location_type: str = "generic",
        description: str = "",
        resources: Dict = None,
        capacity: int = -1,
    ):
        """添加新位置到地图"""
        if 0 <= x < self.width and 0 <= y < self.height:
            location = MapLocation(
                name, x, y, location_type, description, resources, capacity
            )
            self.locations[name] = location
            self.grid[(x, y)] = name
            return True
        return False

    def get_location(self, name: str) -> Optional[MapLocation]:
        """获取位置信息"""
        return self.locations.get(name)

    def get_location_at(self, x: int, y: int) -> Optional[MapLocation]:
        """获取指定坐标的位置"""
        location_name = self.grid.get((x, y))
        return self.locations.get(location_name) if location_name else None

    def get_nearby_locations(
        self, x: int, y: int, radius: int = 3
    ) -> List[MapLocation]:
        """获取附近的位置"""
        nearby = []
        for location in sorted(
            self.locations.values(), key=lambda loc: (loc.y, loc.x, loc.name)
        ):
            distance = abs(location.x - x) + abs(location.y - y)
            if distance <= radius:
                nearby.append(location)
        return sorted(nearby, key=lambda loc: abs(loc.x - x) + abs(loc.y - y))

    def get_tile(self, x: int, y: int) -> Tile:
        """Return tile, defaulting to passable plain if unset."""
        return self.tiles.get((x, y), Tile())

    def set_tile(
        self,
        x: int,
        y: int,
        *,
        passable: Optional[bool] = None,
        movement_cost: Optional[int] = None,
        terrain: Optional[str] = None,
        resources: Optional[Dict] = None,
    ):
        tile = self.tiles.get((x, y), Tile())
        if passable is not None:
            tile.passable = passable
        if movement_cost is not None:
            tile.movement_cost = movement_cost
        if terrain is not None:
            tile.terrain = terrain
        if resources is not None:
            tile.resources = resources
        self.tiles[(x, y)] = tile

    def in_bounds(self, x: int, y: int) -> bool:
        return 0 <= x < self.width and 0 <= y < self.height

    def is_passable(self, x: int, y: int) -> bool:
        return self.in_bounds(x, y) and self.get_tile(x, y).passable

    def neighbors(self, x: int, y: int) -> Iterable[Tuple[int, int]]:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if self.is_passable(nx, ny):
                yield nx, ny

    def heuristic(self, a: Tuple[int, int], b: Tuple[int, int]) -> float:
        ax, ay = a
        bx, by = b
        return abs(ax - bx) + abs(ay - by)

    def find_path(
        self, start: Tuple[int, int], goal: Tuple[int, int]
    ) -> Optional[List[Tuple[int, int]]]:
        """A* pathfinding from start to goal; returns list including goal.
        Returns None if no path.
        """
        if start == goal:
            return [goal]
        if not (self.is_passable(*start) and self.is_passable(*goal)):
            return None

        open_heap: List[Tuple[float, Tuple[int, int]]] = []
        heapq.heappush(open_heap, (0, start))
        came_from: Dict[Tuple[int, int], Optional[Tuple[int, int]]] = {start: None}
        g_score: Dict[Tuple[int, int], float] = {start: 0}

        while open_heap:
            _, current = heapq.heappop(open_heap)
            if current == goal:
                # Reconstruct path
                path = []
                while current is not None:
                    path.append(current)
                    current = came_from[current]
                path.reverse()
                return path

            cx, cy = current
            for nx, ny in self.neighbors(cx, cy):
                tentative_g = g_score[current] + self.get_tile(nx, ny).movement_cost
                neighbor = (nx, ny)
                if tentative_g < g_score.get(neighbor, float("inf")):
                    came_from[neighbor] = current
                    g_score[neighbor] = tentative_g
                    f_score = tentative_g + self.heuristic(neighbor, goal)
                    heapq.heappush(open_heap, (f_score, neighbor))

        return None

    def path_cost(self, path: List[Tuple[int, int]]) -> int:
        if not path:
            return 0
        # exclude start tile cost, count moving into each tile
        cost = 0
        for x, y in path[1:]:
            cost += max(1, int(self.get_tile(x, y).movement_cost))
        return cost

    def display_map(self, agents: Dict[str, Agent] = None) -> str:
        """Generate a textual map overview (English)."""
        map_display = []
        map_display.append("Village Map:")
        map_display.append("=" * 40)

        for location in self.locations.values():
            agents_here = []
            if agents:
                for agent_name, agent in agents.items():
                    # Prefer coordinates if available
                    xy = agent.properties.get("map_xy")
                    if xy and (location.x, location.y) == tuple(xy):
                        agents_here.append(agent_name)
                    elif agent.properties.get("map_position") == location.name:
                        agents_here.append(agent_name)

            agent_info = f" ({', '.join(agents_here)})" if agents_here else ""
            map_display.append(
                f"- {location.name} ({location.x},{location.y}){agent_info}"
            )
            map_display.append(f"   {location.description}")
            if location.resources:
                resources_str = ", ".join(
                    [f"{k}:{v}" for k, v in location.resources.items()]
                )
            else:
                resources_str = "(none)"
            map_display.append(f"   Resources: {resources_str}")
            map_display.append("")

        return "\n".join(map_display)


class VillageScene(Scene):
    TYPE = "village_scene"
    """支持地图的场景"""

    def __init__(
        self,
        name: str,
        initial_event: str,
        game_map: GameMap,
        movement_cost: int = 1,
        chat_range: int = 5,
        print_map_each_turn: bool = False,
    ):
        super().__init__(name, initial_event)
        self.game_map = game_map
        self.movement_cost = movement_cost
        self.chat_range = chat_range
        self.print_map_each_turn = print_map_each_turn
        # Use minutes in state["time"] to match Event formatting; advance per round
        self.minutes_per_turn = 0
        self.state["time"] = 0

    def get_scenario_description(self):
        return f"""
You live in a grid-based virtual village (size: {self.game_map.width}x{self.game_map.height}).
You have coordinates, needs (hunger, energy), and an inventory. You can move across the map, gather resources, and interact with other agents.
- Use move_to_location to reach coordinates or named locations; movement cost depends on terrain and is multiplied by {self.movement_cost}.
- Use look_around to see nearby locations, resources, and agents; speaking range is {self.chat_range}.
"""

    def get_compact_description(self):
        """Compact description for 4B models."""
        locations = ", ".join([loc.name for loc in self.game_map.locations[:5]])
        return f"Village {self.game_map.width}x{self.game_map.height} grid. Locations: {locations}. Energy ↓ with actions. Chat range: {self.chat_range}."

    def get_behavior_guidelines(self):
        return """Map: Move, explore, gather resources. Speak to nearby agents only. Manage energy."""

    def get_examples(self):
        # Return empty for 4B models - examples are now in output_format
        return ""

    def initialize_agent(self, agent: Agent):
        """Initializes an agent with scene-specific properties."""
        super().initialize_agent(agent)
        # Initialize basics only if not preset
        agent.properties.setdefault("hunger", 0)
        agent.properties.setdefault("energy", 100)
        agent.properties.setdefault("inventory", {})

        # Respect preset map_xy/map_position if provided; otherwise choose a spawn
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

        # Ensure map_position matches coordinates; track occupancy for named locations
        loc = self.game_map.get_location_at(x, y)
        agent.properties["map_position"] = loc.name if loc else f"{x},{y}"
        if loc:
            loc.add_agent(agent.name)

    def get_scene_actions(self, agent: Agent):
        """Return actions available in the village (map) scene for this agent."""
        return [
            TalkToAction(),
            MoveToLocationAction(),
            LookAroundAction(),
            GatherResourceAction(),
            RestAction(),
            *super().get_scene_actions(agent),
        ]

    def post_turn(self, agent: Agent, simulator: Simulator):
        # Advance scene clock by 60 minutes per agent turn
        self.state["time"] = int(self.state.get("time", 0) or 0) + 60
        super().post_turn(agent, simulator)

        # Basic physiological changes for acting agent
        agent.properties["hunger"] = min(100, agent.properties.get("hunger", 0) + 3)
        agent.properties["energy"] = max(0, agent.properties.get("energy", 100) - 2)

        # Position/occupancy sync for named locations
        xy = agent.properties.get("map_xy")
        if xy:
            loc = self.game_map.get_location_at(xy[0], xy[1])
            # 清理不在此处的占用
            for location in self.game_map.locations.values():
                if agent.name in location.agents_here and (
                    location.x != xy[0] or location.y != xy[1]
                ):
                    location.remove_agent(agent.name)
            if loc and agent.name not in loc.agents_here:
                loc.add_agent(agent.name)

        # Status warnings (English, plain) for acting agent
        if agent.properties["hunger"] >= 70:
            status = f"You are quite hungry (hunger: {agent.properties['hunger']}). Consider finding food."
            evt = StatusEvent(status)
            text = evt.to_string(self.state.get("time"))
            agent.add_env_feedback(text)

        if agent.properties["energy"] <= 30:
            status = f"You are tired (energy: {agent.properties['energy']}). Consider resting or moving less."
            evt = StatusEvent(status)
            text = evt.to_string(self.state.get("time"))
            agent.add_env_feedback(text)

    def parse_and_handle_action(self, action_data, agent: Agent, simulator: Simulator):
        success, result, summary, meta, pass_control = super().parse_and_handle_action(
            action_data, agent, simulator
        )
        if getattr(self, "print_map_each_turn", False) and action_data.get("action"):
            ascii_map = self.game_map.render_ascii(simulator.agents)
            simulator.record_log(
                f"After action {action_data.get('action')} by {agent.name}:\n{ascii_map}",
                sender=agent.name,
                kind="map",
            )
        return success, result, summary, meta, pass_control

    # Removed post_round: no round concept

    def get_agent_status_prompt(self, agent: Agent) -> str:
        minutes = int(self.state.get("time", 0) or 0)
        hours = (minutes // 60) % 24
        mins = minutes % 60
        time_of_day = "day" if hours < 18 else "night"
        xy = agent.properties.get("map_xy") or [None, None]
        loc = self.game_map.get_location_at(xy[0], xy[1]) if xy[0] is not None else None
        loc_name = loc.name if loc else agent.properties.get("map_position", "?")
        return f"""
--- Status ---
Current position: {loc_name} at ({xy[0]},{xy[1]})
Hunger level: {agent.properties["hunger"]}
Energy level: {agent.properties["energy"]}
Inventory: {agent.properties["inventory"]}
Current time: {hours}:{mins:02d} ({time_of_day})
"""

    def deliver_message(self, event, sender: Agent, simulator: Simulator):
        """Limit chat delivery to agents within chat_range (Manhattan distance).
        If social_network is configured, also apply social network filtering.
        """
        time = self.state.get("time")
        formatted = event.to_string(time)
        event.code = "scene_chat"
        event.params = {
            "sender": sender.name,
            "message": event.message,
            "recipients": [],
        }
        # Ensure sender also retains their own speech in memory
        sender.add_env_feedback(formatted)
        sxy = sender.properties.get("map_xy")
        
        # 先应用距离限制
        distance_recipients = []
        for a in simulator.agents.values():
            if a.name == sender.name:
                continue
            axy = a.properties.get("map_xy")
            if not sxy or not axy:
                # Fallback: if coords missing, include in distance_recipients
                distance_recipients.append(a.name)
                continue
            dist = abs(sxy[0] - axy[0]) + abs(sxy[1] - axy[1])
            if dist <= self.chat_range:
                distance_recipients.append(a.name)
        
        # 如果配置了社交网络，再应用社交网络过滤
        social_network = self.state.get("social_network")
        if social_network and isinstance(social_network, dict) and len(social_network) > 0:
            # 获取社交网络中的连接
            sender_connections = social_network.get(sender.name, [])
            if not isinstance(sender_connections, list):
                sender_connections = []
            # 取交集：既在距离内，又在社交网络中
            recipients = [
                name for name in distance_recipients
                if name in sender_connections and name in simulator.agents
            ]
        else:
            # 没有配置社交网络，只使用距离限制
            recipients = distance_recipients
        
        # 向接收者发送消息
        for agent_name in recipients:
            agent = simulator.agents.get(agent_name)
            if agent:
                agent.add_env_feedback(formatted)
        
        # 记录事件
        simulator.emit_event_later(
            "system_broadcast",
            {
                "time": time,
                "type": event.__class__.__name__,
                "sender": sender.name,
                "recipients": recipients,
                "text": event.to_string(),
                "code": event.code,
                "params": {"sender": sender.name, "message": event.message, "recipients": recipients},
            },
        )

    # ----- Unified serialization hooks -----
    def serialize_config(self) -> dict:
        return {
            "movement_cost": self.movement_cost,
            "chat_range": self.chat_range,
            "map": self.game_map.serialize(),
            "print_map_each_turn": self.print_map_each_turn,
        }

    @classmethod
    def deserialize_config(cls, config: Dict) -> Dict:
        return {
            "game_map": GameMap.deserialize(config["map"]),
            "movement_cost": config.get("movement_cost", 1),
            "chat_range": config.get("chat_range", 5),
            "print_map_each_turn": config.get("print_map_each_turn", False),
        }
