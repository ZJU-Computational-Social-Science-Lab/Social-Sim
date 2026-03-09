# Phase 2: Actions & Context - Research

**Researched:** 2026-03-08
**Domain:** Grid-based agent actions (move, speak) and context integration for contagion simulation
**Confidence:** HIGH

## Summary

Phase 2 implements MoveAction for single-cell adjacent movement and SpeakToAction for targeted communication between agents. Both actions follow the existing platform pattern: Action base class with NAME, DESC, INSTRUCTION, and handle() method returning a 5-tuple. The context integration (CTX-01, CTX-02) was already completed in Phase 1 via `get_agent_status_prompt()` in ContagionScene.

**Primary recommendation:** Create `src/socialsim4/core/contagion/actions.py` with `MoveAdjacentAction` and `SpeakToAction`, following the patterns in `base_actions.py` and `village_actions.py`. Use the existing `_localized()` helper for i18n support.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Implementation Decisions

#### Move Action Design
- **New action class** — Create `MoveAdjacentAction` separate from existing `MoveToLocationAction`. Single-cell moves for contagion dynamics, pathfinding moves for village scenarios.
- **8-way compass directions** — Directions: north, northeast, east, southeast, south, southwest, west, northwest. Matches Moore neighborhood from Phase 1.
- **Collision handling** — Fail with feedback: "Cell occupied by [agent_name], move failed." Agent must choose different direction.
- **Boundary handling** — Fail with feedback: "Cannot move [direction] - at grid boundary." No wrapping.
- **Action XML format** — `<Action name="move"><direction>north</direction></Action>`

#### Speak Action Design
- **Two-step prompt pattern** — Agent first responds with speak action + target, then gets reprompted for message content. More natural LLM interaction.
- **Moore neighborhood adjacency** — Speak only works to agents in 8 adjacent cells. Consistent with hidden states and Phase 3 transmission mechanics.
- **Status prompt delivery** — Message appears in target's status prompt next turn: "[Sender] said to you: [message]". Consistent with Phase 1 pattern.
- **Action XML format (step 1)** — `<Action name="speak"><target>Alice</target></Action>`
- **Message collection (step 2)** — Separate prompt asking for freetext message content

#### Action Context Format
- **Show all action instructions** — Prompt includes INSTRUCTION from all available actions. Consistent with existing platform pattern.
- **Full adjacent cell context** — Status prompt shows all 8 adjacent cells with contents: "North: boundary, NE: empty, East: Alice, SE: empty, South: empty, SW: Bob, West: empty, NW: boundary". Enables informed movement decisions without trial-and-error.
- **Agent names only (hidden states)** — Adjacent cells show agent names but NOT their contagion states. Maintains HIDE-01/HIDE-02 semantics from Phase 1.
- **No re-prompt on failure** — Since agents see all adjacent cell contents upfront, move actions should always succeed to valid destinations. Invalid moves (boundary/occupied) are filtered by context visibility.

#### File Organization
- **New contagion/actions.py** — Actions live in `src/socialsim4/core/contagion/actions.py`. Clean separation from village actions.
- **Scene registration** — ContagionScene registers its own actions in `get_scene_actions()`.

