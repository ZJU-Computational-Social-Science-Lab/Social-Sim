# Codebase Structure

**Analysis Date:** 2026-03-18

## Directory Layout

```
Social-Sim/
├── frontend/              # TypeScript React SPA
│   ├── components/        # Reusable UI components
│   ├── pages/            # Full page views
│   ├── services/         # API client functions
│   ├── store/            # Zustand state management
│   ├── locales/          # i18n translation files (en, zh)
│   ├── public/           # Static assets
│   └── test/             # Frontend tests
├── src/
│   └── socialsim4/       # Main Python package
│       ├── backend/      # Web API layer
│       │   ├── api/      # Litestar routes
│       │   ├── core/     # Backend config, database
│       │   ├── models/   # SQLAlchemy ORM models
│       │   ├── schemas/  # Pydantic schemas
│       │   ├── services/ # Business logic, orchestration
│       │   └── migrations/ # Alembic DB migrations
│       ├── core/         # Simulation engine
│       │   ├── agent/    # Modular agent implementation
│       │   ├── actions/  # Action classes
│       │   ├── scenes/   # Scene implementations
│       │   ├── llm/      # LLM providers, client
│       │   ├── prompts/  # Prompt templates
│       │   ├── experiment/ # A/B testing framework
│       │   ├── tools/    # Web search, scraping
│       │   └── contagion/ # Contagion mechanics
│       ├── scenarios/    # Pre-built scenario configs
│       ├── templates/    # Generic scene templates
│       ├── services/     # Shared services (email, sync)
│       ├── locales/      # i18n locale files (en, zh)
│       └── cli.py        # Command-line interface
├── tests/                # Backend tests
├── uploads/              # User-uploaded files
├── docs/                 # Documentation
├── scripts/              # Utility scripts
└── templates/            # Jinja2 templates (if any)
```

## Directory Purposes

