---
gsd_state_version: 1.0
phase: 002-bug-report
plan: 001
subsystem: execution-flow
tags: [audit, bugs, execution, simulation, report]
completed_at: "2026-03-08"
duration_minutes: 20
---

# Quick Task 002: Detailed Bug Report

**Objective:** Provide exact problematic code, crash/failure analysis, and concrete user triggers for each identified bug.

**Source:** Audit summary from `.planning/quick/001-scenario-execution-audit/001-SUMMARY.md`

---

## P0 Bugs (Prevents Completion)

### [P0-01] ExperimentScene.run_round() ValueError if Not Initialized

**File:** `src/socialsim4/core/experiment/scene.py:150-151`

**Exact Problematic Code:**
```python
def run_round(self, event_emitter=None) -> "RoundResult":
    # ... docstring ...

    if self.runner is None:
        raise ValueError("ExperimentScene not initialized - call initialize() first")
```

**Why It Crashes:**
The `run_round()` method checks if `self.runner` is `None` and raises a `ValueError`. This is a defensive check that surfaces correctly, but:
1. There is no auto-initialization or graceful recovery
2. The error propagates up through SimTree operations
3. No user-friendly error message reaches the frontend

**User Action That Triggers It:**
1. User creates an experiment_template scenario via API
2. User calls "advance simulation" (SimTree.advance_node)
3. Backend fails to call `scene.initialize()` before `run_round()`
4. ValueError is raised, crashing the simulation run
5. Frontend shows generic error, no specific guidance

**Concrete Example:**
```python
# In simtree_runtime.py or similar
scene = ExperimentScene(config)
# Oops, forgot to call scene.initialize(llm_client)
scene.run_round(emit_event)  # <- ValueError raised here
```

---

### [P0-02] asyncio.run() Creates New Event Loop in Async Context

**File:** `src/socialsim4/backend/services/simtree_runtime.py:82`

**Exact Problematic Code:**
```python
def run(self, max_turns: int = 1) -> None:
    """Run experiment rounds (each 'turn' = one round)."""
    import asyncio

    if not self.scene.runner:
        self.scene.initialize(self._llm_client)

    for _ in range(max_turns):
        if self.scene.is_complete():
            break
        asyncio.run(self.scene.run_round(self._emit_event))  # <- PROBLEM
```

**Why It Crashes:**
`asyncio.run()` creates a **new event loop** each call. If `ExperimentRunnerAdapter.run()` is called from within an existing async context (FastAPI async route handler), Python raises:
```
RuntimeError: This event loop is already running
```

This is because you cannot nest `asyncio.run()` inside an already-running event loop.

**User Action That Triggers It:**
1. User starts FastAPI backend server
2. Frontend calls POST `/api/simulation/{id}/advance` endpoint
3. If the endpoint is defined as `async def advance_simulation(...)`:
   - FastAPI runs it in an async context with an active event loop
4. Endpoint calls `adapter.run(max_turns=1)`
5. `asyncio.run()` tries to create a new loop → RuntimeError

**Concrete Example:**
```python
# In FastAPI route
@router.post("/simulation/{sim_id}/advance")
async def advance_simulation(sim_id: str):  # <- async handler
    adapter = get_adapter(sim_id)
    adapter.run(max_turns=1)  # <- RuntimeError: This event loop is already running
```

---

### [P0-03] ControlledOrdering.iter() Infinite Loop with None-Returning next_fn

**File:** `src/socialsim4/core/ordering.py:125-131`

**Exact Problematic Code:**
```python
class ControlledOrdering(Ordering):
    NAME = "controlled"

    def __init__(self, next_fn: Optional[Callable[[object], Optional[str]]] = None):
        super().__init__()
        self.next_fn = next_fn

    def iter(self) -> Iterator[str]:
        while True:
            name = None
            if self.next_fn:
                name = self.next_fn(self.sim)
            if name and name in self.sim.agents:
                yield name
            # <- If name is None, loop continues forever WITHOUT yielding
```

**Why It Crashes (Hangs):**
The `while True` loop has only two outcomes:
1. `name` is valid → yield and continue
2. `name` is None → **loop continues without yielding, forever**

There is no:
- Timeout
- Break condition
- Maximum iteration count
- Yield of control back to caller

This causes 100% CPU usage and the simulation never progresses.

**User Action That Triggers It:**
1. User runs a landlord game scenario (uses ControlledOrdering)
2. During a phase transition (e.g., between bidding and playing)
3. `next_fn` returns None because no player is currently active
4. Simulation hangs indefinitely, frontend shows "running..." forever
5. Server CPU spikes to 100%

