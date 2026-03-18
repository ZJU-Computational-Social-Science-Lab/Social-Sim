# Project Research Summary

**Project:** Social-Sim Bug Fixes & Game Features Milestone
**Domain:** Multi-agent simulation platform for social science research
**Researched:** 2026-03-18
**Confidence:** HIGH

## Executive Summary

Social-Sim is a multi-agent simulation platform for social science research, specifically focused on game theory experiments like Public Goods Game and Coordination Game. The platform uses a Python 3.12 backend with Litestar for the API and a TypeScript/React frontend. Research confirms this is a brownfield project—the existing stack is current and appropriate. The core simulation engine follows an agent isolation principle where agents never know about the Simulator, making decisions based solely on their context and scene feedback.

The recommended approach prioritizes fixing critical bugs that invalidate experimental results before adding new features. Three bugs are particularly urgent: context inheritance across rounds (BUG-01), which blocks all multi-round deliberation experiments; retry logic bypassing voting stage constraints (BUG-06), which corrupts experiment data; and token endowment validation (BUG-07), which allows impossible economic scenarios in Public Goods Game. After these fixes, the platform should add customizable punishment mechanisms to Public Goods Game (FEAT-01) and complete a comprehensive i18n audit (I18N-01) to support Chinese researchers.

Key risks center on data integrity and reproducibility. The platform must maintain strict validation of game rules server-side (not just client-side), ensure state consistency across retries and reconnections, and preserve experiment data across Docker container restarts. The research reveals that most pitfalls stem from incomplete validation logic, inadequate state management during long-running experiments, and lack of comprehensive i18n infrastructure. Mitigation requires adding server-side constraint validation, implementing refresh token rotation for long-lived experiments, mounting Docker volumes for persistent data, and systematically replacing all hardcoded strings with translation keys.

## Key Findings

### Recommended Stack

This is a brownfield project with an established, current technology stack. No major changes are recommended. The focus should be on extending existing infrastructure rather than introducing new technologies.

**Core technologies:**
- **Python 3.12** — Backend runtime; 3.14 is incompatible with current dependencies (verified via requirements.txt)
- **Litestar 2.8.3+** — Modern async web framework; already integrated and appropriate for the use case
- **React 19.2.0 + TypeScript 5.8** — Frontend framework; latest stable versions with full type safety
- **i18next 25.7.1** — Frontend i18n framework; industry standard, already integrated
- **Custom JSON i18n system** — Backend translation via `T()` function; matches frontend structure for consistency
- **Vitest 4.0.18 + React Testing Library** — Frontend testing; already configured and appropriate
- **pytest + pytest-asyncio** — Backend testing; standard Python testing tools, async support required

**No new runtime dependencies are needed.** The only additions are testing tools (pytest-asyncio if missing) for comprehensive bug validation.

### Expected Features

The platform must deliver both table stakes features expected in multi-agent simulation frameworks and differentiating features that enable novel social science research.

**Must have (table stakes):**
- **Context inheritance across rounds** — Multi-round experiments require agents to remember previous actions and outcomes (LangGraph uses StateGraph, AgentScope uses msghub)
- **Action retry mechanisms** — Network failures are common; retries must preserve game state constraints
- **Resource constraint enforcement** — Economic games require valid payoffs; allowing contributions beyond endowments breaks experimental validity
- **Multi-language support (i18n)** — Research is global; Chinese researchers need native language support for UI and agent prompts
- **Session management** — Long-running experiments must maintain authentication state without disruption
- **Multi-agent conversation support** — Core use case for social science research
- **Event broadcasting** — Real-time UI updates for simulation progress
- **Payoff calculation engine** — Game theory scenarios require numerical outcomes based on agent actions

**Should have (competitive):**
- **Customizable punishment in PGG** — Enables study of altruistic punishment, social norms, and cooperation mechanisms (key research area in experimental economics)
- **Blind/simultaneous choice mode** — Allows study of coordination without communication; critical for pure coordination game research
- **Structured context builder with budget limits** — Prevents LLM context overflow while maintaining deterministic output
- **Information scope customization** — Fine-grained control over what agents observe (all/pair/neighbor/self)
- **Branching timeline (SimTree)** — Supports "what-if" exploration without rerunning entire experiments; unique in multi-agent simulation space
- **Multi-language agent prompts** — Agents respond in user's selected language; enables cross-cultural studies

**Defer (v2+):**
- **Max rounds field** — Creates false sense of control; no backend enforcement leads to user confusion. Remove or add enforcement later.
- **Auto-generated LLM summaries** — Deprecated in codebase; non-deterministic and budget-unbounded. Use structured context builder instead.
- **Global visibility by default** — Not appropriate for pairwise games; default to pair scope for pairwise games.

