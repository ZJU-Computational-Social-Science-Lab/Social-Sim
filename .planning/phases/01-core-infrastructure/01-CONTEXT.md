# Phase 1: Core Infrastructure - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Agents have contagion states tracked by the simulation with a rule engine for transitions, positioned on a visible grid with hidden state semantics. This is the foundation layer — no agent actions or transmission mechanics yet (those come in Phases 2-3).

</domain>

<decisions>
## Implementation Decisions

### State Representation
- **Enum-only approach** — ContagionState is a simple enum (SUSCEPTIBLE, INFECTED, RECOVERED, EXPOSED, etc.)
- State stored in `agent.properties["contagion_state"]` as string matching enum value
- No metadata on states themselves — simplicity for v1.0
- Turns-since-infection tracked separately in `agent.properties["contagion_turns"]` (for decay evaluation)

### Rule Evaluation Timing
- **Pre-turn phase** — Rules evaluated before any agent acts each turn
- Scene's `pre_run()` hook fires once at simulation start (initial state setup)
- New scene method `pre_turn_rules()` fires at start of each turn before agents act
- Clean separation: state changes happen deterministically before agent decision-making

### Statistics & Logging
- **Counts + Event log** — Both aggregate counts and detailed transition events
- Counts: Current number of agents per state (e.g., {"SUSCEPTIBLE": 5, "INFECTED": 3})
- Event log: Each transition records timestamp (turn number), agent_id, from_state, to_state, trigger_type
- Statistics exposed via WebSocket events (`contagion_stats` event type)
- Event log queryable for experiment analysis

### Initial Agent Placement
- **Random placement with configuration** — Agents placed at random unoccupied cells
- Config option: `initial_infected_count` or `initial_infected_ratio` to seed some agents as INFECTED
- Infected agents selected randomly from population
- Grid size configurable (default 20x20 to match VillageScene pattern)

### Hidden State Semantics
- Agent's own state visible in their context prompt ("You are currently INFECTED")
- Other agents' states NOT visible — only agent IDs shown in neighbor list
- Frontend sees true states for all agents (observer mode)
- No inference logic in Phase 1 — agents learn through communication only (Phase 2)

### Claude's Discretion
- Exact ContagionState enum values (start with SUSCEPTIBLE, INFECTED, RECOVERED; add EXPOSED if needed)
- StateTransition dataclass field names and validation
- Statistics event payload structure
- Grid default size and boundary behavior

</decisions>

<specifics>
## Specific Ideas

- Follow existing VillageScene pattern for grid integration (reuse `map_xy` property)
- Rules should be evaluated by scene, not agents (maintains agent isolation per architecture)
- Statistics events should use existing `simulator.emit_event_later()` pattern

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- **GameMap** (`village_scene.py`): Grid with `width`, `height`, `tiles`, `locations`, `neighbors()`, `get_location_at()`, `is_passable()`, `in_bounds()`, serialization
- **VillageScene** (`village_scene.py`): Pattern for grid-based scene with `initialize_agent()` setting `map_xy`, `serialize_config()`/`deserialize_config()` hooks
- **Scene** (`scene.py`): Base class with `pre_run()`, `post_turn()`, `initialize_agent()`, `get_scene_actions()`, `serialize()`/`deserialize()`
- **Agent.properties**: Per-agent state storage (already used for `hunger`, `energy`, `inventory`, `map_xy`)
- **ActionController** (`action_controller.py`): Action validation pattern
- **WebSocket events**: `simulator.emit_event_later()` for real-time frontend updates

### Established Patterns
- **Scene inheritance**: Extend Scene base class, override hooks
- **Agent isolation**: Agents never access Simulator directly; all decisions from context
- **Fail-fast in core**: No try/except in core engine (per AGENTS.md philosophy)
- **Serialization**: `serialize_config()` for immutable config, `state` dict for mutable runtime state

### Integration Points
- New `ContagionScene` extends `Scene` (or `VillageScene` if grid reuse is direct)
- Rules evaluated in new `pre_turn_rules()` method called before agent turns
- Statistics emitted via existing WebSocket event infrastructure
- Frontend receives `contagion_stats` events and displays state counts/grid coloring

</code_context>

<deferred>
## Deferred Ideas

- Observable behaviors (coughing when infected) — v2 feature for richer inference
- YAML configuration for rules — v2 feature for experiment flexibility
- Grid heatmap visualization — v2 frontend enhancement
- Spatial indexing for O(1) adjacency — performance optimization if needed

</deferred>

---

*Phase: 01-core-infrastructure*
*Context gathered: 2026-03-08*