**Concrete Example:**
```python
def landlord_next_player(sim):
    # During phase transition, no active player
    if sim.scene.phase == "transitioning":
        return None  # <- Triggers infinite loop
    return sim.scene.current_player

ordering = ControlledOrdering(next_fn=landlord_next_player)
# When phase is "transitioning", iter() spins forever
```

---

## P1 Bugs (Recoverable but Bad UX)

### [P1-01] Silent Agent Skip with No Logging

**File:** `src/socialsim4/core/simulator.py:334-335`

**Exact Problematic Code:**
```python
while turns < max_turns:
    # ... scene completion check ...

    agent_name = next(self.order_iter)
    agent = self.agents.get(agent_name)
    print(f"Turn {turns}: {agent_name}")

    if not agent:
        continue  # <- Silent skip, no logging, no error event
```

**Why It Fails:**
When `ordering.iter()` returns an agent name that doesn't exist in `self.agents`:
1. The turn is silently skipped
2. No log message (only a print statement, not structured logging)
3. No error event emitted
4. Simulation continues as if nothing happened

This makes debugging ordering configuration issues extremely difficult.

**User Action That Triggers It:**
1. Developer creates a custom Ordering class
2. Ordering returns agent names that don't match agent keys
3. User runs simulation
4. Some agents never get turns, but no error is shown
5. Debugging requires manual code inspection

**Concrete Example:**
```python
# Custom ordering with typo
class MyOrdering(Ordering):
    def iter(self):
        while True:
            yield "agent_1"  # But actual agent is named "agent_1_alice"

# In simulator
agent_name = "agent_1"  # from ordering
agent = self.agents.get("agent_1")  # Returns None
# continue silently, agent_1_alice never gets a turn
```

---

### [P1-02] pre_turn_rules Duck Typing Without Exception Handling

**File:** `src/socialsim4/core/simulator.py:346-347`

**Exact Problematic Code:**
```python
# Pre-turn rule evaluation for contagion scenes
if hasattr(self.scene, 'pre_turn_rules'):
    self.scene.pre_turn_rules(self)  # <- No try/except wrapper
```

**Why It Fails:**
If `pre_turn_rules` exists on the scene but raises an exception:
1. The exception propagates up uncaught
2. The entire turn crashes
3. Simulation stops with unhandled exception
4. No error event is emitted before crash

**User Action That Triggers It:**
1. User creates a custom scene with `pre_turn_rules` method
2. The method has a bug (e.g., accessing non-existent key)
3. User runs simulation
4. First turn crashes with unhandled exception

**Concrete Example:**
```python
class MyScene(Scene):
    def pre_turn_rules(self, sim):
        # Bug: wrong key name
        phase = self.state["current_phase"]  # KeyError if key is "phase"
        # Or division by zero
        ratio = 10 / len(self.active_agents)  # ZeroDivisionError if empty
```

---

### [P1-03] Error Event Emission Catches and Suppresses Exceptions

**File:** `src/socialsim4/core/simulator.py:282-286`

**Exact Problematic Code:**
```python
data = {
    "agent": agent_name,
    "step": step,
    "turn": self.turns,
    "scene_type": type(self.scene).__name__,
    "ordering": getattr(self.ordering, "NAME", self.ordering.__class__.__name__),
}
try:
    self.emit_event("error", data)
except Exception:
    # Don't let error reporting crash the simulation
    logger.exception("failed to emit error event")  # <- Original error context lost
```

**Why It Fails:**
When `emit_event("error", data)` itself fails:
1. The exception is caught and logged
2. The **original error** that triggered the error event is NOT logged
3. Simulation continues in potentially broken state
4. Developers have no visibility into what went wrong

**User Action That Triggers It:**
1. User configures a custom `log_event` handler
2. The handler has a bug and raises an exception
3. A simulation error occurs
4. Error event emission fails, original error is lost
5. Simulation continues with corrupted state

**Concrete Example:**
```python
def my_log_handler(event_type, data):
    if event_type == "error":
        # Bug: data might not have expected structure
        raise ValueError(f"Error: {data['nonexistent_key']}")

# Later, when simulation has an error:
simulator.emit_event("error", {"agent": "alice", "step": 0})
# -> my_log_handler raises ValueError
# -> Caught, only "failed to emit error event" is logged
# -> Original error is never recorded
```

---

### [P1-04] Ordering.on_event Exceptions Suppressed

**File:** `src/socialsim4/core/simulator.py:115-120`

