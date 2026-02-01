import pytest
from socialsim4.core.simulator import Simulator
from socialsim4.core.agent import Agent
from socialsim4.core.scene import Scene
from socialsim4.core.ordering import SequentialOrdering
from socialsim4.core.environment_config import EnvironmentConfig
from unittest.mock import Mock


@pytest.fixture
def minimal_scene():
    """Create a minimal scene for testing."""
    from socialsim4.core.event import PublicEvent
    scene = Scene.__new__(Scene)
    scene.name = "test_scene"
    scene.initial_event = PublicEvent("Test event")
    scene.state = {"time": 0}
    scene.minutes_per_turn = 3
    return scene


@pytest.fixture
def mock_clients():
    return {"chat": Mock()}


def test_simulator_turn_tracking_at_interval(minimal_scene, mock_clients):
    """Test that suggestions become available at turn intervals."""
    agent = Agent.deserialize({
        "name": "TestAgent",
        "user_profile": "Test profile",
        "style": "test",
        "initial_instruction": "",
        "role_prompt": "",
        "action_space": ["yield"],
        "properties": {},
    })

    sim = Simulator(
        agents=[agent],
        scene=minimal_scene,
        clients=mock_clients,
        broadcast_initial=False,
        ordering=SequentialOrdering(),
        environment_config=EnvironmentConfig(enabled=True),  # Explicitly enable for testing
    )

    # Initially no suggestions available
    assert sim.are_environment_suggestions_available() is False

    # After 5 turns, suggestions should be available
    sim.turns = 5
    assert sim.are_environment_suggestions_available() is True

    # After 6 turns, still available (until user acts)
    sim.turns = 6
    assert sim.are_environment_suggestions_available() is True

    # After user dismisses, no longer available
    sim.dismiss_environment_suggestions()
    assert sim.are_environment_suggestions_available() is False

    # At turn 10, available again
    sim.turns = 10
    assert sim.are_environment_suggestions_available() is True


def test_simulator_custom_turn_interval(minimal_scene, mock_clients):
    """Test custom turn interval."""
    from socialsim4.core.environment_config import EnvironmentConfig

    agent = Agent.deserialize({
        "name": "TestAgent",
        "user_profile": "Test profile",
        "style": "test",
        "initial_instruction": "",
        "role_prompt": "",
        "action_space": ["yield"],
        "properties": {},
    })

    sim = Simulator(
        agents=[agent],
        scene=minimal_scene,
        clients=mock_clients,
        broadcast_initial=False,
        ordering=SequentialOrdering(),
        environment_config=EnvironmentConfig(enabled=True, turn_interval=3),
    )

    # At turn 3, suggestions available
    sim.turns = 3
    assert sim.are_environment_suggestions_available() is True
