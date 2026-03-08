# Phase 1: Core Infrastructure - Research

**Researched:** 2026-03-08
**Domain:** Contagion state tracking, rule engine, grid positioning, hidden state semantics
**Confidence:** HIGH

## Summary

Phase 1 establishes the foundation layer for contagion spread simulation: agent state tracking via enums and properties, a declarative rule engine for state transitions, grid-based positioning using existing GameMap infrastructure, and hidden state semantics where agents know their own state but infer others' states from behavior.

The implementation leverages existing patterns extensively: Scene inheritance with hooks (`pre_run`, `post_turn`), Agent.properties for state storage, GameMap for grid operations, and `simulator.emit_event_later()` for WebSocket statistics delivery. No external dependencies are needed - the contagion framework uses only Python standard library (enum, dataclasses, random).

**Primary recommendation:** Extend VillageScene pattern for grid integration, add ContagionScene with pre_turn_rules hook, implement rule evaluation as scene-level logic (not agent-level), and emit statistics via existing WebSocket infrastructure.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**State Representation:**
- Enum-only approach - ContagionState is a simple enum (SUSCEPTIBLE, INFECTED, RECOVERED, EXPOSED, etc.)
- State stored in `agent.properties["contagion_state"]` as string matching enum value
- No metadata on states themselves - simplicity for v1.0
- Turns-since-infection tracked separately in `agent.properties["contagion_turns"]` (for decay evaluation)

**Rule Evaluation Timing:**
- Pre-turn phase - Rules evaluated before any agent acts each turn
- Scene's `pre_run()` hook fires once at simulation start (initial state setup)
- New scene method `pre_turn_rules()` fires at start of each turn before agents act
- Clean separation: state changes happen deterministically before agent decision-making

**Statistics & Logging:**
- Counts + Event log - Both aggregate counts and detailed transition events
- Counts: Current number of agents per state (e.g., {"SUSCEPTIBLE": 5, "INFECTED": 3})
- Event log: Each transition records timestamp (turn number), agent_id, from_state, to_state, trigger_type
- Statistics exposed via WebSocket events (`contagion_stats` event type)
- Event log queryable for experiment analysis

**Initial Agent Placement:**
- Random placement with configuration - Agents placed at random unoccupied cells
- Config option: `initial_infected_count` or `initial_infected_ratio` to seed some agents as INFECTED
- Infected agents selected randomly from population
- Grid size configurable (default 20x20 to match VillageScene pattern)

**Hidden State Semantics:**
- Agent's own state visible in their context prompt ("You are currently INFECTED")
- Other agents' states NOT visible - only agent IDs shown in neighbor list
- Frontend sees true states for all agents (observer mode)
- No inference logic in Phase 1 - agents learn through communication only (Phase 2)

### Claude's Discretion

- Exact ContagionState enum values (start with SUSCEPTIBLE, INFECTED, RECOVERED; add EXPOSED if needed)
- StateTransition dataclass field names and validation
- Statistics event payload structure
- Grid default size and boundary behavior

### Deferred Ideas (OUT OF SCOPE)

