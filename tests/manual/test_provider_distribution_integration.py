"""
Integration test to verify LLM provider distribution works end-to-end.

This test verifies that when agents are configured with different providers,
they actually use those providers during execution.
"""
import asyncio
from unittest.mock import Mock, patch, MagicMock
from socialsim4.core.llm import LLMClient
from socialsim4.core.experiment.scene import ExperimentScene
from socialsim4.core.experiment.config import ExperimentConfig
from socialsim4.backend.services.simtree_runtime import ExperimentRunnerAdapter


def test_provider_distribution_in_adapter():
    """Test that ExperimentRunnerAdapter correctly passes provider_clients to scene."""

    # Create mock LLM clients for different providers
    mock_gpt4_client = Mock(spec=LLMClient)
    mock_gpt4_client.chat = Mock(return_value='{"action": "test"}')

    mock_claude_client = Mock(spec=LLMClient)
    mock_claude_client.chat = Mock(return_value='{"action": "test"}')

    # Create experiment config with agents using different providers
    # Use "backend" as provider dialect to signal "use provider_id lookup"
    config = ExperimentConfig(
        agents=[
            {
                "name": "Agent1",
                "provider_id": 1,  # GPT-4
                "llm_config": {"provider": "backend"},  # Sentinel: use provider_id
                "role_prompt": "You are Agent1",
            },
            {
                "name": "Agent2",
                "provider_id": 2,  # Claude
                "llm_config": {"provider": "backend"},  # Sentinel: use provider_id
                "role_prompt": "You are Agent2",
            },
        ],
        actions=[{"name": "discuss"}],
        parameters={},
        scenario_id="test",
    )

    # Create scene
    scene = ExperimentScene(config)

    # Create clients dict with providers mapping
    clients = {
        "chat": mock_gpt4_client,  # Default client
        "default": mock_gpt4_client,
        "providers": {
            1: mock_gpt4_client,   # Provider ID 1 -> GPT-4
            2: mock_claude_client, # Provider ID 2 -> Claude
        }
    }

    # Create adapter
    adapter = ExperimentRunnerAdapter(scene, clients)

    # Verify that scene was initialized with provider_clients
    assert scene._agent_llm_clients is not None, "Scene should have per-agent LLM clients"

    # Verify that each agent has the correct LLM client
    agent1_client = scene._agent_llm_clients.get("Agent1")
    agent2_client = scene._agent_llm_clients.get("Agent2")

    assert agent1_client is not None, "Agent1 should have an LLM client"
    assert agent2_client is not None, "Agent2 should have an LLM client"

    # Verify they use DIFFERENT clients (the core requirement)
    assert agent1_client == mock_gpt4_client, "Agent1 should use GPT-4 client"
    assert agent2_client == mock_claude_client, "Agent2 should use Claude client"

    print("PASS: Provider distribution test PASSED")
    print(f"  Agent1 client: {agent1_client}")
    print(f"  Agent2 client: {agent2_client}")
    print(f"  Agents use different clients: {agent1_client is not agent2_client}")


def test_provider_distribution_missing_providers_key():
    """Test that when providers key is missing, all agents use default client."""

    # Create mock LLM client
    mock_default_client = Mock(spec=LLMClient)
    mock_default_client.chat = Mock(return_value='{"action": "test"}')

    # Create experiment config with agents using different providers
    # Use "backend" as provider dialect to signal "use provider_id lookup"
    config = ExperimentConfig(
        agents=[
            {
                "name": "Agent1",
                "provider_id": 1,  # Should use GPT-4, but won't be available
                "llm_config": {"provider": "backend"},  # Sentinel: use provider_id
                "role_prompt": "You are Agent1",
            },
            {
                "name": "Agent2",
                "provider_id": 2,  # Should use Claude, but won't be available
                "llm_config": {"provider": "backend"},  # Sentinel: use provider_id
                "role_prompt": "You are Agent2",
            },
        ],
        actions=[{"name": "discuss"}],
        parameters={},
        scenario_id="test",
    )

    # Create scene
    scene = ExperimentScene(config)

    # Create clients dict WITHOUT providers mapping (current bug)
    clients = {
        "chat": mock_default_client,
        "default": mock_default_client,
        # MISSING: "providers": {...}
    }

    # Create adapter
    adapter = ExperimentRunnerAdapter(scene, clients)

    # Verify that scene was initialized
    assert scene._agent_llm_clients is not None, "Scene should have per-agent LLM clients"

    # Verify that BOTH agents fall back to default client (current buggy behavior)
    agent1_client = scene._agent_llm_clients.get("Agent1")
    agent2_client = scene._agent_llm_clients.get("Agent2")

    assert agent1_client is not None, "Agent1 should have an LLM client"
    assert agent2_client is not None, "Agent2 should have an LLM client"

    # Verify they BOTH use the SAME default client (the bug)
    assert agent1_client == mock_default_client, "Agent1 falls back to default"
    assert agent2_client == mock_default_client, "Agent2 falls back to default"
    assert agent1_client is agent2_client, "BOTH agents use the same client (BUG!)"

    print("FAIL: Provider distribution test shows BUG:")
    print(f"  Agent1 client: {agent1_client}")
    print(f"  Agent2 client: {agent2_client}")
    print(f"  Both use same client: {agent1_client is agent2_client}")


if __name__ == "__main__":
    print("="*60)
    print("Testing LLM Provider Distribution")
    print("="*60)
    print()

    print("Test 1: Verify correct behavior (with providers mapping)")
    print("-"*60)
    test_provider_distribution_in_adapter()
    print()

    print("Test 2: Demonstrate current bug (without providers mapping)")
    print("-"*60)
    test_provider_distribution_missing_providers_key()
    print()

    print("="*60)
    print("Summary:")
    print("  - Scene initialization CORRECTLY supports provider distribution")
    print("  - Adapter CORRECTLY passes provider_clients to scene")
    print("  - BUG: experiment_tasks.py doesn't populate clients['providers']")
    print("="*60)
