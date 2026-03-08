# Phase 3: Transmission - Research

**Researched:** 2026-03-08
**Domain:** Contagion transmission mechanics (proximity and action-directed spread with decay)
**Confidence:** HIGH

## Summary

Phase 3 implements transmission mechanics for the contagion framework. The existing infrastructure from Phases 1 and 2 provides a solid foundation: `StateTransition` rules already support `trigger_type` ("proximity", "action", "decay"), `check_probability()` is ready for random rolls, and `ContagionScene.pre_turn_rules()` already evaluates decay transitions. The work involves extending this system with proximity evaluation (bidirectional adjacent-agent spread) and action-directed transmission (SpeakToAction hook).

**Primary recommendation:** Extend `pre_turn_rules()` for proximity spread AFTER decay evaluation, and add `check_action_transmission()` method called from `SpeakToAction.handle()` after successful message delivery. Keep all state transitions flowing through the existing `_apply_transition()` method for consistent logging.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Proximity Transmission
- **Evaluation timing** — Proximity spread evaluated in `pre_turn_rules()` AFTER decay rules, BEFORE agents act
- **Directionality** — Bidirectional: any infected-susceptible pair can trigger spread, regardless of who "initiates"
- **Per-pair probability** — Each adjacent infected-susceptible pair gets ONE probability roll per turn
- **No chaining** — Newly infected agents in current turn do NOT spread to others until next turn
- **Probability source** — Uses rule's `probability` field for proximity-triggered transitions

#### Action-Directed Transmission (Speak)
- **Trigger point** — SpeakToAction.handle() checks for transmission AFTER successful message delivery
- **Directionality** — Sender-to-target only: infected sender can infect susceptible target, not reverse
- **Feedback** — Agents do NOT receive explicit feedback about transmission events (maintains hidden state semantics)
- **Probability source** — Uses rule's `probability` field for action-triggered transitions
- **Integration** — SpeakToAction calls scene method `check_action_transmission()` to evaluate and apply

#### Event Logging
- **TransitionEvent enhancement** — Add `source_agent_id` field (optional, for proximity/action triggers)
- **Trigger types** — "proximity", "action", or "decay" as defined in Phase 1
- **Proximity events** — `source_agent_id` = the infected agent who caused the spread
- **Action events** — `source_agent_id` = the speaker who triggered transmission
- **Decay events** — `source_agent_id` = None (no external source)

#### Rule Precedence
- **First-match-wins** — For each agent, evaluate rules in order; first matching rule applies
- **Proximity before action** — If both apply same turn, proximity is evaluated first (in pre_turn_rules), then action (during turn execution)
- **No cumulative rolls** — One probability check per rule per agent per trigger opportunity
- **State change blocks re-infection** — Agent who transitions can't be re-infected same turn (state already changed)

### Claude's Discretion
- Exact method names for new transmission evaluation methods
- Whether to add a dedicated `Transmitter` mixin or keep logic in ContagionScene
- Performance optimizations for large grids (spatial indexing)
- Test file organization

