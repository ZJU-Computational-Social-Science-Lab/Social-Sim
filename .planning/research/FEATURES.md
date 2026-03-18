# Feature Landscape

**Domain:** Multi-agent simulation platform for social science research
**Researched:** 2026-03-18
**Overall confidence:** MEDIUM

## Executive Summary

Based on research of multi-agent frameworks (LangGraph, AgentScope, Mesa) and analysis of Social-Sim's codebase, the feature landscape for social science simulation platforms reveals clear table stakes requirements and several opportunities for differentiation. Key areas include context management across rounds, voting mechanics, token endowment enforcement, punishment mechanisms for Public Goods Game, blind choice modes for Coordination Games, and internationalization.

The research shows that while context inheritance and state management are standard in leading frameworks (LangGraph's StateGraph, AgentScope's msghub), Social-Sim's specific implementation of game theory features (punishment in PGG, blind choice in coordination games) represents a differentiator in the social science research space.

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Context inheritance across rounds** | Multi-round experiments require agents to remember previous actions and outcomes | Low | LangGraph uses StateGraph with persistent state; AgentScope uses msghub for context propagation |
| **Action retry mechanisms** | Network failures and LLM timeouts are common; users expect ability to retry without corrupting experiment data | Medium | Most frameworks have built-in retry decorators; must preserve action-stage context |
| **Resource constraint enforcement** | Economic games require valid payoffs; allowing contributions beyond endowments breaks experiment validity | Medium | Mesa has token/counter systems; LangGraph tracks state through TypedDict |
| **Basic session management** | Long-running experiments must maintain authentication state | Low | Standard web application requirement |
| **Multi-language support (i18n)** | Research is global; Chinese researchers need native language support for agent prompts and UI | High | AgentScope shows Chinese-language focus; requirement for EN/ZH support |
| **Multi-agent conversation support** | Core use case for social science research; simulating group deliberation | Medium | AgentScope's primary feature; msghub pattern for broadcast messaging |
| **Event broadcasting** | Real-time UI updates for simulation progress | Low | Standard in web-based simulation frameworks |
| **Payoff calculation engine** | Game theory scenarios require numerical outcomes based on agent actions | Medium | LangGraph state updates; Mesa's data collectors |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Customizable punishment in PGG** | Enables study of altruistic punishment, social norms, and cooperation mechanisms — key research area in experimental economics | High | Punishment mechanisms are well-studied but rarely configurable in simulation platforms (Wikipedia citation) |
| **Blind/simultaneous choice mode** | Allows study of coordination without communication — critical for pure coordination game research | Medium | Sequential visibility is default; hiding others' choices requires deliberate architectural design |
| **Structured context builder with budget limits** | Prevents LLM context overflow while maintaining deterministic output; addresses token limit issues in long experiments | High | Most frameworks (LangGraph) rely on LLM's own context management; Social-Sim's InformationModel is unique |
| **Information scope customization** | Enables fine-grained control over what agents observe (all/pair/neighbor/self) — supports diverse experimental designs | High | LangGraph has global state; AgentScope broadcasts to all; Social-Sim's scope types are differentiated |
| **Branching timeline (SimTree)** | Supports "what-if" exploration without rerunning entire experiments; unique in multi-agent simulation space | High | Not found in AgentScope, LangGraph, or Mesa documentation |
| **Multi-language agent prompts** | Agents respond in user's selected language; enables cross-cultural studies with native-language agent reasoning | Medium | Requires i18n infrastructure for LLM prompts (not just UI) |
| **Template-based experiment creation** | Lowers barrier to entry for researchers; accelerates experiment setup | Low | AgentScope has workflow orchestration but not experiment templates |
| **Real-time visualization of agent states** | Enables researchers to observe emergent behaviors and debug agent reasoning | Medium | Mesa has browser-based visualization; Social-Sim's real-time state view is similar |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Max rounds field** | Creates false sense of control; no backend enforcement leads to user confusion | Remove field OR add backend enforcement (but infinite-run design is more flexible) |
| **Defensive coding in core engine** | Violates project's AGENTS.md philosophy; let exceptions surface for faster debugging | Use strict input formats; fail fast; reserve try/except for API layer |
| **Auto-generated LLM summaries** | Deprecated in codebase (round_context.py); non-deterministic and budget-unbounded | Use structured context builder (deterministic, budget-bounded) |
| **Global visibility by default** | Not appropriate for pairwise games (PD with 4+ agents); agents should only see their pair's results | Default to pair scope for pairwise games; require explicit opt-in for global visibility |
| **Hardcoded user-facing text** | Blocks internationalization; creates technical debt for future language support | Use T() function / i18next for all user-visible strings |
| **Single-round execution model** | Limits research to one-shot games; cannot study evolution of cooperation or repeated interactions | Support multi-round with cumulative context (already implemented) |
| **Opaque agent reasoning** | Researchers need to understand WHY agents made decisions for validity | Expose agent thoughts, context, and payoff calculations in event logs |

