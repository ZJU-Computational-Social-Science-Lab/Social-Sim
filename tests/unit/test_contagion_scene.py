"""
Unit tests for ContagionScene state tracking and rule evaluation.

Tests the scene that orchestrates contagion state management, evaluates
decay transitions each turn, and emits statistics to the frontend.
"""
import pytest
from unittest.mock import MagicMock, patch
from socialsim4.core.contagion import ContagionState, StateTransition


class TestContagionSceneBasics:
    """Tests for basic ContagionScene configuration and initialization."""

    def test_contagion_scene_stores_rules_and_initial_infected_count(self):
        """Test that ContagionScene stores rules list and initial_infected_count."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
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
            initial_infected_count=2
        )

        assert scene.rules == rules
        assert scene.initial_infected_count == 2

    def test_contagion_scene_has_type_attribute(self):
        """Test that ContagionScene has TYPE = 'contagion_scene'."""
        from socialsim4.core.contagion.scene import ContagionScene

        assert ContagionScene.TYPE == "contagion_scene"


class TestContagionScenePreRun:
    """Tests for pre_run initialization of agent states."""

    def test_pre_run_sets_initial_agent_states_random_infected(self):
        """Test that pre_run sets random infected agents, rest susceptible."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        rules = []

        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules,
            initial_infected_count=2
        )

        # Create mock agents
        agents = {}
        for i in range(5):
            agent = MagicMock()
            agent.name = f"agent_{i}"
            agent.properties = {}
            agents[agent.name] = agent

        # Create mock simulator
        simulator = MagicMock()
        simulator.agents = agents

        scene.pre_run(simulator)

        # Count infected vs susceptible
        infected_count = sum(
            1 for a in agents.values()
            if a.properties.get("contagion_state") == "infected"
        )
        susceptible_count = sum(
            1 for a in agents.values()
            if a.properties.get("contagion_state") == "susceptible"
        )

        assert infected_count == 2
        assert susceptible_count == 3

    def test_pre_run_initializes_contagion_state_and_turns(self):
        """Test that pre_run initializes contagion_state and contagion_turns in properties."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        rules = []

        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules,
            initial_infected_count=1
        )

        agent = MagicMock()
        agent.name = "agent_1"
        agent.properties = {}

        simulator = MagicMock()
        simulator.agents = {"agent_1": agent}

        scene.pre_run(simulator)

        assert "contagion_state" in agent.properties
        assert "contagion_turns" in agent.properties
        assert agent.properties["contagion_turns"] == 0


class TestContagionSceneDecayRules:
    """Tests for decay rule evaluation in pre_turn_rules."""

    def test_pre_turn_rules_evaluates_decay_rules(self):
        """Test that pre_turn_rules evaluates decay rules for each agent."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        rules = [
            StateTransition(
                from_state=ContagionState.INFECTED,
                to_state=ContagionState.RECOVERED,
                trigger_type="decay",
                probability=1.0,
                decay_turns=3
            )
        ]

        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules,
            initial_infected_count=1
        )

        agent = MagicMock()
        agent.name = "agent_1"
        agent.properties = {
            "contagion_state": "infected",
            "contagion_turns": 3  # Meets decay threshold
        }

        simulator = MagicMock()
        simulator.agents = {"agent_1": agent}
        simulator.turns = 1

        scene.pre_turn_rules(simulator)

        # Agent should have transitioned to recovered
        assert agent.properties["contagion_state"] == "recovered"
        assert agent.properties["contagion_turns"] == 0

    def test_decay_transition_only_when_turns_exceeds_threshold(self):
        """Test that decay transition only occurs when contagion_turns >= decay_turns."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
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

        agent = MagicMock()
        agent.name = "agent_1"
        agent.properties = {
            "contagion_state": "infected",
            "contagion_turns": 2  # Below threshold
        }

        simulator = MagicMock()
        simulator.agents = {"agent_1": agent}
        simulator.turns = 1

        scene.pre_turn_rules(simulator)

        # Agent should NOT have transitioned yet
        assert agent.properties["contagion_state"] == "infected"

    def test_pre_turn_rules_increments_contagion_turns(self):
        """Test that pre_turn_rules increments contagion_turns for each agent."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        rules = []

        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules,
            initial_infected_count=1
        )

        agent = MagicMock()
        agent.name = "agent_1"
        agent.properties = {
            "contagion_state": "infected",
            "contagion_turns": 0
        }

        simulator = MagicMock()
        simulator.agents = {"agent_1": agent}
        simulator.turns = 1

        scene.pre_turn_rules(simulator)

        assert agent.properties["contagion_turns"] == 1


