# Testing Patterns

**Analysis Date:** 2026-03-09

## Test Framework

**Python Runner:**
- **pytest** 7.4.3 - Primary test runner
- **pytest-asyncio** 0.21.1 - Async test support
- **pytest-cov** 4.1.0 - Coverage reporting

**Configuration:**
- Config file: `pyproject.toml` in project root
- Pytest settings in `[tool.pytest.ini_options]`:
  ```toml
  [tool.pytest.ini_options]
  asyncio_mode = "auto"
  pythonpath = "src"
  ```
- Async mode set to "auto" for automatic async/await detection

**Python Assertion Library:**
- Built-in `assert` statement
- `pytest.raises()` for exception testing
- Example: `with pytest.raises(ValueError, match="scope_type"):`

**TypeScript Runner:**
- **vitest** 4.0.18 - Test runner with native ESM support
- **@testing-library/react** 16.3.2 - Component testing utilities
- **@testing-library/jest-dom** 6.9.1 - DOM matchers
- **happy-dom** or **jsdom** for DOM environment

**Run Commands:**

**Python:**
```bash
# Run all tests
pytest

# Run specific test file
pytest tests/core/test_agent.py

# Run with coverage
pytest --cov=socialsim4

# Run specific test
pytest tests/core/test_agent.py::TestAgentInitialization::test_agent_init_with_required_params

# Run smoke tests (Ollama-based)
pytest tests/smoke_tests/

# Run integration tests
pytest tests/integration/
```

**TypeScript:**
```bash
# Run all tests
npm test

# Watch mode
npm run test:ui  # Opens Vitest UI

# Run once
npm run test:run

# Run specific file
npx vitest frontend/components/__tests__/SimulationWizard.test.tsx
```

## Test File Organization

**Python Location:**
- Tests co-located in `tests/` directory (not with source code)
- Mirrors `src/socialsim4/` structure:
  ```
  tests/
  ├── backend/           # Tests for backend API
  │   ├── conftest.py
  │   ├── test_agent.py
  │   └── test_llm.py
  ├── core/              # Tests for core engine
  │   ├── conftest.py
  │   ├── test_agent.py
  │   └── experiment/
  │       └── test_controller.py
  ├── unit/              # Unit tests
  │   ├── test_information_model.py
  │   └── experiment/
  ├── integration/       # Integration tests
  │   └── test_experiment_flow.py
  ├── smoke_tests/       # Full scenario tests with Ollama
  │   ├── conftest.py
  │   └── test_coordination.py
  └── llm_prompt_testing/ # LLM prompt validation tests
      └── action_format_tests.py
  ```

**Python Naming:**
- All test files prefixed with `test_`: `test_agent.py`, `test_controller.py`
- Test files in subdirectories mirror package structure
- Test classes use `Test` prefix: `TestAgentInitialization`, `TestProcessValidResponse`

**TypeScript Location:**
- Tests co-located with components using `__tests__` directories or `.test.tsx` suffix
- Structure:
  ```
  frontend/
  ├── components/__tests__/           # Component tests
  │   └── SimulationWizard.test.tsx
  ├── components/experiment/__tests__ # Feature-specific tests
  │   ├── Step1InteractionType.test.tsx
  │   └── ParameterField.test.tsx
  ├── test/setup.ts                   # Test configuration
  └── vitest.config.ts                # Vitest configuration
  ```

**TypeScript Naming:**
- Test files use `.test.tsx` or `.spec.tsx` suffix
- Test files in `__tests__/` subdirectories or co-located with component

## Test Structure

**Python Suite Organization:**

**Class-based organization:**
```python
class TestAgentInitialization:
    """Tests for Agent initialization and basic configuration."""

    def test_agent_init_with_required_params(self):
        """Test agent initialization with only required parameters."""
        agent = Agent(
            name="TestAgent",
            user_profile="A test agent",
            style="neutral",
            action_space=[],
        )
        assert agent.name == "TestAgent"
        assert agent.language == "en"
```

**Function-based organization:**
```python
def test_prisoners_dilemma_end_to_end():
    """Test full flow: scenario -> agents -> prompt -> parse."""
    scenario = get_scenario("prisoners_dilemma")
    assert scenario is not None
    # ... test implementation
```

**Async test pattern:**
```python
@pytest.mark.asyncio
async def test_process_valid_response():
    """Process a valid LLM response."""
    result = await controller.process_response(
        raw_json, agent, PRISONERS_DILEMMA, None, round_num=1
    )
    assert result.success is True
```

**Patterns:**
- **Setup:** Use pytest fixtures for common test data
- **Teardown:** Implicit (pytest handles cleanup)
- **Assertion:** Use plain `assert` statements
- **Grouping:** Use test classes for related tests
- **Documentation:** Docstrings describe what each test does

