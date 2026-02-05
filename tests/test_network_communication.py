"""
Unit tests for social network-based communication filtering.

Tests verify that agents only receive messages from agents they share
an edge with in the social network graph.
"""

import pytest
from unittest.mock import Mock

from socialsim4.core.scene import Scene
from socialsim4.core.agent import Agent
from socialsim4.core.event import PublicEvent
from socialsim4.core.simulator import Simulator
from socialsim4.core.llm import create_llm_client
from socialsim4.core.llm_config import LLMConfig
from socialsim4.core.ordering import SequentialOrdering


def create_mock_llm_config():
    """Create a mock LLM config for testing."""
    return LLMConfig(
        dialect="mock",
        api_key="",
        model="test",
        temperature=0.7,
    )


def create_test_agent(name: str, profile: str = "") -> Agent:
    """Create a test agent with minimal config."""
    llm_config = create_mock_llm_config()
    llm_client = create_llm_client(llm_config)

    agent_data = {
        "name": name,
        "user_profile": profile or f"Test agent {name}",
        "style": "",
        "initial_instruction": "",
        "role_prompt": "",
        "action_space": [],
        "properties": {},
    }
    agent = Agent.deserialize(agent_data)
    agent.llm_client = llm_client
    return agent


def test_social_network_filters_messages_linear():
    """Test that messages only go to connected agents in a linear network.

    Network: Alice <-> Bob <-> Charlie
    Expected: Alice's messages reach Bob but not Charlie.
    """
    scene = Scene("test", "Initial event")
    scene.state["social_network"] = {
        "Alice": ["Bob"],
        "Bob": ["Alice", "Charlie"],
        "Charlie": ["Bob"],
    }

    alice = create_test_agent("Alice")
    bob = create_test_agent("Bob")
    charlie = create_test_agent("Charlie")

    clients = {"chat": alice.llm_client, "default": alice.llm_client}
    simulator = Simulator(
        [alice, bob, charlie],
        scene,
        clients,
        event_handler=lambda *args, **kwargs: None,
        ordering=SequentialOrdering(),
    )

    # Alice sends a message
    event = PublicEvent("Hello from Alice")
    event.message = "Hello from Alice"
    scene.deliver_message(event, alice, simulator)

    # Alice should remember their own message
    alice_memory = alice.short_memory.get_all()
    assert any("Hello from Alice" in str(m.get('content', '')) for m in alice_memory), \
        "Alice should remember their own message"

    # Bob should receive the message (connected to Alice)
    bob_memory = bob.short_memory.get_all()
    assert any("Hello from Alice" in str(m.get('content', '')) for m in bob_memory), \
        "Bob should receive Alice's message (connected)"

    # Charlie should NOT receive the message (not connected to Alice)
    charlie_memory = charlie.short_memory.get_all()
    assert not any("Hello from Alice" in str(m.get('content', '')) for m in charlie_memory), \
        "Charlie should NOT receive Alice's message (not connected)"


def test_social_network_filters_messages_isolated():
    """Test that isolated agents don't receive any messages.

    Network: Alice <-> Bob, Charlie (isolated)
    Expected: Charlie never receives messages from anyone.
    """
    scene = Scene("test", "Initial event")
    scene.state["social_network"] = {
        "Alice": ["Bob"],
        "Bob": ["Alice"],
        # Charlie has no connections
    }

    alice = create_test_agent("Alice")
    bob = create_test_agent("Bob")
    charlie = create_test_agent("Charlie")

    clients = {"chat": alice.llm_client, "default": alice.llm_client}
    simulator = Simulator(
        [alice, bob, charlie],
        scene,
        clients,
        event_handler=lambda *args, **kwargs: None,
        ordering=SequentialOrdering(),
    )

    # Alice sends a message
    event = PublicEvent("Hello from Alice")
    event.message = "Hello from Alice"
    scene.deliver_message(event, alice, simulator)

    # Bob should receive
    bob_memory = bob.short_memory.get_all()
    assert any("Hello from Alice" in str(m.get('content', '')) for m in bob_memory)

    # Charlie should NOT receive
    charlie_memory = charlie.short_memory.get_all()
    assert not any("Hello from Alice" in str(m.get('content', '')) for m in charlie_memory)

    # Charlie sends a message - no one should receive it
    event2 = PublicEvent("Hello from Charlie")
    event2.message = "Hello from Charlie"
    scene.deliver_message(event2, charlie, simulator)

    # Alice and Bob should NOT have Charlie's message
    alice_memory = alice.short_memory.get_all()
    bob_memory = bob.short_memory.get_all()
    assert not any("Hello from Charlie" in str(m.get('content', '')) for m in alice_memory)
    assert not any("Hello from Charlie" in str(m.get('content', '')) for m in bob_memory)


def test_social_network_fully_connected():
    """Test that in a fully connected network, everyone receives all messages.

    Network: Alice <-> Bob <-> Charlie (triangle, all connected)
    Expected: All messages reach all agents.
    """
    scene = Scene("test", "Initial event")
    scene.state["social_network"] = {
        "Alice": ["Bob", "Charlie"],
        "Bob": ["Alice", "Charlie"],
        "Charlie": ["Alice", "Bob"],
    }

    alice = create_test_agent("Alice")
    bob = create_test_agent("Bob")
    charlie = create_test_agent("Charlie")

    clients = {"chat": alice.llm_client, "default": alice.llm_client}
    simulator = Simulator(
        [alice, bob, charlie],
        scene,
        clients,
        event_handler=lambda *args, **kwargs: None,
        ordering=SequentialOrdering(),
    )

    # Alice sends a message
    event = PublicEvent("Hello everyone")
    event.message = "Hello everyone"
    scene.deliver_message(event, alice, simulator)

    # Everyone should receive
    for agent in [bob, charlie]:
        agent_memory = agent.short_memory.get_all()
        assert any("Hello everyone" in str(m.get('content', '')) for m in agent_memory), \
            f"{agent.name} should receive message in fully connected network"


