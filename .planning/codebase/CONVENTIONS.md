# Coding Conventions

**Analysis Date:** 2025-03-08

## Naming Patterns

**Python Files:**
- Use `snake_case` for all Python files: `agent.py`, `experiment_controller.py`, `base_actions.py`
- Test files prefixed with `test_`: `test_agent.py`, `test_controller.py`
- Private/deprecated modules use `.deprecated` suffix: `agent.py.deprecated`

**TypeScript Files:**
- Use `PascalCase` for component files: `AgentPanel.tsx`, `SimulationWizard.tsx`
- Use `camelCase` for utility/service files: `simulations.ts`, `backendClient.ts`
- Test files use `.test.tsx` or `.spec.tsx` suffix: `SimulationWizard.test.tsx`

**Python Functions:**
- Use `snake_case` for all functions: `parse_actions`, `build_context`, `create_llm_client`
- Private/internal methods use single underscore prefix: `_get_openai`, `_ensure_gc_task`
- Factory functions use `make_` or `create_` prefix: `make_agent`, `create_router`

**TypeScript Functions:**
- Use `camelCase` for all functions: `addKnowledgeToAgent`, `loadDocuments`, `handleFileUpload`
- Event handlers use `handle` prefix: `handleFileUpload`, `handleDocsToggle`
- Getter/setter patterns: `isOpen`, `setOpen`

**Python Classes:**
- Use `PascalCase` for all classes: `Agent`, `Simulator`, `ExperimentController`, `ShortTermMemory`
- Exceptions use `PascalCase` with `Error` suffix: `SimCloneError`, `ValueError`
- Dataclasses use `PascalCase`: `@dataclass class ActionResult`

**TypeScript Interfaces/Types:**
- Use `PascalCase` for interfaces and types: `ButtonProps`, `AppState`, `SimulationSlice`
- Type aliases use `PascalCase`: `Notification`, `GuideMessage`

**Python Variables:**
- Use `snake_case` for local variables: `action_name`, `event_type`, `max_retries`
- Module-level constants use `UPPER_SNAKE_CASE`: `MAX_REPEAT`, `EMOTION_ENABLED`, `OLLAMA_BASE_URL`
- Class attributes use `UPPER_SNAKE_CASE` for constants: `NAME`, `DESC`, `INSTRUCTION`

**TypeScript Variables:**
- Use `camelCase` for local variables: `isLoading`, `errorMessage`, `selectedNodeId`
- Constants use `UPPER_SNAKE_CASE`: `SYSTEM_TEMPLATES`, `DEFAULT_TIME_CONFIG`
- React state uses `is/are` prefix for booleans: `isOpen`, `isGenerating`, `isLoading`

**Python Type Annotations:**
- Use `snake_case` for custom types: `agent: Agent`, `action_data: dict`
- Use `|` for union types (Python 3.11+): `str | None`, `int | float`
- Use `dict[K, V]` and `list[T]` syntax: `dict[str, str]`, `list[Agent]`
- Avoid `Any`; use specific types or `object` when necessary

## Code Style

**Python:**
- No explicit formatter detected (Ruff configured in dev dependencies)
- Follow PEP 8 style guidelines
- Use 4 spaces for indentation
- Max line length not strictly enforced but aim for readability

**TypeScript:**
- Vite + Vitest for build and testing
- Tailwind CSS for styling (utility-first CSS classes)
- No explicit formatter config (Prettier/ESLint not configured)
- Use 2 spaces for indentation (Vite default)

**Python Imports:**
1. Standard library imports first
2. Third-party imports second
3. Local application imports third
4. Each group separated by blank line

```python
import os
import time
from concurrent.futures import ThreadPoolExecutor

from socialsim4.core.agent import Agent
from socialsim4.core.event import PublicEvent

from .llm_config import LLMConfig
from .providers import _MockModel
```

**TypeScript Imports:**
1. React/core library imports
2. Third-party imports
3. Local application imports
4. Type imports use `type` keyword when possible

