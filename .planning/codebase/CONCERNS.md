# Codebase Concerns

**Analysis Date:** 2025-03-09

## Tech Debt

**Oversized Python Files (500+ line hard limit):**
- Issue: Numerous Python files exceed the 500-line hard limit from coding guidelines
- Files:
  - `src/socialsim4/backend/api/routes/simulations/tree_operations.py` (872 lines)
  - `src/socialsim4/core/scenarios/registry.py` (848 lines)
  - `src/socialsim4/core/experiment/runner.py` (830 lines)
  - `src/socialsim4/services/llm_client_pool.py` (778 lines)
  - `src/socialsim4/core/simtree.py` (719 lines)
  - `src/socialsim4/scenarios/basic.py` (640 lines)
  - `src/socialsim4/backend/services/simtree_runtime.py` (635 lines)
  - `src/socialsim4/core/scenes/village_scene.py` (608 lines)
  - `src/socialsim4/core/scenes/landlord_scene.py` (596 lines)
  - `src/socialsim4/core/scenarios.py` (568 lines)
  - `src/socialsim4/core/agent/agent.py` (539 lines)
  - `src/socialsim4/core/contagion/scene.py` (531 lines)
  - `src/socialsim4/templates/schema.py` (479 lines)
  - `src/socialsim4/templates/loader.py` (454 lines)
  - `src/socialsim4/core/agent/rag.py` (450 lines)
  - `src/socialsim4/core/simulator.py` (438 lines)
  - `src/socialsim4/backend/api/routes/llm.py` (436 lines)
  - `src/socialsim4/backend/api/routes/uploads.py` (433 lines)
  - `src/socialsim4/backend/api/routes/simulations/agent_documents.py` (432 lines)
  - `src/socialsim4/backend/api/routes/experiment_templates.py` (412 lines)
  - `src/socialsim4/backend/services/documents.py` (409 lines)
- Impact: Reduced maintainability, difficult navigation, high cognitive load for changes
- Fix approach: Split into focused modules by responsibility (e.g., agent.py → agent.py, agent_thinking.py, agent_memory.py)

**Oversized TypeScript Files (400+ line hard limit):**
- Issue: Multiple TypeScript components exceed the 400-line hard limit
- Files:
  - `frontend/components/SimulationWizard.tsx` (1295 lines)
  - `frontend/components/NetworkEditorModal.tsx` (1010 lines)
  - `frontend/store/helpers.ts` (968 lines)
  - `frontend/store/experiments.ts` (967 lines)
  - `frontend/components/__tests__/SimulationWizard.test.tsx` (906 lines)
  - `frontend/pages/SimulationPage.tsx` (898 lines)
  - `frontend/store/simulation.ts` (774 lines)
  - `frontend/pages/SettingsPage.tsx` (710 lines)
  - `frontend/components/experiment/Step5Network.tsx` (685 lines)
  - `frontend/components/TemplateBuilder.tsx` (613 lines)
  - `frontend/pages/SimulationWizardPage.tsx` (608 lines)
  - `frontend/components/AgentPanel.tsx` (583 lines)
  - `frontend/components/experiment/Step4Agents.tsx` (565 lines)
  - `frontend/components/ExperimentDesignModal.tsx` (448 lines)
  - `frontend/components/ReportModal.tsx` (424 lines)
  - `frontend/components/LogViewer.tsx` (413 lines)
- Impact: Monolithic components, difficult to test, violate single responsibility principle
- Fix approach: Extract sub-components and custom hooks. Break into smaller focused units.

**Deprecated Files Not Removed:**
- Issue: Three `.deprecated` files exist in codebase
- Files:
  - `src/socialsim4/backend/api/routes/simulations.py.deprecated`
  - `src/socialsim4/core/agent.py.deprecated`
  - `src/socialsim4/core/llm.py.deprecated`
- Impact: Confusion about which files are active, may accidentally reference deprecated code
- Fix approach: Remove deprecated files after confirming no active references exist

**TODO Comments Not Implemented:**
- Issue: TODO items in production code without resolution
- Files: `src/socialsim4/backend/schemas/experiment.py:172` - llm_config handling in experiment execution
- Impact: Missing functionality for LLM config in experiments
- Fix approach: Implement llm_config handling or remove TODO

## Known Bugs

**Empty LLM Response Handling:**
- Symptoms: Some LLM models (Qwen3, Gemma 3) return empty responses with native JSON mode
- Files: `src/socialsim4/core/llm/providers/ollama.py`, `src/socialsim4/core/llm/providers/openai.py`
- Trigger: Specific models via Ollama or OpenAI-compatible endpoints
- Workaround: Fallback logic retries with explicit JSON instruction in prompt
- Status: Mitigated with fallback (commit 7d8704f), but root cause is model behavior