### Claude's Discretion
- Energy cost for move action (follow VillageScene's movement_cost pattern or make free)
- Message length limits for speak
- Action ordering in prompt (alphabetical or priority-based)
- Test file location (tests/unit/contagion/ vs tests/unit/core/contagion/)

### Deferred Ideas (OUT OF SCOPE)
- Observable behaviors (coughing when infected) — v2 feature for richer inference
- Broadcast speak (multi-target) — v2 feature for group communication
- Move action with pathfinding in contagion scenarios — use VillageScene if needed
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MOVE-01 | Agent can move to an adjacent cell via move(direction) action | MoveAdjacentAction class pattern documented below |
| MOVE-02 | Move action follows existing action pattern (JSON response format) | Action base class return tuple format documented |
| MOVE-03 | Move action validates target cell is adjacent and unoccupied | Moore neighborhood lookup via `get_moore_neighbors()`, collision check pattern |
| COMM-01 | Agent can speak to a specific nearby agent via speak(target_id) action | SpeakToAction class pattern with Moore adjacency check |
| COMM-02 | Speak action uses two-step prompt pattern | Platform pattern: first action selection, then freetext message collection |
| COMM-03 | Speak action validates target agent is in adjacent cell | Moore neighborhood lookup, same pattern as move adjacency |
| COMM-04 | Message content is delivered to target agent's context on next turn | `target.add_env_feedback()` pattern from TalkToAction |
| CTX-01 | Agent prompt includes their own current contagion state | Already implemented in Phase 1 via `get_agent_status_prompt()` |
| CTX-02 | Agent prompt includes list of nearby agent IDs (not their states) | Already implemented in Phase 1 via `get_adjacent_agents()` |
| CTX-03 | Agent prompt follows existing pattern: description, scenario, context, available actions | Agent.system_prompt() pattern documented, scene actions registered via `get_scene_actions()` |
| CTX-04 | Agent responds in JSON format for action selection (existing pattern) | Platform JSON output format in Agent.system_prompt() |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python | 3.12 | Backend language | Project constraint, 3.14 incompatible |
| pytest | ^9.0 | Test framework | Existing test infrastructure |

### Supporting (Existing Infrastructure)
| Module | Purpose | When to Use |
|--------|---------|-------------|
| `core/action.py` | Action base class | All actions extend this class |
| `core/event.py` | Event types (TalkToEvent, SpeakEvent) | Communication events |
| `core/scenes/village_scene.py` | GameMap, VillageScene | Grid positioning, adjacency queries |
| `core/contagion/scene.py` | ContagionScene | Scene for contagion simulations |
| `core/agent/agent.py` | Agent class with add_env_feedback | Message delivery, context updates |

### Reusable Patterns
| Pattern | Source | Use For |
|---------|--------|---------|
| `_localized()` helper | `actions/base_actions.py` | i18n support in action feedback |
| Action return tuple | `core/action.py` | All action handle() methods |
| `get_moore_neighbors()` | `contagion/scene.py` | 8-directional adjacency |
| `get_adjacent_agents()` | `contagion/scene.py` | Agent names in adjacent cells |

**No new dependencies required.**

## Architecture Patterns

### Recommended Project Structure
```
src/socialsim4/core/contagion/
├── __init__.py           # Exports: ContagionState, StateTransition, ContagionScene, MoveAdjacentAction, SpeakToAction
├── states.py             # ContagionState enum (COMPLETE)
├── rules.py              # StateTransition dataclass (COMPLETE)
├── statistics.py         # ContagionStatistics (COMPLETE)
├── scene.py              # ContagionScene (COMPLETE - needs get_scene_actions override)
└── actions.py            # NEW: MoveAdjacentAction, SpeakToAction

tests/unit/
├── test_contagion_states.py     (COMPLETE)
├── test_contagion_rules.py      (COMPLETE)
├── test_contagion_statistics.py (COMPLETE)
├── test_contagion_scene.py      (COMPLETE)
└── test_contagion_actions.py    # NEW: Action unit tests

tests/integration/
└── test_contagion_grid.py       (COMPLETE)
```

### Pattern 1: Action Class Structure
**What:** All actions follow the same class structure with NAME, DESC, INSTRUCTION, and handle() method.
**When to use:** For every new action in the system.
**Example:**
```python
# Source: src/socialsim4/core/action.py + actions/base_actions.py
from socialsim4.core.action import Action

class MoveAdjacentAction(Action):
    NAME = "move"
    DESC = "Move to an adjacent cell in one of 8 directions."
    INSTRUCTION = """- move: Move one cell in a compass direction
  <Action name="move"><direction>north</direction></Action>
  Directions: north, northeast, east, southeast, south, southwest, west, northwest
"""

    def handle(self, action_data, agent, simulator, scene):
        # 1. Extract direction from action_data
        # 2. Validate direction is valid compass direction
        # 3. Calculate target coordinates from current position
        # 4. Validate: in bounds (game_map.in_bounds)
        # 5. Validate: not occupied (check other agents' map_xy)
        # 6. Update agent.properties["map_xy"]
        # 7. Return 5-tuple: (success, result, summary, {}, False)
        return True, {"from": start, "to": target}, "Alice moved north", {}, False
```

### Pattern 2: Action Return Tuple
**What:** All handle() methods return a 5-tuple with specific semantics.
**When to use:** Every action implementation.
**Example:**
```python
# Source: src/socialsim4/core/action.py
def handle(self, action_data, agent, simulator, scene):
    """
    Return a 5-tuple:
    (success: bool, result: dict, summary: str, meta: dict, pass_control: bool)
    - success: did the action execute successfully
    - result: minimal machine-readable outcome
    - summary: one-line human-readable summary for transcripts
    - meta: optional extra info (scene-specific). Use {} if unused.
    - pass_control: whether to pass control to the next agent immediately
    """
```

### Pattern 3: Two-Step Speak Pattern
**What:** Speak action uses two LLM calls: first to select action+target, second to collect message.
**When to use:** When action requires freetext content that shouldn't be in XML.
**Example:**
```python
# Step 1: Agent responds with action selection (in XML)
<Action name="speak"><target>Alice</target></Action>

# Step 2: System reprompts agent for message content
# (handled by simulator/agent interaction loop, not action itself)
# The action only validates and delivers the message once collected.
```

### Pattern 4: Localization with _localized()
**What:** Use the existing `_localized()` helper for bilingual feedback.
**When to use:** All user-facing action feedback messages.
**Example:**
```python
# Source: src/socialsim4/core/actions/base_actions.py
def _localized(agent: Agent, en_text: str, zh_text: str) -> str:
    return en_text if _is_english_language(getattr(agent, "language", "")) else zh_text

# Usage:
agent.add_env_feedback(
    _localized(agent, f"Cannot move {direction} - at grid boundary.", f"无法向{direction}移动 - 已在网格边界。")
)
```

### Pattern 5: Adjacent Cell Context in Status Prompt
**What:** Extend status prompt to show all 8 adjacent cells with their contents.
**When to use:** ContagionScene.get_agent_status_prompt() extension.
**Example:**
```python
# Add to get_agent_status_prompt() in ContagionScene
def get_agent_status_prompt(self, agent: Agent) -> str:
    # ... existing code ...

    # Add adjacent cells with full visibility
    directions = [
        ("North", (0, -1)), ("NE", (1, -1)), ("East", (1, 0)), ("SE", (1, 1)),
        ("South", (0, 1)), ("SW", (-1, 1)), ("West", (-1, 0)), ("NW", (-1, -1))
    ]
    xy = agent.properties.get("map_xy", [0, 0])
    adjacent_info = []
    for name, (dx, dy) in directions:
        nx, ny = xy[0] + dx, xy[1] + dy
        if not self.game_map.in_bounds(nx, ny):
            adjacent_info.append(f"{name}: boundary")
        else:
            # Check for agents at this cell
            agents_here = [a.name for a in simulator.agents.values()
                          if a.properties.get("map_xy") == [nx, ny] and a.name != agent.name]
            if agents_here:
                adjacent_info.append(f"{name}: {', '.join(agents_here)}")
            else:
                adjacent_info.append(f"{name}: empty")

    status_lines.append("Adjacent cells: " + ", ".join(adjacent_info))
```

### Anti-Patterns to Avoid
- **Defensive coding in core actions:** Do NOT use try/except, isinstance, or hasattr checks. Follow AGENTS.md style - access fields directly, let exceptions surface.
- **Creating new event types unnecessarily:** Reuse TalkToEvent for speak action, don't create SpeakToEvent unless needed.
- **Storing message for delivery in action:** Messages are delivered immediately via `target.add_env_feedback()`, not queued.
- **Hiding adjacent cell information:** Context must show ALL 8 cells, not just those with agents.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Direction to coordinate mapping | Custom mapping dict | DIRECTION_DELTAS constant | Simple, reusable |
| Adjacency validation | Custom bounds check | `game_map.in_bounds(x, y)` | Handles edge cases |
| Message delivery | Custom event queue | `target.add_env_feedback()` | Existing pattern |
| Localization | Custom i18n | `_localized()` helper | Consistent with platform |
| Agent lookup by position | O(n) scan each time | Pre-compute or use existing `get_adjacent_agents()` | Performance |

**Key insight:** The existing action infrastructure is mature and well-tested. New actions should follow the exact patterns from `base_actions.py` and `village_actions.py`.

## Common Pitfalls

### Pitfall 1: Direction Enum vs String
**What goes wrong:** Using enum for directions when CONTEXT.md specifies string directions.
**Why it happens:** Enums seem "cleaner" but add complexity for LLM output parsing.
**How to avoid:** Use string literals: "north", "northeast", etc. Map to coordinate deltas with a simple constant.
**Warning signs:** LLM responses failing to parse direction values.

### Pitfall 2: Collision Detection Race Condition
**What goes wrong:** Two agents move to the same cell in the same turn.
**Why it happens:** Checking occupancy before updating positions, but another agent moves first.
**How to avoid:** Check current agent positions at action execution time. If occupied, fail with feedback. Agent must retry next turn.
**Warning signs:** Agents overlapping on grid, position desynchronization.

### Pitfall 3: Message Delivery Timing
**What goes wrong:** Message delivered immediately but appears in target's context before their turn.
**Why it happens:** `add_env_feedback()` appends to memory immediately.
**How to avoid:** This is actually correct behavior per COMM-04 ("delivered to target agent's context on next turn"). The target will see the message when they process their turn.
**Warning signs:** Confusion about when messages appear.

### Pitfall 4: Hidden State Leakage in Error Messages
**What goes wrong:** Error message reveals other agent's contagion state.
**Why it happens:** Including state info in "cell occupied" feedback.
**How to avoid:** Only show agent names in collision messages: "Cell occupied by Alice, move failed." Never include state info.
**Warning signs:** Error messages containing "infected", "susceptible", etc.

### Pitfall 5: Boundary vs Collision Confusion
**What goes wrong:** Same error message for boundary and collision failures.
**Why it happens:** Using generic "move failed" message.
**How to avoid:** Distinct messages: "Cannot move north - at grid boundary" vs "Cell occupied by Alice, move failed."
**Warning signs:** Agents unable to distinguish why move failed.

## Code Examples

### MoveAdjacentAction Implementation
```python
# Source: Pattern from actions/base_actions.py + actions/village_actions.py
# File: src/socialsim4/core/contagion/actions.py

from socialsim4.core.action import Action
from socialsim4.core.agent import Agent
from socialsim4.core.scene import Scene
from socialsim4.core.simulator import Simulator

# Direction to coordinate delta mapping
DIRECTION_DELTAS = {
    "north": (0, -1),
    "northeast": (1, -1),
    "east": (1, 0),
    "southeast": (1, 1),
    "south": (0, 1),
    "southwest": (-1, 1),
    "west": (-1, 0),
    "northwest": (-1, -1),
}

def _is_english_language(lang: str | None) -> bool:
    lower = str(lang or "").lower()
    return lower.startswith("en") or "english" in lower

def _localized(agent: Agent, en_text: str, zh_text: str) -> str:
    return en_text if _is_english_language(getattr(agent, "language", "")) else zh_text


class MoveAdjacentAction(Action):
    NAME = "move"
    DESC = "Move to an adjacent cell in one of 8 directions."
    INSTRUCTION = """- move: Move one cell in a compass direction
  <Action name="move"><direction>north</direction></Action>
  Valid directions: north, northeast, east, southeast, south, southwest, west, northwest
"""

    def handle(self, action_data, agent: Agent, simulator: Simulator, scene: Scene):
        direction = action_data.get("direction", "").lower()

        # Validate direction
        if direction not in DIRECTION_DELTAS:
            agent.add_env_feedback(
                _localized(
                    agent,
                    f"Invalid direction '{direction}'. Use: north, northeast, east, southeast, south, southwest, west, northwest.",
                    f"无效的方向 '{direction}'。请使用：north, northeast, east, southeast, south, southwest, west, northwest。"
                )
            )
            return False, {"error": "invalid_direction", "direction": direction}, _localized(agent, f"{agent.name} move failed", f"{agent.name} 移动失败"), {}, False

        # Get current position
        xy = agent.properties.get("map_xy")
        if not xy:
            agent.add_env_feedback(_localized(agent, "Position unknown.", "位置未知。"))
            return False, {"error": "no_position"}, _localized(agent, f"{agent.name} move failed", f"{agent.name} 移动失败"), {}, False

        # Calculate target position
        dx, dy = DIRECTION_DELTAS[direction]
        target_x, target_y = xy[0] + dx, xy[1] + dy

        # Check bounds
        if not scene.game_map.in_bounds(target_x, target_y):
            agent.add_env_feedback(
                _localized(
                    agent,
                    f"Cannot move {direction} - at grid boundary.",
                    f"无法向 {direction} 移动 - 已在网格边界。"
                )
            )
            return False, {"error": "boundary", "direction": direction}, _localized(agent, f"{agent.name} move failed", f"{agent.name} 移动失败"), {}, False

        # Check for collision with other agents
        for other_name, other_agent in simulator.agents.items():
            if other_name == agent.name:
                continue
            other_xy = other_agent.properties.get("map_xy")
            if other_xy and other_xy[0] == target_x and other_xy[1] == target_y:
                agent.add_env_feedback(
                    _localized(
                        agent,
                        f"Cell occupied by {other_name}, move failed.",
                        f"单元格被 {other_name} 占用，移动失败。"
                    )
                )
                return False, {"error": "occupied", "by": other_name}, _localized(agent, f"{agent.name} move failed", f"{agent.name} 移动失败"), {}, False

        # Execute move
        start_xy = [xy[0], xy[1]]
        agent.properties["map_xy"] = [target_x, target_y]

        # Update map_position if on a named location
        loc = scene.game_map.get_location_at(target_x, target_y)
        agent.properties["map_position"] = loc.name if loc else f"{target_x},{target_y}"

        agent.add_env_feedback(
            _localized(
                agent,
                f"You moved {direction} to ({target_x}, {target_y}).",
                f"你向 {direction} 移动到了 ({target_x}, {target_y})。"
            )
        )

        result = {"from": start_xy, "to": [target_x, target_y], "direction": direction}
        summary = _localized(agent, f"{agent.name} moved {direction}", f"{agent.name} 向 {direction} 移动")
        return True, result, summary, {}, False
```

### SpeakToAction Implementation
```python
# Source: Pattern from actions/base_actions.py TalkToAction
# File: src/socialsim4/core/contagion/actions.py (same file as MoveAdjacentAction)

from socialsim4.core.event import TalkToEvent


class SpeakToAction(Action):
    NAME = "speak"
    DESC = "Speak to a nearby agent (adjacent cell only)."
    INSTRUCTION = """- speak: Say something to an adjacent agent
  <Action name="speak"><target>Alice</target><message>Your message here</message></Action>
  Target must be in one of your 8 adjacent cells.
"""

    def handle(self, action_data, agent: Agent, simulator: Simulator, scene: Scene):
        target_name = action_data.get("target")
        message = action_data.get("message")

        if not target_name:
            agent.add_env_feedback(_localized(agent, "Provide a 'target' agent name.", "请提供目标智能体名称。"))
            return False, {"error": "missing_target"}, _localized(agent, f"{agent.name} speak failed", f"{agent.name} 说话失败"), {}, False

        if not message:
            agent.add_env_feedback(_localized(agent, "Provide a 'message' to speak.", "请提供要说的消息内容。"))
            return False, {"error": "missing_message"}, _localized(agent, f"{agent.name} speak failed", f"{agent.name} 说话失败"), {}, False

        target = simulator.agents.get(target_name)
        if not target:
            agent.add_env_feedback(_localized(agent, f"No such agent: {target_name}.", f"不存在该智能体：{target_name}。"))
            return False, {"error": "unknown_target", "target": target_name}, _localized(agent, f"{agent.name} speak failed", f"{agent.name} 说话失败"), {}, False

        # Check Moore neighborhood adjacency (not just Manhattan distance)
        agent_xy = agent.properties.get("map_xy")
        target_xy = target.properties.get("map_xy")

        if not agent_xy or not target_xy:
            agent.add_env_feedback(_localized(agent, "Position unknown.", "位置未知。"))
            return False, {"error": "no_position"}, _localized(agent, f"{agent.name} speak failed", f"{agent.name} 说话失败"), {}, False

        dx = abs(agent_xy[0] - target_xy[0])
        dy = abs(agent_xy[1] - target_xy[1])

        # Moore neighborhood: max distance is 1 in both axes
        if dx > 1 or dy > 1:
            agent.add_env_feedback(
                _localized(
                    agent,
                    f"{target_name} is not in an adjacent cell. Speak only works to nearby agents.",
                    f"{target_name} 不在相邻单元格内。说话只能对附近的智能体使用。"
                )
            )
            return False, {"error": "not_adjacent", "target": target_name}, _localized(agent, f"{agent.name} speak failed", f"{agent.name} 说话失败"), {}, False

        # Deliver message to target
        event = TalkToEvent(agent.name, target_name, message)
        time = scene.state.get("time")
        formatted = event.to_string(time)

        # Sender sees their own message
        agent.add_env_feedback(formatted)
        # Target receives the message
        target.add_env_feedback(formatted)

        result = {"to": target_name, "message": message}
        summary = _localized(agent, f"{agent.name} to {target_name}: {message[:50]}...", f"{agent.name} 对 {target_name} 说：{message[:50]}...")
        return True, result, summary, {}, False
```

### ContagionScene.get_scene_actions() Override
```python
# Source: Pattern from VillageScene.get_scene_actions()
# File: src/socialsim4/core/contagion/scene.py (add to existing class)

from socialsim4.core.contagion.actions import MoveAdjacentAction, SpeakToAction

class ContagionScene(VillageScene):
    # ... existing code ...

    def get_scene_actions(self, agent: "Agent"):
        """Return actions available in the contagion scene for this agent."""
        return [
            MoveAdjacentAction(),
            SpeakToAction(),
            *super().get_scene_actions(agent),  # Include any base actions
        ]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TalkToAction with chat_range | SpeakToAction with Moore adjacency | Phase 2 | Single-cell communication for contagion |
| MoveToLocationAction (pathfinding) | MoveAdjacentAction (single-cell) | Phase 2 | One-step moves for disease spread modeling |
| Hidden states inferred only | Adjacent cell names visible | Phase 1 | Agents know who's nearby but not their state |

**Deprecated/outdated:**
- TalkToAction's `chat_range` parameter: SpeakToAction uses strict Moore adjacency (distance 1)

## Open Questions

1. **Energy cost for move action**
   - What we know: VillageScene has `movement_cost` parameter that scales energy consumption
   - What's unclear: Should contagion moves cost energy, or be free for experimentation?
   - Recommendation: Make moves cost 0 energy for v1.0 (Claude's discretion). Add `movement_cost=0` default in ContagionScene or skip energy deduction in MoveAdjacentAction.

2. **Message length limits**
   - What we know: No explicit limits in existing TalkToAction
   - What's unclear: Should we cap message length to prevent context explosion?
   - Recommendation: No limit for v1.0. Let LLM self-regulate. Add truncation in summary if needed.

3. **Action ordering in prompt**
   - What we know: Actions appear in order added to agent.action_space
   - What's unclear: Should move come before speak, or alphabetically?
   - Recommendation: Register MoveAdjacentAction first, then SpeakToAction. Movement is more fundamental for contagion scenarios.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest ^9.0 |
| Config file | pytest.ini (root) |
| Quick run command | `pytest tests/unit/test_contagion_actions.py -x` |
| Full suite command | `pytest tests/ -v` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MOVE-01 | Agent moves to adjacent cell | unit | `pytest tests/unit/test_contagion_actions.py::TestMoveAdjacentAction::test_move_to_valid_adjacent_cell -x` | Wave 0 |
| MOVE-02 | Move follows JSON pattern | unit | `pytest tests/unit/test_contagion_actions.py::TestMoveAdjacentAction::test_move_returns_valid_tuple -x` | Wave 0 |
| MOVE-03 | Move validates adjacent + unoccupied | unit | `pytest tests/unit/test_contagion_actions.py::TestMoveAdjacentAction::test_move_blocked_by_occupied_cell -x` | Wave 0 |
| COMM-01 | Agent speaks to nearby target | unit | `pytest tests/unit/test_contagion_actions.py::TestSpeakToAction::test_speak_to_adjacent_agent -x` | Wave 0 |
| COMM-02 | Speak uses two-step pattern | integration | `pytest tests/integration/test_contagion_actions.py -x` | Wave 0 |
| COMM-03 | Speak validates adjacency | unit | `pytest tests/unit/test_contagion_actions.py::TestSpeakToAction::test_speak_blocked_by_non_adjacent -x` | Wave 0 |
| COMM-04 | Message delivered to target context | unit | `pytest tests/unit/test_contagion_actions.py::TestSpeakToAction::test_message_delivered_to_target -x` | Wave 0 |
| CTX-01 | Prompt includes own state | unit | `pytest tests/unit/test_contagion_scene.py::TestAgentStatusPrompt::test_get_agent_status_prompt_includes_own_contagion_state -x` | EXISTS |
| CTX-02 | Prompt includes nearby agent IDs | unit | `pytest tests/unit/test_contagion_scene.py::TestAgentStatusPrompt::test_get_agent_status_prompt_includes_adjacent_agent_names -x` | EXISTS |
| CTX-03 | Prompt follows existing pattern | unit | `pytest tests/unit/test_contagion_scene.py::TestAgentStatusPrompt::test_status_prompt_format_matches_village_scene_pattern -x` | EXISTS |
| CTX-04 | Agent responds in JSON | integration | (Already tested by platform agent tests) | N/A |

### Sampling Rate
- **Per task commit:** `pytest tests/unit/test_contagion_actions.py -x`
- **Per wave merge:** `pytest tests/unit/test_contagion*.py tests/integration/test_contagion*.py -v`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/test_contagion_actions.py` — unit tests for MoveAdjacentAction and SpeakToAction
- [ ] `tests/integration/test_contagion_actions.py` — integration tests for two-step speak pattern

## Sources

### Primary (HIGH confidence)
- `src/socialsim4/core/action.py` - Action base class interface
- `src/socialsim4/core/actions/base_actions.py` - TalkToAction, _localized() pattern
- `src/socialsim4/core/actions/village_actions.py` - MoveToLocationAction, energy cost pattern
- `src/socialsim4/core/contagion/scene.py` - ContagionScene, get_moore_neighbors(), get_adjacent_agents()
- `src/socialsim4/core/event.py` - TalkToEvent for message delivery
- `src/socialsim4/core/agent/agent.py` - add_env_feedback() pattern

### Secondary (MEDIUM confidence)
- `.planning/phases/02-actions-context/02-CONTEXT.md` - User decisions and constraints
- `tests/unit/test_contagion_scene.py` - Existing test patterns

### Tertiary (LOW confidence)
- None - all findings verified against source code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, all patterns exist in codebase
- Architecture: HIGH - Clear patterns from existing actions, scene integration well-defined
- Pitfalls: HIGH - Identified from existing code patterns and CONTEXT.md decisions

**Research date:** 2026-03-08
**Valid until:** 30 days (stable patterns, no external dependencies)
