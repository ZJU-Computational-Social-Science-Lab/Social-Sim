---
phase: quick
plan: 003
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/components/experiment/Step4Agents.tsx
  - frontend/store/experiment-builder.ts
  - src/socialsim4/backend/api/routes/simulations/crud.py
  - src/socialsim4/core/llm/generation.py
autonomous: true
requirements: []
user_setup: []

must_haves:
  truths:
    - "Manual agents specify LLM provider configuration"
    - "Field names match between frontend and backend (camelCase <-> snake_case mapping)"
    - "Avatar URLs are preserved through the data pipeline"
    - "Demographic generation validates probability normalization"
    - "LLM timeout handling prevents hanging generation"
    - "Required agent fields (history, memory, score) have proper defaults"
  artifacts:
    - path: "frontend/components/experiment/Step4Agents.tsx"
      provides: "Agent creation UI with proper field mapping"
      min_lines: 400
    - path: "frontend/store/experiment-builder.ts"
      provides: "State management with LLM provider tracking"
      contains: "ManualAgentType"
    - path: "src/socialsim4/core/llm/generation.py"
      provides: "Agent archetype generation with timeout and fallback"
      exports: ["generate_agents_with_archetypes"]
    - path: "src/socialsim4/backend/api/routes/simulations/crud.py"
      provides: "Simulation creation endpoint with agent config processing"
      exports: ["create_simulation"]
  key_links:
    - from: "Step4Agents.tsx"
      to: "experiment-builder.ts"
      via: "addAgentType() stores agent config with provider"
      pattern: "llmProvider.*provider_id"
    - from: "experiment-builder.ts"
      to: "create_simulation endpoint"
      via: "agent_config payload with provider mapping"
      pattern: "provider_id.*agent_config"
    - from: "crud.py create_simulation"
      to: "simtree_runtime.py _apply_agent_config"
      via: "agent_config passed to tree builder"
      pattern: "agent_config.*agents"
---

<objective>
Fix critical data flow issues in agent creation for Manual and Demographic Generation methods.

Purpose: The Experiment Builder's agent creation has field name mismatches, missing LLM config, and incomplete data pipelines that cause agents to fail during simulation initialization.

Output: Working agent creation with proper field mapping, LLM provider configuration, and validation.
</objective>

<execution_context>
@C:/Users/Justin/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Justin/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@frontend/components/experiment/Step4Agents.tsx
@frontend/store/experiment-builder.ts
@frontend/store/helpers.ts
@src/socialsim4/core/llm/generation.py
@src/socialsim4/backend/api/routes/simulations/crud.py
@src/socialsim4/backend/services/simtree_runtime.py

<interfaces>
<!-- Key contracts from existing code that must be maintained -->

From frontend/store/experiment-builder.ts:
```typescript
export interface ManualAgentType {
  id: string;
  label: string;
  count: number;
  rolePrompt: string;      // camelCase - frontend
  userProfile: string;     // camelCase - frontend
  properties: Record<string, unknown>;
}
```

From src/socialsim4/backend/services/simtree_runtime.py (line ~185):
```python
# Backend expects snake_case
profile = str(cfg.get("profile") or "").strip()
if profile:
    agent.user_profile = profile  # Maps to Agent.user_profile
```