**Agent Offline State:**
- Symptoms: Agents marked as offline after consecutive LLM errors may not recover
- Files: `src/socialsim4/core/agent/agent.py:94-97`, `:462-477`
- Trigger: Multiple consecutive LLM call/parse failures
- Workaround: None currently, agent remains offline for rest of simulation
- Impact: Reduced agent participation in long-running simulations

**Vector Store Fallback Silently Fails:**
- Symptoms: ChromaDB operations fail and fall back to JSON, but errors are only logged
- Files: `src/socialsim4/backend/services/vector_store.py:62-208`
- Trigger: ChromaDB initialization or operation failures
- Workaround: JSON cosine similarity used as fallback
- Impact: Performance degradation without user visibility

## Security Considerations

**Arbitrary Code Execution in Semantic Actions:**
- Risk: User-defined effect_code uses `exec()` with restricted but not sandboxed execution
- Files: `src/socialsim4/templates/semantic_actions.py` (line 147)
- Current mitigation: Restricted `__builtins__` whitelist (print, len, str, int, float, bool, list, dict, set, tuple, range, enumerate, zip, sum, min, max, abs, round)
- Recommendations:
  - Consider AST validation before exec
  - Add timeout wrapper for effect_code execution
  - Document security model for custom action effects
  - Consider alternative: predefined effect templates instead of arbitrary code

**Environment Variable Configuration:**
- Risk: Admin credentials and API keys configured via environment variables
- Files: `src/socialsim4/backend/scripts/ensure_admin.py:40-45`, `src/socialsim4/cli.py:90-91`
- Current mitigation: Uses os.environ.get() with defaults, `.env` files gitignored
- Recommendations:
  - Add .env.example file with required variables documented
  - Implement secrets validation at startup
  - Consider using a proper secrets manager for production

**File Upload Handling:**
- Risk: User-uploaded files stored in uploads/ directory without explicit size limits in code
- Files: `src/socialsim4/backend/api/routes/uploads.py` (433 lines)
- Current mitigation: Basic file type checking via extension
- Recommendations:
  - Add file size limits
  - Implement virus scanning for uploaded files
  - Sanitize filenames to prevent path traversal

**Debug File Creation:**
- Risk: Debug files created in test_results/ directory with potentially sensitive prompts
- Files: `src/socialsim4/core/agent/agent.py:23-25`, `src/socialsim4/core/experiment/runner.py:34-37`
- Current mitigation: `.gitignore` excludes test_results/
- Recommendations:
  - Consider redacting sensitive info from debug logs
  - Add optional debug mode flag to disable file creation
  - Implement log rotation for debug files

**Database Connection Security:**
- Risk: SQLite database files in project directory (socialsim.db, socialsim4.db)
- Files: `.gitignore:132-136`
- Current mitigation: Gitignore excludes .db files
- Recommendations:
  - Use environment variable for database path
  - Implement proper database migrations
  - Consider PostgreSQL for production

## Performance Bottlenecks

**Synchronous LLM Calls in Async Context:**
- Problem: `await asyncio.to_thread(simulator.run, ...)` wraps synchronous simulator runs
- Files: `src/socialsim4/backend/api/routes/simulations/tree_operations.py` (lines 197, 277, 350)
- Cause: Core simulator is synchronous, wrapped for async API
- Improvement path: Refactor core simulator to be natively async or use thread pool more efficiently

**ChromaDB vs JSON Fallback:**
- Problem: JSON cosine similarity is significantly slower than ChromaDB for large document sets
- Files: `src/socialsim4/backend/services/vector_store.py:146-208`
- Cause: In-memory computation vs indexed vector search
- Improvement path:
  - Make ChromaDB requirement explicit in documentation
  - Add startup warning if running in JSON fallback mode
  - Consider alternative vector stores (Qdrant, Weaviate)

**Large File Uploads:**
- Problem: Document uploads processed synchronously
- Files: `src/socialsim4/backend/api/routes/uploads.py` (433 lines)
- Cause: File parsing and embedding generation blocks request thread
- Improvement path:
  - Move to background task queue (Celery already configured)
  - Implement chunked uploads for large files
  - Add progress reporting for long-running uploads

**Simulation Tree Serialization:**
- Problem: Full tree state serialized to database on each operation
- Files: `src/socialsim4/core/simtree.py`, `src/socialsim4/backend/services/simtree_runtime.py`
- Cause: `sim.latest_state = tree.serialize()` called after every tree modification
- Improvement path:
  - Implement incremental state persistence
  - Consider tree diff instead of full serialization
  - Add lazy loading for large tree branches

