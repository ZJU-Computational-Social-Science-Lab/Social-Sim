# Codebase Concerns

**Analysis Date:** 2025-03-08

## Tech Debt

**Large Files Exceeding Size Limits:**
- Issue: Several core files exceed the 500-line hard limit established in coding guidelines
- Files:
  - `src/socialsim4/backend/api/routes/simulations/tree_operations.py` (872 lines) - Tree manipulation API routes
  - `src/socialsim4/core/experiment/runner.py` (830 lines) - Experiment orchestration
  - `src/socialsim4/services/llm_client_pool.py` (778 lines) - LLM client pooling
  - `src/socialsim4/core/agent/agent.py` (538 lines) - Core agent class
  - `src/socialsim4/core/simulator.py` (434 lines) - Simulation orchestration
  - `frontend/components/SimulationWizard.tsx` (1295 lines) - Main wizard component
  - `frontend/store/index.test.ts` (1339 lines) - Store test file
  - `frontend/components/NetworkEditorModal.tsx` (1010 lines) - Network editor
- Impact: Reduced maintainability, difficult to navigate, higher cognitive load
- Fix approach: Split into focused modules by responsibility (e.g., agent.py → agent.py, agent_thinking.py, agent_memory.py)

**Deprecated Code Presence:**
- Issue: Deprecated patterns and methods still present in codebase
- Files: `src/socialsim4/core/experiment/round_context.py`, `src/socialsim4/tests/test_action_controller.py`
- Impact: Potential confusion for developers, unclear which patterns to follow
- Fix approach: Remove deprecated code or update documentation to clarify current patterns

**TODO Comments Not Implemented:**
- Issue: TODO items in production code without resolution
- Files: `src/socialsim4/backend/schemas/experiment.py:172` - llm_config handling in experiment execution
- Impact: Missing functionality for LLM config in experiments
- Fix approach: Implement llm_config handling or remove TODO

## Known Bugs

**Empty LLM Response Handling:**
- Symptoms: Some LLM models (Qwen3, Gemma 3) return empty responses with native JSON mode
- Files: `src/socialsim4/core/experiment/runner.py:750-767`, `src/socialsim4/core/llm/providers/*.py`
- Trigger: Specific models via Ollama or OpenAI-compatible endpoints
- Workaround: Fallback logic implemented retries with explicit JSON instruction in prompt
- Status: Mitigated with fallback, but root cause is model behavior

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

**Environment Variable Configuration:**
- Risk: Admin credentials and API keys configured via environment variables
- Files: `src/socialsim4/backend/scripts/ensure_admin.py:40-45`, `src/socialsim4/cli.py:90-91`
- Current mitigation: Uses os.environ.get() with defaults
- Recommendations:
  - Add .env.example file with required variables documented
  - Implement secrets validation at startup
  - Consider using a proper secrets manager for production

**File Upload Handling:**
- Risk: User-uploaded files stored in uploads/ directory without explicit size limits in code
- Files: `src/socialsim4/backend/api/routes/uploads.py:433`
- Current mitigation: Basic file type checking via extension
- Recommendations:
  - Add file size limits
  - Implement virus scanning for uploaded files
  - Sanitize filenames to prevent path traversal

**Debug File Creation:**
- Risk: Debug files created in test_results/ directory with potentially sensitive prompts
- Files: `src/socialsim4/core/agent/agent.py:23-25`, `src/socialsim4/core/experiment/runner.py:34-37`
- Current mitigation: .gitignore excludes test_results/
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

**ChromaDB vs JSON Fallback:**
- Problem: JSON cosine similarity is significantly slower than ChromaDB for large document sets
- Files: `src/socialsim4/backend/services/vector_store.py:146-208`
- Cause: In-memory computation vs indexed vector search
- Improvement path:
  - Make ChromaDB requirement explicit in documentation
  - Add startup warning if running in JSON fallback mode
  - Consider alternative vector stores (Qdrant, Weaviate)