### Architecture Approach

Social-Sim uses a layered architecture with clear separation between the experiment engine and the legacy simulation system. The **ExperimentScene** is a standalone orchestrator for game theory scenarios that does NOT inherit from the legacy Scene class. It manages **ExperimentAgents** directly, maintaining the core principle of agent isolation—agents never know about the Simulator. The **ExperimentRunner** executes rounds with visibility modes (simultaneous/sequential/random/paired), manages the **RoundContextManager** for history tracking, and coordinates the **PayoffEngine** and **ActionHandler**.

**Major components:**
1. **ExperimentScene** — Standalone orchestrator for game theory scenarios. No Scene inheritance. Manages ExperimentAgents directly and persists ExperimentState.
2. **ExperimentRunner** — Executes rounds with visibility modes. Manages RoundContextManager, PayoffEngine, and ActionHandler. Orchestrates the three-layer LLM response handling (Controller → Validation → Reprompt).
3. **RoundContextManager** — Tracks action history per agent and builds filtered context based on InformationModel (all/pair/neighbor/none scope types). Critical for context inheritance across rounds.
4. **ExperimentAgent** — LLM-driven agent with role, knowledge base, and score. No dependency on Simulator. Maintains agent isolation principle.
5. **PayoffEngine** — Calculates payoffs for matrix/pool/feedback games. Supports pair/group modes. Extensible for new game types like punishment mechanisms.
6. **SimTree** — Branching timeline engine for "what-if" exploration. Each SimTreeNode stores a cloned Simulator. Operations: advance, branch, multi, chain.
7. **Backend API (Litestar)** — REST API for experiment lifecycle (create, run, compare). Integrates with SimTree for variant execution. WebSocket streaming for real-time updates.
8. **Frontend (React + TypeScript)** — Experiment builder UI, SimTree workspace, i18n integration via i18next.

### Critical Pitfalls

Research revealed seven critical pitfalls that threaten experimental validity and user experience. Most stem from incomplete validation logic, inadequate state management, and missing i18n infrastructure.

1. **Context Loss Across Multi-Round Simulations** — Agent prompts fail to include previous-round context, causing agents to "forget" earlier discussions. Prevent by implementing explicit context aggregation that includes previous round summaries in scene state and modifying prompt builders to reference historical context. Test multi-round flows with context-dependent assertions.

2. **Retry Logic Bypassing Game State Constraints** — Retry mechanisms resend actions without validating if game state has transitioned, allowing voting after voting closes. Prevent by adding phase/state validation in retry handlers before resubmission, including state snapshot IDs with action submissions, and rejecting actions that don't match current phase on server-side.

3. **Token Endowment Validation Missing** — Agents can contribute more tokens than they possess, creating impossible economic scenarios. Prevent by validating all resource-consuming actions against `ExperimentState.agents[name].resources`, returning clear error messages when constraints are violated, and adding unit tests for boundary conditions.

4. **SimTree Data Loss on Docker Deployment** — Data disappears after ~1 week because it's stored in container filesystem instead of volumes. Prevent by mounting Docker volumes for all persistent data directories, implementing periodic SimTree backups to external storage, and using named volumes with proper retention policies.

5. **Session Expiration During Long Experiments** — JWT tokens expire during multi-round experiments, causing login redirects and loss of experiment context. Prevent by implementing refresh token rotation for long-lived experiments, using WebSocket heartbeats to refresh sessions automatically, and storing experiment state server-side with session-independent references.

6. **Duplicate Event Broadcasts** — Events broadcast multiple times, causing confusion and cluttered logs. Prevent by adding unique IDs to all events for deduplication, implementing idempotent broadcast methods, and flushing event queue before state transitions.

7. **Hardcoded Text Breaking i18n** — User-facing strings hardcoded throughout codebase, making multi-language support impossible. Prevent by using `T()` function (Python) or `t()` function (React) for all user-facing text, auditing codebase with grep for hardcoded patterns, and adding translation keys to both locale files immediately.

## Implications for Roadmap

Based on combined research findings, the milestone should be structured into four phases prioritized by impact on experimental validity and alignment with the NeurIPS deadline.

### Phase 1: Critical Data Integrity Fixes (Week 1)

**Rationale:** These three bugs directly invalidate experimental results and block all multi-round deliberation research. They must be fixed first to enable any valid scientific experiments. The research shows these are high-confidence fixes based on clear codebase analysis.

**Delivers:** Working multi-round experiments with valid context, clean voting data, and economically sound payoffs.

