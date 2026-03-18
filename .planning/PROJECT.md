# Social-Sim Bug Fixes & Game Features Milestone

```
## What This Is

A maintenance and feature milestone addressing 8 critical bugs and 2 new game features for the Social-Sim multi-agent simulation platform. The bugs fix context inheritance, voting mechanics, token endowment enforcement, event broadcast duplication, session management, Docker deployment stability, and UI cleanup. The features add punishment mechanisms to Public Goods Game and blind choice mode to Coordination Game.

```
## Core Value
```
Ensure simulation experiments are scientifically valid and reproducible for the NeurIPS paper deadline.
```
## Requirements
```
### Validated
```
(None yet — ship to validate)
```
### Active
```
**Bugs:**
- [ ] **BUG-01**: Speak follow-up prompt correctly inherits previous-round context
- [ ] **BUG-02**: Remove Max Rounds field from simulation designer UI
- [ ] **BUG-03**: Fix session loss during advance node (redirects to login)
- [ ] **BUG-04**: Fix SimTree disappearing after ~1 week on Docker deployment
- [ ] **BUG-05**: Eliminate duplicate event broadcasts in UI
- [ ] **BUG-06**: Connection error retry enforces voting stage constraints correctly
- [ ] **BUG-07**: Enforce token endowment constraint in Public Goods Game
```
**Features:**
- [ ] **FEAT-01**: Add punishment mechanism to Public Goods Game (customizable)
- [ ] **FEAT-02**: Add simultaneous (blind) choice mode to Coordination Game (UI toggle)
```
**i18n:**
- [ ] **I18N-01**: Audit and fix all hardcoded user-facing text
```
### Out of Scope
```
- Mobile responsiveness improvements — focus on core functionality first
- Performance optimization beyond fixing identified bugs — separate milestone
- New game types — scope limited to fixing and enhancing existing games
```
## Context
```
**Research Context:**
- NeurIPS paper deadline approaching (1-2 weeks for critical bugs)
- Multi-round deliberation experiments blocked by context inheritance bug
- Voting data corrupted by retry mechanism not enforcing stage constraints
- PGG experiments showing impossible token contributions

**Technical Context:**
- Python 3.12 backend (Litestar, simulation engine)
- TypeScript frontend (React-based)
- Docker deployment showing SimTree rendering failure after ~1 week uptime
- Session management issues during long-running experiments

**User Feedback:**
- Context inheritance bug blocks all multi-round deliberation
- Max Rounds field is misleading (no backend enforcement)
- Platform becomes unusable after extended rounds
- Duplicate broadcasts confuse users and distort experiment logs
```
## Constraints
```
**Timeline**: 1-2 weeks for critical bugs (BUG-01, BUG-06, BUG-07) — NeurIPS deadline
**Branches**: Use `bug-fix/bugfix-milestone` for bugs, `feature/game-features` for features
**Testing**: Full stack testing required (pytest backend + Jest/Vitest frontend)
**Testing Checkpoints**: Pause after each fix for manual testing before proceeding
**Code Quality**: Follow CLAUDE.md guidelines (file headers, size limits, docstrings)
**i18n**: Full codebase audit required — all user-facing text must translation keys
```
## Key Decisions
```
| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Two branches instead of individual branches | Easier to manage related changes, cleaner git history | — Pending |
| Full codebase i18n audit | User requested comprehensive approach, prevents future issues | — Pending |
| Testing checkpoint after each fix | Allows validation before moving to next item | — Pending |
| PGG punishment: customizable design | Balance flexibility with usability, avoid over-engineering | — Pending |
| Coord Game blind mode: UI toggle | Simpler implementation, easier for researchers to use | — Pending |
```
---
*Last updated: 2026-03-18 after initialization*
