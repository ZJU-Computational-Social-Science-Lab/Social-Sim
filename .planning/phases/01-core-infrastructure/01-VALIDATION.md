---
phase: 01
slug: core-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.4.3 |
| **Config file** | pyproject.toml ([tool.pytest.ini_options]) |
| **Quick run command** | `pytest tests/unit/test_contagion*.py -x` |
| **Full suite command** | `pytest tests/ -v --cov=src/socialsim4/core/contagion` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/unit/test_contagion*.py -x`
- **After every plan wave:** Run `pytest tests/ -v --cov=src/socialsim4/core/contagion`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | CORE-01 | unit | `pytest tests/unit/test_contagion_states.py -x` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | CORE-02 | unit | `pytest tests/unit/test_contagion_rules.py -x` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | CORE-03, CORE-04, CORE-05, CORE-06 | unit | `pytest tests/unit/test_contagion_scene.py -x` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | GRID-01, GRID-02, GRID-03, GRID-04 | unit | `pytest tests/unit/test_contagion_scene.py -x` | ❌ W0 | ⬜ pending |
| 01-02-03 | 02 | 1 | HIDE-01, HIDE-03 | unit | `pytest tests/unit/test_contagion_scene.py -x` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 2 | GRID-01 | integration | `pytest tests/integration/test_contagion_grid.py -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/test_contagion_states.py` — stubs for CORE-01 (ContagionState enum)
- [ ] `tests/unit/test_contagion_rules.py` — stubs for CORE-02 (StateTransition dataclass)
- [ ] `tests/unit/test_contagion_scene.py` — stubs for CORE-03 through HIDE-03
- [ ] `tests/integration/test_contagion_grid.py` — stubs for GRID-01 (grid positioning)
- [ ] `tests/conftest.py` — shared fixtures for ContagionScene setup

*Framework: pytest already present in pyproject.toml*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| HIDE-02 | Agents infer states from behavior | Requires Phase 2 communication actions | Deferred to Phase 2 integration test |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
