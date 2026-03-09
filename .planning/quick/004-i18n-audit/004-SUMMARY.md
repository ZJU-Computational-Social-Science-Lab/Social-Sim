---
phase: quick-004
plan: 004
type: audit
wave: 1
autonomous: true
---

# i18n Compliance Audit Report

## Summary

- **Total frontend files scanned:** 122 TSX files
- **Total backend files scanned:** 62 Python files (API layer)
- **Files with violations:** 18 source files (15 frontend, 3 backend)
- **Total hardcoded strings found:** ~50
- **Files already compliant:** 61 files (51 frontend + 10 backend)

### Compliance Rate
- Frontend: 51/122 files (42%) use useTranslation
- Backend: 10/62 files (16%) use T()

---

## Findings by Severity

### HIGH Priority (User-facing UI text - 25 items)

These directly impact user experience and should be addressed first.

| File | Line | String | Category |
|-----|------|--------|----------|
| `frontend/components/experiment/ActionSelector.tsx` | 32 | `label = 'Available Actions'` | label default |
| `frontend/components/experiment/ActionSelector.tsx` | 62 | `'Failed to load actions'` | error message |
| `frontend/components/experiment/ActionSelector.tsx` | 66-67 | `'Cooperate'`, `'Defect'` | fallback action labels |
| `frontend/components/experiment/ActionSelector.tsx` | 110 | `'Loading actions...'`, `'Select actions below...'` | status text |
| `frontend/components/experiment/ActionSelector.tsx` | 134 | `'Using fallback options'` | error suffix |
| `frontend/components/experiment/ActionSelector.tsx` | 147 | `'Loading actions...'`, `'Select an action...'`, `'Add action...'` | dropdown text |
| `frontend/components/experiment/ActionSelector.tsx` | 156 | `'No actions available'` | empty state |
| `frontend/components/experiment/ActionSelector.tsx` | 199 | `'Maximum {maxActions} actions selected...'` | validation hint |
| `frontend/components/experiment/ExperimentBuilder.tsx` | 95-99 | `'Create New Experiment'`, `'Design your social science experiment in 6 steps'` | page header |
| `frontend/components/experiment/ExperimentBuilder.tsx` | 140 | `'Back'` | button text |
| `frontend/components/experiment/ExperimentBuilder.tsx` | 147 | `'Cancel'` | button text |
| `frontend/components/experiment/ExperimentBuilder.tsx` | 152 | `'Next'` | button text |
| `frontend/components/experiment/ExperimentBuilder.tsx` | 156 | `'Create Experiment'` | button text |
| `frontend/components/TestModal.tsx` | 21-22 | `'ExperimentBuilder Modal Test'` | modal title |
| `frontend/components/TestModal.tsx` | 27 | `'Close'` | aria-label |
| `frontend/components/TestModal.tsx` | 40-44 | `'Open ExperimentBuilder Modal'`, `'Close Modal'` | button text |
| `frontend/components/experiment/Step5Network.tsx` | 655 | `'Zoom in'` | button title |
| `frontend/components/experiment/Step5Network.tsx` | 658 | `'Zoom out'` | button title |
| `frontend/components/experiment/Step5Network.tsx` | 662 | `'Reset view'` | button title |
| `frontend/index.tsx` | 31 | `'Could not find root element to mount to'` | error message |
| `src/socialsim4/backend/api/routes/experiments.py` | 119 | `'not_found'` | API error response |
| `src/socialsim4/backend/api/routes/experiments.py` | 145, `'Missing node_a or node_b in request body'` | API error |
| `src/socialsim4/backend/api/routes/experiments.py` | 151 | `'Invalid node id(s); must be integers'` | API error |
| `src/socialsim4/backend/api/routes/experiments.py` | 160 | `'node_not_found'` | API error |
| `src/socialsim4/backend/api/routes/simulations/agent_documents.py` | 398-399 | `'Agent memory not available...'`, `'Use /tree/graph...'` | API error hint |

### MEDIUM Priority (Error messages, tooltips, notifications - 15 items)

These appear in error states or secondary UI flows.

| File | Line | String | Category |
|-----|------|--------|----------|
| `frontend/components/experiment/ActionSelector.tsx` | 66-67 | `'Cooperate with other players'`, `'Act in self-interest'` | action descriptions |
| `frontend/pages/RegisterPage.tsx` | 36 | `'invalid_phone'` | error code |
| `src/socialsim4/backend/api/routes/experiments.py` | 192-198 | Chinese summary strings | comparison messages |
| `src/socialsim4/backend/api/routes/experiments.py` | 208 | `'（注意：差异过大，已禁用 LLM 摘要以节省资源）'` | warning message |
| `src/socialsim4/backend/api/routes/experiments.py` | 218 | `'（未配置可用的 LLM 客户端）'` | warning message |
| `src/socialsim4/backend/api/routes/experiments.py` | 295 | `'（注意：用户 LLM 配额已耗尽，已禁用 LLM 摘要）'` | warning message |
| `src/socialsim4/backend/api/routes/experiments.py` | 237-252 | LLM system/user prompts | internal prompts |

