# Requirements: Contagion Spread Framework

**Defined:** 2026-03-08
**Core Value:** Agents make meaningful autonomous decisions that reveal emergent social dynamics

## v1 Requirements

Requirements for milestone v1.0. Each maps to roadmap phases.

### Core Infrastructure

- [ ] **CORE-01**: System defines ContagionState enum for agent infection states (e.g., SUSCEPTIBLE, INFECTED, RECOVERED)
- [ ] **CORE-02**: System provides StateTransition dataclass for defining state change rules (from_state, to_state, trigger_type, probability, decay_turns)
- [ ] **CORE-03**: System tracks contagion state per agent in agent.properties
- [ ] **CORE-04**: Scene evaluates transition rules each turn before agents act
- [ ] **CORE-05**: System maintains statistics: count of agents per state, transition events log
- [ ] **CORE-06**: Scene exposes current statistics to frontend via WebSocket events

### Grid & Positioning

- [ ] **GRID-01**: Agents are positioned on a 2D grid using existing GameMap infrastructure
- [ ] **GRID-02**: Agents can see adjacent cells (Moore neighborhood: 8 surrounding cells)
- [ ] **GRID-03**: Agent context includes list of nearby agents (IDs only, not their states)
- [ ] **GRID-04**: Grid is open (no obstacles for v1.0)

### Movement Actions

- [ ] **MOVE-01**: Agent can move to an adjacent cell via move(direction) action
- [ ] **MOVE-02**: Move action follows existing action pattern (JSON response format)
- [ ] **MOVE-03**: Move action validates target cell is adjacent and unoccupied

### Communication Actions

- [ ] **COMM-01**: Agent can speak to a specific nearby agent via speak(target_id) action
- [ ] **COMM-02**: Speak action uses two-step prompt pattern: agent first responds with action choice, then gets reprompted for freetext message
- [ ] **COMM-03**: Speak action validates target agent is in adjacent cell
- [ ] **COMM-04**: Message content is delivered to target agent's context on next turn

### Proximity-Based Transmission

- [ ] **PROX-01**: Scene evaluates proximity-based rules each turn for adjacent agent pairs
- [ ] **PROX-02**: When infected agent is adjacent to susceptible agent, probability check determines if transmission occurs
- [ ] **PROX-03**: Transmission probability is configurable per rule
- [ ] **PROX-04**: State transitions are logged with timestamp, agent IDs, and trigger type

### Action-Directed Transmission

- [ ] **ACT-01**: Speak action can trigger state transition in target agent (e.g., spreading information)
- [ ] **ACT-02**: Transition probability is checked when speak action targets an agent
- [ ] **ACT-03**: Both proximity and action-directed rules use same rule evaluation infrastructure

### Agent Context Integration

- [ ] **CTX-01**: Agent prompt includes their own current contagion state
- [ ] **CTX-02**: Agent prompt includes list of nearby agent IDs (not their states — states are hidden)
- [ ] **CTX-03**: Agent prompt follows existing pattern: description, scenario, context, available actions
- [ ] **CTX-04**: Agent responds in JSON format for action selection (existing pattern)

### Hidden States

- [ ] **HIDE-01**: Agent states are hidden from other agents (no direct state observation)
- [ ] **HIDE-02**: Agents infer other agents' states from behavior and communication only
- [ ] **HIDE-03**: Frontend displays true agent states to user (for simulation monitoring)

### State Decay

- [ ] **DECAY-01**: Rules can optionally define decay_turns for automatic state transitions
- [ ] **DECAY-02**: Scene tracks turns-since-infection per agent for decay evaluation
- [ ] **DECAY-03**: When decay_turns elapsed, agent transitions to rule-defined next state

## v2 Requirements

Deferred to future release.

### YAML Configuration

- **YAML-01**: Contagion rules defined in YAML files (states, transitions, probabilities, decay)
- **YAML-02**: Multiple contagion configurations selectable per scenario

### Advanced Visualization

- **VIZ-01**: Grid heatmap showing state distribution with color coding
- **VIZ-02**: Observer mode toggle to see true states vs agent knowledge

### Observable Behaviors

- **OBS-01**: Agents exhibit observable behaviors based on state (e.g., "coughing" when infected)
- **OBS-02**: Observable behaviors visible in context, not raw states

### Complex Rules

- **RULE-01**: Rules with conditional logic (e.g., higher probability in crowded cells)
- **RULE-02**: Multi-state tracking (agents can have multiple contagion states simultaneously)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Non-LLM mathematical modeling | Framework requires agent decision-making, not pure SIR equations |
| Deterministic seeding | SimTree branching provides reproducibility; non-determinism is a feature |
| 3D spatial simulation | 2D grid only |
| Real-time multiplayer | Single-user simulation control |
| Broadcast speak | Single-target only for v1.0 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORE-01 | Phase 1 | Pending |
| CORE-02 | Phase 1 | Pending |
| CORE-03 | Phase 1 | Pending |
| CORE-04 | Phase 1 | Pending |
| CORE-05 | Phase 1 | Pending |
| CORE-06 | Phase 1 | Pending |
| GRID-01 | Phase 1 | Pending |
| GRID-02 | Phase 1 | Pending |
| GRID-03 | Phase 1 | Pending |
| GRID-04 | Phase 1 | Pending |
| MOVE-01 | Phase 2 | Pending |
| MOVE-02 | Phase 2 | Pending |
| MOVE-03 | Phase 2 | Pending |
| COMM-01 | Phase 2 | Pending |
| COMM-02 | Phase 2 | Pending |
| COMM-03 | Phase 2 | Pending |
| COMM-04 | Phase 2 | Pending |
| PROX-01 | Phase 3 | Pending |
| PROX-02 | Phase 3 | Pending |
| PROX-03 | Phase 3 | Pending |
| PROX-04 | Phase 3 | Pending |
| ACT-01 | Phase 3 | Pending |
| ACT-02 | Phase 3 | Pending |
| ACT-03 | Phase 3 | Pending |
| CTX-01 | Phase 2 | Pending |
| CTX-02 | Phase 2 | Pending |
| CTX-03 | Phase 2 | Pending |
| CTX-04 | Phase 2 | Pending |
| HIDE-01 | Phase 1 | Pending |
| HIDE-02 | Phase 1 | Pending |
| HIDE-03 | Phase 1 | Pending |
| DECAY-01 | Phase 3 | Pending |
| DECAY-02 | Phase 3 | Pending |
| DECAY-03 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 33 total
- Mapped to phases: 33
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-08*
*Last updated: 2026-03-08 after initial definition*