**Addresses:**
- BUG-01: Context inheritance across rounds
- BUG-06: Retry logic enforcing voting stage constraints
- BUG-07: Token endowment validation in Public Goods Game

**Avoids:**
- Context Loss Across Multi-Round Simulations (Pitfall 1)
- Retry Logic Bypassing Game State Constraints (Pitfall 2)
- Token Endowment Validation Missing (Pitfall 3)

**Uses:**
- RoundContextManager for history tracking
- Validation layer in ExperimentController
- Pydantic for parameter validation

**Research flags:** None needed. These are well-understood bugs with clear fix paths in existing code.

### Phase 2: PGG Punishment Feature (Week 1-2)

**Rationale:** High research value for studying altruistic punishment and cooperation mechanisms. Builds on existing payoff engine patterns. Should be delivered after token validation is fixed to ensure punishment mechanics respect economic constraints.

**Delivers:** Configurable punishment mechanism for Public Goods Game with UI controls and backend payoff calculation.

**Addresses:**
- FEAT-01: Punishment mechanism in Public Goods Game

**Uses:**
- PayoffEngine extensibility
- ActionHandler for new action types
- GameConfig parameter passing
- Radix UI for form controls

**Research flags:** Medium priority. Punishment parameter ranges need literature review for standard experimental economics practices.

### Phase 3: i18n Infrastructure (Week 2-3)

**Rationale:** Foundation for supporting Chinese researchers. Affects entire codebase, so comprehensive audit is better than incremental fixes. Not blocking for NeurIPS but critical for platform adoption.

**Delivers:** Fully translatable UI and backend with English and Chinese translations for all user-facing text including error messages, LLM prompts, and UI labels.

**Addresses:**
- I18N-01: Audit and fix all hardcoded user-facing text

**Avoids:**
- Hardcoded Text Breaking i18n (Pitfall 7)

**Uses:**
- Existing i18next (frontend) and custom JSON system (backend)
- T() function for all backend strings
- t() function for all frontend strings

**Research flags:** Low priority. Mechanical work with established patterns. Limited guidance on multi-language LLM prompts—recommend testing with both EN and ZH prompts.

### Phase 4: Remaining Bugs & Coordination Feature (Week 3-4)

**Rationale:** Lower priority issues that improve UX but don't block experiments. Blind choice mode is important for coordination research but less urgent than core data integrity fixes.

**Delivers:** Cleaned UI without misleading fields, stable Docker deployments, no duplicate events, and blind choice mode for coordination games.

**Addresses:**
- BUG-02: Remove Max Rounds field
- BUG-03: Fix session loss during advance node
- BUG-04: Fix SimTree disappearing on Docker
- BUG-05: Eliminate duplicate event broadcasts
- FEAT-02: Blind choice mode for Coordination Game

**Avoids:**
- Session Expiration During Long Experiments (Pitfall 4)
- SimTree Data Loss on Docker Deployment (Pitfall 5)
- Duplicate Event Broadcasts (Pitfall 6)

**Uses:**
- Docker volume mounting
- Refresh token rotation
- Event deduplication logic
- Visibility mode parameter in ExperimentRunner

**Research flags:** Low priority. Mostly mechanical work. Blind choice mode has limited documentation—implementation based on general game theory knowledge.

### Phase Ordering Rationale

The phase order follows three principles: **criticality first**, **dependencies second**, and **foundation before enhancement**.

Criticality first: Phase 1 addresses bugs that invalidate experimental results. Without these fixes, no experiment data is trustworthy. The NeurIPS deadline makes this ordering non-negotiable.

Dependencies second: Phase 2 (punishment) depends on Phase 1's token validation to ensure punishment mechanics respect economic constraints. Phase 3 (i18n) and Phase 4 (remaining fixes) are largely independent but should come after core data integrity is assured.

Foundation before enhancement: i18n infrastructure (Phase 3) is a cross-cutting foundation that affects the entire codebase. Completing it before final bug fixes prevents rework. Similarly, adding punishment (Phase 2) extends the existing payoff engine—better to validate the base engine works before adding complexity.

