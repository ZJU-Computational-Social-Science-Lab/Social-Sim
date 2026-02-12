# LLM Prompt Testing Design Document

**Date:** 2025-02-12
**Author:** Comprehensive Testing Framework Design
**Status:** Approved

## Overview

A comprehensive testing framework for validating LLM prompts across all interaction patterns in the SocialSim4 platform. The framework tests prompt quality, output format compliance, action correctness, and role alignment across multiple local LLM models.

## Objectives

1. **Validate Prompts**: Ensure all interaction patterns produce correct, consistent outputs
2. **Model Comparison**: Test behavior across qwen3:4b, gemma3:4b-it-qat, and ministral-3:3b
3. **Iterative Improvement**: Automatically tune prompts based on test results
4. **Comprehensive Reporting**: Generate detailed CSVs for manual review

## Test Matrix

| Dimension | Values |
|-----------|--------|
| **Interaction Patterns** | 6 Core Types |
| **Scenarios per Pattern** | 3 (representative sub-options) |
| **Models** | 3 (qwen3:4b, gemma3:4b-it-qat, ministral-3:3b) |
| **Base Combinations** | 54 (6 patterns × 3 scenarios × 3 models) |
| **Runs per Iteration** | 3 |
| **Max Iterations** | 5 (stop early if perfect) |
| **Max Total Runs** | 810 per agent type |

## Cross-LLM Portability Rule

**Requirement**: A prompt is considered "good" only if it works correctly on at least **2 out of 3 LLMs**.

- **2/3 Pass**: Prompt is accepted; note which model failed and analyze why
- **1/3 Pass**: Prompt needs improvement; not portable enough
- **0/3 Pass**: Prompt fails completely; must be redesigned

**Failure Analysis**: When a model consistently fails on specific prompt types:
- Document the pattern of failure (XML format? Actions? Role alignment?)
- Determine if it's a model capability limitation or prompt issue
- Consider if the model is unsuitable for that interaction type

## Interaction Patterns to Test

### 1. Strategic Decisions
Scenarios tested:
- **Prisoner's Dilemma** - Cooperate/Defect with pairwise payoffs
- **Stag Hunt** - Coordination with threshold (Stag/Hare choices)
- **Minimum Effort Game** - Coordination with 7 effort levels (min-based payoff)

### 2. Opinions & Influence
Scenarios tested:
- **Opinion Polarization** - Bounded confidence model, threshold=30
- **Consensus Game** - Open-minded influence, averaging opinions
- **Design Your Own** - Custom opinion dimension and influence model

### 3. Network & Spread
Scenarios tested:
- **Information Cascade** - Sequential choices with full history visibility
- **Opinion Spread** - Opinions propagating through network
- **Design Your Own** - Custom propagation type (opinions vs choices)

### 4. Markets & Exchange
Scenarios tested:
- **Basic Trading** - Simple resource exchange
- **Double Auction** - Bidding and asking mechanics
- **Design Your Own** - Custom market rules

### 5. Spatial & Movement
Scenarios tested:
- **Spatial Cooperation** - Grid-based with imitation dynamics
- **Segregation Model** - Location preference with movement
- **Design Your Own** - Custom spatial rules

### 6. Open Conversation
Scenarios tested:
- **Focus Group** - Structured discussion with turn-taking
- **Deliberation** - Open discussion toward consensus
- **Design Your Own** - Custom conversation rules

## Success Criteria

Each LLM output is evaluated against four criteria:

| Criterion | Description |
|-----------|-------------|
| **XML Format Valid** | Output matches required format: `--- Thoughts ---`, `---- Plan ---`, `---- Action ---` |
| **Action Correct** | Agent uses appropriate actions for the scenario type |
| **Role Aligned** | Agent behavior matches defined role/personality |
| **No Errors** | No hallucinations, incorrect parameters, or API errors |

## Test Agent Profiles

