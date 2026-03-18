# Coding Conventions

**Analysis Date:** 2026-03-18

## Naming Patterns

**Files:**
- Python: `snake_case.py` - Module and package names use lowercase with underscores
- TypeScript: `PascalCase.tsx` for components, `camelCase.ts` for utilities/services
- Test files: `test_*.py` (Python), `*.test.tsx` or `*.test.ts` (TypeScript)

**Functions:**
- Python: `snake_case` - All functions use lowercase with underscores
- TypeScript: `camelCase` - All functions use lowercase with underscores
- Private/internal functions: Prefixed with underscore `_function_name` (Python)

**Variables:**
- Python: `snake_case` - Local variables and parameters
- TypeScript: `camelCase` - Local variables and parameters
- Constants: `UPPER_SNAKE_CASE` (Python), `UPPER_SNAKE_CASE` or `PascalCase` for enums (TypeScript)

**Types:**
- Python: `PascalCase` for classes, `snake_case` for type aliases
- TypeScript: `PascalCase` for interfaces, types, and enums
- Generic types: `T` prefix (TypeScript) - e.g., `TProps`, `TData`

## Code Style

**Formatting:**
- Python: Ruff (configured in `pyproject.toml`)
- TypeScript: No explicit Prettier config in project root (may use IDE defaults)
- Python follows PEP 8 style guidelines
- Line length: Standard Python (79 char soft limit, but not strictly enforced in project)

**Linting:**
- Python: Ruff (`^0.1.6` in dev dependencies)
- No explicit ESLint configuration found in frontend
- Mypy used for Python type checking (`^1.6.0`)

**Key settings from `pyproject.toml`:**
```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
pythonpath = "src"
```

## Import Organization

**Order (Python):**
1. Standard library imports
2. Third-party imports
3. Local application imports (`from socialsim4.*`)

**Path Aliases:**
- TypeScript: `@/*` maps to project root (configured in `tsconfig.json`)
- Python: Absolute imports from `socialsim4` package root

**Example from `frontend/store/index.ts`:**
```typescript
import { create } from 'zustand';           // External
import { devtools } from 'zustand/middleware';
import { createSimulationSlice } from './simulation';  // Local relative
```

**Example from `src/socialsim4/core/agent/agent.py`:**
```python
import json                                 # Standard
from pathlib import Path

from socialsim4.core.config import MAX_REPEAT  # Local
from socialsim4.core.memory import ShortTermMemory
```

## Error Handling

**Patterns:**

**Backend API Layer (`src/socialsim4/backend/`):**
- Uses Litestar's `HTTPException` for HTTP error responses
- May use try/except for HTTP semantics and external service calls

**Core Simulation Engine (`src/socialsim4/core/`):**
- **Eliminate defensive coding** - No try/except, no isinstance, no hasattr
- Use strict input formats and fail fast
- Direct field access (e.g., `action_data["location"]`) - Missing fields raise exceptions
- No runtime type checks - Rely on exact data shape produced elsewhere

**Example (CORRECT - core engine style):**
```python
def handle_move_action(action_data, agent, simulator):
    # Direct access - fails fast if "location" is missing
    location = action_data["location"]
    return move_agent(agent, location)
```

**Frontend (`frontend/`):**
- May use try/catch for API calls and async operations
- May use try/catch for user input validation

**General:**
- Don't suppress exceptions without good reason
- When using try/except, log errors appropriately

## Logging

**Framework:**
- Python: Standard `logging` module
- Frontend: `console` methods (no structured logging library detected)

**Patterns:**
- Python: Module-level logger - `logger = logging.getLogger(__name__)`
- Log at appropriate levels: DEBUG, INFO, WARNING, ERROR, CRITICAL
- Backend API routes use logger for request/response tracking

**Example from `src/socialsim4/core/agent/agent.py`:**
```python
import logging
logger = logging.getLogger(__name__)
```

## Comments

**When to Comment:**
- Complex logic or non-obvious implementations
- Algorithm explanations
- Workarounds for known issues
- **When adding new content** - Document translation keys for i18n

**JSDoc/TSDoc:**
- TypeScript functions use JSDoc-style comments for complex utilities
- Not all functions have JSDoc - primarily used for complex or public APIs
- React components typically have header docstrings explaining purpose

**Python Docstrings:**
- **All modules have file header docstrings** (MANDATORY - see CLAUDE.md)
- **All public classes have docstrings**
- **All public functions have docstrings with parameter/return documentation**
- Google-style docstring format (not strictly enforced but common)

