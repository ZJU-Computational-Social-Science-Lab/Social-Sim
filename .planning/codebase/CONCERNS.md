# Codebase Concerns

**Analysis Date:** 2026-03-18

## Tech Debt

### Deprecated Files Not Cleaned Up

**Issue:** Three `.deprecated` files remain in the codebase despite being replaced by refactored versions.
- Files: `src/socialsim4/backend/api/routes/simulations.py.deprecated`, `src/socialsim4/core/agent.py.deprecated`, `src/socialsim4/core/llm.py.deprecated`
- Impact: Creates confusion about which files are active; potential for developers to edit wrong files; adds to codebase maintenance burden
- Fix approach: Remove deprecated files entirely. They have been superseded by:
  - `simtree_runtime.py` and `tree_operations.py` (for `simulations.py.deprecated`)
  - `src/socialsim4/core/agent/` directory structure (for `agent.py.deprecated`)
  - `src/socialsim4/core/llm/` directory structure (for `llm.py.deprecated`)

### Massive Files Exceeding Size Limits

**Issue:** Multiple files far exceed the 500-line hard limit specified in CLAUDE.md.

**Backend - Policy Cascade Scene:**
- File: `src/socialsim4/core/scenes/policy_cascade_scene.py` (1,477 lines)
- Impact: Nearly 3x the hard limit; difficult to navigate, test, and maintain
- Fix approach: Split into focused modules:
  - `policy_cascade_scene.py` (main scene class)
  - `policy_cascade_tiers.py` (tier management logic)
  - `policy_cascade_analysis.py` (notice analysis logic)
  - `policy_cascade_execution.py` (execution tracking logic)

**Frontend - SimulationWizard:**
- File: `frontend/components/SimulationWizard.tsx` (1,305 lines)
- Impact: Over 3x the 400-line hard limit for components; complex state management mixed with UI
- Fix approach: Already partially refactored with sub-components, but main file still too large. Extract:
  - Wizard state management to custom hook (`useWizardState.ts`)
  - Validation logic to `wizard/validation.ts`
  - File import handling to `wizard/importHandlers.ts`

**Frontend - Step4Agents:**
- File: `frontend/components/experiment/Step4Agents.tsx` (1,182 lines)
- Impact: Nearly 3x component size limit; complex demographic generation mixed with manual agent editing
- Fix approach: Split into:
  - `Step4AgentsManual.tsx` (manual agent type editor)
  - `Step4AgentsDemographic.tsx` (demographic generation UI)
  - `Step4AgentsImport.tsx` (CSV/JSON import UI)
  - Shared component composition in `Step4Agents.tsx`

**Frontend - NetworkEditorModal:**
- File: `frontend/components/NetworkEditorModal.tsx` (1,138 lines)
- Impact: Complex D3.js visualization mixed with network logic and UI state
- Fix approach: Extract:
  - Network visualization to `network/GraphVisualization.tsx`
  - Preset logic to `network/presets.ts`
  - D3-specific code to `network/d3Renderer.ts`

**Frontend - Test File:**
- File: `frontend/store/index.test.ts` (1,339 lines)
- Impact: Monolithic test file; slow to run; difficult to locate specific tests
- Fix approach: Split by store slice:
  - `simulation.test.ts`
  - `experiments.test.ts`
  - `environment.test.ts`

### TODO Comments in Production Code

**Issue:** TODO comment indicates incomplete implementation.
- File: `src/socialsim4/backend/schemas/experiment.py:172`
- Impact: `llm_config` field exists but is not implemented in experiment execution; users may configure LLM settings that have no effect
- Fix approach: Either implement the `llm_config` handling in `src/socialsim4/core/experiment/runner.py` or remove the field from the schema with a deprecation notice

## Known Bugs

### ExperimentScene Requires Manual Initialization

**Issue:** `ExperimentScene.run_round()` raises `ValueError` if `initialize()` is not called first.
- Files: `src/socialsim4/core/experiment/scene.py:150-151`
- Symptoms: Simulation crashes with cryptic error message
- Trigger: Creating an `ExperimentScene` and calling `run_round()` without calling `initialize(llm_client)` first
- Workaround: Always call `scene.initialize(llm_client)` before `run_round()`
- Reported in: `.planning/quick/002-bug-report/002-SUMMARY.md` (P0-01)

### AsyncIO Event Loop Conflict

