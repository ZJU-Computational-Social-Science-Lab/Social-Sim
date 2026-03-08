# Domain Pitfalls

**Domain:** LLM-driven agent contagion/spread modeling
**Researched:** 2026-03-08
**Confidence:** MEDIUM (Based on agent-based modeling principles and LLM integration patterns)

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Silent State Violations

**What goes wrong:** Agents' internal state (disease status, information) becomes desynchronized from their behavior. An agent marked "infected" takes no actions consistent with infection, or "recovered" agents continue spreading.

**Why it happens:**
- State transitions happen in background without agent participation
- LLM decisions don't account for current state (prompt doesn't include it)
- Race conditions between rule-based state changes and agent action selection

**Consequences:**
- Simulation produces nonsense results (infected agents never infect others)
- Researchers waste hours debugging why "contagion doesn't work"
- Loss of trust in simulation validity

**Prevention:**
- **State Awareness:** Always include current contagion state in agent context/prompt
- **Behavior Validation:** After each action, verify it's compatible with agent's state
- **Transition Logging:** Log all state transitions with timestamps for debugging
- **State Machine Enforcement:** Use strict state machines that prevent illegal transitions

```python
# CORRECT: State is part of agent context
def get_agent_context(agent, simulator):
    return {
        "name": agent.name,
        "contagion_state": agent.contagion_state,  # Always included
        "visible_agents": get_visible_agents(agent),
        # Agent's LLM prompt always knows their state
    }

# WRONG: State not communicated to agent
def get_agent_context_bad(agent, simulator):
    return {
        "name": agent.name,
        "visible_agents": get_visible_agents(agent),
        # Agent has no idea they're infected!
    }
```

**Detection:**
- Unit tests that agents with state X always have that state in their context
- Integration tests that verify state transitions trigger behavior changes
- Debug mode that highlights state-behavior mismatches

**Phase to address:** Phase 1 (Core contagion mechanics)

---

### Pitfall 2: LLM Non-Determinism Masking Real Effects

**What goes wrong:** Natural randomness in LLM responses makes it impossible to distinguish between "contagion rules not working" and "agents just made different choices this run."

**Why it happens:**
- LLM temperature > 0 produces different outputs for identical inputs
- No seed setting for reproducibility
- Researchers can't replicate interesting behaviors

**Consequences:**
- Can't debug rule issues (is it the rule or the LLM?)
- Can't publish reproducible research
- A/B testing becomes meaningless

**Prevention:**
- **Seeded Randomness:** Always use seeds for LLM calls in experiments
- **Deterministic Mode:** Run simulations with temperature=0 for debugging
- **Statistical Controls:** Run multiple replications and report confidence intervals
- **LLM Caching:** Cache LLM responses during development for faster iteration

```python
# CORRECT: Configurable determinism
class LLMProvider:
    def generate(self, prompt, temperature=0.7, seed=None):
        if self.deterministic_mode:
            temperature = 0
            seed = seed or self.fixed_seed
        return self._call_llm(prompt, temperature, seed)

# WRONG: No control over randomness
def generate(self, prompt, temperature=0.7):
    return self._call_llm(prompt, temperature)  # Can't reproduce!
```

**Detection:**
- Automated tests that same seed → same output
- Documentation requiring seed reporting for all experiments

**Phase to address:** Phase 0 (Infrastructure setup)

---

### Pitfall 3: Configurable Rules Creating Impossible States

**What goes wrong:** User configures rules that create logical contradictions (e.g., "infection duration: 0 turns" but "recovery probability: 0%"), leading to agents stuck in permanent states or breaking the simulation.

**Why it happens:**
- Rules configured independently without validation
- No cross-rule constraint checking
- Edge cases not considered (e.g., decay rate > 1.0)

**Consequences:**
- Simulations hang or crash
- Users lose trust in configuration system
- Hard to debug which rule caused the problem

**Prevention:**
- **Rule Validation Schema:** JSON schema that validates rule combinations
- **Cross-Constraint Checking:** Validate rules against each other before simulation starts
- **Sensible Defaults:** Provide pre-configured rule sets for common scenarios
- **Clear Error Messages:** Explain exactly which rules conflict and why

```python
# CORRECT: Validate rule combinations
def validate_contagion_rules(rules: dict) -> list[str]:
    errors = []
    if rules["infection_duration"] == 0 and rules["recovery_rate"] == 0:
        errors.append("Infinite infection: duration=0 and recovery_rate=0")
    if rules["spread_rate"] > 1.0:
        errors.append("Spread rate cannot exceed 1.0")
    # ... more validations
    return errors

# WRONG: No cross-rule validation
def validate_rules(rules: dict) -> bool:
    return all(0 <= v <= 1 for v in rules.values())  # Misses interactions!
```

