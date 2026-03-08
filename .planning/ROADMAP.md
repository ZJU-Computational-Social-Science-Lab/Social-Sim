# Roadmap: Contagion Spread Framework v1.0

**Created:** 2026-03-08
**Milestone:** v1.0 - Contagion Spread Framework
**Granularity:** Standard (5-8 phases expected, compressed to 3 for focused delivery)

## Phases

- [x] **Phase 1: Core Infrastructure** - State system, rules engine, statistics, grid positioning, and hidden state visibility
- [x] **Phase 2: Actions & Context** - Movement, speak actions, and agent context integration with LLM prompts
- [x] **Phase 3: Transmission** - Proximity-based spread, action-directed transmission, and state decay

## Phase Details

### Phase 1: Core Infrastructure

**Goal**: Agents have contagion states tracked by the simulation with a rule engine for transitions, positioned on a visible grid with hidden state semantics.

**Depends on**: Nothing (first phase)

**Requirements**: CORE-01, CORE-02, CORE-03, CORE-04, CORE-05, CORE-06, GRID-01, GRID-02, GRID-03, GRID-04, HIDE-01, HIDE-02, HIDE-03 (13 requirements)

**Success Criteria** (what must be TRUE):

1. **Agent positioned on grid with visible state** — When user creates a ContagionScene simulation, each agent appears at a unique grid cell and the user (not other agents) can see each agent's contagion state (e.g., SUSCEPTIBLE, INFECTED)
2. **Rules define state transitions** — When user configures contagion rules, the system accepts definitions for from_state, to_state, trigger_type, probability, and optional decay_turns without validation errors
3. **Statistics track spread dynamics** — When simulation runs, user receives WebSocket events showing current counts per state (e.g., "5 susceptible, 3 infected, 2 recovered") and a log of transition events
4. **Agents see neighbors without states** — When agent receives their context prompt, they see a list of adjacent agent IDs but NOT those agents' contagion states (hidden state semantics enforced)
5. **Scene evaluates rules each turn** — When simulation advances one turn, the scene evaluates all configured transition rules before agents take actions, updating agent states based on rule conditions

**Plans**: 3 plans in 2 waves

Plans:
- [x] 01-01-PLAN.md — ContagionState enum and StateTransition dataclass (CORE-01, CORE-02) ✓ Complete 2026-03-08
- [x] 01-02-PLAN.md — ContagionScene with state tracking, rules evaluation, statistics (CORE-03 to CORE-06) ✓ Complete 2026-03-08
- [x] 01-03-PLAN.md — Grid integration and hidden state semantics (GRID-01 to GRID-04, HIDE-01 to HIDE-03) ✓ Complete 2026-03-08

---

### Phase 2: Actions & Context

**Goal**: Agents can move on the grid and speak to nearby agents, with their contagion state integrated into decision-making prompts.

**Depends on**: Phase 1 (agents must exist on grid with states before they can act)

**Requirements**: MOVE-01, MOVE-02, MOVE-03, COMM-01, COMM-02, COMM-03, COMM-04, CTX-01, CTX-02, CTX-03, CTX-04 (11 requirements)

**Success Criteria** (what must be TRUE):

