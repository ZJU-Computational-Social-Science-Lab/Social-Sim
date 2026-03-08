"""
Integration tests for grid positioning with hidden states.

Tests end-to-end flow with multiple agents on grid, verifying that agents
see adjacent neighbors (IDs only) while contagion states remain
hidden from other agents.
"""
import pytest
from unittest.mock import MagicMock

from socialsim4.core.contagion import ContagionState, StateTransition
from socialsim4.core.contagion.scene import ContagionScene
from socialsim4.core.scenes.village_scene import GameMap


class TestGridPositioningWithHiddenStates:
    """Integration tests for grid positioning with hidden state semantics."""

    def test_full_scenario_multiple_agents_on_grid(self):
        """Test full scenario with multiple agents on grid."""
        game_map = GameMap(20, 20)
        rules = [
            StateTransition(
                from_state=ContagionState.INFECTED,
                to_state=ContagionState.RECOVERED,
                trigger_type="decay",
                probability=1.0,
                decay_turns=5
            )
        ]

        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules,
            initial_infected_count=1
        )

        # Create 5 agents with positions
        agents = {}
        positions = [(5, 5), (6, 5), (10, 10), (0, 0), (15, 15)]
        for i, (x, y) in enumerate(positions):
            agent = MagicMock()
            agent.name = f"agent_{i}"
            agent.properties = {
                "map_xy": [x, y],
                "hunger": 0,
                "energy": 100,
                "inventory": {}
            }
            agents[agent.name] = agent

        simulator = MagicMock()
        simulator.agents = agents
        simulator.turns = 0
        simulator.emit_event_later = MagicMock()

        # Run pre_run to initialize states
        scene.pre_run(simulator)

        # Verify all agents have valid map_xy
        for agent in agents.values():
            assert "map_xy" in agent.properties
            assert len(agent.properties["map_xy"]) == 2

        # Verify all agents have contagion_state set
        for agent in agents.values():
            assert "contagion_state" in agent.properties
            assert agent.properties["contagion_state"] in ["susceptible", "infected"]

    def test_adjacent_agents_detection(self):
        """Test that agents can detect adjacent agents."""
        game_map = GameMap(20, 20)
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=[],
            initial_infected_count=1
        )

        # Create agents in known positions
        center_agent = MagicMock()
        center_agent.name = "center"
        center_agent.properties = {
            "map_xy": [10, 10],
            "hunger": 0,
            "energy": 100,
            "inventory": {}
        }

        adjacent_agent = MagicMock()
        adjacent_agent.name = "adjacent"
        adjacent_agent.properties = {
            "map_xy": [11, 10],  # Adjacent to center
            "hunger": 0,
            "energy": 100,
            "inventory": {}
        }

        far_agent = MagicMock()
        far_agent.name = "far"
        far_agent.properties = {
            "map_xy": [0, 0],  # Far from center
            "hunger": 0,
            "energy": 100,
            "inventory": {}
        }

        agents = {
            "center": center_agent,
            "adjacent": adjacent_agent,
            "far": far_agent
        }

        simulator = MagicMock()
        simulator.agents = agents
        simulator.emit_event_later = MagicMock()

        scene.pre_run(simulator)

        # Get adjacent agents for center
        adjacent_names = scene.get_adjacent_agents("center", simulator)

        # Verify only adjacent agent is in the list
        assert "adjacent" in adjacent_names
        assert "far" not in adjacent_names
        assert "center" not in adjacent_names  # Self not included

    def test_status_prompt_integration(self):
        """Test status prompt integration with hidden states."""
        game_map = GameMap(20, 20)
        game_map.add_location("center", 10, 10)

        rules = [
            StateTransition(
                from_state=ContagionState.INFECTED,
                to_state=ContagionState.RECOVERED,
                trigger_type="decay",
                probability=1.0,
                decay_turns=5
            )
        ]
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules,
            initial_infected_count=1
        )

        # Create infected agent at center
        infected_agent = MagicMock()
        infected_agent.name = "infected_agent"
        infected_agent.properties = {
            "map_xy": [10, 10],
            "hunger": 0,
            "energy": 100,
            "inventory": {}
        }

        # Create susceptible agent adjacent
        neighbor_agent = MagicMock()
        neighbor_agent.name = "neighbor"
        neighbor_agent.properties = {
            "map_xy": [11, 10],
            "hunger": 0,
            "energy": 100,
            "inventory": {}
        }

        agents = {
            "infected_agent": infected_agent,
            "neighbor": neighbor_agent
        }

        simulator = MagicMock()
        simulator.agents = agents
        simulator.emit_event_later = MagicMock()

        scene.pre_run(simulator)

        # Manually set states for predictable test
        infected_agent.properties["contagion_state"] = "infected"
        infected_agent.properties["contagion_turns"] = 2
        neighbor_agent.properties["contagion_state"] = "susceptible"
        neighbor_agent.properties["contagion_turns"] = 0

        # Get status prompt for infected agent
        prompt = scene.get_agent_status_prompt(infected_agent)

        # Verify prompt contains own state
        assert "INFECTED" in prompt
        assert "Turns in state: 2" in prompt

        # Verify prompt contains adjacent agent name
        assert "neighbor" in prompt

        # Verify prompt does NOT contain other agent's state
        assert "susceptible" not in prompt
        assert "neighbor is susceptible" not in prompt.lower()

    def test_frontend_data_emission(self):
        """Test frontend data emission with all agent states."""
        game_map = GameMap(20, 20)
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=[],
            initial_infected_count=1
        )

        # Create agents with different states
        agents = {}
        state_assignments = [
            ("alice", "susceptible", [5, 5]),
            ("bob", "infected", [10, 10]),
            ("charlie", "recovered", [15, 15]),
        ]

        for name, state, pos in state_assignments:
            agent = MagicMock()
            agent.name = name
            agent.properties = {
                "map_xy": pos,
                "hunger": 0,
                "energy": 100,
                "inventory": {}
            }
            agents[name] = agent

        simulator = MagicMock()
        simulator.agents = agents
        simulator.turns = 0

        # Track emit_event_later calls
        emitted_events = []

        def capture_event(event_type, data):
            emitted_events.append({"type": event_type, "data": data})

        simulator.emit_event_later = capture_event

        scene.pre_run(simulator)

        # After pre_run, manually set states for test
        agents["alice"].properties["contagion_state"] = "susceptible"
        agents["bob"].properties["contagion_state"] = "infected"
        agents["charlie"].properties["contagion_state"] = "recovered"

        # Update statistics
        scene._update_statistics(simulator)

        # Verify contagion_stats was emitted
        stats_events = [e for e in emitted_events if e["type"] == "contagion_stats"]
        assert len(stats_events) >= 1

        # Get the most recent stats event
        stats_event = stats_events[-1]
        agent_states = stats_event["data"]["agent_states"]
        counts = stats_event["data"]["counts"]

        # Verify agent_states contains all agents
        assert len(agent_states) == 3
        assert set(agent_states.keys()) == {"alice", "bob", "charlie"}

        # Verify counts match actual distribution
        assert counts.get("susceptible", 0) == 1
        assert counts.get("infected", 0) == 1
        assert counts.get("recovered", 0) == 1
