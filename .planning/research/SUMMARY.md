# Project Research Summary

**Project:** Social-Sim Contagion Spread Framework
**Domain:** Multi-agent contagion/spread modeling on grid-based systems
**Researched:** 2026-03-08
**Confidence:** HIGH

## Executive Summary

The contagion/spread framework is an agent-based simulation system for modeling disease transmission and information diffusion across spatially distributed LLM-driven agents. Expert implementations use **minimal external dependencies**, leveraging Python's standard library for state management and probability while building on existing grid infrastructure for spatial operations. The key architectural principle is **agent isolation** — state transitions happen via scene-orchestrated rule evaluation, not agent decisions, with agents inferring states from observed behaviors rather than accessing hidden ground truth.

The recommended approach creates a **ContagionScene** that extends existing Scene patterns, introduces a **declarative rule configuration system** (YAML/JSON) for defining states and transitions, and implements **proximity-based transmission** using the existing GameMap infrastructure. Critical risks include **state-behavior desynchronization** (agents acting against their contagion state) and **LLM non-determinism masking real effects** (preventing reproducibility). These are mitigated by always including current state in agent context prompts and implementing deterministic mode with seeding for experiments.

The framework reuses existing platform infrastructure (GridMechanic, GameMap, ActionController, action system) and requires **zero new external dependencies** — all contagion mechanics can be built with Python standard library, Pydantic for validation, and existing action/scene patterns. This maintains consistency with the project's prototype-first philosophy while keeping the codebase maintainable.

## Key Findings

### Recommended Stack

**NO NEW EXTERNAL DEPENDENCIES REQUIRED.** The contagion framework can be built entirely using Python's standard library and existing infrastructure. Adding epidemiological libraries (ndlib, Epydemic) or state machine packages (transitions) would increase complexity without meaningful benefit.

**Core technologies:**
- **Python standard library (enum, dataclasses, random)** — State representation and probabilistic transitions. Built-in, type-safe, and consistent with existing codebase patterns.
- **Existing GridMechanic/GameMap** — Grid positioning, movement, and adjacency queries. Already provides spatial operations needed for proximity-based spread.
- **Existing action system** — Agent behaviors (speak, move). Extend with targeted communication for contagion transmission.
- **Pydantic ^2.4.2 (existing)** — Rule configuration validation. Already in stack, validates contagion rule definitions.

### Expected Features

**Must have (table stakes):**
- **Configurable State System** — Foundation of all spread models; must support custom states beyond SIR (Susceptible, Exposed, Infected, Recovered, etc.)
- **State Transitions** — Core mechanic where agents change states based on probabilistic rules with configurable conditions
- **Proximity-Based Transmission** — Expected in spatial models; agents within distance N transmit states with probability P
- **Hidden State Visibility** — Distinguishes disease models from info models; states are private and agents infer from behavior
- **Turn-Based State Updates** — Required for deterministic simulation; states update per turn/phase based on configured rules
- **Basic Statistics Tracking** — Users need to see spread dynamics (counts per state over time, infection rates)

**Should have (competitive):**
- **Action-Directed Transmission** — Speak/talk actions trigger spread (e.g., rumors, airborne disease), linking social actions to contagion mechanics
- **Per-Rule Decay Configuration** — Different recovery/transmission rates per state, enabling complex models (temporary immunity, staged recovery)
- **LLM-Agent Behavior Integration** — Agents make decisions based on their (hidden) infection state, behaving differently when infected
- **Rule Condition System** — Rich rule conditions (time-based, count-based, state-based) for scenarios like "spread for N turns then recover"

**Defer (v2+):**
- **Environmental Contamination** — Complex interaction; tiles hold infection (e.g., surfaces). Not in initial requirements.
- **Multi-State Parallel Tracking** — Requires separate state machine instances for tracking multiple contagions simultaneously. Phase 3.
- **Full A/B Testing Integration** — Framework exists but contagion-specific payoff functions needed. Phase 3.
- **Complex Rule Conditions** — Simple probability-based rules sufficient for MVP. Phase 2.

### Architecture Approach

The contagion framework integrates with the existing multi-agent simulation architecture by **extending the Scene-based pattern** established in VillageScene. State tracking lives at the Scene level (via scene.state), rule evaluation occurs in a dedicated ContagionRules module, and state transitions happen through Scene hooks (pre_run, post_turn). This maintains agent isolation — agents never trigger their own contagion transitions; rules are environment-driven.

**Major components:**
1. **ContagionScene** — Extends Scene class, manages grid-based positioning (reusing VillageScene patterns), orchestrates contagion rule evaluation each turn, tracks agent contagion states in scene.state, and provides state prompts to agents (observed behaviors, not hidden states)
2. **ContagionRules module** — Core rule evaluation engine that loads and validates contagion configuration, evaluates proximity-based transitions (infection spread), evaluates action-based transitions (speak_to spreads information), applies decay/recovery rules per state, and tracks transition history
3. **Configuration schema (YAML/JSON)** — Declarative rule definitions for states, transitions, conditions, and decay parameters, enabling researchers to experiment with different models (SIR, SEIR, information diffusion) by changing config files, not code

