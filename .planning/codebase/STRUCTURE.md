# Codebase Structure

**Analysis Date:** 2025-01-08

## Directory Layout

```
Social-Sim/
├── frontend/                    # React TypeScript frontend application
│   ├── components/              # Reusable UI components
│   │   ├── experiment/          # Experiment builder components
│   │   │   └── parameter_widgets/  # Parameter input widgets
│   │   ├── ui/                  # Base UI components (Radix-based)
│   │   ├── wizard/              # Simulation setup wizard steps
│   │   └── __tests__/           # Component tests
│   ├── hooks/                   # Custom React hooks
│   ├── locales/                 # i18next translation files (en.json, zh.json)
│   ├── pages/                   # Full-page route components
│   ├── public/                  # Static assets
│   ├── services/                # API client functions
│   ├── store/                   # Zustand state management slices
│   └── test/                    # Test utilities and fixtures
├── scripts/                     # Utility scripts (database seeding, etc.)
├── src/
│   └── socialsim4/
│       ├── backend/             # Litestar web application
│       │   ├── api/
│       │   │   └── routes/      # API route modules
│       │   │       └── simulations/  # Modular simulation routes
│       │   ├── core/            # Backend-specific core abstractions
│       │   ├── db/              # Database base classes
│       │   ├── migrations/      # Alembic database migrations
│       │   ├── models/          # SQLAlchemy ORM models
│       │   ├── schemas/         # Pydantic request/response schemas
│       │   ├── scripts/         # Backend utility scripts
│       │   ├── services/        # Business logic services
│       │   └── main.py          # Application entry point
│       ├── core/                # Simulation engine
│       │   ├── actions/         # Action class implementations
│       │   ├── agent/           # Agent implementation and RAG
│       │   ├── experiment/      # A/B testing framework
│       │   │   ├── actions/     # Experiment action definitions
│       │   │   ├── feedback/    # Feedback generation
│       │   │   └── payoff/      # Payoff calculation
│       │   ├── llm/             # LLM client abstraction
│       │   │   └── providers/   # OpenAI, Gemini, Ollama providers
│       │   ├── scenes/          # Scene implementations
│       │   ├── scenarios/       # Pre-built scenario configurations
│       │   └── tools/           # Web search and HTTP tools
│       ├── locales/             # gettext locale files (en, zh)
│       └── registry.py          # Scene/action registry
├── docs/                        # Documentation
├── tests/                       # Python test files (pytest)
├── .planning/                   # Planning documents (git-ignored)
├── requirements.txt             # Python dependencies
├── pyproject.toml               # Poetry configuration
└── frontend/package.json        # Node dependencies
```

## Directory Purposes

**frontend/components:**
- Purpose: Reusable React UI components
- Contains: Page components, modal components, panel components, form components
- Key files: `SimulationWizard.tsx`, `AgentPanel.tsx`, `SimTree.tsx`, `ExperimentBuilder.tsx`

**frontend/services:**
- Purpose: API client functions for backend communication
- Contains: HTTP client wrappers, WebSocket handling, data transformation
- Key files: `simulations.ts`, `experiments.ts`, `backendClient.ts`, `simulationTree.ts`

**frontend/store:**
- Purpose: Zustand state management with slice-based architecture
- Contains: Simulation state, agent state, logs, UI state, experiments, providers, environment
- Key files: `index.ts` (store composition), `simulation.ts`, `agents.ts`, `experiments.ts`

**src/socialsim4/core:**
- Purpose: Core simulation engine independent of web framework
- Contains: Agent, Scene, Action, Simulator, SimTree, Memory, LLM integration
- Key files: `simulator.py`, `agent/agent.py`, `scene.py`, `simtree.py`, `action.py`

**src/socialsim4/core/experiment:**
- Purpose: Structured A/B testing and experiment execution framework
- Contains: Controller, Kernel, Runner, Agent, Schema/Prompt builders, Payoff engine
- Key files: `controller.py`, `kernel.py`, `runner.py`, `schema_builder.py`, `prompt_builder.py`

**src/socialsim4/backend/api/routes:**
- Purpose: Litestar route handlers organized by domain
- Contains: Auth, simulations, experiments, scenarios, providers, uploads, admin
- Key files: `simulations/__init__.py`, `simulations/websocket_handlers.py`, `experiments.py`

**src/socialsim4/backend/models:**
- Purpose: SQLAlchemy ORM models for database persistence
- Contains: User, Simulation, Experiment, ExperimentTemplate, LLMUsage, Token
- Key files: `user.py`, `simulation.py`, `experiment.py`, `experiment_template.py`

**src/socialsim4/backend/services:**
- Purpose: Business logic and integration services
- Contains: Vector store, LLM client pool, simulation runtime
- Key files: `vector_store.py`, `llm_client_pool.py`, `simtree_runtime.py`

