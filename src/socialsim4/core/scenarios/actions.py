"""
Action library definitions for SocialSim4 scenarios.

Provides categorized action sets that scenarios can reference.
Each category contains actions relevant to that domain.

Actions are stored as dictionaries with 'name' and 'description' keys.
These are returned to the frontend for display and selection.

Contains: CATEGORY_ACTION_LIBRARIES
"""

# Sociology action library - 22 actions for social dynamics scenarios
SOCIOLOGY_ACTIONS = [
    {'name': 'comply_publicly', 'description': 'Visibly accept and follow the norm or directive'},
    {'name': 'comply_covertly_resist', 'description': 'Formally comply but privately circumvent or ignore'},
    {'name': 'resist_openly', 'description': 'Openly refuse or challenge the norm or directive'},
    {'name': 'persuade_others', 'description': 'Convince others to adopt your position or action'},
    {'name': 'form_coalition', 'description': 'Organize with like-minded others for collective action'},
    {'name': 'transmit_faithfully', 'description': 'Pass the policy on exactly as received without changes'},
    {'name': 'reinterpret_downward', 'description': 'Adapt or modify the policy when passing it down the chain'},
    {'name': 'comply_directive', 'description': 'Accept and implement the instruction from above'},
    {'name': 'resist_quietly', 'description': 'Formally comply but avoid real implementation'},
    {'name': 'report_up', 'description': 'Escalate an obstacle or issue to a higher authority'},
    {'name': 'create_workaround', 'description': 'Build an informal path around the official rule'},
    {'name': 'express_opinion', 'description': 'Share your current viewpoint on the topic'},
    {'name': 'reinforce_ingroup', 'description': 'Engage with and amplify similar viewpoints'},
    {'name': 'challenge_outgroup', 'description': 'Actively argue against opposing views'},
    {'name': 'seek_common_ground', 'description': 'Find shared values across opinion divides'},
    {'name': 'share_content', 'description': 'Share information reinforcing your position'},
    {'name': 'disengage', 'description': 'Withdraw from engagement with opposing views'},
    {'name': 'share_resources', 'description': 'Give some of your resources to another agent'},
    {'name': 'hoard', 'description': 'Keep all resources for yourself'},
    {'name': 'propose_trade', 'description': 'Offer to exchange resources'},
    {'name': 'form_contract', 'description': 'Propose a formal cooperative agreement'},
    {'name': 'honor_contract', 'description': 'Fulfill an existing agreement'},
    {'name': 'defect_from_contract', 'description': 'Break an agreement for personal gain'},
]

# Action libraries organized by category
CATEGORY_ACTION_LIBRARIES = {
    'sociology': SOCIOLOGY_ACTIONS,
    # Future categories can be added here:
    # 'game_theory': GAME_THEORY_ACTIONS,
    # 'discussion': DISCUSSION_ACTIONS,
    # 'grid_world': GRID_WORLD_ACTIONS,
    # 'social_deduction': SOCIAL_DEDUCTION_ACTIONS,
}