### Archetypal Roles
| Role | Description |
|------|-------------|
| **Authority** | Leadership role, directive, maintains order |
| **Dissenter** | Challenges norms, questions decisions |
| **Follower** | Adopts group consensus, supportive |
| **Analyst** | Observational, data-driven, logical |
| **Mediator** | Seeks compromise, bridges conflicts |

### Domain-Specific Roles
| Role | Description |
|------|-------------|
| **Farmer** | Resource-focused, territorial, practical |
| **Merchant** | Trade-oriented, profit-motivated, social |
| **Guard** | Rule-enforcing, protective, authoritative |
| **Council Member** | Decision-focused, deliberative |
| **Trader** | Exchange-focused, opportunistic |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Senior Agent (Orchestrator)                   │
│  - Reviews all CSV outputs                                       │
│  - Makes final approval decisions                               │
│  - Synthesizes findings across patterns                         │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
│ Pattern Agent 1│  │ Pattern Agent 2 │  │ Pattern Agent 3 │
│ Strategic      │  │ Opinions        │  │ Network         │
│ Decisions      │  │ & Influence     │  │ & Spread        │
├────────────────┤  ├─────────────────┤  ├─────────────────┤
│- Creates agents│  │- Creates agents │  │- Creates agents │
│- Runs tests    │  │- Runs tests     │  │- Runs tests     │
│- Tunes prompts │  │- Tunes prompts  │  │- Tunes prompts  │
│- Outputs CSV   │  │- Outputs CSV    │  │- Outputs CSV    │
└────────────────┘  └─────────────────┘  └─────────────────┘
        │                     │                     │
┌───────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
│ Pattern Agent 4│  │ Pattern Agent 5 │  │ Pattern Agent 6 │
│ Markets        │  │ Spatial          │  │ Open            │
│ & Exchange     │  │ & Movement       │  │ Conversation    │
└────────────────┘  └─────────────────┘  └─────────────────┘
```

## Process Flow

### Phase 1: Setup
1. Create test agent profiles (archetypal + domain-specific)
2. Initialize CSV output directories
3. Set up Ollama API connection

### Phase 2: Execution (Per Pattern)
For each of 6 interaction patterns (in parallel via separate agents):

```
For each scenario (3 per pattern):
    For each model (qwen3, gemma3, ministral):
        For iteration = 1 to 5:
            For run = 1 to 3:
                - Construct prompt for pattern + scenario + agent
                - Call Ollama API with model
                - Parse and evaluate output
                - Record results to CSV
            - Evaluate 3-run batch for this model
            - If all perfect: mark model as done
            - Else: analyze failures and tune prompts

    # Cross-LLM Evaluation after each scenario
    - Check results across all 3 models
    - If 2/3 or 3/3 pass: scenario complete, analyze why 3rd failed (if any)
    - If 1/3 or 0/3 pass: tune prompts for portability, repeat
    - Document model capability patterns (which models fail at what)
    - Pass final CSV to Senior Agent
