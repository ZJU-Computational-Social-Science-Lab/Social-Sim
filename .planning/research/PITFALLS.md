# Pitfalls Research

**Domain:** Multi-Agent Simulation Platform
**Researched:** 2026-03-18
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Context Loss Across Multi-Round Simulations

**What goes wrong:**
Agent prompts in subsequent rounds fail to include previous-round context, causing agents to "forget" earlier discussions, votes, or agreements. This invalidates multi-round deliberation experiments.

**Why it happens:**
- LLM context building only includes current turn/round data
- Prompt templates don't aggregate historical context across rounds
- Round boundary management treats each round as independent
- Memory systems aren't properly integrated into prompt construction

**How to avoid:**
- Implement explicit context aggregation that includes previous round summaries
- Store structured round summaries in scene state between rounds
- Modify prompt builders to reference `scene.state["history"]` or similar
- Test multi-round flows with context-dependent assertions

**Warning signs:**
- Agents repeat the same arguments in different rounds
- Agents ask questions that were answered in previous rounds
- Voting patterns reset each round without building on prior discussions
- Debug logs show truncated or missing historical context in LLM calls

**Phase to address:**
Phase: BUG-01 (Context Inheritance) - Critical priority for NeurIPS deadline

---

### Pitfall 2: Retry Logic Bypasses Game State Constraints

**What goes wrong:**
When connection errors occur during agent actions, retry mechanisms resend the same action without validating if the game state has transitioned. This allows voting after voting closes, contributing after deadlines, or actions in invalid phases.

**Why it happens:**
- Retry handlers don't check current scene phase before resubmitting
- Action validation happens only on first attempt, not retries
- Network error handlers assume state is unchanged during retry
- No timestamp or state_version validation on action submissions

**How to avoid:**
- Add phase/state validation in retry handlers before resubmission
- Include state snapshot IDs with action submissions for validation
- Reject actions that don't match current phase on server-side
- Log retry attempts with full context for debugging

**Warning signs:**
- Votes appearing after voting phase ends
- Duplicate actions with identical timestamps
- Actions succeeding that should have been rejected by phase rules
- Test failures showing race conditions between state transitions and retries

**Phase to address:**
Phase: BUG-06 (Voting Retry Constraints) - Critical priority for data integrity

---

### Pitfall 3: Token Endowment Validation Missing

**What goes wrong:**
Agents can contribute more tokens to Public Goods Game than they possess, creating impossible economic scenarios that invalidate experimental results.

**Why it happens:**
- Server-side validation only checks action format, not resource constraints
- Client-side validation exists but can be bypassed
- No integration between experiment state tracking and action handlers
- Game mechanics assume "honest" agents rather than enforcing constraints

**How to avoid:**
- Validate all resource-consuming actions against `ExperimentState.agents[name].resources`
- Return clear error messages when constraints are violated
- Add unit tests for boundary conditions (exact endowment, endowment+1, etc.)
- Log validation failures with context for debugging

**Warning signs:**
- Total contributions exceeding sum of all agent endowments
- Negative resource balances in experiment state
- Agents contributing identical maximum amounts across multiple rounds
- Payoff calculations producing impossible economic outcomes

**Phase to address:**
Phase: BUG-07 (Token Endowment Enforcement) - Critical for scientific validity

---

### Pitfall 4: Session Expiration During Long Experiments

**What goes wrong:**
User sessions expire during multi-round experiments or long-running simulations, causing redirects to login and loss of experiment context.

**Why it happens:**
- JWT tokens have short expiration for security (5-15 minutes)
- No automatic token refresh during WebSocket connections
- Long-running experiments exceed session timeout
- No session persistence across server restarts or reconnections

**How to avoid:**
- Implement refresh token rotation for long-lived experiments
- Use WebSocket heartbeats to refresh sessions automatically
- Store experiment state server-side with session-independent references
- Allow reconnection to active experiments via experiment ID, not just session

**Warning signs:**
- Users redirected to login mid-experiment
- WebSocket disconnections after fixed time intervals
- Experiment progress lost on page refresh
- "Session expired" errors during normal experiment flow

**Phase to address:**
Phase: BUG-03 (Session Loss) - High priority for user experience

---

### Pitfall 5: SimTree Data Loss on Docker Deployment

**What goes wrong:**
SimTree data disappears after approximately one week of Docker deployment, making it impossible to view or continue past experiments.

**Why it happens:**
- SimTree data stored in container filesystem instead of volumes
- Docker container recreation or updates wipe non-persistent storage
- No backup or migration strategy for SimTree serialization
- In-memory storage without proper volume mounting

**How to avoid:**
- Mount Docker volumes for all persistent data directories
- Implement periodic SimTree backups to external storage
- Use named volumes with proper retention policies
- Add health checks that verify data persistence on startup

**Warning signs:**
- SimTree data missing after container restart
- Empty experiment lists after updates
- Increasing container filesystem usage without cleanup
- No volume mounts in docker-compose.yml for data directories

