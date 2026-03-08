---
gsd_state_version: 1.0
phase: 001-scenario-execution-audit
plan: 001
subsystem: execution-flow
tags: [audit, bugs, execution, simulation]
completed_at: "2026-03-08"
duration_minutes: 30
---

# Quick Task 001: Scenario Execution Audit Summary

**Objective:** Audit the scenario execution flow for bugs without fixing anything.

**Scope:** simulator.run() turn loop, ordering implementations, scenario builders, ExperimentScene, SimTree branch/restore, agent serialization.

## Executive Summary

| Priority | Count | Description |
|----------|-------|-------------|
| P0 | 3 | Prevents completion / critical crash |
| P1 | 12 | Recoverable but bad UX / data integrity |

**P0 Bugs (Critical):**
1. ExperimentScene.run_round() raises in production if initialize() skipped
2. asyncio.run() in ExperimentRunnerAdapter.run() crashes in async context
3. ControlledOrdering.iter() infinite loop if next_fn returns None forever

**P1 Bugs (Significant):**
- Silent agent skips with no logging
- Hidden exceptions in error handlers
- Missing key validation in scenario builders
- Inefficient JSON serialization in SimTree
- Thread-safety concerns in event queue

---

## P0 Bugs (Prevents Completion)

### [P0-01] ExperimentScene.run_round() ValueError if Not Initialized

**File:** `src/socialsim4/core/experiment/scene.py:150-151`
**Severity:** P0 (prevents completion)

**Description:**
`run_round()` raises `ValueError("ExperimentScene not initialized - call initialize() first")` if `self.runner is None`. This check is correct, but there is no API-level validation. If a user attempts to run a round before initialization (e.g., via SimTree operations), the error surfaces as an uncaught exception.

**Reproduction:**
1. Create ExperimentScene with valid config
2. Call `scene.run_round()` without calling `scene.initialize()` first
3. ValueError is raised

**Impact:**
All experiment_template scenarios. Crashes the simulation run without graceful error handling or frontend notification.

---

### [P0-02] asyncio.run() in ExperimentRunnerAdapter.run() Creates New Event Loop

**File:** `src/socialsim4/backend/services/simtree_runtime.py:82`
**Severity:** P0 (prevents completion in async context)

**Description:**
```python
asyncio.run(self.scene.run_round(self._emit_event))
```
`asyncio.run()` creates a new event loop each call. If `run()` is called from within an existing async context (e.g., FastAPI handler), this raises `RuntimeError: This event loop is already running`.

**Reproduction:**
1. Start FastAPI server
2. Create experiment_template simulation
3. Call advance via API endpoint
4. RuntimeError if endpoint is async

**Impact:**
Blocks experiment_template scenarios when run via async API routes. The `ExperimentRunnerAdapter.run()` method cannot be used from async contexts.

---

### [P0-03] ControlledOrdering.iter() Infinite Loop with None-Returning next_fn

**File:** `src/socialsim4/core/ordering.py:125-131`
**Severity:** P0 (prevents completion - hangs simulation)

**Description:**
```python
def iter(self) -> Iterator[str]:
    while True:
        name = None
        if self.next_fn:
            name = self.next_fn(self.sim)
        if name and name in self.sim.agents:
            yield name
```
If `next_fn` returns `None` (e.g., no agent is eligible), the loop never yields and spins forever. No timeout, no break condition.

**Reproduction:**
1. Create simulation with ControlledOrdering
2. Provide next_fn that returns None (e.g., no active player in landlord game during phase transition)
3. Simulation hangs indefinitely, consuming CPU

**Impact:**
Landlord scene and any scene using ControlledOrdering can hang during phase transitions.

---

## P1 Bugs (Recoverable but Bad)

### [P1-01] Silent Agent Skip with No Logging

**File:** `src/socialsim4/core/simulator.py:334-335`
**Severity:** P1 (recoverable but hides bugs)

**Description:**
```python
if not agent:
    continue
```
When `agent_name` is returned from ordering but not in `self.agents`, the turn is silently skipped. No logging, no error event. This makes debugging ordering issues very difficult.

**Reproduction:**
1. Modify ordering to return a non-existent agent name
2. Run simulation
3. Turn is silently skipped, no indication of problem

**Impact:**
Debugging ordering bugs is extremely difficult. Silent failures hide configuration errors.

---

### [P1-02] pre_turn_rules Duck Typing with No Exception Handling

**File:** `src/socialsim4/core/simulator.py:346-347`
**Severity:** P1 (recoverable but could crash)

**Description:**
```python
if hasattr(self.scene, 'pre_turn_rules'):
    self.scene.pre_turn_rules(self)
```
If `pre_turn_rules` exists but raises an exception, it propagates up and crashes the turn. No try/except wrapper.

