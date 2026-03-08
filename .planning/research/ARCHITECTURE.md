# Architecture: Contagion Spread Framework

**Project:** Social-Sim Contagion/Spread Model
**Researched:** 2026-03-08
**Overall confidence:** HIGH

## Executive Summary

The contagion/spread framework should integrate with the existing multi-agent simulation architecture by extending the Scene-based pattern established in VillageScene, introducing a rule-based state transition system that operates independently of agent decision-making. State tracking lives at the Scene level (via scene.state), rule evaluation occurs in a dedicated ContagionRules module, and state transitions happen through Scene hooks (pre_run, post_turn). This approach maintains agent isolation while enabling epidemiological and information diffusion modeling.

The framework reuses existing grid infrastructure (GameMap, positioning, pathfinding) from VillageScene and adds a new SpeakAction variant for targeted communication. Rules are configured via a declarative YAML/JSON schema that defines states, transitions, conditions, and decay parameters.

## Key Findings

**Stack:** Extend existing Scene/Action architecture with new ContagionScene class and state machine rules engine
**Architecture:** Scene-orchestrated rule evaluation with agent-hidden states and observation-based inference
**Critical pitfall:** Don't make state visible to agents directly — they should infer from observed behavior

## Recommended Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      ContagionScene                          │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │ GameMap      │  │ scene.state      │  │ ContagionRules│ │
│  │ (inherited)  │  │ - agent_states   │  │ (new module)  │ │
│  │              │  │ - global_stats   │  │               │ │
│  └──────────────┘  │ - turn_count     │  │ - evaluate()  │ │
│                    └──────────────────┘  │ - transitions │ │
│                                           └───────────────┘ │
└─────────────────────────────────────────────────────────────┘
         │                    │                     │
         ▼                    ▼                     ▼
┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
│ Grid Actions │    │ State Tracking  │    │ Rule Engine  │
│ - move       │    │ Per-agent       │    │ Proximity    │
│ - look_around│    │ Hidden states   │    │ Action-based │
│ - speak_to   │    │ Decay tracking  │    │ Configurable │
└──────────────┘    └─────────────────┘    └──────────────┘
```

### Integration Points with Existing Architecture

| Existing Component | Integration Method | New Extension |
|-------------------|-------------------|---------------|
| **Scene** | Extend for ContagionScene | Adds state machine hooks |
| **VillageScene** | Reuse grid/map logic | Inherit or compose GameMap |
| **Agent.properties** | Store contagion state | Add state_key field |
| **ActionController** | Validate speak constraints | Add proximity checks |
| **Simulator** | No changes needed | Scene orchestrates rules |
| **SimTree** | No changes needed | State serializes with scene |
| **TalkToAction** | Extend for SpeakAction | Add state transmission |

### Data Flow

**Simulation Turn Flow:**

```
1. Simulator.next_agent()
   │
2. Scene.pre_run() ──────────────────► Evaluate contagion rules
   │                                      - Proximity transitions
   │                                      - Decay/recovery
   │                                      - Update scene.state
   ▼
3. Agent.decide() ◄───────────────────── Context includes observed behaviors
   │                                      NOT direct state visibility
   ▼
4. Agent chooses action
   │
5. Scene.parse_and_handle_action()
   │
6. Action.handle() ────────────────────► May trigger contagion transitions
   │                                      - speak_to: spread information
   │                                      - move: change proximity context
   ▼
7. Scene.post_turn()
   │
8. Simulator.emit_event() ◄────────────── Broadcast to WebSocket
```

**Contagion Rule Evaluation Flow:**

```
Scene.pre_run()
    │
    ▼
ContagionRules.evaluate(scene, simulator)
    │
    ├─► For each agent pair (by proximity)
    │     └─► Check transition rules
    │           ├─► Condition satisfied?
    │           │     └─► Apply transition
    │           │           └─► Update agent.properties[state_key]
    │           │
    │           └─► Record transition
    │
    ├─► For each agent (decay/recovery)
    │     └─► Check duration in state
    │           └─► Apply decay rule
    │                 └─► Transition or stay
    │
    └─► Update global statistics
          └─► scene.state["contagion_stats"]
