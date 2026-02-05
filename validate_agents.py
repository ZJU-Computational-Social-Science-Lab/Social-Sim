#!/usr/bin/env python3
# Agent Generation Validation Script
# ===================================
# Location: Social-Sim/validate_agents.py
#
# Run from PowerShell:
#   cd C:/Users/justi/Documents/ZJU_Work/Social-Sim
#   $env:PYTHONPATH = "src"
#   python validate_agents.py

import json
import math
import sys
import os

# Add the src directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

print("=" * 60)
print("  Agent Generation Validation Script")
print("=" * 60)

# ============================================================================
# Step 1: Test Imports
# ============================================================================
print("\n[1/5] Testing imports...")

try:
    from socialsim4.core.llm import (
        generate_archetypes_from_demographics,
        add_gaussian_noise,
        generate_archetype_template,
        generate_agents_with_archetypes,
    )
    print("  OK - All imports successful")
except ImportError as e:
    print(f"  FAILED - Import failed: {e}")
    print("\n  Make sure you're running from the Social-Sim directory")
    sys.exit(1)


# ============================================================================
# Step 2: Test Gaussian Noise Statistics
# ============================================================================
print("\n[2/5] Testing Gaussian noise statistics...")

# Test that mean and std are approximately correct
test_mean = 50
test_std = 15
samples = [add_gaussian_noise(test_mean, test_std, 0, 100) for _ in range(5000)]

actual_mean = sum(samples) / len(samples)
variance = sum((x - actual_mean) ** 2 for x in samples) / len(samples)
actual_std = math.sqrt(variance)

print(f"  Expected: mean={test_mean}, std={test_std}")
print(f"  Actual:   mean={actual_mean:.1f}, std={actual_std:.1f}")

if abs(actual_mean - test_mean) < 3 and abs(actual_std - test_std) < 3:
    print("  OK - Statistics are correct")
else:
    print("  FAILED - Statistics are off - check add_gaussian_noise function")

# Test bounds
out_of_bounds = [x for x in samples if x < 0 or x > 100]
if len(out_of_bounds) == 0:
    print("  OK - All values within bounds [0, 100]")
else:
    print(f"  FAILED - {len(out_of_bounds)} values out of bounds!")


# ============================================================================
# Step 3: Test Archetype Generation
# ============================================================================
print("\n[3/5] Testing archetype generation...")

demographics = [
    {"name": "Gender", "categories": ["Male", "Female"]},
    {"name": "Education", "categories": ["High School", "Undergraduate", "Post-Graduate"]}
]

archetypes = generate_archetypes_from_demographics(demographics)

expected_count = 2 * 3  # 2 genders x 3 education levels = 6
if len(archetypes) == expected_count:
    print(f"  OK - Generated {len(archetypes)} archetypes (expected {expected_count})")
else:
    print(f"  FAILED - Generated {len(archetypes)} archetypes, expected {expected_count}")

# Check probabilities sum to 1
total_prob = sum(a["probability"] for a in archetypes)
if abs(total_prob - 1.0) < 0.001:
    print(f"  OK - Probabilities sum to {total_prob:.4f}")
else:
    print(f"  FAILED - Probabilities sum to {total_prob}, expected 1.0")

print("\n  Archetypes generated:")
for a in archetypes:
    print(f"    - {a['label']} (prob={a['probability']:.2f})")


# ============================================================================
# Step 4: Test LLM Response Parsing (with mock)
# ============================================================================
print("\n[4/5] Testing LLM response parsing...")

class MockLLM:
    def __init__(self, response):
        self.response = response
    def chat(self, messages):
        return self.response

archetype = {"attributes": {"Gender": "Male", "Education": "PhD"}}

# Test 1: Valid JSON
print("\n  Test 4a: Valid JSON parsing...")
valid_response = json.dumps({
    "description": "A test description for the agent",
    "roles": ["Software Engineer", "Data Scientist", "Product Manager", "Designer", "Analyst"]
})

try:
    result = generate_archetype_template(archetype, MockLLM(valid_response), "en")
    if result["description"] == "A test description for the agent" and len(result["roles"]) == 5:
        print("  OK - Valid JSON parsed correctly")
    else:
        print("  FAILED - Parsing gave unexpected result")
except Exception as e:
    print(f"  FAILED - Unexpected error: {e}")

# Test 2: Markdown-wrapped JSON (common LLM behavior)
print("\n  Test 4b: Markdown-wrapped JSON...")
markdown_response = '```json\n{\n    "description": "Markdown wrapped response",\n    "roles": ["Role 1", "Role 2", "Role 3", "Role 4", "Role 5"]\n}\n```'

try:
    result = generate_archetype_template(archetype, MockLLM(markdown_response), "en")
    if "Markdown" in result["description"]:
        print("  OK - Markdown code blocks stripped correctly")
    else:
        print("  FAILED - Markdown stripping failed")
except Exception as e:
    print(f"  FAILED - Unexpected error: {e}")

# Test 3: Missing description should fail
print("\n  Test 4c: Missing 'description' rejected...")
bad_response = json.dumps({"roles": ["A", "B", "C", "D", "E"]})

try:
    generate_archetype_template(archetype, MockLLM(bad_response), "en")
    print("  FAILED - Should have raised an error!")
except RuntimeError as e:
    if "description" in str(e).lower():
        print("  OK - Missing description correctly rejected")
    else:
        print(f"  FAILED - Wrong error message: {e}")

