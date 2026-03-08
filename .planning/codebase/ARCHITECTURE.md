# Architecture

**Analysis Date:** 2025-01-08

## Pattern Overview

**Overall:** Multi-tier simulation platform with branching timeline support

**Key Characteristics:**
- **Agent-Scene isolation**: Agents never know about the Simulator. All decisions flow from their context and scene feedback.
- **Three-layer experiment framework**: Schema Builder → Prompt Builder → Validation/Execution
- **Branching timelines**: SimTree enables "what-if" exploration with deep-copy simulator cloning
- **Fail-fast error handling**: Core simulation engine uses no defensive coding; errors surface immediately

## Layers

**Core Simulation Engine:**
- Purpose: Autonomous agent simulation with LLM-driven decision making
- Location: `src/socialsim4/core/`
- Contains: Agents, Scenes, Actions, Simulator, SimTree, Memory, LLM integration
- Depends on: LLM providers (OpenAI, Gemini, Ollama), Vector stores (ChromaDB)
- Used by: Backend API routes, Experiment Runner

**Backend API Layer:**
- Purpose: HTTP/WebSocket interface to simulation engine
- Location: `src/socialsim4/backend/`
- Contains: Litestar routes, Database models, Services, Schemas
- Depends on: Core simulation engine, SQLAlchemy, PostgreSQL/SQLite
- Used by: Frontend via REST/WebSocket

**Frontend Application:**
- Purpose: React-based SPA for simulation control and visualization
- Location: `frontend/`
- Contains: Pages, Components, Services, Zustand stores
- Depends on: Backend API, React, TanStack Query, React Router
- Used by: End users

**Experiment Framework:**
- Purpose: A/B testing and structured experiment execution
- Location: `src/socialsim4/core/experiment/`
- Contains: Controller, Kernel, Runner, Agent, Schema Builder, Prompt Builder, Payoff Engine
- Depends on: Core simulation abstractions, LLM clients
- Used by: Backend experiments API, Experiment Builder UI

## Data Flow

**Simulation Execution:**

1. Frontend initiates simulation via WebSocket connection to `backend/api/routes/simulations/websocket_handlers.py`
2. Backend creates `Simulator` with `Agent` instances and `Scene` configuration
3. Simulator wraps simulation in `SimTree` for branching timeline support
4. On each turn, `Ordering` determines next agent to act
5. Agent receives context via `add_env_feedback()` (memory + scene state)
6. Agent calls LLM via `core/llm/client.py` through provider abstraction
7. LLM returns JSON response with thoughts/response/action
8. Agent parses response via `agent/parsing.py`
9. Scene validates and executes action via `parse_and_handle_action()`
10. Scene broadcasts results to other agents
11. Simulator emits events to WebSocket subscribers
12. Frontend updates Zustand stores and re-renders components

**Experiment Execution:**

1. User configures experiment via Experiment Builder UI
2. `ExperimentBuilder` constructs `GameConfig` with selected actions and parameters
3. Backend creates `ExperimentRunner` with `ExperimentAgent` instances
4. Runner builds JSON schema via `schema_builder.py` (Layer 1)
5. Runner builds prompt via `prompt_builder.py` with schema instructions (Layer 2)
6. LLM generates response; Controller validates via `controller.py` (Layer 3)
7. Action executed via `kernel.py` registry
8. Payoff calculated via `payoff/engine.py`
9. Feedback generated via `feedback/builder.py`
10. Round context updated for next iteration

**SimTree Branching:**

1. User creates branch at current node via tree_operations.py
2. `SimTree.branch()` clones simulator via `serialize()` → `deserialize()`
3. Clone receives new `LLMClient` instances from `LLMClientPool` (ensures isolation)
4. Parent node's `event_queue` is reset in clone
5. Clone can diverge with different agent decisions
6. Each node maintains separate log stream for timeline visualization

**State Management:**

- **Backend**: Simulator state is serialized as JSON in SimTree nodes
- **Frontend**: Zustand stores manage slice-based state with cross-slice dependencies
- **Database**: SQLAlchemy ORM with declarative base; models in `backend/models/`
- **Session**: Litestar request-scoped dependency injection