```typescript
import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Agent, KnowledgeItem } from '../types';
import { uploadAgentDocument, listAgentDocuments } from '../services/simulations';
```

## Import Organization

**Python Path Aliases:**
- Use absolute imports from `socialsim4` package root: `from socialsim4.core.agent import Agent`
- Relative imports for same-package modules: `from .llm_config import LLMConfig`
- Lazy imports for heavy modules: `_openai = None` with `_get_openai()` getter

**TypeScript Path Aliases:**
- `@/*` maps to `frontend/` root directory (configured in `tsconfig.json`)
- Use alias for cleaner imports: `import { useSimulationStore } from '@/store'`

## Error Handling

**Python (Core Engine - AGENTS.md philosophy):**
- **Eliminate defensive coding** in core simulation engine (`src/socialsim4/core/`)
- No try/except blocks in core engine code
- Use strict input formats and fail fast
- Direct dictionary access: `action_data.get("location")` or `action_data["location"]`
- Let exceptions surface naturally for debugging

**Python (Backend API Layer):**
- MAY use try/except for HTTP semantics in `src/socialsim4/backend/`
- Convert exceptions to HTTP responses
- Use try/except for external service calls (database, LLM API)
- Example from `src/socialsim4/backend/main.py`:
  ```python
  def internal_error_handler(request: Request, exc: Exception) -> Response:
      return Response(content={"error": str(exc)}, media_type=MediaType.JSON, status_code=500)
  ```

**TypeScript (Frontend):**
- Use try/catch for API calls and async operations
- Use try/catch for user input validation
- Error state management in React: `const [error, setError] = useState<string | null>(null)`
- Toast notifications for user-facing errors: `addNotification('error', message)`

## Logging

**Python:**
- Use standard `logging` module
- Logger per module: `logger = logging.getLogger(__name__)`
- Debug logging for LLM prompts/responses to `test_results/` directory
- Debug file naming: `agent_debug_YYYYMMDD_HHMMSS.txt`, `experiment_debug_*.txt`
- Log levels: `logger.debug()`, `logger.info()`, `logger.exception()`
- Exception logging: `logger.exception("log_event handler raised")`

**TypeScript:**
- Console logging for development: `console.error('Failed to load documents:', err)`
- No centralized logging framework detected
- Toast notifications for user feedback via Zustand store

## Comments

**When to Comment:**
- Add module-level docstrings for all files (MANDATORY per CLAUDE.md)
- Add docstrings for all public classes, functions, and methods
- Comment complex logic or non-obvious implementations
- Use inline comments for "why" not "what"

**Python Docstrings:**
- Use triple-quoted strings at module level
- Module docstring format:
  ```python
  """
  Module purpose description (1-2 sentences).

  Additional context about what this module does and why it exists.

  Contains:
      - ClassName: Description
      - function_name: Description
  """
  ```
- Class docstrings: Describe purpose, key attributes, usage pattern
- Function docstrings: Args, Returns, Raises sections

**TypeScript JSDoc:**
- Use JSDoc comments for functions and classes
- Format:
  ```typescript
  /**
   * Brief description (1-2 sentences).
   *
   * Additional context about purpose and usage.
   *
   * @param paramName - Description
   * @returns Description of return value
   */
  ```

**Internationalization Comments:**
- Mixed language comments allowed (Chinese and English)
- Comments often in Chinese for Chinese-speaking team
- Example: `# 用 dict 便于按名字查找`

## Function Design

**Python:**
- Size guideline: Functions under 50 lines (soft), 100 lines (hard limit per CLAUDE.md)
- Parameters: Use descriptive names with type hints
- Return values: Use tuple returns for multiple values: `return True, result, summary, {}, False`
- Async functions: Use `async def` for I/O operations
- Default parameters: Use `None` for mutable defaults

**TypeScript:**
- Size guideline: Components under 200 lines (soft), 400 lines (hard limit)
- Functions should be focused and single-purpose
- Use callbacks for event handling: `onChange: (value: T) => void`
- Async/await for API calls: `const data = await uploadAgentDocument(...)`