From src/socialsim4/core/llm/generation.py (line ~300):
```python
agent = {
    "id": f"agent_{agent_num}",
    "name": name,
    "role": role,
    "avatarUrl": f"https://api.dicebear.com/7.x/avataaars/svg?seed=agent{agent_num}",
    "profile": profile,  # Used for user_profile
    "properties": properties,
    "history": {},        # Already included
    "memory": [],         # Already included
    "knowledgeBase": []   # Already included
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Fix Manual Agent Type field mapping and LLM config</name>
  <files>
    frontend/components/experiment/Step4Agents.tsx
    frontend/store/experiment-builder.ts
  </files>
  <behavior>
    - Test 1: ManualAgentType with rolePrompt and userProfile converts to snake_case (role_prompt, user_profile)
    - Test 2: ManualAgentType includes provider_id when selectedProviderId is set
    - Test 3: Avatar URL generated in frontend is preserved in properties
    - Test 4: Required fields (history, memory, score) have proper defaults
  </behavior>
  <action>
    In Step4Agents.tsx:
    1. When creating ManualAgentType for manual agents, map camelCase to snake_case:
       - rolePrompt -> role_prompt
       - userProfile -> user_profile
    2. Include avatarUrl in properties (already generated at line 423)
    3. Add provider_id mapping from selectedProviderId

    In experiment-builder.ts:
    1. Add providerId field to ManualAgentType interface
    2. Update addAgentType to include providerId when adding agent types

    The key issue: Frontend stores rolePrompt/userProfile but backend expects role_prompt/user_profile.
    The conversion should happen when building the agent_config payload for simulation creation.
  </action>
  <verify>
    <automated>
      # Check that ManualAgentType interface has providerId
      grep -n "providerId" frontend/store/experiment-builder.ts
      # Check that role_prompt is used in agent building
      grep -n "role_prompt" frontend/components/experiment/Step4Agents.tsx
    </automated>
  </verify>
  <done>
    Manual agents include:
    - provider_id (from selectedProviderId)
    - role_prompt (mapped from rolePrompt)
    - user_profile (mapped from userProfile)
    - avatarUrl (preserved in properties)
    - history: {}, memory: [], score: 0 (defaults)
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add field mapping middleware in simulation creation</name>
  <files>
    src/socialsim4/backend/api/routes/simulations/crud.py
    src/socialsim4/backend/services/simtree_runtime.py
  </files>
  <behavior>
    - Test 1: Agent config with camelCase fields converts to snake_case
    - Test 2: Missing fields (history, memory, score) are populated with defaults
    - Test 3: provider_id is extracted and stored separately for LLM client creation
    - Test 4: Avatar URL from properties is preserved in agent data
  </behavior>
  <action>
    In crud.py create_simulation():
    1. Add field mapping function to convert camelCase to snake_case for agent_config
    2. Ensure required fields have defaults:
       - history: {} if missing
       - memory: [] if missing
       - score: 0 if missing
    3. Extract provider_id from agent config and store in scene_config or separate field

    In simtree_runtime.py _apply_agent_config():
    1. Add mapping for role_prompt -> Agent.role_prompt if exists
    2. Add mapping for avatarUrl from properties to agent display
    3. Ensure agent.user_profile is set from profile OR user_profile field

    The key issue: Backend simtree_runtime.py expects "profile" but manual agents send "user_profile".
    Add fallback logic: try "profile" first, then "user_profile", then empty string.
  </action>
  <verify>
    <automated>
      # Check for field mapping logic
      grep -n "camelCase\|snake_case\|role_prompt\|user_profile" src/socialsim4/backend/api/routes/simulations/crud.py
      # Check for fallback logic in agent config application
      grep -n "user_profile\|role_prompt" src/socialsim4/backend/services/simtree_runtime.py
    </automated>
  </verify>
  <done>
    Backend accepts both camelCase (frontend) and snake_case (backend) field names.
    Missing fields populated with defaults.
    Avatar URLs preserved through the pipeline.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Enhance demographic generation with validation and timeout</name>
  <files>
    src/socialsim4/core/llm/generation.py
    src/socialsim4/backend/api/routes/llm.py
  </files>
  <behavior>
    - Test 1: Probabilities that don't sum to 1 are normalized with warning
    - Test 2: Trait mean/std values are validated (0-100 range)
    - Test 3: LLM timeout prevents hanging (30 second timeout)
    - Test 4: Empty LLM response uses fallback roles
  </behavior>
  <action>
    In src/socialsim4/core/llm/generation.py:

    1. Add probability normalization validation in generate_agents_with_archetypes():
       - Calculate sum of archetype_probabilities
       - If sum != 1.0 (within tolerance), normalize and log warning
       - Return clear error message if normalization fails

    2. Add trait range validation:
       - Mean should be in 0-100 range
       - Std should be in 0-50 range (reasonable bounds)
       - Raise ValueError with clear message if out of bounds

    3. Add timeout handling for generate_archetype_template():
       - Wrap llm_client.chat() in timeout wrapper (asyncio.wait_for if async, or signal.timeout)
       - Set 30 second timeout per archetype
       - On timeout, use fallback description and generic roles

    4. Add fallback for empty LLM responses:
       - If roles list is empty or null, use ["Citizen", "Worker", "Professional", "Student", "Other"]
       - If description is empty, use generic archetype label

    In src/socialsim4/backend/api/routes/llm.py:
    1. Add validation before calling generate_agents_with_archetypes():
       - Check trait ranges before passing to generation
       - Check probability sum and warn if not normalized
    2. Improve error messages to be user-friendly

    Key issues from audit:
    - No probability normalization validation
    - Limited trait validation
    - No LLM timeout handling
    - No fallback for empty responses
  </action>
  <verify>
    <automated>
      # Check for validation logic
      grep -n "probability.*sum\|normalize\|trait.*range\|timeout\|fallback" src/socialsim4/core/llm/generation.py
      # Verify timeout handling
      grep -n "wait_for\|timeout\|TimeoutError" src/socialsim4/core/llm/generation.py
    </automated>
  </verify>
  <done>
    Demographic generation:
    - Validates and normalizes probabilities
    - Validates trait ranges with clear errors
    - Handles LLM timeouts gracefully
    - Provides fallback roles/descriptions
    - All errors are user-friendly
  </done>
</task>

</tasks>

<verification>
1. Test manual agent creation:
   - Create manual agent with rolePrompt and userProfile
   - Verify LLM provider is assigned
   - Verify avatar URL is displayed
   - Start simulation and verify agents load correctly

2. Test demographic generation:
   - Set probabilities that don't sum to 1 (e.g., 0.3, 0.3, 0.3)
   - Verify normalization warning appears
   - Set trait mean to 150 (out of range)
   - Verify clear validation error appears
   - Generate agents and verify they have proper fields

3. Test data flow end-to-end:
   - Create simulation with manual agents
   - Check that agent_config in database has correct field names
   - Verify simulation tree builds without errors
   - Run simulation and verify agents function

4. Test timeout handling:
   - Configure very slow LLM provider
   - Attempt demographic generation
   - Verify it doesn't hang indefinitely
   - Verify fallback agents are created
</verification>

<success_criteria>
- Manual agents specify which LLM provider/model to use
- Field names consistent between frontend (camelCase) and backend (snake_case)
- Avatar URLs preserved through data pipeline
- Demographic generation validates probability normalization
- LLM timeout handling prevents hanging
- Required agent fields have proper defaults
- All errors are user-friendly and actionable
</success_criteria>

<output>
After completion, create `.planning/quick/003-agent-creation-fixes/003-SUMMARY.md`
</output>
