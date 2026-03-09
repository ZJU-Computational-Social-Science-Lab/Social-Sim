# Feature Landscape

**Domain:** Contagion/Spread Framework for Multi-Agent Simulation
**Researched:** 2026-03-08
**Research Mode:** Ecosystem (features, patterns, expectations)

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Configurable State System** | Foundation of all spread models; must support custom states beyond SIR | Medium | Must allow arbitrary state definitions (Susceptible, Exposed, Infected, Recovered, etc.) |
| **State Transitions** | Core mechanic — agents change states based on rules | High | Needs rule engine supporting conditions and probabilistic transitions |
| **Proximity-Based Transmission** | Expected in spatial/disease models | Medium | Agents within distance N transmit states with probability P |
| **Hidden State Visibility** | Distinguishes disease models from info models | Low | States are private; agents infer from behavior or use test actions |
| **Turn-Based State Updates** | Required for deterministic simulation | Medium | States update per turn/phase based on configured rules |
| **Basic Statistics Tracking** | Users need to see spread dynamics | Low | Counts per state over time, infection rates, etc. |
| **Grid-Based Movement** | Spatial component of spread | Low | Already exists in VillageScene; needs adaptation |
| **Adjacent Agent Visibility** | Agents need to know who's nearby | Low | Already exists in LookAroundAction pattern |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Action-Directed Transmission** | Speak/talk actions can trigger spread (e.g., rumors, airborne disease) | Medium | Links social actions to contagion mechanics |
| **Per-Rule Decay Configuration** | Different recovery/transmission rates per state | Medium | Enables complex models (temporary immunity, staged recovery) |
| **LLM-Agent Behavior Integration** | Agents make decisions based on their (hidden) infection state | High | Agents behave differently when infected (e.g., secretive, symptomatic) |
| **Rule Condition System** | Rich rule conditions (time-based, count-based, state-based) | High | Enables scenarios like "spread for N turns then recover" |
| **Multi-State Parallel Tracking** | Track multiple contagions simultaneously (e.g., disease + rumor) | High | Independent state machines with interaction rules |
| **Spatial Heatmap Visualization** | See spread patterns across the grid | Medium | Frontend visualization of infected regions |
| **Branching Timeline Exploration** | Use SimTree to explore "what-if" intervention scenarios | High | Platform unique feature; compare different intervention strategies |
| **A/B Testing Framework Integration** | Use existing experiment framework for payoff analysis | Medium | Test different spread rules or interventions systematically |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Global State Visibility** | Eliminates emergence; agents should infer states from behavior | Hidden states with optional "test" action to reveal |
| **Continuous-Time Differential Equations** | Platform is agent-based discrete simulation; mixed semantics confuse | Stay discrete-time, per-turn updates |
| **Deterministic Spread (No Probability)** | Lacks realism; stochastic spread is table stakes | All transitions have probability parameters |
| **Single Hardcoded Model** | Framework should be general-purpose | Configurable rules for any spread model |
| **3D Spatial Simulation** | Out of scope; adds complexity without clear benefit | 2D grid only (VillageScene pattern) |
| **Real-time Multiplayer** | Out of scope; single-user simulation control only | Focus on analysis tools, not real-time collaboration |
| **Non-Agent SIR Equations** | Platform value is agent-based; use Python's scipy for mathematical models | This framework requires agent decisions and spatial interactions |
| **Network-Based Social Topology Only** | Grid spatial component is required for this milestone | Social networks optional, grid positioning required |

## Feature Dependencies

```
Configurable State System → State Transitions → Proximity-Based Transmission
Configurable State System → Action-Directed Transmission
State Transitions → Per-Rule Decay Configuration
Grid-Based Movement → Proximity-Based Transmission
Adjacent Agent Visibility → Proximity-Based Transmission
State Tracking → Basic Statistics Tracking
State Transitions → Rule Condition System (extension)
```

## Shared Infrastructure vs Domain-Specific

### Shared Infrastructure (Use for Both Disease and Information)

| Component | Purpose | Used By |
|-----------|---------|---------|
| **State Machine Engine** | Core state tracking and transitions | Disease, Information |
| **Rule Configuration System** | Define when/how states change | Disease, Information |
| **Grid Positioning** | Spatial agent placement | Disease, Information |
| **Movement Actions** | Agents move across grid | Disease, Information |
| **Adjacent Visibility** | Agents see nearby agents | Disease, Information |
| **Statistics Tracking** | Count states over time | Disease, Information |
| **Hidden State Property** | Private agent data | Disease, Information |
| **SimTree Integration** | Branching timelines | Disease, Information |
| **Experiment Framework** | A/B testing | Disease, Information |