- Observable behaviors (coughing when infected) - v2 feature for richer inference
- YAML configuration for rules - v2 feature for experiment flexibility
- Grid heatmap visualization - v2 frontend enhancement
- Spatial indexing for O(1) adjacency - performance optimization if needed

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CORE-01 | System defines ContagionState enum for agent infection states | Standard Stack: Python enum module, follow CouncilPhase pattern from phase_controller.py |
| CORE-02 | System provides StateTransition dataclass for defining state change rules | Standard Stack: Python dataclasses, follow LLMConfig/EnvironmentConfig patterns |
| CORE-03 | System tracks contagion state per agent in agent.properties | Architecture: Agent.properties already used for hunger/energy/inventory in VillageScene |
| CORE-04 | Scene evaluates transition rules each turn before agents act | Architecture: Add pre_turn_rules() method to ContagionScene, called in run loop before agent.process() |
| CORE-05 | System maintains statistics: count of agents per state, transition events log | Architecture: Scene.state dict for counts, list for events, emit via emit_event_later() |
| CORE-06 | Scene exposes current statistics to frontend via WebSocket events | Architecture: Use simulator.emit_event_later("contagion_stats", {...}) pattern |
| GRID-01 | Agents are positioned on a 2D grid using existing GameMap infrastructure | Architecture: Extend VillageScene pattern, reuse GameMap class directly |
| GRID-02 | Agents can see adjacent cells (Moore neighborhood: 8 surrounding cells) | Architecture: GameMap.neighbors() exists for 4-directional; extend for 8-directional Moore neighborhood |
| GRID-03 | Agent context includes list of nearby agents (IDs only, not their states) | Architecture: New method to query agents at adjacent cells, return names only |
| GRID-04 | Grid is open (no obstacles for v1.0) | Architecture: Default Tile(passable=True) for all cells, no blocking terrain |
| HIDE-01 | Agent states are hidden from other agents (no direct state observation) | Architecture: get_agent_status_prompt() shows own state, neighbor query returns IDs only |
| HIDE-02 | Agents infer other agents' states from behavior and communication only | Architecture: No implementation needed in Phase 1 - this is emergent from HIDE-01 + Phase 2 communication |
| HIDE-03 | Frontend displays true agent states to user (for simulation monitoring) | Architecture: contagion_stats event includes all agent states for frontend rendering |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| enum (stdlib) | Python 3.11+ | ContagionState enum definition | Native Python, used in existing codebase (CouncilPhase) |
| dataclasses (stdlib) | Python 3.11+ | StateTransition rule definition | Native Python, used in 15+ places in codebase |
| random (stdlib) | Python 3.11+ | Probability checks for transitions | Native Python, no numpy needed for simple probability |

### Supporting (Existing Infrastructure)
| Library | Purpose | When to Use |
|---------|---------|-------------|
| GameMap | Grid positioning, adjacency queries | Direct reuse - already has width, height, tiles, locations, neighbors(), get_location_at(), is_passable(), in_bounds() |
| VillageScene | Grid scene pattern | Inherit from for grid integration, map_xy property pattern |
| Agent.properties | Per-agent state storage | Store contagion_state and contagion_turns |
| simulator.emit_event_later() | WebSocket events | Emit contagion_stats events |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| stdlib enum | pydantic enum | Overkill - no validation needed for simple states |
| stdlib dataclasses | pydantic BaseModel | Overkill - rules are internal, not API-bound |
| GameMap | Custom grid class | Reinventing - GameMap has all needed features |
| VillageScene | Scene base class | VillageScene already has grid integration, serialization |

**Installation:**
```bash
# No new dependencies required - all stdlib or existing infrastructure
```

## Architecture Patterns

### Recommended Project Structure
```
src/socialsim4/
├── core/
│   ├── contagion/              # NEW: Contagion framework
│   │   ├── __init__.py
│   │   ├── states.py           # ContagionState enum
│   │   ├── rules.py            # StateTransition dataclass, rule evaluation
│   │   └── statistics.py       # Statistics tracking, event logging
│   └── scenes/
│       └── contagion_scene.py  # NEW: ContagionScene extending Scene/VillageScene
```

### Pattern 1: ContagionState Enum
**What:** Simple enum for agent contagion states
**When to use:** Defining the set of possible states for the simulation
**Example:**
```python
# Source: Follows CouncilPhase pattern from phase_controller.py
from enum import Enum

class ContagionState(str, Enum):
    """Contagion states for agents in the simulation."""
    SUSCEPTIBLE = "susceptible"
    INFECTED = "infected"
    RECOVERED = "recovered"
    EXPOSED = "exposed"  # Optional for SEIR models
```

