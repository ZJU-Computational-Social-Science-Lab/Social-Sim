# Testing Patterns

**Analysis Date:** 2026-03-18

## Test Framework

**Python Backend:**
- Framework: pytest (`^7.4.3`)
- Config: `pyproject.toml`
- Async mode: `auto` (configured in `pyproject.toml`)
- Python path: `src` (configured in `pyproject.toml`)

**TypeScript Frontend:**
- Framework: Vitest (`^4.0.18`)
- Config: `frontend/vitest.config.ts`
- Environment: jsdom
- Setup file: `frontend/test/setup.ts`

**Assertion Library:**
- Python: pytest's built-in `assert` statement
- TypeScript: Vitest's `expect` with jest-dom matchers

**Run Commands:**

Python (pytest):
```bash
# Run all tests
pytest

# Run with coverage
pytest --cov

# Run specific test file
pytest tests/core/test_context_builder.py

# Run specific test
pytest tests/core/test_context_builder.py::test_empty_history_returns_first_round
```

TypeScript (Vitest):
```bash
# Run all tests
npm test

# Watch mode
npm run test: -- --watch

# UI mode
npm run test:ui

# Run once (no watch)
npm run test:run
```

## Test File Organization

**Location:**
- Python: Co-located with source or in `tests/` directory
- TypeScript: `__tests__/` directories alongside components

**Naming:**
- Python: `test_*.py` prefix - e.g., `test_context_builder.py`, `test_agent.py`
- TypeScript: `*.test.ts` or `*.test.tsx` suffix - e.g., `SimulationWizard.test.tsx`

**Structure:**
```
tests/
├── backend/              # API route tests
│   ├── conftest.py       # Shared fixtures
│   ├── test_smoke.py
│   ├── test_llm.py
│   └── test_simulations_routes.py
├── core/                 # Core simulation tests
│   ├── conftest.py
│   ├── test_context_builder.py
│   └── experiment/
│       └── test_controller.py
├── integration/          # Integration tests
│   └── test_experiment_flow.py
├── unit/                 # Unit tests
│   └── experiment/
│       └── test_payoff_engine.py
└── smoke_tests/          # Smoke tests
    └── conftest.py

frontend/
├── test/
│   └── setup.ts          # Global test setup
├── components/
│   └── __tests__/
│       └── SimulationWizard.test.tsx
├── store/
│   ├── index.test.ts
│   └── experiment-builder.test.ts
└── services/
    └── publicGoods/
        └── roundResolver.test.ts
```

## Test Structure

**Suite Organization (Python):**
```python
"""
Tests for PayoffEngine - generic payoff calculation.

Tests all payoff types: matrix (pairwise/group), pool, feedback, none.
"""

import pytest
from socialsim4.core.experiment.payoff.engine import PayoffEngine
from socialsim4.core.experiment.controller import ActionResult


class TestPayoffEngine:
    """Test PayoffEngine class."""

    @pytest.fixture
    def engine(self):
        return PayoffEngine()

    @pytest.fixture
    def pd_actions(self):
        """Simple PD actions for two agents."""
        return [
            ActionResult(
                agent_name="Alice",
                action_name="cooperate",
                parameters={},
                summary="Alice chose cooperate",
                success=True,
                skipped=False,
                round_num=1,
            ),
            # ... more actions
        ]

    def test_payoff_type_none_returns_empty(self, engine, pd_actions):
        """payoff_type 'none' returns empty dict."""
        result = engine.calculate_round_payoffs(
            payoff_type="none",
            actions=pd_actions,
            config={},
            grouping_mode="pairwise",
        )
        assert result == {}
```

**Patterns:**
- Use test classes (`class TestSomething:`) to group related tests
- Use fixtures for shared test data
- Docstrings describe what is being tested
- Arrange-Act-Assert pattern in test methods