**RAG Vector Store Queries:**
- Problem: Synchronous vector similarity search in async handlers
- Files: `src/socialsim4/backend/services/documents.py`, `src/socialsim4/core/agent/rag.py`
- Cause: Vector store operations wrapped with `asyncio.to_thread`
- Improvement path: Use async-native vector store client or optimize query patterns

**Debug File I/O:**
- Problem: Synchronous file writes in async context for debug logging
- Files: `src/socialsim4/core/agent/agent.py:324-340`, `src/socialsim4/core/experiment/runner.py:112-116`
- Cause: File writes happen on every agent turn/LLM call
- Improvement path:
  - Use async file I/O
  - Buffer debug output and flush periodically
  - Make debug logging optional via configuration

**Frontend Store Performance:**
- Problem: Large Zustand stores with complex state updates
- Files: `frontend/store/experiments.ts` (967 lines), `frontend/store/simulation.ts` (774 lines)
- Cause: Monolithic stores with many interconnected state updates
- Improvement path:
  - Split into smaller, focused stores
  - Implement state normalization for large arrays
  - Add immer middleware for better change tracking

## Fragile Areas

**Experiment Runner State Management:**
- Files: `src/socialsim4/core/experiment/runner.py` (830 lines)
- Why fragile: Complex state synchronization between rounds, history replay, and visibility modes
- Safe modification:
  - Always round-trip through _replay_history_to_events() when modifying round history
  - Test with all visibility modes (simultaneous, sequential, random, paired)
  - Verify score calculations after changes
- Test coverage: Good for basic flows, gaps in edge cases (odd agent counts, mid-experiment errors)

**SimTree Serialization/Deserialization:**
- Files: `src/socialsim4/core/simtree.py` (719 lines), `src/socialsim4/backend/services/simtree_runtime.py` (635 lines)
- Why fragile: Complex object graph with simulator states, agent memories, and event queues
- Safe modification:
  - Test round-trip: serialize → deserialize → serialize and compare
  - Verify event queue restoration
  - Check LLM client pool restoration
- Test coverage: Basic serialization tested, missing tests for complex tree structures

**Agent RAG System:**
- Files: `src/socialsim4/core/agent/rag.py` (450 lines)
- Why fragile: Complex multi-source knowledge aggregation (free-text KB, documents, global knowledge)
- Safe modification:
  - Always use agent.add_knowledge()/remove_knowledge() methods
  - Test with empty knowledge bases
  - Verify context length limits
  - Test ChromaDB and JSON fallback modes
- Test coverage: Limited, no dedicated RAG test files found

**Simulation Tree Operations:**
- Files: `src/socialsim4/backend/api/routes/simulations/tree_operations.py` (872 lines)
- Why fragile: Multiple tree manipulation endpoints with complex state management
- Safe modification:
  - Test tree invariants after each operation
  - Verify node reference counting
  - Test with deeply nested trees
- Test coverage: No dedicated tree operation tests found

**WebSocket Event Broadcasting:**
- Files: `src/socialsim4/backend/api/routes/simulations/websocket_handlers.py`
- Why fragile: Real-time event distribution with potential race conditions
- Safe modification:
  - Test concurrent tree operations
  - Verify event ordering guarantees
  - Test with slow/disconnected clients
- Test coverage: Unclear if WebSocket edge cases are tested

**Frontend SimulationWizard Component:**
- Files: `frontend/components/SimulationWizard.tsx` (1295 lines)
- Why fragile: Handles wizard state, file uploads, AI generation, and form validation
- Safe modification:
  - Test each wizard step independently
  - Verify file upload error handling
  - Test AI generation failure modes
- Test coverage: `frontend/components/__tests__/SimulationWizard.test.tsx` exists but may not cover all paths

**Frontend Store State:**
- Files: `frontend/store/simulation.ts` (774 lines), `frontend/store/experiments.ts` (967 lines)
- Why fragile: Complex state updates from multiple sources (WebSocket, REST API, user actions)
- Safe modification:
  - Use immer for immutable updates
  - Test with rapid state changes
  - Verify WebSocket reconnection handling
- Test coverage: Good for happy path, missing error state tests

## Scaling Limits

**SimTree Memory Usage:**
- Current capacity: ~1000 nodes before memory becomes concern (each node holds full simulator state)
- Limit: Agent memories and event queues duplicated across tree nodes
- Scaling path:
  - Implement state diffing between parent/child nodes
  - Lazy-load simulator state for non-frontier nodes
  - Consider database-backed tree storage