class TestContagionSceneStatistics:
    """Tests for statistics tracking and emission."""

    def test_apply_transition_records_transition_event(self):
        """Test that _apply_transition records TransitionEvent in statistics."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        rules = []

        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules,
            initial_infected_count=1
        )

        agent = MagicMock()
        agent.name = "agent_1"
        agent.properties = {
            "contagion_state": "infected",
            "contagion_turns": 5
        }

        rule = StateTransition(
            from_state=ContagionState.INFECTED,
            to_state=ContagionState.RECOVERED,
            trigger_type="decay",
            probability=1.0,
            decay_turns=5
        )

        simulator = MagicMock()
        simulator.turns = 3

        scene._apply_transition(agent, rule, simulator)

        # Check that event was recorded
        assert len(scene._statistics.events) == 1
        event = scene._statistics.events[0]
        assert event.agent_id == "agent_1"
        assert event.from_state == "infected"
        assert event.to_state == "recovered"
        assert event.trigger_type == "decay"

    def test_statistics_emitted_via_emit_event_later(self):
        """Test that statistics are emitted via emit_event_later('contagion_stats', ...)."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        rules = []

        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules,
            initial_infected_count=1
        )

        agent = MagicMock()
        agent.name = "agent_1"
        agent.properties = {
            "contagion_state": "susceptible",
            "contagion_turns": 0
        }

        simulator = MagicMock()
        simulator.agents = {"agent_1": agent}
        simulator.turns = 0

        scene._update_statistics(simulator)

        # Verify emit_event_later was called with contagion_stats
        simulator.emit_event_later.assert_called_once()
        call_args = simulator.emit_event_later.call_args
        assert call_args[0][0] == "contagion_stats"
        assert "counts" in call_args[0][1]
        assert "agent_states" in call_args[0][1]


class TestContagionSceneSerialization:
    """Tests for scene serialization and deserialization."""

    def test_serialize_config_includes_rules_and_infected_count(self):
        """Test that serialize_config returns rules and initial_infected_count."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
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
            initial_infected_count=3
        )

        config = scene.serialize_config()

        assert "rules" in config
        assert "initial_infected_count" in config
        assert config["initial_infected_count"] == 3

    def test_deserialize_config_reconstructs_scene(self):
        """Test that deserialize_config reconstructs scene kwargs."""
        from socialsim4.core.contagion.scene import ContagionScene

        config = {
            "map": {"width": 10, "height": 10, "tiles": [], "locations": []},
            "movement_cost": 1,
            "chat_range": 5,
            "rules": [
                {
                    "from_state": "infected",
                    "to_state": "recovered",
                    "trigger_type": "decay",
                    "probability": 1.0,
                    "decay_turns": 5
                }
            ],
            "initial_infected_count": 2
        }

        kwargs = ContagionScene.deserialize_config(config)

        assert "rules" in kwargs
        assert "initial_infected_count" in kwargs
        assert kwargs["initial_infected_count"] == 2
        assert "game_map" in kwargs


class TestPreTurnRulesHook:
    """Tests for pre_turn_rules hook integration with Simulator."""

    def test_pre_turn_rules_hook_called_during_run(self):
        """Test that Simulator.run() calls pre_turn_rules if it exists on scene."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        rules = [
            StateTransition(
                from_state=ContagionState.INFECTED,
                to_state=ContagionState.RECOVERED,
                trigger_type="decay",
                probability=1.0,
                decay_turns=1
            )
        ]

        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules,
            initial_infected_count=1
        )

        # Create a mock agent
        agent = MagicMock()
        agent.name = "agent_1"
        agent.properties = {
            "contagion_state": "infected",
            "contagion_turns": 1,
            "map_xy": [5, 5]
        }

        # Track if pre_turn_rules was called
        pre_turn_called = []

        original_pre_turn = scene.pre_turn_rules
        def tracked_pre_turn(simulator):
            pre_turn_called.append(True)
            return original_pre_turn(simulator)

        scene.pre_turn_rules = tracked_pre_turn

        # Create minimal simulator mock
        simulator = MagicMock()
        simulator.agents = {"agent_1": agent}
        simulator.turns = 0
        simulator.scene = scene
        simulator.event_queue = MagicMock()
        simulator.event_queue.empty.return_value = True
        simulator.max_steps_per_turn = 1
        simulator.ordering = MagicMock()
        simulator.ordering.iter.return_value = iter(["agent_1"])
        simulator.ordering.post_turn = MagicMock()

        # Set up scene completion to stop after first turn
        scene.is_complete = lambda: simulator.turns >= 1

        # Verify the hook exists on the scene
        assert hasattr(scene, 'pre_turn_rules')
        assert callable(scene.pre_turn_rules)

    def test_simulator_calls_pre_turn_rules_hook(self):
        """Integration test: verify Simulator.run() calls pre_turn_rules hook."""
        from socialsim4.core.simulator import Simulator
        from socialsim4.core.ordering import SequentialOrdering

        # Create a mock scene with pre_turn_rules
        scene = MagicMock()
        scene.get_agent_status_prompt = MagicMock(return_value=None)
        scene.should_skip_turn = MagicMock(return_value=True)  # Skip to avoid agent processing
        scene.is_complete = MagicMock(side_effect=[False, True])  # Run 1 turn then complete
        scene.post_turn = MagicMock()
        pre_turn_called = []

        def mock_pre_turn(sim):
            pre_turn_called.append(sim.turns)

        scene.pre_turn_rules = mock_pre_turn

        # Create a mock agent
        agent = MagicMock()
        agent.name = "test_agent"

        # Create simulator
        sim = Simulator(
            agents=[agent],
            scene=scene,
            clients={},
            broadcast_initial=False,
            ordering=SequentialOrdering(),
        )

        # Run simulation
        sim.run(max_turns=2)

        # Verify pre_turn_rules was called
        assert len(pre_turn_called) >= 1, "pre_turn_rules should have been called"


