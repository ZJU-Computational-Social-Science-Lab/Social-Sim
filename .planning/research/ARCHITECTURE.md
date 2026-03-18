# Architecture Research

**Domain:** Multi-agent simulation platform with game theory scenarios
**Researched:** 2025-03-18
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              Frontend Layer (TypeScript)                      │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────┐  ┌────────────────┐  ┌───────────┐  │
│  │   Experiment     │  │  SimTree     │  │  Wizard        │  │  i18n     │  │
│  │   Builder        │  │  Workspace   │  │  Components    │  │  Layer    │  │
│  └────────┬─────────┘  └──────┬───────┘  └────────┬───────┘  └─────┬─────┘  │
│           │                   │                   │                  │         │
├───────────┴───────────────────┴───────────────────┴──────────────────┴───────┤
│                              Backend API Layer (Python/Litestar)             │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Experiments  │  │ Simulations  │  │ Auth/Config  │  │ WebSocket    │   │
│  │ Routes       │  │ CRUD/Tree    │  │ Routes       │  │ Streaming    │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                 │                 │                  │            │
├─────────┴─────────────────┴─────────────────┴──────────────────┴────────────┤
│                           Experiment Engine Layer                             │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                    ExperimentScene (Orchestrator)                   │     │
│  │  - run_round() execution                                           │     │
│  │  - State persistence (ExperimentState)                             │     │
│  └───────────────────────────┬────────────────────────────────────┘     │
│                              │                                            │
│  ┌───────────────────────────┴────────────────────────────────────┐     │
│  │                    ExperimentRunner (Controller)                │     │
│  │  - Round visibility modes (simultaneous/sequential/random/paired)│     │
│  │  - RoundContextManager (history tracking)                       │     │
│  └───────────────────────────┬────────────────────────────────────┘     │
│                              │                                            │
│  ┌──────────┬─────────────────┼──────────────────┬──────────────┐        │
│  │          │                 │                  │              │        │
│  ▼          ▼                 ▼                  ▼              ▼        │
│ ┌──────┐ ┌──────┐       ┌──────────┐     ┌──────────┐   ┌──────────┐  │
│ │Agent │ │Agent │  ...  │ Payoff   │     │ Action   │   │ Round    │  │
│ │      │ │      │       │ Engine   │     │ Handler  │   │ Context  │  │
│ └───▲──┘ └───▲──┘       └──────────┘     └──────────┘   └──────────┘  │
├────┴───────┴───────────────────────────────────────────────────────────────┤
│                           Core Simulation Layer                             │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐              │
│  │Simulator │  │  Scene   │  │ Agent    │  │ SimTree      │              │
│  │(Legacy)  │  │(Base)    │  │(Legacy)  │  │(Branching)   │              │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘              │
├──────────────────────────────────────────────────────────────────────────────┤
│                           Infrastructure Layer                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐              │
│  │PostgreSQL│  │ LLM      │  │ Session  │  │ i18n         │              │
│  │Database  │  │ Providers│  │ Manager  │  │ (T() func)   │              │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **ExperimentScene** | Standalone orchestrator for game theory scenarios. No Scene inheritance. Manages ExperimentAgents directly. | `core/experiment/scene.py` |
| **ExperimentRunner** | Executes rounds with visibility modes. Manages RoundContextManager, PayoffEngine, ActionHandler. | `core/experiment/runner.py` |
| **RoundContextManager** | Tracks action history per agent. Builds filtered context based on InformationModel. | `core/experiment/round_context.py` |
| **ExperimentAgent** | LLM-driven agent with role, knowledge base, score. No dependency on Simulator. | `core/experiment/agent.py` |
| **PayoffEngine** | Calculates payoffs for matrix/pool/feedback games. Supports pair/group modes. | `core/experiment/payoff/engine.py` |
| **ActionHandler** | Executes action effects on ExperimentState (resources, properties). | `core/experiment/action_handler.py` |
| **Simulator (Legacy)** | Core turn-based loop. Agent-Scene isolation principle. | `core/simulator.py` |
| **SimTree** | Branching timeline for "what-if" exploration. Clones simulators. | `core/simtree.py` |
| **Backend API** | Litestar routes. Experiments, simulations CRUD, tree operations, WebSocket streaming. | `backend/api/routes/` |
| **Frontend** | React + TypeScript. Experiment builder UI, SimTree workspace, i18n integration. | `frontend/components/` |

## Recommended Project Structure