```

## Component Boundaries

### ContagionScene (NEW)

**Location:** `src/socialsim4/core/scenes/contagion_scene.py`

**Responsibility:**
- Manage grid-based positioning (reuse VillageScene patterns)
- Orchestrate contagion rule evaluation each turn
- Track agent contagion states in scene.state
- Provide state prompts to agents (observed behaviors, not hidden states)
- Handle speak_to action for targeted communication

**Communicates With:**
- ContagionRules (rule evaluation)
- GameMap (position/proximity queries)
- Agents (via add_env_feedback for observations)
- Simulator (via Scene hooks)

**Key Methods:**
```python
class ContagionScene(Scene):
    TYPE = "contagion_scene"

    def __init__(self, name, initial_event, game_map, contagion_config, ...):
        # Initialize with GameMap and contagion rules

    def pre_run(self, simulator):
        # Evaluate contagion rules before agent actions
        self._evaluate_contagion_rules(simulator)

    def get_scene_actions(self, agent):
        # Return [SpeakToAction, MoveAction, LookAction, YieldAction, ...]

    def get_agent_status_prompt(self, agent):
        # Return observed behaviors, NOT hidden states
        # "You see Agent X coughing" vs "Agent X is infected"
```

### ContagionRules (NEW MODULE)

**Location:** `src/socialsim4/core/contagion/`

**Files:**
- `rules.py` — Core rule evaluation engine
- `config.py` — Configuration schema and validation
- `transitions.py` — State transition logic

**Responsibility:**
- Load and validate contagion configuration
- Evaluate proximity-based transitions (infection spread)
- Evaluate action-based transitions (speak_to spreads information)
- Apply decay/recovery rules per state
- Track transition history for analysis

**Communicates With:**
- ContagionScene (called via pre_run hook)
- GameMap (queries for proximity)
- Agent.properties (reads/writes state)

**Key Classes:**
```python
@dataclass
class StateConfig:
    name: str
    decay_rule: Optional[DecayRule] = None
    visible_behaviors: list[str] = field(default_factory=list)

@dataclass
class TransitionRule:
    from_state: str
    to_state: str
    condition: Condition  # proximity, action, probability
    trigger: str  # "proximity" | "action"

class ContagionRules:
    def __init__(self, config: dict):
        self.states: dict[str, StateConfig] = {}
        self.transitions: list[TransitionRule] = []
        self._load_config(config)

    def evaluate(self, scene, simulator):
        """Evaluate all rules and apply transitions."""
        for agent_pair in self._get_adjacent_agents(scene, simulator):
            self._check_proximity_transitions(agent_pair, scene)

        for agent in simulator.agents.values():
            self._check_decay_transitions(agent, scene)

    def _check_proximity_transitions(self, agent_pair, scene):
        """Check if contagion spreads between adjacent agents."""

    def _check_decay_transitions(self, agent, scene):
        """Check if agent recovers/decays to new state."""
```

### SpeakToAction (NEW OR EXTEND)

**Location:** `src/socialsim4/core/actions/contagion_actions.py`

**Option 1: Extend existing TalkToAction**
- Add state transmission logic to existing action
- Maintain consistency with current codebase

**Option 2: Create new SpeakToAction**
- Separate contagion-specific communication
- More explicit about contagion mechanics

**Recommendation:** Extend TalkToAction with optional contagion parameter

```python
class TalkToAction(Action):
    NAME = "talk_to"
    DESC = "Say something to a nearby person by name."
    INSTRUCTION = """- talk_to: Speak to nearby agent
  <Action name="talk_to"><target>Name</target><message>Hi!</message></Action>
"""

    def handle(self, action_data, agent, simulator, scene):
        # ... existing validation and range checks ...

        # NEW: Check if this is a ContagionScene and handle state transmission
        if hasattr(scene, 'contagion_rules'):
            scene.contagion_rules.handle_action_transmission(
                sender=agent,
                receiver=target,
                action="talk_to",
                scene=scene
            )

        # ... existing message delivery ...
