# Codebase Structure

**Analysis Date:** 2025-03-09

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
│       │   ├── core/            # Backend-specific configuration
│       │   ├── db/              # Database base classes and mixins
│       │   ├── migrations/      # Alembic database migrations
│       │   ├── models/          # SQLAlchemy ORM models
│       │   ├── schemas/         # Pydantic request/response schemas
│       │   ├── scripts/         # Backend utility scripts
│       │   ├── services/        # Business logic services
│       │   └── main.py          # Application entry point
│       ├── core/                # Simulation engine
│       │   ├── actions/         # Action class implementations
│       │   ├── agent/           # Agent implementation modules
│       │   ├── contagion/       # Contagion simulation mechanics
│       │   ├── experiment/      # A/B testing framework
│       │   │   ├── actions/     # Experiment action definitions
│       │   │   ├── feedback/    # Feedback generation
│       │   │   └── payoff/      # Payoff calculation
│       │   ├── llm/             # LLM client abstraction
│       │   │   └── providers/   # OpenAI, Gemini, Ollama, Mock providers
│       │   ├── scenes/          # Scene implementations
│       │   ├── scenarios/       # Scenario registry and descriptions
│       │   ├── templates/       # Template loader for generic scenes
│       │   └── tools/           # Web search and HTTP tools
│       ├── locales/             # gettext locale files (en, zh)
│       ├── scenarios/           # Pre-built scenario configurations
│       ├── services/            # Shared services (llm_client_pool)
│       ├── templates/           # Jinja2 templates for mechanics
│       └── registry.py          # Scene/action/information model registry
├── docs/                        # Documentation
├── tests/                       # Python test files (pytest)
├── .planning/                   # Planning documents (git-ignored)
├── requirements.txt             # Python dependencies
└── frontend/package.json        # Node dependencies
```

## Directory Purposes

**frontend/components:**
- Purpose: Reusable React UI components
- Contains: Page components, modal components, panel components, form components, wizard steps
- Key files: `SimulationWizard.tsx`, `AgentPanel.tsx`, `SimTree.tsx`, `ExperimentBuilder.tsx`

**frontend/components/wizard:**
- Purpose: Multi-step wizard for simulation creation
- Contains: Step components (Step1BasicInfo, Step2DefaultMode, Step3Confirmation), shared wizard components
- Key files: `Step1BasicInfo.tsx`, `Step2DefaultMode.tsx`, `Step3Confirmation.tsx`, `WizardFooter.tsx`

**frontend/components/experiment:**
- Purpose: Experiment builder UI components
- Contains: Experiment preview, parameter widgets
- Key files: `ExperimentPreview.tsx`, `parameter_widgets/` (SliderField, TextField, SelectField, etc.)

**frontend/services:**
- Purpose: API client functions for backend communication
- Contains: HTTP client wrappers, WebSocket handling, data transformation
- Key files: `simulations.ts`, `experiments.ts`, `backendClient.ts`, `providers.ts`

**frontend/store:**
- Purpose: Zustand state management with slice-based architecture
- Contains: Simulation state, agent state, logs, UI state, experiments, providers, environment, auth, theme
- Key files: `index.ts` (store composition), `simulation.ts`, `agents.ts`, `experiments.ts`, `logs.ts`, `ui.ts`

**src/socialsim4/core:**
- Purpose: Core simulation engine independent of web framework
- Contains: Agent, Scene, Action, Simulator, SimTree, Memory, LLM integration, Registry
- Key files: `simulator.py`, `agent/agent.py`, `scene.py`, `simtree.py`, `action.py`, `registry.py`

**src/socialsim4/core/agent:**
- Purpose: Modular agent implementation with delegated responsibilities
- Contains: Main agent class, RAG module, parsing utilities, serialization, registry
- Key files: `agent.py`, `rag.py`, `parsing.py`, `serialization.py`, `registry.py`

**src/socialsim4/core/experiment:**
- Purpose: Structured A/B testing and experiment execution framework
- Contains: Controller, Kernel, Runner, Agent, Schema/Prompt builders, Payoff engine, Information model
- Key files: `controller.py`, `kernel.py`, `runner.py`, `schema_builder.py`, `prompt_builder.py`, `payoff/engine.py`, `information_model.py`

**src/socialsim4/core/actions:**
- Purpose: Action class implementations for different scene types
- Contains: Base actions (send_message, yield), scene-specific actions (council, village, werewolf, landlord, moderation, web, rag)
- Key files: `base_actions.py`, `council_actions.py`, `village_actions.py`, `werewolf_actions.py`, `landlord_actions.py`

**src/socialsim4/core/scenes:**
- Purpose: Scene implementations (environment types)
- Contains: Council, village, werewolf, landlord, simple chat scenes
- Key files: `council_scene.py`, `village_scene.py`, `werewolf_scene.py`, `landlord_scene.py`, `simple_chat_scene.py`

**src/socialsim4/core/llm:**
- Purpose: LLM client abstraction and provider implementations
- Contains: LLMClient, OpenAI/Ollama/Gemini/Mock providers, validation, config
- Key files: `client.py`, `providers/openai.py`, `providers/ollama.py`, `providers/gemini.py`, `validation.py`, `llm_config.py`

**src/socialsim4/backend/api/routes:**
- Purpose: Litestar route handlers organized by domain
- Contains: Auth, simulations (modular), experiments, scenarios, providers, uploads, admin, environment
- Key files: `simulations/__init__.py`, `simulations/websocket_handlers.py`, `experiments.py`, `auth.py`

**src/socialsim4/backend/models:**
- Purpose: SQLAlchemy ORM models for database persistence
- Contains: User, Simulation, Experiment, ExperimentTemplate, LLMUsage, Token
- Key files: `user.py`, `simulation.py`, `experiment.py`, `experiment_template.py`, `llm_usage.py`

**src/socialsim4/backend/services:**
- Purpose: Business logic and integration services
- Contains: Vector store, LLM client pool, simulation runtime, experiment runner, document processing
- Key files: `vector_store.py`, `llm_client_pool.py`, `simtree_runtime.py`, `experiment_runner.py`, `documents.py`

## Key File Locations

**Entry Points:**
- `src/socialsim4/backend/main.py`: Litestar application factory, route registration, CORS config
- `frontend/index.tsx`: React application bootstrap, router setup
- `frontend/App.tsx`: Route definitions with lazy-loaded pages
- `src/socialsim4/cli.py`: CLI entry point for standalone simulation

**Configuration:**
- `src/socialsim4/core/config.py`: Core simulation constants and environment settings (MAX_REPEAT, RAG_AUTO_INJECT)
- `src/socialsim4/backend/core/config.py`: Backend settings (Pydantic Settings)
- `frontend/vite.config.ts`: Vite build configuration
- `frontend/i18n.ts`: i18next configuration

**Core Logic:**
- `src/socialsim4/core/simulator.py`: Main simulation loop, turn management, event emission
- `src/socialsim4/core/agent/agent.py`: Agent decision-making, LLM interaction, memory, knowledge base
- `src/socialsim4/core/scene.py`: Scene base class, action handling, message delivery, social network filtering
- `src/socialsim4/core/simtree.py`: Branching timeline tree structure, simulator cloning, node subscriptions
- `src/socialsim4/core/ordering.py`: Agent scheduling strategies (Sequential, Cycled, Controlled)
- `src/socialsim4/core/action_controller.py`: Action validation and constraint checking

**Testing:**
- `tests/`: Python pytest tests (mirrors src/socialsim4 structure)
- `frontend/components/__tests__/`: Component tests with Vitest
- `frontend/store/index.test.ts`: Store tests
- `frontend/vitest.config.ts`: Vitest configuration

**Utilities:**
- `src/socialsim4/core/registry.py`: Scene, action, ordering, and information model registries
- `src/socialsim4/services/llm_client_pool.py`: LLM client connection pooling for parallel branches
- `src/socialsim4/backend/services/vector_store.py`: ChromaDB/JSON vector store for RAG

## Naming Conventions

**Files:**
- Python modules: `snake_case.py` (e.g., `simulator.py`, `action_controller.py`, `experiment_runner.py`)
- Python packages: `snake_case/` (e.g., `core/experiment/`, `backend/api/routes/`)
- TypeScript components: `PascalCase.tsx` (e.g., `AgentPanel.tsx`, `SimulationWizard.tsx`)
- TypeScript utilities: `camelCase.ts` (e.g., `backendClient.ts`, `simulations.ts`)
- Test files: `<name>.test.ts` or `test_<name>.py`

**Directories:**
- Python packages: `snake_case/` (e.g., `backend/`, `core/experiment/`)
- Frontend directories: `camelCase/` or `snake_case/` (e.g., `components/experiment/`, `locales/`)
- Feature groupings: `__tests__/` for co-located tests

**Classes:**
- Python: `PascalCase` (e.g., `Simulator`, `Agent`, `ExperimentController`, `LLMClient`)
- TypeScript: `PascalCase` (e.g., `ExperimentBuilder`, `AgentPanel`, `SimulationStore`)

**Functions/Methods:**
- Python: `snake_case` (e.g., `run_simulation`, `add_env_feedback`, `parse_actions`)
- TypeScript: `camelCase` (e.g., `useSimulationStore`, `generateAgents`, `createSimulation`)

**Constants:**
- Python: `UPPER_SNAKE_CASE` (e.g., `MAX_REPEAT`, `RAG_AUTO_INJECT`, `ACTION_SPACE_MAP`)
- TypeScript: `UPPER_SNAKE_CASE` or `PascalCase` for enums

## Where to Add New Code

**New Scene Type:**
- Implementation: `src/socialsim4/core/scenes/<scene_name>_scene.py`
- Actions: `src/socialsim4/core/actions/<scene_name>_actions.py` (if scene-specific)
- Register: Add to `SCENE_MAP` in `src/socialsim4/core/registry.py`
- Scene actions: Add to `SCENE_ACTIONS` dict in registry.py
- Information model: Add to `INFORMATION_MODEL_MAP` if custom visibility needed

**New Agent Action:**
- Implementation: `src/socialsim4/core/actions/<action_name>_actions.py` or add to existing file
- Register: Add to `ACTION_SPACE_MAP` in `src/socialsim4/core/registry.py`
- Scene integration: Add to scene's `get_scene_actions()` method or `SCENE_ACTIONS` registry

**New API Endpoint:**
- Route handler: `src/socialsim4/backend/api/routes/<feature>.py`
- Schema: `src/socialsim4/backend/schemas/<feature>.py`
- Model (if needed): `src/socialsim4/backend/models/<feature>.py`
- Service logic: `src/socialsim4/backend/services/<feature>.py`
- Register router: Import and add to router in `backend/api/routes/__init__.py`

**New Frontend Component:**
- Implementation: `frontend/components/<ComponentName>.tsx`
- Tests: `frontend/components/__tests__/<ComponentName>.test.tsx`
- Export: Add barrel export if needed

**New Frontend Page:**
- Implementation: `frontend/pages/<PageName>.tsx`
- Route: Add to `frontend/App.tsx` Routes component
- Lazy load: Use lazy() for code splitting

**New Zustand Slice:**
- Implementation: `frontend/store/<slice-name>.ts`
- Integration: Import and compose in `frontend/store/index.ts`
- Cross-slice deps: Wire up in store composition if needed

**New Experiment Action Type:**
- Implementation: Add to experiment actions in `src/socialsim4/core/experiment/actions/definitions.py`
- Handler: Add handler in `src/socialsim4/core/experiment/actions/handlers.py`
- Register: Kernel auto-discovers via registry pattern

**New LLM Provider:**
- Implementation: `src/socialsim4/core/llm/providers/<provider>.py`
- Functions: Implement `create_<provider>_client()`, `<provider>_chat()`, `<provider>_embedding()`
- Integration: Add import and dialect support in `llm/client.py`

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
- Purpose: Debug output from simulation runs (agent prompts, LLM responses)
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

**.venv / venv:**
- Purpose: Python virtual environment
- Generated: Yes
- Committed: No

---

*Structure analysis: 2025-03-09*
