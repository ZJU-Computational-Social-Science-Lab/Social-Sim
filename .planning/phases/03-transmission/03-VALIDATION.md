---
phase: 3
slug: transmission
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x |
| **Config file** | pyproject.toml (tool.pytest.ini_options) |
| **Quick run command** | `pytest tests/unit/test_contagion_transmission.py tests/unit/test_contagion_actions.py -x -v` |
| **Full suite command** | `pytest tests/ -v` |
| **Estimated runtime** | ~5 seconds (quick), ~30 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/unit/test_contagion_transmission.py tests/unit/test_contagion_actions.py -x -v`
- **After every plan wave:** Run `pytest tests/unit/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | PROX-01 | unit | `pytest tests/unit/test_contagion_transmission.py::test_proximity_rules_evaluated -xvs` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | PROX-02 | unit | `pytest tests/unit/test_contagion_transmission.py::test_proximity_probability -xvs` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | PROX-03 | unit | `pytest tests/unit/test_contagion_transmission.py::test_proximity_configurable -xvs` | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 1 | PROX-04 | unit | `pytest tests/unit/test_contagion_transmission.py::test_proximity_logging -xvs` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | ACT-01 | unit | `pytest tests/unit/test_contagion_actions.py::test_speak_transmission -xvs` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | ACT-02 | unit | `pytest tests/unit/test_contagion_actions.py::test_speak_probability -xvs` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 1 | ACT-03 | unit | `pytest tests/unit/test_contagion_transmission.py::test_shared_infrastructure -xvs` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | PROX-04 | unit | `pytest tests/unit/test_contagion_statistics.py::test_source_agent_id -xvs` | ❌ W0 | ⬜ pending |
| DECAY-01 | — | — | DECAY-01 | unit | `pytest tests/unit/test_contagion_scene.py::TestContagionSceneDecayRules -xvs` | ✅ | ✓ complete |
| DECAY-02 | — | — | DECAY-02 | unit | `pytest tests/unit/test_contagion_scene.py::test_pre_turn_rules_increments_contagion_turns -xvs` | ✅ | ✓ complete |
| DECAY-03 | — | — | DECAY-03 | unit | `pytest tests/unit/test_contagion_scene.py::test_decay_transition_only_when_turns_exceeds_threshold -xvs` | ✅ | ✓ complete |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/test_contagion_transmission.py` — stubs for PROX-01 to PROX-04, ACT-03
- [ ] `tests/unit/test_contagion_actions.py` — extend existing file with transmission tests (ACT-01, ACT-02)
- [ ] `tests/unit/test_contagion_statistics.py` — add tests for source_agent_id field

*Note: DECAY requirements already covered by existing test_contagion_scene.py*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| None | — | — | All phase behaviors have automated verification |

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter (after Wave 0 files created)

**Approval:** pending