```

### Phase 3: Review
1. Senior Agent reviews each pattern's CSV
2. Generates summary report
3. Identifies patterns needing further attention

### Phase 4: Final Report
- Comprehensive findings across all patterns
- Model comparison analysis
- Recommendations for prompt improvements

## CSV Output Format

```csv
pattern,scenario,model,iteration,run_number,agent_type,agent_role,
input_prompt,output_raw,xml_valid,action_correct,role_aligned,
no_errors,overall_score,parsed_action,token_count,time_ms,
error_message,prompt_version,cross_llm_status,model_failure_reason
```

### CSV Fields Explained
| Field | Description |
|-------|-------------|
| `pattern` | Main interaction pattern (e.g., "Strategic Decisions") |
| `scenario` | Specific sub-option (e.g., "Prisoner's Dilemma") |
| `model` | LLM used (qwen3:4b, gemma3:4b-it-qat, ministral-3:3b) |
| `iteration` | Iteration number (1-5) |
| `run_number` | Run within iteration (1-3) |
| `agent_type` | "Archetypal" or "Domain-specific" |
| `agent_role` | Specific role (Authority, Farmer, etc.) |
| `input_prompt` | Full prompt sent to LLM |
| `output_raw` | Raw response from LLM |
| `xml_valid` | Boolean: did output match XML format? |
| `action_correct` | Boolean: was action appropriate for scenario? |
| `role_aligned` | Boolean: did behavior match role? |
| `no_errors` | Boolean: no errors/hallucinations? |
| `overall_score` | 0-4 (count of passing criteria) |
| `parsed_action` | Extracted action name and parameters |
| `token_count` | Estimated tokens in output |
| `time_ms` | Response time in milliseconds |
| `error_message` | Description of any error |
| `prompt_version` | Version ID of prompt used |
| `cross_llm_status` | "PASS", "FAIL", or "NA" (relative to 2/3 rule) |
| `model_failure_reason` | Analysis of why this model failed (if applicable) |

## File Structure

```
Social-Sim/
├── tests/
│   └── llm_prompt_testing/
│       ├── agents.py              # Test agent definitions
│       ├── scenarios.py           # Scenario configurations
│       ├── evaluators.py          # Output evaluation logic
│       ├── prompt_tuner.py        # Automated prompt improvement
│       ├── csv_reporter.py        # CSV generation
│       └── cross_llm_analyzer.py  # Cross-model comparison
├── test_results/
│   ├── strategic_decisions/
│   │   ├── prisoners_dilemma.csv
│   │   ├── stag_hunt.csv
│   │   └── minimum_effort.csv
│   ├── opinions_influence/
│   │   ├── opinion_polarization.csv
│   │   ├── consensus_game.csv
│   │   └── design_your_own.csv
│   ├── network_spread/
│   │   ├── information_cascade.csv
│   │   ├── opinion_spread.csv
│   │   └── design_your_own.csv
│   ├── markets_exchange/
│   ├── spatial_movement/
│   ├── open_conversation/
│   ├── model_capability_analysis.md  # Which models excel at what
│   └── summary_report.md
└── docs/
    └── plans/
        └── 2025-02-12-llm-prompt-testing-design.md
```

## Implementation Notes

1. **Parallel Execution**: Each pattern gets a fresh Claude Code agent with isolated context
2. **State Management**: Prompt versions tracked to enable rollbacks
3. **Error Handling**: API timeouts, malformed outputs logged and retried
4. **Ollama API**: Uses `http://localhost:11434/v1` endpoint
5. **Model Selection**: Configurable via environment variables or CLI args

## Success Metrics

### Output Quality Metrics
- **Pass Rate**: Percentage of outputs meeting all 4 success criteria
- **Stability**: Consistency across 3-run batches
- **Convergence**: Iterations needed to reach perfect outputs

### Cross-LLM Portability Metrics
- **2/3 Pass Rate**: Percentage of scenarios that work on 2+ models
- **3/3 Pass Rate**: Percentage of scenarios that work on all models
- **Model-Specific Pass Rates**: Which models excel at which patterns
- **Failure Patterns**: Document which models fail at what types of tasks

### Model Capability Matrix
| Pattern/Scenario | qwen3:4b | gemma3:4b-it-qat | ministral-3:3b |
|------------------|----------|------------------|---------------|
| Strategic Decisions | | | |
| Opinions & Influence | | | |
| Network & Spread | | | |
| Markets & Exchange | | | |
| Spatial & Movement | | | |
| Open Conversation | | | |

This matrix will be filled in after testing to show model strengths.

## Next Steps

1. Create isolated git worktree for testing framework
2. Implement base test infrastructure
3. Define agent profiles and scenarios
4. Implement individual pattern testers
5. Execute comprehensive test suite
6. Review and iterate