## Key Abstractions

**Agent:**
- Purpose: Autonomous decision-making entity with memory, knowledge, and action space
- Examples: `src/socialsim4/core/agent/agent.py`, `src/socialsim4/core/experiment/agent.py`
- Pattern: JSON-based LLM prompting with 5-section output (thoughts, response, action, context_update, metadata)

**Scene:**
- Purpose: Environment that defines available actions, rules, and completion conditions
- Examples: `src/socialsim4/core/scenes/council_scene.py`, `src/socialsim4/core/scenes/werewolf_scene.py`
- Pattern: Base Scene class with hooks for `pre_run()`, `post_turn()`, `should_skip_turn()`, `get_scene_actions()`

**Action:**
- Purpose: Individual behaviors agents can perform
- Examples: `src/socialsim4/core/actions/base_actions.py`, `src/socialsim4/core/experiment/actions/definitions.py`
- Pattern: Action classes with `NAME`, `DESC`, `INSTRUCTION` attributes and `handle()` method

**Ordering:**
- Purpose: Determines which agent acts next in the simulation
- Examples: `src/socialsim4/core/ordering.py` (SequentialOrdering, CycledOrdering, ControlledOrdering)
- Pattern: Iterator-based with `post_turn()` hook for scheduling updates

**SimTree:**
- Purpose: Branching timeline structure for exploring alternate simulation outcomes
- Examples: `src/socialsim4/core/simtree.py`
- Pattern: Tree data structure with node-level logs and deep-copy simulator cloning

**LLMClientPool:**
- Purpose: Provides isolated LLM client instances per branch for parallel simulation
- Examples: `src/socialsim4/backend/services/llm_client_pool.py`
- Pattern: Pool with acquire/release semantics; each branch gets fresh client instances

## Entry Points

**Backend Server:**
- Location: `src/socialsim4/backend/main.py`
- Triggers: `uvicorn socialsim4.backend.main:app` or `python -m socialsim4.backend.main`
- Responsibilities: Litestar app creation, database initialization, route registration, static file serving, CORS configuration

**Frontend Application:**
- Location: `frontend/index.tsx`
- Triggers: Vite dev server or production build
- Responsibilities: React root rendering, router setup, query client configuration, i18n initialization

**Simulation WebSocket Endpoint:**
- Location: `src/socialsim4/backend/api/routes/simulations/websocket_handlers.py`
- Triggers: WebSocket connection from frontend
- Responsibilities: Real-time event streaming, simulation lifecycle management, step control

**Experiment Runner:**
- Location: `src/socialsim4/core/experiment/runner.py`
- Triggers: Backend experiments API endpoint
- Responsibilities: Round-based execution, visibility management, payoff calculation

## Error Handling

**Strategy:** Core engine fails fast; API layer converts exceptions to HTTP responses

**Patterns:**
- **Core Engine**: No try/except in core simulation code (`src/socialsim4/core/`). Exceptions surface immediately with full traceback.
- **Agent LLM Errors**: Tracked via `consecutive_llm_errors`; agent marked `is_offline` after threshold. Emits `agent_error` event with kind "offline".
- **Backend API**: Litestar exception handlers convert to HTTP responses. Custom handler in `main.py` returns 500 JSON errors.
- **Frontend**: ErrorBoundary component catches React errors. API errors displayed as toast notifications.

**Cross-Cutting Concerns:**

**Logging:** Python `logging` module with named loggers. Frontend uses Zustand log store with inject pattern.

**Validation:** Pydantic schemas for request/response validation in backend. Experiment framework has dedicated `validation.py` module with JSON extraction, parameter clamping, and type checking.

**Authentication:** JWT-based auth in `backend/api/routes/auth.py`. `RequireAuth` component wraps protected routes in frontend.

**Internationalization:** Backend uses `gettext` via `socialsim4/i18n.py`. Frontend uses `i18next` with `react-i18next`. All user-facing strings must use `T()` or `t()` functions.

---

*Architecture analysis: 2025-01-08*
