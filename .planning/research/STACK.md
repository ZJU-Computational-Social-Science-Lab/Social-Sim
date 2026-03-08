# Technology Stack

**Project:** Social-Sim Contagion Spread Framework
**Researched:** 2026-03-08
**Focus:** Stack additions for contagion/spread modeling on grid-based agents

## Executive Summary

**NO NEW EXTERNAL DEPENDENCIES REQUIRED.** The contagion framework can be built entirely using Python's standard library and existing infrastructure. The project already has GridMechanic, a robust agent system, action framework, and all necessary utilities. Adding state machine libraries or epidemiological packages would increase complexity without meaningful benefit for this use case.

### Key Decision: Minimal Dependencies Philosophy

- **Use Python standard library** for random, probability, and state management
- **Build on existing GridMechanic** for spatial operations and adjacency
- **Create lightweight contagion-specific classes** rather than generic frameworks
- **Leverage existing action system** for speak/move behaviors

This approach maintains consistency with the project's prototype-first philosophy while keeping the codebase maintainable.

---

## Recommended Additions

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Python standard library** | Built-in | State management, probability, random | `random` module sufficient for probabilistic rules |
| **Existing GridMechanic** | Current | Grid positioning, movement, adjacency | Already provides GameMap, Tile, coordinates |
| **Existing action system** | Current | Agent behaviors (speak, move) | Extend with SpeakAction for targeted communication |
| **Pydantic** | ^2.4.2 (existing) | Config validation for contagion rules | Already in stack, validates rule definitions |

### State Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Python Enum** | Built-in | State representation (SUSCEPTIBLE, INFECTED, etc.) | Type-safe, readable, self-documenting |
| **Python dataclasses** | Built-in | Agent state containers | Minimal boilerplate, integrates with Pydantic |

### Probability & Randomness

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **random module** | Built-in | Probabilistic transitions | `random.random()` for all probability checks |
| **Existing random usage** | Current | Consistent with codebase patterns | Project already uses `random` module throughout |

---

## What NOT to Add

### Epidemiological Libraries

**DO NOT ADD:**
- `ndlib` (Network Diffusion Library) — Designed for network graphs, not grid-based agent systems
- `EpiModel` — R package, not Python
- `epydemic` — Network-focused, overkill for agent grid
- `SIRModels/PyRoss` — Differential equation models, not agent-based

**Why:** These libraries solve different problems (mathematical compartmental models on networks). Our contagion model is agent-based with LLM decision-making, not equation-based.

### State Machine Libraries

**DO NOT ADD:**
- `transitions` — Adds dependency for simple state transitions
- `state-machine` — Overkill for enum-based states
- `automachine` — Unnecessary abstraction

**Why:** Contagion states are simple enums (SUSCEPTIBLE → INFECTED → RECOVERED). Python's built-in `Enum` and `if` statements are clearer and maintainable. External state machine libraries add complexity for linear state transitions.

### Grid/Spatial Libraries

**DO NOT ADD:**
- `numpy` — No numerical operations requiring arrays
- `scipy.ndimage` — No image processing or advanced grids
- `pygame` — Visualization only, not simulation logic

**Why:** The existing GameMap class already handles sparse grids, coordinates, and locations. Contagion spread only needs adjacency checks (distance calculation), which GameMap or simple coordinate math provides.

---

## Implementation Strategy

### 1. State Representation (Standard Library)

```python
from enum import Enum

class ContagionState(Enum):
    SUSCEPTIBLE = "susceptible"
    INFECTED = "infected"
    RECOVERED = "recovered"
    DECEASED = "deceased"
```

### 2. Transition Rules (Dataclasses + Pydantic)

```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class StateTransition:
    """Probabilistic transition between contagion states."""
    from_state: ContagionState
    to_state: ContagionState
    probability: float  # 0.0 to 1.0
    requires_contact: bool = True
    decay_turns: Optional[int] = None
```

### 3. Probabilistic Checks (Standard Library)

```python
import random

def check_transition(probability: float) -> bool:
    """Check if a probabilistic transition occurs."""
    return random.random() < probability
```

### 4. Grid Adjacency (Existing Infrastructure)

```python
# Use existing GridMechanic's GameMap
# Calculate Manhattan distance for adjacency
def is_adjacent(pos1: tuple[int, int], pos2: tuple[int, int]) -> bool:
    x1, y1 = pos1
    x2, y2 = pos2
    return abs(x1 - x2) + abs(y1 - y2) <= 1  # Including diagonals: use max(abs(x1-x2), abs(y1-y2)) <= 1
```

### 5. Speak Action (Extend Existing Actions)

```python
# Add to core/actions/contagion_actions.py
# Inherits from existing Action base class
class SpeakAction(Action):
    """Targeted communication for contagion spread."""
    # Use existing action framework, add target_agent parameter
```

---

## Integration with Existing Stack

### Backend Architecture (No Changes)

