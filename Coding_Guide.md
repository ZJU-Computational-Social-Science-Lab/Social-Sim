# Claude Code Guidelines

## Project Structure

  This project uses:
  - *Backend*: Python 3.12
  - *Frontend*: TypeScript

  ## Environment Setup

  ### Python (Backend)
  - *Always use Python 3.12* for all backend code and scripts
  - Python 3.14 is not compatible with required packages

  ### Virtual Environment
  When working with Python, activate the virtual environment using:
  .\venv\Scripts\Activate.ps1
  $env:PYTHONPATH = "."

  ## Git Workflow

  ### Gitignore
  - Always check and update .gitignore appropriately
  - **Planning documents must be added to .gitignore** to keep them out of version control
  - Common items to ignore:
    - Planning documents (*.plan.md, planning/, plans/, etc.)
    - *Python/Backend:*
      - Virtual environment (venv/, .venv/)
      - Python cache (__pycache__/, *.pyc, *.pyo)
      - Build artifacts (dist/, build/, *.egg-info/)
    - *TypeScript/Frontend:*
      - Node modules (node_modules/)
      - Build output (dist/, build/, .next/, .nuxt/)
      - Package lock variations (package-lock.json if using yarn, or yarn.lock if using npm)
    - *General:*
      - IDE/Editor files (.vscode/, .idea/, *.swp)
      - Environment files (.env, .env.local, .env.*.local)
      - OS files (.DS_Store, Thumbs.db)
      - Log files (*.log)

  ### Branch Protection
  - **Never commit directly to main or develop branches**
  - These branches are protected and can only be updated via pull requests
  - If you find yourself on main or develop and need to make changes:
    1. Create a new feature branch first
    2. Switch to that branch
    3. Make your changes there

  ### Branch Naming
  - Feature branches: feature/descriptive-name
  - Bug fixes: fix/descriptive-name
  - Hotfixes: hotfix/descriptive-name

  ### Commit Messages
  - Use clear, descriptive commit messages
  - Format: type: brief description
  - Types: feat, fix, docs, style, refactor, test, chore
  - Example: feat: add user authentication endpoint

  ## Code Style

  ### File Headers (MANDATORY)
  *Every code file MUST start with a brief summary* — no exceptions. This is non-negotiable.

  The header must include:
  - *What* the file does (1-2 sentences)
  - *Why* it exists / its primary responsibility
  - *Key exports*: Classes, functions, or components (list them explicitly)

  *Python (Backend) Example:*
  """
  Simulation tree management for branching timelines.

  Provides the SimTree class for creating, branching, and navigating
  alternate simulation outcomes. Enables "what-if" exploration.

  Contains: SimTree class, SimTreeNode class, tree serialization helpers.
  """

  *TypeScript (Frontend) Example:*
  /**
   * Agent panel component for workspace view.
   *
   * Displays agent configuration, memory, and knowledge management.
   * Handles agent editing, document uploads, and RAG configuration.
   *
   * Exports: AgentPanel (default)
   */

  *Why this matters:* Without headers, every file requires reading the entire implementation to understand its
  purpose. This wastes time for both humans and AI assistants.

  ### File Size Limits

  *Keep files focused and reasonably sized:*

  | Type | Soft Limit | Hard Limit | Action Required |
  |------|-----------|------------|-----------------|
  | Python module | 300 lines | 500 lines | Split into multiple modules |
  | TypeScript component | 200 lines | 400 lines | Extract sub-components |
  | Single function/method | 50 lines | 100 lines | Break into helper functions |
  | Single class | 300 lines | 500 lines | Extract responsibilities |

  *When a file exceeds limits:*
  1. Identify distinct responsibilities
  2. Create new files for each responsibility
  3. Use composition/imports to connect them

  *Example refactoring triggers:*
  - agent.py at 538 lines → Split into agent.py, agent_thinking.py, agent_memory.py
  - simulator.py at 434 lines → Split into simulator.py, turn_management.py
  - Component with 400+ lines → Extract sub-components

  ### General Principles
  - Write clean, readable, and maintainable code
  - *Python*: Follow PEP 8 style guidelines
  - *TypeScript*: Follow consistent formatting (consider using Prettier/ESLint)
  - Use meaningful variable and function names
  - Keep functions focused and single-purpose
  - Leverage TypeScript's type system - avoid any types when possible

  ### Documentation
  - Add docstrings to all Python functions, classes, and modules
  - Use JSDoc comments for TypeScript functions and classes
  - Include type hints for Python function parameters and return values
  - Use TypeScript interfaces and types for all data structures
  - Comment complex logic or non-obvious implementations
  - Keep comments up-to-date with code changes

  ### File Organization
  - Group related functionality together
  - Keep files focused and reasonably sized (see limits above)
  - Use clear, descriptive file names
  - *One primary responsibility per file* — if you can't describe it in one sentence, split it

  ### Code Review Checklist (Before Every Commit)

  Before finalizing any code changes, verify:

  - [ ] *File header present* — Does the file start with a docstring/JSDoc explaining its purpose?
  - [ ] *File under size limits* — Is the file under 300 lines (soft) / 500 lines (hard)?
  - [ ] *Functions documented* — Do all public functions/methods have docstrings?
  - [ ] *Types annotated* — Are all parameters and return values typed?
  - [ ] *Single responsibility* — Does each function do one thing well?
  - [ ] *No deep nesting* — Is nesting limited to 3 levels max?

  ## Internationalization (i18n)

  *All user-facing text must be translatable between English and Chinese.*

  ### Core Rule: No Hardcoded Text
  - **NEVER** write hardcoded user-facing strings
  - **ALWAYS** use the `T()` function for any text the user sees
  - This includes: UI labels, error messages, notifications, LLM prompts, time/date formats

  ### Frontend (TypeScript)

  **Setup:** The frontend uses `i18next` with `react-i18next`.

  **Import and use:**
  ```typescript
  import { useTranslation } from 'react-i18next';

  function MyComponent() {
    const { t } = useTranslation();
    return <div>{t('dashboard.title')}</div>;
  }
  ```

  **Translation files:**
  - `frontend/locales/en.json` — English translations
  - `frontend/locales/zh.json` — Chinese translations

  **Key organization:**
  - Organize by feature/component: `dashboard.loading`, `agent.memory.label`, `error.auth.failed`
  - Use dot notation for nested structure
  - Keep keys descriptive and consistent

  **Examples:**
  ```json
  {
    "dashboard": {
      "title": "Dashboard",
      "loading": "Loading…",
      "error": "Unable to load simulations"
    },
    "agent": {
      "memory": {
        "label": "Memory",
        "empty": "No memories yet"
      }
    }
  }
  ```

  **Interpolation:**
  ```typescript
  t('welcome.user', { name: userName })
  // "Welcome, {{name}}" → "Welcome, Alice"
  ```

  ### Backend (Python)

  **Setup:** Python backend uses `gettext` for i18n.

  **Import and use:**
  ```python
  from socialsim4.i18n import T

  # Basic usage
  error_message = T('error.simulation.not_found')

  # With interpolation
  message = T('agent.joined', name=agent_name)
  ```

  **Translation files:**
  - `src/socialsim4/locales/en/LC_MESSAGES/socialsim4.po` — English
  - `src/socialsim4/locales/zh/LC_MESSAGES/socialsim4.po` — Chinese

  **Key organization:**
  - Same dot-notation convention as frontend
  - Error messages: `error.category.specific_error`
  - Status messages: `status.category.message`

  ### LLM Prompts

  **CRITICAL:** All agent prompts must be translatable. Agents should respond in the user's selected language.

  **Prompt templates in locale files:**
  ```json
  {
    "prompts": {
      "agent": {
        "system": "You are {{name}}. Your role is to {{role}}...",
        "actions": {
          "discuss": "Share your thoughts on {{topic}} with the group.",
          "vote": "Vote for {{option}} by responding with the option name."
        }
      }
    }
  }
  ```

  **Accessing prompts in code:**
  ```python
  from socialsim4.i18n import T

  def get_agent_prompt(agent_name, role, language='en'):
      return T('prompts.agent.system', name=agent_name, role=role)
  ```

  **Language detection:**
  - Detect user's language preference from frontend session
  - Pass language to backend via request header or API parameter
  - Apply language to LLM prompts for consistent agent responses

  ### When Adding New Content

  **Always:**
  1. Add English translation to `en.json` or `.po` file
  2. Add Chinese translation to `zh.json` or `.po` file
  3. Use `T('key')` in code — NEVER hardcode the string
  4. Test with both languages to verify

  **When finding existing hardcoded text:**
  1. Create translation key in both locale files
  2. Replace hardcoded string with `T('key')`
  3. Verify translations are accurate

  ### Common Patterns

  **Time/Date formatting:**
  ```typescript
  // Frontend: use i18next's format function
  {t('common.lastUpdated', { date: new Date(), formatParams: { date: { dateFormat: 'short' } } })}
  ```

  **Error messages:**
  ```typescript
  // Frontend
  toast.error(t(`error.${errorCode}`))

  // Backend
  return {"error": T(f'error.{error_code}')}
  ```

  **Pluralization:**
  ```json
  {
    "agent_count": "One agent",
    "agent_count_plural": "{{count}} agents"
  }
  ```
  ```typescript
  t('agent_count', { count: agents.length })
  ```

  ## Testing

  ### Test Coverage
  - Write tests for new features and bug fixes
  - Aim for high test coverage on critical paths
  - Run tests before committing changes

  ### Testing Frameworks
  - *Python*: Use pytest or unittest
  - *TypeScript*: Use Jest, Vitest, or your preferred testing framework

  ### Test Organization
  - *Backend*: Place Python tests in tests/ directory
  - *Frontend*: Place TypeScript tests alongside components or in __tests__/ directories
  - Mirror the structure of the main codebase
  - *Python*: Name test files with test_ prefix (e.g., test_auth.py)
  - *TypeScript*: Name test files with .test.ts or .spec.ts suffix (e.g., auth.test.ts)

  ## Dependencies

  ### Python (Backend)
  - Update requirements.txt when adding new dependencies
  - Pin version numbers for reproducibility
  - Document why specific versions are required if relevant

  *Installing Python Dependencies:*
  pip install -r requirements.txt

  ### TypeScript (Frontend)
  - Update package.json when adding new dependencies
  - Use npm install or yarn add to add packages
  - Commit package-lock.json or yarn.lock for consistent installs

  *Installing Frontend Dependencies:*
  npm install
  # or
  yarn install

  ## Error Handling

  **Core Philosophy (from AGENTS.md):**
  - **Eliminate defensive coding**: No try/except, no isinstance, no hasattr, no dynamic fallback branches
  - **Use strict input formats and fail fast**: Let exceptions surface
  - **No runtime type checks**: Rely on exact data shape produced elsewhere in the codebase
  - **Minimal abstractions**: Only create what's used now; no generalized error handling

  ### Where This Applies

  **Core Simulation Engine** (`src/socialsim4/core/`):
  - **NEVER** use try/except in core engine code
  - Actions access required fields directly (e.g., `action_data["x"]`)
  - Missing fields raise exceptions (fail fast)
  - No multiple formats or fallback branches

  **Example (CORRECT - AGENTS.md style):**
  ```python
  def handle_move_action(action_data, agent, simulator):
      # Direct access - fails fast if "location" is missing
      location = action_data["location"]
      return move_agent(agent, location)
  ```

  **Example (WRONG - defensive coding to avoid):**
  ```python
  def handle_move_action(action_data, agent, simulator):
      # DON'T DO THIS - defensive checks
      if not isinstance(action_data, dict):
          return error("Invalid action")
      location = action_data.get("location")
      if location is None:
          return error("Missing location")
      return move_agent(agent, location)
  ```

  ### Where Different Rules Apply

  **Backend API Layer** (`src/socialsim4/backend/`):
  - **MAY** use try/except for HTTP semantics (convert exceptions to HTTP responses)
  - **MAY** use try/except for external service calls (database, LLM API, etc.)

  **Frontend** (`frontend/`):
  - **MAY** use try/catch for API calls and async operations
  - **MAY** use try/catch for user input validation

  **General:**
  - Don't suppress exceptions without good reason
  - When using try/except is necessary, log errors appropriately

  ## Security

  - Never commit sensitive information (API keys, passwords, tokens)
  - Use environment variables for configuration
  - Validate and sanitize user inputs
  - Follow security best practices for the tech stack

  ## Performance

  - Consider performance implications for data-intensive operations
  - Profile code when optimizing
  - Document any performance-critical sections

  ## Before Creating a Pull Request

  *Code Quality Checklist:*
  - [ ] Every new file has a header docstring explaining its purpose
  - [ ] No file exceeds 500 lines (or has a very good reason)
  - [ ] All public functions have docstrings with parameter/return documentation
  - [ ] TypeScript: No any types without justification
  - [ ] Python: All functions have type hints

  *Functionality Checklist:*
  - [ ] Tests pass locally
  - [ ] New features have corresponding tests
  - [ ] Commit messages follow format: type: description

  *Security Checklist:*
  - [ ] No sensitive information in commits
  - [ ] User inputs are validated
  - [ ] Dependencies are up-to-date

  ## Additional Notes

  - When in doubt, ask questions or clarify requirements
  - Prefer simple, straightforward solutions over clever ones
  - Consider backwards compatibility when making changes

  ## Project-Specific Architecture Patterns

  ### Core Simulation System
  This project has a *simulation engine* with these key abstractions:

  - *Agent*: Autonomous AI entity with personality, memory, and actions
  - *Scene*: Environment that defines available actions and rules
  - *Action*: Individual behaviors agents can perform
  - *Simulator*: Orchestrator that manages the simulation loop
  - *SimTree*: Branching timeline structure for "what-if" exploration

  *Key principle:* Agents are isolated — they never know about the Simulator. All decisions flow from their context
   and scene feedback.

  ### Backend Structure
  src/socialsim4/
  ├── backend/     # Web API layer (Litestar routes, services, schemas)
  ├── core/        # Simulation engine (agents, scenes, actions, simulator)
  ├── experiment/  # A/B testing framework
  └── scenarios/   # Pre-built scenario configurations

  ### Frontend Structure
  frontend/
  ├── components/  # Reusable UI components
  ├── pages/       # Full page views
  ├── services/    # API client functions
  └── store/       # Zustand state management

  ### When Adding New Features

  1. *New agent behavior* → Add to core/actions/ as a new action class
  2. *New simulation type* → Add to core/scenes/ as a new scene class
  3. *New API endpoint* → Add to backend/api/routes/ with proper schema
  4. *New UI component* → Add to frontend/components/ with header doc

  ### Prototype vs Production Code

  This project follows a *prototype-first philosophy* but aims for clarity:

  ✅ *Do:*
  - Fail fast with clear error messages
  - Write self-documenting code with good naming
  - Add docstrings for public APIs

  ❌ *Don't:*
  - Skip file headers (always required)
  - Write deeply nested code (max 3 levels)
  - Create god classes that do everything

  ## Working With Existing Code

  *When modifying existing files that lack headers or exceed size limits:*

  1. *Add a header* — Even if you're only making a small change, add a proper file header if missing
  2. *Document new functions* — Any new functions you add should have full docstrings
  3. *Consider refactoring* — If a file is over 500 lines and you're making significant changes, propose splitting
  it

  *Example of improving existing code:*
  # Before (existing file with no header)
  from typing import List

  class LargeClass:
      def do_something(self):
          ...

  # After (your improvement)
  """
  LargeClass module for handling X operations.

  This module provides functionality for Y and Z.
  Consider refactoring into smaller modules if it grows further.

  Contains: LargeClass
  """
  from typing import List

  class LargeClass:
      """Handles X operations with Y capability."""

      def do_something(self):
          """Performs the X operation and returns Y."""
          ...
