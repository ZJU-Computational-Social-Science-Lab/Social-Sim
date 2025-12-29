Actions

Where
- base_actions.py        speak | send_message | yield | talk_to
- web_actions.py         web_search | view_page (tools/web)
- council_actions.py     start_voting | finish_meeting | request_brief | vote
- werewolf_actions.py    open_voting | close_voting | night_kill | inspect | witch_save | witch_poison | vote_lynch
- landlord_actions.py    call_landlord | rob_landlord | double | no_double | play_cards | pass
- village_actions.py     move_to_location | look_around | gather_resource | rest
- moderation_actions.py  schedule_order (for LLMModerated ordering)

Conventions
- Actions read required fields directly (no fallbacks) and fail fast if missing.
- A successful handle(...) returns: success, result, summary, meta, pass_control.
- Scenes may add their own actions to an agent at runtime via Scene.get_scene_actions(agent).

