"""
Unit tests for proximity-based contagion transmission.

Tests the _evaluate_proximity_rules method in ContagionScene that handles
spatial adjacency-based disease/information spread between agents.
"""
import pytest
from unittest.mock import MagicMock, patch
from socialsim4.core.contagion import ContagionState, StateTransition


class TestProximityTransmissionBasics:
    """Tests for basic proximity rule evaluation."""

    def test_proximity_rules_evaluated(self):
        """Test that pre_turn_rules calls _evaluate_proximity_rules."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        rules = [
            StateTransition(
                from_state=ContagionState.SUSCEPTIBLE,
                to_state=ContagionState.INFECTED,
                trigger_type="proximity",
                probability=0.5,
            )
        ]

        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules,
            initial_infected_count=1
        )

        # Create infected and susceptible agents adjacent to each other
        infected = MagicMock()
        infected.name = "infected_agent"
        infected.properties = {
            "contagion_state": "infected",
            "contagion_turns": 1,
            "map_xy": [5, 5]
        }

        susceptible = MagicMock()
        susceptible.name = "susceptible_agent"
        susceptible.properties = {
            "contagion_state": "susceptible",
            "contagion_turns": 0,
            "map_xy": [5, 6]  # Adjacent to infected
        }

        simulator = MagicMock()
        simulator.agents = {
            "infected_agent": infected,
            "susceptible_agent": susceptible
        }
        simulator.turns = 1

        # Patch _evaluate_proximity_rules to track if it's called
        with patch.object(scene, '_evaluate_proximity_rules', wraps=scene._evaluate_proximity_rules) as mock_proximity:
            scene.pre_turn_rules(simulator)
            mock_proximity.assert_called_once_with(simulator)

    def test_proximity_probability(self):
        """Test that probability check determines transmission."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        rules = [
            StateTransition(
                from_state=ContagionState.SUSCEPTIBLE,
                to_state=ContagionState.INFECTED,
                trigger_type="proximity",
                probability=0.5,
            )
        ]

        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules,
            initial_infected_count=1
        )

        # Create infected and susceptible agents adjacent to each other
        infected = MagicMock()
        infected.name = "infected_agent"
        infected.properties = {
            "contagion_state": "infected",
            "contagion_turns": 1,
            "map_xy": [5, 5]
        }

        susceptible = MagicMock()
        susceptible.name = "susceptible_agent"
        susceptible.properties = {
            "contagion_state": "susceptible",
            "contagion_turns": 0,
            "map_xy": [5, 6]  # Adjacent to infected
        }

        simulator = MagicMock()
        simulator.agents = {
            "infected_agent": infected,
            "susceptible_agent": susceptible
        }
        simulator.turns = 1

        # Mock check_probability to return True
        with patch('socialsim4.core.contagion.scene.check_probability', return_value=True):
            scene.pre_turn_rules(simulator)

        # Susceptible agent should be infected
        assert susceptible.properties["contagion_state"] == "infected"

    def test_proximity_configurable(self):
        """Test that different probabilities produce different results."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        # Test with probability=0.0 (no spread)
        game_map = GameMap(10, 10)
        rules_zero = [
            StateTransition(
                from_state=ContagionState.SUSCEPTIBLE,
                to_state=ContagionState.INFECTED,
                trigger_type="proximity",
                probability=0.0,  # Never spreads
            )
        ]

        scene_zero = ContagionScene(
            name="test_scene_zero",
            initial_event="start",
            game_map=game_map,
            rules=rules_zero,
            initial_infected_count=1
        )

        infected = MagicMock()
        infected.name = "infected_agent"
        infected.properties = {
            "contagion_state": "infected",
            "contagion_turns": 1,
            "map_xy": [5, 5]
        }

        susceptible = MagicMock()
        susceptible.name = "susceptible_agent"
        susceptible.properties = {
            "contagion_state": "susceptible",
            "contagion_turns": 0,
            "map_xy": [5, 6]  # Adjacent to infected
        }

        simulator = MagicMock()
        simulator.agents = {
            "infected_agent": infected,
            "susceptible_agent": susceptible
        }
        simulator.turns = 1

        scene_zero.pre_turn_rules(simulator)

        # With probability=0.0, susceptible should NOT be infected
        assert susceptible.properties["contagion_state"] == "susceptible"

        # Test with probability=1.0 (always spreads)
        rules_one = [
            StateTransition(
                from_state=ContagionState.SUSCEPTIBLE,
                to_state=ContagionState.INFECTED,
                trigger_type="proximity",
                probability=1.0,  # Always spreads
            )
        ]

        scene_one = ContagionScene(
            name="test_scene_one",
            initial_event="start",
            game_map=game_map,
            rules=rules_one,
            initial_infected_count=1
        )

        infected2 = MagicMock()
        infected2.name = "infected_agent2"
        infected2.properties = {
            "contagion_state": "infected",
            "contagion_turns": 1,
            "map_xy": [5, 5]
        }

        susceptible2 = MagicMock()
        susceptible2.name = "susceptible_agent2"
        susceptible2.properties = {
            "contagion_state": "susceptible",
            "contagion_turns": 0,
            "map_xy": [5, 6]  # Adjacent to infected
        }

        simulator2 = MagicMock()
        simulator2.agents = {
            "infected_agent2": infected2,
            "susceptible_agent2": susceptible2
        }
        simulator2.turns = 1

        scene_one.pre_turn_rules(simulator2)

        # With probability=1.0, susceptible should be infected
        assert susceptible2.properties["contagion_state"] == "infected"

    def test_proximity_logging(self):
        """Test that TransitionEvent has trigger_type='proximity'."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        rules = [
            StateTransition(
                from_state=ContagionState.SUSCEPTIBLE,
                to_state=ContagionState.INFECTED,
                trigger_type="proximity",
                probability=1.0,  # Always spreads for test
            )
        ]

        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules,
            initial_infected_count=1
        )

        infected = MagicMock()
        infected.name = "infected_agent"
        infected.properties = {
            "contagion_state": "infected",
            "contagion_turns": 1,
            "map_xy": [5, 5]
        }

        susceptible = MagicMock()
        susceptible.name = "susceptible_agent"
        susceptible.properties = {
            "contagion_state": "susceptible",
            "contagion_turns": 0,
            "map_xy": [5, 6]  # Adjacent to infected
        }

        simulator = MagicMock()
        simulator.agents = {
            "infected_agent": infected,
            "susceptible_agent": susceptible
        }
        simulator.turns = 1

        scene.pre_turn_rules(simulator)

        # Check that a transition event was recorded with trigger_type='proximity'
        proximity_events = [
            e for e in scene._statistics.events
            if e.trigger_type == "proximity"
        ]
        assert len(proximity_events) >= 1, "Should have at least one proximity event"

        event = proximity_events[0]
        assert event.agent_id == "susceptible_agent"
        assert event.from_state == "susceptible"
        assert event.to_state == "infected"
        assert event.trigger_type == "proximity"


