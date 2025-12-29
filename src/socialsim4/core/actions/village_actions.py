from socialsim4.core.action import Action
from socialsim4.core.agent import Agent
from socialsim4.core.scene import Scene
from socialsim4.core.simulator import Simulator


class MoveToLocationAction(Action):
    NAME = "move_to_location"
    DESC = "Move to a named location or coordinates."
    INSTRUCTION = """- To move to a location:
<Action name=\"move_to_location\"><location>[location_name]</location></Action>
- Or move to coordinates:
<Action name=\"move_to_location\"><x>12</x><y>34</y></Action>
"""

    def handle(self, action_data, agent: Agent, simulator: Simulator, scene: Scene):
        """Move to a location or coordinates using grid pathfinding and terrain costs."""
        # Resolve start
        start_xy = agent.properties.get("map_xy")
        target_xy = None
        target_location = action_data.get("location")
        if target_location:
            loc = scene.game_map.get_location(target_location)
            if not loc:
                agent.add_env_feedback(f"Location '{target_location}' does not exist.")
                return False, {"error": "unknown_location", "location": target_location}, f"{agent.name} move failed", {}, False
            target_xy = [loc.x, loc.y]
        else:
            tx, ty = action_data["x"], action_data["y"]
            if tx is None or ty is None:
                agent.add_env_feedback(
                    "Provide a target 'location' or coordinates 'x' and 'y'."
                )
                return False, {"error": "missing_target"}, f"{agent.name} move failed", {}, False
            target_xy = [int(tx), int(ty)]

        if start_xy[0] == target_xy[0] and start_xy[1] == target_xy[1]:
            agent.add_env_feedback("You are already at the target.")
            return False, {"error": "already_there", "to": target_xy}, f"{agent.name} move skipped", {}, False

        # Pathfinding
        path = scene.game_map.find_path(tuple(start_xy), tuple(target_xy))
        if not path:
            agent.add_env_feedback("No reachable path; possibly blocked by obstacles.")
            return False, {"error": "no_path", "to": target_xy}, f"{agent.name} move failed", {}, False

        # Compute energy cost: sum of tile movement_cost entering each tile, scaled
        base_cost = scene.game_map.path_cost(path)
        energy_cost = max(1, int(base_cost * scene.movement_cost))

        if agent.properties["energy"] < energy_cost:
            agent.add_env_feedback(
                f"Not enough energy. Moving to {tuple(target_xy)} costs {energy_cost}, you have {agent.properties['energy']}."
            )
            return False, {"error": "low_energy", "required": energy_cost, "have": agent.properties["energy"]}, f"{agent.name} move failed", {}, False

        # Update location occupancy (named POIs)
        prev_loc = scene.game_map.get_location_at(start_xy[0], start_xy[1])
        if prev_loc:
            prev_loc.remove_agent(agent.name)

        agent.properties["map_xy"] = [target_xy[0], target_xy[1]]
        # Update map_position name if exactly on a named location
        new_loc = scene.game_map.get_location_at(target_xy[0], target_xy[1])
        agent.properties["map_position"] = (
            new_loc.name if new_loc else f"{target_xy[0]},{target_xy[1]}"
        )
        if new_loc:
            new_loc.add_agent(agent.name)

        agent.properties["energy"] -= energy_cost

        # Inform the agent about the new position
        desc = (
            new_loc.description
            if new_loc
            else scene.game_map.get_tile(*target_xy).terrain
        )
        agent.add_env_feedback(f"You arrived at {tuple(target_xy)}. {desc}")

        # Nearby agents at destination
        nearby = []
        for other in simulator.agents.values():
            if other.name == agent.name:
                continue
            oxy = other.properties.get("map_xy")
            if oxy:
                dist = abs(oxy[0] - target_xy[0]) + abs(oxy[1] - target_xy[1])
                if dist <= scene.chat_range:
                    nearby.append(f"{other.name} (distance {dist})")
        if nearby:
            agent.add_env_feedback("Nearby agents: " + ", ".join(nearby))

        # No logging here; central processing can consume result/summary
        result = {"from": start_xy, "to": target_xy, "energy_cost": energy_cost, "path": path}
        summary = f"{agent.name} moved to {tuple(target_xy)} (energy {energy_cost})"
        return True, result, summary, {}, False