**Suite Organization (TypeScript):**
```typescript
/**
 * Tests for SimulationWizard component.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, test, expect, beforeEach } from 'vitest';

describe('Store - Simulation Slice', () => {
  beforeEach(() => {
    // Reset store state before each test
    useSimulationStore.setState({
      simulations: [],
      currentSimulation: null,
      // ... reset other state
    });
  });

  it('inherits sequential round visibility from scenario defaults', () => {
    useExperimentBuilder.getState().setSelectedScenarioData({
      id: 'policy_erosion',
      name: 'Policy Meaning Erosion',
      interaction_mode: 'sequential',
      // ... other fields
    });

    expect(useExperimentBuilder.getState().roundVisibility).toBe('sequential');
  });
});
```

**Setup pattern:**
- Python: `conftest.py` files for shared fixtures
- TypeScript: `beforeEach` hooks for test setup, `test/setup.ts` for global setup

**Teardown pattern:**
- Python: Fixtures handle cleanup automatically
- TypeScript: `afterEach` cleanup in `test/setup.ts` calls `cleanup()` from testing-library

**Assertion pattern:**
- Python: Simple `assert result == expected`
- TypeScript: `expect(result).toBe(expected)` with jest-dom matchers

## Mocking

**Framework:**
- Python: `unittest.mock` (Mock, MagicMock, patch, AsyncMock)
- TypeScript: Vitest's `vi.mock()`

**Patterns (Python):**
```python
from unittest.mock import Mock, AsyncMock, patch

def test_with_mock():
    """Test with mock function."""
    mock_llm = Mock()
    mock_llm.return_value = {"action": "cooperate"}
    result = process_llm_response(mock_llm)
    assert result == "cooperate"

async def test_with_async_mock():
    """Test with async mock."""
    mock_api = AsyncMock()
    mock_api.return_value = {"status": "ok"}
    result = await call_api(mock_api)
    assert result["status"] == "ok"

def test_with_patch():
    """Test with patched dependency."""
    with patch('socialsim4.core.llm.client.LLMClient') as mock_client:
        mock_client.return_value.generate.return_value = "{}"
        result = run_simulation()
        assert result is not None
```

**Patterns (TypeScript):**
```typescript
import { vi } from 'vitest';

// Mock module
vi.mock('../services/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

// Mock i18n
vi.mock('../i18n', () => ({
  default: {
    t: (key: string, params?: Record<string, any>) => key,
    language: 'en',
    init: vi.fn(() => Promise.resolve())
  }
}));
```

**What to Mock:**
- External API calls (database, LLM API, HTTP services)
- Time/date functions
- Random number generation
- File I/O operations
- Complex dependencies

**What NOT to Mock:**
- Business logic under test
- Simple data transformations
- Domain models/entities

## Fixtures and Factories

**Test Data (Python):**
```python
@pytest.fixture
def sample_agent():
    """Create a sample agent for testing."""
    return {
        "name": "Alice",
        "user_profile": "A curious person",
        "style": "friendly",
        "action_space": ["cooperate", "defect"],
    }

@pytest.fixture
def sample_round_history():
    """Create sample round history."""
    return [
        {
            "round": 1,
            "actions": [
                {"agent": "Alice", "action": "Cooperate"},
                {"agent": "Bob", "action": "Defect"},
            ]
        }
    ]
```

**Location:**
- Python: In `conftest.py` for shared fixtures, or inline in test files
- TypeScript: Inline in test files or factory functions

## Coverage

**Requirements:** No explicit coverage target enforced

**View Coverage:**
```bash
# Python
pytest --cov=src/socialsim4 --cov-report=html

# TypeScript
npm run test:run -- --coverage
```

**Coverage tools:**
- Python: `pytest-cov` (`^4.1.0`)
- TypeScript: Vitest built-in coverage

**Note:** Coverage data shows 1176 tests across 110 test files in the codebase

## Test Types

**Unit Tests:**
- Scope: Individual functions, methods, classes
- Approach: Isolate dependencies with mocks
- Fast execution, no external services
- Example: `tests/core/test_context_builder.py`, `tests/unit/experiment/test_payoff_engine.py`