# Test 4: Roles as objects should fail
print("\n  Test 4d: Roles as objects rejected...")
bad_response = json.dumps({
    "description": "Test",
    "roles": [{"title": "Manager"}, {"title": "Developer"}]
})

try:
    generate_archetype_template(archetype, MockLLM(bad_response), "en")
    print("  FAILED - Should have raised an error!")
except RuntimeError as e:
    if "string" in str(e).lower():
        print("  OK - Roles as objects correctly rejected")
    else:
        print(f"  FAILED - Wrong error message: {e}")


# ============================================================================
# Step 5: Test Full Pipeline (with mock LLM)
# ============================================================================
print("\n[5/5] Testing full agent generation pipeline...")

class MockLLMForPipeline:
    def __init__(self):
        self.call_count = 0

    def chat(self, messages):
        self.call_count += 1
        return json.dumps({
            "description": f"Description for archetype {self.call_count}",
            "roles": [
                f"Role A{self.call_count}",
                f"Role B{self.call_count}",
                f"Role C{self.call_count}",
                f"Role D{self.call_count}",
                f"Role E{self.call_count}"
            ]
        })

demographics = [
    {"name": "Gender", "categories": ["Male", "Female"]},
    {"name": "Education", "categories": ["HS", "UG"]}
]
traits = [
    {"name": "IQ", "mean": 50, "std": 15},
    {"name": "Creativity", "mean": 60, "std": 10}
]

mock_llm = MockLLMForPipeline()

try:
    agents = generate_agents_with_archetypes(
        total_agents=20,
        demographics=demographics,
        archetype_probabilities=None,
        traits=traits,
        llm_client=mock_llm,
        language="en"
    )

    # Check count
    if len(agents) == 20:
        print(f"  OK - Generated {len(agents)} agents (expected 20)")
    else:
        print(f"  FAILED - Generated {len(agents)} agents, expected 20")

    # Check LLM calls (should be 4 = 2 genders x 2 education levels)
    if mock_llm.call_count == 4:
        print(f"  OK - Made {mock_llm.call_count} LLM calls (1 per archetype)")
    else:
        print(f"  FAILED - Made {mock_llm.call_count} LLM calls, expected 4")

    # Check agent structure
    sample = agents[0]
    required_fields = ["id", "name", "role", "profile", "properties"]
    missing = [f for f in required_fields if f not in sample]
    if not missing:
        print("  OK - All required fields present")
    else:
        print(f"  FAILED - Missing fields: {missing}")

    # Check traits in properties
    if "IQ" in sample["properties"] and "Creativity" in sample["properties"]:
        print("  OK - Traits present in properties")
    else:
        print("  FAILED - Traits missing from properties")

    # Check trait statistics
    iq_values = [a["properties"]["IQ"] for a in agents]
    iq_mean = sum(iq_values) / len(iq_values)
    print(f"  INFO - IQ mean = {iq_mean:.1f} (expected ~50)")

    # Show sample agent
    print("\n  Sample agent:")
    print(f"    ID: {sample['id']}")
    print(f"    Name: {sample['name']}")
    print(f"    Role: {sample['role']}")
    print(f"    Profile: {sample['profile'][:50]}...")
    print(f"    IQ: {sample['properties']['IQ']}")
    print(f"    Creativity: {sample['properties']['Creativity']}")

except Exception as e:
    print(f"  FAILED - Pipeline failed: {e}")
    import traceback
    traceback.print_exc()


# ============================================================================
# Test Input Validation
# ============================================================================
print("\n[BONUS] Testing input validation...")

# Test: Empty traits should fail
print("\n  Test: Empty traits rejected...")
try:
    generate_agents_with_archetypes(
        total_agents=10,
        demographics=[{"name": "X", "categories": ["A"]}],
        archetype_probabilities=None,
        traits=[],  # Empty!
        llm_client=MockLLMForPipeline(),
        language="en"
    )
    print("  FAILED - Empty traits should raise an error!")
except (ValueError, RuntimeError) as e:
    print("  OK - Empty traits correctly rejected")

# Test: Invalid trait format (min/max instead of mean/std)
print("\n  Test: Invalid trait format rejected...")
try:
    generate_agents_with_archetypes(
        total_agents=10,
        demographics=[{"name": "X", "categories": ["A"]}],
        archetype_probabilities=None,
        traits=[{"name": "IQ", "min": 0, "max": 100}],  # Wrong format!
        llm_client=MockLLMForPipeline(),
        language="en"
    )
    print("  FAILED - Invalid trait format should raise an error!")
except (ValueError, RuntimeError) as e:
    print("  OK - Invalid trait format (min/max) correctly rejected")


# ============================================================================
# Summary
# ============================================================================
print("\n" + "=" * 60)
print("  VALIDATION COMPLETE")
print("=" * 60)
print("")
print("If all tests show OK, your code is ready for testing with real LLMs!")
print("")
print("Next steps:")
print("1. Start your backend:")
print("   cd src")
print("   $env:PYTHONPATH = \".\"")
print("   python -m uvicorn socialsim4.backend.main:app --host 0.0.0.0 --port 8000 --reload")
print("")
print("2. Start your frontend:")
print("   cd frontend")
print("   npm run dev")
print("")
print("3. Open http://localhost:5173/simulations/new")
print("")
print("4. Test with different LLM models (Qwen, Gemma, Ministral)")
print("")