```

### Configuration Schema (NEW)

**Location:** `src/socialsim4/core/scenarios/contagion_configs/`

**Format:** YAML or JSON (recommend YAML for readability)

**Example Structure:**
```yaml
# disease_spread.yaml
states:
  - name: susceptible
    decay_rule: null
    visible_behaviors:
      - "appears healthy"

  - name: infected
    decay_rule:
      duration: 10  # turns
      recovery_state: recovered
      probability: 0.8
    visible_behaviors:
      - "coughing"
      - "appears unwell"
      - "lethargic"

  - name: recovered
    decay_rule: null  # permanent
    visible_behaviors:
      - "appears healthy"

transitions:
  - from: susceptible
    to: infected
    trigger: proximity
    condition:
      distance: 1  # adjacent tiles
      probability: 0.3
      required_states:
        - infected  # neighbor must be infected

  - from: infected
    to: recovered
    trigger: decay
    condition:
      min_duration: 10
      probability: 0.8

  - from: susceptible
    to: informed
    trigger: action
    condition:
      action: talk_to
      source_state: infected
      probability: 1.0
```

## Patterns to Follow

### Pattern 1: Scene-Orchestrated Rule Evaluation

**What:** Rules are evaluated in Scene.pre_run() before agents act
**When:** Contagion spread happens independently of agent decisions
**Example:**
```python
class ContagionScene(Scene):
    def pre_run(self, simulator: Simulator):
        """Evaluate contagion rules each turn."""
        super().pre_run(simulator)
        self.contagion_rules.evaluate(self, simulator)
```

**Why:** Maintains agent isolation — agents never trigger their own contagion transitions. Rules are environment-driven, not agent-driven.

### Pattern 2: Hidden States with Observable Behaviors

**What:** Agent contagion state is stored in agent.properties but NOT shown in status prompts
**When:** Agents must infer states from observed behaviors
**Example:**
```python
# DON'T DO THIS — shows hidden state
def get_agent_status_prompt(self, agent):
    state = agent.properties["contagion_state"]
    return f"You are {state}"

# DO THIS — shows observable behaviors
def get_agent_status_prompt(self, agent):
    state_key = self.contagion_rules.get_state_key()
    state = agent.properties.get(state_key)
    behaviors = self.contagion_rules.get_visible_behaviors(state)
    return f"You observe: {', '.join(behaviors)}"
```

**Why:** More realistic social dynamics. Information spread becomes meaningful when agents must communicate to learn states.

### Pattern 3: Proximity-Based Adjacency

**What:** Use Manhattan distance on grid for contagion spread calculations
**When:** Evaluating proximity-based transitions
**Example:**
```python
def _get_adjacent_agents(self, scene, simulator):
    """Yield pairs of agents within contagion distance."""
    for agent_a in simulator.agents.values():
        for agent_b in simulator.agents.values():
            if agent_a.name == agent_b.name:
                continue
            pos_a = agent_a.properties.get("map_xy")
            pos_b = agent_b.properties.get("map_xy")
            if not pos_a or not pos_b:
                continue
            dist = abs(pos_a[0] - pos_b[0]) + abs(pos_a[1] - pos_b[1])
            if dist <= self.proximity_distance:
                yield (agent_a, agent_b, dist)
```

**Why:** Consistent with existing VillageScene chat_range logic. Reuses GameMap infrastructure.

### Pattern 4: Declarative Rule Configuration

**What:** Rules defined in YAML/JSON, loaded at scene initialization
**When:** Need flexible contagion models without code changes
**Example:**
```python
@dataclass
class ContagionConfig:
    states: list[StateConfig]
    transitions: list[TransitionRule]
    proximity_distance: int = 1

    @classmethod
    def from_yaml(cls, path: str) -> "ContagionConfig":
        with open(path) as f:
            data = yaml.safe_load(f)
        return cls(**data)
