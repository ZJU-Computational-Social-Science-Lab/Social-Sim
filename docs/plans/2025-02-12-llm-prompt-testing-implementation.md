# LLM Prompt Testing - Implementation Plan

**Date:** 2025-02-12
**Based on:** 2025-02-12-llm-prompt-testing-design.md
**Branch:** feature/llm-prompt-testing
**Worktree:** ../Social-Sim-llm-testing

## Overview

This plan details the implementation of a comprehensive LLM prompt testing framework for SocialSim4. The framework will test prompts across 6 interaction patterns, 18 scenarios, 3 LLM models, with iterative improvement and cross-LLM portability analysis.

## Implementation Steps

### Step 1: Base Infrastructure

**Files to create:**
- `tests/llm_prompt_testing/__init__.py`
- `tests/llm_prompt_testing/config.py` - Configuration management
- `tests/llm_prompt/testing/ollama_client.py` - Ollama API wrapper

**Tasks:**
1. Create test directory structure
2. Implement Ollama client for http://localhost:11434/v1
3. Add model configuration (qwen3:4b, gemma3:4b-it-qat, ministral-3:3b)
4. Add timeout and retry logic
5. Add logging infrastructure

**Acceptance Criteria:**
- Can connect to Ollama and list models
- Can send a prompt and receive a response
- Errors are logged appropriately

---

### Step 2: Test Agent Profiles

**Files to create:**
- `tests/llm_prompt_testing/agents.py` - Test agent definitions

**Tasks:**
1. Define archetypal agent profiles (Authority, Dissenter, Follower, Analyst, Mediator)
2. Define domain-specific agent profiles (Farmer, Merchant, Guard, Council Member, Trader)
3. Each profile includes: role_prompt, personality traits, knowledge base, goals
4. Add helper function to instantiate agents for testing

**Archetypal Agents:**
```python
ARCHETYPAL_AGENTS = {
    "Authority": {
        "role_prompt": "You are a leader. Others look to you for direction.",
        "personality": "decisive, commanding, responsible",
        "goals": ["maintain order", "make decisions", "coordinate group"]
    },
    "Dissenter": {
        "role_prompt": "You question assumptions and challenge consensus.",
        "personality": "critical, independent, contrarian",
        "goals": ["challenge norms", "question decisions", "surface alternatives"]
    },
    # ... etc
}
```

**Acceptance Criteria:**
- All 10 agent profiles defined
- Can generate agent prompts with profile applied
- Profiles are JSON-serializable for testing

---

### Step 3: Scenario Configurations

**Files to create:**
- `tests/llm_prompt_testing/scenarios.py` - Scenario definitions

**Tasks:**
1. Define 3 scenarios per interaction pattern
2. Each scenario includes: name, description, actions available, success criteria
3. Map scenarios to existing SocialSim templates where possible

**Scenario Structure:**
```python
SCENARIOS = {
    "Strategic Decisions": {
        "prisoners_dilemma": {
            "name": "Prisoner's Dilemma",
            "actions": ["cooperate", "defect"],
            "payoff_mode": "pairwise",
            "description": "Two suspects must decide: betray or remain silent"
        },
        "stag_hunt": {
            "name": "Stag Hunt",
            "actions": ["stag", "hare"],
            "payoff_mode": "threshold",
            "threshold": 10
        },
        "minimum_effort": {
            "name": "Minimum Effort Game",
            "actions": ["effort_1", "effort_2", ..., "effort_7"],
            "payoff_mode": "minimum"
        }
    },
    # ... other patterns
}
```

**Acceptance Criteria:**
- 18 scenarios defined (6 patterns × 3 scenarios)
- Each scenario has required configuration
- Can generate prompts for any scenario

---

### Step 4: Output Evaluation

**Files to create:**
- `tests/llm_prompt_testing/evaluators.py` - Output evaluation logic

**Tasks:**
1. Implement XML format validator
2. Implement action correctness checker
3. Implement role alignment evaluator
4. Implement error/hallucination detector
5. Create overall scoring function

