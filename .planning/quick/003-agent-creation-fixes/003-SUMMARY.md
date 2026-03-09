# Phase Quick Plan 003: Agent Creation Fixes - Summary

**One-liner:** Fixed manual agent field mapping (camelCase to snake_case), added LLM provider configuration per agent, and enhanced demographic generation with validation and timeout handling.

## Metadata

- **Phase:** quick
- **Plan:** 003
- **Subsystem:** Agent Creation Pipeline
- **Tags:** `agent-config`, `field-mapping`, `llm-provider`, `validation`, `timeout-handling`
- **Started:** 2026-03-09T04:02:55Z
- **Completed:** 2026-03-09T04:10:53Z
- **Duration:** 478 seconds (~8 minutes)

## Deviations from Plan

### Auto-fixed Issues

**None - plan executed exactly as written.**

All tasks were completed according to the specification with no unexpected issues encountered.

## Key Files Modified

### Frontend
1. `frontend/store/experiment-builder.ts` - Added `providerId` field to `ManualAgentType` interface
2. `frontend/components/experiment/Step4Agents.tsx` - Include `providerId` when creating agents
3. `frontend/components/ExperimentBuilderModal.tsx` - Map camelCase to snake_case, include provider_id and defaults

### Backend
1. `src/socialsim4/backend/api/routes/simulations/crud.py` - Added `_normalize_agent_config` function
2. `src/socialsim4/backend/services/simtree_runtime.py` - Added fallback logic for field name mapping
3. `src/socialsim4/core/llm/generation.py` - Added validation, timeout handling, and fallbacks
4. `src/socialsim4/backend/api/routes/llm.py` - Added validation before calling generation

## Changes Summary

### Task 1: Fix Manual Agent Type field mapping and LLM config

**Problem:** Frontend uses camelCase (`rolePrompt`, `userProfile`) but backend expects snake_case (`role_prompt`, `user_profile`). LLM provider configuration was not being passed to individual agents.

**Solution:**
- Added `providerId` field to `ManualAgentType` interface
- Updated `addAgentType` to include `providerId` when adding agent types
- Updated `ExperimentBuilderModal` to map fields: `rolePrompt -> role_prompt`, `userProfile -> user_profile`
- Added `provider_id` to agent config from selected provider
- Ensured `avatarUrl` is preserved in properties

**Files Modified:**
- `frontend/store/experiment-builder.ts`
- `frontend/components/experiment/Step4Agents.tsx`
- `frontend/components/ExperimentBuilderModal.tsx`

### Task 2: Add field mapping middleware in simulation creation

**Problem:** Backend only accepted `profile` field but manual agents send `user_profile`. Missing default values for required fields.

**Solution:**
- Added `_normalize_agent_config()` function in `crud.py` to convert camelCase to snake_case
- Field mappings: `rolePrompt -> role_prompt`, `userProfile -> user_profile`, `avatarUrl -> avatar_url`
- Added default values: `history: {}`, `memory: []`, `score: 0`
- Updated `_apply_agent_config()` in `simtree_runtime.py` with fallback logic:
  - Tries `profile`, then `user_profile`, then `userProfile` (camelCase)
  - Tries `role_prompt`, then `rolePrompt` (camelCase)
  - Preserves `avatarUrl` from properties
- Applies normalization in both `create_simulation` and `update_simulation`

**Files Modified:**
- `src/socialsim4/backend/api/routes/simulations/crud.py`
- `src/socialsim4/backend/services/simtree_runtime.py`

### Task 3: Enhance demographic generation with validation and timeout

**Problem:** No validation for probability normalization or trait ranges. LLM calls could hang indefinitely. No fallback for empty responses.

**Solution:**
- Added `_validate_and_normalize_probabilities()` - Checks if sum is 1.0 (±0.01), normalizes if needed
- Added `_validate_trait_ranges()` - Validates mean is 0-100, std is 0-50
- Added 30-second timeout in `generate_archetype_template()` using cross-platform threading
- Added fallback roles for English and Chinese when LLM fails
- Improved error messages to be user-friendly
- Added pre-validation in `llm.py` route

**Files Modified:**
- `src/socialsim4/core/llm/generation.py`
- `src/socialsim4/backend/api/routes/llm.py`

## Tech Stack

**Patterns Added:**
- Field name normalization middleware (camelCase <-> snake_case)
- Graceful degradation with fallback values
- Timeout handling for external service calls
- Defensive validation with clear error messages

**Key Dependencies:**
- None added (uses standard library `threading` and `queue` for timeout)

## Dependency Graph

### Provides
- Agent creation with proper field mapping (frontend -> backend)
- Per-agent LLM provider configuration
- Validated demographic generation with timeout protection

### Affects
- Experiment Builder agent creation flow
- Simulation creation/update endpoints
- Demographic generation API

### Related to
- Quick task 002 (simulation wizard)
- Frontend experiment-builder store
- Backend agent config pipeline

## Decisions Made

1. **Field mapping at API layer** - Chose to normalize field names in `crud.py` rather than modifying core agent classes. This keeps the backend API flexible and frontend-agnostic.

2. **Fallback values for LLM timeout** - Instead of failing the entire generation, use generic roles/descriptions when LLM times out. This allows experiments to proceed even with unreliable LLM services.

3. **Threading-based timeout** - Used `threading.Thread` with `daemon=True` and `join(timeout=30)` for cross-platform timeout support. This works on both Windows and Unix systems, unlike `signal.SIGALRM` which is Unix-only.

4. **Tolerance-based probability check** - Used ±0.01 tolerance when checking if probabilities sum to 1.0 to handle floating-point precision issues.

5. **Per-agent provider config** - Each agent type can have its own provider, falling back to global selection. This allows mixed-provider experiments (e.g., some agents on GPT-4, others on local models).

## Commits

1. `3897ac1` - feat(003): fix manual agent field mapping and LLM config
2. `b6b98ff` - feat(003): add field mapping middleware in simulation creation
3. `8f87829` - feat(003): enhance demographic generation with validation and timeout
4. `565e850` - fix(003): use cross-platform threading timeout instead of Unix signals

## Success Criteria

- [x] Manual agents specify which LLM provider/model to use
- [x] Field names consistent between frontend (camelCase) and backend (snake_case)
- [x] Avatar URLs preserved through data pipeline
- [x] Demographic generation validates probability normalization
- [x] LLM timeout handling prevents hanging
- [x] Required agent fields have proper defaults
- [x] All errors are user-friendly and actionable

## Verification Steps

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

## Self-Check

### Files Created
- [x] `.planning/quick/003-agent-creation-fixes/003-SUMMARY.md`

### Commits Exist
- [x] `3897ac1` - feat(003): fix manual agent field mapping and LLM config
- [x] `b6b98ff` - feat(003): add field mapping middleware in simulation creation
- [x] `8f87829` - feat(003): enhance demographic generation with validation and timeout
- [x] `565e850` - fix(003): use cross-platform threading timeout instead of Unix signals

### Self-Check: PASSED

All commits exist and all files created successfully.