```

**Why:** Researchers can experiment with different models (SIR, SEIR, information diffusion) by changing config files, not code.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Agents Knowing Their Own Contagion State

**What:** Showing agent.properties["contagion_state"] in status prompts
**Why bad:** Eliminates the need for communication and observation. Breaks the "hidden state" design principle.
**Instead:** Show observable behaviors only. Let agents ask "Are you sick?" or observe coughing.

### Anti-Pattern 2: Action-Triggered State Transitions

**What:** Agent.move() or Agent.speak() directly triggering contagion spread
**Why bad:** Violates agent isolation. Agents would control contagion mechanics.
**Instead:** Scene.pre_run() evaluates rules. Agent actions only affect transitions if the rule specifies trigger="action".

### Anti-Pattern 3: Tight Coupling to Specific Models

**What:** Hardcoding SIR/SEIR logic into ContagionScene
**Why bad:** Can't reuse for information diffusion, rumor spread, or other contagion types.
**Instead:** Generic state machine with configurable transitions.

### Anti-Pattern 4: State Stored in Multiple Places

**What:** Duplicating contagion state in scene.state AND agent.properties
**Why bad:** Inconsistent state, complex synchronization, bugs during SimTree cloning.
**Instead:** Single source of truth in agent.properties[state_key]. Scene.state only holds aggregates/stats.

## Scalability Considerations

| Concern | At 10 agents | At 100 agents | At 1000 agents |
|---------|--------------|---------------|----------------|
| **Rule evaluation** | O(n²) pairs, negligible | O(n²) pairs, ~10K iterations | O(n²) pairs, ~1M iterations — may need spatial partitioning |
| **State storage** | agent.properties, trivial | agent.properties, trivial | agent.properties, OK |
| **Serialization** | SimTree cloning, fast | SimTree cloning, moderate | SimTree cloning, may need lazy state copy |
| **Proximity queries** | Nested loop, fine | Nested loop, fine | Spatial index (quadtree or grid buckets) recommended |

**Optimization for 1000+ agents:**
```python
# Instead of O(n²) nested loop:
def _get_adjacent_agents_slow(self, simulator):
    for a in simulator.agents.values():
        for b in simulator.agents.values():
            # ... distance check ...

# Use spatial partitioning:
def _get_adjacent_agents_fast(self, simulator):
    # Build spatial buckets
    buckets = self._build_spatial_buckets(simulator)
    # Only check adjacent buckets
    for bucket in buckets:
        for agent_pair in self._check_bucket_adjacency(bucket):
            yield agent_pair
```

## Data Structures

### State Tracking

**Location:** `agent.properties[contagion_state]`

**Structure:**
```python
agent.properties = {
    "map_xy": [5, 10],
    "hunger": 30,
    "energy": 80,
    # NEW: Contagion state
    "contagion_state": {
        "current": "infected",
        "duration": 5,  # turns in current state
        "history": ["susceptible", "infected"],
        "last_transition_turn": 42
    }
}
```

### Scene-Level Aggregates

**Location:** `scene.state[contagion_stats]`

**Structure:**
```python
scene.state = {
    "time": 1080,
    # NEW: Contagion statistics
    "contagion_stats": {
        "state_counts": {
            "susceptible": 7,
            "infected": 2,
            "recovered": 1
        },
        "transition_history": [
            {"turn": 5, "agent": "Alice", "from": "susceptible", "to": "infected", "trigger": "proximity"},
            {"turn": 5, "agent": "Bob", "from": "susceptible", "to": "infected", "trigger": "proximity"}
        ],
        "patient_zeros": ["Alice"]
    }
}
```

### Configuration Schema

**File:** `src/socialsim4/core/contagion/config.py`

```python
@dataclass
class DecayRule:
    duration: int  # turns before decay possible
    recovery_state: str  # target state after decay
    probability: float  # chance of recovery per turn after duration

@dataclass
class StateConfig:
    name: str
    decay_rule: Optional[DecayRule]
    visible_behaviors: list[str]
    initial: bool = False  # Is this an initial state?

@dataclass
class Condition:
    distance: Optional[int] = None  # For proximity rules
    probability: float = 1.0
    required_states: list[str] = field(default_factory=list)
    min_duration: Optional[int] = None  # For decay rules

@dataclass
class TransitionRule:
    from_state: str
    to_state: str
    trigger: str  # "proximity" | "decay" | "action"
    condition: Condition
