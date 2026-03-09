---
phase: 001-scenario-execution-audit
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
requirements: [AUDIT-01]
user_setup: []

must_haves:
  truths:
    - "All scenarios initialise without throwing exceptions"
    - "Turn execution completes without silent failures"
    - "Agent state persists correctly across turns"
    - "Edge cases (0 agents, 1 agent, large counts) are handled gracefully"
    - "Frontend receives correct state updates during simulation"
  artifacts:
    - path: "src/socialsim4/scenarios/*.py"
      provides: "Scenario builders"
    - path: "src/socialsim4/core/simulator.py"
      provides: "Turn execution loop"
    - path: "src/socialsim4/core/ordering.py"
      provides: "Agent scheduling"
    - path: "src/socialsim4/core/simtree.py"
      provides: "Branch/restore mechanics"
  key_links:
    - from: "simulator.run()"
      to: "ordering.iter()"
      via: "agent selection"
      pattern: "next\\(self\\.order_iter\\)"
    - from: "simulator.run()"
      to: "agent.process()"
      via: "LLM call"
      pattern: "agent\\.process\\(self\\.clients"
    - from: "SimTree.copy_sim()"
      to: "simulator.serialize()"
      via: "clone operation"
      pattern: "_clone_simulator_from_node"
---

<objective>
Audit the scenario execution flow for bugs without fixing anything.

Purpose: Identify P0 (prevents completion) and P1 (recoverable but bad) bugs in the simulation execution path from scenario selection through completed logs.

Output: Structured list of bugs with exact file:line references and severity ratings.
</objective>

<execution_context>
@C:/Users/Justin/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Justin/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

# Key Files to Audit
- src/socialsim4/scenarios/basic.py - Scenario builders
- src/socialsim4/scenarios/social_norm_disruption.py - ExperimentScene scenario
- src/socialsim4/scenarios/echo_chamber.py - ExperimentScene scenario
- src/socialsim4/scenarios/policy_erosion.py - ExperimentScene scenario
- src/socialsim4/scenarios/resource_scarcity.py - ExperimentScene scenario
- src/socialsim4/core/simulator.py - Main execution loop
- src/socialsim4/core/scene.py - Base scene class
- src/socialsim4/core/agent/agent.py - Agent processing
- src/socialsim4/core/simtree.py - Branch/restore
- src/socialsim4/core/ordering.py - Agent scheduling
- src/socialsim4/core/experiment/scene.py - ExperimentScene orchestrator
- src/socialsim4/backend/services/simtree_runtime.py - SimTree runtime
</context>

<tasks>

<task type="auto">
  <name>Task 1: Audit simulator.run() turn execution loop</name>
  <files>src/socialsim4/core/simulator.py, src/socialsim4/core/ordering.py</files>
  <action>
Audit the main turn execution loop in simulator.py for:

1. **Unhandled exceptions in turn loop** (lines 321-438):
   - Line 330: `agent_name = next(self.order_iter)` - What if ordering.iter() returns None or raises StopIteration?
   - Line 331: `agent = self.agents.get(agent_name)` - What if agent_name is not in dict?
   - Line 334: `if not agent: continue` - Silent skip, but no logging. Is this intentional?
   - Lines 346-347: `hasattr(self.scene, 'pre_turn_rules')` - Duck typing, but what if method exists but throws?
   - Lines 365-427: The intra-turn loop exception handling - Check if `continue_turn = False` actually prevents infinite loops
   - Line 424: `_emit_error_event` catches and logs, but does not re-raise. Could hide critical bugs.

2. **Agent state persistence between turns**:
   - Check if `agent.short_memory` is correctly preserved
   - Check if `agent.properties` mutations persist
   - Verify `self.turns` counter increments correctly (line 437-438)

3. **Edge case handling**:
   - What happens with 0 agents in `self.agents`?
   - What happens with 1 agent?
   - What happens with 100+ agents (performance/memory)?

4. **Ordering implementation bugs** (ordering.py):
   - SequentialOrdering.iter() lines 55-62: Does `_idx` wrap correctly?
   - RandomOrdering.iter() lines 105-110: No state, creates new list each call. Could cause issues with 0 agents.
   - ControlledOrdering.iter() lines 125-131: If `next_fn` returns None, infinite loop with no yield.
   - CycledOrdering.iter() lines 81-87: What if `self.names` is empty?

For each issue found, document:
- File and line number
- Bug description
- Severity: P0 (prevents completion) or P1 (recoverable but bad)
- Reproduction conditions
  </action>
  <verify>
    <automated>echo "Audit complete - check output for bug list"</automated>
  </verify>
  <done>Documented list of bugs in simulator.run() and ordering with file:line references</done>
</task>

<task type="auto">
  <name>Task 2: Audit scenario initialization and ExperimentScene execution</name>
  <files>src/socialsim4/scenarios/basic.py, src/socialsim4/scenarios/social_norm_disruption.py, src/socialsim4/scenarios/echo_chamber.py, src/socialsim4/scenarios/policy_erosion.py, src/socialsim4/scenarios/resource_scarcity.py, src/socialsim4/core/experiment/scene.py, src/socialsim4/backend/services/simtree_runtime.py</files>
  <action>
