"""
Policy Meaning Erosion Scenario

A policy is announced at the top of a three-tier hierarchy. Each tier
decides how to interpret and pass it on. Observe how the bottom tier's
understanding differs from the original policy.

This scenario explores bureaucratic communication and meaning distortion.
"""

from typing import Dict, Any
from socialsim4.core.scenes.experiment_scene import ExperimentScene


def build_policy_erosion_sim(
    clients: Dict[str, object] | None = None,
    num_agents_per_tier: int = 5,
    policy_text: str = "All employees must complete mandatory training by Friday",
    max_rounds: int = 3,
) -> ExperimentScene:
    """Build a Policy Meaning Erosion scenario.

    Args:
        clients: LLM clients for agent inference
        num_agents_per_tier: Number of agents in each of the 3 tiers
        policy_text: The original policy announced at the top
        max_rounds: Maximum number of rounds to run

    Returns:
        ExperimentScene configured for policy erosion
    """
    from socialsim4.core.scenarios.actions import CATEGORY_ACTION_LIBRARIES

    # Get sociology actions
    sociology_actions = CATEGORY_ACTION_LIBRARIES['sociology']

    # Select relevant actions for policy transmission
    relevant_actions = [
        'transmit_faithfully',
        'reinterpret_downward',
        'comply_directive',
        'resist_quietly',
        'report_up',
        'create_workaround',
    ]

    # Build action configs
    actions_config = [
        {
            'name': action_name,
            'description': next(a['description'] for a in sociology_actions if a['name'] == action_name)
        }
        for action_name in relevant_actions
    ]

    # Build scenario description
    description = f"""POLICY ANNOUNCEMENT (from top-tier management):

"{policy_text}"

You are in a three-tier organizational hierarchy:
- Tier 1 (Top): Receives the original policy directly
- Tier 2 (Middle): Receives policy from Tier 1, must pass to Tier 3
- Tier 3 (Bottom): Receives policy from Tier 2, must implement

Each tier decides how to interpret and pass on the policy. Observe how
the meaning changes as it moves down the chain.

Your task:
1. If you're Tier 1: Transmit the policy to Tier 2
2. If you're Tier 2: Receive from Tier 1, interpret it, pass to Tier 3
3. If you're Tier 3: Receive from Tier 2, decide how to implement

You can:
- Transmit the policy exactly as received
- Reinterpret or adapt the policy when passing it down
- Comply with the directive from above
- Quietly resist while appearing to comply
- Report obstacles up the chain
- Create workarounds to avoid implementation"""

    # Template configuration for experiment scene
    template_config = {
        'description': description,
        'actions': actions_config,
        'settings': {
            'max_rounds': max_rounds,
            'round_visibility': 'sequential',  # Each tier acts in order
        }
    }

    # Create the scene
    scene = ExperimentScene(
        name='policy_erosion',
        initial_event=description,
        template_config=template_config,
    )

    return scene


# Action descriptions for API
SCENARIO_ACTIONS = [
    {'name': 'transmit_faithfully', 'description': 'Pass the policy on exactly as received'},
    {'name': 'reinterpret_downward', 'description': 'Adapt the policy when passing it down'},
    {'name': 'comply_directive', 'description': 'Accept and implement the instruction from above'},
    {'name': 'resist_quietly', 'description': 'Formally comply but avoid real implementation'},
    {'name': 'report_up', 'description': 'Escalate an obstacle to a higher authority'},
    {'name': 'create_workaround', 'description': 'Build an informal path around the official rule'},
]

# Category actions (all sociology actions available)
from socialsim4.core.scenarios.actions import CATEGORY_ACTION_LIBRARIES
CATEGORY_ACTIONS = CATEGORY_ACTION_LIBRARIES['sociology']

# Default selected actions
DEFAULT_ACTION_IDS = [
    'transmit_faithfully',
    'reinterpret_downward',
    'comply_directive',
]
