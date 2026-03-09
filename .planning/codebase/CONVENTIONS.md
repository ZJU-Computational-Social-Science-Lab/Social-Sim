# Coding Conventions

**Analysis Date:** 2026-03-09

## Naming Patterns

**Files:**
- **Python modules:** `snake_case.py` (e.g., `agent.py`, `simulator.py`, `llm_config.py`)
- **TypeScript components:** `PascalCase.tsx` (e.g., `AgentPanel.tsx`, `SimulationWizard.tsx`)
- **TypeScript utilities:** `camelCase.ts` (e.g., `useImageCrop.ts`, `client.ts`)
- **Test files:**
  - Python: `test_*.py` (e.g., `test_agent.py`, `test_llm.py`)
  - TypeScript: `*.test.tsx` or `*.test.ts` (e.g., `SimulationWizard.test.tsx`)

**Functions:**
- **Python:** `snake_case` (e.g., `create_llm_client`, `validate_media_url`, `add_knowledge`)
- **TypeScript:** `camelCase` (e.g., `useSimulationStore`, `uploadAgentDocument`, `loadDocuments`)

**Variables:**
- **Python:** `snake_case` (e.g., `action_space`, `short_memory`, `log_event`)
- **TypeScript:** `camelCase` (e.g., `isGenerating`, `selectedNodeId`, `addNotification`)

**Types:**
- **Python classes:** `PascalCase` (e.g., `Agent`, `Simulator`, `LLMClient`)
- **TypeScript interfaces:** `PascalCase` (e.g., `Agent`, `SimNode`, `KnowledgeItem`)
- **TypeScript types:** `PascalCase` (e.g., `EngineMode`, `TimeUnit`)

## Code Style

**Formatting:**
- **Python:** Follows PEP 8 style guidelines
- **TypeScript:** Uses consistent formatting (Vitest + jsdom environment)
- **Indentation:** 4 spaces for Python, 2 spaces for TypeScript/JSX

**Linting:**
- **Python:** Ruff for linting (configured in `pyproject.toml`)
- **TypeScript:** No explicit ESLint config detected (uses Vitest testing framework)

## Import Organization

**Python (`src/socialsim4/`):**
1. Standard library imports
2. Third-party imports
3. Local imports (from socialsim4 package)

**TypeScript (`frontend/`):**
1. React and core libraries
2. Third-party libraries
3. Local imports (store, services, types, components)

**Path Aliases:**
- Frontend uses `@/` alias for root path resolution (configured in `vitest.config.ts`)

## Error Handling

**Python - Core Simulation Engine:**
- NO defensive coding in core engine (per AGENTS.md philosophy)
- Fail fast - Let exceptions surface without try/except
- Direct field access - `action_data["location"]` not `.get("location")`
- Use specific exceptions: `ValueError`, `TypeError`, `NotImplementedError`

**Python - Backend API Layer:**
- MAY use try/except for HTTP semantics (convert exceptions to HTTP responses)
- MAY use try/except for external service calls (database, LLM API)
- Use Litestar's exception handling (`NotFoundException`, etc.)

**TypeScript - Frontend:**
- MAY use try/catch for API calls and async operations
- MAY use try/catch for user input validation
- Error boundaries for component error handling

## Logging

**Framework:** Python's standard `logging` module

**Patterns:**
- Each module gets its own logger with `__name__`
- Use `exc_info=True` for errors to include stack traces
- Backend routes log important operations (file uploads, LLM calls)

## Comments

**When to Comment:**
- Always include file headers (MANDATORY)
- Document public APIs - All public functions/classes have docstrings
- Comment complex logic - Non-obvious implementations get explanations

**Python Docstrings:** Triple-quoted strings with Args/Returns sections

**TypeScript JSDoc:** JSDoc comments with @param and @returns tags

## Function Design

**Size:**
- Soft limit: 50 lines per function
- Hard limit: 100 lines per function

**Parameters:**
- Python: Use type hints for all parameters and return values
- TypeScript: Define interfaces for complex parameter objects

**Return Values:**
- Python actions: Return 5-tuple `(success, result, summary, meta, pass_control)`
- API routes: Return structured dicts or Pydantic models
- TypeScript: Use typed return values

## Module Design

**Exports:**
- Python: Explicit `__all__` lists for public APIs
- TypeScript: Named exports for utilities, default exports for components

**Barrel Files:**
- `frontend/store/index.ts` composes all store slices
- `src/socialsim4/core/__init__.py` exports core classes

## Special Conventions

**Internationalization (i18n):**
- All user-facing text must use translation functions
- Backend: `from socialsim4.i18n import T` → `T('key', param=value)`
- Frontend: `const { t } = useTranslation()` → `t('key', { param })`

**File Headers (MANDATORY):**
- Every Python/TypeScript file MUST start with a summary docstring
- Include: What, Why, Key exports
- See CLAUDE.md for detailed header format requirements

**File Size Limits:**
| Type | Soft Limit | Hard Limit |
|------|-----------|------------|
| Python module | 300 lines | 500 lines |
| TypeScript component | 200 lines | 400 lines |
| Single function/method | 50 lines | 100 lines |
| Single class | 300 lines | 500 lines |

---

*Convention analysis: 2026-03-09*