### Deferred Ideas (OUT OF SCOPE)
- Observable transmission symptoms (coughing) — v2 feature for richer inference
- Multi-target speak (broadcast) — v2 feature for group communication
- Complex rules with conditional probability — v2 feature for crowded-cell effects
- YAML configuration for transmission rules — v2 feature for experiment flexibility
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROX-01 | Scene evaluates proximity-based rules each turn for adjacent agent pairs | Extend `pre_turn_rules()` with `_evaluate_proximity_rules()` after decay; use `get_moore_neighbors()` + position lookup |
| PROX-02 | When infected agent is adjacent to susceptible agent, probability check determines if transmission occurs | Reuse `check_probability(rule.probability)`; match rules by `from_state`, `trigger_type="proximity"` |
| PROX-03 | Transmission probability is configurable per rule | Already supported: `StateTransition.probability` field |
| PROX-04 | State transitions are logged with timestamp, agent IDs, and trigger type | Extend `TransitionEvent` with `source_agent_id`; update `_apply_transition()` signature |
| ACT-01 | Speak action can trigger state transition in target agent (e.g., spreading information) | Add `check_action_transmission(sender, target)` to ContagionScene; call from `SpeakToAction.handle()` |
| ACT-02 | Transition probability is checked when speak action targets an agent | Same `check_probability()` mechanism; match rules with `trigger_type="action"` |
| ACT-03 | Both proximity and action-directed rules use same rule evaluation infrastructure | Both flow through `_apply_transition()`; `TransitionEvent.trigger_type` distinguishes source |
| DECAY-01 | Rules can optionally define decay_turns for automatic state transitions | Already complete in Phase 1: `StateTransition.decay_turns` field |
| DECAY-02 | Scene tracks turns-since-infection per agent for decay evaluation | Already complete: `agent.properties["contagion_turns"]` incremented in `pre_turn_rules()` |
| DECAY-03 | When decay_turns elapsed, agent transitions to rule-defined next state | Already complete: `_evaluate_decay_rules()` checks `turns >= decay_turns` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python | 3.12 | Backend language | Project requirement (CLAUDE.md) |
| dataclasses | stdlib | TransitionEvent, StateTransition | Already in use |
| random | stdlib | check_probability() | Already in use |
| pytest | ^7.4.3 | Testing | Existing test infrastructure |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| unittest.mock | stdlib | Test doubles | Unit tests for isolation |
| typing | stdlib | Optional, List, Dict | Type hints |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending TransitionEvent | Separate TransmissionEvent | Single event type simpler; optional field handles source_agent_id |
| Mixin class for transmission | Keep in ContagionScene | Scene already owns rules and state management; mixin adds unnecessary indirection |
| Spatial indexing | Linear O(n^2) scan | Not needed for v1 grid sizes (<50 agents); defer optimization |

**Installation:**
No new dependencies required. All implementation uses Python standard library.

## Architecture Patterns

### Recommended Project Structure
```
src/socialsim4/core/contagion/
├── __init__.py           # Exports
├── states.py             # ContagionState enum (COMPLETE)
├── rules.py              # StateTransition, check_probability (COMPLETE)
├── statistics.py         # TransitionEvent, ContagionStatistics (NEEDS EXTENSION)
├── scene.py              # ContagionScene (NEEDS EXTENSION)
└── actions.py            # MoveAdjacentAction, SpeakToAction (NEEDS EXTENSION)
```

### Pattern 1: Proximity Transmission in pre_turn_rules()

**What:** Evaluate bidirectional spread between adjacent infected-susceptible pairs BEFORE agents act but AFTER decay.

**When to use:** Every turn, for all agents on the grid.

**Example:**
```python
def pre_turn_rules(self, simulator: "Simulator"):
    # 1. Increment turns for all agents (EXISTING)
    for agent in simulator.agents.values():
        current_turns = agent.properties.get("contagion_turns", 0)
        agent.properties["contagion_turns"] = current_turns + 1

    # 2. Evaluate decay rules (EXISTING)
    for agent in simulator.agents.values():
        self._evaluate_decay_rules(agent, simulator)

    # 3. Evaluate proximity rules (NEW - PHASE 3)
    self._evaluate_proximity_rules(simulator)

    # 4. Update statistics (EXISTING)
    self._update_statistics(simulator)

def _evaluate_proximity_rules(self, simulator: "Simulator"):
    """Check proximity-based transmission for all adjacent agent pairs."""
    # Build position -> agent mapping for O(1) lookup
    position_map = {}
    for agent in simulator.agents.values():
        xy = agent.properties.get("map_xy")
        if xy:
            position_map[(xy[0], xy[1])] = agent

    # Track agents already transitioned this turn (no chaining)
    transitioned = set()

    for agent in simulator.agents.values():
        if agent.name in transitioned:
            continue

        xy = agent.properties.get("map_xy")
        if not xy:
            continue

        current_state = agent.properties.get("contagion_state", "")

        # Check all adjacent cells
        for nx, ny in self.get_moore_neighbors(xy[0], xy[1]):
            neighbor = position_map.get((nx, ny))
            if not neighbor or neighbor.name in transitioned:
                continue

            neighbor_state = neighbor.properties.get("contagion_state", "")

            # Bidirectional: infected-susceptible OR susceptible-infected
            for source, target in [(agent, neighbor), (neighbor, agent)]:
                source_state = source.properties.get("contagion_state", "")
                target_state = target.properties.get("contagion_state", "")

                # Find matching rule
                for rule in self.rules:
                    if rule.trigger_type != "proximity":
                        continue
                    if rule.from_state.value != source_state:
                        continue
                    if target_state != rule.from_state.value:  # Target must be susceptible
                        continue

                    if check_probability(rule.probability):
                        self._apply_transition(target, rule, simulator, source_agent_id=source.name)
                        transitioned.add(target.name)
                        break  # First-match-wins
```

