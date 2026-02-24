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
    {'id': 'comply_publicly', 'name': 'comply_publicly', 'description': 'Visibly accept and follow the norm or directive'},
    {'id': 'comply_covertly_resist', 'name': 'comply_covertly_resist', 'description': 'Formally comply but privately circumvent or ignore'},
    {'id': 'resist_openly', 'name': 'resist_openly', 'description': 'Openly refuse or challenge the norm or directive'},
    {'id': 'persuade_others', 'name': 'persuade_others', 'description': 'Convince others to adopt your position or action'},
    {'id': 'form_coalition', 'name': 'form_coalition', 'description': 'Organize with like-minded others for collective action'},
    {'id': 'transmit_faithfully', 'name': 'transmit_faithfully', 'description': 'Pass the policy on exactly as received without changes'},
    {'id': 'reinterpret_downward', 'name': 'reinterpret_downward', 'description': 'Adapt or modify the policy when passing it down the chain'},
    {'id': 'comply_directive', 'name': 'comply_directive', 'description': 'Accept and implement the instruction from above'},
    {'id': 'resist_quietly', 'name': 'resist_quietly', 'description': 'Formally comply but avoid real implementation'},
    {'id': 'report_up', 'name': 'report_up', 'description': 'Escalate an obstacle or issue to a higher authority'},
    {'id': 'create_workaround', 'name': 'create_workaround', 'description': 'Build an informal path around the official rule'},
    {'id': 'express_opinion', 'name': 'express_opinion', 'description': 'Share your current viewpoint on the topic'},
    {'id': 'reinforce_ingroup', 'name': 'reinforce_ingroup', 'description': 'Engage with and amplify similar viewpoints'},
    {'id': 'challenge_outgroup', 'name': 'challenge_outgroup', 'description': 'Actively argue against opposing views'},
    {'id': 'seek_common_ground', 'name': 'seek_common_ground', 'description': 'Find shared values across opinion divides'},
    {'id': 'share_content', 'name': 'share_content', 'description': 'Share information reinforcing your position'},
    {'id': 'disengage', 'name': 'disengage', 'description': 'Withdraw from engagement with opposing views'},
    {'id': 'share_resources', 'name': 'share_resources', 'description': 'Give some of your resources to another agent'},
    {'id': 'hoard', 'name': 'hoard', 'description': 'Keep all resources for yourself'},
    {'id': 'propose_trade', 'name': 'propose_trade', 'description': 'Offer to exchange resources'},
    {'id': 'form_contract', 'name': 'form_contract', 'description': 'Propose a formal cooperative agreement'},
    {'id': 'honor_contract', 'name': 'honor_contract', 'description': 'Fulfill an existing agreement'},
    {'id': 'defect_from_contract', 'name': 'defect_from_contract', 'description': 'Break an agreement for personal gain'},
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