**Exact Problematic Code:**
```python
# Pass to ordering for scheduling awareness
if self.started and self.ordering is not None:
    try:
        self.ordering.on_event(self, event_type, data)
    except Exception:
        # ordering's on_event should not crash the simulation
        logger.exception("ordering.on_event raised")  # <- Silent suppression
```

**Why It Fails:**
If `ordering.on_event()` raises an exception:
1. It's logged but suppressed
2. Simulation continues with broken scheduling
3. LLMModeratedOrdering depends on `on_event` for queue refilling
4. Agents may never be scheduled again

**User Action That Triggers It:**
1. User runs simulation with LLMModeratedOrdering
2. LLM moderator fails (API error, invalid response, etc.)
3. `on_event` raises exception
4. Exception is suppressed, queue never refills
5. Remaining agents never get turns

**Concrete Example:**
```python
class LLMModeratedOrdering(Ordering):
    def on_event(self, sim, event_type, data):
        if event_type == "action_complete":
            # Ask LLM who should go next
            response = self.llm.generate(...)  # <- API timeout/error
            # Exception is caught and suppressed
            # Queue never refills
```

---

### [P1-05] CATEGORY_ACTION_LIBRARIES KeyError

**Files:**
- `src/socialsim4/scenarios/social_norm_disruption.py:46`
- `src/socialsim4/scenarios/echo_chamber.py:39`
- `src/socialsim4/scenarios/policy_erosion.py:37`
- `src/socialsim4/scenarios/resource_scarcity.py:39`

**Exact Problematic Code (same pattern in all files):**
```python
from socialsim4.core.scenarios.actions import CATEGORY_ACTION_LIBRARIES

# Get sociology actions
sociology_actions = CATEGORY_ACTION_LIBRARIES['sociology']  # <- KeyError if missing
```

**Why It Crashes:**
If the `'sociology'` key doesn't exist in `CATEGORY_ACTION_LIBRARIES`:
1. `KeyError` is raised immediately
2. No validation, no fallback, no clear error message
3. Scenario initialization crashes

**User Action That Triggers It:**
1. Developer renames `'sociology'` to `'social'` in actions registry
2. User tries to create any experiment scenario
3. Scenario builder crashes with `KeyError: 'sociology'`
4. Error message is cryptic, doesn't indicate which file/line

**Concrete Example:**
```python
# In actions.py
CATEGORY_ACTION_LIBRARIES = {
    'social': [...],  # Renamed from 'sociology'
}

# In scenario builder
sociology_actions = CATEGORY_ACTION_LIBRARIES['sociology']  # KeyError!
```

---

### [P1-06] StopIteration in Scenario Action Lookup

**Files:**
- `src/socialsim4/scenarios/social_norm_disruption.py:61`
- `src/socialsim4/scenarios/echo_chamber.py:55`
- `src/socialsim4/scenarios/policy_erosion.py:53`
- `src/socialsim4/scenarios/resource_scarcity.py:55`

**Exact Problematic Code (same pattern in all files):**
```python
actions_config = [
    {
        'name': action_name,
        'description': next(a['description'] for a in sociology_actions if a['name'] == action_name)
        # <- StopIteration if action_name not found
    }
    for action_name in relevant_actions
]
```

**Why It Crashes:**
`next()` with a generator raises `StopIteration` if no element matches:
1. Typo in action name → StopIteration
2. Action removed from library → StopIteration
3. Error message is cryptic (just "StopIteration")

**User Action That Triggers It:**
1. Developer adds a new action to `relevant_actions` list
2. Typo in action name: `'persuade_others'` vs `'persuade_other'`
3. User tries to build the scenario
4. `StopIteration` crashes initialization
5. No indication of which action name is wrong

**Concrete Example:**
```python
relevant_actions = [
    'comply_publicly',
    'persuade_other',  # Typo: should be 'persuade_others'
]

# Generator finds no match for 'persuade_other'
description = next(a['description'] for a in sociology_actions if a['name'] == 'persuade_other')
# -> StopIteration raised
```

---

### [P1-07] get_information_model Registry Lookup Failure

**File:** `src/socialsim4/core/experiment/scene.py:84`

**Exact Problematic Code:**
```python
# Get InformationModel from registry (deferred import to avoid circular dependency)
from socialsim4.core.registry import get_information_model, pair_agents_randomly
from socialsim4.core.experiment.information_model import InformationModel

information_model = get_information_model(self.config.scenario_id)
# <- What if scenario_id is unknown?
```

**Why It Fails:**
If `scenario_id` is not in the registry:
1. `get_information_model` may return a default
2. Behavior is undefined (depends on registry implementation)
3. Could cause incorrect visibility rules
4. Could cause subtle bugs in agent perception