### Low Priority (Edge cases, rarely seen, developer-oriented) - 10 items)

These appear infrequently or in non-critical paths.

| File | Line | String | Category |
|-----|------|--------|----------|
| `frontend/components/AgentPanel.tsx` | 16 | `alt="${safeAlt}"` | image alt (internal) |
| `frontend/components/ExperimentDesignModal.tsx` | 392 | `alt="preview"` | image alt |
| `frontend/components/GuideAssistant.tsx` | 208 | `alt="preview"` | image alt |
| `frontend/components/MultimodalInput.tsx` | 175 | `alt="preview"` | image alt |
| `frontend/components/LogViewer.tsx` | 355 | `alt=""` | image alt (empty) |
| `frontend/components/ReportModal.tsx` | 370 | `alt="thumb"` | image alt |
| `frontend/components/ReportModal.tsx` | 415 | `alt="full"` | image alt |
| `src/socialsim4/scenarios/social_norm_disruption.py` | 67 | Scenario event description | scenario content |

---

## Files Requiring Attention

| File | Issues | Priority | Effort |
|------|--------|----------|--------|
| `frontend/components/experiment/ActionSelector.tsx` | 10 | High | Medium |
| `frontend/components/experiment/ExperimentBuilder.tsx` | 5 | High | Low |
| `frontend/components/experiment/Step5Network.tsx` | 3 | High | Low |
| `frontend/components/TestModal.tsx` | 5 | Medium | Low |
| `frontend/index.tsx` | 1 | Medium | Trivial |
| `src/socialsim4/backend/api/routes/experiments.py` | 12 | High | Medium |
| `src/socialsim4/backend/api/routes/simulations/agent_documents.py` | 2 | High | Low |
| `src/socialsim4/scenarios/social_norm_disruption.py` | 1 | Medium | Low |

---

## Remediation Steps

1. **For frontend components:**
   - Add key to `frontend/locales/en.json`:
     ```json
     {
       "experiment": {
         "actions": {
           "availableLabel": "Available Actions",
           "loading": "Loading actions...",
           "selectPrompt": "Select actions below...",
           "selectAction": "Select an action...",
           "addAction": "Add action...",
           "noneAvailable": "No actions available",
           "maxSelected": "Maximum {{count}} actions selected. Remove an action to add more.",
           "fallbackWarning": "Using fallback options",
           "loadError": "Failed to load actions"
           }
       }
     }
     ```
   - Add key to `frontend/locales/zh.json`:
     ```json
     {
       "experiment": {
         "actions": {
           "availableLabel": "可用操作",
           "loading": "加载操作中...",
           "selectPrompt": "在下方选择操作...",
           "selectAction": "选择操作...",
           "addAction": "添加操作...",
           "noneAvailable": "无可用操作",
           "maxSelected": "已选择最多 {{count}} 个操作。 移除一个以添加更多.",
           "fallbackWarning": "使用备用选项",
           "loadError": "加载操作失败"
           }
       }
     }
     ```
   - Import `useTranslation` in the component
   - Replace hardcoded strings with `{t('key')}`

2. **For backend API routes:**
   - Add key to `src/socialsim4/locales/en.json`:
     ```json
     {
       "api": {
         "errors": {
           "notFound": "not_found",
           "missingNodes": "Missing node_a or node_b in request body",
           "invalidNodeIds": "Invalid node id(s); must be integers",
           "nodeNotFound": "node_not_found",
           "agentMemoryUnavailable": "Agent memory not available. Provide a valid node_id from a running simulation."
           }
       }
     }
     ```
   - Add corresponding Chinese translations to `src/socialsim4/locales/zh.json`
   - Import `from socialsim4.i18n import T` in the route file
   - Replace hardcoded strings with `T('key')`

---

## Positive Findings
- 51 frontend files already use useTranslation hook (42% compliance)
- 10 backend files already use T() function (16% compliance)
- Translation files are well-structured with 185+ keys
- Core UI components (AgentPanel, NavBar, Dashboard, etc.) are already i18n-compliant
- Both English and Chinese locale files exist and are actively maintained

---

## Recommendations
1. **Immediate action:** Address high-priority files (ActionSelector.tsx, ExperimentBuilder.tsx) first as they affect the most users
2. **Create shared error keys:** Standardize error message keys across backend for consistency
3. **Add CI check:** Consider adding a grep-based CI check to catch new hardcoded strings before merge
4. **Document i18n requirements:** Add a CONTRIBUTING.md section about i18n requirements for new code

---

## Exclusions (Correctly Not Flagged)
- Core simulation engine files (`src/socialsim4/core/`) - not user-facing
- Test files - not production code
- Debug/logging strings - not user-facing
- Comments and docstrings - not rendered to users
- CSS class names - structural, not text
- URL/API paths - structural, not translatable