**Reproduction:**
1. Create scene with `pre_turn_rules` method that raises exception
2. Run simulation
3. Turn crashes with unhandled exception

**Impact:**
ContagionScene and other scenes with `pre_turn_rules` could crash the simulation if their rule evaluation has bugs.

---

### [P1-03] Error Event Emission Catches and Suppresses Exceptions

**File:** `src/socialsim4/core/simulator.py:282-286`
**Severity:** P1 (hides critical bugs)

**Description:**
```python
try:
    self.emit_event("error", data)
except Exception:
    logger.exception("failed to emit error event")
```
If emitting an error event fails, the original error context is lost and only logged. The simulation continues.

**Reproduction:**
1. Configure log_event handler that raises exception
2. Trigger an error in simulation
3. Error is suppressed, simulation continues in potentially broken state

**Impact:**
Critical bugs could be hidden. Simulation continues with corrupted state.

---

### [P1-04] Ordering.on_event Exceptions Suppressed

**File:** `src/socialsim4/core/simulator.py:115-120`
**Severity:** P1 (hides ordering bugs)

**Description:**
```python
try:
    self.ordering.on_event(self, event_type, data)
except Exception:
    logger.exception("ordering.on_event raised")
```
If ordering's `on_event` raises, the exception is logged but suppressed. LLMModeratedOrdering depends on this for queue refilling.

**Reproduction:**
1. Create LLMModeratedOrdering with moderator that fails
2. Run simulation
3. Ordering fails silently, simulation continues with broken scheduling

**Impact:**
LLMModeratedOrdering could fail to refill queue, causing agents to never be scheduled.

---

### [P1-05] CATEGORY_ACTION_LIBRARIES KeyError

**File:** `src/socialsim4/scenarios/social_norm_disruption.py:46`
**File:** `src/socialsim4/scenarios/echo_chamber.py:39`
**File:** `src/socialsim4/scenarios/policy_erosion.py:37`
**File:** `src/socialsim4/scenarios/resource_scarcity.py:39`
**Severity:** P1 (crashes scenario initialization)

**Description:**
```python
sociology_actions = CATEGORY_ACTION_LIBRARIES['sociology']
```
If the 'sociology' key doesn't exist in CATEGORY_ACTION_LIBRARIES, this raises KeyError. No validation or fallback.

**Reproduction:**
1. Remove or rename 'sociology' key in actions registry
2. Try to build any experiment scenario
3. KeyError crashes initialization

**Impact:**
All experiment scenarios fail catastrophically if action library is missing or renamed.

---

### [P1-06] StopIteration in Scenario Action Lookup

**File:** `src/socialsim4/scenarios/social_norm_disruption.py:61`
**File:** `src/socialsim4/scenarios/echo_chamber.py:55`
**File:** `src/socialsim4/scenarios/policy_erosion.py:53`
**File:** `src/socialsim4/scenarios/resource_scarcity.py:55`
**Severity:** P1 (crashes scenario initialization)

**Description:**
```python
'description': next(a['description'] for a in sociology_actions if a['name'] == action_name)
```
If `action_name` is not found in `sociology_actions`, `next()` raises StopIteration. No default value.

**Reproduction:**
1. Configure scenario with non-existent action name
2. Build scenario
3. StopIteration crashes initialization

**Impact:**
Typos in action names or missing actions crash scenario initialization with cryptic error.

---

### [P1-07] get_information_model Registry Lookup Failure

**File:** `src/socialsim4/core/experiment/scene.py:84`
**Severity:** P1 (crashes experiment initialization)

**Description:**
```python
information_model = get_information_model(self.config.scenario_id)
```
If `scenario_id` is not in the registry, this returns a default but the behavior is undefined. No validation.

**Reproduction:**
1. Create ExperimentConfig with unknown scenario_id
2. Initialize scene
3. May get incorrect information model or crash

**Impact:**
Custom scenarios or typos in scenario_id could cause incorrect visibility rules or crashes.

---

### [P1-08] Inefficient JSON Round-Trip in SimTree.copy_sim()

**File:** `src/socialsim4/core/simtree.py:315-317`
**Severity:** P1 (performance, data integrity)

**Description:**
```python
parent_meta = json.loads(json.dumps(self.nodes[node_id].get("meta", {})))
child_logs: List[dict] = json.loads(json.dumps(parent_logs))
```
JSON round-trip is inefficient and loses non-JSON-serializable data (e.g., datetime objects, custom types).

**Reproduction:**
1. Store non-JSON-serializable data in node meta
2. Call copy_sim()
3. Data is lost or converted incorrectly

**Impact:**
Performance overhead for large logs/meta. Data loss for non-primitive types.

---

### [P1-09] Event Queue Thread Safety