**LLM Client Pool Cloning:**
- Problem: Deep copy of LLM clients in isolated mode is expensive
- Files: `src/socialsim4/services/llm_client_pool.py:754-758`
- Cause: deepcopy() called for each branch in isolated mode
- Improvement path:
  - Implement lightweight client cloning
  - Cache commonly used client configurations
  - Consider shared mode as default for performance

**Debug File I/O:**
- Problem: Synchronous file writes in async context for debug logging
- Files: `src/socialsim4/core/agent/agent.py:324-340`, `src/socialsim4/core/experiment/runner.py:112-116`
- Cause: File writes happen on every agent turn/LLM call
- Improvement path:
  - Use async file I/O
  - Buffer debug output and flush periodically
  - Make debug logging optional via configuration

**Large Frontend Components:**
- Problem: Components over 1000 lines cause slower renders and hot reload
- Files: `frontend/components/SimulationWizard.tsx` (1295 lines), `frontend/components/NetworkEditorModal.tsx` (1010 lines)
- Cause: Complex state management and UI rendering in single file
- Improvement path:
  - Extract sub-components for each wizard step
  - Use React.memo() for expensive renders
  - Consider virtualizing long lists

## Fragile Areas

**Experiment Runner State Management:**
- Files: `src/socialsim4/core/experiment/runner.py`
- Why fragile: Complex state synchronization between rounds, history replay, and visibility modes
- Safe modification:
  - Always round-trip through _replay_history_to_events() when modifying round history
  - Test with all visibility modes (simultaneous, sequential, random, paired)
  - Verify score calculations after changes
- Test coverage: Good for basic flows, gaps in edge cases (odd agent counts, mid-experiment errors)

**SimTree Serialization/Deserialization:**
- Files: `src/socialsim4/core/simtree.py`, `src/socialsim4/backend/services/simtree_runtime.py`
- Why fragile: Complex object graph with simulator states, agent memories, and event queues
- Safe modification:
  - Test round-trip: serialize → deserialize → serialize and compare
  - Verify event queue restoration
  - Check LLM client pool restoration
- Test coverage: Basic serialization tested, missing tests for complex tree structures

**Agent Knowledge Base Synchronization:**
- Files: `src/socialsim4/core/agent/rag.py`, `src/socialsim4/backend/services/documents.py`
- Why fragile: Multiple sources (free-text KB, documents, global knowledge) must stay synchronized
- Safe modification:
  - Always use agent.add_knowledge()/remove_knowledge() methods
  - Test ChromaDB and JSON fallback modes
  - Verify document deletion removes all chunks
- Test coverage: Limited, mostly integration tests

**Frontend Store State:**
- Files: `frontend/store/simulation.ts`, `frontend/store/experiments.ts`
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

**Concurrent Experiment Execution:**
- Current capacity: Limited by asyncio.gather() in runner
- Limit: Single-threaded async execution, no parallel processing
- Scaling path:
  - Implement Celery task queue for experiment execution
  - Add experiment queue management
  - Consider multiprocessing for CPU-bound operations

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

## Missing Critical Features

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

## Test Coverage Gaps

**Backend Core Simulation:**
- What's not tested: Edge cases in SimTree branching, agent offline recovery, LLM error handling
- Files: `src/socialsim4/core/simtree.py`, `src/socialsim4/core/agent/agent.py`, `src/socialsim4/core/simulator.py`
- Risk: Critical bugs in simulation branching or agent behavior
- Priority: High
- Current test ratio: ~83 test files for 121 Python files (68%)

**Frontend Complex Components:**
- What's not tested: SimulationWizard error states, NetworkEditorModal edge cases, store error handling
- Files: `frontend/components/SimulationWizard.tsx`, `frontend/components/NetworkEditorModal.tsx`, `frontend/store/*.ts`
- Risk: UI bugs in complex workflows, state corruption
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

---

*Concerns audit: 2025-03-08*