**Detection:**
- Unit tests for all invalid rule combinations
- Integration test that simulation rejects bad configs
- User testing with rule configuration UI

**Phase to address:** Phase 1 (Core contagion mechanics + configuration)

---

## Moderate Pitfalls

### Pitfall 1: Grid Adjacency Calculation Performance

**What goes wrong:** Each turn, calculating "adjacent agents" requires O(n²) comparisons, making simulations crawl as agent count increases.

**Why it happens:**
- Naive implementation checks every agent against every other
- No spatial indexing or caching
- Repeated calculations for same pairs

**Consequences:**
- Simulations with >50 agents become unusably slow
- LLM calls (already slow) compound the problem
- Users abandon the tool

**Prevention:**
- **Spatial Indexing:** Use grid-based lookup (agents by cell) for O(1) adjacency
- **Cache Adjacency:** Recalculate only when agents move
- **Lazy Evaluation:** Only calculate adjacency for agents taking actions

```python
# CORRECT: Grid-based adjacency
class GridScene:
    def get_adjacent_agents(self, agent):
        x, y = agent.position
        adjacent = []
        for dx, dy in [(0,1), (0,-1), (1,0), (-1,0)]:
            adjacent.extend(self.grid[x+dx][y+dy].agents)
        return adjacent

# WRONG: O(n²) scanning
def get_adjacent_agents(self, agent):
    adjacent = []
    for other in self.agents:
        if is_adjacent(agent.position, other.position):
            adjacent.append(other)
    return adjacent
```

**Detection:**
- Benchmark tests with increasing agent counts
- Performance profiling before committing grid code

**Phase to address:** Phase 1 (Grid movement implementation)

---

### Pitfall 2: Hidden State Creates Unverifiable Results

**What goes wrong:** With agents not knowing each other's true states (only inferring from behavior), researchers can't verify if the simulation is working correctly without invasive debugging.

**Why it happens:**
- States are intentionally hidden from agents
- No observer mode that shows ground truth
- Logs don't reveal what actually happened

**Consequences:**
- Can't trust simulation results
- Can't demonstrate correctness to others
- Debugging becomes guesswork

**Prevention:**
- **Observer Mode:** Separate view showing all agent states and transitions
- **Comprehensive Logging:** Detailed logs of all state changes with reasons
- **Visualization:** Color-coded agents by state in grid view
- **Replay System:** Ability to replay simulation with full state visibility

**Detection:**
- User testing with research scenarios
- Documentation showing how to verify results

**Phase to address:** Phase 2 (Visualization and debugging tools)

---

### Pitfall 3: Speak Action Never Targets Infected Agents

**What goes wrong:** Agents randomly choose who to speak to, rarely selecting infected agents, so information/disease spreads artificially slowly or not at all.

**Why it happens:**
- Target selection is uniform random
- Agents don't bias toward "interesting" targets
- No network structure or preference patterns

**Consequences:**
- Contagion spreads unrealistically slowly
- Researchers conclude "LLM agents don't spread information"
- Actually a bug in targeting logic

**Prevention:**
- **Configurable Targeting:** Allow bias toward certain states or attributes
- **Social Networks:** Agents prefer speaking to "friends" or nearby agents
- **Event-Driven Speaking:** Agents more likely to speak when they have something to say
- **Track Speaking Patterns:** Log who speaks to whom for analysis

```python
# CORRECT: Configurable targeting bias
def select_speak_target(agent, visible_agents, targeting_strategy="uniform"):
    if targeting_strategy == "uniform":
        return random.choice(visible_agents)
    elif targeting_strategy == "prefer_infected":
        infected = [a for a in visible_agents if a.state == "infected"]
        return random.choice(infected or visible_agents)
    # ... more strategies

# WRONG: No flexibility, always uniform
def select_speak_target(agent, visible_agents):
    return random.choice(visible_agents)
```

**Detection:**
- Unit tests for targeting distribution
- Integration tests verifying spread occurs under known conditions

**Phase to address:** Phase 1 (Speak action implementation)

---

## Minor Pitfalls

### Pitfall 1: Decay Rules Create Fractional States

**What goes wrong:** Decay happens probabilistically each turn, but researchers expect deterministic duration (e.g., "exactly 5 turns"), leading to confusion about when recovery happens.

**Why it happens:**
- Probabilistic decay is easier to implement
- Not clearly documented or visualized
- No option for deterministic vs. probabilistic

**Consequences:**
- Users confused about timing
- Can't create precise scenarios
- Documentation doesn't match behavior

**Prevention:**
- **Clear Documentation:** Explain probabilistic nature with examples
- **Visual Timers:** Show expected recovery time in UI
- **Configurable Mode:** Allow both probabilistic and deterministic decay