**User Action That Triggers It:**
1. User creates ExperimentConfig with custom scenario_id
2. `scenario_id = "my_custom_game"`
3. Registry doesn't have this scenario
4. Gets default "all" scope instead of appropriate model
5. Agents see information they shouldn't see

**Concrete Example:**
```python
config = ExperimentConfig(
    scenario_id="custom_prisoners_dilemma",  # Not in registry
    ...
)
scene = ExperimentScene(config)
scene.initialize(llm_client)
# information_model is default "all" scope
# Agents see all other agents' actions (wrong for PD)
```

---

### [P1-08] Inefficient JSON Round-Trip in SimTree.copy_sim()

**File:** `src/socialsim4/core/simtree.py:315-317`

**Exact Problematic Code:**
```python
def copy_sim(self, node_id: int) -> int:
    # Clone the simulator by snapshotting the node's live sim
    sim_copy = self._clone_simulator_from_node(node_id)

    # Prepare a new node with inherited logs snapshot; parent/ops assigned later
    nid = self._next_id()
    parent_logs = list(self.nodes[node_id].get("logs", []))
    parent_meta = json.loads(json.dumps(self.nodes[node_id].get("meta", {})))
    # Deep copy parent's logs so child does not share dict references
    child_logs: List[dict] = json.loads(json.dumps(parent_logs))  # <- Inefficient
```

**Why It Fails:**
JSON round-trip (`json.loads(json.dumps(...))`) has issues:
1. **Performance:** Serialization + deserialization is O(n) twice
2. **Data loss:** Non-JSON types are lost:
   - `datetime` objects → strings
   - `set` objects → lists
   - Custom objects → errors or dicts
3. **Precision loss:** Large integers may lose precision

**User Action That Triggers It:**
1. User creates simulation with custom metadata
2. Metadata includes `datetime` objects
3. User branches the simulation (SimTree.copy_sim)
4. `datetime` is converted to ISO string
5. Downstream code expects `datetime`, gets string → TypeError

**Concrete Example:**
```python
# Store datetime in node meta
node["meta"]["created_at"] = datetime.now()

# Branch simulation
child_id = simtree.copy_sim(parent_id)

# Retrieve child meta
child_meta = simtree.nodes[child_id]["meta"]
created = child_meta["created_at"]  # Now a string, not datetime!

# Later code expects datetime
if created > datetime.now() - timedelta(hours=1):  # TypeError!
```

---

### [P1-09] Event Queue Thread Safety

**File:** `src/socialsim4/core/simulator.py:187`

**Exact Problematic Code:**
```python
snap = {
    "agents": {name: agent.serialize() for name, agent in self.agents.items()},
    "scene": self.scene.serialize(),
    "max_steps_per_turn": int(self.max_steps_per_turn),
    "ordering": getattr(self.ordering, "NAME", "sequential"),
    "ordering_state": ord_state,
    # Serialize pending event queue as a list of items
    "event_queue": list(self.event_queue.queue),  # <- Not thread-safe
    "turns": int(self.turns),
    "environment_config": self.environment_config.serialize(),
    "_suggestions_viewed_turn": self._suggestions_viewed_turn,
}
```

**Why It Fails:**
`list(self.event_queue.queue)` accesses the internal `queue` attribute:
1. If another thread is adding/removing events concurrently
2. The list conversion could see inconsistent state
3. Could raise exceptions or produce corrupted data

**User Action That Triggers It:**
1. User runs simulation with SimTree
2. SimTree operations trigger concurrent branch operations
3. One thread serializes while another emits events
4. Race condition causes data corruption or exception

**Concrete Example:**
```python
# Thread 1: Emitting events
simulator.emit_event_later("action", {...})

# Thread 2: Serializing for SimTree branch
snapshot = simulator.serialize()  # Accesses event_queue.queue

# Race condition:
# - Thread 1 is modifying queue
# - Thread 2 is iterating over queue.queue
# - Possible: RuntimeError, corrupted data, or missing events
```

---

### [P1-10] CycledOrdering.iter() Empty Names List

**File:** `src/socialsim4/core/ordering.py:81-87`

**Exact Problematic Code:**
```python
class CycledOrdering(Ordering):
    NAME = "cycled"

    def __init__(self, names):
        self.names = names
        self._idx: int = 0

    def iter(self) -> Iterator[str]:
        while True:
            if not self.names:
                break  # <- Exits loop, generator ends
            ret = self.names[self._idx]
            self._idx = (self._idx + 1) % len(self.names)
            yield ret
```

**Why It Fails:**
If `self.names` is empty:
1. The `while True` loop breaks immediately
2. Generator ends with implicit `StopIteration`
3. Callers expecting infinite iterator may not handle this