```
src/socialsim4/
├── backend/                    # Web API layer
│   └── api/routes/
│       ├── experiments.py      # Experiment CRUD and run endpoints
│       ├── simulations/
│       │   ├── lifecycle.py    # Start/stop simulations
│       │   ├── tree_operations.py # SimTree branching ops
│       │   └── websocket_handlers.py # Real-time event streaming
│       └── auth.py             # JWT authentication
├── core/
│   ├── experiment/             # Game theory experiment engine
│   │   ├── scene.py           # ExperimentScene (main orchestrator)
│   │   ├── runner.py          # ExperimentRunner (round execution)
│   │   ├── agent.py           # ExperimentAgent (LLM wrapper)
│   │   ├── round_context.py   # RoundContextManager (history)
│   │   ├── payoff/            # Payoff calculation
│   │   ├── feedback/          # Coordination feedback
│   │   └── state.py           # ExperimentState persistence
│   ├── agent.py               # Legacy Agent (for non-experiment sims)
│   ├── simulator.py           # Legacy Simulator loop
│   └── simtree.py             # Branching timeline engine
├── i18n.py                    # T() translation function
└── locales/
    ├── en.json                # English translations
    └── zh.json                # Chinese translations
frontend/
├── components/
│   ├── experiment/            # Game theory experiment UI
│   │   ├── ExperimentBuilder.tsx
│   │   ├── Step1InteractionType.tsx
│   │   ├── ResourceConfig.tsx # For PGG token endowment
│   │   └── PayoffMatrixEditor.tsx
│   └── wizard/                # Scenario creation wizard
├── services/                  # API client functions
└── locales/
    ├── en.json                # English translations (frontend)
    └── zh.json                # Chinese translations (frontend)
```

### Structure Rationale

- **`core/experiment/`**: Isolated from legacy simulator. Clean API for game theory scenarios. RoundContextManager provides history tracking separate from Agent memory.
- **`backend/api/routes/experiments.py`**: REST API for experiment lifecycle (create, run, compare). Integrates with SimTree for variant execution.
- **Frontend `experiment/` components**: Domain-specific UI for game theory configuration. Separate from wizard to avoid clutter.
- **i18n split (backend/frontend)**: Backend uses `T()` from `socialsim4.i18n`, frontend uses `i18next`. Shared translation keys structure.

## Architectural Patterns

### Pattern 1: Agent Isolation (Core Principle)

**What:** Agents never know about the Simulator. All decisions flow from their context and scene feedback.

**When to use:** All simulation scenarios. Critical for reproducibility and testability.

**Trade-offs:** Pro: Clean boundaries, easy to test. Con: Cannot implement "meta" agents that inspect simulation state.

**Example:**
```python
# Agent.process() only receives: clients, initiative, scene
# No access to simulator, other agents, or global state
action_data = agent.process(clients, initiative=False, scene=scene)
```

### Pattern 2: Three-Layer LLM Response Handling

**What:** Controller (parse) → Validation (fuzzy match/clamp) → Reprompt (if needed).

**When to use:** All LLM-driven agent actions. Handles small model errors robustly.

**Trade-offs:** Pro: Handles malformed LLM output gracefully. Con: Adds complexity to action processing.

**Example:**
```python
# Layer 1: Controller parses JSON
result = controller.parse_response(raw_response)
# Layer 2: Validation fixes/clamps
validated = validation.validate_and_clamp(result, game_config)
# Layer 3: Reprompt for follow-up actions (e.g., Speak → what do you want to say?)
if needs_followup:
    result = await controller.process_response_with_followup(...)
```

### Pattern 3: Round Context Inheritance

**What:** Each round builds context from previous rounds via RoundContextManager. History is filtered by InformationModel (all/pair/neighbor/none).

**When to use:** Multi-round experiments where agents need cumulative context.

**Trade-offs:** Pro: Deterministic context building (no LLM dependency). Con: Context grows large, must budget tokens.

**Example:**
```python
# Record actions with observer tracking
context_manager.record_action_with_observers(
    agent_name="Alice",
    action_name="contribute",
    parameters={"amount": 10},
    round_num=1,
    summary="Alice contributed 10 tokens",
    payoff=8
)

# Build filtered context for next round
context = context_manager.get_context_for_agent("Alice", agent_score=alice.score)
```

### Pattern 4: SimTree Branching (What-If Exploration)

**What:** Each SimTreeNode stores a cloned Simulator. Operations: advance, branch, multi, chain.

