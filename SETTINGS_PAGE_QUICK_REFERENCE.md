# SettingsPage快速参考指南

## 🎯 核心信息一览

### 页面结构 (5个标签页)

| 标签 | 类型 | 功能 |
|------|------|------|
| **profile** | 个人资料 | 显示用户信息、组织、工作空间 |
| **security** | 安全 | 会话管理、退出登录 |
| **providers_llm** ⭐ | LLM提供商 | **核心功能**: 管理AI模型配置、测试连接 |
| **providers_search** | 搜索提供商 | 配置搜索引擎 (ddg/serpapi/serper/tavily) |
| **files** | 文件管理 | 上传文件列表、孤立文件扫描 |

---

## 📡 API快速查询

### Provider API

```bash
# 获取所有提供商
GET /api/providers → Provider[]

# 创建提供商
POST /api/providers
  {
    name: string,
    provider: "openai-compatible" | "gemini",
    model: string,
    base_url?: string,
    api_key?: string,
    config?: Record<string, any>
  } → Provider

# 测试提供商连接
POST /api/providers/{id}/test → { message: string }

# 更新提供商
PATCH /api/providers/{id} → Provider

# 激活提供商
POST /api/providers/{id}/activate → { message: string }

# 删除提供商
DELETE /api/providers/{id}
```

### SearchProvider API

```bash
# 列表
GET /api/search-providers → SearchProvider[]

# 创建
POST /api/search-providers → SearchProvider

# 更新
PATCH /api/search-providers/{id} → SearchProvider
```

### 文件API (推断)

```bash
# 列表
GET /api/uploads → Upload[]

# 删除
DELETE /api/uploads/{id}

# 扫描孤立文件
GET /api/uploads/orphans → { orphaned: [], total: number }
```

---

## 🎨 CSS类快速手册

### Settings特定类

```css
.ss-settings-page__layout           /* 主布局: 左导航 + 右内容 */
.ss-settings-page__nav              /* 左侧标签导航栏 */
.ss-settings-page__content          /* 右侧内容区域 */
.ss-settings-page__tab              /* 单个标签按钮 */

.ss-settings-metric                 /* 指标卡片 (图标+标签+值) */
.ss-settings-metric__icon           /* 指标图标背景 */
.ss-settings-metric__label          /* 指标标签文本 */
.ss-settings-metric__value          /* 指标值 */

.ss-settings-section                /* 章节容器 */
.ss-settings-grid                   /* 两列网格 */
.ss-settings-grid--split            /* 1.15fr : 0.85fr */
.ss-settings-grid--providers-main   /* 1.28fr : 0.72fr */

.ss-settings-form-grid              /* 表单两列网格 */
.ss-settings-form-grid__full        /* 跨越全宽 (grid-column: 1/-1) */

.ss-settings-info-grid              /* 信息两列网格 */
.ss-settings-info-row               /* 信息行 (标签+值) */

.ss-provider-input                  /* 输入字段 */
.ss-provider-input--textarea        /* 文本区域 (min-height: 128px) */

.ss-providers-card                  /* 提供商卡片 */
.ss-providers-card--workspace-top   /* 工作空间顶部卡片 */
.ss-providers-card--tester          /* LLM测试卡片 */
.ss-providers-card--capabilities    /* 能力展示卡片 */

.ss-capability-row                  /* 能力行容器 */
.ss-capability-card                 /* 能力卡片 */

.ss-status-chip                     /* 状态芯片 */
.ss-status-chip.is-active           /* 活跃状态 */
.ss-status-chip.is-success          /* 成功状态 */
.ss-status-chip.is-danger           /* 危险状态 */

.ss-data-table                      /* 数据表格 */
.ss-data-table__actions             /* 表格操作列 */

.ss-button                          /* 主按钮 */
.ss-button-secondary                /* 次要按钮 */
.ss-button-danger                   /* 危险按钮 */
.icon-button                        /* 图标按钮 */
.icon-button.square                 /* 正方形图标按钮 */

.ss-form-label                      /* 表单标签 */
.ss-settings-note                   /* 注释/提示框 */
.ss-empty-state                     /* 空状态 */
```

---

## 🎨 设计令牌速查表

### 颜色 (tokens.css)