Audit scenario builders and ExperimentScene for:

1. **Scenario initialization failures** (scenarios/*.py):
   - social_norm_disruption.py lines 43-46: `CATEGORY_ACTION_LIBRARIES['sociology']` - What if key doesn't exist?
   - echo_chamber.py lines 39-42: Same issue with CATEGORY_ACTION_LIBRARIES
   - policy_erosion.py lines 37-40: Same issue
   - resource_scarcity.py lines 39-42: Same issue
   - All use `next(a['description'] for a in sociology_actions if a['name'] == action_name)` - What if action_name not found? StopIteration exception.

2. **ExperimentScene initialization** (experiment/scene.py):
   - Line 56-57: Early return if `self.runner is not None` - What if called twice with different llm_client?
   - Line 84-85: `get_information_model(self.config.scenario_id)` - What if scenario_id not in registry?
   - Line 138-151: `run_round()` raises ValueError if not initialized - Is this checked at API level?

3. **ExperimentRunnerAdapter issues** (simtree_runtime.py):
   - Line 72-82: `run()` calls `asyncio.run()` for each turn - This creates new event loop each call. Could cause issues if called from async context.
   - Line 82: `asyncio.run(self.scene.run_round(...))` - What if run_round raises? No try/except.

4. **Config validation gaps**:
   - Check if agent names are validated for uniqueness
   - Check if action names are validated against registry
   - Check if required parameters are validated

For each issue found, document:
- File and line number
- Bug description
- Severity: P0 or P1
- Reproduction conditions
  </action>
  <verify>
    <automated>echo "Audit complete - check output for bug list"</automated>
  </verify>
  <done>Documented list of bugs in scenario initialization and ExperimentScene with file:line references</done>
</task>

<task type="auto">
  <name>Task 3: Audit SimTree branch/restore and agent state persistence</name>
  <files>src/socialsim4/core/simtree.py, src/socialsim4/core/simulator.py, src/socialsim4/core/agent/agent.py</files>
  <action>
Audit SimTree cloning and state persistence for:

1. **SimTree clone mechanics** (simtree.py):
   - Lines 172-207: `_clone_simulator_from_node()` - Check if all agent state is deep-copied
   - Lines 209-305: `_check_simulator_clone()` - Review all invariant checks
   - Line 296-301: Event queue check - Is `event_queue.empty()` reliable?
   - Lines 314-316: `json.loads(json.dumps(parent_logs))` - This is inefficient and may lose non-JSON-serializable data

2. **Simulator serialization** (simulator.py):
   - Lines 178-192: `serialize()` - Check if all state is captured
   - Line 187: `list(self.event_queue.queue)` - Is this thread-safe?
   - Lines 194-252: `deserialize()` - Check if all state is restored correctly
   - Lines 217-229: Ordering reconstruction - Does it handle all ordering types?

3. **Agent serialization** (agent/agent.py):
   - Check `serialize_agent` and `deserialize_agent` in serialization.py (imported at line 40)
   - Verify `knowledge_base` and `documents` are preserved
   - Verify `consecutive_llm_errors` and `is_offline` state is preserved

4. **Branch operation bugs** (simtree.py):
   - Lines 521-566: `branch()` method - Check each operation type
   - Lines 537-561: What if operation type is unknown? Raises ValueError but node already created.
   - Lines 568-609: `apply_agent_overrides()` - Check if all property types are handled

5. **Frontend state reflection**:
   - Check if WebSocket events are emitted correctly after each turn
   - Check if agent offline status is communicated to frontend
   - Check if error events reach frontend

For each issue found, document:
- File and line number
- Bug description
- Severity: P0 or P1
- Reproduction conditions
  </action>
  <verify>
    <automated>echo "Audit complete - check output for bug list"</automated>
  </verify>
  <done>Documented list of bugs in SimTree branch/restore with file:line references</done>
</task>

</tasks>

<verification>
After completing all tasks, compile a prioritized bug list with:

## Bug Report Format

```markdown
### [P0/P1] Brief Bug Title

**File:** path/to/file.py:line_number
**Severity:** P0 (prevents completion) / P1 (recoverable but bad)

**Description:**
What the bug is and why it matters.

**Reproduction:**
1. Condition or step to trigger
2. Expected vs actual behavior

**Impact:**
What scenarios/features are affected.
```

Sort by severity (P0 first), then by likelihood of occurrence.
</verification>

<success_criteria>
- All 5 scenario files audited for initialization issues
- simulator.run() turn loop audited for exception handling
- Ordering implementations audited for edge cases
- SimTree clone/restore audited for state persistence
- Agent state serialization audited
- Prioritized bug list produced with exact file:line references
- No code changes made (audit only)
</success_criteria>

<output>
After completion, create `.planning/quick/001-scenario-execution-audit/001-SUMMARY.md` containing the prioritized bug list.
</output>
