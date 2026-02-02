# SocialSim4 Refactoring Design Document

**Date**: 2025-02-02
**Status**: Approved
**Priority**: High

---

## Overview

This document outlines three major refactoring initiatives for SocialSim4:
1. **Generic User-Defined Templates** (HIGHEST PRIORITY)
2. **Prompt Optimization** for 4B parameter models
3. **Internationalization (i18n)** - English translations for wizard UI

---

## Part 1: Generic Template Architecture

### Current State

| Template | Frontend | Backend | Status |
|----------|----------|---------|--------|
| simple_chat | ✓ | ✓ | Implemented |
| council | ✓ | ✓ | Implemented |
| village | ✓ | ✓ | Implemented |
| landlord | ✓ | ✓ | Implemented |
| werewolf | ✓ | ✓ | Implemented |
| norm_disruption | ✓ | ✗ | Frontend only |
| policy_diffusion | ✓ | ✗ | Frontend only |
| polarization | ✓ | ✗ | Frontend only |
| resource_scarcity | ✓ | ✗ | Frontend only |

### Design Approach: Hybrid

**Keep existing templates functional** while adding a **Generic Template** builder that users can compose from:

1. **Core Mechanics** (selectable)
2. **Agent Properties** (via demographics/scaling)
3. **Custom Semantic Actions** (LLM-interpreted)

### Template Configuration Schema

```typescript
interface GenericTemplateConfig {
  name: string;
  description: string;

  // Core mechanics
  mechanics: {
    spatial?: {
      gridSize: { width: number; height: number };
      terrain: 'open' | 'village' | 'custom';
    };
    discussion?: {
      mode: 'freeform' | 'turnbased' | 'moderated';
      proximityRequired: boolean;
    };
    voting?: {
      rule: 'majority' | 'unanimous' | 'weighted';
      quorumPercent: number;
    };
    resources?: {
      types: string[];
      scarcity: boolean;
    };
    hierarchy?: {
      levels: number;
      roleNames: string[][];
    };
  };

  // Custom semantic actions (LLM-interpreted)
  semanticActions: Array<{
    name: string;
    description: string;
    effects: string;
  }>;
}
```

---

## Part 2: Agent Scaling as Default

### Current Behavior

The wizard defaults to `'default'` mode which uses template-defined agents. Users must explicitly select AI generation.

### New Behavior

**Default mode**: `'demographics'` - AgentTorch-based demographic and trait distribution.

### Demographics UI

```
┌─────────────────────────────────────────────────────────────────┐
│  Agent Generation (Method: Demographics)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Total Agents: [ 50 ]                                           │
│                                                                 │
│  Demographics:                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Name         │ Categories                              │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  职业         │ 教师, 商人, 医生, 警察, 农民...          │   │
│  │  年龄段       │ 青年, 中年, 老年                        │   │
│  │  教育水平     │ 小学, 中学, 大学, 研究生               │   │
│  │  [ + Add Demographic ]                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Traits (Normal Distribution):                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Trait Name    │ Mean │ Std Dev                         │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  规范遵守度    │  50  │   20                            │   │
│  │  社会地位      │  50  │   30                            │   │
│  │  反抗倾向      │  30  │   25                            │   │
│  │  [ + Add Trait ]                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [Generate Agents] (Preview: ~50 agents)                        │
└─────────────────────────────────────────────────────────────────┘
```

### Agent Generation Methods

| Method | Use Case |
|--------|----------|
| **Demographics (default)** | Scaling - create 20-500 agents with demographic and trait distributions |
| **Simple Prompt** | Quick - generate 3-10 agents with natural language description |
| **Import CSV/JSON** | Existing agent data |

---

## Part 3: Prompt Optimization for 4B Models

### Design Principles

1. **Clarity over brevity** - 4B models need explicit instructions
2. **Examples are essential** - Few-shot learning helps format adherence
3. **Eliminate redundancy** - Remove repetition, don't over-compress
4. **Structure matters** - Consistent formatting helps parsing