**TypeScript Suite Organization:**

**Describe blocks:**
```typescript
describe('ParameterField', () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Widget Routing', () => {
    test('should render SliderField for ui_hint="slider"', () => {
      const param: ScenarioParam = { type: 'integer', default: 50, ui_hint: 'slider' };
      render(<ParameterField param={param} value={50} onChange={onChange} />);
      const slider = screen.container.querySelector('input[type="range"]');
      expect(slider).toBeInTheDocument();
    });
  });
});
```

**Patterns:**
- **Setup:** Use `beforeEach` for test setup
- **Teardown:** Use `afterEach` for cleanup (automatic with `@testing-library/react`)
- **Mocking:** Use `vi.mock()` for module mocks
- **Assertion:** Use `expect()` with jest-dom matchers

## Mocking

**Python Framework:**
- `unittest.mock.Mock` from standard library
- `unittest.mock.patch` for context managers
- Fixture-based mocking in pytest

**Python Mocking Patterns:**

**Mock objects:**
```python
from unittest.mock import Mock

action_cooperate = Mock()
action_cooperate.NAME = "Cooperate"
action_cooperate.DESC = "Stay silent."
```

**Mock LLM client fixture:**
```python
@pytest.fixture
def mock_llm_client():
    """Create a mock LLM client with configurable JSON responses."""
    client = Mock()
    client.chat = Mock(return_value='{"reasoning": "...", "action": "cooperate"}')
    client.config = LLMConfig(dialect="mock")
    return client
```

**Factory fixtures:**
```python
@pytest.fixture
def make_agent():
    """Factory function for creating test agents."""
    def _agent(name: str = "TestAgent", ...) -> ExperimentAgent:
        return ExperimentAgent(name=name, ...)
    return _agent
```

**What to Mock:**
- External service calls (LLM APIs, databases)
- File I/O operations
- Network requests
- Time-dependent operations (use `freeze_time` if needed)

**What NOT to Mock:**
- Core business logic (test actual behavior)
- Simple data transformations
- Domain models

**TypeScript Mocking:**

**Module mocking:**
```typescript
vi.mock('../i18n', () => ({
  default: {
    t: (key: string, params?: Record<string, any>) => key,
    language: 'en',
    init: vi.fn(() => Promise.resolve())
  }
}));
```

**Function mocking:**
```typescript
const onChange = vi.fn();
// In test
expect(onChange).toHaveBeenCalledWith(newValue);
```

**Service mocking:**
```typescript
vi.mock('../services/simulations', () => ({
  createSimulation: vi.fn(() => Promise.resolve({ id: 'sim-123', name: 'Test Sim' }))
}));
```

## Fixtures and Factories

**Python Test Data:**

**pytest fixtures:**
```python
@pytest.fixture
def ollama_client_factory():
    """Factory fixture to create Ollama LLM clients."""
    def _create(model: str, temperature: float = 0.7, max_tokens: int = 512):
        config = LLMConfig(
            dialect="ollama",
            model=model,
            base_url=OLLAMA_BASE_URL,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return create_llm_client(config)
    return _create
```

**Scope-based fixtures:**
```python
@pytest.fixture(scope="session")
def ollama_models():
    """Return list of Ollama models to test with."""
    return OLLAMA_MODELS
```

**Location:**
- `tests/backend/conftest.py` - Backend test fixtures
- `tests/core/conftest.py` - Core engine fixtures
- `tests/smoke_tests/conftest.py` - Smoke test fixtures

**TypeScript Test Data:**

**Test setup:**
```typescript
// frontend/test/setup.ts
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);
```

**Mock i18n:**
```typescript
(globalThis as any).i18n = {
  t: (key: string, params?: Record<string, any>) => key,
  language: 'en'
};
```

## Coverage

**Requirements:** None explicitly enforced (no coverage targets in config)

**View Coverage (Python):**
```bash
pytest --cov=socialsim4 --cov-report=html
# Open htmlcov/index.html for detailed report
```

**pytest-cov configured:** Available via dev dependencies

**Coverage areas:**
- Core engine: `src/socialsim4/core/`
- Backend API: `src/socialsim4/backend/`
- Experiment framework: `src/socialsim4/core/experiment/`

## Test Types

**Unit Tests (Python):**
- **Scope:** Individual functions, methods, classes
- **Location:** `tests/unit/` and `tests/core/`
- **Approach:**
  - Test public interfaces only
  - Use fixtures for test data
  - Mock external dependencies
  - Test edge cases and error conditions
- **Example:**
  ```python
  def test_invalid_scope_type_raises():
      with pytest.raises(ValueError, match="scope_type"):
          InformationModel(scope_type="invalid")
  ```

**Integration Tests (Python):**
- **Scope:** Multiple components working together
- **Location:** `tests/integration/`
- **Approach:**
  - Test full workflows end-to-end
  - Use real implementations (not mocks)
  - Focus on component interactions
