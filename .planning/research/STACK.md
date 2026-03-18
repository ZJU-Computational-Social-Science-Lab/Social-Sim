# Technology Stack

**Project:** Social-Sim Bug Fixes & Game Features Milestone
**Researched:** 2026-03-18
**Overall confidence:** HIGH

## Executive Summary

This is a **brownfield project** — the stack is already established. Research confirms the existing technologies are current and appropriate for the required bug fixes and feature additions. No major stack changes are needed. Focus should be on:

1. **Testing infrastructure** — Full stack testing for bug validation
2. **i18n completion** — Extending existing JSON-based translation system
3. **Game mechanics** — Using existing simulation engine patterns

## Recommended Stack

### Core Framework (Existing)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Python** | 3.12 | Backend runtime | Required by project; 3.14 incompatible with dependencies |
| **Litestar** | >=2.8.3 | Web framework | Modern async framework, already integrated |
| **Pydantic** | >=2.4.2 | Data validation | Type-safe schemas, already integrated |
| **SQLAlchemy** | >=2.0.23 | Database ORM | Async support, already integrated |
| **React** | 19.2.0 | Frontend UI | Latest stable, already integrated |
| **TypeScript** | ~5.8.2 | Frontend typing | Type safety, already integrated |
| **Vite** | 6.2.0 | Build tool | Fast dev server, already integrated |

### Testing Infrastructure (Critical for Bug Fixes)

| Technology | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **pytest** | (existing) | Backend test runner | All backend testing |
| **pytest-asyncio** | (add if missing) | Async test support | For testing async scene methods |
| **Vitest** | 4.0.18 | Frontend test runner | All frontend testing (already in package.json) |
| **@testing-library/react** | 16.3.2 | Component testing | UI component testing |
| **@testing-library/user-event** | 14.6.1 | User interaction simulation | Realistic user behavior testing |

**Confidence:** HIGH — These are standard, current tools for the respective frameworks.

### Internationalization (i18n)

| Technology | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **i18next** | 25.7.1 | Frontend i18n framework | Already integrated |
| **react-i18next** | 16.3.5 | React i18n bindings | Already integrated |
| **Custom JSON system** | (existing) | Backend i18n via `i18n.py` | Use existing T() function for all backend strings |
| **gettext** | (built-in) | Python standard library | NOT recommended — use existing JSON system instead |

**Confidence:** HIGH — Frontend uses industry-standard i18next. Backend has custom JSON system that mirrors frontend structure.

### Game Theory Mechanics

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Simulation Engine** | `src/socialsim4/core/` | Existing agent/scene/action system |
| **Experiment Runner** | `src/socialsim4/core/experiment/` | Round execution, payoff calculation |
| **Game Configs** | `src/socialsim4/core/experiment/game_configs.py` | Payoff matrices, rules |
| **Scenario Registry** | `src/socialsim4/core/scenarios/registry.py` | Game metadata, parameters |

**Confidence:** HIGH — Existing architecture already supports Public Goods Game and Coordination Game. New features extend this pattern.

## Installation

### Backend Dependencies (Additions Only)

```bash
# Testing - add if not present
pip install pytest pytest-asyncio pytest-cov

# No new runtime dependencies needed for features
```

### Frontend Dependencies (Additions Only)

```bash
# Already present in package.json:
# - vitest: 4.0.18
# - @testing-library/react: 16.3.2
# - @testing-library/user-event: 14.6.1
# - i18next: 25.7.1
# - react-i18next: 16.3.5

# No new installations needed
```

## Implementation-Specific Stack

### FEAT-01: Public Goods Game Punishment

**What to add:**
- New parameter in `PUBLIC_GOODS` scenario registry entry
- Extension to payoff calculation in `ExperimentRunner`
- New translation keys in `locales/en.json` and `locales/zh.json`

**No new libraries required** — uses existing:
- `GameConfig` for parameter passing
- `ExperimentState` for tracking punishment history
- Custom payoff calculation (extend existing pool mechanism)

**Confidence:** HIGH — Pattern exists for extending game parameters.

### FEAT-02: Coordination Game Blind Choice Mode

**What to add:**
- Toggle parameter in `COORDINATION_GAME` scenario registry
- UI toggle component (using existing Radix UI components)
- Conditional context filtering in `ExperimentRunner`

**No new libraries required** — uses existing:
- Radix UI for form controls
- Existing visibility/information model system

**Confidence:** HIGH — Interaction mode parameter already exists in registry schema.

### BUG-01/BUG-06: Context & Voting Constraints

**Stack approach:**
- Extend existing `context_builder.py` for context inheritance
- Add stage validation in backend routes
- Add frontend validation for UI forms

**No new libraries required** — uses existing validation patterns.