## Key File Locations

**Entry Points:**
- `src/socialsim4/backend/main.py`: Litestar application factory, route registration
- `frontend/index.tsx`: React application bootstrap, router setup
- `frontend/App.tsx`: Route definitions with lazy-loaded pages

**Configuration:**
- `src/socialsim4/core/config.py`: Core simulation constants and environment settings
- `src/socialsim4/backend/core/config.py`: Backend settings (Pydantic Settings)
- `frontend/vite.config.ts`: Vite build configuration
- `frontend/tailwind.config.cjs`: Tailwind CSS configuration

**Core Logic:**
- `src/socialsim4/core/simulator.py`: Main simulation loop, turn management, event emission
- `src/socialsim4/core/agent/agent.py`: Agent decision-making, LLM interaction, memory
- `src/socialsim4/core/scene.py`: Scene base class, action handling, message delivery
- `src/socialsim4/core/simtree.py`: Branching timeline tree structure, simulator cloning
- `src/socialsim4/core/ordering.py`: Agent scheduling strategies (Sequential, Cycled, Controlled)

**Testing:**
- `tests/`: Python pytest tests (mirrors src/socialsim4 structure)
- `frontend/components/__tests__/`: Component tests with Vitest
- `frontend/store/index.test.ts`: Store tests
- `vitest.config.ts`: Vitest configuration

## Naming Conventions

**Files:**
- Python modules: `snake_case.py` (e.g., `simulator.py`, `action_controller.py`)
- Python packages: `snake_case/` (e.g., `core/experiment/`)
- TypeScript components: `PascalCase.tsx` (e.g., `AgentPanel.tsx`, `SimulationWizard.tsx`)
- TypeScript utilities: `camelCase.ts` (e.g., `backendClient.ts`, `simulations.ts`)
- Test files: `<name>.test.ts` or `test_<name>.py`

**Directories:**
- Python packages: `snake_case/` (e.g., `backend/`, `core/experiment/`)
- Frontend directories: `camelCase/` or `snake_case/` (e.g., `components/experiment/`, `locales/`)
- Feature groupings: `__tests__/` for co-located tests

**Classes:**
- Python: `PascalCase` (e.g., `Simulator`, `Agent`, `ExperimentController`)
- TypeScript: `PascalCase` (e.g., `ExperimentBuilder`, `AgentPanel`)

**Functions/Methods:**
- Python: `snake_case` (e.g., `run_simulation`, `add_env_feedback`)
- TypeScript: `camelCase` (e.g., `useSimulationStore`, `generateAgents`)

**Constants:**
- Python: `UPPER_SNAKE_CASE` (e.g., `MAX_REPEAT`, `RAG_AUTO_INJECT`)
- TypeScript: `UPPER_SNAKE_CASE` or `PascalCase` for enums

## Where to Add New Code

**New Scene Type:**
- Implementation: `src/socialsim4/core/scenes/<scene_name>_scene.py`
- Register: Import in `src/socialsim4/core/scenarios/registry.py`

**New Agent Action:**
- Implementation: `src/socialsim4/core/actions/<action_name>_actions.py`
- Register: Add to scene's `get_scene_actions()` method

**New API Endpoint:**
- Route handler: `src/socialsim4/backend/api/routes/<feature>.py`
- Schema: `src/socialsim4/backend/schemas/<feature>.py`
- Model (if needed): `src/socialsim4/backend/models/<feature>.py`

**New Frontend Component:**
- Implementation: `frontend/components/<ComponentName>.tsx`
- Tests: `frontend/components/__tests__/<ComponentName>.test.tsx`

**New Experiment Action Type:**
- Implementation: `src/socialsim4/core/experiment/actions/definitions.py`
- Register: Kernel auto-discovers via registry pattern

**New Frontend Page:**
- Implementation: `frontend/pages/<PageName>.tsx`
- Route: Add to `frontend/App.tsx` Routes component

**New Zustand Slice:**
- Implementation: `frontend/store/<slice_name>.ts`
- Integration: Import and compose in `frontend/store/index.ts`

## Special Directories

**frontend/node_modules:**
- Purpose: NPM package dependencies
- Generated: Yes
- Committed: No

**src/socialsim4/backend/migrations:**
- Purpose: Alembic database schema migrations
- Generated: Partially (alembic revision --autogenerate)
- Committed: Yes

**frontend/dist:**
- Purpose: Production build output
- Generated: Yes (vite build)
- Committed: No

**test_results:**
- Purpose: Debug output from simulation runs
- Generated: Yes
- Committed: No

**.planning:**
- Purpose: Planning documents generated by GSD commands
- Generated: Yes
- Committed: No (git-ignored)

**uploads:**
- Purpose: User-uploaded documents (PDF, DOCX) for RAG
- Generated: Yes
- Committed: No

---

*Structure analysis: 2025-01-08*
