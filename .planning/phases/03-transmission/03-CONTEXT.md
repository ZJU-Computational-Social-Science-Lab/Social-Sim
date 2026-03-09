# Phase 3: Transmission - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Contagion spreads through proximity (adjacent agents) and directed actions (speak), with automatic state recovery based on configured decay rules. This phase adds transmission mechanics to the existing state infrastructure from Phase 1 and action framework from Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Proximity Transmission
- **Evaluation timing** — Proximity spread evaluated in `pre_turn_rules()` AFTER decay rules, BEFORE agents act
- **Directionality** — Bidirectional: any infected-susceptible pair can trigger spread, regardless of who "initiates"
- **Per-pair probability** — Each adjacent infected-susceptible pair gets ONE probability roll per turn
- **No chaining** — Newly infected agents in current turn do NOT spread to others until next turn
- **Probability source** — Uses rule's `probability` field for proximity-triggered transitions

### Action-Directed Transmission (Speak)
- **Trigger point** — SpeakToAction.handle() checks for transmission AFTER successful message delivery
- **Directionality** — Sender-to-target only: infected sender can infect susceptible target, not reverse
- **Feedback** — Agents do NOT receive explicit feedback about transmission events (maintains hidden state semantics)
- **Probability source** — Uses rule's `probability` field for action-triggered transitions
- **Integration** — SpeakToAction calls scene method `check_action_transmission()` to evaluate and apply

### Event Logging
- **TransitionEvent enhancement** — Add `source_agent_id` field (optional, for proximity/action triggers)
- **Trigger types** — "proximity", "action", or "decay" as defined in Phase 1
- **Proximity events** — `source_agent_id` = the infected agent who caused the spread
- **Action events** — `source_agent_id` = the speaker who triggered transmission
- **Decay events** — `source_agent_id` = None (no external source)

### Rule Precedence
- **First-match-wins** — For each agent, evaluate rules in order; first matching rule applies
- **Proximity before action** — If both apply same turn, proximity is evaluated first (in pre_turn_rules), then action (during turn execution)
- **No cumulative rolls** — One probability check per rule per agent per trigger opportunity
- **State change blocks re-infection** — Agent who transitions can't be re-infected same turn (state already changed)

### Claude's Discretion
- Exact method names for new transmission evaluation methods
- Whether to add a dedicated `Transmitter` mixin or keep logic in ContagionScene
- Performance optimizations for large grids (spatial indexing)
- Test file organization

</decisions>

<specifics>
## Specific Ideas

- Reuse existing `check_probability()` from rules.py for transmission rolls
- Add transmission check to SpeakToAction.handle() after successful message delivery
- Extend TransitionEvent dataclass with optional source_agent_id field
- Scene method `check_proximity_transmission()` called from `pre_turn_rules()`
- Scene method `check_action_transmission(sender, target)` called from SpeakToAction

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- **StateTransition** (`contagion/rules.py`): Already has trigger_type="proximity" and trigger_type="action" support
- **check_probability()** (`contagion/rules.py`): Random roll utility ready to use
- **ContagionScene.pre_turn_rules()** (`contagion/scene.py`): Extension point for proximity evaluation
- **ContagionScene._apply_transition()** (`contagion/scene.py`): Applies state changes, records events
- **ContagionScene.get_adjacent_agents()** (`contagion/scene.py`): Returns agent names in Moore neighborhood
- **TransitionEvent** (`contagion/statistics.py`): Records turn, agent_id, from_state, to_state, trigger_type
- **SpeakToAction.handle()** (`contagion/actions.py`): Extension point for action-directed transmission

### Established Patterns
- **Rule evaluation order**: Decay already evaluated in pre_turn_rules(), add proximity after
- **State transitions via _apply_transition()**: Centralized method ensures consistent logging
- **Hidden states**: Agents don't see transmission feedback directly, only infer from behavior
- **Per-turn state changes**: Once an agent transitions, they can't transition again until next turn

### Integration Points
- Extend `ContagionScene.pre_turn_rules()` to evaluate proximity rules after decay
- Extend `SpeakToAction.handle()` to call scene transmission check after message delivery
- Extend `TransitionEvent` dataclass with optional `source_agent_id` field
- Update `ContagionStatistics` to track source info if needed for analysis

### Already Complete (Phases 1 & 2)
- ContagionState enum (SUSCEPTIBLE, INFECTED, RECOVERED, EXPOSED)
- StateTransition dataclass with trigger_type field
- Decay rule evaluation in pre_turn_rules()
- Moore neighborhood adjacency via get_moore_neighbors()
- MoveAdjacentAction for 8-way movement
- SpeakToAction for targeted communication
- Hidden state semantics enforced in agent prompts

</code_context>

<deferred>
## Deferred Ideas

- Observable transmission symptoms (coughing) — v2 feature for richer inference
- Multi-target speak (broadcast) — v2 feature for group communication
- Complex rules with conditional probability — v2 feature for crowded-cell effects
- YAML configuration for transmission rules — v2 feature for experiment flexibility

</deferred>

---

*Phase: 03-transmission*
*Context gathered: 2026-03-08*