**Phase to address:**
Phase: BUG-04 (Docker Persistence) - Critical for production deployment

---

### Pitfall 6: Duplicate Event Broadcasts

**What goes wrong:**
Events are broadcast multiple times to the same recipients, causing confusion, cluttered UI, and corrupted experiment logs.

**Why it happens:**
- Event emission happens at multiple points in action handling flow
- No deduplication logic in broadcast pipeline
- Race conditions between synchronous and asynchronous event handlers
- Event queue not properly flushed before rebroadcasting

**How to avoid:**
- Add unique IDs to all events for deduplication
- Implement idempotent broadcast methods that track sent events
- Flush event queue before state transitions that might trigger rebroadcast
- Add logging to track event lifecycle from creation to delivery

**Warning signs:**
- UI showing duplicate messages or actions
- Experiment logs with identical timestamps and content
- Event handlers executing multiple times per action
- WebSocket messages with duplicate event IDs

**Phase to address:**
Phase: BUG-05 (Duplicate Broadcasts) - Medium priority for UX and log integrity

---

### Pitfall 7: Hardcoded Text Breaking i18n

**What goes wrong:**
User-facing strings are hardcoded throughout the codebase, making it impossible to support multiple languages and requiring extensive refactoring later.

**Why it happens:**
- Rapid prototyping uses literal strings for speed
- No i18n framework established at project start
- Developer habit of writing strings directly in code
- Missing code review checkpoints for translation readiness

**How to avoid:**
- Use `T()` function (Python) or `t()` function (React) for all user-facing text
- Audit codebase with grep for hardcoded patterns: `[A-Z][a-z]+\s+[a-z]+`
- Add translation keys to both `en.json` and `zh.json` immediately
- Test UI with language switching to catch missing translations

**Warning signs:**
- Mixed languages in UI (some translated, some not)
- English text appearing in Chinese mode
- String concatenation for sentences (breaks translation)
- Date/time formats not locale-aware

**Phase to address:**
Phase: I18N-01 (i18n Audit) - High priority for international users

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| **Client-side validation only** | Faster implementation, simpler code | Data integrity issues, bypassable security | Never for scientific experiments |
| **In-memory state storage** | Fastest performance, simplest code | Data loss on restart, no scaling | MVP prototyping only |
| **Hardcoded LLM prompts** | Quick iteration, easy to test | No i18n, hard to maintain, no A/B testing | Initial experiments only |
| **Skipping error handling** | Faster development | Silent failures, harder debugging | Never - fails fast philosophy |
| **Monolithic scene files** | Fewer files to manage | Hard to test, merge conflicts, reusability | Never after prototype |
| **No action idempotency** | Simpler retry logic | Duplicate actions on retry | Never - always design idempotent actions |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **LLM Providers** | No retry on empty responses | Implement fallback with explicit JSON instruction in prompt |
| **WebSocket Events** | Assuming ordered delivery | Use sequence numbers and client-side ordering |
| **Docker Volumes** | Storing data in container layer | Always use named volumes or bind mounts |
| **Database Sessions** | Long-running transactions | Use short transactions with optimistic concurrency |
| **Redis Cache** | No cache invalidation strategy | Implement TTL-based or event-driven invalidation |
| **JWT Authentication** | Long-lived access tokens | Short access + refresh token rotation |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| **Context Window Bloat** | Slow LLM calls, truncated prompts | Summarize old context, use RAG for retrieval | 10+ rounds with 5+ agents |
| **Event Queue Backlog** | Delayed UI updates, memory growth | Batch events, implement backpressure | Long simulations with many agents |
| **SimTree Serialization** | Clone operations taking seconds | Use copy-on-write, lazy serialization | 50+ nodes in tree |
| **Agent Memory Growth** | Increasing memory usage over time | Implement memory window or summarization | 100+ turns per agent |
| **Database Query N+1** | Slow experiment loading | Use eager loading, denormalize when needed | 1000+ experiments in database |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| **Trusting Client Input** | Agents can cheat, invalid experiments | Always validate server-side against game rules |
| **Exposing Internal State** | Information leakage via error messages | Sanitize errors, use internal error codes |
| **No Rate Limiting** | API abuse, DoS vulnerabilities | Implement per-user and per-IP rate limits |
| **Weak Session Management** | Session hijacking during experiments | Use HttpOnly cookies, short-lived tokens |
| **No Input Sanitization** | Prompt injection attacks | Validate and sanitize all LLM inputs |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| **No Loading States** | Users think system froze during LLM calls | Show progress indicators with agent names |
| **Auto-advancing Turns** | Users can't read what happened | Pause for confirmation after each turn |
| **Hidden Game State** | Researchers can't validate experiment correctness | Show real-time state panel with all variables |
| **No Undo/Branching** | Mistakes require restarting entire experiment | Implement SimTree branching for "what-if" exploration |
| **Terminal Logging Only** | Can't debug production issues | Implement structured logging with web UI |

