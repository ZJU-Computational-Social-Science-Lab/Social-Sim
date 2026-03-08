"""
Contagion actions for agent movement and communication.

This module provides action classes for contagion scenarios, enabling
agents to move one cell at a time and communicate with nearby agents.

The actions follow the platform pattern:
- Extend Action base class with NAME, DESC, INSTRUCTION
- handle() method returns 5-tuple (success, result, summary, meta, pass_control)
- Use _localized() helper for bilingual feedback

Contains: MoveAdjacentAction, DIRECTION_DELTAS, SpeakToAction
"""
from socialsim4.core.action import Action
from socialsim4.core.agent import Agent
from socialsim4.core.event import TalkToEvent
from socialsim4.core.scene import Scene
from socialsim4.core.simulator import Simulator
from socialsim4.core.action import Action
from socialsim4.core.agent import Agent
from socialsim4.core.scene import Scene
from socialsim4.core.simulator import Simulator


# Direction to coordinate delta mapping for 8 compass directions
# (dx, dy) where positive x is east, positive y is south
DIRECTION_DELTAS = {
    "north": (0, -1),
    "northeast": (1, -1),
    "east": (1, 0),
    "southeast": (1, 1),
    "south": (0, 1),
    "southwest": (-1, 1),
    "west": (-1, 0),
    "northwest": (-1, -1),
}


def _is_english_language(lang: str | None) -> bool:
    """Check if the agent's language preference is English."""
    lower = str(lang or "").lower()
    return lower.startswith("en") or "english" in lower


def _localized(agent: Agent, en_text: str, zh_text: str) -> str:
    """Return localized text based on agent's language preference."""
    return en_text if _is_english_language(getattr(agent, "language", "")) else zh_text


class MoveAdjacentAction(Action):
    """
    Action to move an agent one cell in a compass direction.

    Allows agents to move to any of the 8 adjacent cells (Moore neighborhood).
    Validates boundaries and collisions before executing the move.
    """

    NAME = "move"
    DESC = "Move to an adjacent cell in one of 8 directions."
    INSTRUCTION = """- move: Move one cell in a compass direction
  <Action name="move"><direction>north</direction></Action>
  Valid directions: north, northeast, east, southeast, south, southwest, west, northwest
"""

    def handle(self, action_data, agent: Agent, simulator: Simulator, scene: Scene):
        """
        Execute the move action.

        Validates the direction, checks boundaries and collisions, then updates
        the agent's position if the move is valid.

        Args:
            action_data: Dict with "direction" key (e.g., "north", "south")
            agent: The agent executing the action
            simulator: The simulator instance for accessing other agents
            scene: The scene containing the game map

        Returns:
            5-tuple: (success, result, summary, meta, pass_control)
        """
        direction = action_data.get("direction", "").lower()

        # Validate direction
        if direction not in DIRECTION_DELTAS:
            valid_dirs = ", ".join(DIRECTION_DELTAS.keys())
            agent.add_env_feedback(
                _localized(
                    agent,
                    f"Invalid direction '{direction}'. Use: {valid_dirs}.",
                    f"无效的方向 '{direction}'。请使用：{valid_dirs}。"
                )
            )
            return (
                False,
                {"error": "invalid_direction", "direction": direction},
                _localized(agent, f"{agent.name} move failed", f"{agent.name} 移动失败"),
                {},
                False
            )

        # Get current position
        xy = agent.properties.get("map_xy")
        if not xy:
            agent.add_env_feedback(_localized(agent, "Position unknown.", "位置未知。"))
            return (
                False,
                {"error": "no_position"},
                _localized(agent, f"{agent.name} move failed", f"{agent.name} 移动失败"),
                {},
                False
            )

        # Calculate target position
        dx, dy = DIRECTION_DELTAS[direction]
        target_x, target_y = xy[0] + dx, xy[1] + dy

        # Check bounds
        if not scene.game_map.in_bounds(target_x, target_y):
            agent.add_env_feedback(
                _localized(
                    agent,
                    f"Cannot move {direction} - at grid boundary.",
                    f"无法向 {direction} 移动 - 已在网格边界。"
                )
            )
            return (
                False,
                {"error": "boundary", "direction": direction},
                _localized(agent, f"{agent.name} move failed", f"{agent.name} 移动失败"),
                {},
                False
            )

        # Check for collision with other agents
        for other_name, other_agent in simulator.agents.items():
            if other_name == agent.name:
                continue
            other_xy = other_agent.properties.get("map_xy")
            if other_xy and other_xy[0] == target_x and other_xy[1] == target_y:
                agent.add_env_feedback(
                    _localized(
                        agent,
                        f"Cell occupied by {other_name}, move failed.",
                        f"单元格被 {other_name} 占用，移动失败。"
                    )
                )
                return (
                    False,
                    {"error": "occupied", "by": other_name},
                    _localized(agent, f"{agent.name} move failed", f"{agent.name} 移动失败"),
                    {},
                    False
                )

        # Execute move
        start_xy = [xy[0], xy[1]]
        agent.properties["map_xy"] = [target_x, target_y]

        # Update map_position if on a named location
        loc = scene.game_map.get_location_at(target_x, target_y)
        agent.properties["map_position"] = loc.name if loc else f"{target_x},{target_y}"

        agent.add_env_feedback(
            _localized(
                agent,
                f"You moved {direction} to ({target_x}, {target_y}).",
                f"你向 {direction} 移动到了 ({target_x}, {target_y})。"
            )
        )

        result = {"from": start_xy, "to": [target_x, target_y], "direction": direction}
        summary = _localized(
            agent,
            f"{agent.name} moved {direction}",
            f"{agent.name} 向 {direction} 移动"
        )
        return True, result, summary, {}, False