class LookAroundAction(Action):
    NAME = "look_around"
    DESC = "Survey nearby tiles, locations, and agents."
    INSTRUCTION = """- To look around and see nearby locations and agents:
<Action name=\"look_around\"><radius>5</radius></Action>
"""

    def handle(self, action_data, agent: Agent, simulator: Simulator, scene: Scene):
        """Look around: list nearby locations, resources, and agents."""
        xy = agent.properties.get("map_xy")
        if not xy:
            pos_name = agent.properties.get("map_position")
            loc = scene.game_map.get_location(pos_name) if pos_name else None
            if not loc:
                return False, {"error": "unknown_position"}, f"{agent.name} look failed", {}, False
            xy = [loc.x, loc.y]

        radius = int(action_data.get("radius", max(3, min(7, scene.chat_range))))

        current_loc = scene.game_map.get_location_at(xy[0], xy[1])
        tile = scene.game_map.get_tile(xy[0], xy[1])
        here_desc = (
            f"{current_loc.name}: {current_loc.description}"
            if current_loc
            else tile.terrain
        )

        info = [f"You are at ({xy[0]},{xy[1]}): {here_desc}"]

        # Resources on current tile
        if tile.resources:
            resources = ", ".join([f"{k}({v})" for k, v in tile.resources.items()])
            info.append(f"Resources here: {resources}")

        # Nearby named locations
        nearby_locations = scene.game_map.get_nearby_locations(
            xy[0], xy[1], radius=radius
        )
        if nearby_locations:
            info.append("Nearby locations:")
            for loc in nearby_locations[:8]:
                dist = abs(loc.x - xy[0]) + abs(loc.y - xy[1])
                if dist == 0:
                    continue
                info.append(f"  - {loc.name} (distance: {dist}) - {loc.description}")

        # Nearby agents
        nearby_agents = []
        for other in simulator.agents.values():
            if other.name == agent.name:
                continue
            oxy = other.properties.get("map_xy")
            if not oxy:
                continue
            dist = abs(oxy[0] - xy[0]) + abs(oxy[1] - xy[1])
            if dist <= radius:
                nearby_agents.append((dist, other.name))
        if nearby_agents:
            nearby_agents.sort(key=lambda x: x[0])
            agents_str = ", ".join(
                [f"{name}({dist})" for dist, name in nearby_agents[:10]]
            )
            info.append(f"Nearby agents: {agents_str}")

        agent.add_env_feedback("\n".join(info))
        # No logging here; central processing can consume result/summary
        result = {"radius": radius}
        summary = f"{agent.name} looked around (r={radius})"
        return True, result, summary, {}, False


class GatherResourceAction(Action):
    NAME = "gather_resource"
    DESC = "Collect a resource at current tile/location."
    INSTRUCTION = """- To gather resources:
<Action name=\"gather_resource\"><resource>[resource_name]</resource><amount>[number]</amount></Action>
"""

    def handle(self, action_data, agent: Agent, simulator: Simulator, scene: Scene):
        """Gather resources, preferring tile resources at current position."""
        resource_type = action_data.get("resource")
        amount = int(action_data.get("amount", 1))

        xy = agent.properties.get("map_xy")
        if not xy:
            pos_name = agent.properties.get("map_position")
            loc = scene.game_map.get_location(pos_name) if pos_name else None
            if loc:
                xy = [loc.x, loc.y]
        if not xy:
            agent.add_env_feedback("Current position unknown; cannot gather.")
            return False, {"error": "unknown_position"}, f"{agent.name} gather failed", {}, False

        tile = scene.game_map.get_tile(xy[0], xy[1])
        available = 0
        source = "tile"
        if resource_type in tile.resources:
            available = tile.resources[resource_type]
        else:
            # Fallback: named location resources if present
            loc = scene.game_map.get_location_at(xy[0], xy[1])
            if loc and resource_type in loc.resources:
                available = loc.resources[resource_type]
                source = "location"

        if available <= 0:
            agent.add_env_feedback(f"No {resource_type} to gather here.")
            return False, {"error": "not_available", "resource": resource_type}, f"{agent.name} gather failed", {}, False

        actual_amount = max(0, min(amount, available))
        if actual_amount == 0:
            agent.add_env_feedback(f"{resource_type} is depleted.")
            return False, {"error": "depleted", "resource": resource_type}, f"{agent.name} gather failed", {}, False

        # 执行收集
        if source == "tile":
            tile.resources[resource_type] -= actual_amount
        else:
            loc.resources[resource_type] -= actual_amount

        agent.properties["inventory"][resource_type] = (
            agent.properties["inventory"].get(resource_type, 0) + actual_amount
        )

        agent.add_env_feedback(
            f"You gathered {actual_amount} {resource_type}. Inventory: {agent.properties['inventory']}"
        )
        # No logging here; central processing can consume result/summary
        result = {"resource": resource_type, "amount": actual_amount, "source": source, "position": xy}
        summary = f"{agent.name} gathered {actual_amount} {resource_type}"
        return True, result, summary, {}, False


class RestAction(Action):
    NAME = "rest"
    DESC = "Recover energy; more in buildings."
    INSTRUCTION = """- To rest and recover energy:
<Action name=\"rest\" />
"""

    def handle(self, action_data, agent: Agent, simulator: Simulator, scene: Scene):
        """Rest to regain energy."""
        current_location = scene.game_map.get_location(agent.properties["map_position"])

        # Resting in a building is more effective
        if current_location and current_location.location_type == "building":
            energy_gain = 30
            agent.add_env_feedback(f"You rest comfortably in {current_location.name}.")
        else:
            energy_gain = 15
            agent.add_env_feedback(
                f"You take a short rest at {current_location.name if current_location else 'this spot'}."
            )

        agent.properties["energy"] = min(100, agent.properties["energy"] + energy_gain)
        # No logging here; central processing can consume result/summary
        result = {"energy_gain": energy_gain, "new_energy": agent.properties["energy"]}
        summary = f"{agent.name} rested (+{energy_gain} energy)"
        return True, result, summary, {}, False