### Pattern 2: Action-Directed Transmission Hook

**What:** SpeakToAction calls scene method to check for transmission AFTER message delivery.

**When to use:** In `SpeakToAction.handle()` after successful message delivery.

**Example:**
```python
# In actions.py - SpeakToAction.handle()
def handle(self, action_data, agent: Agent, simulator: Simulator, scene: Scene):
    # ... existing validation and message delivery ...

    # Create TalkToEvent and deliver to both parties
    event = TalkToEvent(agent.name, target_name, message)
    formatted = event.to_string(scene.state.get("time"))

    # Deliver to sender
    agent.add_env_feedback(formatted)
    # Deliver to target
    target.add_env_feedback(formatted)

    # NEW: Check for action-directed transmission (Phase 3)
    if hasattr(scene, 'check_action_transmission'):
        scene.check_action_transmission(agent, target, simulator)

    result = {"to": target_name, "message": message}
    summary = _localized(agent, f"{agent.name} to {target_name}: {message}",
                               f"{agent.name} 对 {target_name} 说：{message}")
    return True, result, summary, {}, False

# In scene.py - ContagionScene
def check_action_transmission(self, sender: "Agent", target: "Agent", simulator: "Simulator"):
    """Check if action-directed transmission occurs from sender to target."""
    sender_state = sender.properties.get("contagion_state", "")
    target_state = target.properties.get("contagion_state", "")

    for rule in self.rules:
        if rule.trigger_type != "action":
            continue
        if rule.from_state.value != sender_state:
            continue
        # Target must be in a state that can receive transmission
        # (typically susceptible, but depends on rule semantics)

        if check_probability(rule.probability):
            self._apply_transition(target, rule, simulator, source_agent_id=sender.name)
            break  # First-match-wins
```

### Pattern 3: Extended TransitionEvent with source_agent_id

**What:** Add optional field to track transmission source for analysis.

**Example:**
```python
# In statistics.py
@dataclass
class TransitionEvent:
    turn: int
    agent_id: str
    from_state: str
    to_state: str
    trigger_type: str
    source_agent_id: Optional[str] = None  # NEW: For proximity/action triggers

    def to_dict(self) -> dict:
        result = {
            "turn": self.turn,
            "agent_id": self.agent_id,
            "from_state": self.from_state,
            "to_state": self.to_state,
            "trigger_type": self.trigger_type,
        }
        if self.source_agent_id is not None:
            result["source_agent_id"] = self.source_agent_id
        return result
```

### Anti-Patterns to Avoid

- **Chained transmission in same turn:** Newly infected agents must NOT spread to others until next turn. Use a `transitioned` set to track agents who changed state.

- **Feedback about transmission to agents:** Agents should NOT receive explicit "you were infected" messages. Hidden state semantics require inference from behavior only.

- **Cumulative probability rolls:** One roll per rule per agent per turn. Multiple adjacent infected agents do NOT increase probability.

- **Complex conditional rules in v1:** Keep rules simple (from_state, to_state, probability). Conditional logic (e.g., crowded-cell effects) is v2.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Random probability checks | Custom random logic | `check_probability()` from rules.py | Already tested, consistent semantics |
| State transitions | Direct property manipulation | `_apply_transition()` | Ensures logging, statistics, consistency |
| Adjacency queries | Manual distance calculation | `get_moore_neighbors()` + position map | Moore neighborhood already defined |
| Event recording | Custom event classes | `TransitionEvent` with source_agent_id | Extends existing pattern |

**Key insight:** The Phase 1 infrastructure already handles most mechanics. Phase 3 is primarily about connecting the dots: proximity rules call existing `_apply_transition()`, action rules hook into existing action flow.

## Common Pitfalls