**Evaluation Logic:**
```python
def evaluate_output(output: str, scenario: str, agent_role: str) -> EvaluationResult:
    """Evaluate LLM output against success criteria."""
    return EvaluationResult(
        xml_valid=check_xml_format(output),
        action_correct=check_action(output, scenario),
        role_aligned=check_role(output, agent_role),
        no_errors=check_errors(output),
        overall_score=0-4,
        parsed_action=extract_action(output),
        failure_reasons=[]
    )
```

**Acceptance Criteria:**
- All 4 criteria evaluated correctly
- Returns detailed failure reasons
- Parses action from XML output

---

### Step 5: Prompt Tuning

**Files to create:**
- `tests/llm_prompt_testing/prompt_tuner.py` - Automated prompt improvement

**Tasks:**
1. Analyze failure patterns
2. Generate prompt improvements
3. Track prompt versions
4. Implement rollback capability

**Tuning Strategies:**
- **XML Format Issues**: Strengthen format instructions, add examples
- **Action Issues**: Clarify available actions, add constraints
- **Role Issues**: Emphasize role instructions, add motivation
- **Model-Specific**: Different prompt styles for different models

**Acceptance Criteria:**
- Can analyze failures and suggest improvements
- Prompt versions tracked with IDs
- Rollback works for failed improvements

---

### Step 6: Cross-LLM Analysis

**Files to create:**
- `tests/llm_prompt_testing/cross_llm_analyzer.py` - Cross-model comparison

**Tasks:**
1. Compare results across models
2. Apply 2/3 pass rule
3. Generate model failure analysis
4. Identify model capability patterns

**Analysis Logic:**
```python
def analyze_cross_llm(results: List[TestResult]) -> CrossLLMAnalysis:
    """Analyze results across models for portability."""
    pass_count = sum(r.overall_score == 4 for r in results)
    status = "PASS" if pass_count >= 2 else "FAIL"

    return CrossLLMAnalysis(
        pass_status=status,
        pass_count=pass_count,
        failing_models=[r.model for r in results if r.overall_score < 4],
        failure_reasons=analyze_failures(results)
    )
```

**Acceptance Criteria:**
- Correctly applies 2/3 rule
- Identifies which models fail and why
- Documents model-specific capability patterns

---

### Step 7: CSV Reporting

**Files to create:**
- `tests/llm_prompt_testing/csv_reporter.py` - CSV generation

**Tasks:**
1. Implement CSV writer with all fields
2. Create directory structure for results
3. Add summary statistics
4. Generate model capability matrix

**CSV Format:**
```csv
pattern,scenario,model,iteration,run_number,agent_type,agent_role,
input_prompt,output_raw,xml_valid,action_correct,role_aligned,
no_errors,overall_score,parsed_action,token_count,time_ms,
error_message,prompt_version,cross_llm_status,model_failure_reason
```

**Acceptance Criteria:**
- CSVs generated in correct structure
- All 18 scenario files created
- Summary report includes model matrix

---

### Step 8: Test Runner for Individual Patterns

**Files to create:**
- `tests/llm_prompt_testing/run_pattern_test.py` - Execute tests for one pattern

**Tasks:**
1. Implement main test loop for a pattern
2. Call Ollama API for each combination
3. Collect results
4. Trigger prompt tuning between iterations
5. Apply cross-LLM analysis

**Test Loop:**
```python
for scenario in scenarios:
    for model in models:
        for iteration in range(1, 6):
            for run in range(3):
                result = run_test(scenario, model, agent)
                results.append(result)
            if all_perfect(results[-3:]):
                break
            else:
                tune_prompts(results[-3:])
    analyze_cross_llm(scenario_results)
```

**Acceptance Criteria:**
- Runs complete test suite for a pattern
- Stops early when perfect
- Generates CSV output
- Calls prompt tuner as needed

---

### Step 9: Orchestration

**Files to create:**
- `tests/llm_prompt_testing/run_all_tests.py` - Main entry point