**Issue:** `asyncio.run()` called within existing async context in `ExperimentRunnerAdapter.run()`.
- Files: `src/socialsim4/backend/services/simtree_runtime.py:82`
- Symptoms: `RuntimeError: This event loop is already running` when running experiments from async FastAPI routes
- Trigger: POST `/api/simulation/{id}/advance` endpoint calls `adapter.run()` while in async context
- Workaround: Use `await scene.run_round()` instead of `asyncio.run()` or ensure route handlers are synchronous
- Reported in: `.planning/quick/002-bug-report/002-SUMMARY.md` (P0-02)

### ControlledOrdering Infinite Loop

**Issue:** `ControlledOrdering.iter()` enters infinite loop when `next_fn` returns `None`.
- Files: `src/socialsim4/core/ordering.py:125-131`
- Symptoms: Simulation hangs, CPU spikes to 100%, frontend shows "running..." indefinitely
- Trigger: Landlord game phase transitions where no player is currently active
- Workaround: Ensure `next_fn` always returns a valid agent name or add break condition
- Reported in: `.planning/quick/002-bug-report/002-SUMMARY.md` (P0-03)

### Silent Agent Skip

**Issue:** Simulator silently skips agents when ordering returns non-existent agent names.
- Files: `src/socialsim4/core/simulator.py:334-335`
- Symptoms: Some agents never get turns, but no error or warning is logged
- Trigger: Custom `Ordering` class returns agent names that don't match `simulator.agents` keys
- Workaround: None currently; makes debugging ordering configuration difficult
- Reported in: `.planning/quick/002-bug-report/002-SUMMARY.md` (P1-01)

### Action Library KeyError

**Issue:** Multiple scenario builders access `CATEGORY_ACTION_LIBRARIES['sociology']` without validation.
- Files: `src/socialsim4/scenarios/social_norm_disruption.py:46`, `echo_chamber.py:39`, `policy_erosion.py:37`, `resource_scarcity.py:39`
- Symptoms: `KeyError: 'sociology'` crashes scenario initialization if key is renamed
- Trigger: Renaming 'sociology' category in actions registry without updating all scenarios
- Workaround: None; requires code fix
- Reported in: `.planning/quick/002-bug-report/002-SUMMARY.md` (P1-05)

### StopIteration in Action Lookup

**Issue:** `next()` with generator raises `StopIteration` when action name not found.
- Files: `src/socialsim4/scenarios/social_norm_disruption.py:61`, `echo_chamber.py:55`, `policy_erosion.py:53`, `resource_scarcity.py:55`
- Symptoms: Cryptic `StopIteration` error when action name has typo or is removed from library
- Trigger: Typo in action name or action removed from `CATEGORY_ACTION_LIBRARIES`
- Workaround: None; requires code fix
- Reported in: `.planning/quick/002-bug-report/002-SUMMARY.md` (P1-06)

## Security Considerations

### .env Files in Gitignore (Correct)

**Status:** ✅ Properly configured
- Files: `.env`, `.env.*` patterns are in `.gitignore`
- Risk: Low - environment variables with secrets are correctly excluded
- Current mitigation: Gitignore prevents accidental commits

### No Secret Validation

**Issue:** No automated checks for secrets before commits.
- Risk: Medium - API keys or credentials could be accidentally committed in code
- Files: Potentially any configuration files
- Current mitigation: None beyond developer diligence
- Recommendations:
  - Add pre-commit hook with secret scanning (e.g., `git-secrets` or `truffleHog`)
  - Add `.env.example` template for required environment variables
  - Document all required environment variables in README

### LLM API Keys in Frontend

**Issue:** Frontend store helpers reference `import.meta.env.VITE_GEMINI_API_KEY` and `process.env.API_KEY`.
- Files: `frontend/store/helpers.ts:786-788`
- Risk: High - API keys exposed in client-side bundle if environment variables are set during build
- Current mitigation: Variables are typically undefined (no actual key暴露 in production)
- Recommendations:
  - Remove all client-side API key access
  - Route all LLM calls through backend API
  - Add documentation explaining why frontend should never have API keys

## Performance Bottlenecks

### JSON Round-Trip for Deep Copy

**Issue:** SimTree uses `json.loads(json.dumps(...))` for deep copying metadata.
- Files: `src/socialsim4/core/simtree.py:315-317`
- Problem: Serialization + deserialization is O(n) twice; loses non-JSON types (datetime, set, custom objects)
- Cause: Using JSON as generic deep-copy mechanism
- Impact: Data loss when branching simulations with datetime metadata; slower than necessary
- Improvement path: Use `copy.deepcopy()` for Python objects; handle serialization separately if needed
- Reported in: `.planning/quick/002-bug-report/002-SUMMARY.md` (P1-08)