## Module Design

**Python:**
- One primary responsibility per file
- Use `__init__.py` to expose public API
- Barrel files for re-exports: `from .agent import Agent, ExperimentAgent`
- Registry pattern for dynamic lookup: `ACTION_SPACE_MAP`, `SCENE_MAP`, `INFORMATION_MODEL_MAP`

**TypeScript:**
- Use barrel files (index.ts) for re-exports
- Zustand store split into focused slice files:
  - `store/index.ts` - Main composition
  - `store/simulation.ts` - Simulation CRUD
  - `store/agents.ts` - Agent management
  - `store/ui.ts` - Modal and notification state
- Component co-location: `ComponentName.tsx` with `ComponentName.test.tsx`

## React/TypeScript Patterns

**Component Structure:**
- Functional components with hooks
- Props interface defined at top: `export interface ComponentProps`
- Destructure props: `const { isOpen, onClose, data } = props;`
- Early returns for edge cases

**State Management:**
- Zustand for global state (slice-based architecture)
- Local state with `useState` for component-specific data
- Callback memoization with `useCallback`
- Effect cleanup with `useEffect` return function

**Styling:**
- Tailwind CSS utility classes
- Responsive design with mobile-first approach
- Dark mode support via `dark:` prefix
- Accessibility: ARIA attributes, semantic HTML

## File Headers (MANDATORY)

**Python:**
- Every file MUST start with a module docstring
- Format:
  ```python
  """
  Brief description of what the file does (1-2 sentences).

  Why this file exists / its primary responsibility.

  Contains:
      - ClassName: Description
      - function_name: Description
  """
  ```

**TypeScript:**
- Every file MUST start with a JSDoc comment
- Format:
  ```typescript
  /**
   * Brief description of component/module (1-2 sentences).
   *
   * Additional context about purpose and usage.
   *
   * Exports: ComponentName (default) or list of exports
   */
  ```

**Example:**
```typescript
  /**
   * Agent panel component for workspace view.
   *
   * Displays agent configuration, memory, and knowledge management.
   * Handles agent editing, document uploads, and RAG configuration.
   *
   * Exports: AgentPanel (default)
   */
  ```

## Dataclass Pattern

**Python:**
- Use `@dataclass` for simple data containers
- Use type hints on all fields
- Default values for optional fields
- Example from `src/socialsim4/core/experiment/controller.py`:
  ```python
  @dataclass
  class ActionResult:
      success: bool
      action_name: str
      parameters: Dict[str, Any]
      summary: str
      agent_name: str
      round_num: int
      skipped: bool = False
      error: str = ""
  ```

## Registry Pattern

**Python:**
- Centralized registries for dynamic lookup
- Dictionary-based: `ACTION_SPACE_MAP`, `SCENE_MAP`
- Getter functions with fallback: `get_scene_class()`, `get_information_model()`
- Normalization for variant keys: `scene_type.replace("-", "_")`

## Factory Pattern

**Python:**
- Factory fixtures in tests: `make_agent`, `ollama_client_factory`
- Factory functions for creating objects with defaults
- Example from `tests/core/conftest.py`:
  ```python
  @pytest.fixture
  def make_agent():
      def _agent(name: str = "TestAgent", ...) -> ExperimentAgent:
          return ExperimentAgent(name=name, ...)
      return _agent
  ```

## Internationalization (i18n) Patterns

**Frontend (TypeScript):**
- Use `react-i18next` with `useTranslation` hook
- Translation keys use dot notation: `'dashboard.loading'`
- Interpolation: `t('welcome.user', { name: userName })`
- Mock i18n in tests: `vi.mock('../i18n', ...)`

**Backend (Python):**
- Use `gettext` via custom `T()` function (per CLAUDE.md)
- Translation files: `src/socialsim4/locales/` with `.po` files
- Keys follow dot-notation: `error.simulation.not_found`

---

*Convention analysis: 2025-03-08*
