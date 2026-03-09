"""
Resource Scarcity Scenario

A post-disaster community faces scarce resources. Agents must decide whether
to share resources cooperatively, trade, or defect for personal gain.

This scenario explores cooperation, competition, and social dilemmas under
resource constraints.
"""

from typing import Dict, Any
from socialsim4.core.scenes.experiment_scene import ExperimentScene
from socialsim4.i18n import T


def build_resource_scarcity_sim(
    clients: Dict[str, object] | None = None,
    num_agents: int = 15,
    resource_amount: int = 100,  # Total units of scarce resource
    initial_distribution: str = "equal",  # "equal", "random", "skewed"
) -> ExperimentScene:
    """Build a Resource Scarcity scenario.

    Args:
        clients: LLM clients for agent inference
        num_agents: Number of agents in the community
        resource_amount: Total units of the scarce resource
        initial_distribution: How resources are distributed initially

    Returns:
        ExperimentScene configured for resource scarcity dilemma

    Note:
        Runs indefinitely; controlled by SimTree 'advance node' operation.
    """
    from socialsim4.core.scenarios.actions import CATEGORY_ACTION_LIBRARIES

    # Get sociology actions
    sociology_actions = CATEGORY_ACTION_LIBRARIES['sociology']

    # Select relevant actions for resource management
    relevant_actions = [
        'share_resources',
        'hoard',
        'propose_trade',
        'form_contract',
        'honor_contract',
        'defect_from_contract',
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
        'prompts.scenarios.resource_scarcity.description',
        resource_amount=resource_amount,
        num_agents=num_agents,
        initial_distribution=initial_distribution
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
        name='resource_scarcity',
        initial_event=description,
        template_config=template_config,
    )

    return scene


# Action descriptions for API
SCENARIO_ACTIONS = [
    {'name': 'share_resources', 'description': 'Give some of your resources to another agent'},
    {'name': 'hoard', 'description': 'Keep all resources for yourself'},
    {'name': 'propose_trade', 'description': 'Offer to exchange resources'},
    {'name': 'form_contract', 'description': 'Propose a formal cooperative agreement'},
    {'name': 'honor_contract', 'description': 'Fulfill an existing agreement'},
    {'name': 'defect_from_contract', 'description': 'Break an agreement for personal gain'},
]

# Category actions (all sociology actions available)
from socialsim4.core.scenarios.actions import CATEGORY_ACTION_LIBRARIES
CATEGORY_ACTIONS = CATEGORY_ACTION_LIBRARIES['sociology']

# Default selected actions
DEFAULT_ACTION_IDS = [
    'share_resources',
    'propose_trade',
    'form_contract',
    'honor_contract',
]