### Disease-Specific Features

| Component | Purpose | Notes |
|-----------|---------|-------|
| **Incubation Period (E state)** | SEIR models have exposed-but-not-infectious phase | Not applicable to most info spread |
| **Recovery Immunity** | R state prevents reinfection | Information doesn't typically provide immunity |
| **Symptomatic Behavior** | Agents act differently when showing symptoms | Disease-only social cue |
| **Environmental Contamination** | Tiles hold infection (e.g., surfaces) | Information doesn't contaminate spaces |
| **Vaccination Actions** | Preemptive state change to immune | Not applicable to rumors |

### Information-Specific Features

| Component | Purpose | Notes |
|-----------|---------|-------|
| **Message Content Carries State** | The rumor IS the contagion | Disease transmission is content-agnostic |
| **Belief/Truth States** | Unaware, Heard, Believes, Corrected | More nuanced than binary infected |
| **Credibility Decay** | Rumors become less believable over time | Disease doesn't have "credibility" |
| **Counter-Rumor Actions** | Spread opposing information | Vaccination metaphor but semantically different |
| **Source Tracking** | Who told whom matters more | Disease traceability is optional |

## Categorization Summary

### Must-Have for MVP (Phase 1)
1. Configurable state system (SIR as minimum)
2. Proximity-based transmission rules
3. Grid-based positioning (reuse VillageScene)
4. Hidden state visibility (agents infer, don't see)
5. Basic statistics tracking

### Nice-to-Have (Phase 2)
6. Action-directed transmission (speak causes spread)
7. Per-rule decay configuration
8. LLM-agent behavior integration (infected agents act differently)
9. Spatial heatmap visualization

### Advanced (Phase 3+)
10. Rule condition system (complex trigger logic)
11. Multi-state parallel tracking
12. A/B testing framework integration
13. Branching timeline exploration (SimTree)

## Defer: [Feature]: [reason]

| Feature | Reason to Defer |
|---------|-----------------|
| **Environmental Contamination** | Complex interaction; not in initial requirements; Phase 2+ |
| **Multi-State Parallel Tracking** | Requires separate state machine instances; Phase 3 |
| **Full A/B Testing Integration** | Framework exists but contagion-specific payoff functions needed; Phase 3 |
| **Complex Rule Conditions** | Simple probability-based rules sufficient for MVP; Phase 2 |

## MVP Recommendation

Prioritize:
1. **Configurable State System** — Foundation for everything
2. **Grid-Based Positioning** — Reuse VillageScene infrastructure
3. **Proximity-Based Transmission** — Core spread mechanic
4. **Hidden State Property** — Privacy is key distinction
5. **Basic Statistics** — Verify simulation is working

Defer:
- Action-directed transmission (can add after proximity works)
- Complex rule conditions (keep it simple first)
- LLM-agent behavior changes (needs prompt engineering work)

## Disease vs Information Spread: Key Differences

| Aspect | Disease Spread | Information/Rumor Spread |
|--------|---------------|-------------------------|
| **Transmission** | Physical proximity, airborne | Communication (speak, messages) |
| **Incubation** | Common (exposed → infectious) | Rare (instant awareness) |
| **Recovery** | Regains health, may have immunity | Forgets, disbelieves, or believes permanently |
| **Symptoms** | Observable changes in behavior | May spread intentionally (unlike disease) |
| **Intervention** | Quarantine, vaccine, distancing | Correction, counter-message, fact-checking |
| **Asymptomatic Spread** | Yes (hidden infectious) | Spreading rumors is intentional act |
| **Immunity** | Common (recovered can't re-infect) | Rare (can be re-convinced) |

## Sources

### Training Knowledge (LOW Confidence — Needs Verification)
- SIR/SEIR model descriptions from epidemiological literature
- Agent-based modeling patterns for contagion
- Information diffusion research (threshold models, cascade models)
- Grid-based cellular automata for spatial simulation

### Existing Codebase (HIGH Confidence)
- VillageScene (grid positioning, movement, pathfinding) — Verified
- TalkToAction (proximity-based chat) — Verified
- Action base class (extensibility pattern) — Verified
- Experiment framework (A/B testing infrastructure) — Verified

### Missing Sources (Research Gaps)
- Current best practices in ABM contagion frameworks (2025-2026)
- Performance patterns for large-scale agent state management
- Standard visualization approaches for spatial contagion
- Information spread model taxonomies (beyond SIR analogies)

---

**Confidence Note:** Web search tools experienced technical issues during research. Most contagion-specific findings are based on training knowledge (LOW confidence) and should be verified with official documentation or recent literature before implementation. The existing codebase analysis (HIGH confidence) provides reliable patterns for implementation.
