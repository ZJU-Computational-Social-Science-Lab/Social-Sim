# Phase 2: Actions & Context - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Agents can move on the grid and speak to nearby agents, with their contagion state integrated into decision-making prompts. This phase adds MoveAction for single-cell adjacent movement and SpeakToAction for targeted communication. Context integration (CTX-01, CTX-02) was completed in Phase 1 via `get_agent_status_prompt()`.

</domain>

<decisions>
## Implementation Decisions

### Move Action Design
- **New action class** — Create `MoveAdjacentAction` separate from existing `MoveToLocationAction`. Single-cell moves for contagion dynamics, pathfinding moves for village scenarios.
- **8-way compass directions** — Directions: north, northeast, east, southeast, south, southwest, west, northwest. Matches Moore neighborhood from Phase 1.
- **Collision handling** — Fail with feedback: "Cell occupied by [agent_name], move failed." Agent must choose different direction.
- **Boundary handling** — Fail with feedback: "Cannot move [direction] - at grid boundary." No wrapping.
- **Action XML format** — `<Action name="move"><direction>north</direction></Action>`

### Speak Action Design
- **Two-step prompt pattern** — Agent first responds with speak action + target, then gets reprompted for message content. More natural LLM interaction.
- **Moore neighborhood adjacency** — Speak only works to agents in 8 adjacent cells. Consistent with hidden states and Phase 3 transmission mechanics.
- **Status prompt delivery** — Message appears in target's status prompt next turn: "[Sender] said to you: [message]". Consistent with Phase 1 pattern.
- **Action XML format (step 1)** — `<Action name="speak"><target>Alice</target></Action>`
- **Message collection (step 2)** — Separate prompt asking for freetext message content

### Action Context Format
- **Show all action instructions** — Prompt includes INSTRUCTION from all available actions. Consistent with existing platform pattern.
- **Full adjacent cell context** — Status prompt shows all 8 adjacent cells with contents: "North: boundary, NE: empty, East: Alice, SE: empty, South: empty, SW: Bob, West: empty, NW: boundary". Enables informed movement decisions without trial-and-error.
- **Agent names only (hidden states)** — Adjacent cells show agent names but NOT their contagion states. Maintains HIDE-01/HIDE-02 semantics from Phase 1.
- **No re-prompt on failure** — Since agents see all adjacent cell contents upfront, move actions should always succeed to valid destinations. Invalid moves (boundary/occupied) are filtered by context visibility.

### File Organization
- **New contagion/actions.py** — Actions live in `src/socialsim4/core/contagion/actions.py`. Clean separation from village actions.
- **Scene registration** — ContagionScene registers its own actions in `get_scene_actions()`.

### Claude's Discretion
- Energy cost for move action (follow VillageScene's movement_cost pattern or make free)
- Message length limits for speak
- Action ordering in prompt (alphabetical or priority-based)
- Test file location (tests/unit/contagion/ vs tests/unit/core/contagion/)

</decisions>

<specifics>
## Specific Ideas

- Follow existing action patterns from `village_actions.py` for localization using `_localized()` helper
- Reuse `TalkToEvent` or create new `SpeakToEvent` for contagion-specific speak
- Consider extending `get_agent_status_prompt()` with direction availability hints

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Action base class** (`core/action.py`): Extend with NAME, DESC, INSTRUCTION, handle() method
- **`_localized()` helper** (`actions/base_actions.py`): Localization pattern for English/Chinese feedback
- **`TalkToAction`** (`actions/base_actions.py`): Pattern for targeted communication with range check
- **`MoveToLocationAction`** (`actions/village_actions.py`): Pattern for grid movement (pathfinding, not single-cell)
- **`TalkToEvent`** (`core/event.py`): Event class for directed messages
- **`get_moore_neighbors()`** (ContagionScene): Already returns 8-directional neighbor coordinates
- **`get_adjacent_agents()`** (ContagionScene): Already returns agent names in adjacent cells

### Established Patterns
- **Action return tuple**: `(success: bool, result: dict, summary: str, {}, ends_turn: bool)`
- **Agent feedback**: `agent.add_env_feedback(message)` for action results
- **Scene actions**: Scene's `get_scene_actions()` returns list of action classes to register
- **XML action format**: `<Action name="action_name"><param>value</param></Action>`

### Integration Points
- **ContagionScene.get_scene_actions()**: Register MoveAdjacentAction and SpeakToAction
- **ContagionScene.get_agent_status_prompt()**: Extend with direction availability hints
- **Simulator.run()**: Already calls `pre_turn_rules()` before agents act (Phase 1)

### Already Complete (Phase 1)
- CTX-01: Agent prompt includes own contagion state via `get_agent_status_prompt()`
- CTX-02: Agent prompt includes nearby agent IDs (not states) via `get_adjacent_agents()`
- Moore neighborhood adjacency via `get_moore_neighbors()`
- Hidden state semantics enforced

</code_context>

<deferred>
## Deferred Ideas

- Observable behaviors (coughing when infected) — v2 feature for richer inference
- Broadcast speak (multi-target) — v2 feature for group communication
- Move action with pathfinding in contagion scenarios — use VillageScene if needed

</deferred>

---

*Phase: 02-actions-context*
*Context gathered: 2026-03-08*