1. **Agent moves to adjacent cell** — When agent chooses move(direction) action, they relocate to the specified adjacent cell if unoccupied, maintaining grid positioning integrity
2. **Agent speaks to nearby target** — When agent selects speak(target_id) action, they provide a freetext message delivered to the target agent's context on the next turn, provided the target is adjacent
3. **Agent prompt includes own state** — When agent receives their LLM prompt, the description includes their current contagion state (e.g., "You are currently INFECTED") so decisions reflect their condition
4. **Agent prompt includes nearby agents** — When agent receives their LLM prompt, the context lists IDs of agents in adjacent cells (but not those agents' contagion states)
5. **Actions follow JSON pattern** — When agent responds to action prompt, they return JSON with action type and parameters (existing platform pattern), with speak action triggering a second freetext prompt for message content

**Plans**: 3 plans in 2 waves

Plans:
- [x] 02-01-PLAN.md — MoveAdjacentAction with 8-way movement, collision/boundary validation (MOVE-01, MOVE-02, MOVE-03) ✓ Complete 2026-03-08
- [x] 02-02-PLAN.md — SpeakToAction with Moore adjacency check, TalkToEvent delivery (COMM-01, COMM-02, COMM-03, COMM-04) ✓ Complete 2026-03-08
- [x] 02-03-PLAN.md — Scene action registration, extended status prompt with full adjacent cell context (CTX-03, CTX-04) ✓ Complete 2026-03-08

---

### Phase 3: Transmission

**Goal**: Contagion spreads through proximity and directed actions, with automatic state recovery based on configured decay rules.

**Depends on**: Phase 1 (rules and states required) and Phase 2 (actions that trigger transmission)

**Requirements**: PROX-01, PROX-02, PROX-03, PROX-04, ACT-01, ACT-02, ACT-03, DECAY-01, DECAY-02, DECAY-03 (10 requirements)

**Success Criteria** (what must be TRUE):

1. **Proximity triggers transmission** — When infected agent is adjacent to susceptible agent, the susceptible agent becomes infected based on configured probability check at turn evaluation
2. **Speak action triggers transmission** — When infected agent uses speak(target_id) action, the target agent may become infected based on configured probability for action-directed transmission
3. **State transitions are logged** — When any agent changes contagion state, the system logs timestamp, agent IDs, from_state, to_state, and trigger_type (PROXIMITY or ACTION or DECAY)
4. **Decay transitions agent state** — When agent's turns-since-infection exceeds rule's decay_turns, the agent automatically transitions to the rule-defined next state (e.g., INFECTED -> RECOVERED)
5. **Both transmission types share infrastructure** — When rules are evaluated, proximity-based and action-directed transitions use the same probability-checking and state-applying logic from Phase 1's rule engine

**Plans**: 3 plans in 2 waves

Plans:
- [x] 03-01-PLAN.md — Proximity transmission with _evaluate_proximity_rules (PROX-01, PROX-02, PROX-03, PROX-04) ✓ Complete 2026-03-08
- [x] 03-02-PLAN.md — Action-directed transmission with check_action_transmission (ACT-01, ACT-02, ACT-03) ✓ Complete 2026-03-08
- [x] 03-03-PLAN.md — TransitionEvent extension with source_agent_id (PROX-04, shared infrastructure) ✓ Complete 2026-03-08

**Note**: DECAY-01, DECAY-02, DECAY-03 are already complete from Phase 1.

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Infrastructure | 3/3 | Complete | 01-01, 01-02, 01-03 (2026-03-08) |
| 2. Actions & Context | 3/3 | Complete | 02-01, 02-02, 02-03 (2026-03-08) |
| 3. Transmission | 3/3 | Complete | 03-01, 03-02, 03-03 (2026-03-08) | Verified 10/10 |

**Overall Progress:** 3/3 phases complete

## Dependencies

```
Phase 1: Core Infrastructure (COMPLETE)
    ├── Plan 01 (Wave 1): ContagionState + StateTransition
    │       ↓
    ├── Plan 02 (Wave 2): ContagionScene core (depends on 01)
    │       ↓
    └── Plan 03 (Wave 2): Grid + hidden states (depends on 01, 02)
    ↓
Phase 2: Actions & Context (COMPLETE - requires Phase 1)
    ├── Plan 01 (Wave 1): MoveAdjacentAction
    ├── Plan 02 (Wave 1): SpeakToAction (parallel with 01)
    │       ↓
    └── Plan 03 (Wave 2): Scene registration + context (depends on 01, 02)
    ↓
Phase 3: Transmission (COMPLETE - requires Phase 1 + Phase 2)
    ├── Plan 01 (Wave 1): Proximity transmission
    ├── Plan 02 (Wave 1): Action-directed transmission (parallel with 01)
    │       ↓
    └── Plan 03 (Wave 2): TransitionEvent extension (depends on 01, 02)
```

## Risk Notes

- **LLM non-determinism**: Agent behavior variations may mask contagion effects. Mitigation: Use deterministic mode (temperature=0) for experiments.
- **State-behavior desync**: Agents may act inconsistently with their contagion state. Mitigation: Always include current state in agent prompts (Phase 2).
- **Grid performance**: O(n^2) adjacency checks may slow large simulations. Mitigation: Use spatial indexing in Phase 1 implementation.

---
*Roadmap created: 2026-03-08*
*Plans created: 2026-03-08*
*Phase 2 plans added: 2026-03-08*
*Phase 3 plans added: 2026-03-08*
