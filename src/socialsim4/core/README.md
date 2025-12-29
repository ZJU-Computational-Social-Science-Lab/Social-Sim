Core Engine

Modules
- simulator.py   Orchestrates turns, emits events, holds agents/scene/ordering
- scene.py       Base Scene interface + serialize/deserialize hooks
- agent.py       Strict agent runtime; single LLM call per process(); short‑term memory
- ordering.py    Scheduling policies (sequential/cycled/random/controlled/llm_moderated)
- simtree.py     Branching timelines via deep‑cloned Simulator nodes
- actions/       Action handlers (base + scene‑specific)
- scenes/        Built‑in scenes (simple_chat, council, werewolf, landlord, village)
- tools/         Web/search utilities used by actions

Serialization
- All core types use serialize()/deserialize() and deep‑copy nested structures.
- Ordering.serialize()/deserialize() wraps get_state/set_state.
- ControlledOrdering is restored with Scene.get_controlled_next(sim).

Events & Streaming
- Simulator emits events via log_event handler; SimTree attaches per‑node log handlers that both append to node logs and push deltas to subscribers.
- Agent appends also emit agent_ctx_delta for live DevUI updates.

Non‑negotiables
- No defensive coding (no try/except, isinstance/hasattr fallbacks).
- Strict input shapes; fail fast.
- Minimal, concrete interfaces.