**ChromaDB Collection Scaling:**
- Current capacity: Tested with ~10k chunks per agent
- Limit: Single collection per agent, no sharding
- Scaling path:
  - Implement collection per document for large document sets
  - Add batch operations for bulk inserts
  - Consider distributed vector store for production

**Concurrent Simulation Execution:**
- Current capacity: Limited by `asyncio.to_thread` pool size (not explicitly configured)
- Limit: Default Python thread pool size (typically CPU count)
- Scaling path:
  - Configure custom thread pool executor
  - Consider distributed execution for large experiments
  - Add queue management for concurrent simulations

**WebSocket Connections:**
- Current capacity: Limited by Litestar's WebSocket handler limits
- Limit: Not documented in code
- Scaling path:
  - Add connection pooling documentation
  - Consider Redis pub/sub for multi-instance deployments
  - Implement connection rate limiting

**Database Connection Pool:**
- Current capacity: Configurable via environment variables
- Limit: Default SQLAlchemy pool sizes (typically 5 connections)
- Scaling path:
  - Document production pool sizing
  - Add connection pool monitoring
  - Consider read replicas for read-heavy operations

**Frontend WebSocket Reconnection:**
- Current capacity: Handles single reconnection attempt
- Limit: No exponential backoff, no connection state persistence
- Scaling path:
  - Implement proper reconnection strategy with backoff
  - Add offline queue for actions during disconnection
  - Consider event-sourcing for state reconciliation

## Dependencies at Risk

**ChromaDB (Optional but Recommended):**
- Risk: Package not installed or initialization failure silently falls back to JSON
- Impact: 10-100x slower RAG retrieval without clear user indication
- Migration plan:
  - Make ChromaDB requirement explicit in documentation
  - Add health check endpoint for vector store status
  - Provide clear error messages if ChromaDB unavailable

**Ollama for Local LLM:**
- Risk: External service dependency, requires separate installation
- Impact: Cannot use local LLM features if Ollama not running
- Migration plan:
  - Add graceful degradation to mock LLM
  - Provide clear setup instructions
  - Consider alternative local LLM providers

**Celery for Background Tasks:**
- Risk: Requires Redis, adds deployment complexity
- Impact: Cannot run experiments asynchronously without Redis
- Migration plan:
  - Consider simpler task queue (RQ, dramatiq)
  - Provide synchronous fallback for development
  - Document Redis requirement clearly

**Deprecated Files Referenced:**
- Risk: `.deprecated` files may still be imported somewhere
- Impact: Could accidentally use old implementations
- Migration plan:
  1. Search for imports of deprecated files
  2. Update all references to new implementations
  3. Remove `.deprecated` files
  4. Add CI check to prevent new deprecated files

**LLM Provider Fallback Logic:**
- Risk: Ollama and OpenAI providers have complex fallback logic for empty JSON responses
- Files: `src/socialsim4/core/llm/providers/ollama.py`, `src/socialsim4/core/llm/providers/openai.py`
- Impact: If models change behavior, fallbacks may break
- Migration plan:
  - Document the specific model behaviors that require fallbacks
  - Add tests for empty response scenarios
  - Monitor for model changes that affect JSON mode

**Python 3.14 Incompatibility:**
- Risk: Project explicitly requires Python 3.12, incompatible with 3.14
- Files: Project documentation (`CLAUDE.md`)
- Impact: Cannot upgrade Python until dependencies are updated
- Migration plan:
  - Track which dependencies require 3.12
  - Test with new Python releases
  - Update dependencies when compatible versions become available

## Missing Critical Features

**Comprehensive Test Coverage:**
- Problem: Only 2 test files found for entire backend (`tests/test_action_controller.py`, `tests/test_scenarios.py`)
- Blocks: Confidence in refactoring, catching regressions
- Priority: High
- Impact areas: Untested code includes RAG system, experiment runner, tree operations, websocket handlers

**Observability/Monitoring:**
- Problem: No centralized logging, metrics, or tracing
- Blocks: Production debugging, performance optimization
- Recommendations:
  - Add structured logging (JSON format)
  - Implement OpenTelemetry for tracing
  - Add metrics collection (Prometheus)

**Error Recovery:**
- Problem: Simulations fail permanently on errors, no resume capability
- Blocks: Long-running experiment reliability
- Recommendations:
  - Implement checkpoint/resume for simulations
  - Add retry logic for transient failures
  - Provide UI for recovering failed simulations

**Rate Limiting:**
- Problem: No rate limiting on API endpoints
- Blocks: Production deployment with multiple users
- Recommendations:
  - Add rate limiting middleware (Litestar)
  - Implement per-user quotas
  - Add API key authentication for external access