**Tasks:**
1. Spawn 6 parallel agents (one per pattern)
2. Each agent runs pattern tests independently
3. Collect all results
4. Generate final summary

**Acceptance Criteria:**
- Can run all patterns in parallel
- Results are collected correctly
- Final summary is comprehensive

---

### Step 10: Senior Reviewer Agent

**Files to create:**
- `tests/llm_prompt_testing/senior_reviewer.py` - Review and consolidate results

**Tasks:**
1. Review CSVs from all patterns
2. Identify patterns needing attention
3. Generate model capability analysis
4. Create final report

**Acceptance Criteria:**
- Reviews all 18 CSVs
- Generates model capability matrix
- Produces actionable recommendations

---

## Execution Plan

### Phase 1: Infrastructure (Steps 1-7)
**Agent:** Single Claude Code agent
**Duration:** Steps 1-7
**Output:** Complete test infrastructure

### Phase 2: Pattern Testing (Step 8)
**Agents:** 6 parallel Claude Code agents (one per pattern)
**Duration:** Parallel execution
**Output:** 18 CSV files with detailed results

### Phase 3: Review (Step 10)
**Agent:** Senior reviewer agent
**Duration:** After all patterns complete
**Output:** Final summary and recommendations

---

## File Structure

```
Social-Sim/
├── tests/
│   └── llm_prompt_testing/
│       ├── __init__.py
│       ├── config.py                 # Configuration
│       ├── ollama_client.py           # Ollama API wrapper
│       ├── agents.py                 # Test agent profiles
│       ├── scenarios.py              # Scenario definitions
│       ├── evaluators.py             # Output evaluation
│       ├── prompt_tuner.py           # Prompt improvement
│       ├── cross_llm_analyzer.py     # Cross-model comparison
│       ├── csv_reporter.py           # CSV generation
│       ├── run_pattern_test.py       # Single pattern runner
│       ├── run_all_tests.py          # Main entry point
│       └── senior_reviewer.py        # Final reviewer
├── test_results/                     # Generated during test runs
│   ├── strategic_decisions/
│   ├── opinions_influence/
│   ├── network_spread/
│   ├── markets_exchange/
│   ├── spatial_movement/
│   ├── open_conversation/
│   ├── model_capability_analysis.md
│   └── summary_report.md
└── docs/
    └── plans/
        ├── 2025-02-12-llm-prompt-testing-design.md
        └── 2025-02-12-llm-prompt-testing-implementation.md
```

---

## Dependencies

**New Python packages:**
- `aiohttp` - Async HTTP for Ollama API (optional, can use requests)
- `pandas` - CSV handling and analysis

**Existing packages to leverage:**
- `pytest` - Test framework
- Existing SocialSim agent and template modules

---

## Success Criteria

### Infrastructure
- [ ] Ollama connection working
- [ ] All 10 agent profiles defined
- [ ] All 18 scenarios defined
- [ ] Evaluation logic working
- [ ] Prompt tuning functional
- [ ] Cross-LLM analysis working
- [ ] CSV generation working

### Testing
- [ ] All 54 combinations tested (6 × 3 × 3)
- [ ] Up to 5 iterations per combination
- [ ] 2/3 pass rule applied
- [ ] Results recorded in CSVs

### Review
- [ ] All CSVs reviewed
- [ ] Model capability matrix filled
- [ ] Recommendations generated

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Ollama API rate limits | Add delays between calls, retry logic |
| Long execution time | Parallel execution, progress tracking |
| Context overflow | Use fresh agents per pattern, clean context |
| Inconsistent outputs | Multiple runs, statistical analysis |
| Model-specific failures | Document capability patterns, don't force 3/3 |

---

## Timeline Notes

This will be a long-running process. Estimated:
- Infrastructure: 2-3 hours
- Testing: 4-8 hours (270+ API calls, each taking seconds to minutes)
- Review: 1-2 hours

Total: 7-13 hours of work spread across multiple agent sessions.
