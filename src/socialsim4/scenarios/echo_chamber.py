"""
Echo Chamber Scenario

Agents hold opinions ranging from strongly progressive to strongly conservative.
Observe opinion drift and information silos as agents share content with
like-minded others and disengage from opposing views.

This scenario explores polarization and filter bubbles in social networks.
"""

from typing import Dict, Any
from socialsim4.core.scenes.experiment_scene import ExperimentScene
from socialsim4.i18n import T


def build_echo_chamber_sim(
    clients: Dict[str, object] | None = None,
    num_agents: int = 20,
    opinion_distribution: str = "balanced",  # "balanced", "polarized", "random"
    connection_homogeneity: float = 0.7,  # 0=random, 1=similar only connect
) -> ExperimentScene:
    """Build an Echo Chamber scenario.

    Args:
        clients: LLM clients for agent inference
        num_agents: Total number of agents
        opinion_distribution: How opinions are distributed initially
        connection_homogeneity: How similar agents must be to connect (0-1)

    Returns:
        ExperimentScene configured for echo chamber dynamics

    Note:
        Runs indefinitely; controlled by SimTree 'advance node' operation.
    """
    from socialsim4.core.scenarios.actions import CATEGORY_ACTION_LIBRARIES

    # Get sociology actions
    sociology_actions = CATEGORY_ACTION_LIBRARIES['sociology']

    # Select relevant actions for opinion dynamics
    relevant_actions = [
        'express_opinion',
        'reinforce_ingroup',
        'challenge_outgroup',
        'seek_common_ground',
        'share_content',
        'disengage',
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
        'prompts.scenarios.echo_chamber.description',
        num_agents=num_agents,
        connection_homogeneity=connection_homogeneity
    )

    # Template configuration for experiment scene
    template_config = {
        'description': description,
        'actions': actions_config,
        'settings': {
            'round_visibility': 'simultaneous',
        }
    }

    # Create the scene
    scene = ExperimentScene(
        name='echo_chamber',
        initial_event=description,
        template_config=template_config,
    )

    return scene


# Action descriptions for API
SCENARIO_ACTIONS = [
    {'name': 'express_opinion', 'description': 'Share your current viewpoint on the topic'},
    {'name': 'reinforce_ingroup', 'description': 'Engage with and amplify similar viewpoints'},
    {'name': 'challenge_outgroup', 'description': 'Actively argue against opposing views'},
    {'name': 'seek_common_ground', 'description': 'Find shared values across opinion divides'},
    {'name': 'share_content', 'description': 'Share information reinforcing your position'},
    {'name': 'disengage', 'description': 'Withdraw from engagement with opposing views'},
]

# Category actions (all sociology actions available)
from socialsim4.core.scenarios.actions import CATEGORY_ACTION_LIBRARIES
CATEGORY_ACTIONS = CATEGORY_ACTION_LIBRARIES['sociology']

# Default selected actions
DEFAULT_ACTION_IDS = [
    'express_opinion',
    'reinforce_ingroup',
    'share_content',
    'disengage',
]
