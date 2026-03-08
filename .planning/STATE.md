# State

## Current Position

**Milestone:** v1.0 — Contagion Spread Framework
**Phase:** Not started (defining requirements)
**Plan:** —
**Status:** Gathering requirements
**Last activity:** 2026-03-08 — Milestone v1.0 started

## Accumulated Context

### Design Decisions

**Contagion Spread Framework (v1.0):**
- Grid-based, adjacent visibility, open cells
- LLM agents decide movement + communication
- States hidden — agents infer from behavior
- Actions: `move(direction)`, `speak(target_id, message)`
- Spread rules configurable: trigger type (proximity/action), conditions, probability, decay
- Disease example: proximity trigger, S→I→R with recovery_turns
- Info example: action trigger (speak), Unaware→Aware, no decay
- End condition: user-controlled via advance button

### Key Files Referenced

- `src/socialsim4/core/scenes/` — Scene implementations
- `src/socialsim4/core/actions/` — Action classes
- `src/socialsim4/core/agent/agent.py` — Agent implementation
- `frontend/components/` — UI components

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-08)

**Core value:** Agents make meaningful autonomous decisions that reveal emergent social dynamics
**Current focus:** Contagion Spread Framework v1.0