### Event Queue Thread Safety

**Issue:** `list(self.event_queue.queue)` accesses internal queue attribute without locks.
- Files: `src/socialsim4/core/simulator.py:187`
- Problem: If serialization happens concurrently with event emission, could see inconsistent state
- Cause: Direct access to `queue.queue` instead of using queue-safe iteration
- Impact: Potential data corruption or exceptions during SimTree branching
- Improvement path: Use thread-safe queue iteration or add mutex lock around serialization
- Reported in: `.planning/quick/002-bug-report/002-SUMMARY.md` (P1-09)

### No Spatial Indexing for Grid Scenes

**Issue:** Village scene uses direct distance calculations rather than spatial indexing.
- Files: `src/socialsim4/core/scenes/village_scene.py`
- Problem: O(n²) adjacency calculations as agent count increases
- Cause: Naive implementation checks every agent against every other for proximity
- Impact: Simulations with 50+ agents become slow; LLM calls compound the problem
- Improvement path: Implement grid-based spatial indexing; cache adjacency until agents move
- Documented in: `.planning/research/PITFALLS.md` (Pitfall 2: Grid Adjacency)

### Frontend Bundle Size

**Issue:** Large component files contribute to bigger bundle sizes.
- Files: Large frontend components (SimulationWizard, Step4Agents, NetworkEditorModal)
- Problem: More code = slower initial load and larger bundle download
- Impact: Slower initial page load, especially on slower connections
- Improvement path: Code splitting with React.lazy(); extract utility functions to separate files

## Fragile Areas

### Ordering System

**Files:** `src/socialsim4/core/ordering.py`

**Why fragile:**
- Multiple ordering classes (Sequential, Cycled, Random, Controlled, LLMModerated) share no base validation
- Empty edge cases handled inconsistently (some break loop, some infinite loop, some modulo)
- `ControlledOrdering` hangs on `None` return from `next_fn`

**Safe modification:**
- Add base class validation for empty agent lists
- Add timeout or max iteration to all `iter()` generators
- Document expected return values for `next_fn` callbacks

**Test coverage:** Minimal - only basic tests in `tests/core/ordering/` (if exists)

### Agent Serialization/Deserialization

**Files:** `src/socialsim4/core/agent/serialization.py`

**Why fragile:**
- Complex knowledge base and document handling during serialization
- Multiple debug print statements suggest past synchronization issues
- Deserialization logic assumes exact data structure matches

**Safe modification:**
- Add schema validation for serialized agent data
- Version the serialization format
- Add tests for round-trip serialization

**Test coverage:** Unknown - may need comprehensive serialization tests

### Scenario Registry

**Files:** `src/socialsim4/core/scenarios/registry.py` (920 lines), `src/socialsim4/scenarios/basic.py` (640 lines)

**Why fragile:**
- Large registry file with complex scenario definitions
- Multiple scenario files hardcode keys like 'sociology' (P1-05 bug)
- No validation that scenario_id exists in registry before use (P1-07 bug)

**Safe modification:**
- Add registry lookup with validation at module level
- Create constants for action category keys (SOCIOLOGY, etc.)
- Add test that all scenario files reference valid registry keys

**Test coverage:** Basic - may miss edge cases

### Experiment Runner

**Files:** `src/socialsim4/core/experiment/runner.py` (860 lines), `src/socialsim4/backend/services/experiment_runner.py` (423 lines)

**Why fragile:**
- Complex initialization requirements (P0-01 bug)
- Async/sync mixing issues (P0-02 bug)
- Multiple execution paths (direct vs. via SimTree)

**Safe modification:**
- Add initialization check in constructor (auto-initialize or clear error)
- Standardize async handling (all sync or all async)
- Add integration tests for all execution paths

**Test coverage:** Moderate - may miss async edge cases

## Scaling Limits

### LLM Call Concurrency

**Current capacity:** Limited by `llm_client_pool.py` implementation
**Limit:** Unknown - pool size and rate limits not documented
**Scaling path:**
- Document current pool size limits
- Add metrics for LLM call queue depth
- Implement adaptive concurrency based on provider rate limits

### SimTree Memory Growth

**Current capacity:** Each node stores full simulator snapshot
**Limit:** Memory grows linearly with nodes; ~100MB per node estimated (depends on agent count and history)
**Scaling path:**
- Implement delta compression (store only changes from parent)
- Add option to prune leaf nodes
- Implement disk-based node storage for large trees