This ordering also mitigates the most severe pitfalls first. Context loss, retry bypass, and token validation failures (Pitfalls 1-3) are addressed in Phase 1. Session loss, SimTree data loss, and duplicate events (Pitfalls 4-6) are addressed in Phase 4. Hardcoded text (Pitfall 7) is addressed comprehensively in Phase 3.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Punishment):** Punishment parameter ranges need literature review for standard experimental economics practices. Recommend consulting Public Goods Game research papers for typical cost-to-benefit ratios.
- **Phase 3 (i18n):** Limited guidance on multi-language LLM prompts. Recommend testing prompts with both English and Chinese to verify agent reasoning quality.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Critical Fixes):** Well-understood bugs with clear fix paths. Codebase analysis provides all necessary context.
- **Phase 4 (Remaining Bugs):** Mostly mechanical work. Docker volume mounting, event deduplication, and form UI cleanup are established patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified via codebase analysis (requirements.txt, package.json). All technologies are current and appropriate. |
| Features | MEDIUM | Table stakes features verified against LangGraph, AgentScope, and Mesa documentation. Differentiators (punishment, blind choice) have MEDIUM confidence based on general game theory knowledge. |
| Architecture | HIGH | Derived from direct source code analysis. Clear understanding of component responsibilities and data flow. |
| Pitfalls | HIGH | Based on codebase analysis, git history, and project requirements. Pitfalls map directly to documented bugs. |

**Overall confidence:** HIGH

The research is grounded in direct codebase analysis, which provides HIGH confidence in stack, architecture, and pitfalls. Feature research benefits from both codebase analysis and external framework documentation (LangGraph, AgentScope, Mesa). The MEDIUM confidence in features reflects limited documentation on specific game theory mechanics (punishment parameters, blind choice implementation), which are inferred from general domain knowledge rather than specific platform examples.

### Gaps to Address

- **Punishment parameter ranges:** Research needed on standard punishment cost ratios in experimental economics literature. Handle during Phase 2 planning by consulting Public Goods Game research papers.
- **Blind choice mode specifics:** Limited documentation on how other platforms implement simultaneous choice. Implementation based on general game theory knowledge—recommend testing thoroughly during Phase 4.
- **i18n best practices for LLM prompts:** Limited sources on multi-language agent reasoning. Handle during Phase 3 by testing prompts with both English and Chinese to verify quality.
- **Voting retry patterns:** No specific documentation found on retry mechanisms for voting stages. Implementation based on general application patterns—MEDIUM confidence, but approach is sound.

These gaps don't block roadmap creation but should be flagged for attention during phase-specific planning.

## Sources

### Primary (HIGH confidence)

**Codebase Analysis:**
- `requirements.txt` — Verified all current backend dependencies (Python 3.12 requirement, Litestar 2.8.3+, Pydantic 2.4+)
- `package.json` — Verified all current frontend dependencies (React 19.2.0, TypeScript 5.8, Vitest 4.0.18, i18next 25.7.1)
- `src/socialsim4/core/experiment/scene.py` — ExperimentScene orchestrator architecture
- `src/socialsim4/core/experiment/runner.py` — ExperimentRunner round execution and visibility modes
- `src/socialsim4/core/experiment/round_context.py` — RoundContextManager context inheritance implementation
- `src/socialsim4/core/experiment/payoff/engine.py` — PayoffEngine calculation patterns
- `src/socialsim4/i18n.py` — Backend i18n implementation (T() function)
- `src/socialsim4/locales/en.json` — Translation structure
- `backend/api/routes/experiments.py` — REST API patterns
- AGENTS.md — Core architecture principles (agent isolation, fail fast philosophy)

**External Documentation:**
- [Litestar 2.8+ documentation](https://docs.litestar.dev/) — Confirms async patterns and validation approach
- [pytest-asyncio documentation](https://pytest-asyncio.readthedocs.io/) — Async test fixture patterns
- [i18next 25.x documentation](https://www.i18next.com/) — React integration best practices
- [Vitest 4.x documentation](https://vitest.dev/) — Testing patterns for React applications

### Secondary (MEDIUM confidence)

**Multi-Agent Framework Research:**
- [AgentScope GitHub Repository](https://github.com/modelscope/agentscope) — Multi-agent framework with msghub context management. Confirms table stakes features for multi-agent platforms.
- [LangGraph Documentation](https://python.langchain.com/docs/langgraph) — StateGraph patterns for context persistence across rounds. Validates agent isolation and state management approaches.
- [Mesa Documentation](https://mesa.readthedocs.io/en/stable/) — Agent-based modeling framework. Confirms payoff calculation and token/counter system patterns.

**Domain Knowledge:**
- [Public Goods Game Wikipedia](https://en.wikipedia.org/wiki/Public_goods_game) — Punishment mechanisms in experimental economics (HIGH confidence for importance, MEDIUM for implementation details)

### Tertiary (LOW confidence)

**Inferred from General Patterns:**
- Voting retry constraints — Based on general web application patterns, not specific to multi-agent simulations
- Blind choice mode implementation — Based on general game theory knowledge, limited specific platform documentation found
- Punishment parameter ranges — Inferred from domain knowledge, needs experimental economics literature review

---
*Research completed: 2026-03-18*
*Ready for roadmap: yes*