### Target Token Budget

| Component | Tokens | Notes |
|-----------|--------|-------|
| Static prompt | 500-600 | Identity, scenario, actions, format |
| Current state | 50-100 | Location, energy, inventory |
| Recent context | 200-800 | Last 5-10 messages, trimmed |
| Plan state | 100-300 | Goals, milestones (dynamic) |
| **Total per turn** | **~850-1800** | Well within 8K context window |

### Optimizations

| Area | Current | Optimized | Savings |
|------|---------|-----------|---------|
| Identity | Full sentences | "Name - Role, trait" | 70% |
| Scenario | Paragraphs with flavor | Bullet points of rules | 60% |
| Actions | NAME + DESC + multi-line INSTRUCTION | NAME + one-line example | 50% |
| Output format | Multi-paragraph | Condensed + 1 example | 60% |
| Examples | Multiple `<good>`, `<bad>` | Single integrated | 50% |

### Compact XML Format

```
Simple actions:
  <Action name="yield"/>

Actions with primitive parameters:
  <Action name="move_to"><location>market</location></Action>
  <Action name="gather"><resource>food</resource></Action>

Actions with text content:
  <Action name="talk_to"><target>Bob</target>
    <message>Hello Bob!</message>
  </Action>
```

**Why XML for 4B models:**
- Excellent training data coverage (HTML, XML configs)
- Forgiving syntax (missing end tag is recoverable)
- Self-closing tags reduce errors
- No JSON-style escaping issues

---

## Part 4: i18n - English Translations

### Scope

Add English translations for the Simulation Wizard (simulation/agent creation screens).

### Files to Modify

1. `frontend/locales/en.json` - Add missing translation keys
2. `frontend/pages/SimulationWizardPage.tsx` - Replace hardcoded Chinese strings with `useTranslation()`

### Translation Keys to Add

```json
{
  "wizard": {
    "timeUnits": {
      "minute": "Minutes",
      "hour": "Hours",
      "day": "Days",
      "week": "Weeks",
      "month": "Months",
      "year": "Years"
    },
    "titles": {
      "createSimulation": "Create New Simulation",
      "defaultModelConfig": "Default Model Configuration"
    },
    "instructions": {
      "selectProvider": "Select a configured provider from Settings → LLM Providers.",
      "noProviderConfigured": "No providers configured yet (add in Settings first)"
    },
    "messages": {
      "generatedAgents": "Successfully generated {{count}} agents",
      "generationFailed": "Generation failed. Check API Key or retry."
    },
    "templateDefaults": {
      "village": "Create a diverse village community including farmers, merchants, and intellectuals.",
      "council": "Create a 5-member council with different policy stances and influence.",
      "werewolf": "Create 9 werewolf game players: judge/seer, witch, hunter, 2 wolves, 3 civilians."
    },
    "confirmations": {
      "deleteTemplate": "Are you sure you want to delete this template?"
    }
  }
}
```

---

## Implementation Plan

### Phase 1: Quick Wins (1-2 days)

1. **Change wizard default to demographics mode**
   - File: `frontend/pages/SimulationWizardPage.tsx`
   - Change: `importMode` default from `'default'` to `'demographics'`

2. **Build demographics UI in wizard**
   - Add demographics table (name, categories)
   - Add traits table (name, mean, std)
   - Wire up `generateAgentsWithDemographics` function

3. **Add English translations to locales**
   - File: `frontend/locales/en.json`
   - Add missing translation keys

4. **Wire up i18n in wizard component**
   - Replace hardcoded strings with `useTranslation()` hook
   - Test language switching

### Phase 2: Prompt Optimization (2-3 days)

1. **Create compact action INSTRUCTION versions**
   - File: `src/socialsim4/core/actions/base_actions.py`
   - Condense each action's INSTRUCTION to single example