### Database Connection Pool

**Current capacity:** SQLAlchemy default settings
**Limit:** 5-20 connections depending on configuration
**Scaling path:**
- Configure pool size in `src/socialsim4/backend/core/database.py`
- Add connection pool monitoring
- Implement read replicas for query-heavy operations

## Dependencies at Risk

### OpenAI SDK Version Pinning

**Risk:** OpenAI SDK frequently updates with breaking changes
- File: `requirements.txt:28` (`openai>=1.58.1`)
- Impact: API changes could break LLM provider implementations
- Migration plan:
  - Pin to exact version (`==1.58.1`) for stability
  - Add changelog monitoring for OpenAI releases
  - Create adapter layer for OpenAI API calls

### Sentence Transformers

**Risk:** Model download and loading time; large dependency
- File: `requirements.txt:49` (`sentence-transformers>=2.2.0`)
- Impact: Slow startup time; large download (~500MB for models)
- Migration plan:
  - Consider lighter embedding alternatives (e.g., smaller sentence-transformers models)
  - Add lazy loading for embedding models
  - Cache model downloads in container images

### PDFplumber

**Risk:** PDF parsing is fragile; document structure varies
- File: `requirements.txt:32` (`pdfplumber>=0.11.4`)
- Impact: May fail on certain PDF formats; requires testing
- Migration plan: Add fallback parsers (PyPDF2, pdfminer.six) with graceful degradation

## Missing Critical Features

### No Deterministic Mode for LLM Calls

**Problem:** Temperature > 0 produces non-deterministic results, making debugging impossible
- Blocks: Reproducible research, debugging of simulation behavior, A/B testing validity
- Impact: Developers cannot distinguish between "LLM randomness" and "actual bugs"
- Priority: High
- Recommended approach: Add global `deterministic_mode` flag that sets temperature=0 and uses fixed seeds

### No State-Behavior Validation

**Problem:** Agents can take actions incompatible with their state (e.g., infected agent acting healthy)
- Blocks: Trust in simulation results, verification of contagion mechanics
- Impact: Researchers cannot verify simulation is working correctly
- Priority: High
- Recommended approach: Add validation layer in `simulator.run()` that checks action compatibility with agent state

### No Structured Logging

**Problem:** Mix of `print()` statements, `logger.debug()`, and structured logging
- Blocks: Production monitoring, debugging in deployed environments
- Impact: Difficult to debug issues without invasive code changes
- Priority: Medium
- Recommended approach: Standardize on structured logging with JSON output; add log levels and context

## Test Coverage Gaps

### Ordering System Edge Cases

**What's not tested:**
- Empty agent lists for all ordering types
- ControlledOrdering with None-returning next_fn
- Dynamic agent addition/removal during iteration
- Thread-safety of ordering state changes

**Files:** `src/socialsim4/core/ordering.py`, `src/socialsim4/core/simulator.py`
**Risk:** Ordering bugs cause silent agent skips or infinite loops
**Priority:** High

### Agent Serialization Round-Trips

**What's not tested:**
- Serialization with large knowledge bases
- Round-trip with non-ASCII characters in content
- Handling of corrupted or missing serialized data
- Version compatibility (old format vs. new format)

**Files:** `src/socialsim4/core/agent/serialization.py`
**Risk:** Data loss when branching simulations or saving state
**Priority:** Medium

### SimTree Branching with Modified State

**What's not tested:**
- Branching after agents have learned new information
- Branching with modified environment config
- Branching with global knowledge changes
- Concurrent branching operations

**Files:** `src/socialsim4/core/simtree.py`, `src/socialsim4/backend/services/simtree_runtime.py`
**Risk:** State corruption in branched simulations
**Priority:** High

### Scenario Builder Registry Validation

**What's not tested:**
- All scenario files reference valid registry keys
- Action libraries exist before being accessed
- Information models exist for all scenario_ids
- Error messages when scenario is misconfigured

**Files:** `src/socialsim4/scenarios/*.py`, `src/socialsim4/core/scenarios/registry.py`
**Risk:** KeyError crashes on scenario initialization
**Priority:** Medium

### Frontend Component State Management

**What's not tested:**
- Complex wizard state transitions
- Error handling in file import flows
- Undo/redo functionality for experiment builder
- Network editor preset applications

**Files:** `frontend/components/SimulationWizard.tsx`, `frontend/components/experiment/*.tsx`
**Risk:** UI state desynchronization, data loss
**Priority:** Medium

---

*Concerns audit: 2026-03-18*