**When to use:** Exploring alternate outcomes, A/B testing, parameter sweeps.

**Trade-offs:** Pro: No shared state between branches. Con: Memory intensive (deep copies).

**Example:**
```python
# Create branch where agent contributes differently
child = tree.branch(parent_node, [{
    "type": "agent_ctx",
    "agent": "Alice",
    "key": "override_contribution",
    "value": 20
}])
```

## Data Flow

### Request Flow (Create and Run Experiment)

```
[User: Create Experiment]
    ↓
[Frontend: ExperimentBuilder] → POST /api/simulations/{id}/experiments
    ↓
[Backend: experiments.create_experiment] → Create Experiment DB record
    ↓
[Frontend: User clicks "Run"] → POST /api/simulations/{id}/experiments/{exp_id}/run
    ↓
[Backend: experiments.run_experiment] → start_experiment_run_background()
    ↓
[ExperimentScene] → initialize(llm_client)
    ↓
[ExperimentRunner] → _run_single_round(round_num, context_summary, round_history)
    ↓
[For each agent: _prompt_agent()]
    ├── [RoundContextManager] → get_context_for_agent() (filtered by InformationModel)
    ├── [build_prompt()] → Assemble context + role + game config
    ├── [LLM Client] → chat(messages, json_mode=True)
    ├── [ExperimentController] → process_response_with_followup()
    └── [RoundContextManager] → record_action_with_observers()
    ↓
[PayoffEngine] → calculate_round_payoffs() → Update agent scores
    ↓
[ExperimentScene] → Apply action effects to ExperimentState
    ↓
[SimTree] → Store result in node logs
    ↓
[WebSocket] → Stream events to frontend → Update UI
```

### State Management

```
[ExperimentState] (Durable, persisted)
    ├── agents: Dict[str, AgentState]
    │   ├── score: int
    │   ├── resources: Dict[str, Any]
    │   └── properties: Dict[str, Any]
    ├── extensions: Dict[str, Any]
    ├── history: List[RoundHistory]
    └── round: int

[RoundContextManager] (Ephemeral, rebuilt each round)
    ├── _round_events: List[RoundEvent]
    └── information_model: InformationModel (scope_type, pairing_fn)

[ExperimentAgent] (In-memory, per simulation)
    ├── name: str
    ├── role_prompt: str
    ├── knowledge_base: List[str]
    ├── score: int (cumulative)
    └── action_history: List[Dict]
```

### Key Data Flows

1. **Context Inheritance:** `round_history` → `RoundContextManager._replay_history_to_events()` → `_round_events` → `get_context_for_agent()` (filtered by InformationModel)
2. **Action Execution:** Agent action → `ActionHandler.execute()` → Mutates `ExperimentState` (resources, properties)
3. **Payoff Calculation:** Round actions → `PayoffEngine.calculate_round_payoffs()` → Update `Agent.score` → Stored in `RoundEvent.payoff`
4. **i18n Flow:** Backend `T('key')` → Lookup `locales/{locale}.json` → Return translated string → Frontend displays

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k concurrent simulations | Monolith is fine. PostgreSQL handles load. LLM providers are the bottleneck. |
| 1k-10k concurrent simulations | Use background task queue (Celery) for experiment runs. Cache LLM responses. |
| 100k+ concurrent simulations | Microservices: separate experiment engine from API. Distributed SimTree storage. |

### Scaling Priorities

1. **First bottleneck:** LLM API rate limits. Mitigation: Queue requests, use multiple providers, cache prompt-response pairs.
2. **Second bottleneck:** SimTree memory usage. Mitigation: Serialize inactive nodes to disk, limit tree depth.

## Anti-Patterns

### Anti-Pattern 1: Breaking Agent Isolation

**What people do:** Pass Simulator reference to Agent for "meta-awareness."

**Why it's wrong:** Violates core architecture principle. Makes agents unreproducible. Makes testing impossible.

**Do this instead:** If agent needs global info, inject it via context or scene feedback. Keep agent decision-making pure.

### Anti-Pattern 2: Defensive Coding in Core Engine

**What people do:** Add try/except blocks around action parsing, fallback to default actions.

**Why it's wrong:** Masks real errors. Makes debugging impossible. Violates "fail fast" philosophy.

**Do this instead:** Let exceptions surface. Fix root causes. Use validation layer (Layer 3) for LLM fuzziness, not try/except.

### Anti-Pattern 3: Direct Database Access from Experiment Engine

