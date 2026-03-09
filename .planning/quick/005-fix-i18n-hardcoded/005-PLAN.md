---
phase: quick-005
plan: 005
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/locales/en.json
  - frontend/locales/zh.json
  - frontend/components/experiment/ActionSelector.tsx
  - frontend/components/experiment/ExperimentBuilder.tsx
  - frontend/components/experiment/Step5Network.tsx
  - src/socialsim4/locales/en.json
  - src/socialsim4/locales/zh.json
  - src/socialsim4/backend/api/routes/experiments.py
  - src/socialsim4/backend/api/routes/simulations/agent_documents.py
autonomous: true
requirements: []
must_haves:
  truths:
    - "ActionSelector displays all UI text via translation keys"
    - "ExperimentBuilder displays all UI text via translation keys"
    - "Step5Network zoom controls use translated tooltips"
    - "Backend experiments.py returns translated error messages"
    - "Backend agent_documents.py returns translated error messages"
  artifacts:
    - path: "frontend/locales/en.json"
      contains: "experiment.actionSelector"
    - path: "frontend/locales/zh.json"
      contains: "experiment.actionSelector"
    - path: "src/socialsim4/locales/en.json"
      contains: "api.errors"
  key_links:
    - from: "ActionSelector.tsx"
      to: "frontend/locales/en.json"
      via: "useTranslation hook"
    - from: "experiments.py"
      to: "src/socialsim4/locales/en.json"
      via: "T() function import"
---

<objective>
Fix all hardcoded strings identified in the i18n audit by adding translation keys to locale files and updating components to use the useTranslation hook (frontend) and T() function (backend).

Purpose: Ensure full i18n compliance for user-facing text across the experiment builder UI and backend API error responses.
Output: All identified hardcoded strings replaced with translation function calls.
</objective>

<execution_context>
@C:/Users/Justin/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Justin/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/004-i18n-audit/004-SUMMARY.md

## Key Translation Patterns

**Frontend (TypeScript):**
```typescript
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();
// Usage: {t('experiment.actionSelector.loading')}
```

**Backend (Python):**
```python
from socialsim4.i18n import T
# Usage: T('api.errors.not_found')
```

## Existing Locale File Structure

Frontend locale files already have extensive keys under:
- `common.*` (loading, cancel, next, back, etc.)
- `experiment.*` (existing experiment-related keys)
- `dashboard.*`, `nav.*`, etc.