**File:** `src/socialsim4/core/simulator.py:187`
**Severity:** P1 (potential race condition)

**Description:**
```python
"event_queue": list(self.event_queue.queue),
```
Accessing `queue.queue` directly is not thread-safe. If another thread is modifying the queue during serialization, this could produce inconsistent state.

**Reproduction:**
1. Run simulation with concurrent event emission
2. Serialize simulator during event processing
3. Potential data corruption or exception

**Impact:**
Race conditions in multi-threaded scenarios (SimTree with concurrent branch operations).

---

### [P1-10] CycledOrdering.iter() Empty Names List

**File:** `src/socialsim4/core/ordering.py:81-87`
**Severity:** P1 (edge case, could hang)

**Description:**
```python
def iter(self) -> Iterator[str]:
    while True:
        if not self.names:
            break
        ret = self.names[self._idx]
        self._idx = (self._idx + 1) % len(self.names)
        yield ret
```
If `self.names` is empty, the generator breaks immediately. This is handled, but callers expecting an infinite iterator may not handle the StopIteration.

**Reproduction:**
1. Create CycledOrdering with empty names list
2. Call iter() and try to get next()
3. StopIteration raised

**Impact:**
Werewolf scene and other CycledOrdering users could crash if no players are configured.

---

### [P1-11] RandomOrdering.iter() Empty Agents

**File:** `src/socialsim4/core/ordering.py:105-110`
**Severity:** P1 (edge case, breaks cleanly)

**Description:**
```python
def iter(self) -> Iterator[str]:
    while True:
        names = list(self.sim.agents.keys())
        if not names:
            break
        yield self.rng.choice(names)
```
If `sim.agents` is empty, the generator breaks. Same issue as CycledOrdering.

**Reproduction:**
1. Create simulation with 0 agents and RandomOrdering
2. Run simulation
3. StopIteration

**Impact:**
Edge case but could crash simulations with dynamic agent removal.

---

### [P1-12] SequentialOrdering.set_simulation() Modulo by Zero

**File:** `src/socialsim4/core/ordering.py:53`
**Severity:** P1 (edge case, division by zero)

**Description:**
```python
self._idx = int(self._idx) % (len(self._names) if self._names else 1)
```
This is actually handled with the ternary, but the pattern is fragile. If `_names` becomes empty after initialization, subsequent iter() calls could have issues.

**Reproduction:**
1. Create SequentialOrdering with agents
2. Remove all agents from simulation
3. Call iter() - breaks cleanly but may surprise callers

**Impact:**
Low - handled but edge case behavior may surprise developers.

---

## Recommendations (Not Fixes)

### For P0 Bugs:

1. **ExperimentScene initialization:** Add API-level validation or auto-initialization. Consider checking at SimTree advance time.

2. **asyncio.run() issue:** Refactor ExperimentRunnerAdapter to accept an event loop or use `asyncio.get_running_loop()` with proper detection.

3. **ControlledOrdering infinite loop:** Add a yield-after-N-iterations safeguard or require next_fn to signal completion.

### For P1 Bugs:

1. **Silent agent skip:** Add logging or error event when agent not found.

2. **Exception handling:** Wrap duck-typed calls (pre_turn_rules, on_event) in try/except with proper error events.

3. **Registry lookups:** Add explicit validation with clear error messages for missing keys.

4. **JSON round-trip:** Use deepcopy instead of JSON serialization, or document the limitation.

5. **Thread safety:** Document serialization is not thread-safe, or add locking.

---

## Files Audited

| File | Lines Reviewed | Issues Found |
|------|---------------|--------------|
| src/socialsim4/core/simulator.py | 439 | 4 |
| src/socialsim4/core/ordering.py | 225 | 4 |
| src/socialsim4/core/simtree.py | 720 | 2 |
| src/socialsim4/core/scene.py | 223 | 0 |
| src/socialsim4/core/agent/agent.py | 540 | 0 |
| src/socialsim4/core/agent/serialization.py | 151 | 0 |
| src/socialsim4/core/experiment/scene.py | 498 | 3 |
| src/socialsim4/backend/services/simtree_runtime.py | 636 | 1 |
| src/socialsim4/scenarios/basic.py | 641 | 0 |
| src/socialsim4/scenarios/social_norm_disruption.py | 121 | 2 |
| src/socialsim4/scenarios/echo_chamber.py | 107 | 2 |
| src/socialsim4/scenarios/policy_erosion.py | 103 | 2 |
| src/socialsim4/scenarios/resource_scarcity.py | 108 | 2 |

---

## Audit Complete

**Status:** Completed
**Changes Made:** None (audit only)
**Next Steps:** Prioritize P0 bugs for immediate fix; schedule P1 bugs for next sprint.