- **Example:**
  ```python
  def test_prisoners_dilemma_end_to_end():
      """Test full flow: scenario -> agents -> prompt -> parse."""
      scenario = get_scenario("prisoners_dilemma")
      agent = Agent(name="Participant 1", ...)
      prompt = agent.system_prompt(MockScene(), context_summary=None)
      assert "Participant 1" in prompt
  ```

**Smoke Tests (Python):**
- **Scope:** Full scenarios with real LLM (Ollama)
- **Location:** `tests/smoke_tests/`
- **Approach:**
  - Run complete simulations
  - Use Ollama for local LLM testing
  - Generate output files for inspection
  - Test real-world scenarios
- **Scenarios tested:**
  - Game theory (prisoners dilemma)
  - Sociology experiments
  - Grid world
  - Discussion scenarios
  - Werewolf game
  - Coordination games
- **Example:**
  ```python
  @pytest.mark.parametrize("model", ["phi4-mini:latest", "qwen3:4b-instruct"])
  def test_coordination_with_model(default_llm_client, model):
      """Test coordination game scenario with specific model."""
      # Run full simulation with real LLM
  ```

**LLM Prompt Tests (Python):**
- **Scope:** LLM response format validation
- **Location:** `tests/llm_prompt_testing/`
- **Purpose:**
  - Validate JSON response format
  - Test action parsing
  - Verify prompt templates
  - Test schema generation

**Unit Tests (TypeScript):**
- **Scope:** Individual components and functions
- **Approach:**
  - Test component rendering
  - Test user interactions
  - Test state changes
  - Mock external dependencies
- **Example:**
  ```typescript
  test('should render SliderField for ui_hint="slider"', () => {
    const param = { type: 'integer', default: 50, ui_hint: 'slider' };
    render(<ParameterField param={param} value={50} onChange={onChange} />);
    const slider = screen.container.querySelector('input[type="range"]');
    expect(slider).toBeInTheDocument();
  });
  ```

**Component Tests (TypeScript):**
- **Scope:** Full component behavior
- **Location:** `frontend/components/__tests__/`
- **Approach:**
  - Test component lifecycle
  - Test prop interactions
  - Test event handlers
  - Use `@testing-library/react` utilities

## Common Patterns

**Async Testing (Python):**
```python
@pytest.mark.asyncio
async def test_process_valid_response():
    result = await controller.process_response(...)
    assert result.success is True
```

**Async Testing (TypeScript):**
```typescript
test('async operation', async () => {
  render(<Component />);
  await waitFor(() => {
    expect(screen.getByText('Loaded')).toBeInTheDocument();
  });
});
```

**Error Testing (Python):**
```python
def test_invalid_action():
    with pytest.raises(ValueError, match="not in allowed set"):
        controller.process_response(invalid_json, ...)
```

**Error Testing (TypeScript):**
```typescript
test('displays error message', () => {
  render(<Component />);
  expect(screen.getByText(/error/i)).toBeInTheDocument();
});
```

**Parametrized Tests (Python):**
```python
@pytest.mark.parametrize("model", ["phi4-mini:latest", "qwen3:4b-instruct"])
def test_with_multiple_models(model):
    """Test same logic with different models."""
    client = create_client(model)
    # Test with client
```

**Fixture Composition (Python):**
```python
def test_with_multiple_fixtures(make_agent, mock_llm_client):
    """Test using factory fixtures."""
    agent = make_agent(name="TestAgent")
    result = await agent.act(mock_llm_client)
```

**Test Isolation (TypeScript):**
```typescript
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup(); // From @testing-library/react
});
```

**i18n Testing (TypeScript):**
```typescript
const wrapper = ({ children }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

test('translates text', () => {
  render(<Component />, { wrapper });
  expect(screen.getByText('Translated Text')).toBeInTheDocument();
});
```

## Test Data Management

**Python:**
- Use fixtures for reusable test data
- Factory pattern for object creation with variations
- Minimal test data (focus on test-specific values)
- Avoid large fixtures; use parameters for variation

**TypeScript:**
- Mock objects defined inline or in test setup
- Use factory functions for complex data
- Keep test data close to tests
- Use `vi.fn()` for function mocks

## CI/CD Testing

**Smoke Tests:**
- Located in `tests/smoke_tests/`
- Run full scenarios with Ollama
- Validate end-to-end behavior
- Generate output files for manual inspection

**Integration Tests:**
- Test complete workflows
- Use real LLM clients (when available)
- Test database operations
- Test API endpoints

**Test Execution Order:**
1. Unit tests (fast, isolated)
2. Integration tests (slower, more dependencies)
3. Smoke tests (slowest, require external services)

---

*Testing analysis: 2026-03-09*