**What people do:** Query database directly in ExperimentRunner for agent state.

**Why it's wrong:** Tight coupling to DB. Hard to test. Breaks experiment isolation.

**Do this instead:** Pass all state via ExperimentConfig. Use ExperimentScene to persist state after rounds.

### Anti-Pattern 4: Hardcoded User-Facing Strings

**What people do:** Write error messages, labels, and prompts directly in code.

**Why it's wrong:** Breaks i18n. Impossible to translate. Violates project requirements.

**Do this instead:** Always use `T('key')` in backend, `t('key')` in frontend. Add translations to locale files.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **LLM Providers** | Abstract client interface (`LLMClient`) | Swap OpenAI/Ollama/Gemini via config. Retry with fallback on empty responses. |
| **PostgreSQL** | Async SQLAlchemy | Simulation snapshots, SimTree nodes, experiment records. |
| **WebSocket** | Socket.IO or native WS | Stream `agent_process_start`, `action_end`, `experiment_action` events to frontend. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Frontend ↔ Backend API** | REST (AXios) + WebSocket | Use `T()` for all error messages. Pass locale header. |
| **Backend API ↔ Experiment Engine** | Direct Python calls | No HTTP overhead. `ExperimentScene.run_round(event_emitter)` |
| **ExperimentScene ↔ Simulator** | None (isolated) | ExperimentScene does NOT inherit from Scene. Uses ExperimentAgents directly. |
| **ExperimentRunner ↔ RoundContextManager** | Direct method calls | `get_context_for_agent()`, `record_action_with_observers()` |
| **Backend i18n ↔ Frontend i18n** | Shared key structure | Backend uses `socialsim4/i18n.py`, frontend uses `i18next`. Keys must match. |

## Feature Integration Architecture

### Context Inheritance (BUG-01)

**Component:** `RoundContextManager` in `core/experiment/round_context.py`

**Integration Point:** `ExperimentRunner._run_single_round()`

```python
# Flow:
round_history → _replay_history_to_events() → _round_events → get_context_for_agent()
```

**Build Order:** Must be fixed first. Blocks all multi-round experiments.

### Retry Enforcement (BUG-06)

**Component:** `ExperimentController` in `core/experiment/controller.py`

**Integration Point:** Action validation layer. When retrying after connection error, enforce stage constraints.

```python
# Flow:
_parse_action() fails → Connection error → Retry → Check stage constraint in scene_state
```

**Build Order:** After context inheritance. Depends on stable round execution.

### Token Endowment Validation (BUG-07)

**Component:** `validation.py` in `core/experiment/`

**Integration Point:** LLM response validation. Clamp integer values to valid range.

```python
# Flow:
validate_and_clamp(result, game_config) → Check action_type="integer" → Clamp to min/max
```

**Build Order:** Can be done in parallel with context inheritance.

### Punishment Mechanism (FEAT-01)

**Component:** New action handler in `ActionHandler` + new payoff mode in `PayoffEngine`

**Integration Point:** ExperimentScene action execution and payoff calculation.

```python
# Flow:
ActionHandler.execute("punish", agent, params, state) → Deduct tokens from target
PayoffEngine → Add punishment payoff mode
```

**Build Order:** After token validation is fixed. Extends existing payoff engine.

### Blind Choice Mode (FEAT-02)

**Component:** UI toggle + ExperimentRunner visibility mode

**Integration Point:** Frontend ExperimentBuilder → GameConfig parameters

```python
# Flow:
Frontend toggle → round_visibility="simultaneous" (blind) vs "sequential" (visible)
```

**Build Order:** Independent. Can be done anytime.

### i18n Audit (I18N-01)

**Component:** Backend `T()` function + Frontend `i18next`

**Integration Point:** All user-facing text throughout the stack.

```python
# Backend:
T('error.simulation.not_found')
# Frontend:
t('dashboard.title')
```

**Build Order:** Can be done incrementally. High priority but not blocking.

## Sources

- AGENTS.md (Core architecture principles)
- Source code analysis of:
  - `core/simulator.py` (Legacy simulator loop)
  - `core/experiment/scene.py` (ExperimentScene orchestrator)
  - `core/experiment/runner.py` (ExperimentRunner round execution)
  - `core/experiment/round_context.py` (RoundContextManager)
  - `backend/api/routes/experiments.py` (REST API)
  - `i18n.py` (Translation infrastructure)

---
*Architecture research for: Multi-agent simulation platform*
*Researched: 2025-03-18*
