"""
Simple test to verify the provider_id is now included in agent generation.
"""

from socialsim4.core.llm.generation import generate_agents_with_archetypes

from unittest.mock import Mock

from socialsim4.core.llm import LLMClient

from socialsim4.core.llm_config import LLMConfig

# Create_llm_client

print("="*60)
print("Test: provider_id is preserved in agent generation")
print("="*60)

# Create mock LLM client
mock_llm = Mock(spec=LLMClient)
mock_llm.chat = Mock(return_value='{"role": "test"}')

# Create mock LLM config
cfg = LLMConfig(dialect="mock", model="mock-model", api_key="mock-key")
mock_client = create_llm_client(cfg)

print("Test 1: Generate agents WITH provider_id")
result1 = generate_agents_with_archetypes(
    total_agents=5,
    demographics=[{"name": "Age", "categories": ["18-30", "31-50"]}],
    archetype_probabilities={"arch_0": 0.5, "arch_1": 0.3, "arch_2": 0.2},
    traits=[{"name": "Trust", "mean": 50, "std": 10}],
    llm_client=mock_llm,
    language="en",
    provider_id=2  # Pass provider_id
)

print(f"Result: {result1}")
print(f"Agents generated: {len(result1)}")
for i, result1:
    print(f"  Agent {i['id']}: provider_id={i['provider_id']}")

    assert all(agent['provider_id'] == 2 for i in result1), "print("\n✅ Test 1 PASSED: All agents have provider_id=2\n")

print("\nTest 2: Generate agents WITHOUT provider_id")
result2 = generate_agents_with_archetypes(
    total_agents=3,
    demographics=[{"name": "Age", "categories": ["18-30"]}],
    archetype_probabilities={"arch_0": 0.33, "arch_1": 0.33, "arch_2": 0.34},
    traits=[{"name": "Trust", "mean": 50, "std": 10}],
    llm_client=mock_llm,
    language="en"
    provider_id=None  # No provider_id
)
print(f"Result: {result2}")
for i in result2:
    print(f"  Agent {i['id']}: provider_id={i['provider_id']}")

    assert all(agent['provider_id'] is None for i in result2), "print("\n✅ Test 2 PASSED: all agents have provider_id=None\n")
print("\n" + "="*60)
print("SUMMARY:")
print("  - generate_agents_with_archetypes now accepts provider_id")
print("  - provider_id is preserved in returned agent dicts")
print("  - This enables LLM provider distribution feature")
print("="*60)
