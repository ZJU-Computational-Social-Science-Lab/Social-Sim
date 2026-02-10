"""
Agent archetype generation utilities for scaling social simulations.

Contains:
    - generate_archetypes_from_demographics: Create archetype combinations
    - add_gaussian_noise: Add Gaussian noise to trait values
    - generate_archetype_template: Generate LLM-based archetype descriptions
    - generate_agents_with_archetypes: Generate agent population from demographics

These functions enable large-scale agent generation by:
1. Creating cross-product of demographic categories (archetypes)
2. Using LLM to generate archetype descriptions and roles
3. Applying Gaussian noise to trait values for individuality
4. Generating agents with balanced archetype distribution
"""

import json
import math
import random
import re
from typing import List, Dict, Any, Optional


def generate_archetypes_from_demographics(demographics: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Generate all archetype combinations from demographics.

    Creates a cross-product of all demographic categories to produce
    comprehensive archetype combinations for agent generation.

    Args:
        demographics: List of {"name": str, "categories": List[str]}

    Returns:
        List of archetypes: [{"id", "attributes", "label", "probability"}, ...]
    """
    if not demographics:
        return []

    # Start with first demographic
    combinations = [{demographics[0]["name"]: cat} for cat in demographics[0]["categories"]]

    # Cross-product with remaining demographics
    for demo in demographics[1:]:
        new_combinations = []
        for combo in combinations:
            for cat in demo["categories"]:
                new_combo = dict(combo)
                new_combo[demo["name"]] = cat
                new_combinations.append(new_combo)
        combinations = new_combinations

    # Create archetype objects
    equal_prob = 1.0 / len(combinations) if combinations else 0
    archetypes = []
    for i, attrs in enumerate(combinations):
        label = " | ".join(f"{k}: {v}" for k, v in attrs.items())
        archetypes.append({
            "id": f"arch_{i}",
            "attributes": attrs,
            "label": label,
            "probability": equal_prob
        })

    return archetypes


def add_gaussian_noise(value: float, std_dev: float, min_val: float = 0, max_val: float = 100) -> int:
    """
    Add Gaussian noise to a value and clamp to min/max range.

    Uses Box-Muller transform to generate normally-distributed random
    values from uniform random number generator.

    Args:
        value: Base value to add noise to
        std_dev: Standard deviation of noise
        min_val: Minimum clamped value
        max_val: Maximum clamped value

    Returns:
        Noisy value as integer, clamped to [min_val, max_val]
    """
    u1 = random.random() or 0.0001
    u2 = random.random()
    z = math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)
    noisy = value + z * std_dev
    return int(round(max(min_val, min(max_val, noisy))))


def generate_archetype_template(
    archetype: Dict[str, Any],
    llm_client,
    language: str = "en"
) -> Dict[str, Any]:
    """
    Make ONE LLM call to get description and roles for an archetype.

    Traits are now user-specified, not LLM-generated. This function only
    retrieves the description and potential roles from the LLM.

    Args:
        archetype: Archetype dict with attributes and label
        llm_client: LLM client for generation
        language: Language code ("en" or "zh")

    Returns:
        Dict with "description" (str) and "roles" (List[str])

    Raises:
        RuntimeError: If LLM response is invalid or cannot be parsed
    """
    attrs_str = ", ".join(f"{k}: {v}" for k, v in archetype["attributes"].items())

    if language == "zh":
        prompt = f"""为此人口创建角色模板: {attrs_str}

返回这个格式的JSON:
{{"description": "一句人物描述", "roles": ["职业1", "职业2", "职业3", "职业4", "职业5"]}}

仅输出JSON，无其他文字。"""
    else:
        prompt = f"""Create agent template for: {attrs_str}

Return JSON in this exact format:
{{"description": "one sentence bio", "roles": ["Job Title 1", "Job Title 2", "Job Title 3", "Job Title 4", "Job Title 5"]}}

JSON only, no other text."""

    messages = [
        {"role": "system", "content": "Return only valid JSON."},
        {"role": "user", "content": prompt}
    ]

    response = llm_client.chat(messages)

    # Debug logging
    print(f"[DEBUG] Archetype: {attrs_str}")
    print(f"[DEBUG] LLM Response: {response[:500]}...")

    # Strip markdown code blocks if present
    cleaned = response.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned)
        cleaned = re.sub(r'\s*```$', '', cleaned)

    # Try to parse JSON from response
    json_match = re.search(r'\{[\s\S]*\}', cleaned)
    if not json_match:
        print(f"[ERROR] No JSON found in response for archetype {attrs_str}")
        print(f"[ERROR] Cleaned response: {cleaned}")
        raise RuntimeError(f"No JSON found in LLM response for archetype {attrs_str}. Response: {cleaned[:200]}")

    try:
        parsed = json.loads(json_match.group())
    except json.JSONDecodeError as e:
        print(f"[ERROR] JSON parse error for archetype {attrs_str}: {e}")
        print(f"[ERROR] JSON string: {json_match.group()[:200]}")
        raise RuntimeError(f"Failed to parse JSON for archetype {attrs_str}: {e}")

    # Validate required fields
    if "description" not in parsed or not isinstance(parsed["description"], str):
        raise RuntimeError(f"Missing or invalid 'description' for archetype {attrs_str}. Got keys: {list(parsed.keys())}")
    if "roles" not in parsed or not isinstance(parsed["roles"], list) or len(parsed["roles"]) == 0:
        raise RuntimeError(f"Missing or invalid 'roles' for archetype {attrs_str}. Got: {parsed.get('roles')}")

    # Validate roles are strings
    for i, r in enumerate(parsed["roles"]):
        if not isinstance(r, str):
            raise RuntimeError(f"Role {i} must be a string, got {type(r).__name__} for archetype {attrs_str}")

    return {
        "description": parsed["description"],
        "roles": parsed["roles"]
    }


def generate_agents_with_archetypes(
    total_agents: int,
    demographics: List[Dict[str, Any]],
    archetype_probabilities: Optional[Dict[str, float]],
    traits: List[Dict[str, Any]],
    llm_client,
    language: str = "en"
) -> List[Dict[str, Any]]:
    """
    Generate agents based on demographics and archetype probabilities.

    Traits use user-specified mean/std directly. This function:
    1. Generates all archetype combinations from demographics
    2. Applies custom probabilities if provided
    3. Calculates agent count per archetype
    4. Generates agents with LLM-based descriptions and Gaussian-noised traits

    Args:
        total_agents: Total number of agents to generate
        demographics: List of demographic category dicts
        archetype_probabilities: Optional custom probabilities per archetype ID
        traits: List of trait dicts with "name", "mean", "std"
        llm_client: LLM client for archetype template generation
        language: Language code ("en" or "zh")

    Returns:
        List of agent dicts with id, name, role, profile, properties, etc.

    Raises:
        ValueError: If traits are empty or missing required fields
    """
    # Validate inputs
    if not traits:
        raise ValueError("Traits are required for agent generation")

    # Validate trait format
    for trait in traits:
        if "mean" not in trait or "std" not in trait:
            raise ValueError(f"Trait '{trait.get('name', 'unknown')}' must have 'mean' and 'std'")

    # Step 1: Generate archetypes
    archetypes = generate_archetypes_from_demographics(demographics)
    if not archetypes:
        return []

    # Step 2: Apply custom probabilities
    if archetype_probabilities:
        for arch in archetypes:
            if arch["id"] in archetype_probabilities:
                arch["probability"] = archetype_probabilities[arch["id"]]

    # Step 3: Calculate agent counts per archetype
    total_prob = sum(a["probability"] for a in archetypes) or 1.0
    counts = {}
    remaining = total_agents

    for i, arch in enumerate(archetypes):
        if i == len(archetypes) - 1:
            counts[arch["id"]] = remaining
        else:
            normalized_prob = arch["probability"] / total_prob
            count = int(round(total_agents * normalized_prob))
            count = min(count, remaining)
            counts[arch["id"]] = count
            remaining -= count

    # Step 4: Generate agents - ONE ARCHETYPE AT A TIME
    agents = []
    global_index = 0

    for arch in archetypes:
        count = counts.get(arch["id"], 0)
        if count == 0:
            continue

        # ONE LLM call per archetype to get description and roles only
        template = generate_archetype_template(arch, llm_client, language)

        # Create agents with random role and Gaussian noise on traits
        for i in range(count):
            agent_num = global_index + 1
            name = f"Agent {agent_num}"

            # Randomly assign a role from LLM-generated list
            role = random.choice(template["roles"]) if template["roles"] else "Citizen"

            # Generate trait values with Gaussian noise using USER-SPECIFIED mean/std
            properties = {
                "archetype_id": arch["id"],
                "archetype_label": arch["label"],
                **arch["attributes"]
            }

            for trait in traits:
                value = add_gaussian_noise(
                    trait["mean"],
                    trait["std"],
                    0,    # min clamp
                    100   # max clamp (or make configurable)
                )
                properties[trait["name"]] = value

            # Profile is just the description
            profile = template["description"]

            agent = {
                "id": f"agent_{agent_num}",
                "name": name,
                "role": role,
                "avatarUrl": f"https://api.dicebear.com/7.x/avataaars/svg?seed=agent{agent_num}",
                "profile": profile,
                "properties": properties,
                "history": {},
                "memory": [],
                "knowledgeBase": []
            }

            agents.append(agent)
            global_index += 1

    return agents