class SpeakToAction(Action):
    """
    Action to speak to a nearby agent in an adjacent cell.

    Implements targeted communication with Moore neighborhood constraints.
    The action delivers a message to a specific adjacent agent via
    add_env_feedback, enabling information diffusion scenarios.

    The two-step pattern is handled at the LLM interaction level:
    - Step 1: LLM selects target (XML: <Action name="speak"><target>Name</target></Action>)
    - Step 2: LLM is prompted for message content
    - The action.handle() receives BOTH target AND message in action_data
    """

    NAME = "speak"
    DESC = "Speak to a nearby agent (adjacent cell only). You will be prompted for your message after selecting a target."
    INSTRUCTION = """- speak: Say something to an adjacent agent
  <Action name="speak"><target>Name</target></Action>
  Target must be in one of your 8 adjacent cells.
  (After selecting target, you will be prompted for your message.)
"""

    def handle(self, action_data, agent: Agent, simulator: Simulator, scene: Scene):
        """
        Execute the speak action.

        Validates that the target exists and is in an adjacent cell (Moore
        neighborhood), then delivers the message to both sender and target
        via add_env_feedback using TalkToEvent format.

        Args:
            action_data: Dict with "target" (agent name) and "message" (text)
            agent: The agent executing the action
            simulator: The simulator instance for accessing other agents
            scene: The scene containing game state

        Returns:
            5-tuple: (success, result, summary, meta, pass_control)
        """
        target_name = action_data.get("target")
        message = action_data.get("message")

        # Validate target present
        if not target_name:
            agent.add_env_feedback(
                _localized(agent, "Missing target. Who do you want to speak to?", "缺少目标。你想和谁说话？")
            )
            return (
                False,
                {"error": "missing_target"},
                _localized(agent, f"{agent.name} failed to speak", f"{agent.name} 说话失败"),
                {},
                False
            )

        # Validate message present
        if not message:
            agent.add_env_feedback(
                _localized(agent, "Missing message. What do you want to say?", "缺少消息。你想说什么？")
            )
            return (
                False,
                {"error": "missing_message"},
                _localized(agent, f"{agent.name} failed to speak", f"{agent.name} 说话失败"),
                {},
                False
            )

        # Look up target in simulator
        target = simulator.agents.get(target_name)
        if not target:
            agent.add_env_feedback(
                _localized(agent, f"No such agent: {target_name}.", f"没有此代理：{target_name}。")
            )
            return (
                False,
                {"error": "no_such_agent", "target": target_name},
                _localized(agent, f"{agent.name} failed to speak", f"{agent.name} 说话失败"),
                {},
                False
            )

        # Get positions
        agent_xy = agent.properties.get("map_xy")
        target_xy = target.properties.get("map_xy")

        if not agent_xy:
            agent.add_env_feedback(
                _localized(agent, "Your position is unknown.", "你的位置未知。")
            )
            return (
                False,
                {"error": "no_position"},
                _localized(agent, f"{agent.name} failed to speak", f"{agent.name} 说话失败"),
                {},
                False
            )

        if not target_xy:
            agent.add_env_feedback(
                _localized(agent, f"{target_name}'s position is unknown.", f"{target_name} 的位置未知。")
            )
            return (
                False,
                {"error": "target_no_position", "target": target_name},
                _localized(agent, f"{agent.name} failed to speak", f"{agent.name} 说话失败"),
                {},
                False
            )

        # Moore neighborhood adjacency check: max(dx, dy) <= 1
        dx = abs(agent_xy[0] - target_xy[0])
        dy = abs(agent_xy[1] - target_xy[1])

        if dx > 1 or dy > 1:
            agent.add_env_feedback(
                _localized(
                    agent,
                    f"{target_name} is not in an adjacent cell. You can only speak to nearby agents.",
                    f"{target_name} 不在相邻单元格内。你只能与附近的代理说话。"
                )
            )
            return (
                False,
                {"error": "not_adjacent", "target": target_name},
                _localized(agent, f"{agent.name} failed to speak", f"{agent.name} 说话失败"),
                {},
                False
            )

        # Create TalkToEvent and deliver to both parties
        event = TalkToEvent(agent.name, target_name, message)
        formatted = event.to_string(scene.state.get("time"))

        # Deliver to sender
        agent.add_env_feedback(formatted)
        # Deliver to target
        target.add_env_feedback(formatted)

        # Check for action-directed transmission (Phase 3)
        if hasattr(scene, 'check_action_transmission'):
            scene.check_action_transmission(agent, target, simulator)

        result = {"to": target_name, "message": message}
        summary = _localized(
            agent,
            f"{agent.name} to {target_name}: {message}",
            f"{agent.name} 对 {target_name} 说：{message}"
        )
        return True, result, summary, {}, False