**User Action That Triggers It:**
1. User creates Werewolf scene with 0 players (misconfiguration)
2. CycledOrdering is initialized with empty list
3. `iter()` returns immediately
4. `next(self.order_iter)` raises `StopIteration`
5. Uncaught exception crashes simulation

**Concrete Example:**
```python
# Misconfigured scene
ordering = CycledOrdering(names=[])  # No players configured

# In simulator.run()
agent_name = next(self.order_iter)  # StopIteration!
```

---

### [P1-11] RandomOrdering.iter() Empty Agents

**File:** `src/socialsim4/core/ordering.py:105-110`

**Exact Problematic Code:**
```python
class RandomOrdering(Ordering):
    NAME = "random"

    def __init__(self, seed: Optional[int] = None):
        super().__init__()
        self.rng = random.Random(seed)

    def iter(self) -> Iterator[str]:
        while True:
            names = list(self.sim.agents.keys())
            if not names:
                break  # <- Exits loop, generator ends
            yield self.rng.choice(names)
```

**Why It Fails:**
If `sim.agents` is empty:
1. Generator breaks immediately
2. Same issue as CycledOrdering
3. Could happen with dynamic agent removal

**User Action That Triggers It:**
1. User creates simulation with RandomOrdering
2. Scene removes all agents (game over condition)
3. Next call to `next(self.order_iter)` raises `StopIteration`
4. Simulation crashes instead of ending gracefully

**Concrete Example:**
```python
# All agents eliminated
sim.agents.clear()

# In next turn
agent_name = next(self.order_iter)  # StopIteration!
```

---

### [P1-12] SequentialOrdering.set_simulation() Modulo Edge Case

**File:** `src/socialsim4/core/ordering.py:53`

**Exact Problematic Code:**
```python
class SequentialOrdering(Ordering):
    NAME = "sequential"

    def set_simulation(self, sim) -> None:
        super().set_simulation(sim)
        # Freeze the scheduling candidate set at init time
        self._names = list(self.sim.agents.keys())
        self._idx = int(self._idx) % (len(self._names) if self._names else 1)
```

**Why It Might Fail:**
The ternary `(len(self._names) if self._names else 1)` prevents division by zero, but:
1. If `_names` becomes empty AFTER initialization
2. And `iter()` is called
3. The loop will break (handled, but may surprise callers)

**User Action That Triggers It:**
1. User creates simulation with agents
2. Scene dynamically removes all agents mid-simulation
3. Next `iter()` call breaks immediately
4. Callers expecting infinite iterator may crash

**Concrete Example:**
```python
ordering = SequentialOrdering()
ordering.set_simulation(sim)  # 3 agents, _idx = 0

# Later, scene removes all agents
sim.agents.clear()

# iter() handles empty case but caller might not
for _ in range(100):
    name = next(ordering.iter())  # StopIteration after empty list detected
```

---

## Summary Table

| ID | File | Line | Severity | Issue |
|----|------|------|----------|-------|
| P0-01 | experiment/scene.py | 150-151 | Crash | ValueError if not initialized |
| P0-02 | simtree_runtime.py | 82 | Crash | asyncio.run() in async context |
| P0-03 | ordering.py | 125-131 | Hang | Infinite loop on None next_fn |
| P1-01 | simulator.py | 334-335 | UX | Silent agent skip, no logging |
| P1-02 | simulator.py | 346-347 | Crash | pre_turn_rules unhandled exception |
| P1-03 | simulator.py | 282-286 | UX | Error event failure suppresses original error |
| P1-04 | simulator.py | 115-120 | UX | Ordering.on_event exceptions suppressed |
| P1-05 | scenarios/*.py | ~46 | Crash | KeyError on missing action library |
| P1-06 | scenarios/*.py | ~61 | Crash | StopIteration on missing action |
| P1-07 | experiment/scene.py | 84 | Bug | Unknown scenario_id gets wrong model |
| P1-08 | simtree.py | 315-317 | Bug | JSON round-trip loses data |
| P1-09 | simulator.py | 187 | Race | Event queue not thread-safe |
| P1-10 | ordering.py | 81-87 | Crash | CycledOrdering empty names |
| P1-11 | ordering.py | 105-110 | Crash | RandomOrdering empty agents |
| P1-12 | ordering.py | 53 | Edge | SequentialOrdering empty edge case |

---

## Report Complete

**Status:** Completed
**Changes Made:** None (report only)
**Next Steps:** Prioritize P0 bugs for immediate fix; review P1 bugs for sprint planning.
