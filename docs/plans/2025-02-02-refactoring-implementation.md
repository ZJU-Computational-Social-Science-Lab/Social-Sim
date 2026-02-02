# SocialSim4 Refactoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor SocialSim4 to support generic user-defined templates, optimize prompts for 4B models using compact XML, and add English i18n translations for the simulation wizard.

**Architecture:**
- **Phase 1**: Switch wizard to demographics-based agent generation (default), add English translations
- **Phase 2**: Compress LLM prompts targeting 4B models, use compact XML format
- **Phase 3**: Create generic template system with composable mechanics
- **Phase 4**: Implement backend for sociology experiment templates

**Tech Stack:**
- Frontend: React 19, TypeScript, i18next, Zustand
- Backend: Python 3.11+, Litestar, SQLAlchemy
- Testing: pytest (Python), manual testing (React)

**Design Document:** `docs/plans/2025-02-02-refactoring-design.md`

---

## Phase 1: Quick Wins - Demographics Default & i18n (1-2 days)

### Task 1.1: Add English Translation Keys to Locale File

**Files:**
- Modify: `frontend/locales/en.json`

**Step 1: Add translation keys to en.json**

Add these keys to `frontend/locales/en.json`:

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
      "defaultModelConfig": "Default Model Configuration",
      "templateSelection": "Select Template",
      "agentGeneration": "Generate Agents",
      "reviewAndStart": "Review and Start"
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
      "werewolf": "Create 9 werewolf game players: judge/seer, witch, hunter, 2 wolves, 3 civilians with personalities."
    },
    "confirmations": {
      "deleteTemplate": "Are you sure you want to delete this template?"
    },
    "placeholders": {
      "simulationName": "Enter simulation name...",
      "generationDescription": "Describe the agents to generate..."
    },
    "methods": {
      "default": "Use template defaults",
      "generate": "AI Generation",
      "demographics": "Demographics (Scaling)",
      "custom": "Import CSV/JSON"
    }
  }
}
```

**Step 2: Verify JSON syntax**

Run: `cat frontend/locales/en.json | python -m json.tool`
Expected: No errors, valid JSON output

**Step 3: Commit**

```bash
git add frontend/locales/en.json
git commit -m "i18n: add English translation keys for wizard"
```

---

### Task 1.2: Wire up i18n in SimulationWizard - Time Units

**Files:**
- Modify: `frontend/pages/SimulationWizardPage.tsx`

**Step 1: Import useTranslation hook**

At the top of `frontend/pages/SimulationWizardPage.tsx`, add:

```typescript
import { useTranslation } from 'react-i18next';
```

**Step 2: Add useTranslation hook inside component**

After the component declaration (around line 31), add:

```typescript
export const SimulationWizard: React.FC = () => {
  const { t } = useTranslation();
  // ... existing code
```

**Step 3: Replace hardcoded TIME_UNITS**

Find the TIME_UNITS constant (around line 22-29) and replace with:

```typescript
const TIME_UNITS: { value: TimeUnit; label: string }[] = [
  { value: 'minute', label: t('wizard.timeUnits.minute') },
  { value: 'hour', label: t('wizard.timeUnits.hour') },
  { value: 'day', label: t('wizard.timeUnits.day') },
  { value: 'week', label: t('wizard.timeUnits.week') },
  { value: 'month', label: t('wizard.timeUnits.month') },
  { value: 'year', label: t('wizard.timeUnits.year') }
];
```

**Step 4: Test language switching**

1. Start frontend: `cd frontend && npm run dev`
2. Open browser to http://localhost:5173
3. Click "New" to open wizard
4. Toggle language between EN and 中文
5. Verify time unit labels change

**Step 5: Commit**

```bash
git add frontend/pages/SimulationWizardPage.tsx
git commit -m "i18n: wire up time unit translations in wizard"
```

---

### Task 1.3: Wire up i18n in SimulationWizard - Titles and Labels

**Files:**
- Modify: `frontend/pages/SimulationWizardPage.tsx`

**Step 1: Replace hardcoded title**

Find the title element (around line 237-239) and replace with:

```typescript
<h2 className="text-lg font-bold text-slate-800">
  {t('wizard.titles.createSimulation')}
</h2>
```

**Step 2: Replace default model config title**

Find (around line 270-272) and replace with:

```typescript
<h3 className="text-sm font-bold text-indigo-900">
  {t('wizard.titles.defaultModelConfig')}
</h3>
```

**Step 3: Replace instruction text**

Find (around line 273-275) and replace with:

```typescript
<p className="text-xs text-indigo-700">
  {t('wizard.instructions.selectProvider')}
</p>
```

**Step 4: Replace placeholder text**

Find (around line 289-291) and replace with:

```typescript
<option value="">
  {t('wizard.instructions.noProviderConfigured')}
</option>
```

**Step 5: Replace button labels**

Find button labels (around line 321, 329, 337, 345) and replace:

```typescript
// "上一步" →
{t('common.back', { defaultValue: 'Back' })}

// "取消" →
{t('common.cancel', { defaultValue: 'Cancel' })}

// "下一步" →
{t('common.next', { defaultValue: 'Next' })}

// "开始仿真" →
{t('wizard.titles.startSimulation', { defaultValue: 'Start Simulation' })}
```

**Step 6: Test translations**

1. Refresh browser
2. Open wizard
3. Verify all labels show in English when EN is selected
4. Switch to Chinese and verify

**Step 7: Commit**

```bash
git add frontend/pages/SimulationWizardPage.tsx
git commit -m "i18n: wire up title and button label translations"
```

---

### Task 1.4: Wire up i18n - Messages and Confirmations

**Files:**
- Modify: `frontend/pages/SimulationWizardPage.tsx`

**Step 1: Replace success message**

Find `addNotification` call (around line 222) and replace:

```typescript
addNotification('success', t('wizard.messages.generatedAgents', { count: agents.length }));
```

**Step 2: Replace error message**

Find error message (around line 225) and replace:

```typescript
setImportError(t('wizard.messages.generationFailed'));
```

**Step 3: Replace confirmation dialog**

Find confirmation dialog (around line 160) and replace:

```typescript
if (window.confirm(t('wizard.confirmations.deleteTemplate'))) {
```

**Step 4: Test all messages**

1. Generate agents - verify success message
2. Try generating with invalid API - verify error message
3. Delete a template - verify confirmation dialog

**Step 5: Commit**

```bash
git add frontend/pages/SimulationWizardPage.tsx
git commit -m "i18n: wire up message and confirmation translations"
```

---

### Task 1.5: Add Demographics Generation Method to Store

**Files:**
- Modify: `frontend/store.ts`

**Step 1: Check existing function exists**

Verify `generateAgentsWithDemographics` exists in store.ts (around line 1568).

Run: `grep -n "generateAgentsWithDemographics" frontend/store.ts`
Expected: Function definition found

**Step 2: Export function if not already exported**

Ensure the function is exported from the store.

**Step 3: Add to useSimulationStore if needed**

Check that `generateAgentsWithDemographics` is accessible from `useSimulationStore`.

**Step 4: Commit (if changes made)**

```bash
git add frontend/store.ts
git commit -m "feat: export demographics generation function"
```

---

### Task 1.6: Build Demographics UI Component

**Files:**
- Create: `frontend/components/DemographicsBuilder.tsx`

**Step 1: Create DemographicsBuilder component**

Create new file `frontend/components/DemographicsBuilder.tsx`:

```typescript
import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Demographic {
  name: string;
  categories: string[];
}

interface Trait {
  name: string;
  mean: number;
  std: number;
}

interface DemographicsBuilderProps {
  totalAgents: number;
  setTotalAgents: (n: number) => void;
  demographics: Demographic[];
  setDemographics: (d: Demographic[]) => void;
  traits: Trait[];
  setTraits: (t: Trait[]) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export const DemographicsBuilder: React.FC<DemographicsBuilderProps> = ({
  totalAgents,
  setTotalAgents,
  demographics,
  setDemographics,
  traits,
  setTraits,
  onGenerate,
  isGenerating
}) => {
  const { t } = useTranslation();
  const [newDemographicName, setNewDemographicName] = useState('');
  const [newDemographicCategories, setNewDemographicCategories] = useState('');
  const [newTraitName, setNewTraitName] = useState('');
  const [newTraitMean, setNewTraitMean] = useState(50);
  const [newTraitStd, setNewTraitStd] = useState(20);

  const addDemographic = () => {
    if (!newDemographicName || !newDemographicCategories) return;
    const categories = newDemographicCategories.split(',').map(c => c.trim()).filter(Boolean);
    setDemographics([...demographics, { name: newDemographicName, categories }]);
    setNewDemographicName('');
    setNewDemographicCategories('');
  };

  const removeDemographic = (index: number) => {
    setDemographics(demographics.filter((_, i) => i !== index));
  };

  const addTrait = () => {
    if (!newTraitName) return;
    setTraits([...traits, { name: newTraitName, mean: newTraitMean, std: newTraitStd }]);
    setNewTraitName('');
    setNewTraitMean(50);
    setNewTraitStd(20);
  };

  const removeTrait = (index: number) => {
    setTraits(traits.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* Total Agents */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Total Agents
        </label>
        <input
          type="number"
          min="1"
          max="500"
          value={totalAgents}
          onChange={(e) => setTotalAgents(parseInt(e.target.value) || 1)}
          className="w-32 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        />
      </div>

      {/* Demographics */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Demographics</h3>
        <div className="space-y-2 mb-3">
          {demographics.map((demo, index) => (
            <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
              <span className="font-medium text-slate-700">{demo.name}:</span>
              <span className="text-sm text-slate-600">{demo.categories.join(', ')}</span>
              <button
                onClick={() => removeDemographic(index)}
                className="ml-auto text-red-500 hover:text-red-700"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Name (e.g., 职业)"
            value={newDemographicName}
            onChange={(e) => setNewDemographicName(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <input
            type="text"
            placeholder="Categories (comma-separated)"
            value={newDemographicCategories}
            onChange={(e) => setNewDemographicCategories(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <button
            onClick={addDemographic}
            className="px-3 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Traits */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Traits (Normal Distribution)</h3>
        <div className="space-y-2 mb-3">
          {traits.map((trait, index) => (
            <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
              <span className="font-medium text-slate-700">{trait.name}:</span>
              <span className="text-sm text-slate-600">μ={trait.mean}, σ={trait.std}</span>
              <button
                onClick={() => removeTrait(index)}
                className="ml-auto text-red-500 hover:text-red-700"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Trait name"
            value={newTraitName}
            onChange={(e) => setNewTraitName(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <input
            type="number"
            placeholder="Mean"
            value={newTraitMean}
            onChange={(e) => setNewTraitMean(parseInt(e.target.value) || 50)}
            className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <input
            type="number"
            placeholder="Std"
            value={newTraitStd}
            onChange={(e) => setNewTraitStd(parseInt(e.target.value) || 20)}
            className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <button
            onClick={addTrait}
            className="px-3 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={onGenerate}
        disabled={isGenerating || demographics.length === 0}
        className="w-full px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
      >
        {isGenerating ? 'Generating...' : `Generate Agents (Preview: ~${totalAgents})`}
      </button>
    </div>
  );
};
```

**Step 2: Export component**

Ensure the component is exported.

**Step 3: Commit**

```bash
git add frontend/components/DemographicsBuilder.tsx
git commit -m "feat: add DemographicsBuilder component"
```

---

### Task 1.7: Integrate DemographicsBuilder into Wizard

**Files:**
- Modify: `frontend/pages/SimulationWizardPage.tsx`

**Step 1: Import DemographicsBuilder**

Add import at top of file:

```typescript
import { DemographicsBuilder } from '../components/DemographicsBuilder';
import { generateAgentsWithDemographics } from '../store';
```

**Step 2: Add state for demographics**

Add after existing state declarations (around line 66):

```typescript
const [demoTotalAgents, setDemoTotalAgents] = useState(50);
const [demographics, setDemographics] = useState<Array<{name: string, categories: string[]}>>([]);
const [traits, setTraits] = useState<Array<{name: string, mean: number, std: number}>>([]);
```

**Step 3: Add demographics generation handler**

Add after `handleGenerateAgents` function:

```typescript
const handleGenerateDemographics = async () => {
  setIsGenerating(true);
  setImportError(null);
  try {
    const archetypeProbs: Record<string, number> = {};
    demographics.forEach(d => {
      d.categories.forEach(c => {
        archetypeProbs[`${d.name}:${c}`] = 1 / d.categories.length;
      });
    });

    const agents = await generateAgentsWithDemographics(
      demoTotalAgents,
      demographics,
      archetypeProbs,
      traits,
      'en',
      selectedProviderId ?? undefined
    );
    agents.forEach((a) => {
      a.llmConfig = defaultLlmConfig;
    });
    setCustomAgents(agents);
    addNotification('success', t('wizard.messages.generatedAgents', { count: agents.length }));
  } catch (e) {
    console.error(e);
    setImportError(t('wizard.messages.generationFailed'));
  } finally {
    setIsGenerating(false);
  }
};
```

**Step 4: Add importMode value for demographics**

Find `importMode` type definition and add 'demographics':

```typescript
const [importMode, setImportMode] =
  useState<'default' | 'custom' | 'generate' | 'demographics'>('demographics');  // Changed default to 'demographics'
```

**Step 5: Add demographics option to UI**

In step 2 of the wizard, add the demographics mode selection. Find where the generation mode is selected and add demographics option.

**Step 6: Render DemographicsBuilder**

Add condition in step 2 to render DemographicsBuilder when mode is 'demographics':

```typescript
{importMode === 'demographics' && (
  <DemographicsBuilder
    totalAgents={demoTotalAgents}
    setTotalAgents={setDemoTotalAgents}
    demographics={demographics}
    setDemographics={setDemographics}
    traits={traits}
    setTraits={setTraits}
    onGenerate={handleGenerateDemographics}
    isGenerating={isGenerating}
  />
)}
```

**Step 7: Test demographics generation**

1. Start frontend
2. Open wizard
3. Verify "Demographics" is the default selected mode
4. Add a demographic (e.g., "职业" with "教师, 商人, 医生")
5. Add a trait (e.g., "规范遵守度" with mean 50, std 20)
6. Click Generate
7. Verify agents are generated

**Step 8: Commit**

```bash
git add frontend/pages/SimulationWizardPage.tsx
git commit -m "feat: integrate demographics builder as default in wizard"
```

---

## Phase 2: Prompt Optimization for 4B Models (2-3 days)

### Task 2.1: Create Compact Action Instructions

**Files:**
- Modify: `src/socialsim4/core/actions/base_actions.py`
- Modify: `src/socialsim4/core/actions/village_actions.py`
- Modify: `src/socialsim4/core/actions/council_actions.py`

**Step 1: Examine current action format**

Check current action instruction format:

Run: `grep -A 5 "INSTRUCTION = " src/socialsim4/core/actions/base_actions.py | head -30`

**Step 2: Create compact format helper**

Add to `src/socialsim4/core/actions/base_actions.py`:

```python
@staticmethod
def compact_instruction(name: str, params: list[str], example: str = "") -> str:
    """Generate compact instruction for 4B models."""
    if not params:
        return f"- {name}: <Action name=\"{name}\"/>\n"
    param_str = " ".join([f"<{p}>value</{p}>" for p in params])
    example_str = f"\n  Example: <Action name=\"{name}\">{example}</Action>" if example else ""
    return f"- {name}: {param_str}{example_str}\n"
```

**Step 3: Update SpeakAction INSTRUCTION**

Find `SpeakAction` class and replace `INSTRUCTION` with compact version:

```python
class SpeakAction(Action):
    NAME = "speak"
    DESC = "Say something to everyone."
    INSTRUCTION = """- speak: Broadcast a message
  <Action name="speak"><message>Your message here</message></Action>
"""
```

**Step 4: Update SendMessageAction INSTRUCTION**

```python
class SendMessageAction(Action):
    NAME = "send_message"
    DESC = "Send a message to all participants."
    INSTRUCTION = """- send_message: Send a message to everyone
  <Action name="send_message"><message>Your message</message></Action>
"""
```

**Step 5: Update YieldAction INSTRUCTION**

```python
class YieldAction(Action):
    NAME = "yield"
    DESC = "End your turn."
    INSTRUCTION = """- yield: End your turn
  <Action name="yield"/>
"""
```

**Step 6: Commit**

```bash
git add src/socialsim4/core/actions/base_actions.py
git commit -m "refactor: compact action instructions for 4B models"
```

**Step 7: Update village actions**

Repeat for `src/socialsim4/core/actions/village_actions.py`:

```python
# TalkToAction
INSTRUCTION = """- talk_to: Speak to someone nearby
  <Action name="talk_to"><target>Name</target><message>Hi!</message></Action>
"""

# MoveToLocationAction
INSTRUCTION = """- move_to_location: Go to a place
  <Action name="move_to_location"><location>market</location></Action>
"""

# LookAroundAction
INSTRUCTION = """- look_around: See who and what is nearby
  <Action name="look_around"/>
"""

# GatherResourceAction
INSTRUCTION = """- gather_resource: Collect resources
  <Action name="gather_resource"><resource>food</resource></Action>
"""

# RestAction
INSTRUCTION = """- rest: Recover energy
  <Action name="rest"/>
"""
```

**Step 8: Commit**

```bash
git add src/socialsim4/core/actions/village_actions.py
git commit -m "refactor: compact village action instructions"
```

---

### Task 2.2: Compress Agent Identity in Prompt

**Files:**
- Modify: `src/socialsim4/agent.py`

**Step 1: Find system_prompt method**

Run: `grep -n "def system_prompt" src/socialsim4/agent.py`

**Step 2: Examine current identity format**

Read the identity section of `system_prompt` method (lines ~73-100).

**Step 3: Create compact identity format**

Replace the verbose identity section with compact format. Find the section that builds identity (starts with "You are...") and replace:

```python
# Compact identity format for 4B models
identity_parts = [self.name]
if self.role:
    identity_parts.append(self.role)
if hasattr(self, 'style_prefix') and self.style_prefix:
    identity_parts.append(self.style_prefix)
identity_line = " - ".join(identity_parts)

prompt_parts = [f"{identity_line}"]
```

**Step 4: Test with a simple agent**

Create test script to verify prompt format:

```python
# test_prompt_format.py
from socialsim4.core.agent import Agent
from socialsim4.core.llm import MockLLMClient

agent = Agent(
    name="Alice",
    role="Teacher",
    style_prefix="friendly",
    user_profile="A 45-year-old teacher who cares about students.",
    llm_client=MockLLMClient()
)
print(agent.system_prompt(None))
```

Run: `python test_prompt_format.py`

**Step 5: Commit**

```bash
git add src/socialsim4/agent.py test_prompt_format.py
git commit -m "refactor: compact agent identity in prompt"
```

---

### Task 2.3: Compress Scenario Description

**Files:**
- Modify: `src/socialsim4/core/scene.py`
- Modify: `src/socialsim4/core/scenes/village_scene.py`

**Step 1: Check base scene description**

Run: `grep -A 10 "def get_scenario_description" src/socialsim4/core/scene.py`

**Step 2: Add compact description method**

Add to base Scene class:

```python
def get_compact_description(self) -> str:
    """Return compact scenario description for 4B models."""
    return self.get_scenario_description()
```

**Step 3: Override in VillageScene**

In `village_scene.py`, add compact description:

```python
def get_compact_description(self) -> str:
    """Compact village description."""
    return (
        f"Village grid {self.map.width}x{self.map.height}. "
        f"Locations: {', '.join(l.name for l in self.map.locations)}. "
        f"Energy decreases when you act. Rest to recover. "
        f"Resources spawn at locations."
    )
```

**Step 4: Update agent.py to use compact description**

In `agent.py`, find where scenario description is added to prompt and use `get_compact_description()` instead.

**Step 5: Test with village scenario**

Run a test simulation with village template to verify format.

**Step 6: Commit**

```bash
git add src/socialsim4/core/scene.py src/socialsim4/core/scenes/village_scene.py
git commit -m "refactor: add compact scenario descriptions"
```

---

### Task 2.4: Compress Output Format Instructions

**Files:**
- Modify: `src/socialsim4/agent.py`

**Step 1: Find output format method**

Run: `grep -n "def get_output_format\|OUTPUT_FORMAT" src/socialsim4/agent.py`

**Step 2: Create compact format**

Find the output format section and compress it. Replace verbose instructions with:

```python
def get_output_format(self) -> str:
    """Compact output format for 4B models."""
    return """--- Thoughts ---
[What you're thinking right now]

--- Plan ---
Goals: [your goals]
Milestones: [completed ✓, pending →]

--- Action ---
<Action name="[action_name]">
  [parameters if needed]
</Action>

Example:
--- Thoughts ---
I need to gather food.

--- Plan ---
Goals: Collect dinner
Milestones: ✓ at market, → gather food

--- Action ---
<Action name="gather_resource"><resource>food</resource></Action>
"""
```

**Step 3: Test output format**

Create test to verify format is included in prompt.

**Step 4: Commit**

```bash
git add src/socialsim4/agent.py
git commit -m "refactor: compact output format instructions"
```

---

### Task 2.5: Remove Redundant Examples

**Files:**
- Modify: `src/socialsim4/agent.py`
- Modify: `src/socialsim4/core/scene.py`

**Step 1: Find examples in prompts**

Run: `grep -n "get_examples\|example\|Example" src/socialsim4/agent.py | head -20`

**Step 2: Make examples optional by default**

In scene base class, make `get_examples()` return empty string by default:

```python
def get_examples(self) -> str:
    """Return examples. Override in specific scenes if needed."""
    return ""
```

**Step 3: Verify examples aren't duplicated**

Check that examples aren't being added elsewhere in the prompt.

**Step 4: Test without examples**

Run a simulation and verify agents still produce correct output format.

**Step 5: Commit**

```bash
git add src/socialsim4/agent.py src/socialsim4/core/scene.py
git commit -m "refactor: remove redundant examples from prompts"
```

---

### Task 2.6: Test with 4B Model

**Files:**
- Create: `tests/test_prompt_4b.py`

**Step 1: Create test for token count**

```python
# tests/test_prompt_4b.py
import pytest
from socialsim4.core.agent import Agent
from socialsim4.core.llm import MockLLMClient
from socialsim4.core.scenes.village_scene import VillageScene, build_village_scene

def test_prompt_token_count_for_4b():
    """Verify prompt fits within 4B model context window."""
    # Build scene
    clients = {}
    scene = build_village_scene(clients)

    # Create agent
    agent = Agent(
        name="Alice",
        role="Farmer",
        user_profile="A simple farmer.",
        llm_client=MockLLMClient()
    )
    scene.initialize_agent(agent)

    # Get system prompt
    prompt = agent.system_prompt(scene)

    # Count tokens (rough estimate: 1 token ≈ 4 characters)
    estimated_tokens = len(prompt) // 4

    # Should be under 2000 tokens for 4B models
    assert estimated_tokens < 2000, f"Prompt too large: {estimated_tokens} tokens"

    # Verify essential elements present
    assert "Alice" in prompt
    assert "Village" in prompt
    assert "<Action" in prompt
    assert "--- Thoughts ---" in prompt
    assert "--- Plan ---" in prompt
    assert "--- Action ---" in prompt

def test_compact_xml_format():
    """Verify actions use compact XML format."""
    from socialsim4.core.actions.base_actions import SpeakAction

    instruction = SpeakAction.INSTRUCTION

    # Should be compact
    assert len(instruction) < 200

    # Should have XML format
    assert "<Action" in instruction
    assert "</Action>" in instruction or "/>" in instruction

if __name__ == "__main__":
    test_prompt_token_count_for_4b()
    test_compact_xml_format()
    print("All tests passed!")
```

**Step 2: Run tests**

Run: `python tests/test_prompt_4b.py`

**Step 3: Measure actual token count**

Add more detailed measurement:

```python
def measure_prompt():
    from socialsim4.core.agent import Agent
    from socialsim4.core.llm import MockLLMClient
    from socialsim4.core.scenes.village_scene import build_village_scene

    clients = {}
    scene = build_village_scene(clients)
    agent = Agent(
        name="Alice",
        role="Farmer",
        user_profile="A simple farmer who grows crops.",
        llm_client=MockLLMClient()
    )
    scene.initialize_agent(agent)

    prompt = agent.system_prompt(scene)

    print(f"Prompt length: {len(prompt)} characters")
    print(f"Estimated tokens: {len(prompt) // 4}")
    print(f"\n--- PROMPT ---\n{prompt}\n--- END PROMPT ---")

if __name__ == "__main__":
    measure_prompt()
```

Run: `python tests/test_prompt_4b.py`

**Step 4: Verify with real 4B model (optional)**

If you have Ollama running with a 4B model:

```bash
# Test with gemma:4b or similar
ollama run gemma2:9b # or your 4B model
```

**Step 5: Commit**

```bash
git add tests/test_prompt_4b.py
git commit -m "test: add 4B model prompt validation tests"
```

---

## Phase 3: Generic Template System (3-5 days)

### Task 3.1: Define Generic Template Schema

**Files:**
- Create: `src/socialsim4/scenarios/generic_schema.py`

**Step 1: Create schema dataclasses**

```python
# src/socialsim4/scenarios/generic_schema.py
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any

@dataclass
class SpatialConfig:
    """Spatial/grid mechanic configuration."""
    enabled: bool = False
    grid_size: tuple[int, int] = (20, 20)
    terrain: str = "open"  # open, village, custom

@dataclass
class DiscussionConfig:
    """Discussion/chat mechanic configuration."""
    enabled: bool = False
    mode: str = "freeform"  # freeform, turnbased, moderated
    proximity_required: bool = False

@dataclass
class VotingConfig:
    """Voting/consensus mechanic configuration."""
    enabled: bool = False
    rule: str = "majority"  # majority, unanimous, weighted
    quorum_percent: float = 0.5

@dataclass
class ResourceConfig:
    """Resource management mechanic configuration."""
    enabled: bool = False
    types: List[str] = field(default_factory=list)
    scarcity: bool = False

@dataclass
class HierarchyConfig:
    """Hierarchy/roles mechanic configuration."""
    enabled: bool = False
    levels: int = 1
    role_names: List[List[str]] = field(default_factory=list)

@dataclass
class SemanticAction:
    """User-defined semantic action (LLM-interpreted)."""
    name: str
    description: str
    effects: str

@dataclass
class GenericTemplateConfig:
    """Configuration for a generic user-defined template."""
    name: str
    description: str

    # Core mechanics
    spatial: SpatialConfig = field(default_factory=SpatialConfig)
    discussion: DiscussionConfig = field(default_factory=DiscussionConfig)
    voting: VotingConfig = field(default_factory=VotingConfig)
    resources: ResourceConfig = field(default_factory=ResourceConfig)
    hierarchy: HierarchyConfig = field(default_factory=HierarchyConfig)

    # Custom semantic actions
    semantic_actions: List[SemanticAction] = field(default_factory=list)

    # Additional scene state
    initial_state: Dict[str, Any] = field(default_factory=dict)
```

**Step 2: Commit**

```bash
git add src/socialsim4/scenarios/generic_schema.py
git commit -m "feat: add generic template schema"
```

---

### Task 3.2: Create GenericScene Class

**Files:**
- Create: `src/socialsim4/scenarios/generic_scene.py`

**Step 1: Create GenericScene**

```python
# src/socialsim4/scenarios/generic_scene.py
from typing import Any, Dict
from socialsim4.core.scene import Scene
from socialsim4.core.actions.base_actions import SendMessageAction, YieldAction
from .generic_schema import GenericTemplateConfig

class GenericScene(Scene):
    """A scene composed from user-selected mechanics."""

    def __init__(self, config: GenericTemplateConfig, **kwargs):
        super().__init__(**kwargs)
        self.config = config
        self.state = dict(config.initial_state)

        # Build action space based on enabled mechanics
        self._build_action_space()

    def _build_action_space(self):
        """Build action space from enabled mechanics."""
        # Base actions
        self.action_space = [SendMessageAction(), YieldAction()]

        # Add discussion actions
        if self.config.discussion.enabled:
            from socialsim4.core.actions.base_actions import SpeakAction
            self.action_space.append(SpeakAction())

        # Add spatial actions
        if self.config.spatial.enabled:
            from socialsim4.core.actions.village_actions import (
                MoveToLocationAction,
                LookAroundAction
            )
            self.action_space.extend([
                MoveToLocationAction(),
                LookAroundAction()
            ])
            # Initialize map if spatial
            self._init_spatial()

        # Add resource actions
        if self.config.resources.enabled:
            from socialsim4.core.actions.village_actions import GatherResourceAction, RestAction
            self.action_space.extend([
                GatherResourceAction(),
                RestAction()
            ])

        # Add voting actions
        if self.config.voting.enabled:
            from socialsim4.core.actions.council_actions import (
                VoteAction,
                StartVotingAction,
                FinishVotingAction
            )
            self.action_space.extend([
                VoteAction(),
                StartVotingAction(),
                FinishVotingAction()
            ])

    def _init_spatial(self):
        """Initialize spatial map."""
        from socialsim4.core.scenes.village_scene import GameMap

        width, height = self.config.spatial.grid_size
        self.map = GameMap(width, height)

        # Add basic locations if village terrain
        if self.config.spatial.terrain == "village":
            from socialsim4.core.scenes.village_scene import Location
            self.map.locations = [
                Location("market", 10, 10),
                Location("farm", 5, 5),
                Location("school", 15, 15),
            ]
            for loc in self.map.locations:
                self.map.add_location(loc)

    def get_scenario_description(self) -> str:
        """Return scenario description based on config."""
        parts = [f"{self.config.name}"]

        if self.config.spatial.enabled:
            w, h = self.config.spatial.grid_size
            parts.append(f"Grid: {w}x{h}")

        if self.config.resources.enabled:
            types = ", ".join(self.config.resources.types)
            parts.append(f"Resources: {types}")

        if self.config.voting.enabled:
            parts.append(f"Voting: {self.config.voting.rule}")

        return ". ".join(parts) + "."

    def get_behavior_guidelines(self) -> str:
        """Return behavior guidelines."""
        guidelines = []

        if self.config.spatial.enabled:
            guidelines.append("You can move to different locations.")
            guidelines.append("Use look_around to see who and what is nearby.")

        if self.config.discussion.enabled and self.config.discussion.proximity_required:
            guidelines.append("You can only talk to agents in the same location.")

        if self.config.resources.enabled:
            guidelines.append("You can gather resources from locations.")
            guidelines.append("Rest to recover energy if needed.")

        if self.config.voting.enabled:
            quorum = int(self.config.voting.quorum_percent * 100)
            guidelines.append(f"Voting requires {quorum}% participation to pass.")

        return " ".join(guidelines) if guidelines else "Stay in character and interact naturally."

    def initialize_agent(self, agent):
        """Initialize agent based on config."""
        super().initialize_agent(agent)

        # Add spatial state
        if self.config.spatial.enabled:
            agent.properties['map_xy'] = (10, 10)  # Center of map
            if self.config.resources.enabled:
                agent.properties['energy'] = 10
                agent.properties['hunger'] = 0
                agent.properties['inventory'] = {}

        # Add hierarchy state
        if self.config.hierarchy.enabled:
            # Assign level based on agent index or random
            import random
            level = random.randint(0, self.config.hierarchy.levels - 1)
            agent.properties['hierarchy_level'] = level
            if self.config.hierarchy.role_names and level < len(self.config.hierarchy.role_names):
                agent.role = self.config.hierarchy.role_names[level][0] \
                    if not agent.role else agent.role

    def get_compact_description(self) -> str:
        """Compact description for 4B models."""
        parts = [self.config.name]

        if self.config.spatial.enabled:
            w, h = self.config.spatial.grid_size
            parts.append(f"{w}x{h} grid")

        if self.config.resources.enabled:
            parts.append("Resources available")

        return ". ".join(parts) + "."
```

**Step 2: Commit**

```bash
git add src/socialsim4/scenarios/generic_scene.py
git commit -m "feat: add GenericScene class"
```

---

### Task 3.3: Create Generic Template Builder

**Files:**
- Create: `src/socialsim4/scenarios/generic.py`

**Step 1: Create builder function**

```python
# src/socialsim4/scenarios/generic.py
from typing import Dict, Callable, Any
from socialsim4.core.simulator import Simulator
from socialsim4.core.agent import Agent
from socialsim4.core.llm import create_llm_client
from .generic_schema import GenericTemplateConfig
from .generic_scene import GenericScene

def build_generic_simulation(
    config: GenericTemplateConfig,
    agents: list[Agent],
    clients: Dict[str, Any] | None = None,
    event_logger: Callable[[str, Dict], None] | None = None
) -> Simulator:
    """Build a simulation from a generic template config."""

    # Create scene
    scene = GenericScene(config)

    # Initialize agents with LLM clients
    for agent in agents:
        if not hasattr(agent, 'llm_client') or agent.llm_client is None:
            provider = agent.llm_config.get('provider', 'backend') if hasattr(agent, 'llm_config') else 'backend'
            model = agent.llm_config.get('model', 'default') if hasattr(agent, 'llm_config') else 'default'
            agent.llm_client = create_llm_client(provider, model)
        scene.initialize_agent(agent)

    # Create simulator
    sim = Simulator(
        agents=agents,
        scene=scene,
        clients=clients or {},
        event_handler=event_logger
    )

    return sim
```

**Step 2: Export from scenarios package**

Update `src/socialsim4/scenarios/__init__.py` or `basic.py` to include generic.

**Step 3: Commit**

```bash
git add src/socialsim4/scenarios/generic.py
git commit -m "feat: add generic template builder function"
```

---

### Task 3.4: Register Generic Template

**Files:**
- Modify: `src/socialsim4/scenarios/basic.py`

**Step 1: Import generic builder**

Add at top of file:

```python
from .generic_schema import GenericTemplateConfig
from .generic import build_generic_simulation
```

**Step 2: Add to SCENES dict**

Add generic template option:

```python
SCENES: Dict[str, SceneSpec] = {
    # ... existing scenes ...

    "generic": SceneSpec(
        builder=lambda clients, logger=None, config=None: build_generic_simulation(
            config or GenericTemplateConfig(
                name="Generic Simulation",
                description="A user-defined simulation"
            ),
            agents=[],
            clients=clients,
            event_logger=logger
        ),
        default_turns=50,
    ),
}
```

**Step 3: Commit**

```bash
git add src/socialsim4/scenarios/basic.py
git commit -m "feat: register generic template in scenes registry"
```

---

### Task 3.5: Create Generic Template UI (Frontend)

**Files:**
- Create: `frontend/pages/GenericTemplateBuilder.tsx`

**Step 1: Create template builder page**

```typescript
// frontend/pages/GenericTemplateBuilder.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSimulationStore } from '../store';
import { ArrowLeft, Plus, Trash2, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const GenericTemplateBuilder: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const addSimulation = useSimulationStore((s) => s.addSimulation);

  const [name, setName] = useState('My Simulation');
  const [description, setDescription] = useState('');

  // Mechanics
  const [spatialEnabled, setSpatialEnabled] = useState(false);
  const [gridSize, setGridSize] = useState({ width: 20, height: 20 });
  const [discussionEnabled, setDiscussionEnabled] = useState(true);
  const [proximityRequired, setProximityRequired] = useState(false);
  const [votingEnabled, setVotingEnabled] = useState(false);
  const [resourcesEnabled, setResourcesEnabled] = useState(false);
  const [resourceTypes, setResourceTypes] = useState<string[]>(['food', 'wood']);

  const [semanticActions, setSemanticActions] = useState<Array<{
    name: string;
    description: string;
    effects: string;
  }>>([]);

  const [newAction, setNewAction] = useState({ name: '', description: '', effects: '' });

  const handleAddAction = () => {
    if (newAction.name && newAction.description) {
      setSemanticActions([...semanticActions, newAction]);
      setNewAction({ name: '', description: '', effects: '' });
    }
  };

  const handleCreate = () => {
    // Create template config
    const config = {
      name,
      description,
      mechanics: {
        spatial: { enabled: spatialEnabled, gridSize },
        discussion: { enabled: discussionEnabled, proximityRequired },
        voting: { enabled: votingEnabled, rule: 'majority', quorumPercent: 0.5 },
        resources: { enabled: resourcesEnabled, types: resourceTypes },
      },
      semanticActions,
    };

    // TODO: Save to backend and create simulation
    console.log('Creating simulation with config:', config);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-slate-500 hover:text-slate-700">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold">Generic Template Builder</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Basic Info */}
        <section className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Template Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                rows={3}
              />
            </div>
          </div>
        </section>

        {/* Core Mechanics */}
        <section className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Core Mechanics</h2>
          <div className="space-y-4">
            {/* Spatial */}
            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={spatialEnabled}
                onChange={(e) => setSpatialEnabled(e.target.checked)}
                className="w-5 h-5"
              />
              <div className="flex-1">
                <div className="font-medium">Spatial / Grid</div>
                <div className="text-sm text-slate-500">Enable movement and locations</div>
              </div>
            </label>

            {/* Discussion */}
            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={discussionEnabled}
                onChange={(e) => setDiscussionEnabled(e.target.checked)}
                className="w-5 h-5"
              />
              <div className="flex-1">
                <div className="font-medium">Discussion / Chat</div>
                <div className="text-sm text-slate-500">Enable agent communication</div>
              </div>
            </label>

            {/* Voting */}
            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={votingEnabled}
                onChange={(e) => setVotingEnabled(e.target.checked)}
                className="w-5 h-5"
              />
              <div className="flex-1">
                <div className="font-medium">Voting / Consensus</div>
                <div className="text-sm text-slate-500">Enable structured decisions</div>
              </div>
            </label>

            {/* Resources */}
            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={resourcesEnabled}
                onChange={(e) => setResourcesEnabled(e.target.checked)}
                className="w-5 h-5"
              />
              <div className="flex-1">
                <div className="font-medium">Resource Management</div>
                <div className="text-sm text-slate-500">Enable gathering and inventory</div>
              </div>
            </label>
          </div>
        </section>

        {/* Semantic Actions */}
        <section className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Custom Semantic Actions</h2>
          <p className="text-sm text-slate-500 mb-4">
            Define actions that the LLM will interpret behaviorally.
          </p>

          <div className="space-y-2 mb-4">
            {semanticActions.map((action, i) => (
              <div key={i} className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium">{action.name}</div>
                  <div className="text-sm text-slate-600">{action.description}</div>
                  <div className="text-xs text-slate-400">{action.effects}</div>
                </div>
                <button
                  onClick={() => setSemanticActions(semanticActions.filter((_, j) => j !== i))}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="grid gap-2">
            <input
              type="text"
              placeholder="Action name (e.g., propose_policy)"
              value={newAction.name}
              onChange={(e) => setNewAction({ ...newAction, name: e.target.value })}
              className="px-3 py-2 border rounded-lg text-sm"
            />
            <input
              type="text"
              placeholder="Description (e.g., Submit a policy proposal for voting)"
              value={newAction.description}
              onChange={(e) => setNewAction({ ...newAction, description: e.target.value })}
              className="px-3 py-2 border rounded-lg text-sm"
            />
            <input
              type="text"
              placeholder="Effects (e.g., May trigger voting round)"
              value={newAction.effects}
              onChange={(e) => setNewAction({ ...newAction, effects: e.target.value })}
              className="px-3 py-2 border rounded-lg text-sm"
            />
            <button
              onClick={handleAddAction}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600"
            >
              <Plus size={16} />
              Add Action
            </button>
          </div>
        </section>

        {/* Create Button */}
        <div className="flex justify-end gap-3">
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2 border rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Create Simulation
          </button>
        </div>
      </main>
    </div>
  );
};
```

**Step 2: Add route**

Update routing to include the generic template builder page.

**Step 3: Test UI**

1. Start frontend
2. Navigate to generic template builder
3. Verify mechanics can be toggled
4. Verify semantic actions can be added

**Step 4: Commit**

```bash
git add frontend/pages/GenericTemplateBuilder.tsx
git commit -m "feat: add generic template builder UI"
```

---

## Phase 4: Sociology Backend (2-3 days)

### Task 4.1: Implement Norm Disruption Scenario

**Files:**
- Create: `src/socialsim4/scenarios/sociology/norm_disruption.py`

**Step 1: Create norm disruption scene**

```python
# src/socialsim4/scenarios/sociology/norm_disruption.py
from typing import Dict, Any
from socialsim4.core.scene import Scene
from socialsim4.core.actions.base_actions import SendMessageAction, SpeakAction, YieldAction

class NormDisruptionScene(Scene):
    """Norm disruption scenario - agents react to sudden norm changes."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.current_norm = "Normal behavior expected"
        self.norm_history = []

    def get_scenario_description(self) -> str:
        return """Norm Disruption: A community of 20 agents with diverse professions and personalities.
A new norm has been announced. Watch how agents adapt, comply, or resist."""

    def get_behavior_guidelines(self) -> str:
        return """You have three key properties:
- 规范遵守度 (norm_compliance): How likely you are to follow norms (0-100)
- 社会地位 (social_status): Your standing in the community (0-100)
- 反抗倾向 (rebellion_tendency): How likely you are to resist norms (0-100)

Current norm: """ + self.current_norm

    def initialize_agent(self, agent):
        super().initialize_agent(agent)
        # Set default properties if not present
        agent.properties.setdefault('norm_compliance', 50)
        agent.properties.setdefault('social_status', 50)
        agent.properties.setdefault('rebellion_tendency', 30)

    def parse_and_handle_action(self, action_data: Dict, agent, simulator) -> tuple:
        """Handle norm-specific actions."""
        action_name = action_data.get('name', '')

        # Handle public broadcast (norm change)
        if action_name == 'public_broadcast':
            new_norm = action_data.get('norm', '')
            if new_norm:
                self.current_norm = new_norm
                self.norm_history.append({
                    'turn': simulator.turn,
                    'norm': new_norm,
                    'announced_by': agent.name
                })
                # Deliver to all agents
                for a in simulator.agents:
                    a.short_term_memory.append({
                        'role': 'system',
                        'content': f'NEW NORM ANNOUNCED by {agent.name}: {new_norm}'
                    })
                return (True, f"Norm announced: {new_norm}", "public_broadcast", {}, False)

        return super().parse_and_handle_action(action_data, agent, simulator)

def build_norm_disruption_scene(clients=None, event_logger=None):
    """Build a norm disruption simulation."""
    # Create 20 diverse agents
    from socialsim4.core.agent import Agent
    from socialsim4.core.llm import create_llm_client

    professions = ['Teacher', 'Merchant', 'Doctor', 'Police', 'Farmer',
                   'Worker', 'Administrator', 'Artist', 'Journalist', 'Lawyer']
    personalities = ['Conservative', 'Open', 'Rational', 'Emotional', 'Rebellious',
                     'Compliant', 'Social', 'Introverted', 'Optimistic', 'Pessimistic']

    agents = []
    llm_client = create_llm_client('backend', 'default')

    for i in range(20):
        prof = professions[i % 10]
        pers = personalities[i % 10]

        # Set properties based on profession/personality
        compliance = 50 + (10 if pers == 'Conservative' else -10 if pers == 'Rebellious' else 0)
        status = 60 if prof in ['Doctor', 'Police', 'Administrator'] else 40
        rebellion = 40 if pers == 'Rebellious' else 20

        agent = Agent(
            name=f"Agent{i+1}",
            role=f"{prof} ({pers})",
            user_profile=f"A {pers.lower()} {prof.lower()}.",
            llm_client=llm_client
        )
        agent.properties = {
            'norm_compliance': compliance,
            'social_status': status,
            'rebellion_tendency': rebellion
        }
        agents.append(agent)

    scene = NormDisruptionScene()
    for agent in agents:
        scene.initialize_agent(agent)

    from socialsim4.core.simulator import Simulator
    return Simulator(
        agents=agents,
        scene=scene,
        clients=clients or {},
        event_handler=event_logger
    )
```

**Step 2: Commit**

```bash
git add src/socialsim4/scenarios/sociology/norm_disruption.py
git commit -m "feat: add norm disruption scenario"
```

---

### Task 4.2: Implement Policy Diffusion Scenario

**Files:**
- Create: `src/socialsim4/scenarios/sociology/policy_diffusion.py`

**Step 1: Create policy diffusion scene**

```python
# src/socialsim4/scenarios/sociology/policy_diffusion.py
from socialsim4.core.scene import Scene

class PolicyDiffusionScene(Scene):
    """Policy diffusion scenario - 3-tier hierarchy with policy distortion."""

    def get_scenario_description(self) -> str:
        return """Policy Diffusion: A 3-tier organization (Government → Community → Residents).
Watch how policies change as they move through the hierarchy (Street-level Bureaucracy)."""

    def get_behavior_guidelines(self) -> str:
        return """You are in a hierarchical organization:
- 官级 (bureaucratic_rank): Your authority level (0-100)
- 灵活性 (flexibility): How much you adapt policies (0-100)
- 个人利益驱动 (self_interest): Personal motivation factor (0-100)

Government officials (rank 90): Create policy
Community leaders (rank 50): Interpret and convey policy
Residents (rank 10): Receive and react to policy"""

    def initialize_agent(self, agent):
        super().initialize_agent(agent)
        agent.properties.setdefault('bureaucratic_rank', 50)
        agent.properties.setdefault('flexibility', 50)
        agent.properties.setdefault('self_interest', 40)
        agent.properties.setdefault('trust_in_government', 50)
```

**Step 2: Commit**

```bash
git add src/socialsim4/scenarios/sociology/policy_diffusion.py
git commit -m "feat: add policy diffusion scenario"
```

---

### Task 4.3: Implement Polarization Scenario

**Files:**
- Create: `src/socialsim4/scenarios/sociology/polarization.py`

**Step 1: Create polarization scene**

```python
# src/socialsim4/scenarios/sociology/polarization.py
from socialsim4.core.scene import Scene

class PolarizationScene(Scene):
    """Polarization scenario - echo chambers and recommendation algorithms."""

    def get_scenario_description(self) -> str:
        return """Polarization: 20 agents divided into Radical (8), Conservative (8), and Neutral (4).
A recommendation algorithm pushes content based on reading history."""

    def get_behavior_guidelines(self) -> str:
        return """You have polarization-related properties:
- 立场强度 (stance_strength): How firmly you hold your position (0-100)
- 情绪易激怒度 (emotional_arousability): How easily provoked (0-100)
- 包容度 (tolerance): Acceptance of opposing views (0-100)
- 接收度 (receptivity): Willingness to consider new information (0-100)

Radical agents: High stance, high arousal, low tolerance
Conservative agents: High stance, medium arousal, medium tolerance
Neutral agents: Low stance, medium arousal, high tolerance"""

    def initialize_agent(self, agent):
        super().initialize_agent(agent)
        agent.properties.setdefault('stance_strength', 50)
        agent.properties.setdefault('emotional_arousability', 50)
        agent.properties.setdefault('tolerance', 50)
        agent.properties.setdefault('receptivity', 50)
        agent.properties.setdefault('reading_history', [])
```

**Step 2: Commit**

```bash
git add src/socialsim4/scenarios/sociology/polarization.py
git commit -m "feat: add polarization scenario"
```

---

### Task 4.4: Implement Resource Scarcity Scenario

**Files:**
- Create: `src/socialsim4/scenarios/sociology/resource_scarcity.py`

**Step 1: Create resource scarcity scene**

```python
# src/socialsim4/scenarios/sociology/resource_scarcity.py
from socialsim4.core.scene import Scene

class ResourceScarcityScene(Scene):
    """Resource scarcity scenario - trust-based contracts in crisis."""

    def get_scenario_description(self) -> str:
        return """Resource Scarcity: Post-disaster community with limited food and water.
Will agents form trust-based contracts or descend into fraud and collapse?"""

    def get_behavior_guidelines(self) -> str:
        return """You have trust-related properties:
- 社会资本 (social_capital): Your community standing (0-100)
- 诚实度 (honesty): How truthful you are (0-100)
- 绝望指数 (desperation): How desperate you are (0-100)
- 欺诈倾向 (fraud_tendency): Likelihood to cheat (0-100)

Resources are limited. You can:
- Form cooperation agreements (high social capital agents)
- Honor or betray trust (affects future interactions)
- Use fraud (high desperation + low honesty)"""

    def initialize_agent(self, agent):
        super().initialize_agent(agent)
        agent.properties.setdefault('social_capital', 50)
        agent.properties.setdefault('honesty', 70)
        agent.properties.setdefault('desperation', 30)
        agent.properties.setdefault('fraud_tendency', 20)
        agent.properties.setdefault('trust_scores', {})  # Track trust per agent
        agent.properties.setdefault('resources', {'food': 5, 'water': 5})

    def post_turn(self, agent, simulator):
        """Track resource consumption and desperation."""
        super().post_turn(agent, simulator)
        # Resources decrease each turn
        if 'resources' in agent.properties:
            agent.properties['resources']['food'] = max(0, agent.properties['resources']['food'] - 1)
            agent.properties['resources']['water'] = max(0, agent.properties['resources']['water'] - 1)

            # Desperation increases as resources decrease
            total = agent.properties['resources']['food'] + agent.properties['resources']['water']
            agent.properties['desperation'] = min(100, agent.properties['desperation'] + (10 - total))
```

**Step 2: Commit**

```bash
git add src/socialsim4/scenarios/sociology/resource_scarcity.py
git commit -m "feat: add resource scarcity scenario"
```

---

### Task 4.5: Register Sociology Scenarios

**Files:**
- Modify: `src/socialsim4/scenarios/basic.py`

**Step 1: Import sociology scenes**

```python
from .sociology.norm_disruption import build_norm_disruption_scene
from .sociology.policy_diffusion import build_policy_diffusion_scene
from .sociology.polarization import build_polarization_scene
from .sociology.resource_scarcity import build_resource_scarcity_scene
```

**Step 2: Add to SCENES dict**

```python
SCENES: Dict[str, SceneSpec] = {
    # ... existing scenes ...

    "norm_disruption": SceneSpec(
        builder=lambda clients, logger=None: build_norm_disruption_scene(clients, logger),
        default_turns=20,
    ),

    "policy_diffusion": SceneSpec(
        builder=lambda clients, logger=None: build_policy_diffusion_scene(clients, logger),
        default_turns=15,
    ),

    "polarization": SceneSpec(
        builder=lambda clients, logger=None: build_polarization_scene(clients, logger),
        default_turns=25,
    ),

    "resource_scarcity": SceneSpec(
        builder=lambda clients, logger=None: build_resource_scarcity_scene(clients, logger),
        default_turns=20,
    ),
}
```

**Step 3: Commit**

```bash
git add src/socialsim4/scenarios/basic.py
git commit -m "feat: register sociology scenarios in backend"
```

---

## Testing and Verification

### Task 5.1: End-to-End Test

**Step 1: Test demographics flow**

1. Start frontend and backend
2. Click "New Simulation"
3. Verify demographics is selected by default
4. Add demographic and trait
5. Generate agents
6. Verify agents appear
7. Start simulation
8. Verify simulation runs

**Step 2: Test prompt optimization**

1. Check logs for prompt size
2. Verify token count is under 2000
3. Run with 4B model if available
4. Verify output format is correct

**Step 3: Test generic template**

1. Navigate to generic template builder
2. Select mechanics
3. Create simulation
4. Verify it runs with selected mechanics

**Step 4: Test sociology scenarios**

1. Select each sociology template
2. Create simulation
3. Verify agent properties are set correctly
4. Run simulation and verify behavior

---

## Acceptance Criteria Checklist

- [ ] Wizard opens with demographics mode selected by default
- [ ] Demographics UI allows adding demographics and traits
- [ ] English translations display when language is set to English
- [ ] Chinese translations continue to work
- [ ] Static prompt tokens reduced to ~500-600
- [ ] Total per-turn tokens ~850-1800 (within 8K context)
- [ ] 4B models produce valid compact XML output
- [ ] Generic template appears in template selection
- [ ] Users can enable/disable core mechanics
- [ ] Users can define custom semantic actions
- [ ] All 4 sociology scenarios have backend implementations
- [ ] Sociology simulations run with correct agent properties

---

**End of Implementation Plan**