**Integration Tests:**
- Scope: Multiple components working together
- Approach: Real dependencies where feasible
- May use test database or external services
- Example: `tests/integration/test_experiment_flow.py`, `tests/integration/test_llm_action_selection.py`

**E2E Tests:**
- Scope: Full application flow
- Framework: Not explicitly used (smoke tests serve similar purpose)
- Example: `tests/smoke_tests/` directory contains scenario-based tests

**Smoke Tests:**
- Purpose: Verify basic functionality works end-to-end
- Location: `tests/smoke_tests/`
- Examples: `test_discussion.py`, `test_game_theory.py`, `test_coordination.py`

## Common Patterns

**Async Testing (Python):**
```python
import pytest

@pytest.mark.asyncio
async def test_async_function():
    """Test async function."""
    result = await async_operation()
    assert result is not None
```

**Async Testing (TypeScript):**
```typescript
import { waitFor } from '@testing-library/react';

test('async operation', async () => {
  render(<MyComponent />);
  await waitFor(() => {
    expect(screen.getByText('Loaded')).toBeInTheDocument();
  });
});
```

**Error Testing (Python):**
```python
import pytest

def test_invalid_input_raises_error():
    """Test that invalid input raises appropriate error."""
    with pytest.raises(ValueError, match="invalid parameter"):
        process_invalid_input(None)

def test_http_exception():
    """Test HTTP exception handling."""
    with pytest.raises(HTTPException) as exc_info:
        protected_route()
    assert exc_info.value.status_code == 401
```

**Error Testing (TypeScript):**
```typescript
test('handles error', async () => {
  const mockReject = vi.fn().mockRejectedValue(new Error('API Error'));
  // Test error handling
});
```

**Store Testing (TypeScript - Zustand):**
```typescript
import { useSimulationStore } from '../store';

beforeEach(() => {
  useSimulationStore.setState({
    simulations: [],
    currentSimulation: null,
    // Reset all state
  });
});

it('updates state correctly', () => {
  useSimulationStore.getState().addSimulation({ id: 'sim-1', name: 'Test' });
  const simulations = useSimulationStore.getState().simulations;
  expect(simulations).toHaveLength(1);
  expect(simulations[0].id).toBe('sim-1');
});
```

**Component Testing (TypeScript):**
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';

test('renders wizard modal', () => {
  const i18n = { t: (key: string) => key, language: 'en' };
  render(
    <I18nextProvider i18n={i18n}>
      <SimulationWizard />
    </I18nextProvider>
  );
  expect(screen.getByText('Create Simulation')).toBeInTheDocument();
});
```

## Test Setup Files

**Python:**
- `tests/backend/conftest.py` - Backend shared fixtures
- `tests/core/conftest.py` - Core simulation fixtures
- `tests/smoke_tests/conftest.py` - Smoke test fixtures
- `tests/unit/contagion/conftest.py` - Contagion module fixtures

**TypeScript:**
- `frontend/test/setup.ts` - Global test setup

**What's in `frontend/test/setup.ts`:**
- Extends Vitest's expect with jest-dom matchers
- Cleans up React after each test
- Mocks i18n module globally
- Mocks API client globally
- Provides i18n `t()` function to globalThis

## Test Organization by Layer

**Backend API Layer Tests:**
- Location: `tests/backend/`
- Focus: HTTP endpoints, authentication, request/response handling
- Example: `tests/backend/test_simulations_routes.py` (48 test functions)

**Core Engine Tests:**
- Location: `tests/core/`
- Focus: Agent logic, context building, actions, state management
- Example: `tests/core/test_context_builder.py` (18 test functions)

**Integration Tests:**
- Location: `tests/integration/`
- Focus: Full experiment flows, multi-component interactions
- Example: `tests/integration/test_experiment_flow.py`

**Unit Tests:**
- Location: `tests/unit/`
- Focus: Individual modules and functions
- Example: `tests/unit/experiment/test_payoff_engine.py` (26 test functions)

---

*Testing analysis: 2026-03-18*
