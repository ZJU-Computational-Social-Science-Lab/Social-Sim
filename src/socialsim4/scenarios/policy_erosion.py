"""
Policy Meaning Erosion Scenario

A policy is announced at the top of a three-tier hierarchy. Each tier
decides how to interpret and pass it on. Observe how the bottom tier's
understanding differs from the original policy.

This scenario explores bureaucratic communication and meaning distortion.
"""

from typing import Dict, Any
from socialsim4.core.scenes.experiment_scene import ExperimentScene
from socialsim4.i18n import T


def build_policy_erosion_sim(
    clients: Dict[str, object] | None = None,
    num_agents_per_tier: int = 5,
    policy_text: str = "All employees must complete mandatory training by Friday",
) -> ExperimentScene:
    """Build a Policy Meaning Erosion scenario.

    Args:
        clients: LLM clients for agent inference
        num_agents_per_tier: Number of agents in each of the 3 tiers
        policy_text: The original policy announced at the top

    Returns:
        ExperimentScene configured for policy erosion

    Note:
        Runs indefinitely; controlled by SimTree 'advance node' operation.
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

    # Build scenario description using T() for i18n
    description = T(
        'prompts.scenarios.policy_erosion.description',
        policy_text=policy_text
    )

    # Template configuration for experiment scene
    template_config = {
        'description': description,
        'actions': actions_config,
        'settings': {
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
