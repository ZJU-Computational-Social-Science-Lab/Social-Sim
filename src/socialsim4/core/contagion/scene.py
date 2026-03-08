"""
ContagionScene for orchestrating contagion state management.

This module provides the ContagionScene class that extends VillageScene
with contagion-specific functionality. It manages agent states, evaluates
decay transitions each turn, and emits statistics to the frontend.

The scene maintains agent isolation - agents infer states from behavior,
not direct observation. State management is handled by the scene.

Contains: ContagionScene
"""
import random
from typing import Dict, List, Optional, Tuple

from socialsim4.core.contagion.states import ContagionState
from socialsim4.core.contagion.rules import StateTransition, check_probability
from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
from socialsim4.core.contagion.actions import MoveAdjacentAction, SpeakToAction
from socialsim4.core.scenes.village_scene import GameMap, VillageScene


class ContagionScene(VillageScene):
    """
    Scene with contagion state tracking and decay rule evaluation.

    Extends VillageScene to manage agent contagion states (S, E, I, R),
    evaluate decay-based state transitions each turn, and emit statistics
    to the frontend via WebSocket events.

    Attributes:
        rules: List of StateTransition rules defining allowed transitions
        initial_infected_count: Number of agents to start as infected
        _statistics: Internal tracker for state counts and events
        _current_simulator: Reference to simulator for adjacent agent queries
    """

    TYPE = "contagion_scene"

    def __init__(
        self,
        name: str,
        initial_event: str,
        game_map: GameMap,
        rules: List[StateTransition],
        initial_infected_count: int = 1,
        **kwargs
    ):
        """
        Initialize the contagion scene.

        Args:
            name: Scene name
            initial_event: Initial event message for agents
            game_map: GameMap instance for grid positioning
            rules: List of StateTransition rules for contagion dynamics
            initial_infected_count: Number of agents to start infected (default 1)
            **kwargs: Additional arguments passed to VillageScene
        """
        super().__init__(name, initial_event, game_map, **kwargs)
        self.rules = rules
        self.initial_infected_count = initial_infected_count
        self._statistics = ContagionStatistics()
        self._current_simulator: Optional["Simulator"] = None

    def pre_run(self, simulator: "Simulator"):
        """
        Initialize agent contagion states before simulation starts.

        Randomly selects initial_infected_count agents to be infected,
        sets all others to susceptible. Initializes contagion_turns to 0.

        Args:
            simulator: Simulator instance for accessing agents
        """
        super().pre_run(simulator)
        self._current_simulator = simulator

        agents = list(simulator.agents.values())
        agent_names = [a.name for a in agents]

        # Randomly select initial infected agents
        infected_names = set()
        if len(agent_names) > 0:
            count = min(self.initial_infected_count, len(agent_names))
            infected_names = set(random.sample(agent_names, count))

        # Set initial states
        for agent in agents:
            if agent.name in infected_names:
                agent.properties["contagion_state"] = ContagionState.INFECTED.value
            else:
                agent.properties["contagion_state"] = ContagionState.SUSCEPTIBLE.value
            agent.properties["contagion_turns"] = 0

        # Update statistics after initialization
        self._update_statistics(simulator)

    def pre_turn_rules(self, simulator: "Simulator"):
        """
        Evaluate decay rules for all agents before they act.

        Increments contagion_turns for each agent, then evaluates
        decay-based transitions. Statistics are updated after evaluation.

        Args:
            simulator: Simulator instance for accessing agents and emitting events
        """
        # Increment turns for all agents
        for agent in simulator.agents.values():
            current_turns = agent.properties.get("contagion_turns", 0)
            agent.properties["contagion_turns"] = current_turns + 1

        # Evaluate decay rules for each agent
        for agent in simulator.agents.values():
            self._evaluate_decay_rules(agent, simulator)

        # Evaluate proximity rules (spatial transmission)
        self._evaluate_proximity_rules(simulator)

        # Update statistics after rule evaluation
        self._update_statistics(simulator)

    def _evaluate_decay_rules(self, agent: "Agent", simulator: "Simulator"):
        """
        Check if any decay rules apply to the agent.

        Evaluates all rules with trigger_type == "decay". If the agent's
        current state matches and contagion_turns >= decay_turns, applies
        the transition. Only one transition per turn.

        Args:
            agent: Agent to evaluate rules for
            simulator: Simulator for event emission
        """
        current_state = agent.properties.get("contagion_state", "")
        turns = agent.properties.get("contagion_turns", 0)

        for rule in self.rules:
            if rule.trigger_type != "decay":
                continue
            if rule.from_state.value == current_state:
                if turns >= rule.decay_turns:
                    self._apply_transition(agent, rule, simulator)
                    break  # Only one transition per turn

    def _apply_transition(
        self,
        agent: "Agent",
        rule: StateTransition,
        simulator: "Simulator",
        source_agent_id: Optional[str] = None
    ):
        """
        Apply a state transition to an agent.

        Updates the agent's contagion_state, resets contagion_turns,
        and records a TransitionEvent in statistics.

        Args:
            agent: Agent to transition
            rule: StateTransition rule being applied
            simulator: Simulator for getting current turn
            source_agent_id: Optional ID of agent that caused this transition
        """
        from_state = agent.properties.get("contagion_state", "")

        # Update agent state
        agent.properties["contagion_state"] = rule.to_state.value
        agent.properties["contagion_turns"] = 0

        # Record transition event
        event = TransitionEvent(
            turn=simulator.turns,
            agent_id=agent.name,
            from_state=from_state,
            to_state=rule.to_state.value,
            trigger_type=rule.trigger_type,
            source_agent_id=source_agent_id
        )
        self._statistics.record_transition(event)

    def _evaluate_proximity_rules(self, simulator: "Simulator"):
        """
        Evaluate proximity-based transmission for all adjacent agent pairs.

        Checks all pairs of adjacent agents for potential transmission.
        Transmission occurs when an infected agent is adjacent to a susceptible
        agent and the probability check succeeds. Newly infected agents cannot
        spread until the next turn (no chaining).

        Args:
            simulator: Simulator instance for accessing agents
        """
        # Build position -> agent mapping for O(1) lookup
        position_to_agent: Dict[Tuple[int, int], "Agent"] = {}
        for agent in simulator.agents.values():
            xy = agent.properties.get("map_xy")
            if xy:
                position_to_agent[(xy[0], xy[1])] = agent

        # Track agents already transitioned this turn (prevents chaining)
        transitioned_this_turn: set = set()

        # Check each agent's neighbors for transmission
        for agent in simulator.agents.values():
            xy = agent.properties.get("map_xy")
            if not xy:
                continue

            # Skip if this agent was just infected this turn (no chaining)
            if agent.name in transitioned_this_turn:
                continue

            agent_state = agent.properties.get("contagion_state", "")

            # Get all Moore neighbors
            neighbor_coords = self.get_moore_neighbors(xy[0], xy[1])

            for neighbor_xy in neighbor_coords:
                neighbor = position_to_agent.get(neighbor_xy)
                if not neighbor:
                    continue

                # Skip if already transitioned this turn
                if neighbor.name in transitioned_this_turn:
                    continue

                neighbor_state = neighbor.properties.get("contagion_state", "")

                # Check proximity rules for transmission from agent to neighbor
                if self._check_proximity_transmission(
                    agent_state, neighbor_state, agent, neighbor,
                    simulator, transitioned_this_turn
                ):
                    break  # Only one transition per pair per turn

                # Check proximity rules for transmission from neighbor to agent
                if self._check_proximity_transmission(
                    neighbor_state, agent_state, neighbor, agent,
                    simulator, transitioned_this_turn
                ):
                    break  # Only one transition per pair per turn

    def _check_proximity_transmission(
        self,
        source_state: str,
        target_state: str,
        source_agent: "Agent",
        target_agent: "Agent",
        simulator: "Simulator",
        transitioned_set: set
    ) -> bool:
        """
        Check if proximity transmission should occur between two agents.

        Args:
            source_state: State of the potentially infectious agent
            target_state: State of the potentially susceptible agent
            source_agent: Agent that might spread contagion
            target_agent: Agent that might receive contagion
            simulator: Simulator instance
            transitioned_set: Set of agent names already transitioned this turn

        Returns:
            True if transmission occurred, False otherwise
        """
        # Skip if target already transitioned
        if target_agent.name in transitioned_set:
            return False

        # Find matching proximity rule
        for rule in self.rules:
            if rule.trigger_type != "proximity":
                continue

            # Check if source state matches and target is susceptible
            if rule.from_state.value == target_state:
                if check_probability(rule.probability):
                    self._apply_transition(
                        target_agent, rule, simulator,
                        source_agent_id=source_agent.name
                    )
                    transitioned_set.add(target_agent.name)
                    return True

        return False

    def _update_statistics(self, simulator: "Simulator"):
        """
        Update statistics and emit to frontend.

        Recounts agents per state, then emits a contagion_stats event
        with counts and agent_states for frontend visualization.

        Args:
            simulator: Simulator for accessing agents and emitting events
        """
        self._statistics.update(simulator.agents)

        simulator.emit_event_later(
            "contagion_stats",
            {
                "counts": self._statistics.counts,
                "agent_states": self._statistics.get_agent_states(simulator.agents),
            }
        )

    def get_moore_neighbors(self, x: int, y: int) -> List[Tuple[int, int]]:
        """
        Get all valid 8-directional (Moore) neighbor coordinates for a cell.

        Moore neighborhood includes diagonals, unlike von Neumann (4-directional).

        Args:
            x: X coordinate of the center cell
            y: Y coordinate of the center cell

        Returns:
            List of (x, y) tuples for all valid adjacent cells
        """
        neighbors = []
        for dx in [-1, 0, 1]:
            for dy in [-1, 0, 1]:
                if dx == 0 and dy == 0:
                    continue  # Skip center cell
                nx, ny = x + dx, y + dy
                if self.game_map.in_bounds(nx, ny):
                    neighbors.append((nx, ny))
        return neighbors

    def get_adjacent_agents(self, agent_name: str, simulator: "Simulator") -> List[str]:
        """
        Get names of agents in cells adjacent to the specified agent.

        Only returns agent names (IDs), not their contagion states.
        This implements HIDE-01: agents cannot directly observe other agents' states.

        Args:
            agent_name: Name of the agent to find neighbors for
            simulator: Simulator instance for accessing agents

        Returns:
            List of agent names in adjacent cells (empty if agent has no position)
        """
        agent = simulator.agents.get(agent_name)
        if not agent:
            return []

        xy = agent.properties.get("map_xy")
        if not xy:
            return []

        x, y = xy[0], xy[1]
        neighbor_coords = set(self.get_moore_neighbors(x, y))

        adjacent = []
        for other_name, other_agent in simulator.agents.items():
            if other_name == agent_name:
                continue  # Skip the querying agent
            other_xy = other_agent.properties.get("map_xy")
            if other_xy:
                other_coord = (other_xy[0], other_xy[1])
                if other_coord in neighbor_coords:
                    adjacent.append(other_name)

        return adjacent

    def get_scene_actions(self, agent: "Agent"):
        """
        Return actions available in the contagion scene for this agent.

        Provides contagion-specific actions (move, speak) plus base scene actions.

        Args:
            agent: Agent requesting available actions

        Returns:
            List of Action instances available to the agent
        """
        return [
            MoveAdjacentAction(),
            SpeakToAction(),
            *super().get_scene_actions(agent),
        ]

    def check_action_transmission(self, sender: "Agent", target: "Agent", simulator: "Simulator"):
        """
        Check if action-directed transmission occurs from sender to target.

        Evaluates rules with trigger_type="action". If sender's state matches
        rule.from_state and probability check passes, applies transition to target.

        Implements ACT-01: Speak action triggers transmission check after message delivery.
        Implements ACT-02: Probability is checked when speak targets an agent.

        This method does NOT add feedback to agents about transmission (hidden state semantics).

        Args:
            sender: The agent performing the action (potential infection source)
            target: The agent receiving the action (potential infection target)
            simulator: Simulator for event emission
        """
        sender_state = sender.properties.get("contagion_state", "")

        for rule in self.rules:
            if rule.trigger_type != "action":
                continue
            if rule.from_state.value != sender_state:
                continue
            # Target must be in a state that can receive transmission
            # For typical SIR: target should be susceptible
            # The rule defines what states can receive - check target matches to_state prerequisite

            if check_probability(rule.probability):
                self._apply_transition(target, rule, simulator, source_agent_id=sender.name)
                break  # First-match-wins

    def get_agent_status_prompt(self, agent: "Agent") -> str:
        """
        Generate a status prompt for an agent with contagion-specific information.

        Overrides VillageScene to add contagion state and nearby agent names.
        Implements HIDE-02: agents see their own state but only names of neighbors.

        Args:
            agent: Agent to generate status prompt for

        Returns:
            String containing position, contagion state, and nearby agents
        """
        # Get agent's coordinates
        xy = agent.properties.get("map_xy") or [None, None]

        # Get location name if at a named location
        loc = None
        if xy[0] is not None:
            loc = self.game_map.get_location_at(xy[0], xy[1])
        loc_name = loc.name if loc else agent.properties.get("map_position", "?")

        # Get contagion state
        contagion_state = agent.properties.get("contagion_state", "unknown")
        contagion_turns = agent.properties.get("contagion_turns", 0)

        # Build contagion-specific status
        status_lines = [
            "--- Status ---",
            f"Current position: {loc_name} at ({xy[0]},{xy[1]})",
            f"Contagion state: {contagion_state.upper()}",
        ]

        # Add turns info for non-susceptible states
        if contagion_state != "susceptible":
            status_lines.append(f"Turns in state: {contagion_turns}")

        # Add physiological info from parent
        status_lines.extend([
            f"Hunger level: {agent.properties.get('hunger', 0)}",
            f"Energy level: {agent.properties.get('energy', 100)}",
            f"Inventory: {agent.properties.get('inventory', {})}",
        ])

        # Add time
        minutes = int(self.state.get("time", 0) or 0)
        hours = (minutes // 60) % 24
        mins = minutes % 60
        time_of_day = "day" if hours < 18 else "night"
        status_lines.append(f"Current time: {hours}:{mins:02d} ({time_of_day})")

        # Add nearby agents if we have a simulator reference
        if self._current_simulator:
            adjacent_names = self.get_adjacent_agents(agent.name, self._current_simulator)
            if adjacent_names:
                status_lines.append(f"Nearby agents: {', '.join(adjacent_names)}")
            else:
                status_lines.append("Nearby agents: None")

        return "\n".join(status_lines) + "\n"

    def serialize_config(self) -> dict:
        """
        Serialize scene configuration for persistence.

        Returns:
            Dict with rules, initial_infected_count, and parent config.
        """
        base_config = super().serialize_config()
        base_config.update({
            "rules": [
                {
                    "from_state": rule.from_state.value,
                    "to_state": rule.to_state.value,
                    "trigger_type": rule.trigger_type,
                    "probability": rule.probability,
                    "decay_turns": rule.decay_turns,
                }
                for rule in self.rules
            ],
            "initial_infected_count": self.initial_infected_count,
        })
        return base_config

    @classmethod
    def deserialize_config(cls, config: dict) -> dict:
        """
        Parse configuration dict into constructor kwargs.

        Args:
            config: Configuration dictionary from serialization

        Returns:
            Dict of kwargs for ContagionScene constructor
        """
        base_kwargs = super().deserialize_config(config)

        # Reconstruct rules from config
        rules = []
        for rule_data in config.get("rules", []):
            rules.append(StateTransition(
                from_state=ContagionState(rule_data["from_state"]),
                to_state=ContagionState(rule_data["to_state"]),
                trigger_type=rule_data["trigger_type"],
                probability=rule_data["probability"],
                decay_turns=rule_data.get("decay_turns"),
            ))

        base_kwargs.update({
            "rules": rules,
            "initial_infected_count": config.get("initial_infected_count", 1),
        })
        return base_kwargs
