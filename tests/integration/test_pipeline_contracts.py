"""
Pipeline contract tests — behavioral safety net for refactoring.

These tests verify public-interface contracts between major components.
They must survive any internal refactoring as long as behavior is preserved.

Contracts tested:
  1. Pipeline B: Simulator + SimpleChatScene completes N turns with mock LLM
  2. Agent parsing: parse_actions returns correct action from valid JSON
  3. Scenario registry: get_scenario("prisoners_dilemma") returns expected keys

Contains: TestSimulatorContract, TestParseActionsContract, TestScenarioRegistryContract
"""

import json
import pytest
from unittest.mock import MagicMock

from socialsim4.core.agent import Agent
from socialsim4.core.simulator import Simulator
from socialsim4.core.scenes.simple_chat_scene import SimpleChatScene
from socialsim4.core.ordering import SequentialOrdering
from socialsim4.core.agent.parsing import parse_actions
from socialsim4.core.scenarios import get_scenario


# ---------------------------------------------------------------------------
# Contract 1: Simulator + SimpleChatScene (Pipeline B)
# ---------------------------------------------------------------------------


class TestSimulatorContract:
    """Simulator.run() with SimpleChatScene and mock LLM completes turns."""

    def test_simulator_completes_n_turns(self):
        """Simulator runs N turns without error and produces agent activity."""
        mock_client = MagicMock()
        mock_client.chat.return_value = json.dumps({
            "thoughts": "I'll yield.",
            "response": "",
            "action": {"name": "yield"},
            "context_update": "",
            "metadata": {},
        })

        agents = [
            Agent(name="Alice", user_profile="Friendly", style="casual", action_space=[]),
            Agent(name="Bob", user_profile="Quiet", style="formal", action_space=[]),
        ]

        scene = SimpleChatScene(name="test_chat", initial_event="Chat started")
        ordering = SequentialOrdering()
        clients = {"chat": mock_client}

        sim = Simulator(
            agents=agents,
            scene=scene,
            clients=clients,
            ordering=ordering,
            broadcast_initial=False,
        )

        turn_count = [0]
        original_post_turn = scene.post_turn

        def counting_post_turn(agent, simulator):
            turn_count[0] += 1
            return original_post_turn(agent, simulator)

        scene.post_turn = counting_post_turn
        scene.is_complete = lambda: turn_count[0] >= 4

        sim.run(max_turns=100)

        assert turn_count[0] >= 4, "Simulator should have completed at least 4 turns"
        assert sim.turns >= 4

    def test_simulator_run_produces_turns(self):
        """Simulator.run() processes turns and increments turn counter."""
        mock_client = MagicMock()
        mock_client.chat.return_value = json.dumps({
            "thoughts": "Yield.",
            "response": "",
            "action": {"name": "yield"},
            "context_update": "",
            "metadata": {},
        })

        agents = [
            Agent(name="Alice", user_profile="Test", style="neutral", action_space=[]),
        ]

        scene = SimpleChatScene(name="test_chat", initial_event="Chat started")
        ordering = SequentialOrdering()
        clients = {"chat": mock_client}

        sim = Simulator(
            agents=agents,
            scene=scene,
            clients=clients,
            ordering=ordering,
            broadcast_initial=False,
        )

        turn_count = [0]
        original_post_turn = scene.post_turn

        def counting_post_turn(agent, simulator):
            turn_count[0] += 1
            return original_post_turn(agent, simulator)

        scene.post_turn = counting_post_turn
        scene.is_complete = lambda: turn_count[0] >= 2

        sim.run(max_turns=100)

        assert sim.turns >= 2, "Simulator should have processed at least 2 turns"


# ---------------------------------------------------------------------------
# Contract 2: parse_actions (pure logic, no mocking needed)
# ---------------------------------------------------------------------------


class TestParseActionsContract:
    """parse_actions returns correct action from valid LLM JSON string."""

    def test_valid_action_json_returns_list(self):
        """Valid JSON with action returns a list with correct action name."""
        response = json.dumps({
            "thoughts": "I will speak",
            "response": "Hello",
            "action": {"name": "speak", "message": "Hello world"},
            "context_update": "",
            "metadata": {},
        })
        result = parse_actions(response)
        assert isinstance(result, list)
        assert len(result) == 1

    def test_action_name_and_params_preserved(self):
        """Action name and parameters are preserved in parsed output."""
        response = json.dumps({
            "thoughts": "t",
            "response": "r",
            "action": {"name": "send_message", "target": "Bob", "message": "Hi"},
            "context_update": "Remember this",
            "metadata": {"key": "value"},
        })
        result = parse_actions(response)
        data = result[0]

        action = data["action"]
        assert action["name"] == "send_message"
        assert action["target"] == "Bob"
        assert action["message"] == "Hi"
        assert data["context_update"] == "Remember this"

    def test_missing_action_raises(self):
        """JSON without action field raises ValueError."""
        response = json.dumps({"thoughts": "t", "response": "r"})
        with pytest.raises(ValueError, match="action"):
            parse_actions(response)

    def test_yield_action_parsed(self):
        """Yield action is parsed correctly."""
        response = json.dumps({
            "thoughts": "Nothing to say",
            "response": "",
            "action": {"name": "yield"},
            "context_update": "",
            "metadata": {},
        })
        result = parse_actions(response)
        assert result[0]["action"]["name"] == "yield"


# ---------------------------------------------------------------------------
# Contract 3: Scenario Registry
# ---------------------------------------------------------------------------


class TestScenarioRegistryContract:
    """get_scenario returns dict with required keys for known scenarios."""

    def test_prisoners_dilemma_has_required_keys(self):
        """prisoners_dilemma scenario has id, name, actions, parameters."""
        scenario = get_scenario("prisoners_dilemma")
        assert scenario is not None, "prisoners_dilemma should be found in registry"

        assert "id" in scenario
        assert scenario["id"] == "prisoners_dilemma"
        assert "name" in scenario
        assert isinstance(scenario["name"], str)
        assert "actions" in scenario
        assert isinstance(scenario["actions"], list)
        assert len(scenario["actions"]) > 0
        assert "parameters" in scenario
        assert isinstance(scenario["parameters"], list)

    def test_prisoners_dilemma_cooperate_and_defect_actions(self):
        """prisoners_dilemma has cooperate and defect actions."""
        scenario = get_scenario("prisoners_dilemma")
        action_ids = {a["id"] for a in scenario["actions"]}
        assert "cooperate" in action_ids
        assert "defect" in action_ids

    def test_unknown_scenario_returns_none(self):
        """Unknown scenario ID returns None."""
        assert get_scenario("nonexistent_scenario_xyz") is None

    def test_scenario_id_matches_lookup_key(self):
        """Returned scenario id matches the requested ID."""
        scenario = get_scenario("prisoners_dilemma")
        assert scenario["id"] == "prisoners_dilemma"