class TestProximityTransmissionEdgeCases:
    """Tests for edge cases in proximity transmission."""

    def test_proximity_bidirectional(self):
        """Test that both directions of pair are checked."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        rules = [
            StateTransition(
                from_state=ContagionState.SUSCEPTIBLE,
                to_state=ContagionState.INFECTED,
                trigger_type="proximity",
                probability=1.0,  # Always spreads
            )
        ]

        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules,
            initial_infected_count=1
        )

        # Create two agents where infected is to the LEFT of susceptible
        # This tests that the check works in both directions
        infected = MagicMock()
        infected.name = "infected_agent"
        infected.properties = {
            "contagion_state": "infected",
            "contagion_turns": 1,
            "map_xy": [5, 5]  # Left of susceptible
        }

        susceptible = MagicMock()
        susceptible.name = "susceptible_agent"
        susceptible.properties = {
            "contagion_state": "susceptible",
            "contagion_turns": 0,
            "map_xy": [6, 5]  # Right of infected
        }

        simulator = MagicMock()
        simulator.agents = {
            "infected_agent": infected,
            "susceptible_agent": susceptible
        }
        simulator.turns = 1

        scene.pre_turn_rules(simulator)

        # Susceptible should be infected regardless of which direction is checked
        assert susceptible.properties["contagion_state"] == "infected"

    def test_proximity_no_chaining(self):
        """Test that newly infected agents don't spread same turn."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        rules = [
            StateTransition(
                from_state=ContagionState.SUSCEPTIBLE,
                to_state=ContagionState.INFECTED,
                trigger_type="proximity",
                probability=1.0,  # Always spreads
            )
        ]

        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules,
            initial_infected_count=1
        )

        # Create three agents in a line: infected - susceptible1 - susceptible2
        # If chaining were allowed, susceptible2 would also get infected
        infected = MagicMock()
        infected.name = "infected_agent"
        infected.properties = {
            "contagion_state": "infected",
            "contagion_turns": 1,
            "map_xy": [5, 5]
        }

        susceptible1 = MagicMock()
        susceptible1.name = "susceptible1"
        susceptible1.properties = {
            "contagion_state": "susceptible",
            "contagion_turns": 0,
            "map_xy": [5, 6]  # Adjacent to infected
        }

        susceptible2 = MagicMock()
        susceptible2.name = "susceptible2"
        susceptible2.properties = {
            "contagion_state": "susceptible",
            "contagion_turns": 0,
            "map_xy": [5, 7]  # Adjacent to susceptible1, but NOT to infected
        }

        simulator = MagicMock()
        simulator.agents = {
            "infected_agent": infected,
            "susceptible1": susceptible1,
            "susceptible2": susceptible2
        }
        simulator.turns = 1

        scene.pre_turn_rules(simulator)

        # susceptible1 should be infected (adjacent to original infected)
        assert susceptible1.properties["contagion_state"] == "infected"

        # susceptible2 should NOT be infected (no chaining)
        assert susceptible2.properties["contagion_state"] == "susceptible"

    def test_proximity_non_adjacent_no_spread(self):
        """Test that non-adjacent agents don't spread to each other."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        rules = [
            StateTransition(
                from_state=ContagionState.SUSCEPTIBLE,
                to_state=ContagionState.INFECTED,
                trigger_type="proximity",
                probability=1.0,  # Always spreads if adjacent
            )
        ]

        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules,
            initial_infected_count=1
        )

        # Create infected and susceptible agents FAR apart
        infected = MagicMock()
        infected.name = "infected_agent"
        infected.properties = {
            "contagion_state": "infected",
            "contagion_turns": 1,
            "map_xy": [0, 0]
        }

        susceptible = MagicMock()
        susceptible.name = "susceptible_agent"
        susceptible.properties = {
            "contagion_state": "susceptible",
            "contagion_turns": 0,
            "map_xy": [9, 9]  # Far from infected
        }

        simulator = MagicMock()
        simulator.agents = {
            "infected_agent": infected,
            "susceptible_agent": susceptible
        }
        simulator.turns = 1

        scene.pre_turn_rules(simulator)

        # Susceptible should NOT be infected (not adjacent)
        assert susceptible.properties["contagion_state"] == "susceptible"

    def test_proximity_multiple_infected_sources(self):
        """Test that multiple infected agents can all spread to same susceptible."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        rules = [
            StateTransition(
                from_state=ContagionState.SUSCEPTIBLE,
                to_state=ContagionState.INFECTED,
                trigger_type="proximity",
                probability=1.0,  # Always spreads
            )
        ]

        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules,
            initial_infected_count=1
        )

        # Create susceptible surrounded by multiple infected
        infected1 = MagicMock()
        infected1.name = "infected1"
        infected1.properties = {
            "contagion_state": "infected",
            "contagion_turns": 1,
            "map_xy": [5, 4]  # Above susceptible
        }

        infected2 = MagicMock()
        infected2.name = "infected2"
        infected2.properties = {
            "contagion_state": "infected",
            "contagion_turns": 1,
            "map_xy": [5, 6]  # Below susceptible
        }

        susceptible = MagicMock()
        susceptible.name = "susceptible"
        susceptible.properties = {
            "contagion_state": "susceptible",
            "contagion_turns": 0,
            "map_xy": [5, 5]
        }

        simulator = MagicMock()
        simulator.agents = {
            "infected1": infected1,
            "infected2": infected2,
            "susceptible": susceptible
        }
        simulator.turns = 1

        scene.pre_turn_rules(simulator)

        # Susceptible should be infected (first-match-wins from any adjacent infected)
        assert susceptible.properties["contagion_state"] == "infected"
