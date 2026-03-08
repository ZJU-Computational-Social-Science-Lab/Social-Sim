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
from typing import Dict, List, Optional

from socialsim4.core.contagion.states import ContagionState
from socialsim4.core.contagion.rules import StateTransition
from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
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

    def pre_run(self, simulator: "Simulator"):
        """
        Initialize agent contagion states before simulation starts.

        Randomly selects initial_infected_count agents to be infected,
        sets all others to susceptible. Initializes contagion_turns to 0.

        Args:
            simulator: Simulator instance for accessing agents
        """
        super().pre_run(simulator)

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
        self, agent: "Agent", rule: StateTransition, simulator: "Simulator"
    ):
        """
        Apply a state transition to an agent.

        Updates the agent's contagion_state, resets contagion_turns,
        and records a TransitionEvent in statistics.

        Args:
            agent: Agent to transition
            rule: StateTransition rule being applied
            simulator: Simulator for getting current turn
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
            trigger_type=rule.trigger_type
        )
        self._statistics.record_transition(event)

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
