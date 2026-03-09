"""
Unit tests for contagion action transmission.

Tests action-directed contagion transmission triggered by SpeakToAction
when an infected agent speaks to a susceptible target,
the scene evaluates transmission probability based on action-triggered rules.

This module provides test coverage for action-directed transmission.

Contains: TestActionTransmission
"""
import pytest
from unittest.mock import MagicMock
from socialsim4.core.contagion import ContagionState, StateTransition
from socialsim4.core.contagion.scene import ContagionScene
from socialsim4.core.contagion.actions import SpeakToAction
from socialsim4.core.scenes.village_scene import GameMap


class TestActionTransmission:
    """Tests for action-directed transmission via SpeakToAction."""

    def test_speak_transmission(self):
        """Test that infected sender speaking to susceptible target triggers transmission.

        With probability=1.0, the target should become infected after speak.
        """
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

        # Create infected sender at (5, 5) - use neutral name to avoid false positives in feedback check
        sender = MagicMock()
        sender.name = "alice"
        sender.properties = {
            "contagion_state": "infected",
            "contagion_turns": 3,
            "map_xy": [5, 5]
        }
        # Track feedback added to sender
        sender_feedback = []
        sender.add_env_feedback = lambda msg: sender_feedback.append(msg)

        # Create susceptible target at (6, 5) - adjacent
        target = MagicMock()
        target.name = "bob"
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
            "alice": sender,
            "bob": target
        }
        simulator.turns = 1
        scene.pre_run(simulator)
        sender.properties["contagion_state"] = "infected"
        target.properties["contagion_state"] = "susceptible"
        action = SpeakToAction()
        action_data = {
            "target": "bob",
            "message": "Hello there!"
        }
        action.handle(action_data, sender, simulator, scene)
        # Target should be infected
        assert target.properties["contagion_state"] == "infected"
        # Verify no explicit feedback about transmission (hidden state semantics)
        all_feedback = sender_feedback + target_feedback
        for feedback in all_feedback:
            assert "transmission" not in feedback.lower(), \
                f"Feedback should not mention transmission: {feedback}"
            assert "contagion" not in feedback.lower(), \
                f"Feedback should not mention contagion: {feedback}"
            # Check for explicit infection notification (not agent names)
            assert "you are now infected" not in feedback.lower(), \
                f"Feedback should not reveal infection status: {feedback}"
            assert "you have been infected" not in feedback.lower(), \
                f"Feedback should not reveal infection status: {feedback}"