### Pitfall 1: Same-Turn Chaining
**What goes wrong:** Agent A infects B in proximity phase, then B immediately infects C in same turn.
**Why it happens:** Not tracking which agents transitioned during proximity evaluation.
**How to avoid:** Maintain `transitioned: Set[str]` during `_evaluate_proximity_rules()` and skip agents in the set.
**Warning signs:** Infection spreads faster than expected; R0 calculations incorrect.

### Pitfall 2: Double Transmission from Bidirectional Pairs
**What goes wrong:** A-B pair evaluated twice (once for A, once for B), causing double probability rolls.
**Why it happens:** Iterating all agents without deduplicating pairs.
**How to avoid:** Track processed pairs or use transitioned set to prevent re-evaluation.
**Warning signs:** Probability appears higher than configured.

### Pitfall 3: Action Transmission Breaks Hidden States
**What goes wrong:** Target agent receives "You were infected by X" message.
**Why it happens:** Adding explicit feedback in action transmission path.
**How to avoid:** Transmission is silent from agent perspective; only statistics/events record it.
**Warning signs:** Agent prompts contain state information about other agents.

### Pitfall 4: Rule Precedence Confusion
**What goes wrong:** Multiple rules could apply; wrong one fires.
**Why it happens:** Not following first-match-wins strictly.
**How to avoid:** Document rule order in scenario configuration; test with overlapping rules.
**Warning signs:** Transitions don't match expected rule probability.

### Pitfall 5: TransitionEvent Backward Compatibility
**What goes wrong:** Existing code breaks after adding source_agent_id.
**Why it happens:** Making source_agent_id required instead of optional.
**How to avoid:** Use `Optional[str] = None` default; only include in to_dict() if not None.
**Warning signs:** Deserialization errors in existing tests.

## Code Examples

Verified patterns from existing codebase:

### Proximity Rule Definition (from rules.py)
```python
# Source: src/socialsim4/core/contagion/rules.py
StateTransition(
    from_state=ContagionState.INFECTED,
    to_state=ContagionState.SUSCEPTIBLE,  # Actually SUSCEPTIBLE -> INFECTED
    trigger_type="proximity",
    probability=0.3
)
```

### Decay Rule Evaluation (from scene.py)
```python
# Source: src/socialsim4/core/contagion/scene.py lines 121-142
def _evaluate_decay_rules(self, agent: "Agent", simulator: "Simulator"):
    current_state = agent.properties.get("contagion_state", "")
    turns = agent.properties.get("contagion_turns", 0)

    for rule in self.rules:
        if rule.trigger_type != "decay":
            continue
        if rule.from_state.value == current_state:
            if turns >= rule.decay_turns:
                self._apply_transition(agent, rule, simulator)
                break  # Only one transition per turn
```

### Apply Transition (from scene.py)
```python
# Source: src/socialsim4/core/contagion/scene.py lines 144-172
def _apply_transition(
    self, agent: "Agent", rule: StateTransition, simulator: "Simulator"
):
    from_state = agent.properties.get("contagion_state", "")

    # Update agent state
    agent.properties["contagion_state"] = rule.to_state.value
    agent.properties["contagion_turns"] = 0

    # Record transition event
    event = TransitionEvent(
        turn=simulator.turns,
        agent_id=agent.name,
        from_state=from_state,
        to_state=rule.to_state.value,
        trigger_type=rule.trigger_type
    )
    self._statistics.record_transition(event)
```

