# SettingsPage代码深度分析

## 📋 目录
1. [核心结构](#核心结构)
2. [API与数据类型](#api与数据类型)
3. [样式系统](#样式系统)
4. [状态管理](#状态管理)
5. [主题/设计系统](#主题设计系统)
6. [组件库集成](#组件库集成)

---

## 核心结构

### SettingsPage.tsx 完整架构

**位置**: `frontend/pages/SettingsPage.tsx`

#### 1. 页面组成 (5个标签页)

```typescript
type Tab = "profile" | "security" | "providers_llm" | "providers_search" | "files";

tabItems: [
  {
    id: "profile",           // 个人资料
    title: "settings.tabs.profile",
    icon: <UserCircle2 size={15} />
  },
  {
    id: "security",          // 安全/会话
    title: "settings.tabs.security",
    icon: <Shield size={15} />
  },
  {
    id: "providers_llm",     // LLM提供商 ⭐ 核心
    title: "settings.tabs.llmProviders",
    icon: <Bot size={15} />
  },
  {
    id: "providers_search",  // 搜索提供商
    title: "settings.tabs.searchProviders",
    icon: <Search size={15} />
  },
  {
    id: "files",             // 文件管理
    title: "settings.tabs.files",
    icon: <FileStack size={15} />
  }
]
```

#### 2. 核心状态 (useState)

```typescript
// Tab导航
const [activeTab, setActiveTab] = useState<Tab>("profile");

// LLM测试相关
const [llmTestProviderId, setLlmTestProviderId] = useState<string>("");
const [llmTestPrompt, setLlmTestPrompt] = useState("");
const [llmTestResult, setLlmTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

// 搜索提供商草稿
const [searchDraft, setSearchDraft] = useState({
  provider: "ddg",
  base_url: "",
  api_key: "",
  config: { region: "", safesearch: "moderate" } as Record<string, any>,
});

// 文件孤立扫描
const [orphanResult, setOrphanResult] = useState<{ orphaned: string[]; total: number } | null>(null);
const [findingOrphans, setFindingOrphans] = useState(false);
```

#### 3. React Query集成

```typescript
// 获取LLM提供商列表
const providersQuery = useQuery({
  queryKey: ["providers"],
  enabled: activeTab === "providers_llm",
  queryFn: () => listProviders(),
});

// 获取搜索提供商列表
const searchProvidersQuery = useQuery({
  queryKey: ["searchProviders"],
  enabled: activeTab === "providers_search",
  queryFn: () => listSearchProviders(),
});

// 获取上传文件列表
const filesQuery = useQuery({
  queryKey: ["uploads"],
  enabled: activeTab === "files",
  queryFn: () => listUploads(),
});

// 删除文件Mutation
const deleteFile = useMutation({
  mutationFn: async (fileId: string) => deleteUpload(fileId),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["uploads"] });
  },
});

// 插入/更新搜索提供商
const upsertSearch = useMutation({
  mutationFn: async () => {
    const searchProvider = (searchProvidersQuery.data ?? [])[0];
    if (searchProvider) {
      return updateSearchProvider(searchProvider.id, { /* ... */ });
    }
    return createSearchProvider({ /* ... */ });
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["searchProviders"] });
  },
});

// LLM连接测试
const llmTest = useMutation({
  mutationFn: async () => {
    if (!selectedLlmTestProvider) throw new Error("no provider selected");
    return apiTestProvider(selectedLlmTestProvider.id);
  },
  onSuccess: () => {
    setLlmTestResult({
      ok: true,
      msg: isZh ? "连接测试通过..." : "Connection test passed...",
    });
    queryClient.invalidateQueries({ queryKey: ["providers"] });
  },
  onError: () => {
    setLlmTestResult({
      ok: false,
      msg: isZh ? "连接测试失败..." : "Connection test failed...",
    });
  },
});
```

#### 4. 渲染函数体系

```typescript
renderProfile() {
  // 显示用户信息、组织、工作空间状态
}

renderSecurity() {
  // 会话管理、退出登录
}

renderProviders() {
  // ⭐ LLM提供商管理 - 核心功能
  // - 显示已配置提供商数量
  // - 显示当前活跃端点
  // - LLM测试台 (选择提供商、输入测试提示词、执行测试)
  // - 模型能力展示表 (gpt-4o、gemini-1.5等)
}

renderSearchProviders() {
  // 搜索提供商配置
  // 支持: ddg, serpapi, serper, tavily, mock
}

renderFiles() {
  // 已上传文件表
  // 孤立文件扫描功能
}
```

#### 5. i18n支持

```typescript
const { t, i18n } = useTranslation();
const isZh = i18n.language.startsWith("zh");

// 所有文本使用 t("key") 翻译
// 支持中英文双语
```

---

## API与数据类型

### 1. Provider服务 (`frontend/services/providers.ts`)

#### 类型定义

```typescript
export type Provider = {
  id: number;
  name: string;
  provider: string;              // "openai-compatible" | "gemini" 等
  model: string;
  base_url: string | null;
  last_test_status?: string | null;
  last_tested_at?: string | null;
  has_api_key: boolean;
  config?: Record<string, unknown> | null;
  is_active?: boolean;
  is_default?: boolean;
};
```

#### API方法

```typescript
// 获取所有提供商列表
async function listProviders(): Promise<Provider[]>
  GET /api/providers

// 创建新提供商
async function createProvider(payload: {
  name: string;
  provider: string;
  model: string;
  base_url?: string | null;
  api_key?: string | null;
  config?: Record<string, unknown> | null;
}): Promise<Provider>
  POST /api/providers

// 测试提供商连接
async function testProvider(providerId: number): Promise<{ message: string }>
  POST /api/providers/{providerId}/test

// 更新提供商
async function updateProvider(providerId: number, payload: {
  name?: string;
  provider?: string;
  model?: string;
  base_url?: string | null;
  api_key?: string | null;
  config?: Record<string, unknown> | null;
}): Promise<Provider>
  PATCH /api/providers/{providerId}

// 删除提供商
async function deleteProvider(providerId: number): Promise<void>
  DELETE /api/providers/{providerId}

// 激活提供商 (设为活跃)
async function activateProvider(providerId: number): Promise<{ message: string }>
  POST /api/providers/{providerId}/activate
```

### 2. SearchProvider服务 (`frontend/services/searchProviders.ts`)

#### 类型定义

```typescript
export type SearchProvider = {
  id: number;
  provider: string;              // "ddg" | "serpapi" | "serper" | "tavily" | "mock"
  base_url: string | null;
  has_api_key: boolean;
  config?: Record<string, unknown> | null;
};
```

#### API方法

```typescript
// 获取搜索提供商列表
async function listSearchProviders(): Promise<SearchProvider[]>
  GET /api/search-providers

// 创建搜索提供商
async function createSearchProvider(payload: {
  provider: string;
  base_url?: string | null;
  api_key?: string | null;
  config?: Record<string, unknown> | null;
}): Promise<SearchProvider>
  POST /api/search-providers

// 更新搜索提供商
async function updateSearchProvider(providerId: number, payload: {
  provider?: string;
  base_url?: string | null;
  api_key?: string | null;
  config?: Record<string, unknown> | null;
}): Promise<SearchProvider>
  PATCH /api/search-providers/{providerId}
```

### 3. 上传/文件服务 (`frontend/services/uploads.ts` 推断)

```typescript
async function listUploads(): Promise<{
  id: string;
  filename: string;
  type: string;
  size: number;
  created: number;  // timestamp
}[]>

async function deleteUpload(fileId: string): Promise<void>

async function findOrphans(): Promise<{
  orphaned: string[];
  total: number;
}>
```

### 4. API客户端配置 (`frontend/services/client.ts`)

```typescript
// 基础URL
export const API_BASE_URL = getApiBase().replace(/\/+$/, "");
// 示例: "http://localhost:8000/api"

// Axios实例
export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/`,
});

// 拦截器功能:
// 1. 自动添加 Authorization header (Bearer token)
// 2. 401错误时自动刷新token
// 3. 防止并发刷新竞态
```

---

## 样式系统

### 1. 样式架构

```
frontend/styles/
├── system/
│   ├── tokens.css          # 设计标记 (colors, spacing, etc.)
│   ├── primitives.css      # 原始组件样式
│   └── base.css            # 基础HTML样式
├── pages/
│   └── product-pages.css   # ⭐ Settings页面样式核心
└── components/
    └── [component styles]
```

**主入口**: `frontend/index.css`
- 导入 Tailwind
- 导入所有系统样式

### 2. 设计令牌 (`tokens.css`)

#### 颜色主题

**浅色主题** (`:root.theme-light`)
```css
/* 品牌色 - 暖蜜金 */
--ss-brand-primary: #d4a24e;
--ss-brand-hover: #c4922e;
--ss-brand-soft: rgba(255, 200, 112, 0.14);

/* 文本 */
--ss-heading: #1E1A17;
--ss-text: #3E3A37;
--ss-text-muted: #726D68;
--ss-text-subtle: #9B98A1;

/* 表面/背景 */
--ss-surface: rgba(255, 253, 250, 0.88);
--ss-surface-muted: rgba(255, 252, 247, 0.94);
--ss-surface-strong: rgba(248, 244, 236, 0.96);

/* 语义 */
--ss-success: #5a9a6b;
--ss-warning: #c49535;
--ss-danger: #c4605a;
--ss-danger-soft: rgba(196, 96, 90, 0.10);

/* 边框 */
--ss-border: rgba(60, 50, 40, 0.08);
--ss-border-strong: rgba(60, 50, 40, 0.14);
```

**深色主题** (`:root.theme-dark`)
```css
/* 品牌色 - 清新绿 */
--ss-brand-primary: #2fe6a6;
--ss-brand-hover: #45f0b3;
--ss-brand-soft: rgba(47, 230, 166, 0.1);

/* 文本 */
--ss-heading: #eaf7f2;
--ss-text: #d8e8e1;
--ss-text-muted: #afc6bd;

/* 表面 */
--ss-surface: rgba(10, 17, 16, 0.9);
--ss-surface-muted: rgba(12, 21, 20, 0.94);
--ss-surface-strong: rgba(15, 27, 25, 0.98);

/* 边框 */
--ss-border: rgba(139, 170, 157, 0.12);
--ss-border-strong: rgba(47, 230, 166, 0.22);
```

#### 字体

```css
--font-sans: "Inter", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", ...
--font-display: "Inter", "PingFang SC", ...
--font-mono: "IBM Plex Mono", "Cascadia Code", ...
```

#### 字体大小

```css
--ss-type-page-title: 3.25rem;
--ss-type-section-title: 1.875rem;
--ss-type-card-title: 1.25rem;
--ss-type-body: 0.9375rem;
--ss-type-caption: 0.8125rem;
--ss-type-label: 0.75rem;
--ss-type-button: 0.875rem;
```

#### 圆角

```css
--ss-radius-sm: 0.625rem;
--ss-radius-md: 0.875rem;
--ss-radius-lg: 1.125rem;
--ss-radius-xl: 1.5rem;
--ss-radius-2xl: 1.875rem;
--ss-radius-pill: 999px;
```

#### 阴影

```css
--ss-shadow-1: 0 8px 20px rgba(40, 32, 20, 0.03);
--ss-shadow-2: 0 14px 36px rgba(40, 32, 20, 0.05);
--ss-shadow-3: 0 22px 60px rgba(40, 32, 20, 0.07);
--ss-shadow-card: var(--ss-shadow-1);
--ss-shadow-soft: var(--ss-shadow-1);
--ss-shadow-stage: var(--ss-shadow-3);
```

#### 间距

```css
--ss-space-1: 0.25rem;
--ss-space-2: 0.5rem;
--ss-space-3: 0.75rem;
--ss-space-4: 1rem;
--ss-space-5: 1.25rem;
--ss-space-6: 1.5rem;
--ss-space-7: 2rem;
--ss-space-8: 2.5rem;
--ss-space-9: 3rem;
```

### 3. Settings页面CSS类 (`product-pages.css`)

#### 容器类

```css
/* Settings主容器 */
.ss-product-page--settings {
  gap: 0.9rem;
  padding-top: 0.85rem;
  padding-bottom: 2.25rem;
}

/* Settings页面布局 */
.ss-settings-page__layout {
  grid-template-columns: 11.75rem minmax(0, 1fr);
  gap: 0.9rem;
}

.ss-settings-page__nav {          /* 左侧标签导航 */
  position: static;
  align-self: stretch;
  height: 100%;
}

.ss-settings-page__content {      /* 右侧内容区域 */
  display: grid;
  gap: 0.9rem;
}
```

#### 标签导航

```css
.ss-settings-page__tab {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.6rem;
  align-items: start;
  min-height: 3rem;
  padding: 0.7rem 0.8rem;
  border-radius: 8px;
}

.ss-settings-page__tab-icon {
  display: inline-flex;
  margin-top: 0.1rem;
  color: inherit;
}

.ss-settings-page__tab-copy {
  display: grid;
  gap: 0.12rem;
}

.ss-settings-page__tab-copy strong {
  font-size: 0.9rem;
}

.ss-settings-page__tab-copy span:last-child {
  color: var(--ss-text-subtle);
  font-size: 0.76rem;
  line-height: 1.42;
}

/* 活跃状态 */
.ss-product-page .tab-button.active {
  border-color: color-mix(in srgb, var(--ss-brand-primary) 28%, var(--ss-border));
  background: var(--ss-brand-soft);
  color: var(--ss-brand-hover);
}
```

#### 指标卡片

```css
.ss-settings-metric {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.65rem;
  align-items: center;
  padding: 0.7rem 0.8rem;
}

.ss-settings-metric__icon {
  display: inline-flex;
  width: 2.15rem;
  height: 2.15rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.95rem;
  background: var(--ss-brand-soft);
  color: var(--ss-brand-primary);
}

.ss-settings-metric__label {
  font-size: var(--ss-type-label);
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--ss-text-muted);
}

.ss-settings-metric__value {
  display: block;
  margin-top: 0.18rem;
  color: var(--ss-heading);
  font-size: 1rem;
  font-weight: 600;
}
```

#### 表单网格

```css
/* 两列表单网格 */
.ss-settings-form-grid {
  display: grid;
  gap: 0.9rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

/* 跨越全宽的字段 */
.ss-settings-form-grid__full {
  grid-column: 1 / -1;
}

.ss-form-label {
  display: inline-block;
  margin-bottom: 0.45rem;
  color: var(--ss-text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.ss-provider-input {
  border: 1px solid color-mix(in srgb, var(--ss-border) 90%, var(--ss-brand-soft));
  background: color-mix(in srgb, var(--ss-page-surface) 90%, transparent);
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.ss-provider-input:focus {
  border-color: color-mix(in srgb, var(--ss-brand-primary) 48%, var(--ss-border));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ss-brand-soft) 35%, transparent);
}

.ss-provider-input--textarea {
  min-height: 128px;
  resize: vertical;
}
```

#### 提供商卡片

```css
/* 提供商行 */
.ss-provider-row {
  display: grid;
  gap: 0.8rem;
  padding: 0.95rem 1rem;
  border-radius: 1rem;
  border: 1px solid color-mix(in srgb, var(--ss-border) 92%, var(--ss-brand-soft));
  background: color-mix(in srgb, var(--ss-surface) 90%, transparent);
  transition: transform 0.18s ease, border-color 0.18s ease;
}

.ss-provider-row:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--ss-brand-primary) 24%, var(--ss-border));
  background: color-mix(in srgb, var(--ss-brand-soft) 10%, var(--ss-surface) 90%);
}

.ss-provider-row.is-active {
  border-color: color-mix(in srgb, var(--ss-brand-primary) 34%, var(--ss-border));
  background: color-mix(in srgb, var(--ss-brand-soft) 14%, var(--ss-surface) 86%);
}

/* 提供商卡片 */
.ss-providers-card {
  position: relative;
  overflow: hidden;
  border-color: color-mix(in srgb, var(--ss-border) 84%, var(--ss-brand-soft));
  background:
    radial-gradient(120% 100% at 100% -10%, color-mix(in srgb, var(--ss-brand-soft) 26%, transparent) 0%, transparent 46%),
    color-mix(in srgb, var(--ss-surface) 94%, transparent);
  border-radius: 8px;
}

/* 工作空间顶部卡片 */
.ss-providers-card--workspace-top {
  padding: 1rem;
  border-color: color-mix(in srgb, var(--ss-brand-primary) 30%, var(--ss-border));
}

.ss-providers-card--workspace-top .ss-settings-stack {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

/* LLM测试卡片 */
.ss-providers-card--tester {
  max-width: 980px;
  width: 100%;
  padding: 1rem;
  height: 100%;
  display: grid;
  align-content: start;
  gap: 0.9rem;
}

/* 能力卡片 */
.ss-providers-card--capabilities-compact {
  padding: 0.85rem;
  height: 100%;
  min-height: 0;
  display: grid;
  align-content: start;
  gap: 0.65rem;
}

.ss-providers-card--capabilities-compact .ss-settings-stack {
  gap: 0.5rem;
  min-height: 0;
  overflow: auto;
  padding-right: 0.2rem;
}
```

#### 能力行

```css
.ss-capability-row {
  display: grid;
  gap: 0.5rem;
}

.ss-capability-card {
  border-radius: 1rem;
  border: 1px solid color-mix(in srgb, var(--ss-border) 90%, var(--ss-brand-soft));
  background: color-mix(in srgb, var(--ss-surface) 92%, transparent);
  padding: 0.75rem;
  transition: border-color 0.18s ease;
}

.ss-capability-card:hover {
  border-color: color-mix(in srgb, var(--ss-brand-primary) 24%, var(--ss-border));
}

.ss-capability-row__head {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  justify-content: space-between;
  flex-wrap: wrap;
}

.ss-capability-row__metrics {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  justify-content: flex-start;
  color: var(--ss-text-muted);
  font-size: 0.86rem;
}
```

#### 状态芯片

```css
.ss-status-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.34rem 0.62rem;
  border-radius: 999px;
  border: 1px solid var(--ss-border);
  background: color-mix(in srgb, var(--ss-surface) 94%, transparent);
  color: var(--ss-text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1;
}

.ss-status-chip.is-active {
  border-color: color-mix(in srgb, var(--ss-brand-primary) 28%, var(--ss-border));
  background: var(--ss-brand-soft);
  color: var(--ss-brand-hover);
}

.ss-status-chip.is-success {
  border-color: color-mix(in srgb, var(--ss-success) 28%, var(--ss-border));
  background: color-mix(in srgb, var(--ss-success) 14%, transparent);
  color: var(--ss-success);
}

.ss-status-chip.is-danger {
  border-color: color-mix(in srgb, var(--ss-danger) 28%, var(--ss-border));
  background: var(--ss-danger-soft);
  color: var(--ss-danger);
}
```

#### 数据表

```css
.ss-data-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--ss-border);
  border-radius: 1rem;
}

.ss-data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.ss-data-table th,
.ss-data-table td {
  padding: 0.8rem 0.9rem;
  border-bottom: 1px solid var(--ss-border);
  text-align: left;
  vertical-align: top;
}

.ss-data-table th {
  color: var(--ss-text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  background: color-mix(in srgb, var(--ss-surface-strong) 92%, transparent);
}

.ss-data-table__actions {
  width: 4rem;
  text-align: right;
}
```

#### 响应式设计

```css
@media (max-width: 880px) {
  .ss-docs-page__layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .ss-product-page .tab-nav {
    position: static;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 512px) {
  .ss-product-page .tab-nav {
    grid-template-columns: 1fr;
  }
}
```

---

## 状态管理

### 1. Zustand Store架构 (`frontend/store/`)

#### 核心组成 (Store Slices)

```typescript
// frontend/store/index.ts - 主store
export const useSimulationStore = create<StoreState>()(
  devtools(
    (set, get, api) => ({
      ...createSimulationSlice(set, get, api),
      ...createAgentsSlice(set, get, api),
      ...createLogsSlice(set, get, api),
      ...createUISlice(set, get, api),
      ...createExperimentsSlice(set, get, api),
      ...createEnvironmentSlice(set, get, api),
      ...createProvidersSlice(set, get, api)    // ⭐ 关键
    }),
    { name: 'SimulationStore' }
  )
);

export type AppState = StoreState;
```

#### StoreState复合类型 (`frontend/store/storeState.ts`)

```typescript
export interface StoreState extends
  SimulationSlice,
  AgentsSlice,
  LogsSlice,
  UISlice,
  ExperimentsSlice,
  EnvironmentSlice,
  ProvidersSlice {}
```

### 2. Provider Slice (`frontend/store/providers.ts`)

#### 接口定义

```typescript
export interface ProvidersSlice {
  // 状态
  llmProviders: Provider[];
  currentProviderId: number | null;
  selectedProviderId: number | null;

  // 操作
  loadProviders: () => Promise<void>;
  setSelectedProvider: (id: number | null) => void;
}
```

#### 实现

```typescript
export const createProvidersSlice: StateCreator<
  StoreState,
  [],
  [],
  ProvidersSlice
> = (set, get) => ({
  // 初始状态
  llmProviders: [],
  currentProviderId: null,
  selectedProviderId: null,

  // 操作
  loadProviders: async () => {
    try {
      const providers = await listProviders();
      const current =
        providers.find((p) => p.is_active || p.is_default) || providers[0] || null;

      set({
        llmProviders: providers,
        currentProviderId: current ? current.id : null,
        selectedProviderId: current ? current.id : null
      });
    } catch (e) {
      console.error("加载 LLM 提供商失败", e);
    }
  },

  setSelectedProvider: (id) => set({ selectedProviderId: id })
});
```

### 3. UI Slice (`frontend/store/ui.ts`)

#### 模态状态

```typescript
export interface UISlice {
  // 模态状态
  isWizardOpen: boolean;
  isHelpModalOpen: boolean;
  isAnalyticsOpen: boolean;
  isExportOpen: boolean;
  isExperimentDesignerOpen: boolean;
  isTimeSettingsOpen: boolean;
  isSaveTemplateOpen: boolean;
  isNetworkEditorOpen: boolean;
  isReportModalOpen: boolean;
  globalKnowledgeOpen: boolean;
  isInitialEventsOpen: boolean;
  isSyncModalOpen: boolean;
  isSnapshotModalOpen: boolean;
  isTreeOpsModalOpen: boolean;

  // 加载状态
  isGenerating: boolean;
  isGeneratingReport: boolean;
  isSyncing: boolean;

  // 同步日志
  syncLogs: string[];

  // 通知
  notifications: Notification[];

  // 引导助手
  isGuideOpen: boolean;
  guideMessages: GuideMessage[];
  isGuideLoading: boolean;

  // 模态操作
  toggleWizard: (isOpen: boolean) => void;
  toggleHelpModal: (isOpen: boolean) => void;
  // ... 其他toggle方法

  // 通知操作
  addNotification: (type: 'success' | 'error' | 'info', message: string) => void;
  removeNotification: (id: string) => void;

  // 引导操作
  toggleGuide: (isOpen: boolean) => void;
  sendGuideMessage: (content: string) => Promise<void>;
}
```

### 4. Auth Store (`frontend/store/auth.ts` - 推断)

```typescript
export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;

  // 操作
  setUser: (user: User | null) => void;
  updateTokens: (access: string, refresh: string) => void;
  clearSession: () => void;
}
```

---

## 主题/设计系统

### 1. 主题结构

#### 主题切换机制

```typescript
// 通过 CSS 类实现主题切换
// `:root.theme-light` 或 `:root.light`   - 浅色主题
// `:root.theme-dark` 或 `:root.dark`     - 深色主题

document.documentElement.classList.add('theme-dark');  // 切换到深色
document.documentElement.classList.remove('theme-dark'); // 切换到浅色
```

### 2. 颜色变量体系

#### 品牌色

```css
/* 浅色 */
--ss-brand-primary: #d4a24e;    /* 暖蜜金 */
--ss-brand-hover: #c4922e;      /* 深化 */
--ss-brand-soft: rgba(255, 200, 112, 0.14);  /* 柔和背景 */

/* 深色 */
--ss-brand-primary: #2fe6a6;    /* 清新绿 */
--ss-brand-hover: #45f0b3;      /* 亮化 */
--ss-brand-soft: rgba(47, 230, 166, 0.1);   /* 柔和背景 */
```

#### 语义色

```css
--ss-success: #5a9a6b;     /* 成功绿 */
--ss-warning: #c49535;     /* 警告黄 */
--ss-danger: #c4605a;      /* 危险红 */
--ss-info: #7EA8D0;        /* 信息蓝 */
--ss-link: #b08930;        /* 链接金 */
```

#### 中性色

```css
/* 文本 */
--ss-heading: #1E1A17;          /* 标题 */
--ss-text: #3E3A37;             /* 正文 */
--ss-text-muted: #726D68;       /* 淡化 */
--ss-text-subtle: #9B98A1;      /* 隐微 */

/* 表面 */
--ss-surface: rgba(255, 253, 250, 0.88);
--ss-surface-muted: rgba(255, 252, 247, 0.94);
--ss-surface-strong: rgba(248, 244, 236, 0.96);
--ss-surface-inset: rgba(245, 240, 232, 0.72);

/* 边框 */
--ss-border: rgba(60, 50, 40, 0.08);
--ss-border-strong: rgba(60, 50, 40, 0.14);
```

### 3. 排版系统

#### 字体栈

```css
--font-sans: "Inter", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", ...
--font-display: "Inter", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", ...
--font-mono: "IBM Plex Mono", "Cascadia Code", "SFMono-Regular", Consolas, ...
```

#### 字体大小

```css
--ss-type-page-title: 3.25rem;    /* h1, 主页标题 */
--ss-type-section-title: 1.875rem;  /* h2, 章节标题 */
--ss-type-card-title: 1.25rem;    /* h3, 卡片标题 */
--ss-type-body: 0.9375rem;        /* p, 正文 */
--ss-type-caption: 0.8125rem;     /* small, 注释 */
--ss-type-label: 0.75rem;         /* label, 标签 */
--ss-type-button: 0.875rem;       /* button, 按钮 */
```

### 4. 间距系统

```css
--ss-space-1: 0.25rem;  /* 4px */
--ss-space-2: 0.5rem;   /* 8px */
--ss-space-3: 0.75rem;  /* 12px */
--ss-space-4: 1rem;     /* 16px */
--ss-space-5: 1.25rem;  /* 20px */
--ss-space-6: 1.5rem;   /* 24px */
--ss-space-7: 2rem;     /* 32px */
--ss-space-8: 2.5rem;   /* 40px */
--ss-space-9: 3rem;     /* 48px */
```

### 5. 圆角系统

```css
--ss-radius-sm: 0.625rem;    /* 10px */
--ss-radius-md: 0.875rem;    /* 14px */
--ss-radius-lg: 1.125rem;    /* 18px */
--ss-radius-xl: 1.5rem;      /* 24px */
--ss-radius-2xl: 1.875rem;   /* 30px */
--ss-radius-pill: 999px;     /* 圆形 */
```

### 6. 阴影系统

```css
--ss-shadow-1: 0 8px 20px rgba(40, 32, 20, 0.03);     /* 轻 */
--ss-shadow-2: 0 14px 36px rgba(40, 32, 20, 0.05);    /* 中 */
--ss-shadow-3: 0 22px 60px rgba(40, 32, 20, 0.07);    /* 重 */
--ss-shadow-card: var(--ss-shadow-1);
--ss-shadow-soft: var(--ss-shadow-1);
--ss-shadow-stage: var(--ss-shadow-3);
```

---

## 组件库集成

### 1. UI组件库

#### AppSelect 组件

**位置**: `frontend/components/AppSelect.tsx`

```typescript
export function AppSelect({
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}): JSX.Element
```

**用法** (在SettingsPage中)
```typescript
<AppSelect
  value={llmTestProviderId}
  options={providers.map((provider) => ({
    value: String(provider.id),
    label: `${provider.name} · ${provider.model || provider.provider}`,
  }))}
  onChange={(value) => setLlmTestProviderId(value)}
/>
```

#### TitleCard 组件

**位置**: `frontend/components/TitleCard.tsx`

```typescript
interface Props {
  title: string;
  subtitle?: string;
}

export function TitleCard({ title, subtitle }: Props): JSX.Element
```

**用法**
```typescript
<TitleCard title={t("settings.title")} />
```

### 2. Icon库 (Lucide React + Radix)

```typescript
// Lucide React icons
import {
  Bot,              // LLM提供商
  Database,         // 数据库/文件
  FileStack,        // 文件堆
  LogOut,           // 退出登录
  Search,           // 搜索
  Shield,           // 安全/保护
  UserCircle2,      // 用户圆形
  WandSparkles,     // 魔法棒
} from "lucide-react";

// Radix UI icons
import {
  FilePlusIcon,    // 新增文件
  Link2Icon,       // 连接/链接
  TrashIcon,       // 删除/垃圾箱
} from "@radix-ui/react-icons";
```

### 3. 按钮样式

```typescript
// 主按钮
<button className="ss-button">
  {isPending && <span className="spinner" aria-hidden />}
  <Icon />
  <span>标签文本</span>
</button>

// 次要按钮
<button className="ss-button-secondary">次要操作</button>

// 危险按钮
<button className="ss-button-danger">
  <LogOut size={15} />
  <span>退出登录</span>
</button>

// 图标按钮
<button className="icon-button square" title="删除">
  <TrashIcon />
</button>
```

### 4. 卡片结构

```html
<!-- 标准卡片 -->
<section class="card">
  <div class="panel-title">标题</div>
  <div class="panel-subtitle">子标题</div>
  <!-- 内容 -->
</section>

<!-- 表面卡片 -->
<section class="ss-surface-strong">
  <!-- 内容 -->
</section>

<!-- 设置指标 -->
<div class="ss-settings-metric ss-inset">
  <div class="ss-settings-metric__icon">
    <Icon size={16} />
  </div>
  <div>
    <div class="ss-settings-metric__label">标签</div>
    <strong class="ss-settings-metric__value">值</strong>
  </div>
</div>
```

---

## 集成要点总结

### 📍 核心依赖链

```
SettingsPage.tsx
  ├─ React Query (useQuery, useMutation)
  ├─ zustand (useAuthStore)
  ├─ react-i18next (useTranslation)
  └─ 服务层
      ├─ listProviders()        → GET /api/providers
      ├─ testProvider()         → POST /api/providers/{id}/test
      ├─ listSearchProviders()  → GET /api/search-providers
      ├─ createSearchProvider() → POST /api/search-providers
      ├─ updateSearchProvider() → PATCH /api/search-providers/{id}
      ├─ listUploads()          → GET /api/uploads
      ├─ deleteUpload()         → DELETE /api/uploads/{id}
      └─ findOrphans()          → GET /api/uploads/orphans
```

### 🎨 样式系统层级

```
CSS Cascade (优先级高→低):
  1. 内联样式 (style="")
  2. component-specific .ss-* classes
  3. @layer components (product-pages.css)
  4. @layer base (base.css)
  5. CSS变量 (tokens.css)
     ├─ :root.theme-light
     ├─ :root.theme-dark
     └─ 颜色/排版/间距/圆角/阴影
```

### 🔄 状态流向

```
User Action
  ↓
SettingsPage (useState)
  ↓
React Query Mutation
  ↓
API Service (frontend/services/)
  ↓
HTTP Request (apiClient)
  ↓
Backend API (/api/*)
  ↓
Database
  ↓
Response
  ↓
Zustand Store (optional)
  ↓
Re-render
```

### 🌍 本地化支持

```typescript
// i18next 翻译键 (frontend/locales/)
t("settings.title")
t("settings.tabs.profile")
t("settings.tabs.security")
t("settings.tabs.llmProviders")
t("settings.tabs.searchProviders")
t("settings.tabs.files")
t("settings.profile.email")
t("settings.providers.loading")
t("settings.providers.error")
t("settings.files.empty")
// ...以及许多其他键
```

---

## 文件索引

### 核心文件
- **页面**: [frontend/pages/SettingsPage.tsx](frontend/pages/SettingsPage.tsx)
- **服务**: 
  - [frontend/services/providers.ts](frontend/services/providers.ts)
  - [frontend/services/searchProviders.ts](frontend/services/searchProviders.ts)
  - [frontend/services/client.ts](frontend/services/client.ts)
- **Store**:
  - [frontend/store/index.ts](frontend/store/index.ts)
  - [frontend/store/providers.ts](frontend/store/providers.ts)
  - [frontend/store/ui.ts](frontend/store/ui.ts)
  - [frontend/store/storeState.ts](frontend/store/storeState.ts)

### 样式文件
- **主样式**: [frontend/styles/pages/product-pages.css](frontend/styles/pages/product-pages.css)
- **设计令牌**: [frontend/styles/system/tokens.css](frontend/styles/system/tokens.css)
- **基础样式**: [frontend/styles/system/base.css](frontend/styles/system/base.css)
- **入口**: [frontend/index.css](frontend/index.css)

### 类型定义
- **主类型**: [frontend/types.ts](frontend/types.ts)

---

*文档生成时间: 2026-04-20*
