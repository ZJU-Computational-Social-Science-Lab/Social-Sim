# Project State: Contagion Spread Framework

**Last Updated:** 2026-03-08
**Current Milestone:** v1.0 - Contagion Spread Framework
**Current Phase:** Phase 1 (Core Infrastructure) - Not Started

## Project Reference

**Core Value:** Agents make meaningful autonomous decisions that reveal emergent social dynamics.

**Current Focus:** Building a general-purpose contagion/spread framework for grid-based LLM-driven agents, applicable to both disease modeling (SIR/SEIR) and information diffusion (gossip, rumors).

**Key Constraints:**
- Python 3.12 backend, TypeScript frontend
- Must work with OpenAI, Gemini, and Ollama LLM providers
- Build on existing GridScene infrastructure
- Maintain backward compatibility with existing scenarios

## Current Position

**Active Phase:** Phase 1: Core Infrastructure
**Status:** Not started (roadmap just created)
**Progress:** 0/3 phases complete

```
[██████████████████████████████████████████████████] 0% Phase 1
[░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 0% Overall
```

## Performance Metrics

**Requirements Coverage:** 33/33 (100%) mapped to phases

| Phase | Requirements |
|-------|--------------|
| Phase 1: Core Infrastructure | 13 reqs (CORE-01 to CORE-06, GRID-01 to GRID-04, HIDE-01 to HIDE-03) |
| Phase 2: Actions & Context | 11 reqs (MOVE-01 to MOVE-03, COMM-01 to COMM-04, CTX-01 to CTX-04) |
| Phase 3: Transmission | 10 reqs (PROX-01 to PROX-04, ACT-01 to ACT-03, DECAY-01 to DECAY-03) |

**Decision Log:**

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-08 | Phase structure: 3 phases (not 4 from research) | Compressed from research recommendation to deliver focused milestones. Research Phase 3 (Viz) deferred to v2, Phase 4 (Advanced) out of scope. |
| 2026-03-08 | State decay grouped with transmission | Decay rules are part of transmission mechanics; they trigger after infection occurs. |
| 2026-03-08 | Agent context in Phase 2 | Context integration requires action patterns to exist first; prompts reference available actions. |

## Accumulated Context

### Key Decisions Made

1. **No new external dependencies** — Contagion framework uses Python standard library (enum, dataclasses, random) and existing GridMechanic/GameMap infrastructure. No epidemiological libraries (ndlib, Epydemic) needed.

2. **Hidden states** — Agent contagion states are private. Agents infer states from behavior and communication only, not direct observation. User (via frontend) sees true states for monitoring.

3. **Declarative rules** — State transitions defined via configuration (from_state, to_state, trigger_type, probability, decay_turns). Rules evaluated by scene, not agents (maintains agent isolation).

4. **Single-target speak** — Speak action targets one specific adjacent agent. Broadcast/multi-target deferred to v2.

### Technical Context

**Existing Infrastructure to Reuse:**
- `GridScene` / `GameMap` — Grid positioning, movement, adjacency queries
- `ActionController` — Action registration and execution
- `TalkToAction` — Pattern for communication actions (extend to speak_to)
- `Agent.properties` — Per-agent state storage
- WebSocket events — Real-time statistics delivery to frontend

**New Components to Build:**
- `ContagionScene` — Extends Scene, orchestrates rule evaluation
- `ContagionRules` module — Rule evaluation engine with probability checks
- `ContagionState` enum — State representation (SUSCEPTIBLE, INFECTED, RECOVERED, etc.)
- `StateTransition` dataclass — Rule definition schema
- `MoveAction` — Grid-based movement (if not exists)
- `SpeakToAction` — Targeted single-agent communication

### Known Risks

1. **State-behavior desynchronization** — Agents may act inconsistently with their contagion state.
   - *Mitigation:* Always include current state in agent prompts (Phase 2).

2. **LLM non-determinism** — Random variations may mask contagion effects.
   - *Mitigation:* Deterministic mode (temperature=0) for experiments.

3. **Grid adjacency performance** — O(n²) checks could slow large simulations.
   - *Mitigation:* Spatial indexing by cell for O(1) adjacency lookup.

### Open Questions

None currently. Research addressed architecture and stack questions.

## Session Continuity

**Next Steps:**
1. User reviews and approves roadmap
2. Execute `/gsd:plan-phase 1` to create detailed plans for Phase 1
3. Begin Phase 1 implementation

**Recent Commits:**
- `82db839` fix(scenarios): add council chamber and custom scenarios to UI
- `304a0fb` docs: map existing codebase
- `9b1069d` Network added to simulation builder

**Branch:** `feature/experiment-builder`

**Context Files Created This Session:**
- `.planning/ROADMAP.md` — Phase structure with goals, requirements, and success criteria
- `.planning/STATE.md` — This file (project memory and continuity)

---
*State initialized: 2026-03-08*