### Position-to-Agent Lookup Pattern
```python
# Derived from get_adjacent_agents pattern in scene.py lines 217-252
def _build_position_map(self, simulator: "Simulator") -> Dict[Tuple[int, int], "Agent"]:
    """Build mapping from (x, y) coordinates to agent objects."""
    position_map = {}
    for agent in simulator.agents.values():
        xy = agent.properties.get("map_xy")
        if xy:
            position_map[(xy[0], xy[1])] = agent
    return position_map
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A (new feature) | Proximity transmission in pre_turn_rules | Phase 3 | Consistent with decay evaluation pattern |
| N/A (new feature) | Action transmission via scene method | Phase 3 | Maintains action-scene separation |
| TransitionEvent without source | TransitionEvent with source_agent_id | Phase 3 | Enables transmission chain analysis |

**Deprecated/outdated:**
- None for this phase (new functionality)

## Open Questions

1. **Should check_action_transmission be on the scene or a separate module?**
   - What we know: CONTEXT.md says Claude's discretion on mixin vs scene.
   - What's unclear: Future extensibility needs.
   - Recommendation: Keep in ContagionScene for v1. Single class is simpler; extract to mixin only if transmission logic becomes complex.

2. **Should proximity rules support different source states (not just INFECTED)?**
   - What we know: Current rules match on from_state.
   - What's unclear: Whether EXPOSED agents should spread.
   - Recommendation: Rules are declarative. Scenario author defines which states spread. Code matches any rule where infected agent's state == rule.from_state.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest ^7.4.3 |
| Config file | pyproject.toml (tool.pytest.ini_options) |
| Quick run command | `pytest tests/unit/test_contagion_scene.py -x -v` |
| Full suite command | `pytest tests/ -v` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROX-01 | Proximity rules evaluated each turn | unit | `pytest tests/unit/test_contagion_transmission.py::test_proximity_rules_evaluated -xvs` | Wave 0 |
| PROX-02 | Probability check determines spread | unit | `pytest tests/unit/test_contagion_transmission.py::test_proximity_probability -xvs` | Wave 0 |
| PROX-03 | Probability configurable per rule | unit | `pytest tests/unit/test_contagion_transmission.py::test_proximity_configurable -xvs` | Wave 0 |
| PROX-04 | Transitions logged with source | unit | `pytest tests/unit/test_contagion_transmission.py::test_proximity_logging -xvs` | Wave 0 |
| ACT-01 | Speak triggers transmission | unit | `pytest tests/unit/test_contagion_actions.py::test_speak_transmission -xvs` | Wave 0 |
| ACT-02 | Probability checked on speak | unit | `pytest tests/unit/test_contagion_actions.py::test_speak_probability -xvs` | Wave 0 |
| ACT-03 | Same rule infrastructure | unit | `pytest tests/unit/test_contagion_transmission.py::test_shared_infrastructure -xvs` | Wave 0 |
| DECAY-01 | Already complete | unit | `pytest tests/unit/test_contagion_scene.py::TestContagionSceneDecayRules -xvs` | YES |
| DECAY-02 | Already complete | unit | `pytest tests/unit/test_contagion_scene.py::test_pre_turn_rules_increments_contagion_turns -xvs` | YES |
| DECAY-03 | Already complete | unit | `pytest tests/unit/test_contagion_scene.py::test_decay_transition_only_when_turns_exceeds_threshold -xvs` | YES |

### Sampling Rate
- **Per task commit:** `pytest tests/unit/test_contagion_transmission.py -x -v`
- **Per wave merge:** `pytest tests/unit/ -v`
- **Phase gate:** `pytest tests/ -v` (full suite green)

### Wave 0 Gaps
- [ ] `tests/unit/test_contagion_transmission.py` - new test file for proximity and action transmission
- [ ] `tests/unit/test_contagion_actions.py` - extend existing file with transmission tests for SpeakToAction
- [ ] Update `tests/unit/test_contagion_statistics.py` - add tests for source_agent_id field

*(DECAY-01, DECAY-02, DECAY-03 are already covered by existing test_contagion_scene.py)*

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/socialsim4/core/contagion/scene.py` - ContagionScene implementation
- Existing codebase: `src/socialsim4/core/contagion/rules.py` - StateTransition, check_probability
- Existing codebase: `src/socialsim4/core/contagion/statistics.py` - TransitionEvent structure
- Existing codebase: `src/socialsim4/core/contagion/actions.py` - SpeakToAction implementation
- CONTEXT.md - User decisions from discuss-phase

### Secondary (MEDIUM confidence)
- `tests/unit/test_contagion_scene.py` - Existing test patterns and mock usage
- `tests/unit/test_contagion_rules.py` - check_probability test patterns

### Tertiary (LOW confidence)
- None required - all implementation is based on existing codebase patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All components already exist in codebase
- Architecture: HIGH - Patterns established in Phases 1 and 2, extension points clear
- Pitfalls: HIGH - Based on direct code analysis and requirement specifications

**Research date:** 2026-03-08
**Valid until:** 30 days (stable infrastructure, no external dependencies)
