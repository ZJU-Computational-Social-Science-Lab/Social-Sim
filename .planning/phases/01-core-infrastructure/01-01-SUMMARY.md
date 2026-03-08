---
phase: 01-core-infrastructure
plan: 01
subsystem: contagion
tags: [foundation, enum, dataclass, validation, tdd]
dependencies:
  requires: []
  provides:
    - ContagionState enum
    - StateTransition dataclass
    - check_probability utility
  affects:
    - All future contagion framework components
tech-stack:
  added:
    - contagion module (src/socialsim4/core/contagion/)
    - ContagionState enum (SEIR model states)
    - StateTransition declarative rules
  patterns:
    - str+Enum for JSON serialization
    - dataclass with __post_init__ validation
    - Declarative rule system
key-files:
  created:
    - src/socialsim4/core/contagion/__init__.py
    - src/socialsim4/core/contagion/states.py
    - src/socialsim4/core/contagion/rules.py
    - tests/unit/test_contagion_states.py
    - tests/unit/test_contagion_rules.py
  modified: []
decisions:
  - Use str+Enum inheritance for JSON serialization compatibility
  - Validate in __post_init__ rather than __init__ (dataclass pattern)
  - Keep ContagionState simple - no metadata fields
  - StateTransition uses string trigger_type for extensibility
metrics:
  duration: 10 minutes
  tasks_completed: 2
  files_created: 5
  tests_added: 11
  completed_date: 2026-03-08
---

# Phase 1 Plan 01: Contagion State Foundation Summary

## One-Liner
Created foundational ContagionState enum (SEIR model) and StateTransition dataclass with validation, establishing the type system for the contagion framework.

## What Was Built

### ContagionState Enum
- **File**: `src/socialsim4/core/contagion/states.py`
- **Purpose**: Defines the four core infection states for agents
- **States**: SUSCEPTIBLE, EXPOSED, INFECTED, RECOVERED
- **Design**: Inherits from `str` and `Enum` for JSON serialization compatibility
- **Pattern**: Follows CouncilPhase pattern from existing codebase

### StateTransition Dataclass
- **File**: `src/socialsim4/core/contagion/rules.py`
- **Purpose**: Declarative rule definitions for state transitions
- **Fields**:
  - `from_state`: Required starting state
  - `to_state`: Required target state
  - `trigger_type`: "proximity", "action", or "decay"
  - `probability`: Float between 0.0 and 1.0
  - `decay_turns`: Optional, required when trigger_type is "decay"
- **Validation**: Implemented in `__post_init__` with clear error messages

### check_probability Utility
- **File**: `src/socialsim4/core/contagion/rules.py`
- **Purpose**: Probabilistic transition evaluation
- **Behavior**: Returns `True` when `random.random() < probability`
- **Usage**: Called by scene during rule evaluation

### Module Structure
- **File**: `src/socialsim4/core/contagion/__init__.py`
- **Exports**: `ContagionState`, `StateTransition`, `check_probability`
- **Documentation**: Comprehensive module docstring with usage examples

## Test Coverage

### ContagionState Tests (5 tests)
- SUSCEPTIBLE value equals "susceptible"
- INFECTED value equals "infected"
- RECOVERED value equals "recovered"
- EXPOSED value equals "exposed"
- All states inherit from str and Enum

### StateTransition Tests (6 tests)
- Accepts required parameters
- Validates probability range (0.0-1.0)
- Validates trigger_type (proximity, action, decay)
- Requires decay_turns when trigger_type is "decay"
- decay_turns defaults to None
- check_probability returns correct boolean

**Total**: 11 tests, all passing

## How to Use

```python
from socialsim4.core.contagion import ContagionState, StateTransition, check_probability

# Define a proximity-based infection rule
infection_rule = StateTransition(
    from_state=ContagionState.SUSCEPTIBLE,
    to_state=ContagionState.INFECTED,
    trigger_type="proximity",
    probability=0.3
)

# Define a decay-based recovery rule
recovery_rule = StateTransition(
    from_state=ContagionState.INFECTED,
    to_state=ContagionState.RECOVERED,
    trigger_type="decay",
    probability=1.0,
    decay_turns=5
)

# Check if transition should occur
if check_probability(infection_rule.probability):
    agent.state = infection_rule.to_state
```

## Deviations from Plan

None - plan executed exactly as written.

## Key Decisions

1. **str+Enum Inheritance**: Chosen to match existing `CouncilPhase` pattern and ensure JSON serialization works correctly when states are sent to frontend or stored in configuration.

2. **__post_init__ Validation**: Used dataclass pattern for validation instead of `__init__` to maintain immutability and follow Python best practices.

3. **Simple Enum Design**: Kept ContagionState as pure enum without metadata fields. Future states can be added without breaking changes.

4. **String trigger_type**: Used string literal instead of enum for trigger_type to allow easier extension by scenario authors without modifying core framework.

## Verification Results

- All 11 unit tests pass
- Imports work correctly: `from socialsim4.core.contagion import ContagionState, StateTransition`
- Enum values correct: `ContagionState.INFECTED.value == "infected"`
- Module follows project file header standards
- Files under size limits (largest: 73 lines)

## Next Steps

This foundation enables the next plans in Phase 1:
- **Plan 02**: Build ContagionScene that evaluates StateTransition rules
- **Plan 03**: Create grid integration for proximity-based transmission

The types defined here will be used by:
- Scene classes for rule evaluation
- Agent properties for state storage
- Frontend for state visualization
- Configuration files for scenario definitions

## Commits

- `684742f`: test(01-01): add ContagionState enum and basic tests
- `232e120`: test(01-01): add StateTransition validation tests

## Self-Check: PASSED

All files verified:
- src/socialsim4/core/contagion/__init__.py (1145 bytes)
- src/socialsim4/core/contagion/states.py (1027 bytes)
- src/socialsim4/core/contagion/rules.py (2700 bytes)
- tests/unit/test_contagion_states.py (1469 bytes)
- tests/unit/test_contagion_rules.py (4155 bytes)

All commits verified:
- 684742f: ContagionState enum and basic tests
- 232e120: StateTransition validation tests