def test_no_social_network_global_broadcast():
    """Test that without a social network, messages go to everyone (global broadcast).

    Network: None (empty social_network)
    Expected: All messages reach all agents.
    """
    scene = Scene("test", "Initial event")
    # No social_network configured - should use global broadcast
    scene.state["social_network"] = {}

    alice = create_test_agent("Alice")
    bob = create_test_agent("Bob")
    charlie = create_test_agent("Charlie")

    clients = {"chat": alice.llm_client, "default": alice.llm_client}
    simulator = Simulator(
        [alice, bob, charlie],
        scene,
        clients,
        event_handler=lambda *args, **kwargs: None,
        ordering=SequentialOrdering(),
    )

    # Alice sends a message
    event = PublicEvent("Broadcast message")
    event.message = "Broadcast message"
    scene.deliver_message(event, alice, simulator)

    # Everyone should receive in global broadcast mode
    for agent in [bob, charlie]:
        agent_memory = agent.short_memory.get_all()
        assert any("Broadcast message" in str(m.get('content', '')) for m in agent_memory), \
            f"{agent.name} should receive message in global broadcast mode"


def test_asymmetric_connections():
    """Test that connections work correctly when they're asymmetric.

    Network: Alice -> Bob (Alice can send to Bob, Bob cannot send to Alice)
              Bob -> Charlie
    Expected: Alice's messages reach Bob, Bob's reach Charlie only.
    """
    scene = Scene("test", "Initial event")
    scene.state["social_network"] = {
        "Alice": ["Bob"],        # Alice sends to Bob
        "Bob": ["Charlie"],      # Bob sends to Charlie
        "Charlie": [],           # Charlie sends to no one
    }

    alice = create_test_agent("Alice")
    bob = create_test_agent("Bob")
    charlie = create_test_agent("Charlie")

    clients = {"chat": alice.llm_client, "default": alice.llm_client}
    simulator = Simulator(
        [alice, bob, charlie],
        scene,
        clients,
        event_handler=lambda *args, **kwargs: None,
        ordering=SequentialOrdering(),
    )

    # Alice sends a message
    event1 = PublicEvent("From Alice")
    event1.message = "From Alice"
    scene.deliver_message(event1, alice, simulator)

    # Bob should receive (Alice -> Bob)
    bob_memory = bob.short_memory.get_all()
    assert any("From Alice" in str(m.get('content', '')) for m in bob_memory)

    # Charlie should NOT receive (no path from Alice to Charlie)
    charlie_memory = charlie.short_memory.get_all()
    assert not any("From Alice" in str(m.get('content', '')) for m in charlie_memory)

    # Bob sends a message
    event2 = PublicEvent("From Bob")
    event2.message = "From Bob"
    scene.deliver_message(event2, bob, simulator)

    # Alice should NOT receive (Bob -> Alice is not configured)
    alice_memory = alice.short_memory.get_all()
    assert not any("From Bob" in str(m.get('content', '')) for m in alice_memory)

    # Charlie should receive (Bob -> Charlie)
    charlie_memory = charlie.short_memory.get_all()
    assert any("From Bob" in str(m.get('content', '')) for m in charlie_memory)


def test_get_recipients_by_social_network():
    """Test the _get_recipients_by_social_network method directly."""
    scene = Scene("test", "Initial event")
    scene.state["social_network"] = {
        "Alice": ["Bob"],
        "Bob": ["Alice", "Charlie"],
        "Charlie": ["Bob"],
    }

    alice = create_test_agent("Alice")
    bob = create_test_agent("Bob")
    charlie = create_test_agent("Charlie")

    clients = {"chat": alice.llm_client, "default": alice.llm_client}
    simulator = Simulator(
        [alice, bob, charlie],
        scene,
        clients,
        event_handler=lambda *args, **kwargs: None,
        ordering=SequentialOrdering(),
    )

    # Test Alice's recipients
    alice_recipients = scene._get_recipients_by_social_network(alice, simulator)
    assert alice_recipients == ["Bob"], "Alice should only reach Bob"

    # Test Bob's recipients
    bob_recipients = scene._get_recipients_by_social_network(bob, simulator)
    assert set(bob_recipients) == {"Alice", "Charlie"}, "Bob should reach Alice and Charlie"

    # Test Charlie's recipients
    charlie_recipients = scene._get_recipients_by_social_network(charlie, simulator)
    assert charlie_recipients == ["Bob"], "Charlie should only reach Bob"


def test_empty_network_uses_global_broadcast():
    """Test that empty social_network falls back to global broadcast."""
    scene = Scene("test", "Initial event")
    scene.state["social_network"] = {}  # Empty network

    alice = create_test_agent("Alice")
    bob = create_test_agent("Bob")
    charlie = create_test_agent("Charlie")

    clients = {"chat": alice.llm_client, "default": alice.llm_client}
    simulator = Simulator(
        [alice, bob, charlie],
        scene,
        clients,
        event_handler=lambda *args, **kwargs: None,
        ordering=SequentialOrdering(),
    )

    # Empty network should return all other agents
    alice_recipients = scene._get_recipients_by_social_network(alice, simulator)
    assert set(alice_recipients) == {"Bob", "Charlie"}, \
        "Empty network should fall back to global broadcast"


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v"])