**Phase to address:** Phase 1 (Decay rules)

---

### Pitfall 2: Proximity Triggers Check Every Turn for Every Agent

**What goes wrong:** Every turn, checking every adjacent pair for contagion spread becomes expensive and creates subtle bugs (e.g., double-counting infections).

**Why it happens:**
- No deduplication of pair checks
- Both A→B and B→A checked separately
- No clear "who spreads to whom" ordering

**Consequences:**
- Performance issues
- Double infection probability
- Hard to reason about spread mechanics

**Prevention:**
- **Directed Spread:** Only infected→susceptible checks, not both ways
- **Once Per Turn:** Each pair evaluated at most once per turn
- **Clear Ordering:** Document exactly when spread checks happen

```python
# CORRECT: Directed, ordered spread
def process_spread(simulator):
    already_processed = set()
    for agent in simulator.agents:
        if agent.can_spread():
            for target in agent.get_adjacent_agents():
                pair = tuple(sorted([agent.id, target.id]))
                if pair not in already_processed:
                    attempt_spread(agent, target)
                    already_processed.add(pair)

# WRONG: Undirected, double-counted
def process_spread(simulator):
    for agent in simulator.agents:
        for target in agent.get_adjacent_agents():
            attempt_spread(agent, target)  # A→B and B→A both checked!
```

**Phase to address:** Phase 1 (Spread mechanics)

---

### Pitfall 3: State Transitions Not Logged

**What goes wrong:** Agents change states (susceptible→infected→recovered) but no record of when or why, making post-simulation analysis impossible.

**Why it happens:**
- Focus on mechanics, not observability
- No logging framework in place
- Researchers don't realize they need it until later

**Consequences:**
- Can't analyze spread patterns
- Can't debug why infection rate is wrong
- Research paper lacks supporting data

**Prevention:**
- **Transition Events:** Log every state change with turn, agent, cause, probability
- **Exportable Logs:** JSON/CSV export for analysis
- **Visualization:** Timeline charts showing state changes

**Phase to address:** Phase 1 (Core mechanics), Phase 2 (Visualization)

---

## LLM-Specific Pitfalls

### Pitfall 1: Prompt State Mismatch

**What goes wrong:** Agent's prompt says "you are healthy" but their internal state is "infected," causing agents to act on stale information.

**Why it happens:**
- Prompt constructed once and cached
- State changes don't trigger prompt rebuild
- Async LLM calls complete after state changes

**Consequences:**
- Agents deny being infected when they are
- Behavior doesn't match simulation state
- Researchers see contradictory results

**Prevention:**
- **Fresh Context Per Action:** Rebuild agent context immediately before action
- **State Versioning:** Include state version in prompt, reject stale prompts
- **Synchronous Actions:** Don't queue actions for future turns

```python
# CORRECT: Fresh context every time
def select_action(agent, simulator):
    context = build_agent_context(agent, simulator)  # Always fresh
    prompt = generate_prompt(context)
    return llm.generate(prompt)

# WRONG: Cached or stale context
def select_action(agent, simulator, cached_context=None):
    context = cached_context or build_agent_context(agent)
    # If cached_context is old, prompt is wrong!
```

**Phase to address:** Phase 1 (Action selection)

---

### Pitfall 2: LLM Doesn't Follow Contagion Rules

**What goes wrong:** Despite being told "if infected, you should cough," the LLM chooses "read a book" instead, breaking the simulation model.

**Why it happens:**
- Prompt instructions too weak
- LLM doesn't understand simulation rules are mandatory
- No enforcement in code

**Consequences:**
- Simulation doesn't match intended model
- Contagion doesn't spread as designed
- Researchers think framework is broken

**Prevention:**
- **Mandatory Behavior:** Code-level enforcement of required behaviors
- **Strong Prompting:** Use system messages, not suggestions
- **Fallback Logic:** If LLM chooses invalid action, override with valid one

```python
# CORRECT: Code enforcement + strong prompting
def select_infected_action(agent, simulator):
    prompt = f"""
    You are INFECTED. You MUST choose an action that reflects your illness.
    Valid actions: {get_valid_actions(agent, simulator)}
    """
    action = llm.generate(prompt)
    if not is_valid_for_state(action, agent.state):
        action = fallback_action(agent.state)
    return action

# WRONG: Trust LLM to follow rules
def select_action(agent, simulator):
    prompt = f"Choose an action. You are {agent.state}."
    return llm.generate(prompt)  # LLM might ignore state!
```

**Phase to address:** Phase 1 (Action implementation)

---

### Pitfall 3: LLM Hallucinates Impossible Observations

