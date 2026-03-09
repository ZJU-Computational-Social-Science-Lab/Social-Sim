---
phase: quick-005
plan: 005
type: fix
wave: 1
autonomous: true
---

# i18n Hardcoded Strings Fix Summary

## Overview
Fixed hardcoded strings identified in the i18n audit (task 004) across frontend and backend components.

## Files Modified

### Frontend (4 files)
| File | Changes | Status |
|------|---------|--------|
| `frontend/components/experiment/ActionSelector.tsx` | 10 strings → t() calls | Complete |
| `frontend/components/experiment/ExperimentBuilder.tsx` | 5 strings → t() calls, fixed missing hook | Complete |
| `frontend/components/experiment/Step5Network.tsx` | 3 zoom tooltips → t() calls | Complete |
| `frontend/components/experiment/Step2StarterTemplate.tsx` | 4 payoff labels → t() calls | Complete |

### Backend (2 files)
| File | Changes | Status |
|------|---------|--------|
| `src/socialsim4/backend/api/routes/experiments.py` | 12 strings → T() calls | Complete |
| `src/socialsim4/backend/api/routes/simulations/agent_documents.py` | 2 strings → T() calls | Complete |

### Locale Files (4 files)
| File | Keys Added |
|------|------------|
| `frontend/locales/en.json` | experimentBuilder.subtitle, actionSelector.*, network.* |
| `frontend/locales/zh.json` | experimentBuilder.subtitle, actionSelector.*, network.* |
| `src/socialsim4/locales/en.json` | api.errors.*, api.compare.* |
| `src/socialsim4/locales/zh.json` | api.errors.*, api.compare.* |

## Translation Keys Added

### Frontend Keys
```json
{
  "experimentBuilder": {
    "subtitle": "Design your social science experiment in 6 steps",
    "actionSelector": {
      "availableLabel": "Available Actions",
      "loading": "Loading actions...",
      "selectPrompt": "Select actions below...",
      "selectAction": "Select an action...",
      "addAction": "Add action... ({{count}}/{{max}})",
      "noneAvailable": "No actions available",
      "maxSelected": "Maximum {{max}} actions selected...",
      "fallbackWarning": "Using fallback options",
      "loadError": "Failed to load actions",
      "fallbackCooperate": "Cooperate",
      "fallbackCooperateDesc": "Cooperate with other players",
      "fallbackDefect": "Defect",
      "fallbackDefectDesc": "Act in self-interest"
    },
    "network": {
      "zoomIn": "Zoom in",
      "zoomOut": "Zoom out",
      "resetView": "Reset view"
    }
  }
}
```

### Backend Keys
```json
{
  "api": {
    "errors": {
      "missing_nodes": "Missing node_a or node_b in request body",
      "invalid_node_ids": "Invalid node id(s); must be integers",
      "node_not_found": "node_not_found",
      "agent_memory_unavailable": "Agent memory not available...",
      "llm_disabled_large_diff": " (Note: Large diff detected...)",
      "llm_no_client": " (No LLM client configured)",
      "llm_quota_exhausted": " (Note: User LLM quota exhausted...)"
    },
    "compare": {
      "node_unique_events": "Node {{node}} has {{count}} unique events.",
      "agent_property_diffs": "{{count}} agents have property differences.",
      "no_obvious_diff": "No obvious differences found..."
    }
  }
}
```

## Bug Fixes
1. **ExperimentBuilder.tsx**: Fixed `ReferenceError: t is not defined` by adding `const { t } = useTranslation();` hook destructuring

## Commits
1. `8c1d007` - feat(005): add i18n translations for ActionSelector component
2. `bbf4f62` - feat(005): add i18n translations for ExperimentBuilder and Step5Network
3. `61eb4bc` - fix(i18n): add missing subtitle key and t() hook in ExperimentBuilder
4. `ca1318f` - feat(i18n): add backend translations for API error messages
5. `9d36d4d` - refactor(i18n): improve Step2StarterTemplate and simplify action descriptions

## Remaining Work
The following MEDIUM/LOW priority items from the audit remain:
- `frontend/components/TestModal.tsx` - 5 test-related strings (Low priority - test file)
- `frontend/index.tsx` - 1 error message (Low priority - dev error)
- `frontend/components/AgentPanel.tsx` - Image alt text (Low priority)
- Various image alt attributes across components (Low priority)

## Testing
- Frontend loads without errors
- ExperimentBuilder renders correctly with translated text
- API error messages return localized strings based on language setting