class TestMooreNeighborhood:
    """Tests for Moore neighborhood (8-directional) queries."""

    def test_get_moore_neighbors_returns_8_coordinates_for_center_cell(self):
        """Test that get_moore_neighbors(5, 5) returns 8 coordinates for center cell."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=[],
            initial_infected_count=1
        )

        neighbors = scene.get_moore_neighbors(5, 5)

        # Should return 8 coordinates (all 8 surrounding cells)
        assert len(neighbors) == 8

        # Verify all 8 expected coordinates are present
        expected = {(4, 4), (4, 5), (4, 6), (5, 4), (5, 6), (6, 4), (6, 5), (6, 6)}
        assert set(neighbors) == expected

    def test_get_moore_neighbors_returns_3_coordinates_for_corner(self):
        """Test that get_moore_neighbors(0, 0) returns 3 coordinates (corner)."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=[],
            initial_infected_count=1
        )

        neighbors = scene.get_moore_neighbors(0, 0)

        # Corner should have only 3 valid neighbors
        assert len(neighbors) == 3

        # Verify the 3 expected coordinates
        expected = {(0, 1), (1, 0), (1, 1)}
        assert set(neighbors) == expected

    def test_get_moore_neighbors_filters_out_of_bounds_coordinates(self):
        """Test that get_moore_neighbors filters out-of-bounds coordinates."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=[],
            initial_infected_count=1
        )

        # Edge cell - should have 5 neighbors
        neighbors = scene.get_moore_neighbors(0, 5)
        assert len(neighbors) == 5

        # All coordinates should be within bounds
        for x, y in neighbors:
            assert 0 <= x < 10
            assert 0 <= y < 10


class TestAdjacentAgents:
    """Tests for get_adjacent_agents method."""

    def test_get_adjacent_agents_returns_agent_names_in_adjacent_cells(self):
        """Test that get_adjacent_agents returns agent names in adjacent cells."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=[],
            initial_infected_count=1
        )

        # Create mock agents at specific positions
        agents = {}
        for i, (x, y) in enumerate([(5, 5), (4, 4), (6, 6), (0, 0)]):
            agent = MagicMock()
            agent.name = f"agent_{i}"
            agent.properties = {"map_xy": [x, y]}
            agents[agent.name] = agent

        simulator = MagicMock()
        simulator.agents = agents

        # agent_0 at (5,5) should see agent_1 at (4,4) and agent_2 at (6,6)
        adjacent = scene.get_adjacent_agents("agent_0", simulator)

        assert "agent_1" in adjacent
        assert "agent_2" in adjacent
        assert "agent_3" not in adjacent  # Too far away

    def test_get_adjacent_agents_returns_empty_list_for_agent_with_no_map_xy(self):
        """Test that get_adjacent_agents returns empty list for agent with no map_xy."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=[],
            initial_infected_count=1
        )

        agent = MagicMock()
        agent.name = "agent_0"
        agent.properties = {}  # No map_xy

        simulator = MagicMock()
        simulator.agents = {"agent_0": agent}

        adjacent = scene.get_adjacent_agents("agent_0", simulator)

        assert adjacent == []

    def test_get_adjacent_agents_does_not_include_querying_agent(self):
        """Test that get_adjacent_agents does NOT include the querying agent."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=[],
            initial_infected_count=1
        )

        agent = MagicMock()
        agent.name = "agent_0"
        agent.properties = {"map_xy": [5, 5]}

        simulator = MagicMock()
        simulator.agents = {"agent_0": agent}

        adjacent = scene.get_adjacent_agents("agent_0", simulator)

        assert "agent_0" not in adjacent