### Pattern 2: StateTransition Dataclass
**What:** Declarative rule definition for state changes
**When to use:** Defining transition rules (will be evaluated by scene)
**Example:**
```python
# Source: Follows LLMConfig/EnvironmentConfig dataclass patterns
from dataclasses import dataclass
from typing import Optional
from .states import ContagionState

@dataclass
class StateTransition:
    """Rule for transitioning between contagion states."""
    from_state: ContagionState
    to_state: ContagionState
    trigger_type: str  # "proximity", "action", "decay"
    probability: float  # 0.0 to 1.0
    decay_turns: Optional[int] = None  # For decay-based transitions

    def __post_init__(self):
        if not 0.0 <= self.probability <= 1.0:
            raise ValueError(f"probability must be 0.0-1.0, got {self.probability}")
```

### Pattern 3: ContagionScene with pre_turn_rules Hook
**What:** Scene that evaluates rules before agents act
**When to use:** Orchestrating state transitions in the simulation loop
**Example:**
```python
# Source: Extends Scene/VillageScene patterns
from socialsim4.core.scenes.village_scene import VillageScene, GameMap
from socialsim4.core.simulator import Simulator

class ContagionScene(VillageScene):
    TYPE = "contagion_scene"

    def __init__(
        self,
        name: str,
        initial_event: str,
        game_map: GameMap,
        rules: list[StateTransition],
        initial_infected_count: int = 1,
        **kwargs
    ):
        super().__init__(name, initial_event, game_map, **kwargs)
        self.rules = rules
        self.initial_infected_count = initial_infected_count
        # Statistics tracking
        self.state["contagion_stats"] = {}  # {state: count}
        self._transition_log = []  # List of transition events

    def pre_run(self, simulator: Simulator):
        """Initialize agent states at simulation start."""
        super().pre_run(simulator)
        # Set initial states
        agents = list(simulator.agents.values())
        # Random selection for initial infected
        import random
        infected = random.sample(agents, min(self.initial_infected_count, len(agents)))
        for agent in agents:
            if agent in infected:
                agent.properties["contagion_state"] = ContagionState.INFECTED.value
                agent.properties["contagion_turns"] = 0
            else:
                agent.properties["contagion_state"] = ContagionState.SUSCEPTIBLE.value
                agent.properties["contagion_turns"] = 0
        self._update_statistics(simulator)

    def pre_turn_rules(self, simulator: Simulator):
        """Evaluate transition rules before agents act."""
        # Decay-based transitions
        for agent in simulator.agents.values():
            self._evaluate_decay_rules(agent, simulator)
        # Update and emit statistics
        self._update_statistics(simulator)

    def _evaluate_decay_rules(self, agent, simulator):
        """Check decay-based transitions for an agent."""
        current_state = ContagionState(agent.properties["contagion_state"])
        turns = agent.properties.get("contagion_turns", 0)

        for rule in self.rules:
            if rule.trigger_type != "decay":
                continue
            if rule.from_state != current_state:
                continue
            if turns >= rule.decay_turns:
                self._apply_transition(agent, rule, simulator)
                break

    def _apply_transition(self, agent, rule, simulator):
        """Apply a state transition and log it."""
        from_state = agent.properties["contagion_state"]
        agent.properties["contagion_state"] = rule.to_state.value
        agent.properties["contagion_turns"] = 0
        # Log the transition
        event = {
            "turn": simulator.turns,
            "agent_id": agent.name,
            "from_state": from_state,
            "to_state": rule.to_state.value,
            "trigger_type": rule.trigger_type,
        }
        self._transition_log.append(event)

    def _update_statistics(self, simulator):
        """Count agents per state and emit to frontend."""
        counts = {}
        for state in ContagionState:
            counts[state.value] = 0
        for agent in simulator.agents.values():
            state = agent.properties.get("contagion_state", ContagionState.SUSCEPTIBLE.value)
            counts[state] = counts.get(state, 0) + 1
        self.state["contagion_stats"] = counts
        # Emit to frontend
        simulator.emit_event_later("contagion_stats", {
            "counts": counts,
            "agent_states": {
                name: agent.properties.get("contagion_state")
                for name, agent in simulator.agents.items()
            },
        })

    def get_moore_neighbors(self, x: int, y: int) -> list[tuple[int, int]]:
        """Get 8-directional Moore neighborhood coordinates."""
        neighbors = []
        for dx in [-1, 0, 1]:
            for dy in [-1, 0, 1]:
                if dx == 0 and dy == 0:
                    continue
                nx, ny = x + dx, y + dy
                if self.game_map.in_bounds(nx, ny):
                    neighbors.append((nx, ny))
        return neighbors

    def get_adjacent_agents(self, agent_name: str, simulator: Simulator) -> list[str]:
        """Get names of agents in adjacent cells (Moore neighborhood)."""
        agent = simulator.agents[agent_name]
        xy = agent.properties.get("map_xy")
        if not xy:
            return []
        neighbors = self.get_moore_neighbors(xy[0], xy[1])
        adjacent_names = []
        for other in simulator.agents.values():
            if other.name == agent_name:
                continue
            other_xy = other.properties.get("map_xy")
            if other_xy and tuple(other_xy) in neighbors:
                adjacent_names.append(other.name)
        return adjacent_names

    def serialize_config(self) -> dict:
        return {
            **super().serialize_config(),
            "rules": [
                {
                    "from_state": r.from_state.value,
                    "to_state": r.to_state.value,
                    "trigger_type": r.trigger_type,
                    "probability": r.probability,
                    "decay_turns": r.decay_turns,
                }
                for r in self.rules
            ],
            "initial_infected_count": self.initial_infected_count,
        }
```

