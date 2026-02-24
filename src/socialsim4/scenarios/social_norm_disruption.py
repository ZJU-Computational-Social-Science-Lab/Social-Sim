"""
Social Norm Disruption Scenario

A new rule is suddenly imposed on the group. Agents with different
social status and temperament must decide how to respond.

This scenario uses the sociology action library and explores compliance
and resistance dynamics.
"""

from typing import Dict, Any
from socialsim4.core.scenes.experiment_scene import ExperimentScene


def build_social_norm_disruption_sim(
    clients: Dict[str, object] | None = None,
    num_agents: int = 20,
    norm_strength: float = 0.8,
    agent_status_distribution: str = "mixed",  # "high_status", "low_status", "mixed"
    max_rounds: int = 5,
) -> ExperimentScene:
    """Build a Social Norm Disruption scenario.

    Args:
        clients: LLM clients for agent inference
        num_agents: Number of agents in the simulation
        norm_strength: How strongly the norm is enforced (0-1)
        agent_status_distribution: Distribution of agent social statuses
        max_rounds: Maximum number of rounds to run

    Returns:
        ExperimentScene configured for social norm disruption
    """
    from socialsim4.core.scenarios.actions import CATEGORY_ACTION_LIBRARIES

    # Get sociology actions
    sociology_actions = CATEGORY_ACTION_LIBRARIES['sociology']

    # Select relevant actions for norm disruption
    relevant_actions = [
        'comply_publicly',
        'comply_covertly_resist',
        'resist_openly',
        'persuade_others',
        'form_coalition',
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
    description = f"""A new rule has been announced: All participants must comply with a new mandatory requirement.

The norm has a strength level of {norm_strength:.1f} (0=very weak, 1=very strong).

Agents have different social statuses: {agent_status_distribution}

Your task is to decide how to respond to this new rule. You can:
- Publicly comply with the rule
- Covertly comply while privately resisting
- Openly refuse or challenge the rule
- Try to persuade others to join your position
- Form coalitions with like-minded agents

Consider your social status, temperament, and personal values when deciding."""

    # Template configuration for experiment scene
    template_config = {
        'description': description,
        'actions': actions_config,
        'settings': {
            'max_rounds': max_rounds,
            'round_visibility': 'simultaneous',
        }
    }

    # Create the scene
    scene = ExperimentScene(
        name='social_norm_disruption',
        initial_event=description,
        template_config=template_config,
    )

    return scene


# Action descriptions for API
SCENARIO_ACTIONS = [
    {'name': 'comply_publicly', 'description': 'Visibly accept and follow the norm or directive'},
    {'name': 'comply_covertly_resist', 'description': 'Formally comply but privately circumvent'},
    {'name': 'resist_openly', 'description': 'Openly refuse or challenge the norm'},
    {'name': 'persuade_others', 'description': 'Convince others to adopt your position'},
    {'name': 'form_coalition', 'description': 'Organize with like-minded others'},
]

# Category actions (all sociology actions available)
from socialsim4.core.scenarios.actions import CATEGORY_ACTION_LIBRARIES
CATEGORY_ACTIONS = CATEGORY_ACTION_LIBRARIES['sociology']

# Default selected actions
DEFAULT_ACTION_IDS = [
    'comply_publicly',
    'comply_covertly_resist',
    'resist_openly',
    'persuade_others',
]