**Confidence:** HIGH — Validation patterns exist in codebase.

### BUG-07: Token Endowment Enforcement

**Stack approach:**
- Add validation in `ExperimentScene._initialize_state()`
- Add runtime check in action execution
- Use Pydantic for parameter validation

**No new libraries required** — Pydantic already integrated.

**Confidence:** HIGH — Pydantic validation pattern exists for all action parameters.

### I18N-01: Full i18n Audit

**Frontend approach:**
- Use existing `i18next` + `react-i18next`
- Add missing keys to `frontend/locales/en.json` and `frontend/locales/zh.json`
- Replace hardcoded strings with `t('key')` calls

**Backend approach:**
- Use existing `T()` function from `i18n.py`
- Add keys to `src/socialsim4/locales/en.json` and `zh.json`
- Replace f-strings with `T('key', var=value)` calls

**No new libraries required** — systems already in place.

**Confidence:** HIGH — Both systems are functional and follow best practices.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Backend i18n | Custom JSON system (existing) | Python gettext | gettext requires .po/.mo compilation, harder for non-developers to edit. JSON matches frontend structure for consistency |
| Frontend testing | Vitest + RTL | Jest + RTL | Vitest is faster, integrated with Vite, already in package.json |
| Async testing | pytest-asyncio | AnyIO | pytest-asyncio is pytest standard, simpler fixture handling |
| State management | Zustand (existing) | Redux Toolkit | Zustand is simpler, already integrated, no need to migrate |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Python 3.14** | Incompatible with current dependencies (verified in requirements.txt) | Python 3.12 |
| **gettext for backend** | Requires .po/.mo compilation, adds tooling complexity | Existing JSON system in `i18n.py` |
| **New state management** | Zustand already works, migration is scope creep | Existing Zustand stores |
| **New UI libraries** | Radix UI + Tailwind already integrated | Existing component patterns |
| **Complex mocking libraries** | pytest.mock and vi.mock() sufficient for this scope | Built-in mocking |

## Testing Strategy by Bug/Feature

| Item | Backend Test | Frontend Test | Notes |
|------|--------------|---------------|-------|
| BUG-01: Context inheritance | pytest async test of multi-round context | — | Verify previous round content appears in follow-up prompts |
| BUG-02: Max Rounds removal | — | Vitest component test | Verify field removed from UI |
| BUG-03: Session loss | pytest integration test | — | Test session persistence during advance_node |
| BUG-04: SimTree disappearing | pytest + Docker test | — | Requires Docker environment |
| BUG-05: Duplicate broadcasts | pytest websocket test | Vitest event test | Verify deduplication logic |
| BUG-06: Voting stage retry | pytest route test | Vitest form test | Test constraint enforcement |
| BUG-07: Token enforcement | pytest action test | Vitest form test | Test validation logic |
| FEAT-01: Punishment | pytest payoff calculation | Vitest parameter UI | Test punishment parameter flow |
| FEAT-02: Blind choice | pytest visibility test | Vitest toggle UI | Test simultaneous vs sequential modes |
| I18N-01: Full audit | pytest translation test | Vitest i18n test | Verify all keys exist in both languages |

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Python 3.12 | All current dependencies | Do NOT upgrade to 3.14 |
| Litestar 2.8.3+ | SQLAlchemy 2.0+ | Async patterns require SA 2.0 |
| Pydantic 2.4+ | Litestar 2.8.3+ | Type validation integration |
| React 19.2.0 | i18next 25.7+ | Both current versions |
| Vitest 4.0+ | React Testing Library 16.3+ | Coordinated versions in package.json |

## Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **pytest** | Backend testing | Add `pytest-asyncio` for async tests |
| **pytest-cov** | Coverage reports | Optional but recommended for bug fix validation |
| **Vitest** | Frontend testing | Already configured with UI mode |
| **Vitest UI** | Visual test runner | Use `npm run test:ui` |
| **TypeScript 5.8** | Type checking | Strict mode already enabled |

## Sources

- **Existing codebase analysis** — HIGH confidence
  - `requirements.txt` — Verified all current backend dependencies
  - `package.json` — Verified all current frontend dependencies
  - `src/socialsim4/core/experiment/scene.py` — Game execution architecture
  - `src/socialsim4/i18n.py` — Backend i18n implementation
  - `src/socialsim4/locales/en.json` — Translation structure

- **Documentation verification** — HIGH confidence
  - Litestar 2.8+ documentation confirms async patterns
  - pytest-asyncio documentation for async test fixtures
  - i18next 25.x documentation for React integration
  - Vitest 4.x documentation for testing patterns

---
*Stack research for: Social-Sim Bug Fixes & Game Features Milestone*
*Researched: 2026-03-18*