### Critical Pitfalls

1. **Silent State Violations** — Agents' internal state becomes desynchronized from their behavior (e.g., "infected" agent takes no infection-consistent actions). **Avoid by:** Always including current contagion state in agent context/prompt, validating behavior compatibility after each action, logging all state transitions with timestamps.

2. **LLM Non-Determinism Masking Real Effects** — Natural randomness in LLM responses makes it impossible to distinguish between "contagion rules not working" and "agents just made different choices this run." **Avoid by:** Implementing deterministic mode with temperature=0 and seeded randomness for experiments, running multiple replications with confidence intervals, caching LLM responses during development.

3. **Configurable Rules Creating Impossible States** — User configures rules with logical contradictions (e.g., "infection duration: 0 turns" but "recovery probability: 0%"), leading to agents stuck in permanent states. **Avoid by:** JSON schema validation for rule combinations, cross-constraint checking before simulation starts, sensible defaults with pre-configured rule sets.

4. **Grid Adjacency Calculation Performance** — O(n²) comparisons for "adjacent agents" make simulations crawl as agent count increases. **Avoid by:** Using grid-based lookup (agents by cell) for O(1) adjacency, caching adjacency recalculating only when agents move, lazy evaluation only for agents taking actions.

5. **Prompt State Mismatch** — Agent's prompt says "you are healthy" but their internal state is "infected," causing stale information. **Avoid by:** Rebuilding agent context fresh immediately before every action, state versioning in prompts to reject stale prompts, synchronous actions (no queuing for future turns).

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Core Contagion Mechanics
**Rationale:** Foundation for all spread functionality. State system and rule engine must exist before any transmission can occur. This phase addresses the critical "Silent State Violations" pitfall by establishing state-behavior consistency from day one.

**Delivers:**
- ContagionScene with grid-based positioning
- ContagionRules module with proximity-based transitions
- Declarative YAML configuration system
- State tracking in scene.state and agent.properties
- Basic statistics (state counts per turn)

**Addresses:** Configurable State System, State Transitions, Proximity-Based Transmission, Hidden State Visibility, Turn-Based State Updates, Basic Statistics Tracking

**Avoids:** Silent State Violations (state always in prompts), Impossible States (rule validation schema), Prompt State Mismatch (fresh context per action)

**Stack elements:** Python standard library (enum, dataclasses, random), existing GridMechanic/GameMap, existing action system, Pydantic

### Phase 2: Action-Based Transmission & LLM Integration
**Rationale:** Once proximity-based spread works, add social contagion mechanics. This phase introduces the platform's key differentiator — LLM agents making decisions based on their infection state.

**Delivers:**
- SpeakToAction extension for targeted communication
- Action-based transition rules (speak_to triggers spread)
- LLM-agent behavior integration (infected agents act differently)
- Observable behavior system (agents infer states from symptoms)
- Observer mode for debugging (ground truth visibility)

**Addresses:** Action-Directed Transmission, LLM-Agent Behavior Integration, Per-Rule Decay Configuration

**Avoids:** Grid Adjacency Calculation Performance (use spatial indexing), LLM Doesn't Follow Rules (code enforcement + strong prompting)

**Uses:** Existing action system (TalkToAction), existing LLM providers

### Phase 3: Visualization & Analysis
**Rationale:** Research is useless without analysis tools. This phase provides the data needed for publication and experimentation.

**Delivers:**
- Spatial heatmap visualization (see spread patterns across grid)
- Transition event logging with export (JSON/CSV)
- State timeline charts and infection/recovery curves
- Statistical analysis tools
- Replay system with full state visibility

**Addresses:** Spatial Heatmap Visualization, transition history, research validation

**Avoids:** Hidden State Creates Unverifiable Results (observer mode), State Transitions Not Logged (comprehensive logging)

**Uses:** Existing WebSocket infrastructure, existing frontend components

### Phase 4: Advanced Features
**Rationale:** Platform differentiators and experimental capabilities. Only after core mechanics are solid should complex features be added.

**Delivers:**
- Rule condition system (complex trigger logic)
- Multi-state parallel tracking (multiple contagions)
- A/B testing framework integration (contagion-specific payoff functions)
- Branching timeline exploration with SimTree (what-if intervention scenarios)

**Addresses:** Rule Condition System, Multi-State Parallel Tracking, A/B Testing Framework Integration, Branching Timeline Exploration

**Uses:** Existing experiment framework, existing SimTree infrastructure

### Phase Ordering Rationale

- **Phase 1 first** because state system and rule engine are foundational — nothing works without them. Addressing "Silent State Violations" early prevents architectural rewrites.
- **Phase 2 second** because it extends Phase 1 mechanics with LLM integration, the platform's unique value proposition. Proximity spread must work before social contagion can be layered on top.
- **Phase 3 third** because visualization and analysis build on working simulation. Can't visualize what doesn't exist yet.
- **Phase 4 last** because advanced features require solid core mechanics. Complex rule conditions and multi-state tracking add unnecessary risk early.

