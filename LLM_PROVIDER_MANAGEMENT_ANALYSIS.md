# LLM提供商管理系统深度分析

## 📌 概述

LLM提供商管理是SettingsPage的**核心功能**，负责管理项目使用的多个AI服务提供商配置。

**主要责任**:
- ✅ 配置和维护多个LLM提供商
- ✅ 激活/切换活跃提供商
- ✅ 测试提供商连接
- ✅ 显示模型能力信息

---

## 🏗️ 架构概览

```
SettingsPage.tsx (LLM标签页)
    ↓
renderProviders()
    ├─ 工作空间信息卡
    │   ├─ 已配置提供商数量
    │   └─ 当前活跃端点
    ├─ LLM测试台
    │   ├─ 选择提供商下拉框
    │   ├─ 输入测试提示词
    │   ├─ 执行测试按钮
    │   └─ 测试结果显示
    └─ 模型能力展示表
        ├─ gpt-4o-mini
        ├─ gpt-4o
        ├─ gemini-1.5-flash
        └─ gemini-1.5-pro
```

---

## 💾 Provider数据结构

### 类型定义

```typescript
export type Provider = {
  // 标识
  id: number;                          // 数据库主键
  name: string;                        // 用户友好的名称 (e.g., "OpenAI (Production)")

  // 提供商类型与模型
  provider: string;                    // "openai-compatible" | "gemini" 等
  model: string;                       // "gpt-4o" | "gpt-4o-mini" | "gemini-1.5-pro" 等

  // 连接信息
  base_url: string | null;             // API端点 (e.g., "https://api.openai.com/v1")
  has_api_key: boolean;                // 是否设置了API密钥

  // 测试信息
  last_test_status?: string | null;    // "success" | "failed" | null
  last_tested_at?: string | null;      // 最后测试时间 (ISO string)

  // 配置
  config?: Record<string, unknown> | null;  // provider特定的配置

  // 状态标记
  is_active?: boolean;                 // 当前活跃 (只有一个为true)
  is_default?: boolean;                // 默认提供商
};
```

### 实际示例

```typescript
// OpenAI提供商
{
  id: 1,
  name: "OpenAI (Production)",
  provider: "openai-compatible",
  model: "gpt-4o",
  base_url: "https://api.openai.com/v1",
  has_api_key: true,
  is_active: true,
  is_default: true,
  last_test_status: "success",
  last_tested_at: "2026-04-20T10:30:00Z"
}

// Google Gemini提供商
{
  id: 2,
  name: "Google Gemini",
  provider: "gemini",
  model: "gemini-1.5-pro",
  base_url: "https://generativelanguage.googleapis.com/v1beta/models",
  has_api_key: true,
  is_active: false,
  last_test_status: null,
  last_tested_at: null
}

// Mock提供商 (开发用)
{
  id: 3,
  name: "Mock Provider",
  provider: "mock",
  model: "mock-model",
  base_url: null,
  has_api_key: false,
  is_active: false
}
```

---

## 🔌 API端点详细分析

### 1. 列出所有提供商

```http
GET /api/providers
Authorization: Bearer <access_token>
```

**返回**:
```typescript
Provider[]  // 所有已配置的提供商列表
```

**用途**: 页面加载时获取所有提供商，用于下拉框选择、激活状态显示等

**缓存**: React Query `["providers"]` - 仅在标签页激活时加载

---

### 2. 创建提供商

```http
POST /api/providers
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "string",
  "provider": "string",        // Type: "openai-compatible" | "gemini"
  "model": "string",
  "base_url": "string | null",
  "api_key": "string | null",  // 发送时包含，不在响应中返回
  "config": {                  // 提供商特定配置
    [key: string]: unknown
  } | null
}
```

**返回**: 创建的 `Provider` 对象

**错误处理**:
- 400: 验证失败 (缺少必要字段、无效的URL等)
- 401: 未授权
- 409: 提供商名称重复

---

### 3. 测试提供商连接

```http
POST /api/providers/{providerId}/test
Authorization: Bearer <access_token>
```

**返回**:
```typescript
{
  message: string  // 成功或失败信息
}
```

**业务逻辑**:
1. 后端尝试使用该提供商调用LLM
2. 如果成功，更新 `last_test_status` = "success" 和 `last_tested_at`
3. 如果失败，更新 `last_test_status` = "failed"
4. 返回消息给前端