### Pattern 4: Integration with Simulator Run Loop
**What:** Call pre_turn_rules before each agent acts
**When to use:** Modifying Simulator.run() to support rule evaluation
**Example:**
```python
# Source: Modification to simulator.py run() method
# Add after line 343 (after status_prompt, before should_skip_turn check):

# In Simulator.run(), after getting status prompt:
if hasattr(self.scene, 'pre_turn_rules'):
    self.scene.pre_turn_rules(self)
```

### Anti-Patterns to Avoid
- **Don't put rule evaluation in Agent.process()** - Agents should remain isolated from simulation mechanics
- **Don't use try/except in rule evaluation** - Fail fast per AGENTS.md philosophy for core engine
- **Don't create custom grid class** - Reuse GameMap, it has all needed functionality
- **Don't emit statistics on every transition** - Batch emit once per turn via pre_turn_rules

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Grid positioning | Custom coordinate tracking | GameMap + agent.properties["map_xy"] | GameMap has neighbors(), in_bounds(), serialization |
| State storage | Custom agent wrapper | Agent.properties dict | Already used for hunger/energy/inventory |
| Event emission | Custom WebSocket logic | simulator.emit_event_later() | Existing infrastructure, frontend already subscribes |
| Scene serialization | Custom serialize/deserialize | serialize_config()/deserialize_config() hooks | Follows established pattern |

**Key insight:** The existing codebase has all infrastructure needed. Phase 1 is primarily about orchestration and naming conventions, not new abstractions.

## Common Pitfalls

### Pitfall 1: Moore Neighborhood vs Von Neumann
**What goes wrong:** Using 4-directional neighbors when 8-directional is specified
**Why it happens:** GameMap.neighbors() returns 4-directional (von Neumann neighborhood)
**How to avoid:** Implement get_moore_neighbors() that includes diagonals
**Warning signs:** Agents can't see diagonally adjacent agents, transmission misses expected pairs

### Pitfall 2: State Desynchronization
**What goes wrong:** Agent properties and statistics disagree on state counts
**Why it happens:** Statistics updated in wrong place (e.g., only on transitions, not initialization)
**How to avoid:** Always call _update_statistics() after any state change, including pre_run initialization
**Warning signs:** Frontend shows wrong counts, transitions don't match logs

### Pitfall 3: Missing pre_turn_rules Call
**What goes wrong:** Decay rules never fire, agents stuck in states
**Why it happens:** Forgot to call pre_turn_rules in simulator run loop
**How to avoid:** Add check `if hasattr(self.scene, 'pre_turn_rules')` in Simulator.run() before agent acts
**Warning signs:** Agents never transition to RECOVERED, simulation stalls