**Simulation Result Export:**
- Problem: Limited export functionality (mainly JSON)
- Blocks: Users who need CSV/Excel exports, integration with analysis tools
- Priority: Low
- Impact: Reduced usability for researchers

**User Activity Logging:**
- Problem: No audit trail for user actions
- Blocks: Security investigations, compliance requirements
- Priority: Medium
- Impact: Cannot track who created/modified/deleted simulations

**i18n Coverage Gaps:**
- Problem: Only 11 backend files use `T()` function out of ~150+ Python files
- Files using i18n:
  - `src/socialsim4/core/agent/agent.py`
  - `src/socialsim4/scenarios/resource_scarcity.py`
  - `src/socialsim4/scenarios/policy_erosion.py`
  - `src/socialsim4/scenarios/echo_chamber.py`
  - `src/socialsim4/scenarios/social_norm_disruption.py`
  - `src/socialsim4/backend/api/routes/simulations/lifecycle.py`
  - `src/socialsim4/backend/api/routes/experiment_templates.py`
  - `src/socialsim4/backend/api/routes/providers.py`
  - `src/socialsim4/backend/api/routes/environment.py`
  - `src/socialsim4/backend/api/routes/auth.py`
- Blocks: Full bilingual support (English/Chinese)
- Priority: Medium
- Impact: Backend error messages and logs not translatable

## Test Coverage Gaps

**Backend Core Simulation:**
- What's not tested:
  - Agent decision-making logic
  - Scene state transitions
  - Action validation and execution
  - Simulator orchestration
  - SimTree branching and edge cases
  - Agent offline recovery
  - LLM error handling
- Files: `src/socialsim4/core/` (agent, simulator, scene, actions, simtree)
- Risk: Critical path failures could break all simulations
- Priority: High
- Current test ratio: Only 2 test files found (test_action_controller.py, test_scenarios.py)

**RAG Knowledge System:**
- What's not tested:
  - Document embedding and retrieval
  - Knowledge base queries
  - Context building from multiple sources
  - Composite RAG retrieval
  - Document deletion removes all chunks
  - ChromaDB vs JSON fallback modes
- Files: `src/socialsim4/core/agent/rag.py`, `src/socialsim4/backend/services/documents.py`
- Risk: Knowledge features may fail silently
- Priority: High

**Experiment Framework:**
- What's not tested:
  - Round execution with all visibility modes
  - Payoff calculation for all game types
  - Information model filtering
  - Agent overrides and injections
  - Odd agent counts
  - Mid-experiment errors
- Files: `src/socialsim4/core/experiment/`
- Risk: Experiment results may be incorrect
- Priority: High

**API Endpoints:**
- What's not tested:
  - Most CRUD endpoints
  - File upload handling
  - WebSocket connections
  - Error responses
  - Tree operation endpoints
- Files: `src/socialsim4/backend/api/routes/`
- Risk: API contract violations
- Priority: Medium

**Frontend Complex Components:**
- What's not tested:
  - SimulationWizard error states
  - NetworkEditorModal edge cases
  - Store error handling
  - Most components lack test files
- Files: `frontend/components/`
- Only found tests:
  - `frontend/components/__tests__/SimulationWizard.test.tsx`
  - `frontend/components/__tests__/ParameterField.test.tsx`
  - `frontend/components/__tests__/Step1InteractionType.test.tsx`
  - `frontend/components/__tests__/Step3Scenario.test.tsx`
  - `frontend/store/index.test.ts`
- Risk: UI bugs and regressions
- Priority: Medium
- Current test ratio: ~5 test files for 167 TypeScript files (3%)

**Integration Tests:**
- What's not tested: Full experiment lifecycle, WebSocket reconnection, multi-user scenarios
- Files: Missing integration test suite
- Risk: Integration failures, data corruption
- Priority: High

**Performance Tests:**
- What's not tested: Large document sets, many agents, deep SimTree structures
- Files: No performance test suite
- Risk: Performance regressions, production failures
- Priority: Medium

**E2E Tests:**
- What's not tested: Complete user workflows (create simulation, run experiment, view results)
- Files: No E2E test suite (Playwright/Cypress)
- Risk: Critical user journeys broken
- Priority: High

**LLM Client Integration:**
- What's not tested:
  - Provider-specific behavior (OpenAI, Ollama, Gemini)
  - JSON mode fallbacks
  - Error handling and retries
  - Client pool management
- Files: `src/socialsim4/core/llm/`, `src/socialsim4/services/llm_client_pool.py`
- Risk: LLM failures not properly handled
- Priority: Medium

---

*Concerns audit: 2025-03-09*