**前端处理**:
```typescript
const llmTest = useMutation({
  mutationFn: async () => {
    if (!selectedLlmTestProvider) {
      throw new Error("no provider selected");
    }
    return apiTestProvider(selectedLlmTestProvider.id);
  },
  onSuccess: () => {
    setLlmTestResult({
      ok: true,
      msg: "连接测试通过，可用于 LLM 调用。",
    });
    queryClient.invalidateQueries({ queryKey: ["providers"] });
    // ⬆️ 重新获取提供商列表以获取更新的测试状态
  },
  onError: () => {
    setLlmTestResult({
      ok: false,
      msg: "连接测试失败，请检查模型端点与密钥。",
    });
  },
});
```

---

### 4. 更新提供商

```http
PATCH /api/providers/{providerId}
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "string | undefined",
  "provider": "string | undefined",
  "model": "string | undefined",
  "base_url": "string | null | undefined",
  "api_key": "string | null | undefined",
  "config": "Record<string, unknown> | null | undefined"
}
```

**返回**: 更新后的 `Provider` 对象

---

### 5. 激活提供商

```http
POST /api/providers/{providerId}/activate
Authorization: Bearer <access_token>
```

**返回**:
```typescript
{
  message: string  // "Provider activated" 等
}
```

**业务逻辑**:
1. 将该提供商的 `is_active` 设置为 `true`
2. 将所有其他提供商的 `is_active` 设置为 `false` (确保只有一个活跃)
3. 后续LLM调用将使用该提供商

---

### 6. 删除提供商

```http
DELETE /api/providers/{providerId}
Authorization: Bearer <access_token>
```

**返回**: 204 No Content

**限制**: 
- 不能删除当前活跃的提供商
- 删除后需要重新获取列表

---

## 🎨 UI组件分解

### 工作空间卡片

```typescript
// 显示汇总信息
<section className="ss-providers-card ss-providers-card--workspace ss-providers-card--workspace-top">
  <div className="panel-title">{t("settings.providers.workspaceTitle")}</div>
  <div className="panel-subtitle">{t("settings.providers.workspaceHint")}</div>
  
  <div className="ss-settings-stack">
    {/* 指标 1: 已配置提供商数量 */}
    <SettingsMetric
      label={isZh ? "已配置提供商" : "Configured providers"}
      value={String(providers.length)}
      icon={<Bot size={16} />}
    />
    
    {/* 指标 2: 当前活动端点 */}
    <SettingsMetric
      label={isZh ? "当前活动端点" : "Active endpoint"}
      value={activeProvider?.name || "—"}
      icon={<WandSparkles size={16} />}
    />
  </div>
</section>
```

**CSS类**:
- `.ss-providers-card`: 基础卡片样式
- `.ss-providers-card--workspace-top`: 工作空间顶部特定样式
- `.ss-settings-stack`: 竖直堆叠容器 (gap: 0.9rem)
- `.ss-settings-metric`: 指标卡片 (2列布局)

---

### LLM测试台

```typescript
<section className="card ss-providers-card ss-providers-card--tester">
  <div className="panel-title">{isZh ? "LLM 测试" : "LLM Testing"}</div>
  <div className="panel-subtitle">
    {t("settings.providers.current", { name: activeProvider?.name || "—" })}
  </div>

  {/* 1. 选择提供商 */}
  <div className="ss-settings-form-grid">
    <label className="ss-settings-form-grid__full">
      <span className="ss-form-label">
        {isZh ? "测试提供商配置" : "Provider configuration"}
      </span>
      <AppSelect
        value={llmTestProviderId}
        options={providers.map((provider) => ({
          value: String(provider.id),
          label: `${provider.name} · ${provider.model || provider.provider}`,
        }))}
        onChange={(value) => setLlmTestProviderId(value)}
      />
    </label>

    {/* 2. 输入测试提示词 */}
    <label className="ss-settings-form-grid__full">
      <span className="ss-form-label">
        {isZh ? "测试提示词（可选）" : "Test prompt (optional)"}
      </span>
      <textarea
        value={llmTestPrompt}
        onChange={(event) => setLlmTestPrompt(event.target.value)}
        className="ss-provider-input ss-provider-input--textarea"
        placeholder={isZh
          ? "例如：请返回 OK 并简述模型可用性。"
          : "Example: return OK and summarize model availability."
        }
      />
    </label>
  </div>

  {/* 3. 执行测试按钮 */}
  <div className="ss-settings-action-row">
    <button
      type="button"
      className="ss-button"
      onClick={() => llmTest.mutate()}
      disabled={!selectedLlmTestProvider || llmTest.isPending}
    >
      {llmTest.isPending ? (
        <span className="spinner" aria-hidden />
      ) : (
        <Link2Icon />
      )}
      <span>{isZh ? "测试 LLM 连接" : "Test LLM connection"}</span>
    </button>

    {/* 4. 显示测试结果 */}
    {llmTestResult ? (
      <span className={`ss-provider-row__hint ${llmTestResult.ok ? "is-ok" : "is-error"}`}>
        {llmTestResult.msg}
      </span>
    ) : null}
  </div>

  {/* 5. 信息提示 */}
  <div className="ss-settings-note">
    {selectedLlmTestProvider
      ? `${selectedLlmTestProvider.provider} • ${selectedLlmTestProvider.base_url || "-"}`
      : (isZh ? "请先选择一个提供商配置。" : "Select a provider configuration first.")}
  </div>
</section>
```

