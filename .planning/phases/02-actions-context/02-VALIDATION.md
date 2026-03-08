---
phase: 02
slug: actions-context
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x |
| **Config file** | pyproject.toml |
| **Quick run command** | `pytest tests/unit/contagion/ -v` |
| **Full suite command** | `pytest tests/unit/contagion/ -v` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/unit/contagion/ -v`
- **After every plan wave:** Run `pytest tests/unit/contagion/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | MOVE-01 | unit | `pytest tests/unit/contagion/test_actions.py::test_move_adjacent_success -v` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | MOVE-02 | unit | `pytest tests/unit/contagion/test_actions.py::test_move_boundary -v` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | MOVE-03 | unit | `pytest tests/unit/contagion/test_actions.py::test_move_occupied -v` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | COMM-01 | unit | `pytest tests/unit/contagion/test_actions.py::test_speak_adjacent -v` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | COMM-02 | unit | `pytest tests/unit/contagion/test_actions.py::test_speak_not_adjacent -v` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 1 | COMM-03 | unit | `pytest tests/unit/contagion/test_actions.py::test_speak_message_delivery -v` | ❌ W0 | ⬜ pending |
| 02-02-04 | 02 | 1 | COMM-04 | unit | `pytest tests/unit/contagion/test_actions.py::test_speak_freetext_prompt -v` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/contagion/test_actions.py` — stubs for MOVE-01, MOVE-02, MOVE-03, COMM-01, COMM-02, COMM-03, COMM-04
- [ ] `tests/unit/contagion/conftest.py` — shared fixtures for ContagionScene, agents, game_map

*Note: CTX-01 and CTX-02 already validated in Phase 1 tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| LLM generates valid JSON for move action | MOVE-01 | Requires live LLM call | Run simulation with agent, inspect action JSON in logs |
| LLM generates freetext message after speak prompt | COMM-04 | Requires live LLM call | Run simulation with agent, inspect message content in logs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