2. **Condense scenario descriptions**
   - File: `src/socialsim4/core/scene.py`
   - `get_scenario_description()` - remove flavor text, keep essential rules

3. **Compress output format instructions**
   - File: `src/socialsim4/agent.py`
   - `get_output_format()` - condense to essential structure + 1 example

4. **Test with 4B models**
   - Run simulations with Gemma-4B, Phi-3.5
   - Verify format adherence and token usage

### Phase 3: Generic Template (3-5 days)

1. **Define generic template schema**
   - File: `src/socialsim4/scenarios/generic.py` (new)
   - Define `GenericTemplateConfig` dataclass

2. **Create GenericScene class**
   - Core mechanics: spatial, discussion, voting, resources, hierarchy
   - Semantic action handling (LLM-interpreted)

3. **Build generic template UI**
   - File: `frontend/pages/TemplateBuilderPage.tsx` (new)
   - Mechanic selection toggles
   - Semantic action builder

4. **Register generic template**
   - File: `src/socialsim4/scenarios/basic.py`
   - Add to SCENES dictionary

### Phase 4: Sociology Backend (2-3 days)

1. **Implement norm_disruption scenario**
   - 20 agents with 规范遵守度, 社会地位, 反抗倾向
   - Public broadcast events for norm changes

2. **Implement policy_diffusion scenario**
   - 3-tier hierarchy (government → community → residents)
   - 官级, 灵活性, 个人利益驱动 properties

3. **Implement polarization scenario**
   - 8 radical + 8 conservative + 4 neutral agents
   - 立场强度, 情绪易激怒度, 包容度 properties
   - Recommendation algorithm mechanism

4. **Implement resource_scarcity scenario**
   - Trust-based agents with 社会资本, 诚实度, 绝望指数
   - Long-term memory for interaction tracking
   - Credit contract system

---

## File Changes Summary

| File | Change | Priority |
|------|--------|----------|
| `frontend/pages/SimulationWizardPage.tsx` | Default to demographics, add UI, i18n | 1 |
| `frontend/locales/en.json` | Add translation keys | 1 |
| `src/socialsim4/agent.py` | Compress prompt, compact XML | 2 |
| `src/socialsim4/core/scene.py` | Compact descriptions | 2 |
| `src/socialsim4/core/actions/*.py` | Compact INSTRUCTIONs | 2 |
| `src/socialsim4/scenarios/generic.py` | New file | 3 |
| `src/socialsim4/scenarios/basic.py` | Register generic template | 3 |
| `frontend/pages/TemplateBuilderPage.tsx` | New file | 3 |
| `src/socialsim4/scenarios/sociology.py` | New file | 5 |

---

## Acceptance Criteria

### Phase 1
- [ ] Wizard opens with demographics mode selected by default
- [ ] Demographics UI renders with add/remove functionality
- [ ] English translations display when language is set to English
- [ ] Chinese translations continue to work

### Phase 2
- [ ] Static prompt tokens reduced to ~500-600
- [ ] Total per-turn tokens ~850-1800 (within 8K context)
- [ ] 4B models produce valid compact XML output
- [ ] Parse success rate >95%

### Phase 3
- [ ] Generic template appears in template selection
- [ ] Users can enable/disable core mechanics
- [ ] Users can define custom semantic actions
- [ ] Generic simulations run successfully

### Phase 4
- [ ] All 4 sociology scenarios have backend implementations
- [ ] Sociology simulations run with correct agent properties
- [ ] Scenario-specific mechanics (recommendation algorithm, trust memory) work

---

## Notes

- **Model targeting**: All prompt optimizations target 4B parameter models (Gemma-4B, Phi-3.5, Qwen-4B)
- **XML format**: Chosen for best balance of token efficiency and parse reliability with 4B models
- **Backward compatibility**: Existing templates and simulations continue to work unchanged
- **Agent properties**: Separated from templates - defined via demographics/scaling UI