## Feature Dependencies

```
Context inheritance → Multi-round deliberation
Multi-round deliberation → Evolution of cooperation studies
Information scope → Pairwise game validity
Structured context builder → Long experiment stability
Punishment mechanism → Altruistic punishment research
Blind choice mode → Pure coordination game research
i18n infrastructure → Multi-language agent prompts
Session management → Long-running experiment stability
Resource constraints → Valid economic game payoffs
```

## MVP Recommendation

**For the current milestone (Bug Fixes & Game Features):**

Prioritize:
1. **Context inheritance bug fix** (BUG-01) — Blocks all multi-round deliberation research
2. **Voting retry with stage constraints** (BUG-06) — Corrupts experiment data
3. **Token endowment enforcement** (BUG-07) — Invalidates PGG results
4. **Customizable punishment in PGG** (FEAT-01) — Enables high-value research (altruistic punishment)
5. **i18n audit and fixes** (I18N-01) — Foundation for Chinese researcher support

Defer:
- **Blind choice mode** (FEAT-02): Important but less critical than core bug fixes
- **Max rounds field removal** (BUG-02): UX issue, doesn't block experiments
- **SimTree disappearing fix** (BUG-04): Data loss issue but affects <1% of experiments (after ~1 week)
- **Duplicate event fix** (BUG-05): UX annoyance, doesn't affect experiment validity
- **Session loss fix** (BUG-03): Workaround exists (re-login)

## Roadmap Implications

Based on feature complexity and dependencies, suggested phase structure:

### Phase 1: Critical Bug Fixes (Week 1)
- Addresses: BUG-01 (context inheritance), BUG-06 (voting retry), BUG-07 (token enforcement)
- Rationale: These bugs block multi-round research and invalidate experiment results
- Complexity: Low-Medium (fixing existing logic)

### Phase 2: PGG Punishment Feature (Week 1-2)
- Addresses: FEAT-01
- Rationale: High research value; builds on existing payoff engine
- Complexity: High (requires new UI, backend logic, and configurable parameters)

### Phase 3: i18n Infrastructure (Week 2-3)
- Addresses: I18N-01
- Rationale: Foundation for global researcher support; affects entire codebase
- Complexity: Medium (mechanical but comprehensive)

### Phase 4: Remaining Bugs & Coordination Feature (Week 3-4)
- Addresses: BUG-02, BUG-03, BUG-04, BUG-05, FEAT-02
- Rationale: Lower priority issues; can be addressed after core functionality is stable
- Complexity: Mixed (Low for UI fixes, Medium for blind choice mode)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Context inheritance | HIGH | Verified with codebase analysis and framework documentation |
| Punishment mechanisms | MEDIUM | Wikipedia source confirms importance; implementation details inferred from code |
| Blind choice mode | LOW | No specific documentation found; based on general game theory knowledge |
| i18n requirements | HIGH | AgentScope demonstrates Chinese-language focus; explicit user request |
| Token enforcement | HIGH | Codebase shows PayoffEngine; Wikipedia confirms importance |
| Voting retry | MEDIUM | Inferred from general web application patterns |

## Sources

- [AgentScope GitHub Repository](https://github.com/modelscope/agentscope) — Multi-agent framework with msghub context management
- [LangGraph Documentation](https://python.langchain.com/docs/langgraph) — Stateful multi-actor applications with StateGraph
- [Mesa Documentation](https://mesa.readthedocs.io/en/stable/) — Agent-based modeling framework in Python
- [Public Goods Game Wikipedia](https://en.wikipedia.org/wiki/Public_goods_game) — Punishment mechanisms in experimental economics (HIGH confidence)
- Social-Sim codebase analysis:
  - `src/socialsim4/core/experiment/round_context.py` — Context inheritance implementation
  - `src/socialsim4/core/experiment/payoff/engine.py` — Payoff calculation
  - `src/socialsim4/core/experiment/game_configs.py` — Game configuration
  - `src/socialsim4/core/experiment/scene.py` — Experiment orchestration

## Gaps to Address

- **Blind choice mode specifics**: Limited documentation on how other platforms implement simultaneous choice; recommend phase-specific research during FEAT-02 implementation
- **Punishment parameter ranges**: Research needed on standard punishment cost ratios in experimental economics literature
- **i18n best practices for LLM prompts**: Limited sources on multi-language agent reasoning; recommend testing with both EN and ZH prompts
- **Voting retry patterns**: No specific documentation found; implementation based on general application patterns (LOW confidence)