**frontend/components/**:
- Purpose: Reusable React UI components
- Contains: Agent panels, simulation controls, modals, visualizations
- Key files: `AgentPanel.tsx`, `SimulationWizard.tsx`, `LogViewer.tsx`, `SimTree.tsx`

**frontend/pages/**:
- Purpose: Full-page route components
- Contains: Dashboard, simulation views, settings, admin
- Key files: `SimulationPage.tsx`, `SimulationWizardPage.tsx`, `DashboardPage.tsx`

**frontend/services/**:
- Purpose: API client functions for backend communication
- Contains: HTTP clients, WebSocket integration, backend-specific calls
- Key files: `simulations.ts`, `simulationTree.ts`, `client.ts`

**frontend/store/**:
- Purpose: Zustand state management stores
- Contains: Simulation state, auth state, UI state, experiment builder state
- Key files: `simulation.ts`, `agents.ts`, `experiment-builder.ts`, `index.ts`

**src/socialsim4/backend/api/routes/**:
- Purpose: Litestar route handlers for REST/WebSocket endpoints
- Contains: Simulations, experiments, auth, admin, uploads routes
- Key files: `simulations/__init__.py`, `experiments.py`, `auth.py`

**src/socialsim4/backend/services/**:
- Purpose: Business logic layer for simulation orchestration
- Contains: SimTree runtime, experiment runner, document processing
- Key files: `simtree_runtime.py`, `experiment_runner.py`, `vector_store.py`

**src/socialsim4/core/agent/**:
- Purpose: Modular agent implementation
- Contains: Main Agent class, parsing, RAG, serialization, registry
- Key files: `agent.py`, `parsing.py`, `rag.py`, `serialization.py`, `registry.py`

**src/socialsim4/core/actions/**:
- Purpose: Action classes defining agent behaviors
- Contains: Base actions (speak, yield), scene-specific actions
- Key files: `base_actions.py`, `council_actions.py`, `village_actions.py`

**src/socialsim4/core/scenes/**:
- Purpose: Scene implementations (environment types)
- Contains: Council, village, werewolf, landlord, policy cascade scenes
- Key files: `council_scene.py`, `village_scene.py`, `policy_cascade_scene.py`

**src/socialsim4/core/llm/**:
- Purpose: LLM provider abstraction and client
- Contains: Unified client, generation, provider implementations
- Key files: `client.py`, `generation.py`, `providers/openai.py`, `providers/ollama.py`

**src/socialsim4/core/experiment/**:
- Purpose: A/B testing framework for social experiments
- Contains: Runner, controller, scene, engines, payoff, feedback
- Key files: `runner.py`, `controller.py`, `scene.py`, `engines/`

## Key File Locations

**Entry Points:**
- `src/socialsim4/backend/main.py`: Litestar web server entry point
- `src/socialsim4/cli.py`: Command-line interface
- `frontend/index.tsx`: React SPA mount point

**Configuration:**
- `src/socialsim4/backend/core/config.py`: Backend settings (Pydantic Settings)
- `src/socialsim4/core/llm/llm_config.py`: LLM configuration
- `frontend/vite.config.ts`: Vite build config
- `.env.example`: Environment variable template

**Core Logic:**
- `src/socialsim4/core/simulator.py`: Simulation orchestration engine
- `src/socialsim4/core/simtree.py`: Branching timeline implementation
- `src/socialsim4/core/scene.py`: Base scene class
- `src/socialsim4/core/agent/agent.py`: Main agent class
- `src/socialsim4/core/registry.py`: Action/scene registry

**Testing:**
- `tests/`: Backend pytest tests
- `frontend/test/`, `frontend/components/__tests__/`: Frontend tests

**API Integration:**
- `src/socialsim4/backend/api/routes/`: All API route definitions
- `frontend/services/`: Frontend API client functions

## Naming Conventions

**Files:**
- **Python modules**: `snake_case.py` (e.g., `simulator.py`, `action_controller.py`)
- **TypeScript components**: `PascalCase.tsx` (e.g., `AgentPanel.tsx`, `SimulationWizard.tsx`)
- **TypeScript utilities/services**: `camelCase.ts` (e.g., `client.ts`, `simulations.ts`)
- **Test files**: `test_*.py` (Python), `*.test.ts` (TypeScript)

**Directories:**
- **Python packages**: `snake_case` (e.g., `backend/`, `core/`, `agent/`)
- **Frontend directories**: `snake_case` or `camelCase` (e.g., `components/`, `__tests__/`)

**Classes:**
- **Python**: `PascalCase` (e.g., `Simulator`, `Agent`, `CouncilScene`)
- **TypeScript**: `PascalCase` (e.g., `SimulationPage`, `AgentPanel`)

**Functions/Methods:**
- **Python**: `snake_case` (e.g., `run_simulation()`, `parse_actions()`)
- **TypeScript**: `camelCase` (e.g., `createSimulation()`, `handleAdvance()`)

## Where to Add New Code

**New Agent Behavior (Action):**
- Primary code: `src/socialsim4/core/actions/{scene}_actions.py`
- Register in: `src/socialsim4/core/registry.py` (ACTION_SPACE_MAP)
- Tests: `tests/test_actions.py` or create new test file

**New Scene Type:**
- Primary code: `src/socialsim4/core/scenes/{scene}_scene.py`
- Register in: `src/socialsim4/core/registry.py` (SCENE_MAP)
- Tests: `tests/test_scenes.py` or create new test file

**New API Endpoint:**
- Route handler: `src/socialsim4/backend/api/routes/{feature}.py`
- Schema: `src/socialsim4/backend/schemas/{feature}.py`
- Model: `src/socialsim4/backend/models/{feature}.py` (if needed)
- Service: `src/socialsim4/backend/services/{feature}.py` (if needed)
- Register in: `src/socialsim4/backend/api/routes/__init__.py`

**New Frontend Component:**
- Implementation: `frontend/components/{ComponentName}.tsx`
- Tests: `frontend/components/__tests__/{ComponentName}.test.tsx`
- Export from: Index file if creating barrel

**New Frontend Page:**
- Implementation: `frontend/pages/{PageName}.tsx`
- Route: Add to `frontend/App.tsx` Routes

**New Frontend Store:**
- Implementation: `frontend/store/{feature}.ts`
- Export from: `frontend/store/index.ts`

**New LLM Provider:**
- Implementation: `src/socialsim4/core/llm/providers/{provider}.py`
- Register in: `src/socialsim4/core/llm/providers/` (import in `__init__.py`)

**New Experiment Type:**
- Implementation: `src/socialsim4/core/experiment/engines/{engine}.py`
- Register in: Experiment controller or scene configuration

**Utilities:**
- Backend utilities: `src/socialsim4/core/tools/` or new module in `src/socialsim4/`
- Frontend utilities: `frontend/utils/`

## Special Directories

**frontend/dist/**:
- Purpose: Vite build output (production bundle)
- Generated: Yes
- Committed: No (in .gitignore)

**frontend/node_modules/**:
- Purpose: NPM dependencies
- Generated: Yes
- Committed: No (in .gitignore)

**uploads/**:
- Purpose: User-uploaded documents and assets
- Generated: Runtime (user uploads)
- Committed: No (in .gitignore)

**src/socialsim4/backend/migrations/**:
- Purpose: Alembic database migration scripts
- Generated: Alembic (via `alembic revision`)
- Committed: Yes

**src/socialsim4/__pycache__/**:
- Purpose: Python bytecode cache
- Generated: Python interpreter
- Committed: No (in .gitignore)

**test_results/**:
- Purpose: Debug output from agent runs
- Generated: Runtime (debug mode)
- Committed: No (in .gitignore)

**.planning/**:
- Purpose: Planning documents, phases, research notes
- Generated: GSD tools
- Committed: No (in .gitignore - contains working documents)

---

*Structure analysis: 2026-03-18*
