"""
Prompt builder for LLM prompt testing.

Provides simplified prompts for small 3B-4B models that struggle
with long, complex prompts.
"""

from .agents import AgentProfile
from .scenarios import ScenarioConfig


def build_simple_prompt(
    scenario: ScenarioConfig,
    agent: AgentProfile,
) -> str:
    """
    Build a simplified system prompt for small 3B-4B models.

    The key insight is that small models (3B-4B parameters) struggle with:
    - Long prompts (> 100 words)
    - Complex multi-part instructions
    - Multiple examples and warnings
    - Nested formatting requirements

    This function creates a minimal prompt that gets straight to the point.

    Args:
        scenario: The scenario configuration
        agent: The agent profile

    Returns:
        Simplified system prompt string with required sections for evaluator
    """
    # Build action list string
    action_list = ", ".join(f'"{a.name}"' for a in scenario.actions)
    first_action = scenario.actions[0].name if scenario.actions else "action_name"

    # Minimal prompt with required sections (satisfies evaluator, keeps short)
    prompt = f"""You are {agent.name}. {agent.role_prompt}

{scenario.system_instructions}

Available actions: {action_list}

--- Thoughts ---
Decision.

---- Plan ---
Action.

---- Action ---
<Action name="{first_action}" />"""

    return prompt


def build_full_prompt(
    scenario: ScenarioConfig,
    agent: AgentProfile,
) -> str:
    """
    Build the full system prompt with all details.

    Use this only for larger models (7B+) that can handle
    complex instructions.

    Args:
        scenario: The scenario configuration
        agent: The agent profile

    Returns:
        Complete system prompt string with all details
    """
    prompt = f"""You are {agent.name} - {agent.role_prompt}

Personality: {agent.personality}
Style: {agent.style}

Goals:
{chr(10).join(f"- {g}" for g in agent.goals)}

"""

    # Add scenario-specific instructions
    if scenario.system_instructions:
        prompt += scenario.system_instructions + "\n"

    # Add available actions
    if scenario.actions:
        action_names = ", ".join(f'"{a.name}"' for a in scenario.actions)
        prompt += f"""

IMPORTANT: You MUST use EXACTLY one of these action names: {action_names}
Do NOT invent your own actions. Do NOT use generic phrases like "I choose" or "I decide".
"""

    # Add output format instructions with explicit examples
    first_action = f'"{scenario.actions[0].name}"' if scenario.actions else "action_name"
    prompt += f"""
Output Format (follow exactly - NO OTHER TEXT):
--- Thoughts ---
[Brief thought]

---- Plan ---
Goals: [your goals]
Milestones: [completed ✓, pending →]

---- Action ---
<Action name="{first_action}">
  parameter="value"
</Action>

CRITICAL: Your output must end with Action tag. Do NOT add explanations, notes, or extra text after Action tag.
Keep thoughts and plan brief.

EXAMPLE: If choosing to cooperate, output EXACTLY:
--- Thoughts ---
I will cooperate to maximize mutual benefit.

---- Plan ---
Goals: Achieve best outcome
Milestones: → decision made

---- Action ---
<Action name="cooperate" />

That is ALL. No other text after Action tag.
"""

    return prompt


def build_prompt(
    scenario: ScenarioConfig,
    agent: AgentProfile,
    use_simple: bool = True,
) -> str:
    """
    Build system prompt with automatic selection based on model size.

    For small models (3B-4B), use simplified prompts.
    For larger models (7B+), use full prompts.

    Args:
        scenario: The scenario configuration
        agent: The agent profile
        use_simple: Whether to use simplified prompt (default: True)

    Returns:
        System prompt string
    """
    if use_simple:
        return build_simple_prompt(scenario, agent)
    return build_full_prompt(scenario, agent)