```css
/* 品牌色 */
浅色: --ss-brand-primary: #d4a24e  (暖蜜金)
深色: --ss-brand-primary: #2fe6a6  (清新绿)

/* 文本 */
--ss-heading: #1E1A17 / #eaf7f2
--ss-text: #3E3A37 / #d8e8e1
--ss-text-muted: #726D68 / #afc6bd
--ss-text-subtle: #9B98A1 / #759087

/* 边框 */
浅: --ss-border: rgba(60, 50, 40, 0.08)
深: --ss-border: rgba(139, 170, 157, 0.12)

/* 语义 */
--ss-success: #5a9a6b   (成功绿)
--ss-warning: #c49535   (警告黄)
--ss-danger: #c4605a    (危险红)
--ss-info: #7EA8D0      (信息蓝)

/* 阴影 */
--ss-shadow-1: 轻  (0 8px 20px)
--ss-shadow-2: 中  (0 14px 36px)
--ss-shadow-3: 重  (0 22px 60px)

/* 圆角 */
--ss-radius-sm: 10px
--ss-radius-md: 14px
--ss-radius-lg: 18px
--ss-radius-xl: 24px
--ss-radius-2xl: 30px
```

### 字体大小

```css
--ss-type-page-title: 3.25rem
--ss-type-section-title: 1.875rem
--ss-type-card-title: 1.25rem
--ss-type-body: 0.9375rem (15px)
--ss-type-caption: 0.8125rem
--ss-type-label: 0.75rem (12px)
--ss-type-button: 0.875rem (14px)
```

---

## 🔌 React Query配置

### 启用条件

```typescript
// 提供商列表: 仅当切换到 providers_llm 标签时才加载
useQuery({
  queryKey: ["providers"],
  enabled: activeTab === "providers_llm",
  queryFn: () => listProviders(),
});

// 搜索提供商: 仅当切换到 providers_search 标签时才加载
useQuery({
  queryKey: ["searchProviders"],
  enabled: activeTab === "providers_search",
  queryFn: () => listSearchProviders(),
});

// 文件列表: 仅当切换到 files 标签时才加载
useQuery({
  queryKey: ["uploads"],
  enabled: activeTab === "files",
  queryFn: () => listUploads(),
});
```

### Mutation重新验证

```typescript
// 删除文件后重新获取列表
deleteFile.onSuccess = () => {
  queryClient.invalidateQueries({ queryKey: ["uploads"] });
};

// 搜索提供商变更后重新获取列表
upsertSearch.onSuccess = () => {
  queryClient.invalidateQueries({ queryKey: ["searchProviders"] });
};

// LLM测试后重新获取提供商列表 (可能更新状态)
llmTest.onSuccess = () => {
  queryClient.invalidateQueries({ queryKey: ["providers"] });
};
```

---

## 🌍 i18n关键键

```typescript
// 标签
t("settings.title")
t("settings.tabs.profile")
t("settings.tabs.security")
t("settings.tabs.llmProviders")
t("settings.tabs.searchProviders")
t("settings.tabs.files")

// 个人资料
t("settings.profile.email")
t("settings.profile.username")
t("settings.profile.fullName")
t("settings.profile.organization")

// 提供商
t("settings.providers.llmTab")
t("settings.providers.searchTab")
t("settings.providers.current")
t("settings.providers.loading")
t("settings.providers.error")
t("settings.providers.workspaceTitle")
t("settings.providers.workspaceHint")
t("settings.providers.capabilities.title")
t("settings.providers.modelNote.goodDefault")
t("settings.providers.modelNote.fastLongContext")

// 文件
t("settings.files.title")
t("settings.files.empty")
t("settings.files.delete")
t("settings.files.deleteConfirm")
```

---

## 🔄 状态流转图

```
┌─ SettingsPage ──────────────────────────────────────────┐
│                                                          │
│  useState:                                              │
│  ├─ activeTab (profile|security|providers_*|files)     │
│  ├─ llmTestProviderId, llmTestPrompt, llmTestResult    │
│  ├─ searchDraft (provider config)                      │
│  ├─ orphanResult, findingOrphans                       │
│  └─ (其他modal状态)                                    │
│                                                          │
│  useQuery:                    useAuthStore:            │
│  ├─ providersQuery            ├─ user                 │
│  ├─ searchProvidersQuery      ├─ clearSession()       │
│  ├─ filesQuery                └─ accessToken          │
│                                                          │
│  useMutation:                                           │
│  ├─ deleteFile                                         │
│  ├─ upsertSearch                                       │
│  └─ llmTest                                            │
│                                                          │
└────────────────────────────────────────────────────────┘
         ↓
    API Services
    ├─ listProviders()
    ├─ testProvider()
    ├─ listSearchProviders()
    ├─ updateSearchProvider()
    ├─ listUploads()
    └─ deleteUpload()
         ↓
    apiClient (axios)
    ├─ 自动添加 Bearer token
    ├─ 401 自动刷新
    └─ 错误处理
         ↓
    Backend API (/api/*)
```