**关键CSS类**:
- `.ss-settings-form-grid`: 表单布局 (2列)
- `.ss-settings-form-grid__full`: 跨越全宽
- `.ss-provider-input--textarea`: 文本区域 (min-height: 128px)
- `.ss-settings-action-row`: 按钮行容器
- `.ss-provider-row__hint`: 结果提示文本
- `.is-ok`: 成功状态 (颜色: #0f9b6c)
- `.is-error`: 错误状态 (颜色: #d0526c)

---

### 模型能力展示表

```typescript
const getCapabilityRows = (t: (key: string) => string) => [
  {
    model: "gpt-4o-mini",
    context: "128k",
    input: "$0.15 / 1M",
    output: "$0.60 / 1M",
    modalities: "Text, Image",
    note: "settings.providers.modelNote.goodDefault",
  },
  {
    model: "gpt-4o",
    context: "128k",
    input: "$5.00 / 1M",
    output: "$15.00 / 1M",
    modalities: "Text, Image, Audio",
    note: "settings.providers.modelNote.fastLongContext",
  },
  // ...更多模型
];

// 渲染
<section className="card ss-providers-card ss-providers-card--capabilities ss-providers-card--capabilities-compact">
  <div className="panel-title">{t("settings.providers.capabilities.title")}</div>
  <div className="panel-subtitle">{t("settings.providers.capabilities.hint")}</div>
  
  <div className="ss-settings-stack">
    {getCapabilityRows(t).map((row) => (
      <div key={row.model} className="ss-capability-row ss-capability-card ss-inset">
        <div className="ss-capability-row__head">
          <strong>{row.model}</strong>
          <span className="ss-pill ss-pill--quiet">
            {t("settings.providers.capabilities.context")}: {row.context}
          </span>
        </div>
        <div className="panel-subtitle">
          {t("settings.providers.capabilities.modalities")}: {row.modalities}
        </div>
        <div className="ss-capability-row__metrics">
          <span>{t("settings.providers.capabilities.input")}: {row.input}</span>
          <span>{t("settings.providers.capabilities.output")}: {row.output}</span>
        </div>
        <div className="panel-subtitle">
          {t("settings.providers.capabilities.note")}: {t(row.note)}
        </div>
      </div>
    ))}
  </div>
</section>
```

**CSS类**:
- `.ss-capability-row`: 能力行容器 (gap: 0.5rem)
- `.ss-capability-card`: 卡片基础样式
- `.ss-capability-row__head`: 标题行 (flex, space-between)
- `.ss-capability-row__metrics`: 指标行 (flex, 左对齐)
- `.ss-inset`: 内嵌样式

---

## 🔄 状态转移图

```
初始加载
    ↓
providersQuery 激活 (activeTab === "providers_llm")
    ↓
加载提供商列表 (GET /api/providers)
    ↓
设置 llmTestProviderId 为活跃提供商或第一个
    ↓
┌──────────────────────────────────────┐
│  显示提供商列表、测试台、能力表      │
└──────────────────────────────────────┘
    ↓
用户选择提供商 → setState(llmTestProviderId)
    ↓
用户点击"测试LLM连接"
    ↓
llmTest.mutate()
    ↓
POST /api/providers/{id}/test
    ↓
┌─────────────────────────────────────────────────┐
│ 成功                          │ 失败             │
├───────────────────────────────┼──────────────────┤
│ setLlmTestResult({            │ setLlmTestResult │
│   ok: true,                   │ ({ok: false, ... │
│   msg: "通过..."              │ })               │
│ })                            │                  │
│ invalidateQueries             │                  │
│ (providers)                   │                  │
│ → 重新加载提供商列表          │                  │
└─────────────────────────────────────────────────┘
    ↓
显示结果给用户
```

---

## 🧩 状态管理方案

### useState (SettingsPage)

```typescript
// 当前选中的测试提供商ID
const [llmTestProviderId, setLlmTestProviderId] = useState<string>("");

// 测试提示词输入
const [llmTestPrompt, setLlmTestPrompt] = useState("");

// 测试结果
const [llmTestResult, setLlmTestResult] = useState<{
  ok: boolean;
  msg: string;
} | null>(null);
```

### useQuery (React Query)

```typescript
const providersQuery = useQuery({
  queryKey: ["providers"],
  enabled: activeTab === "providers_llm",  // 仅在标签激活时加载
  queryFn: () => listProviders(),
});

const providers = providersQuery.data ?? [];
const activeProvider = providers.find((p) => p.is_active);
```

### useMutation (React Query)

```typescript
const llmTest = useMutation({
  mutationFn: async () => {
    if (!selectedLlmTestProvider) throw new Error("no provider selected");
    return apiTestProvider(selectedLlmTestProvider.id);
  },
  onSuccess: () => {
    setLlmTestResult({
      ok: true,
      msg: "连接测试通过，可用于 LLM 调用。",
    });
    // ⬇️ 关键: 重新加载列表以显示更新的测试状态
    queryClient.invalidateQueries({ queryKey: ["providers"] });
  },
  onError: () => {
    setLlmTestResult({
      ok: false,
      msg: "连接测试失败，请检查模型端点与密钥。",
    });
  },
});
```

### Zustand Store (可选)

```typescript
// frontend/store/providers.ts
export interface ProvidersSlice {
  llmProviders: Provider[];
  currentProviderId: number | null;
  selectedProviderId: number | null;

  loadProviders: () => Promise<void>;
  setSelectedProvider: (id: number | null) => void;
}

// 使用
const { llmProviders, setSelectedProvider } = useSimulationStore((state) => ({
  llmProviders: state.llmProviders,
  setSelectedProvider: state.setSelectedProvider,
}));
```

---

## 🎯 Provider选择逻辑

### 初始化

```typescript
useEffect(() => {
  if (llmTestProviderId || !providers.length) return;
  
  // 优先级:
  // 1. 活跃的提供商 (is_active)
  // 2. 第一个提供商
  const preferred = activeProvider?.id ?? providers[0].id;
  setLlmTestProviderId(String(preferred));
}, [providers, activeProvider?.id, llmTestProviderId]);
```

### Memoization

```typescript
const selectedLlmTestProvider = useMemo(
  () => providers.find((provider) =>
    String(provider.id) === llmTestProviderId
  ) || null,
  [providers, llmTestProviderId],
);
```

---

## 🌍 多语言支持

### 翻译键 (i18n)

```typescript
// 标签和标题
t("settings.tabs.llmProviders")
t("settings.providers.llmTab")

// 工作空间信息
t("settings.providers.workspaceTitle")
t("settings.providers.workspaceHint")

// 提供商管理
t("settings.providers.current")  // 使用参数: { name: "..." }
t("settings.providers.loading")
t("settings.providers.error")

// LLM测试
t("settings.providers.capabilities.title")
t("settings.providers.capabilities.hint")
t("settings.providers.capabilities.context")
t("settings.providers.capabilities.modalities")
t("settings.providers.capabilities.input")
t("settings.providers.capabilities.output")
t("settings.providers.capabilities.note")

// 模型注释
t("settings.providers.modelNote.goodDefault")
t("settings.providers.modelNote.fastLongContext")

// 中文硬编码备选
isZh ? "已配置提供商" : "Configured providers"
isZh ? "当前活动端点" : "Active endpoint"
isZh ? "LLM 测试" : "LLM Testing"
```

---

## 🚨 错误处理策略

### 查询错误

```typescript
{providersQuery.isLoading ? (
  <div>{t("settings.providers.loading")}</div>
) : null}

{providersQuery.error ? (
  <div>{t("settings.providers.error")}</div>
) : null}
```

### Mutation错误

```typescript
// llmTest 错误自动处理
const llmTest = useMutation({
  // ...
  onError: () => {
    setLlmTestResult({
      ok: false,
      msg: "连接测试失败，请检查模型端点与密钥。",
    });
  },
});

// 显示错误状态
{llmTestResult && !llmTestResult.ok && (
  <span className="ss-provider-row__hint is-error">
    {llmTestResult.msg}
  </span>
)}
```

---

## 🔐 安全考虑

### API密钥管理

```typescript
// ⚠️ 前端规则:
// 1. 永远不在日志中打印 API 密钥
// 2. 不在LocalStorage中存储API密钥
// 3. API密钥仅在发送请求时通过Authorization header

// 后端规则:
// 1. 哈希存储密钥 (bcrypt)
// 2. 从DB返回的Provider对象不包含明文密钥
// 3. 仅返回 has_api_key: boolean 标记
// 4. 更新API密钥时需要现有密钥验证

// 前端显示
<InfoRow
  label={t("settings.providers.fields.apiKey")}
  value={provider.has_api_key ? "••••••••" : "—"}
/>
```

---

## 📊 提供商决策表

| 场景 | 操作 | API |
|------|------|-----|
| 首次配置 | 创建新提供商 | POST /api/providers |
| 切换活跃 | 激活某提供商 | POST /api/providers/{id}/activate |
| 验证可用性 | 测试连接 | POST /api/providers/{id}/test |
| 修改配置 | 更新提供商 | PATCH /api/providers/{id} |
| 删除配置 | 删除提供商 | DELETE /api/providers/{id} |
| 显示列表 | 获取所有 | GET /api/providers |

---

## 🎓 最佳实践

### ✅ DO

```typescript
// 1. 使用 enabled 条件控制查询加载
useQuery({
  queryKey: ["providers"],
  enabled: activeTab === "providers_llm",
  queryFn: () => listProviders(),
});

// 2. 在mutation成功后失效缓存
llmTest.onSuccess = () => {
  queryClient.invalidateQueries({ queryKey: ["providers"] });
};

// 3. 使用 useMemo 避免不必要的重新计算
const selectedProvider = useMemo(
  () => providers.find(p => String(p.id) === llmTestProviderId) || null,
  [providers, llmTestProviderId],
);

// 4. 显示加载状态
<button disabled={!selectedLlmTestProvider || llmTest.isPending}>
  {llmTest.isPending && <span className="spinner" />}
  {/* ... */}
</button>

// 5. 使用CSS变量而非硬编码颜色
className="ss-provider-row__hint is-ok"  // 已使用 var(--ss-success)
```

### ❌ DON'T

```typescript
// 1. 不要在前端存储API密钥
localStorage.setItem("api_key", apiKey);  // ❌ 不安全

// 2. 不要硬编码模型列表
const models = ["gpt-4", "gpt-3.5"];  // ❌ 应该从后端获取

// 3. 不要多次调用相同的查询
useQuery({ queryKey: ["providers"] });  // 第一次
useQuery({ queryKey: ["providers"] });  // 第二次 - 浪费

// 4. 不要忘记处理加载状态
const providers = providersQuery.data || [];  // ❌ 应该检查 isLoading
const providers = providersQuery.data ?? [];  // ✅ 使用 nullish coalescing

// 5. 不要在测试中实际调用API
it('should test provider', async () => {
  await apiTestProvider(1);  // ❌ 真实请求
});
// ✅ 使用 mock
it('should test provider', async () => {
  jest.mock('./services/providers', () => ({
    testProvider: jest.fn().mockResolvedValue({ message: 'ok' })
  }));
});
```

---

## 📝 提交检查清单

在提交LLM提供商相关代码修改前:

- [ ] API端点经过后端验证
- [ ] 所有错误情况都有处理
- [ ] 加载状态显示正确
- [ ] React Query缓存失效正确
- [ ] 没有在前端存储敏感信息
- [ ] i18n翻译键都已添加
- [ ] 响应式设计测试 (< 720px)
- [ ] 深色/浅色主题都测试过
- [ ] 没有控制台错误或警告
- [ ] UI与设计系统一致 (CSS变量、border-radius等)

---

## 🔗 相关链接

- [Provider API服务](frontend/services/providers.ts)
- [SettingsPage完整代码](frontend/pages/SettingsPage.tsx)
- [Store定义](frontend/store/providers.ts)
- [类型定义](frontend/types.ts)
- [样式系统](frontend/styles/pages/product-pages.css)

---

*文档最后更新: 2026-04-20*
