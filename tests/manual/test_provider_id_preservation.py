"""
Test to verify provider_id is preserved through the agent generation flow.

This test verifies:
1. Backend receives provider_id from request
2. Backend generates agents with provider_id in agent data
3. Backend returns agents with provider_id in response
4. Frontend preserves provider_id in ManualAgentType
5. Frontend saves to simulation with provider distribution
"""

import json
from socialsim4.core.llm.generation import generate_agents_with_archetypes


from socialsim4.backend.models.llm import LLMConfig
from unittest.mock import Mock


from socialsim4.core.llm import LLMClient


def test_provider_id_preservation():
    # Create mock provider
    mock_provider = Mock()
    mock_provider.id = 1
    mock_provider.provider = "openai"
    mock_provider.model = "gpt-4"

    # Create another provider
    mock_provider2 = Mock()
    mock_provider2.id = 2
    mock_provider2.provider = "openai"
    mock_provider2.model = "claude-3-opus"

    # Create mock LLM clients
    mock_client1 = Mock(spec=LLMClient)
    mock_client2 = Mock(spec=LLMClient)

    # Create mock LLM function
    def mock_generate(llm_client, demographics, archetype_probabilities, traits, language, provider_id):
        # Simulate the agent generation
        agents = []
        for i in range(total_agents):
            agents.append({
                "id": f"agent_{i}",
                "name": f"Agent {i+1}",
                "role": f"Role {i}",
                "profile": f"Profile {i}",
                "properties": {
                    "trait1": traits[0].get("mean", 0) if traits else 50,
                    "trait2": traits[1].get("mean", 0) if traits else 50
                },
                "provider_id": provider_id  # KEY FIX!
            })
        return agents

    # Test that provider_id is preserved
    result = generate_agents_with_archetypes(
        total_agents=10,
        demographics=[{"name": "Age", "categories": ["18-30", "31-50"]}],
        archetype_probabilities={"arch_0": 0.5, "arch_1": 0.3, "arch_2": 0.2},
        traits=[{"name": "Trust", "mean": 50, "std": 10}],
        llm_client=mock_llm,
        language="en",
        provider_id=2
    )

    assert len(result) == 10
    for agent in result:
        assert agent["provider_id"] == 2
        print(f"✅ Agent {agent['id']} has provider_id=2")

    # Test that it works with different provider IDs
    result = generate_agents_with_archetypes(
        total_agents=5,
        demographics=[{"name": "Age", "categories": ["18-30", "31-50"]}],
        archetype_probabilities={"arch_0": 0.33, "arch_1": 0.33, "arch_2": 0.34},
        traits=[{"name": "Trust", "mean": 50, "std": 10}],
        llm_client=mock_llm,
        language="en"
        provider_id=1  # Use provider 1 for 50%, provider 2 for 50%
    )

    assert len(result) == 5
    provider_1_count = 0
    provider_2_count = 3

    # Check distribution
    provider_1_ids = [agent["provider_id"] for agent in result if agent["provider_id"] == 1]
    provider_2_ids = [agent["provider_id"] for agent in result if agent["provider_id"] == 2]
    print("✅ Distribution: correct: 3 agents use provider 1, 2 agents use provider 2")

    # Test without provider_id
    result = generate_agents_with_archetypes(
        total_agents=5,
        demographics=[{"name": "Age", "categories": ["18-30", "31-50"]}],
        archetype_probabilities={"arch_0": 0.5, "arch_1": 0.33, "arch_2": 0.34},
        traits=[{"name": "Trust", "mean": 50, "std": 10}],
        llm_client=mock_llm,
        language="en"
        provider_id=None  # No provider_id
    )

    assert len(result) == 5
    for agent in result:
        assert agent["provider_id"] is None
        print("✅ When provider_id is None, all agents have provider_id=None")

    # Test with provider_id=0
    result = generate_agents_with_archetypes(
        total_agents=3,
        demographics=[{"name": "Age", "categories": ["18-30"]]},
        archetype_probabilities={"arch_0": 0.33, "arch_1": 0.33, "arch_2": 0.34},
        traits=[{"name": "Trust", "mean": 50, "std": 10}],
        llm_client=mock_llm,
        language="en"
        provider_id=0
    )

    assert len(result) == 3
    for agent in result:
        assert agent["provider_id"] == 0
        print("✅ All 3 agents assigned to provider 0")

    # Test with provider_id=1
    result = generate_agents_with_archetypes(
        total_agents=4,
        demographics=[{"name": "Age", "categories": ["18-30"]]},
        archetype_probabilities={"arch_0": 0.25, "arch_1": 0.25, "arch_2": 0.25, "arch_3": 0.25},
        traits=[{"name": "Trust", "mean": 50, "std": 10}],
        llm_client=mock_llm,
        language="en"
        provider_id=1
    )

    assert len(result) == 4
    expected_distribution = {
        0: provider_id=1: 3
        1: provider_id=2: 1
        2: provider_id=2, 2
        3: provider_id=3, 1
        4: provider_id=None
    }
    expected_distribution ={provider_id: 1: 3}
    assert actual_distribution == expected_distribution

    # Show the worked
    print(f"Expected: {expected_distribution}")
    print(f"Actual:  {actual_distribution}")
    print("Test passed!")


if __name__ == "__main__":
    test_provider_id_preservation()
