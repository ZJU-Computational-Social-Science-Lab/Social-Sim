# Bug Fix: PGG Follow-Up Prompt Showing Wrong Actions

## Issue Description

In the Public Goods Game (PGG), when agents chose to "allocate", the follow-up prompt incorrectly showed all actions from the scenario registry (including "allocate", "keep", AND "skip"), instead of just asking for the allocation amount.

This caused the LLM to treat the follow-up as a fresh action selection and choose "skip" instead of providing the amount parameter.

## Root Cause Analysis

### Evidence Trail

1. **Error Log** (`test_results/experiment_debug_20260401_205930.txt`):
   - Line 17: Initial prompt correctly filtered to `['allocate', 'keep']`
   - Line 99: Controller allowed `['allocate', 'keep', 'skip']` ← Problem!
   - Line 138-141: Follow-up prompt showed all 3 actions including "skip"
   - Line 164-166: Model responded with `{"action": "skip"}` instead of amount

2. **Commit History**:
   - Commit `09ef348` (March 25, 2026): "refactor(pgg): rename parameters, add complete actions list, dynamic schema"
   - This added "skip" action to PUBLIC_GOODS scenario registry (for deduction phase)
   - "skip" is ONLY meant for the deduction phase, not allocation phase

3. **Code Trace**:
   ```
   runner.py:803 → allowed_actions = scene.get_scene_actions(agent.name)  # ✓ Correctly filtered
   runner.py:960 → process_response_with_followup(..., allowed_actions=???)  # ✗ NOT PASSED!
   controller.py:299 → build_reprompt(..., allowed_actions=???)  # ✗ NOT RECEIVED!
   prompt_builder.py:383 → build_prompt(..., allowed_actions=None)  # ✗ Shows ALL actions!
   ```

### The Fix (3 Parts)

**Part 1: Thread `allowed_actions` through controller** (`src/socialsim4/core/experiment/controller.py`)
```python
# Added parameter to signature
async def process_response_with_followup(
    self,
    # ... existing params ...
    allowed_actions: Optional[List[str]] = None,  # ← NEW
) -> ActionResult:
```

**Part 2: Pass `allowed_actions` to `build_reprompt`** (`src/socialsim4/core/experiment/controller.py`)
```python
followup_prompt = build_reprompt(
    # ... existing params ...
    allowed_actions=allowed_actions,  # ← ADDED
)
```

**Part 3: Simplify follow-up prompt structure** (`src/socialsim4/core/experiment/prompt_builder.py`)
- **Before**: JSON mode follow-up included FULL base prompt with action list
- **After**: JSON mode follow-up only shows:
  - Agent description (identity)
  - Scenario (game context)
  - Context (round history)
  - Parameter request (JUST the required parameters)

This matches the behavior of `plain_text` mode follow-ups, which also don't re-list actions.

## Verification

Created `test_pgg_followup_fix.py` which confirms:
1. ✓ Initial prompt shows only phase-filtered actions (`allocate`, `keep`)
2. ✓ Follow-up prompt does NOT re-list actions
3. ✓ Follow-up prompt only asks for amount parameter
4. ✓ Follow-up prompt does NOT mention "skip" action

## Files Modified

1. `src/socialsim4/core/experiment/controller.py`:
   - Added `allowed_actions` parameter to `process_response_with_followup`
   - Passed `allowed_actions` to `build_reprompt`

2. `src/socialsim4/core/experiment/runner.py`:
   - Passed `allowed_actions` to `controller.process_response_with_followup`

3. `src/socialsim4/core/experiment/prompt_builder.py`:
   - Simplified JSON mode follow-up to exclude action list
   - Follow-up now only asks for required parameters without re-listing actions

## Impact

- **Fixes**: PGG allocation phase now correctly asks for amount without confusing action list
- **Preserves**: Deduction phase still correctly shows "reduce" and "skip" actions
- **Generalizes**: All scenarios with parameterized actions benefit from clearer follow-up prompts

## Testing

Run: `python test_pgg_followup_fix.py`

Expected output: All 4 tests pass
