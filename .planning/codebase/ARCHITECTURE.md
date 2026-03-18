# Architecture

**Analysis Date:** 2026-03-18

## Pattern Overview

**Overall:** Event-driven simulation with modular agent intelligence and branching timeline support

**Key Characteristics:**
- **Agent-Scene Isolation**: Agents never know about the Simulator; all decisions flow from context and scene feedback
- **Action-Based Architecture**: All agent behaviors are discrete, validated actions handled by scenes
- **Branching Timelines**: SimTree enables "what-if" exploration through simulator cloning
- **LLM Provider Abstraction**: Multiple LLM providers (OpenAI, Ollama, Gemini) with unified client interface
- **Event Streaming**: Real-time event propagation via WebSocket for live simulation monitoring
- **Modular Frontend**: React-based SPA with Zustand state management and component isolation

## Layers

**API Layer (Backend):**
- Purpose: HTTP/WebSocket interface, authentication, persistence
- Location: `src/socialsim4/backend/api/routes/`
- Contains: Route handlers, request/response schemas, JWT auth
- Depends on: Service layer, Core simulation engine
- Used by: Frontend client, external API consumers

**Service Layer (Backend):**
- Purpose: Business logic, simulation runtime management, orchestration
- Location: `src/socialsim4/backend/services/`
- Contains: SimTree runtime, experiment runner, document processing, vector store
- Depends on: Core simulation engine, Database models
- Used by: API layer

**Core Simulation Engine:**
- Purpose: Simulation execution, agent logic, scene mechanics
- Location: `src/socialsim4/core/`
- Contains: Simulator, Agent, Scene, Action classes, LLM integration
- Depends on: LLM providers, Agent submodules, Scene implementations
- Used by: Service layer, SimTree

**Frontend Presentation Layer:**
- Purpose: UI rendering, user interaction, state management
- Location: `frontend/`
- Contains: React components, Zustand stores, API client services
- Depends on: Backend API, WebSocket events
- Used by: Browser clients

**Data Persistence Layer:**
- Purpose: Data storage, retrieval, caching
- Location: `src/socialsim4/backend/models/`, `src/socialsim4/backend/db/`
- Contains: SQLAlchemy ORM models, Alembic migrations
- Depends on: PostgreSQL/SQLite database
- Used by: Service layer, API layer

## Data Flow

**Simulation Creation Flow:**

1. User creates simulation via `SimulationWizard` → Frontend store
2. Frontend calls `POST /api/simulations` → Backend API
3. Backend creates Simulator instance with Agents and Scene
4. Simulator serialized to database via SQLAlchemy models
5. Response returns simulation ID to frontend

**Live Simulation Flow:**

1. Frontend connects via WebSocket to `/api/simulations/{id}/ws`
2. Backend creates SimTree with root node containing Simulator
3. User advances simulation: `POST /api/simulations/{id}/advance`
4. Simulator.run() executes agent turns using configured Ordering
5. Each agent turn: calls Agent.process() → LLM client → returns actions
6. Actions validated by Scene.parse_and_handle_action()
7. Events emitted via Simulator.emit_event() → WebSocket broadcast
8. Frontend Zustand store updates from WebSocket events
9. UI re-renders with new simulation state

**Branching Flow:**

1. User creates branch from existing node via SimTree.branch()
2. Simulator cloned via serialize/deserialize (deep copy)
3. Ops applied to cloned simulator (agent overrides, state patches)
4. New node attached to tree as sibling of parent
5. Independent simulation state maintained per branch

**LLM Request Flow:**

1. Agent.process() builds context prompt
2. Context includes: scenario description, agent profile, memory, knowledge base
3. LLMClient.generate() called with provider-specific config
4. Provider (OpenAI/Ollama/Gemini) makes HTTP request
5. Response parsed via parse_actions() into structured actions
6. Actions validated and executed by scene

**State Management:**

- **Backend**: Immutable snapshots via serialize/deserialize, event logs per node
- **Frontend**: Zustand stores with selective subscriptions, WebSocket sync
- **Persistence**: SQLAlchemy ORM with JSON columns for simulator snapshots

## Key Abstractions