**Grouping by architecture patterns:**
- Phases 1-2 focus on **backend simulation engine** (ContagionScene, ContagionRules, actions)
- Phase 3 focuses on **observability and analysis** (visualization, logging, export)
- Phase 4 focuses on **experimental capabilities** (A/B testing, branching timelines)

**How this avoids pitfalls:**
- **Phase 1** directly addresses 3 of 5 critical pitfalls (Silent State Violations, Impossible States, Prompt State Mismatch)
- **Phase 2** addresses LLM-specific pitfalls (LLM Non-Determinism, LLM Doesn't Follow Rules) through deterministic mode and code enforcement
- **Phase 3** addresses observability pitfalls (Hidden State Unverifiable, Transitions Not Logged)
- **Phase 4** is intentionally late to prevent premature complexity

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (LLM Integration):** Complex integration point — need to research prompt engineering patterns for contagion-aware agent behaviors. Sparse documentation on LLM agent contagion models.
- **Phase 3 (Visualization):** Frontend visualization patterns for spatial contagion — need to research best practices for heatmap visualization in React/TypeScript.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Core Mechanics):** Well-documented patterns from existing VillageScene implementation. High confidence in approach.
- **Phase 4 (Advanced Features):** Builds on existing experiment framework and SimTree patterns. Standard extensibility work.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Based on verified analysis of existing codebase (VillageScene, GridMechanic, action system). No external dependencies needed is a definitive finding. |
| Features | MEDIUM | Table stakes features well-established in agent-based modeling domain. Differentiators based on platform's LLM-agent unique value proposition. Web search had technical issues but training knowledge sufficient for feature landscape. |
| Architecture | HIGH | Architecture based on verified existing patterns (Scene extension, agent.properties, GameController hooks). Component boundaries clear. Integration points well-understood from codebase analysis. |
| Pitfalls | MEDIUM | ABM pitfalls well-established in literature. LLM-specific pitfalls based on known LLM agent challenges. Could benefit from verification with recent LLM-agent contagion research papers (2024-2026). |

**Overall confidence:** HIGH

**Confidence rationale:**
- Stack and architecture findings are **HIGH confidence** because they're based on verified existing codebase patterns
- Feature landscape is **MEDIUM confidence** because web search tools experienced issues, but domain knowledge is well-established
- Pitfalls are **MEDIUM confidence** because they're based on standard ABM and LLM integration principles, but recent research (2024-2026) could provide additional insights

### Gaps to Address

- **LLM-agent contagion prompt engineering:** Need to research best practices for prompting infected/aware agents. How do we make agents behave differently when infected without breaking character? Address during Phase 2 planning.
- **Spatial visualization patterns:** Need to research React/TypeScript heatmap visualization libraries and approaches for grid-based contagion display. Address during Phase 3 planning.
- **Performance at scale:** O(n²) adjacency checks identified as risk. Spatial partitioning strategies need research before implementing 1000+ agent simulations. Address during Phase 1 optimization.
- **Recent academic research:** Web search tools had technical issues. Should verify findings against recent arXiv papers on "LLM agent contagion 2024 2025 2026" and Journal of Artificial Societies and Social Simulation for ABM validation approaches. Address during Phase 1-2 planning.

## Sources

### Primary (HIGH confidence)
- **Existing codebase analysis:** Verified implementation of VillageScene (grid positioning, movement, pathfinding), TalkToAction (proximity-based chat), Action base class (extensibility pattern), Experiment framework (A/B testing infrastructure), Agent.properties pattern
- **Python standard library documentation:** `enum` module, `dataclasses`, `random` module
- **Pydantic 2.4 documentation:** Configuration validation patterns
- **Project documentation:** `.planning/PROJECT.md` (contagion requirements and key decisions), `.planning/codebase/ARCHITECTURE.md` (overall platform architecture), `.planning/codebase/STRUCTURE.md` (directory structure and conventions)

### Secondary (MEDIUM confidence)
- **Agent-based modeling principles:** Standard ABM patterns from computational social science literature
- **Grid simulation best practices:** Spatial indexing and performance optimization patterns for cellular automata
- **Configurable rule systems:** Validation patterns from simulation configuration literature
- **LLM integration patterns:** Known challenges from LLM agent frameworks (AutoGen, LangChain agents)

### Tertiary (LOW confidence)
- **Epidemiological library comparisons:** Mentioned as network/mathematical model libraries (ndlib, Epydemic, SIRModels) but NOT suitable for agent-based grid systems
- **State machine libraries:** Mentioned as unnecessary (transitions library) but based on training knowledge, not verified against recent implementations
- **Recent contagion research:** Web search tools experienced technical issues. Findings based on training knowledge up to 2024. Should verify against 2025-2026 research.

---
*Research completed: 2026-03-08*
*Ready for roadmap: yes*