**File Header Pattern (MANDATORY per CLAUDE.md):**
```python
"""
Context builder utilities for experiment history.

Provides functions to build context summaries from round history,
with support for visibility filtering and structured output.

Contains: build_context_summary, build_structured_context
"""
```

**TypeScript file header pattern:**
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

**Why headers matter:** Without headers, every file requires reading the entire implementation to understand its purpose. This wastes time for both humans and AI assistants.

## Function Design

**Size:**
- Soft limit: 50 lines per function
- Hard limit: 100 lines per function
- Break into helper functions when exceeding limits

**Parameters:**
- Python: Use type hints for all parameters
- TypeScript: All parameters typed (avoid `any`)
- Prefer fewer parameters (consider parameter objects for 4+ params)

**Return Values:**
- Python: Always use type hints for return values
- Functions should return consistent types
- Use `dict[str, Any]` or dataclasses for complex returns

**Example from `src/socialsim4/core/experiment/actions/handlers.py`:**
```python
def handle_move(agent_name: str, params: dict, state: ExperimentState) -> dict[str, Any]:
    """Handle move action - update agent position on grid.

    Args:
        agent_name: Agent moving
        params: {"direction": "north"|"south"|"east"|"west"}
        state: Current experiment state

    Returns:
        Result dict with success status and new position
    """
    direction = params.get("direction", "")
    # ... implementation
```

## Module Design

**Exports:**
- Python: `__all__` lists explicitly exported names
- TypeScript: Default exports for components, named exports for utilities

**Barrel Files:**
- `frontend/components/wizard/index.ts` - Re-exports wizard components
- `frontend/components/experiment/parameter_widgets/index.ts` - Re-exports widgets

**Python package structure:**
```python
# src/socialsim4/core/agent/__init__.py
"""
Agent package - Modular agent architecture.
"""
from .agent import Agent
from .parsing import parse_actions
from .rag import add_knowledge, remove_knowledge

__all__ = ["Agent", "parse_actions", "add_knowledge", "remove_knowledge"]
```

## File Size Limits

**Keep files focused and reasonably sized:**

| Type | Soft Limit | Hard Limit | Action Required |
|------|-----------|------------|-----------------|
| Python module | 300 lines | 500 lines | Split into multiple modules |
| TypeScript component | 200 lines | 400 lines | Extract sub-components |
| Single function/method | 50 lines | 100 lines | Break into helper functions |
| Single class | 300 lines | 500 lines | Extract responsibilities |

**Examples from codebase:**
- `frontend/components/AgentPanel.tsx` - 583 lines (exceeds hard limit, needs refactoring)
- `src/socialsim4/core/agent/agent.py` - 797 lines (exceeds hard limit, needs refactoring)

**Refactoring approach:**
1. Identify distinct responsibilities
2. Create new files for each responsibility
3. Use composition/imports to connect them

## Internationalization (i18n)

**All user-facing text must be translatable:**

**Frontend (TypeScript):**
```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  return <div>{t('dashboard.title')}</div>;
}
```

**Backend (Python):**
```python
from socialsim4.i18n import T

message = T('error.simulation.not_found')
```

**Translation files:**
- Frontend: `frontend/locales/en.json`, `frontend/locales/zh.json`
- Backend: `src/socialsim4/locales/en/LC_MESSAGES/socialsim4.po`, `src/socialsim4/locales/zh/LC_MESSAGES/socialsim4.po`

**Key organization:**
- Use dot notation: `dashboard.loading`, `agent.memory.label`, `error.auth.failed`
- Organize by feature/component

## Type Safety

**Python:**
- Use type hints for all function parameters and return values
- Use `dict[str, Any]` for flexible dictionaries
- Use dataclasses for structured data
- Avoid `Any` when specific type is known

**TypeScript:**
- Avoid `any` types without justification
- Use interfaces for object shapes
- Use type aliases for complex types
- Leverage TypeScript's type system

**Example from `src/socialsim4/core/context_builder.py`:**
```python
def build_context_summary(
    round_history: List[Dict[str, Any]],
    max_rounds: int = 5,
    state_snapshot: Dict[str, Any] | None = None,
    for_agent: str | None = None,
    visibility_mode: str = "all"
) -> str:
```

---

*Convention analysis: 2026-03-18*