### Pitfall 4: Enum vs String Confusion
**What goes wrong:** Comparing ContagionState enum to string, always fails
**Why it happens:** Agent.properties stores string value, not enum
**How to avoid:** Always use `.value` when storing, wrap with ContagionState() when comparing
**Warning signs:** State checks never match, all agents appear SUSCEPTIBLE

## Code Examples

### Complete ContagionState Enum
```python
# src/socialsim4/core/contagion/states.py
"""
Contagion state definitions for simulation agents.

Defines the ContagionState enum representing possible infection states
in the contagion spread framework.

Contains: ContagionState
"""
from enum import Enum

class ContagionState(str, Enum):
    """Contagion states for agents in the simulation.

    SUSCEPTIBLE: Agent can be infected
    EXPOSED: Agent has been exposed but not yet infectious (SEIR models)
    INFECTED: Agent is infected and can spread contagion
    RECOVERED: Agent has recovered and is immune
    """
    SUSCEPTIBLE = "susceptible"
    EXPOSED = "exposed"
    INFECTED = "infected"
    RECOVERED = "recovered"
```

### Complete StateTransition Dataclass
```python
# src/socialsim4/core/contagion/rules.py
"""
State transition rule definitions for contagion framework.

Provides the StateTransition dataclass for declarative rule specification
and rule evaluation utilities.

Contains: StateTransition, evaluate_rules
"""
from dataclasses import dataclass
from typing import Optional
import random
from .states import ContagionState

@dataclass
class StateTransition:
    """Rule for transitioning between contagion states.

    Attributes:
        from_state: Current state required for transition
        to_state: Target state after transition
        trigger_type: How transition is triggered ("proximity", "action", "decay")
        probability: Chance of transition (0.0 to 1.0)
        decay_turns: Turns until decay transition (only for trigger_type="decay")
    """
    from_state: ContagionState
    to_state: ContagionState
    trigger_type: str
    probability: float
    decay_turns: Optional[int] = None

    def __post_init__(self):
        if not 0.0 <= self.probability <= 1.0:
            raise ValueError(f"probability must be 0.0-1.0, got {self.probability}")
        if self.trigger_type not in ("proximity", "action", "decay"):
            raise ValueError(f"invalid trigger_type: {self.trigger_type}")
        if self.trigger_type == "decay" and self.decay_turns is None:
            raise ValueError("decay trigger requires decay_turns")

def check_probability(probability: float) -> bool:
    """Check if a probability check passes."""
    return random.random() < probability
```