---

## 📋 常见操作清单

### 添加新标签页

```typescript
type Tab = "profile" | "security" | "providers_llm" | "providers_search" | "files" | "new_tab";

const tabItems = [
  // ... 现有标签
  {
    id: "new_tab",
    title: t("settings.tabs.newTab"),
    hint: "新标签提示",
    icon: <YourIcon size={15} />,
  },
];

const renderNewTab = () => (
  <div className="ss-settings-section">
    {/* 内容 */}
  </div>
);

const renderActiveTab = () => {
  // ... 现有分支
  if (activeTab === "new_tab") return renderNewTab();
  return renderFiles();
};
```

### 添加新的Provider类型

```typescript
// 1. 后端支持新的 provider 类型
// 2. 更新 types.ts 中的 Provider 接口 (如需要)
// 3. 在 renderProviders() 中添加新的配置选项

{(selectedProvider.provider === "new_provider") && (
  <>
    <label>
      <span className="ss-form-label">配置项</span>
      <input /* 配置输入 */ />
    </label>
  </>
)}
```

### 添加新表格列

```typescript
// 在 renderFiles() 中修改表头和单元格
<table className="ss-data-table">
  <thead>
    <tr>
      <th>{t("settings.files.table.filename")}</th>
      <th>{t("settings.files.table.type")}</th>
      <th>{t("settings.files.table.size")}</th>
      <th>{t("settings.files.table.created")}</th>
      <th>{t("settings.files.table.newColumn")}</th>  {/* 新列 */}
      <th>{t("settings.files.table.actions")}</th>
    </tr>
  </thead>
  <tbody>
    {uploads.map((file) => (
      <tr key={file.id}>
        {/* ... 现有单元格 */}
        <td>{/* 新列数据 */}</td>
      </tr>
    ))}
  </tbody>
</table>
```

---

## 🐛 调试技巧

### 查看Store状态

```typescript
// 在浏览器DevTools中
useSimulationStore.getState()
useSimulationStore.subscribe(state => console.log(state))
```

### 启用Redux DevTools

```typescript
// 已在 store/index.ts 中配置
create<StoreState>()(
  devtools(
    (set, get, api) => ({ ... }),
    { name: 'SimulationStore' }
  )
);

// Chrome扩展: Redux DevTools 可以检查所有状态变化
```

### 查看React Query缓存

```typescript
// 在浏览器DevTools中
queryClient.getQueryData(["providers"])
queryClient.getQueryData(["searchProviders"])
queryClient.getQueryData(["uploads"])
```

### 网络请求检查

```
浏览器 → F12 → Network 标签
├─ GET /api/providers
├─ POST /api/providers/{id}/test
├─ GET /api/search-providers
├─ PATCH /api/search-providers/{id}
├─ GET /api/uploads
└─ DELETE /api/uploads/{id}
```

---

## 📝 本地化添加步骤

1. **定位翻译文件** (推断): `frontend/locales/zh.json` 和 `frontend/locales/en.json`
2. **添加键值对**:
   ```json
   {
     "settings.newFeature.title": "新功能标题",
     "settings.newFeature.description": "新功能描述"
   }
   ```
3. **在组件中使用**:
   ```typescript
   const { t } = useTranslation();
   <div>{t("settings.newFeature.title")}</div>
   ```

---

## ✅ 代码审查检查清单

在提交SettingsPage修改前:

- [ ] 所有文本使用 `t()` 翻译
- [ ] 新添加的 API 调用检查 `enabled` 条件
- [ ] Mutation 成功后检查缓存失效
- [ ] 响应式 CSS: 测试 <= 720px
- [ ] 深色/浅色主题测试
- [ ] React Query loading/error 状态处理
- [ ] 表单字段有适当的 validation
- [ ] Icon 导入来自 lucide-react 或 @radix-ui/react-icons
- [ ] 使用 CSS 变量而非硬编码颜色
- [ ] 类名使用 `ss-` 前缀 (SocialSim)

---

## 🔗 相关文件链接

**核心文件**:
- [SettingsPage.tsx](frontend/pages/SettingsPage.tsx)
- [providers.ts](frontend/services/providers.ts)
- [searchProviders.ts](frontend/services/searchProviders.ts)

**样式文件**:
- [product-pages.css](frontend/styles/pages/product-pages.css)
- [tokens.css](frontend/styles/system/tokens.css)

**状态管理**:
- [store/index.ts](frontend/store/index.ts)
- [store/providers.ts](frontend/store/providers.ts)

**类型定义**:
- [types.ts](frontend/types.ts)

---

*最后更新: 2026-04-20*
