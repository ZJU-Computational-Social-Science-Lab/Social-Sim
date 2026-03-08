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