Backend locale files have:
- `api.*` (error responses, success messages)
- `error.*` (simulation errors)
- `prompts.*` (agent prompts)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix Frontend ActionSelector hardcoded strings</name>
  <files>
    - frontend/locales/en.json
    - frontend/locales/zh.json
    - frontend/components/experiment/ActionSelector.tsx
  </files>
  <action>
    Add translation keys for ActionSelector component and update the component to use useTranslation.

    **1. Add to frontend/locales/en.json** under "experiment" key:
    ```json
    "actionSelector": {
      "availableLabel": "Available Actions",
      "loading": "Loading actions...",
      "selectPrompt": "Select actions below...",
      "selectAction": "Select an action...",
      "addAction": "Add action... ({{count}}/{{max}})",
      "noneAvailable": "No actions available",
      "maxSelected": "Maximum {{max}} actions selected. Remove an action to add more.",
      "fallbackWarning": "Using fallback options",
      "loadError": "Failed to load actions",
      "fallbackCooperate": "Cooperate",
      "fallbackCooperateDesc": "Cooperate with other players",
      "fallbackDefect": "Defect",
      "fallbackDefectDesc": "Act in self-interest"
    }
    ```

    **2. Add to frontend/locales/zh.json** under "experiment" key:
    ```json
    "actionSelector": {
      "availableLabel": "可用操作",
      "loading": "加载操作中...",
      "selectPrompt": "在下方选择操作...",
      "selectAction": "选择操作...",
      "addAction": "添加操作... ({{count}}/{{max}})",
      "noneAvailable": "无可用操作",
      "maxSelected": "已选择最多 {{max}} 个操作。移除一个以添加更多。",
      "fallbackWarning": "使用备用选项",
      "loadError": "加载操作失败",
      "fallbackCooperate": "合作",
      "fallbackCooperateDesc": "与其他玩家合作",
      "fallbackDefect": "背叛",
      "fallbackDefectDesc": "为自身利益行动"
    }
    ```

    **3. Update ActionSelector.tsx:**
    - Import useTranslation at top: `import { useTranslation } from 'react-i18next';`
    - Add `const { t } = useTranslation();` at start of component
    - Replace hardcoded strings:
      - Line 31: `label = t('experiment.actionSelector.availableLabel')`
      - Line 62: `setError(t('experiment.actionSelector.loadError'))`
      - Lines 66-67: Use t() for fallback action labels/descriptions
      - Line 110: Use t() for loading/selectPrompt with ternary
      - Line 134: `{error} - {t('experiment.actionSelector.fallbackWarning')}`
      - Line 147: Complex ternary with t() calls for loading/selectAction/addAction
      - Line 156: `{t('experiment.actionSelector.noneAvailable')}`
      - Line 199: `{t('experiment.actionSelector.maxSelected', { max: maxActions })}`
  </action>
  <verify>
    <automated>grep -c "useTranslation" frontend/components/experiment/ActionSelector.tsx</automated>
    Manual check: Count should be >= 1 (import statement present)
  </verify>
  <done>
    - ActionSelector.tsx imports and uses useTranslation hook
    - All hardcoded strings replaced with t() function calls
    - Translation keys exist in both en.json and zh.json
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix Frontend ExperimentBuilder and Step5Network hardcoded strings</name>
  <files>
    - frontend/locales/en.json
    - frontend/locales/zh.json
    - frontend/components/experiment/ExperimentBuilder.tsx
    - frontend/components/experiment/Step5Network.tsx
  </files>
  <action>
    Add translation keys for ExperimentBuilder and Step5Network components.

    **1. Add to frontend/locales/en.json** under "experiment" key:
    ```json
    "builder": {
      "title": "Create New Experiment",
      "subtitle": "Design your social science experiment in 6 steps",
      "back": "Back",
      "cancel": "Cancel",
      "next": "Next",
      "create": "Create Experiment"
    },
    "network": {
      "zoomIn": "Zoom in",
      "zoomOut": "Zoom out",
      "resetView": "Reset view"
    }
    ```

    **2. Add to frontend/locales/zh.json** under "experiment" key:
    ```json
    "builder": {
      "title": "创建新实验",
      "subtitle": "在6个步骤中设计你的社会科学实验",
      "back": "返回",
      "cancel": "取消",
      "next": "下一步",
      "create": "创建实验"
    },
    "network": {
      "zoomIn": "放大",
      "zoomOut": "缩小",
      "resetView": "重置视图"
    }
    ```

    **3. Update ExperimentBuilder.tsx:**
    - Import useTranslation: `import { useTranslation } from 'react-i18next';`
    - Add `const { t } = useTranslation();` at start of component
    - Replace hardcoded strings:
      - Line 95-96: `{t('experiment.builder.title')}`
      - Line 98-99: `{t('experiment.builder.subtitle')}`
      - Line 140: `{t('experiment.builder.back')}`
      - Line 147: `{t('experiment.builder.cancel')}`
      - Line 152: `{t('experiment.builder.next')}`
      - Line 156: `{t('experiment.builder.create')}`

    **4. Update Step5Network.tsx:**
    - Already has useTranslation imported (line 29)
    - Replace hardcoded title attributes:
      - Line 655: `title={t('experiment.network.zoomIn')}`
      - Line 658: `title={t('experiment.network.zoomOut')}`
      - Line 662: `title={t('experiment.network.resetView')}`
  </action>
  <verify>
    <automated>grep -c "t('experiment.builder" frontend/components/experiment/ExperimentBuilder.tsx</automated>
    Manual check: Count should be >= 4 (at least title, subtitle, back, next used)
  </verify>
  <done>
    - ExperimentBuilder.tsx imports and uses useTranslation hook
    - Step5Network.tsx zoom controls use translated title attributes
    - Translation keys exist in both locale files
  </done>
</task>