### Integration Point: Simulator.run() Modification
```python
# In src/socialsim4/core/simulator.py, around line 343
# AFTER status_prompt handling, BEFORE should_skip_turn check:

            # Optional: provide a status prompt at the start of each turn
            status_prompt = self.scene.get_agent_status_prompt(agent)
            if status_prompt:
                evt = StatusEvent(status_prompt)
                text = evt.to_string(self.scene.state.get("time"))
                agent.add_env_feedback(text)

            # NEW: Pre-turn rule evaluation for contagion scenes
            if hasattr(self.scene, 'pre_turn_rules'):
                self.scene.pre_turn_rules(self)

            # Skip turn based on scene rule
            if self.scene.should_skip_turn(agent, self):
                ...
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom agent wrappers | Agent.properties dict | Existing pattern | Consistent with hunger/energy/inventory |
| Scene mixin classes | Scene inheritance | Existing pattern | VillageScene provides grid integration |
| Broadcast for stats | emit_event_later | Existing pattern | Non-blocking, queued delivery |

**Deprecated/outdated:**
- Direct WebSocket manipulation: Use emit_event_later() instead
- Custom serialization: Use serialize_config()/deserialize_config() hooks

## Open Questions

1. **Should ContagionScene inherit from Scene or VillageScene?**
   - What we know: VillageScene has grid integration, GameMap, map_xy handling
   - What's unclear: Whether we need VillageScene's chat_range, movement_cost features
   - Recommendation: Inherit from VillageScene for grid infrastructure, ignore chat_range for Phase 1

2. **Where should transition_log be stored?**
   - What we know: Scene.state is for runtime mutable state, serialize_config() for immutable config
   - What's unclear: Whether log should persist across serialization
   - Recommendation: Store in Scene as `_transition_log` list, include in serialize() for experiment analysis

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 7.4.3 |
| Config file | pyproject.toml ([tool.pytest.ini_options]) |
| Quick run command | `pytest tests/unit/test_contagion.py -x` |
| Full suite command | `pytest tests/ -v` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CORE-01 | ContagionState enum defines states | unit | `pytest tests/unit/test_contagion_states.py -x` | Wave 0 |
| CORE-02 | StateTransition dataclass validates fields | unit | `pytest tests/unit/test_contagion_rules.py -x` | Wave 0 |
| CORE-03 | Agent.properties stores contagion_state | unit | `pytest tests/unit/test_contagion_scene.py::test_agent_state_storage -x` | Wave 0 |
| CORE-04 | pre_turn_rules evaluates decay transitions | unit | `pytest tests/unit/test_contagion_scene.py::test_pre_turn_rules -x` | Wave 0 |
| CORE-05 | Statistics count agents per state | unit | `pytest tests/unit/test_contagion_scene.py::test_statistics -x` | Wave 0 |
| CORE-06 | contagion_stats event emitted | unit | `pytest tests/unit/test_contagion_scene.py::test_stats_emission -x` | Wave 0 |
| GRID-01 | Agents positioned on GameMap | integration | `pytest tests/integration/test_contagion_grid.py::test_agent_positioning -x` | Wave 0 |
| GRID-02 | Moore neighborhood returns 8 neighbors | unit | `pytest tests/unit/test_contagion_scene.py::test_moore_neighbors -x` | Wave 0 |
| GRID-03 | get_adjacent_agents returns IDs only | unit | `pytest tests/unit/test_contagion_scene.py::test_adjacent_agents -x` | Wave 0 |
| GRID-04 | Grid cells are all passable | unit | `pytest tests/unit/test_contagion_scene.py::test_open_grid -x` | Wave 0 |
| HIDE-01 | Agent sees own state, not others | unit | `pytest tests/unit/test_contagion_scene.py::test_hidden_states -x` | Wave 0 |
| HIDE-02 | Agents infer states from behavior | integration | Deferred to Phase 2 (requires communication) | N/A |
| HIDE-03 | Frontend receives all agent states | unit | `pytest tests/unit/test_contagion_scene.py::test_frontend_states -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pytest tests/unit/test_contagion*.py -x`
- **Per wave merge:** `pytest tests/ -v --cov=src/socialsim4/core/contagion`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/test_contagion_states.py` - covers CORE-01
- [ ] `tests/unit/test_contagion_rules.py` - covers CORE-02
- [ ] `tests/unit/test_contagion_scene.py` - covers CORE-03 through HIDE-03
- [ ] `tests/integration/test_contagion_grid.py` - covers GRID-01
- [ ] `tests/conftest.py` - shared fixtures for ContagionScene setup
- [ ] Framework install: Already present (pytest in pyproject.toml)

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis (village_scene.py, scene.py, agent.py, simulator.py)
- pyproject.toml - pytest configuration, dependency versions
- CONTEXT.md - User-locked decisions

### Secondary (MEDIUM confidence)
- Python stdlib documentation for enum, dataclasses patterns
- Existing test patterns from tests/test_simulator.py

### Tertiary (LOW confidence)
- None - all findings based on direct codebase inspection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All stdlib or existing infrastructure, no new dependencies
- Architecture: HIGH - Follows established Scene/VillageScene/Agent.properties patterns
- Pitfalls: HIGH - Based on common Python enum/dataclass issues and existing GameMap behavior

**Research date:** 2026-03-08
**Valid until:** 30 days (stable patterns, no external dependencies)