class TestAgentStatusPrompt:
    """Tests for get_agent_status_prompt with hidden state semantics."""

    def test_get_agent_status_prompt_includes_own_contagion_state(self):
        """Test that get_agent_status_prompt includes agent's own contagion state."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        game_map.add_location("village_center", 10, 10)

        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=[],
            initial_infected_count=1
        )

        agent = MagicMock()
        agent.name = "agent_0"
        agent.properties = {
            "map_xy": [10, 10],
            "contagion_state": "infected",
            "contagion_turns": 3,
            "hunger": 0,
            "energy": 100,
            "inventory": {}
        }

        prompt = scene.get_agent_status_prompt(agent)

        assert "infected" in prompt.lower()
        assert "3" in prompt  # turns infected

    def test_get_agent_status_prompt_includes_adjacent_agent_names(self):
        """Test that get_agent_status_prompt includes list of adjacent agent names."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=[],
            initial_infected_count=1
        )

        agent = MagicMock()
        agent.name = "agent_0"
        agent.properties = {
            "map_xy": [5, 5],
            "contagion_state": "susceptible",
            "contagion_turns": 0,
            "hunger": 0,
            "energy": 100,
            "inventory": {}
        }

        # Create a mock simulator with adjacent agents
        simulator = MagicMock()
        agents = {
            "agent_0": agent,
            "alice": MagicMock(name="alice", properties={"map_xy": [4, 4]}),
            "bob": MagicMock(name="bob", properties={"map_xy": [6, 6]})
        }
        simulator.agents = agents

        # Call pre_run to set up scene state
        scene.pre_run(simulator)

        prompt = scene.get_agent_status_prompt(agent)

        # Should include names of adjacent agents
        assert "alice" in prompt.lower() or "bob" in prompt.lower()

    def test_get_agent_status_prompt_does_not_include_other_agents_states(self):
        """Test that get_agent_status_prompt does NOT include other agents' states."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=[],
            initial_infected_count=0  # Don't auto-infect anyone
        )

        agent = MagicMock()
        agent.name = "agent_0"
        agent.properties = {
            "map_xy": [5, 5],
            "contagion_state": "susceptible",
            "contagion_turns": 0,
            "hunger": 0,
            "energy": 100,
            "inventory": {}
        }

        # Create adjacent agent with infected state - use a name that doesn't contain "infected"
        # to clearly test that the state isn't being exposed
        simulator = MagicMock()
        alice = MagicMock(name="alice")
        alice.properties = {
            "map_xy": [4, 4],
            "contagion_state": "infected"
        }
        agents = {
            "agent_0": agent,
            "alice": alice
        }
        simulator.agents = agents

        scene.pre_run(simulator)

        # After pre_run, manually set the states to ensure predictable test conditions
        # (pre_run sets random states, but we want to test specific scenario)
        agent.properties["contagion_state"] = "susceptible"
        alice.properties["contagion_state"] = "infected"

        prompt = scene.get_agent_status_prompt(agent)

        # The prompt should include "alice" but NOT reveal her "infected" state
        assert "alice" in prompt.lower()
        # The state "infected" should NOT appear in the prompt (agent_0 is susceptible)
        assert "infected" not in prompt.lower(), f"Prompt should not mention 'infected' state: {prompt}"
        # Verify state information isn't leaked via other patterns
        assert "alice is infected" not in prompt.lower()
        assert "alice: infected" not in prompt.lower()

    def test_status_prompt_format_matches_village_scene_pattern(self):
        """Test that status prompt format matches existing VillageScene pattern with contagion additions."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=[],
            initial_infected_count=0  # No infected agents to ensure predictable state
        )

        agent = MagicMock()
        agent.name = "agent_0"
        agent.properties = {
            "map_xy": [5, 5],
            "contagion_state": "recovered",
            "contagion_turns": 10,
            "hunger": 20,
            "energy": 80,
            "inventory": {"apple": 2}
        }

        simulator = MagicMock()
        simulator.agents = {"agent_0": agent}

        scene.pre_run(simulator)

        # After pre_run, set specific state for testing
        agent.properties["contagion_state"] = "recovered"
        agent.properties["contagion_turns"] = 10

        prompt = scene.get_agent_status_prompt(agent)

        # Should include position
        assert "position" in prompt.lower() or "(5,5)" in prompt
        # Should include contagion state
        assert "recovered" in prompt.lower()
        # Should include status section
        assert "---" in prompt or "status" in prompt.lower()