```

## Backward Compatibility

### Existing Scenes (No Impact)

- CouncilScene, WerewolfScene, etc. remain unchanged
- No contagion rules added by default
- Opt-in via scene type selection

### VillageScene (Optional Enhancement)

- Could add optional contagion_config parameter
- If not provided, behaves identically to current version
- If provided, adds contagion mechanics to existing village simulation

### Migration Path

```python
# Current usage (unchanged)
scene = VillageScene("village", "Welcome", game_map)

# New usage (with contagion)
scene = ContagionScene("outbreak", "Disease outbreak", game_map, contagion_config)
# OR
scene = VillageScene("village", "Welcome", game_map, contagion_config=config)
```

## Suggested Build Order

### Phase 1: Core Infrastructure (No contagion logic yet)
1. Create `src/socialsim4/core/contagion/` directory
2. Implement `config.py` with StateConfig, TransitionRule, Condition dataclasses
3. Implement `rules.py` skeleton with ContagionRules class
4. Add YAML config loader and validation
5. Write unit tests for config parsing

### Phase 2: Scene Integration
1. Create `ContagionScene` extending Scene
2. Inherit or compose VillageScene's GameMap logic
3. Implement `pre_run()` hook for rule evaluation
4. Add state tracking to scene.state
5. Implement `get_agent_status_prompt()` with observable behaviors

### Phase 3: Rule Engine
1. Implement `_evaluate_proximity_rules()` in ContagionRules
2. Implement `_evaluate_decay_rules()` in ContagionRules
3. Implement `_evaluate_action_rules()` in ContagionRules
4. Add transition tracking and history
5. Write integration tests with mock agents

### Phase 4: Action Integration
1. Extend TalkToAction for contagion transmission
2. Add action-based transition support in rules engine
3. Implement SpeakAction if separate from TalkToAction
4. Add proximity validation for speak actions

### Phase 5: Configuration and Scenarios
1. Create example contagion configs (SIR, rumor spread)
2. Add scenario builder support in frontend
3. Add contagion state visualization in UI
4. Write end-to-end tests

### Phase 6: Analysis and Visualization
1. Add transition history export
2. Implement state timeline charts
3. Add infection/recovery curve visualization
4. Statistical analysis tools

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Based on existing VillageScene implementation |
| State management | HIGH | agent.properties pattern is well-established |
| Rule engine | HIGH | Similar to experiment framework's action handlers |
| Agent isolation | HIGH | Scene-orchestrated rules maintain this principle |
| Hidden states | HIGH | Confirmed in PROJECT.md as design requirement |
| Action-based transitions | MEDIUM | Need to verify ActionController integration |
| Configuration schema | MEDIUM | May need iteration for complex models |
| Scalability optimizations | LOW | Won't know until testing with 1000+ agents |

## Gaps to Address

1. **ActionController Integration:** Need to verify if contagion rules should integrate with ActionController or run independently in Scene.pre_run()

2. **SimTree Cloning Performance:** State serialization with large transition histories may impact branching performance. Consider lazy history copy.

3. **Multi-Language Support:** Contagion config and visible behaviors need i18n support (English/Chinese)

4. **Probabilistic Transitions:** Random number generation during rule evaluation — ensure deterministic replay for SimTree branches?

5. **Spatial Indexing:** For 1000+ agents, need to implement spatial partitioning. Not blocking for MVP.

6. **Frontend Visualization:** How to display hidden states vs observable behaviors in UI? Show all to user but hide from agents?

## Sources

- **Existing Codebase Analysis:**
  - `src/socialsim4/core/scene.py` — Base Scene class with hooks
  - `src/socialsim4/core/scenes/village_scene.py` — Grid-based positioning, GameMap, proximity chat
  - `src/socialsim4/core/actions/base_actions.py` — TalkToAction pattern
  - `src/socialsim4/core/actions/village_actions.py` — Movement, look_around actions
  - `src/socialsim4/core/experiment/state.py` — State management patterns
  - `src/socialsim4/core/simulator.py` — Simulator lifecycle, event emission
  - `src/socialsim4/core/agent/agent.py` — Agent.properties pattern

- **Project Context:**
  - `.planning/PROJECT.md` — Contagion requirements and key decisions
  - `.planning/codebase/ARCHITECTURE.md` — Overall platform architecture
  - `.planning/codebase/STRUCTURE.md` — Directory structure and conventions
