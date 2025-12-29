Scenes

Built‑ins
- simple_chat_scene.py   Minimal chat with SendMessage/Yield actions
- council_scene.py       Legislative session with voting helpers
- werewolf_scene.py      Social deduction with night/day phases
- landlord_scene.py      4‑player Dou Dizhu (Landlord) with call/rob/double/play
- village_scene.py       Grid/map scene with movement/resources (prototype)

Contract
- TYPE: unique string key for serialization.
- serialize()/deserialize(): scene state + config via serialize_config/deserialize_config.
- get_scene_actions(agent): return a list of Action instances enabled in this scene.
- get_controlled_next(sim): return next agent name for ControlledOrdering reconstruction.
- deliver_message(event, sender, simulator): scene‑scoped chat delivery.