**Simulator:**
- Purpose: Orchestrates agent turns, manages event queue, handles execution
- Examples: `src/socialsim4/core/simulator.py`
- Pattern: Turn-based execution loop with configurable ordering strategies

**Agent:**
- Purpose: Autonomous entity with memory, knowledge, LLM integration
- Examples: `src/socialsim4/core/agent/agent.py`
- Pattern: Modular design with submodules for parsing, RAG, serialization

**Scene:**
- Purpose: Environment that defines available actions and rules
- Examples: `src/socialsim4/core/scenes/council_scene.py`, `policy_cascade_scene.py`
- Pattern: Abstract base class with hooks for action handling, state management

**Action:**
- Purpose: Individual behaviors agents can perform
- Examples: `src/socialsim4/core/actions/base_actions.py`, `council_actions.py`
- Pattern: Declarative constraints, state guards, parameter validation

**SimTree:**
- Purpose: Branching timeline structure for "what-if" exploration
- Examples: `src/socialsim4/core/simtree.py`
- Pattern: Tree data structure with node cloning, event streaming, GC

**LLMClient:**
- Purpose: Unified interface for multiple LLM providers
- Examples: `src/socialsim4/core/llm/client.py`
- Pattern: Provider abstraction with JSON mode fallback handling

**Ordering:**
- Purpose: Determines agent turn sequence
- Examples: `src/socialsim4/core/ordering.py`
- Pattern: Pluggable strategies (Sequential, Cycled, Controlled)

## Entry Points

**Backend Web Server:**
- Location: `src/socialsim4/backend/main.py`
- Triggers: `uvicorn socialsim4.backend.main:app`
- Responsibilities: Litestar app initialization, route registration, static file serving, database setup, WebSocket handlers

**CLI Interface:**
- Location: `src/socialsim4/cli.py`
- Triggers: `python -m socialsim4.cli`
- Responsibilities: Command-line simulation execution, scenario running

**Frontend SPA:**
- Location: `frontend/index.tsx`
- Triggers: Browser loads `/` or `/simulations/{id}`
- Responsibilities: React app mounting, router setup, i18n initialization, WebSocket connection

**Simulation Runtime:**
- Location: `src/socialsim4/backend/services/simtree_runtime.py`
- Triggers: API requests to advance/branch simulations
- Responsibilities: SimTree management, simulator execution, event broadcasting

## Error Handling

**Strategy:** Fail fast with clear error messages, event-based error propagation

**Patterns:**
- **Core Engine**: No try/except (per AGENTS.md philosophy) - let exceptions surface
- **Backend API**: try/except for HTTP semantics - convert exceptions to HTTP responses
- **Frontend**: try/catch for API calls and async operations
- **Error Events**: Errors wrapped as events and emitted via `emit_event("error", data)`
- **LLM Errors**: Tracked per-agent with offline state after consecutive failures

**Error Propagation Flow:**
1. Exception occurs in Simulator or Agent
2. Simulator._emit_error_event() wraps error with context (agent, turn, traceback)
3. Error event emitted via log_event handler
4. SimTree attaches to node logs
5. WebSocket broadcasts to frontend
6. Frontend displays error in LogViewer or toast notification

## Cross-Cutting Concerns

**Logging:** Python logging with structured extra fields, frontend console logging for debugging

**Validation:** Action constraints via ActionConstraints mixin, parameter validators, state guards

**Authentication:** JWT-based auth in backend, React Context for auth state in frontend

**Internationalization (i18n):**
- Backend: gettext via `socialsim4.i18n.T()`, locale files in `src/socialsim4/locales/`
- Frontend: i18next with `useTranslation()`, locale files in `frontend/locales/`

**State Persistence:** SQLAlchemy ORM with JSON columns, deep-copy serialization via pickle/json

**Real-time Communication:** WebSocket integration via Litestar, event broadcast to tree and node subscribers

**Vector Storage:** ChromaDB (optional) with JSON fallback for RAG knowledge base

**Document Processing:** pdfplumber, python-docx, pytesseract for OCR, embeddings via sentence-transformers

---

*Architecture analysis: 2026-03-18*
