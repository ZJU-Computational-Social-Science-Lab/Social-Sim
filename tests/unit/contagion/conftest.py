"""
Shared fixtures for contagion module unit tests.

Provides common test fixtures for agents, simulator, scene, and game map
to reduce boilerplate in individual test files.
"""
import pytest
from unittest.mock import MagicMock

from socialsim4.core.contagion import ContagionState, StateTransition
from socialsim4.core.scenes.village_scene import GameMap


@pytest.fixture
def game_map():
    """Create a 10x10 game map for testing."""
    return GameMap(10, 10)


@pytest.fixture
def contagion_scene(game_map):
    """Create a ContagionScene for testing."""
    from socialsim4.core.contagion.scene import ContagionScene

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
    return scene


@pytest.fixture
def mock_agent():
    """Create a mock agent with standard properties."""
    agent = MagicMock()
    agent.name = "test_agent"
    agent.language = "en"
    agent.properties = {
        "map_xy": [5, 5],
        "map_position": "5,5",
        "contagion_state": "susceptible",
        "contagion_turns": 0,
        "energy": 100,
        "hunger": 0,
        "inventory": {}
    }
    agent.add_env_feedback = MagicMock()
    return agent


@pytest.fixture
def mock_simulator(mock_agent, contagion_scene):
    """Create a mock simulator with agents and scene reference."""
    simulator = MagicMock()
    simulator.agents = {"test_agent": mock_agent}
    simulator.turns = 0
    simulator.scene = contagion_scene
    simulator.emit_event_later = MagicMock()
    return simulator


@pytest.fixture
def mock_agent_at_position():
    """Factory fixture to create agents at specific positions."""
    def _create_agent(name: str, x: int, y: int, **extra_props):
        agent = MagicMock()
        agent.name = name
        agent.language = "en"
        agent.properties = {
            "map_xy": [x, y],
            "map_position": f"{x},{y}",
            "contagion_state": "susceptible",
            "contagion_turns": 0,
            "energy": 100,
            "hunger": 0,
            "inventory": {}
        }
        agent.properties.update(extra_props)
        agent.add_env_feedback = MagicMock()
        return agent
    return _create_agent