<task type="auto">
  <name>Task 3: Fix Backend experiments.py and agent_documents.py hardcoded strings</name>
  <files>
    - src/socialsim4/locales/en.json
    - src/socialsim4/locales/zh.json
    - src/socialsim4/backend/api/routes/experiments.py
    - src/socialsim4/backend/api/routes/simulations/agent_documents.py
  </files>
  <action>
    Add translation keys for backend error messages and update route handlers to use T().

    **1. Add to src/socialsim4/locales/en.json** under "api" key (merge into existing structure):
    ```json
    "errors": {
      "notFound": "not_found",
      "missingNodes": "Missing node_a or node_b in request body",
      "invalidNodeIds": "Invalid node id(s); must be integers",
      "nodeNotFound": "node_not_found",
      "agentMemoryUnavailable": "Agent memory not available. Provide a valid node_id from a running simulation.",
      "agentMemoryHint": "Use /tree/graph to get available nodes, then query with ?node_id=<node>",
      "llmDisabledLargeDiff": " (Note: Large diff detected, LLM summary disabled to save resources)",
      "llmNoClient": " (No LLM client configured)",
      "llmQuotaExhausted": " (Note: User LLM quota exhausted, LLM summary disabled)"
    },
    "compare": {
      "nodeUniqueEvents": "Node {{node}} has {{count}} unique events.",
      "agentPropertyDiffs": "{{count}} agents have property differences.",
      "noObviousDiff": "No obvious differences found (based on quick comparison of events and properties)."
    }
    ```

    **2. Add to src/socialsim4/locales/zh.json** under "api" key:
    ```json
    "errors": {
      "notFound": "未找到",
      "missingNodes": "请求体中缺少 node_a 或 node_b",
      "invalidNodeIds": "节点ID无效；必须是整数",
      "nodeNotFound": "节点未找到",
      "agentMemoryUnavailable": "代理记忆不可用。请提供运行中模拟的有效 node_id。",
      "agentMemoryHint": "使用 /tree/graph 获取可用节点，然后使用 ?node_id=<node> 查询",
      "llmDisabledLargeDiff": "（注意：差异过大，已禁用 LLM 摘要以节省资源）",
      "llmNoClient": "（未配置可用的 LLM 客户端）",
      "llmQuotaExhausted": "（注意：用户 LLM 配额已耗尽，已禁用 LLM 摘要）"
    },
    "compare": {
      "nodeUniqueEvents": "节点 {{node}} 有 {{count}} 条独有事件。",
      "agentPropertyDiffs": "{{count}} 个代理的属性存在差异。",
      "noObviousDiff": "未发现明显差异（基于事件内容与属性的快速比对）。"
    }
    ```

    **3. Update experiments.py:**
    - Import T at top: `from socialsim4.i18n import T`
    - Replace hardcoded strings:
      - Line 119: `return {"error": T('api.errors.notFound')}`
      - Line 145: `raise HTTPException(status_code=400, detail=T('api.errors.missingNodes'))`
      - Line 151: `raise HTTPException(status_code=400, detail=T('api.errors.invalidNodeIds'))`
      - Line 160: `raise HTTPException(status_code=400, detail=T('api.errors.nodeNotFound'))`
      - Lines 192-198: Use T('api.compare.nodeUniqueEvents', node=..., count=...) etc.
      - Line 208: Use T('api.errors.llmDisabledLargeDiff')
      - Line 218: Use T('api.errors.llmNoClient')
      - Line 295: Use T('api.errors.llmQuotaExhausted')

    **4. Update agent_documents.py:**
    - Import T at top: `from socialsim4.i18n import T`
    - Lines 398-400: Use T() for error and hint messages:
      ```python
      return {
          "name": agent_name,
          "error": T('api.errors.agentMemoryUnavailable'),
          "hint": T('api.errors.agentMemoryHint'),
      }
      ```
  </action>
  <verify>
    <automated>grep -c "from socialsim4.i18n import T" src/socialsim4/backend/api/routes/experiments.py</automated>
    Manual check: Count should be 1 (import present)
  </verify>
  <done>
    - experiments.py imports and uses T() for all error messages
    - agent_documents.py imports and uses T() for error messages
    - Translation keys exist in both backend locale files
  </done>
</task>

</tasks>

<verification>
1. Verify all modified components import translation functions
2. Verify no hardcoded user-facing strings remain in modified files
3. Verify translation keys exist in both English and Chinese locale files
</verification>

<success_criteria>
- All 3 HIGH priority frontend files (ActionSelector, ExperimentBuilder, Step5Network) use useTranslation
- All 2 HIGH priority backend files (experiments.py, agent_documents.py) use T()
- All translation keys exist in both en.json and zh.json for frontend
- All translation keys exist in both en.json and zh.json for backend
- No regressions: existing translation keys remain intact
</success_criteria>

<output>
After completion, create `.planning/quick/005-fix-i18n-hardcoded/005-SUMMARY.md`
</output>