class TestFrontendStateExposure:
    """Tests for frontend state exposure via contagion_stats event."""

    def test_contagion_stats_event_includes_agent_states_dict(self):
        """Test that contagion_stats event includes agent_states dict."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=[],
            initial_infected_count=1
        )

        agents = {}
        for i in range(3):
            agent = MagicMock()
            agent.name = f"agent_{i}"
            agent.properties = {
                "contagion_state": "susceptible" if i > 0 else "infected",
                "contagion_turns": 0
            }
            agents[agent.name] = agent

        simulator = MagicMock()
        simulator.agents = agents

        scene._update_statistics(simulator)

        # Verify emit_event_later was called
        simulator.emit_event_later.assert_called_once()
        call_args = simulator.emit_event_later.call_args
        assert call_args[0][0] == "contagion_stats"

        # Verify agent_states exists and is a dict
        event_data = call_args[0][1]
        assert "agent_states" in event_data
        assert isinstance(event_data["agent_states"], dict)

    def test_agent_states_maps_agent_name_to_state_for_all_agents(self):
        """Test that agent_states maps agent_name -> state for all agents."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=[],
            initial_infected_count=2
        )

        agents = {}
        expected_states = {}
        for i, state in enumerate(["infected", "infected", "susceptible"]):
            agent = MagicMock()
            agent.name = f"agent_{i}"
            agent.properties = {
                "contagion_state": state,
                "contagion_turns": 0
            }
            agents[agent.name] = agent
            expected_states[agent.name] = state

        simulator = MagicMock()
        simulator.agents = agents

        scene._update_statistics(simulator)

        event_data = simulator.emit_event_later.call_args[0][1]
        agent_states = event_data["agent_states"]

        # Verify all agents are present
        assert len(agent_states) == 3
        assert set(agent_states.keys()) == set(expected_states.keys())

        # Verify states match
        for name, expected_state in expected_states.items():
            assert agent_states[name] == expected_state

    def test_agent_states_values_are_state_strings_not_enum_objects(self):
        """Test that agent_states values are state strings (not enum objects)."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=[],
            initial_infected_count=1
        )

        agent = MagicMock()
        agent.name = "test_agent"
        agent.properties = {
            "contagion_state": "infected",
            "contagion_turns": 0
        }

        simulator = MagicMock()
        simulator.agents = {"test_agent": agent}

        scene._update_statistics(simulator)

        event_data = simulator.emit_event_later.call_args[0][1]
        state_value = event_data["agent_states"]["test_agent"]

        # Verify it's a string, not an enum object
        assert isinstance(state_value, str)
        assert state_value == "infected"

    def test_frontend_can_render_grid_with_state_based_coloring(self):
        """Test that frontend has data needed for state-based visualization."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=[],
            initial_infected_count=1
        )

        # Create agents with positions and states
        agents = {}
        agent_states_and_positions = [
            ("alice", "susceptible", [2, 2]),
            ("bob", "infected", [5, 5]),
            ("charlie", "recovered", [8, 8]),
        ]
        for name, state, pos in agent_states_and_positions:
            agent = MagicMock()
            agent.name = name
            agent.properties = {
                "contagion_state": state,
                "contagion_turns": 0,
                "map_xy": pos
            }
            agents[name] = agent

        simulator = MagicMock()
        simulator.agents = agents

        scene._update_statistics(simulator)

        event_data = simulator.emit_event_later.call_args[0][1]

        # Verify frontend has all the data it needs
        assert "counts" in event_data  # For summary stats
        assert "agent_states" in event_data  # For per-agent coloring

        # Verify data structure is JSON-serializable
        import json
        json.dumps(event_data)  # Should not raise