## "Looks Done But Isn't" Checklist

- [ ] **Context Inheritance**: Often missing round history aggregation — verify agents reference previous rounds in prompts
- [ ] **Action Validation**: Often only checking format, not game rules — verify contributions respect token endowments
- [ ] **Phase Constraints**: Often only UI enforcement — verify server-side rejects invalid actions for current phase
- [ ] **Retry Safety**: Often assumes state unchanged — verify retries check current phase before resubmitting
- [ ] **Data Persistence**: Often works in development — verify Docker volumes properly mounted and data survives restart
- [ ] **i18n Coverage**: Often main UI translated — verify error messages, tooltips, and LLM prompts are translatable
- [ ] **Error Recovery**: Often main path works — verify system recovers gracefully from LLM failures, network issues
- [ ] **Concurrent Access**: Often tested sequentially — verify multiple users can't interfere with each other's experiments

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| **Context Loss** | HIGH | Requires reprompting with round summaries, may need to restart experiments |
| **Invalid Voting Data** | HIGH | Delete corrupted votes, rerun voting phase, or mark experiment as invalid |
| **SimTree Data Loss** | HIGH | Restore from backups if available, otherwise data is permanently lost |
| **Session Expiration** | MEDIUM | User can reconnect if experiment ID preserved, otherwise restart from last checkpoint |
| **Duplicate Events** | LOW | Implement deduplication in UI, filter logs in analysis scripts |
| **Missing Translations** | MEDIUM | Add keys to locale files, restart server to reload translations |
| **Token Validation Bypass** | HIGH | Mark affected experiments as invalid, rerun with proper validation |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Context Loss Across Rounds | BUG-01 (Speak Follow-up Context) | Run multi-round test, verify agents reference previous rounds in logs |
| Retry Logic Bypassing Constraints | BUG-06 (Voting Retry Constraints) | Test with connection errors during phase transitions, verify rejection |
| Token Endowment Validation | BUG-07 (PGG Token Validation) | Unit tests for boundary conditions, integration tests for full games |
| Session Loss During Experiments | BUG-03 (Session Management) | Run experiments longer than JWT timeout, verify no login redirect |
| SimTree Data Loss on Docker | BUG-04 (Docker Persistence) | Restart container after 1 week, verify SimTree data intact |
| Duplicate Event Broadcasts | BUG-05 (Event Deduplication) | Monitor logs for duplicate event IDs, verify UI shows no duplicates |
| Hardcoded Text (i18n) | I18N-01 (i18n Audit) | Automated grep scan for hardcoded strings, manual UI review |
| Punishment Mechanism Edge Cases | FEAT-01 (PGG Punishment) | Test with various punishment parameters, verify economic constraints |
| Blind Choice Implementation | FEAT-02 (Coordination Blind Mode) | Verify agents can't see others' choices until all submitted |
| Misleading UI Fields | BUG-02 (Remove Max Rounds) | Verify UI only shows implemented fields, backend validates all inputs |

## Domain-Specific Anti-Patterns

### Anti-Pattern 1: The "Happy Path" Scene
**What:** Scene logic only works when agents behave correctly and take expected actions
**Why bad:** Real LLMs make mistakes, take unexpected actions, or get stuck
**Instead:** Design defensive scene logic that handles any valid action gracefully

### Anti-Pattern 2: The God Agent
**What:** One agent knows about the simulator, scene state, or other agents' private thoughts
**Why bad:** Breaks agent isolation assumption, invalidates experimental control
**Instead:** Strict separation — agents only know what's in their context and public broadcasts

### Anti-Pattern 3: The Synchronous LLM Assumption
**What:** Code assumes LLM calls always return valid responses
**Why bad:** Network failures, rate limits, or empty responses cause crashes
**Instead:** Always handle timeouts, empty responses, and parse failures explicitly

### Anti-Pattern 4: The Eternal Simulation
**What:** No termination conditions, simulations run forever
**Why bad:** Wastes resources, creates impossible-to-analyze data
**Instead:** Always define `is_complete()` with multiple termination conditions

### Anti-Pattern 5: The Global State Trap
**What:** Using module-level globals for scene or simulator state
**Why bad:** Breaks multi-tenancy, impossible to run concurrent simulations
**Instead:** All state must be instance-scoped (per Simulator, per Scene)

## Sources

- **Codebase Analysis**: Direct examination of simulator.py, council_scene.py, experiment/state.py
- **Project Requirements**: .planning/PROJECT.md bug descriptions (BUG-01 through BUG-07, I18N-01)
- **Established Patterns**: AGENTS.md (fail fast philosophy, no defensive coding in core engine)
- **Domain Knowledge**: Multi-agent simulation platforms, LLM integration patterns
- **Production Issues**: Git history showing SimTree disappearance, session loss reports

---
*Pitfalls research for: Multi-Agent Simulation Platform*
*Researched: 2026-03-18*
