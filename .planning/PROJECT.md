# Social-Sim

## What This Is

A multi-agent social simulation platform with LLM-driven agents, branching timeline exploration (SimTree), and structured A/B testing experiments. Agents interact in configurable scenes (council chambers, werewolf games, grid worlds), making autonomous decisions via LLM calls while tracked for analysis and "what-if" exploration.

## Core Value

Agents make meaningful autonomous decisions that reveal emergent social dynamics — whether cooperating, competing, spreading information, or navigating complex scenarios.

## Requirements

### Validated

<!-- Inferred from existing codebase -->

- ✓ Agent-based simulation with LLM decision-making
- ✓ Branching timeline exploration (SimTree)
- ✓ Experiment framework with A/B testing and payoff calculation
- ✓ Council chamber and Werewolf game scenarios
- ✓ Real-time WebSocket simulation control
- ✓ RAG/knowledge base integration for agents
- ✓ Grid-based positioning (GridScene)
- ✓ Multi-language support (English/Chinese)

### Active

<!-- Current milestone: v1.0 Contagion Spread Framework -->

- [ ] General-purpose contagion/spread model for disease and information
- [ ] Configurable state transition rules (proximity-based and action-directed)
- [ ] Grid-based agent movement with adjacent visibility
- [ ] Speak action for targeted agent communication
- [ ] State decay/recovery rules per configuration

### Out of Scope

<!-- Explicit boundaries -->

- Non-LLM mathematical modeling (SIR equations without agents) — this framework requires agent decisions
- Real-time multiplayer — single-user simulation control only
- 3D spatial simulation — 2D grid only

## Context

This is a research platform for studying social dynamics through simulation. The existing codebase has a mature core engine (agents, scenes, actions, simulator) with an experiment framework for structured testing. The frontend provides visualization and control via React/TypeScript.

The contagion framework will extend the existing GridScene and add a new rule-based state transition system applicable to both epidemiological modeling and information diffusion studies.

## Constraints

- **Tech Stack**: Python 3.12 backend (Litestar), TypeScript frontend (React, Vite)
- **LLM Integration**: Must work with OpenAI, Gemini, and Ollama providers
- **Grid System**: Build on existing GridScene infrastructure
- **Backward Compatible**: Existing scenarios must continue to work

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| LLM-driven agents for spread model | Consistent with platform's agent architecture, enables studying decision-making in contagion scenarios | — Pending |
| Hidden states (agents infer from behavior) | More realistic social dynamics, agents must communicate to learn states | — Pending |
| Per-rule decay configuration | Flexibility for different models (disease recovery vs permanent information) | — Pending |
| Single-target speak action | Focused communication for gossip/rumors, simpler to implement | — Pending |

---
*Last updated: 2026-03-08 after milestone v1.0 initialization*