```
src/socialsim4/
├── core/
│   ├── actions/
│   │   └── contagion_actions.py      # NEW: SpeakAction
│   ├── mechanics/
│   │   └── contagion_mechanic.py     # NEW: StateTransition, rules
│   └── scenes/
│       └── contagion_scene.py        # NEW: GridScene + ContagionMechanic
├── backend/
│   └── api/routes/
│       └── contagion.py              # NEW: Scenario configuration endpoints
```

### Dependencies

**No new pip installs required.** All functionality uses:

1. **Existing dependencies** (from pyproject.toml):
   - `pydantic ^2.4.2` — Rule configuration validation
   - `litestar ^2.8.3` — API endpoints for scenario config
   - SQLAlchemy — Persist simulation results

2. **Python standard library**:
   - `enum` — State definitions
   - `random` — Probabilistic transitions
   - `dataclasses` — State containers
   - `typing` — Type hints

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| State management | Python Enum | `transitions` library | Adds dependency for simple linear transitions |
| Probability | `random` module | `numpy.random` | No array operations needed |
| Epidemiology | Custom implementation | `ndlib`, `epydemic` | Wrong paradigm (network graphs vs agent grid) |
| Grid operations | Existing GameMap | `scipy.ndimage` | No image processing, adjacency is simple math |

---

## Configuration Example

Using existing Pydantic settings pattern:

```python
from pydantic import BaseModel, Field
from typing import Dict, List

class ContagionConfig(BaseModel):
    """Configuration for contagion simulation rules."""

    # States
    initial_state: ContagionState = ContagionState.SUSCEPTIBLE
    patient_zero_fraction: float = Field(default=0.05, ge=0, le=1)

    # Transition probabilities
    transmission_probability: float = Field(default=0.3, ge=0, le=1)
    recovery_probability: float = Field(default=0.1, ge=0, le=1)
    mortality_probability: float = Field(default=0.01, ge=0, le=1)

    # Spatial rules
    infection_distance: int = Field(default=1, ge=1)  # Adjacent tiles
    require_visibility: bool = True  # Must see target to infect

    # Decay rules
    recovery_turns_range: tuple[int, int] = (7, 14)
    immunity_duration: Optional[int] = None  # None = permanent
```

---

## Installation

### No New Dependencies

```bash
# Existing environment setup (already done)
# Just add new files to codebase

# Backend (no changes)
pip install -r requirements.txt

# Frontend (no changes)
cd frontend && npm install
```

### Development Setup

```bash
# Activate virtual environment
.\\venv\\Scripts\\Activate.ps1
$env:PYTHONPATH = "."

# No new packages needed
```

---

## Version Compatibility

| Component | Version Required | Already Installed | Compatible |
|-----------|------------------|-------------------|------------|
| Python | 3.11+ | 3.12 | Yes |
| Pydantic | ^2.4.2 | ^2.4.2 | Yes |
| Litestar | ^2.8.3 | ^2.8.3 | Yes |
| Enum | Built-in (3.4+) | Built-in | Yes |
| dataclasses | Built-in (3.7+) | Built-in | Yes |
| random | Built-in | Built-in | Yes |

---

## Rationale Summary

### Why No External Dependencies?

1. **Simplicity**: Contagion rules are straightforward probability checks
2. **Maintainability**: Fewer dependencies = fewer breaking changes
3. **Consistency**: Uses same patterns as existing mechanics (GridMechanic, VotingMechanic)
4. **Performance**: Python's `random` is fast enough for agent-based simulations
5. **Flexibility**: Custom implementation allows LLM integration, network effects, hidden states

### When to Reconsider

**Add dependencies if:**
- Need complex spatial queries (consider `scipy.spatial`)
- Require high-performance array operations (consider `numpy`)
- Want mathematical compartmental models (consider `SIRModels`)

**Current requirements don't justify these.**

---

## Sources

### Official Documentation
- Python `enum` module: https://docs.python.org/3/library/enum.html
- Python `dataclasses`: https://docs.python.org/3/library/dataclasses.html
- Python `random`: https://docs.python.org/3/library/random.html
- Pydantic 2.4: https://docs.pydantic.dev/latest/

### Existing Infrastructure Analysis
- GridMechanic implementation: `src/socialsim4/templates/mechanics/grid_mechanic.py`
- GameMap class: `src/socialsim4/core/scenes/village_scene.py`
- Action base classes: `src/socialsim4/core/action.py`
- Current dependencies: `pyproject.toml`

### LOW Confidence Sources (training data only - not verified)
- **ndlib**: Mentioned as network diffusion library (NOT suitable for grid agents)
- **transitions**: Popular Python state machine library (unnecessary for enum states)

**Note:** Web search for epidemiological libraries was inconclusive due to rate limits. However, based on domain knowledge, epidemiological packages focus on mathematical compartmental models (SIR/SEIR differential equations) or network-based diffusion, which are different paradigms from LLM-driven agent-based grid simulations.
