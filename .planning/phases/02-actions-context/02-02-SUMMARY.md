---
phase: 02-actions-context
plan: 02
subsystem: contagion
tags: [communication, speak-action, moore-neighborhood, message-delivery, talktoevent]

requires: []
provides:
  - SpeakToAction class for targeted agent communication
  - Moore neighborhood adjacency validation
  - Message delivery via add_env_feedback
affects:
  - contagion actions module
  - contagion __init__.py exports

  - information diffusion scenarios

tech-stack:
  added: []
  patterns:
  - Action 5-tuple return pattern (success, result, summary, meta, pass_control)
  - TalkToEvent for message formatting
  - Moore neighborhood validation (max(dx, dy) <= 1)

key-files:
  created: []
  modified:
    - src/socialsim4/core/contagion/actions.py
    - src/socialsim4/core/contagion/__init__.py
    - tests/unit/contagion/test_actions.py

key-decisions:
  - Used TalkToEvent from core event module for consistent message formatting
  - Moore neighborhood check uses max(dx, dy) <= 1 instead of Manhattan distance
  - Message delivered to both sender and target via add_env_feedback

requirements-completed: [COMM-01, COMM-02, COMM-03, COMM-04]

duration: 6 min
completed: 2026-03-08T11:58:33Z
---

# Phase 2 Plan 2: SpeakToAction Summary

**Targeted communication action for adjacent agents using Moore neighborhood constraints and TalkToEvent message delivery.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-08T11:51:37Z
- **Completed:** 2026-03-08T11:58:33Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- SpeakToAction class for targeted agent-to-agent communication
- Moore neighborhood validation (8 directions including diagonals)
- Message delivery via TalkToEvent to both sender and target
- Bilingual support (English/Chinese) for error messages
- 9 unit tests covering all success and failure cases

## Task Commits

Each task committed atomically:
1. **Task 1: Add SpeakToAction test cases** - `9cd1833` (test)
2. **Task 2: Implement SpeakToAction with message delivery** - `4cce07a` (feat)
3. **Task 3: Update contagion __init__.py exports** - `4d2b6e7` (chore)

## Files Created/Modified
- `src/socialsim4/core/contagion/actions.py` - Added SpeakToAction class with handle() method
- `src/socialsim4/core/contagion/__init__.py` - Added SpeakToAction to exports
- `tests/unit/contagion/test_actions.py` - Added TestSpeakToAction with 9 test methods

## Decisions Made
- Used TalkToEvent from core event module for consistent message formatting with existing TalkToAction
- Moore neighborhood check uses max(dx, dy) <= 1 to allow diagonal adjacency
- Message delivered to both sender and target via add_env_feedback for conversation history
- Two-step pattern clarified: LLM interaction collects target then message, but action.handle() receives both

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Self-Check: PASSED
- [x] actions.py exists: FOUND
- [x] __init__.py exists: FOUND
- [x] SUMMARY.md exists: FOUND
- [x] Commits exist: 9cd1833 (4cce07a, 4d2b6e7
- [x] 49f9cb test (move) passed

- [x] All SpeakToAction tests pass: PASSED

## Next Phase Readiness
- SpeakToAction ready for integration with ContagionScene
- Plan 02-03 (Scene registration) can now wire SpeakToAction into scene actions
- Phase 3 (Transmission) can proceed with proximity-based contagion mechanics