**What goes wrong:** Agents claim to see things outside their visibility range (e.g., "I notice agent across the grid is coughing" when they're too far away).

**Why it happens:**
- LLM doesn't understand spatial constraints
- Prompt doesn't emphasize visibility limits
- No validation of generated observations

**Consequences:**
- Information spreads faster than intended
- Grid positioning becomes meaningless
- Simulation breaks containment scenarios

**Prevention:**
- **Constrained Prompts:** Explicitly list visible agents and what's observable
- **Observation Validation:** Parse LLM output, reject impossible observations
- **System Message:** "You can ONLY observe agents in adjacent cells"

```python
# CORRECT: Constrain what LLM can observe
def build_observation_prompt(agent, visible_agents):
    return f"""
    Visible agents: {[a.name for a in visible_agents]}
    Observations: {[f"{a.name} appears {a.appearance}" for a in visible_agents]}

    CRITICAL: You cannot observe anything about agents not listed above.
    """

# WRONG: Unconstrained observation
def build_observation_prompt(agent):
    return f"What do you observe?"  # LLM might hallucinate!
```

**Phase to address:** Phase 1 (Visibility and observation)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| **Phase 0: Infrastructure** | LLM non-determinism masking bugs | Implement deterministic mode with seeding from day one |
| **Phase 1: Core Mechanics** | Silent state violations | Unit tests for state-behavior consistency, always include state in prompts |
| **Phase 1: Core Mechanics** | Impossible rule combinations | Rule validation schema before simulation starts |
| **Phase 1: Grid Movement** | Adjacency calculation O(n²) | Use grid-based spatial indexing, benchmark early |
| **Phase 1: Speak Action** | Poor targeting prevents spread | Configurable targeting strategies, log speaking patterns |
| **Phase 1: Decay Rules** | Confusion about probabilistic decay | Clear documentation, consider deterministic option |
| **Phase 1: Spread Mechanics** | Double-counting proximity checks | Directed spread with deduplication |
| **Phase 1: Action Selection** | Prompt state mismatch | Rebuild context fresh every action |
| **Phase 2: Visualization** | Hidden state not verifiable | Observer mode with ground truth, comprehensive logging |
| **Phase 2: Analysis** | Can't analyze spread patterns | Transition event logs with export capability |

---

## Testing Strategies to Prevent Pitfalls

### Unit Test Coverage

```python
# Test: State always in context
def test_agent_context_includes_contagion_state():
    agent = create_agent(state="infected")
    context = build_agent_context(agent, simulator)
    assert context["contagion_state"] == "infected"

# Test: Invalid rules rejected
def test_impossible_contagion_rules_rejected():
    rules = {"infection_duration": 0, "recovery_rate": 0}
    errors = validate_contagion_rules(rules)
    assert len(errors) > 0

# Test: Adjacency is efficient
def test_adjacency_calculation_is_linear():
    # Should scale with grid size, not agent count squared
    for n_agents in [10, 50, 100]:
        scene = create_grid_scene(n_agents)
        time = benchmark(lambda: scene.get_all_adjacent_pairs())
        assert time < n_agents * 0.01  # Linear bound
```

### Integration Test Scenarios

1. **Deterministic Recovery:** Seed LLM, verify agents recover after exactly N turns
2. **Spread Verification:** One infected agent, verify infection spreads to adjacent agents
3. **State Visibility:** Verify agent can't observe non-adjacent agent's state
4. **Rule Validation:** Attempt to create impossible rule set, verify rejection

### Debugging Checklist

When contagion "doesn't work":

- [ ] Are states included in agent prompts? (Check logs)
- [ ] Is temperature=0 for reproducibility? (Check config)
- [ ] Are adjacency checks O(n²)? (Profile with 100+ agents)
- [ ] Do rules have logical contradictions? (Run validation)
- [ ] Are agents actually taking actions? (Check action logs)
- [ ] Is spread probability > 0? (Check rules)

---

## Sources

**Note:** Web search tools experienced technical difficulties during research. Findings are based on:

- **Agent-based modeling principles:** Standard ABM pitfalls from computational social science literature
- **LLM integration patterns:** Known challenges from LLM agent frameworks (AutoGen, LangChain agents)
- **Grid simulation best practices:** Spatial indexing and performance optimization patterns
- **Configurable rule systems:** Validation patterns from simulation configuration literature

**Confidence Level:** MEDIUM - Recommendations based on well-established software engineering and ABM principles, but could benefit from verification with recent LLM-agent contagion research papers (2024-2026).

**Recommended verification sources:**
- Search arXiv for "LLM agent contagion 2024 2025 2026"
- Check Journal of Artificial Societies and Social Simulation for recent ABM validation papers
- Review AutoGen/LangChain agent documentation for state management patterns
- Consult epidemiological ABM papers for grid-based spread validation approaches
