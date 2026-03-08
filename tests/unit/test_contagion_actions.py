"""
Unit tests for contagion action transmission.

Tests action-directed contagion transmission triggered by SpeakToAction.
When an infected agent speaks to a susceptible target, the scene evaluates
transmission probability based on action-triggered rules.
"""
import pytest
from unittest.mock import MagicMock, patch
from socialsim4.core.contagion import ContagionState, StateTransition


class TestActionTransmission:
    """Tests for action-directed transmission via SpeakToAction."""

    def test_speak_transmission(self):
        """Test that infected sender speaking to susceptible target triggers transmission.

        With probability=1.0, the target should become infected after speak.
        """
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.contagion.actions import SpeakToAction
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        rules = [
            StateTransition(
                from_state=ContagionState.INFECTED,
                to_state=ContagionState.INFECTED,
                trigger_type="action",
                probability=1.0,
            )
        ]

        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules,
            initial_infected_count=0
        )

        # Create infected sender at (5, 5)
        sender = MagicMock()
        sender.name = "infected_agent"
        sender.properties = {
            "contagion_state": "infected",
            "contagion_turns": 3,
            "map_xy": [5, 5]
        }

        # Create susceptible target at (6, 5) - adjacent
        target = MagicMock()
        target.name = "susceptible_agent"
        target.properties = {
            "contagion_state": "susceptible",
            "contagion_turns": 0,
            "map_xy": [6, 5]
        }

        simulator = MagicMock()
        simulator.agents = {
            "infected_agent": sender,
            "susceptible_agent": target
        }
        simulator.turns = 1

        # Initialize scene
        scene.pre_run(simulator)

        # Override random state assignment for predictable test
        sender.properties["contagion_state"] = "infected"
        target.properties["contagion_state"] = "susceptible"

        action = SpeakToAction()
        action_data = {
            "target": "susceptible_agent",
            "message": "Hello there!"
        }

        action.handle(action_data, sender, simulator, scene)

        # Target should be infected after speak with probability=1.0
        assert target.properties["contagion_state"] == "infected"

    def test_speak_probability(self):
        """Test that probability check determines if transmission happens.

        With probability=0.0, no transmission. With probability=1.0, always transmission.
        """
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.contagion.actions import SpeakToAction
        from socialsim4.core.scenes.village_scene import GameMap

        # Test probability=0.0 (no transmission)
        game_map = GameMap(10, 10)
        rules_zero = [
            StateTransition(
                from_state=ContagionState.INFECTED,
                to_state=ContagionState.INFECTED,
                trigger_type="action",
                probability=0.0,
            )
        ]

        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules_zero,
            initial_infected_count=0
        )

        sender = MagicMock()
        sender.name = "infected_agent"
        sender.properties = {
            "contagion_state": "infected",
            "contagion_turns": 3,
            "map_xy": [5, 5]
        }

        target = MagicMock()
        target.name = "susceptible_agent"
        target.properties = {
            "contagion_state": "susceptible",
            "contagion_turns": 0,
            "map_xy": [6, 5]
        }

        simulator = MagicMock()
        simulator.agents = {
            "infected_agent": sender,
            "susceptible_agent": target
        }
        simulator.turns = 1

        scene.pre_run(simulator)
        sender.properties["contagion_state"] = "infected"
        target.properties["contagion_state"] = "susceptible"

        action = SpeakToAction()
        action_data = {
            "target": "susceptible_agent",
            "message": "Hello there!"
        }

        action.handle(action_data, sender, simulator, scene)

        # Target should remain susceptible (probability=0.0)
        assert target.properties["contagion_state"] == "susceptible"

    def test_speak_no_transmission_without_rule(self):
        """Test that no transmission occurs when no action-triggered rule exists."""
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.contagion.actions import SpeakToAction
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        # Only decay rule, no action rule
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
            initial_infected_count=0
        )

        sender = MagicMock()
        sender.name = "infected_agent"
        sender.properties = {
            "contagion_state": "infected",
            "contagion_turns": 3,
            "map_xy": [5, 5]
        }

        target = MagicMock()
        target.name = "susceptible_agent"
        target.properties = {
            "contagion_state": "susceptible",
            "contagion_turns": 0,
            "map_xy": [6, 5]
        }

        simulator = MagicMock()
        simulator.agents = {
            "infected_agent": sender,
            "susceptible_agent": target
        }
        simulator.turns = 1

        scene.pre_run(simulator)
        sender.properties["contagion_state"] = "infected"
        target.properties["contagion_state"] = "susceptible"

        action = SpeakToAction()
        action_data = {
            "target": "susceptible_agent",
            "message": "Hello there!"
        }

        action.handle(action_data, sender, simulator, scene)

        # Target should remain susceptible (no action rule to trigger transmission)
        assert target.properties["contagion_state"] == "susceptible"

    def test_speak_transmission_silent(self):
        """Test that target agent does NOT receive explicit 'you were infected' feedback.

        Hidden state semantics: agents infer states from behavior, not explicit notification.
        """
        from socialsim4.core.contagion.scene import ContagionScene
        from socialsim4.core.contagion.actions import SpeakToAction
        from socialsim4.core.scenes.village_scene import GameMap

        game_map = GameMap(10, 10)
        rules = [
            StateTransition(
                from_state=ContagionState.INFECTED,
                to_state=ContagionState.INFECTED,
                trigger_type="action",
                probability=1.0,
            )
        ]

        scene = ContagionScene(
            name="test_scene",
            initial_event="start",
            game_map=game_map,
            rules=rules,
            initial_infected_count=0
        )

        sender = MagicMock()
        sender.name = "infected_agent"
        sender.properties = {
            "contagion_state": "infected",
            "contagion_turns": 3,
            "map_xy": [5, 5]
        }
        # Track feedback added to sender
        sender_feedback = []
        sender.add_env_feedback = lambda msg: sender_feedback.append(msg)

        target = MagicMock()
        target.name = "susceptible_agent"
        target.properties = {
            "contagion_state": "susceptible",
            "contagion_turns": 0,
            "map_xy": [6, 5]
        }
        # Track feedback added to target
        target_feedback = []
        target.add_env_feedback = lambda msg: target_feedback.append(msg)

        simulator = MagicMock()
        simulator.agents = {
            "infected_agent": sender,
            "susceptible_agent": target
        }
        simulator.turns = 1

        scene.pre_run(simulator)
        sender.properties["contagion_state"] = "infected"
        target.properties["contagion_state"] = "susceptible"

        action = SpeakToAction()
        action_data = {
            "target": "susceptible_agent",
            "message": "Hello there!"
        }

        action.handle(action_data, sender, simulator, scene)

        # Target should be infected
        assert target.properties["contagion_state"] == "infected"

        # But feedback should NOT mention infection/transmission/contagion
        all_feedback = sender_feedback + target_feedback
        for feedback in all_feedback:
            assert "infected" not in feedback.lower(), \
                f"Feedback should not mention infection: {feedback}"
            assert "transmission" not in feedback.lower(), \
                f"Feedback should not mention transmission: {feedback}"
            assert "contagion" not in feedback.lower(), \
                f"Feedback should not mention contagion: {feedback}"