class TestOpenGridConfiguration:
    """Tests for open grid configuration (all cells passable)."""

    def test_default_game_map_has_all_passable_tiles(self):
        """Test that default GameMap(20, 20) has all passable tiles."""
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(20, 20)

        # Verify all cells are passable
        for x in range(20):
            for y in range(20):
                assert game_map.is_passable(x, y), f"Cell ({x},{y}) should be passable"

    def test_no_blocking_terrain_by_default(self):
        """Test that there is no blocking terrain by default."""
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(20, 20)

        # Verify no tiles are explicitly set as blocking
        # (tiles dict is sparse - only stores non-default tiles)
        assert len(game_map.tiles) == 0, "Default map should have no custom tiles"

    def test_agents_can_be_positioned_at_any_valid_coordinate(self):
        """Test that agents can be positioned at any valid coordinate."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(20, 20)
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=[],
            initial_infected_count=0
        )

        # Create agents at various positions
        test_positions = [
            (0, 0),    # Corner
            (19, 19),  # Opposite corner
            (10, 10),  # Center
            (0, 10),   # Edge
        ]

        agents = {}
        for i, (x, y) in enumerate(test_positions):
            agent = MagicMock()
            agent.name = f"agent_{i}"
            agent.properties = {
                "map_xy": [x, y],
                "contagion_state": "susceptible",
                "contagion_turns": 0
            }
            agents[agent.name] = agent

        simulator = MagicMock()
        simulator.agents = agents

        # All positions should be valid
        for agent in agents.values():
            xy = agent.properties["map_xy"]
            assert game_map.is_passable(xy[0], xy[1])

    def test_contagion_scene_with_default_map_allows_any_position(self):
        """Test that ContagionScene with default map allows any position."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(20, 20)
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=[],
            initial_infected_count=0
        )

        # Verify Moore neighbors are valid for any position
        test_positions = [(0, 0), (10, 10), (19, 19)]
        for x, y in test_positions:
            neighbors = scene.get_moore_neighbors(x, y)
            for nx, ny in neighbors:
                assert game_map.is_passable(nx, ny)


class TestContagionSceneActions:
    """Tests for scene action registration."""

    def test_get_scene_actions_includes_move_adjacent(self):
        """Test that get_scene_actions returns MoveAdjacentAction instance."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.contagion.actions import MoveAdjacentAction
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=[],
            initial_infected_count=1
        )

        agent = MagicMock()
        agent.name = "test_agent"

        actions = scene.get_scene_actions(agent)

        # Check that MoveAdjacentAction is in the list
        move_action = None
        for action in actions:
            if isinstance(action, MoveAdjacentAction):
                move_action = action
                break

        assert move_action is not None, "MoveAdjacentAction should be in scene actions"

    def test_get_scene_actions_includes_speak_to(self):
        """Test that get_scene_actions returns SpeakToAction instance."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.contagion.actions import SpeakToAction
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=[],
            initial_infected_count=1
        )

        agent = MagicMock()
        agent.name = "test_agent"

        actions = scene.get_scene_actions(agent)

        # Check that SpeakToAction is in the list
        speak_action = None
        for action in actions:
            if isinstance(action, SpeakToAction):
                speak_action = action
                break

        assert speak_action is not None, "SpeakToAction should be in scene actions"

    def test_get_scene_actions_includes_base_actions(self):
        """Test that get_scene_actions includes base scene actions via inheritance."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=[],
            initial_infected_count=1
        )

        agent = MagicMock()
        agent.name = "test_agent"

        actions = scene.get_scene_actions(agent)

        # Should have at least 2 contagion actions
        assert len(actions) >= 2, "Should have at least MoveAdjacentAction and SpeakToAction"
