# 环境配置系统重构 - 支持全局和单个Agent模式

## 改动概述

将"环境事件建议"系统重构为"环境配置"系统，支持两种配置模式：
- **全局模式**：对所有智能体或指定接收者应用统一配置
- **单个Agent模式**：为特定智能体应用个性化配置

## 核心改动

### 1. 前端组件重命名
- `EnvironmentEventCreator` → `EnvironmentConfiguration`
- 保持向后兼容别名

### 2. 新增模式切换UI
在配置界面顶部添加两个按钮：
- 🌍 **全局配置** - 应用全局环境配置
- 👤 **单个Agent配置** - 为特定Agent应用定制配置

### 3. 动态UI调整
- **全局模式**：显示接收者选择器（可选择多个Agent）
- **Agent模式**：显示Agent选择下拉菜单，隐藏接收者选择器

### 4. 数据结构扩展
```typescript
interface CustomEnvironmentEvent {
  event_type: string;
  severity: string;
  description: string;
  config_mode: 'global' | 'agent';      // 新增
  target_agent_id?: string;              // 新增，Agent模式时使用
  multimodal?: MultimodalContent;
  notice_only?: boolean;
  receivers?: string[];
  // ...
}
```

### 5. 后端API更新
**POST `/events/custom-environment` 改进**
- 接收 `config_mode` 参数
- 接收 `target_agent_id` 参数
- 根据模式进行不同处理：
  - 全局模式：使用指定的receivers或广播到所有人
  - Agent模式：强制receivers为[target_agent_id]
- 在事件数据中记录配置元数据

### 6. 翻译更新

**中文 (zh.json)**
```json
{
  "environmentConfiguration": {
    "configMode": "配置模式",
    "globalMode": "全局配置",
    "agentMode": "单个Agent配置",
    "selectAgent": "选择Agent",
    "chooseAgent": "请选择一个Agent",
    ...
  }
}
```

**英文 (en.json)**
```json
{
  "environmentConfiguration": {
    "configMode": "Configuration Mode",
    "globalMode": "Global Configuration",
    "agentMode": "Single Agent Configuration",
    "selectAgent": "Select Agent",
    "chooseAgent": "Please select an agent",
    ...
  }
}
```

## 使用流程

### 全局配置流程
1. 选择"全局配置"模式
2. 选择事件类型、严重程度、描述
3. 可选：上传媒体（图片/音频）
4. 可选：选择接收者（留空则广播给所有）
5. 点击"创建配置"
6. 配置应用到选定的接收者

### 单个Agent配置流程
1. 选择"单个Agent配置"模式
2. 从下拉菜单选择目标Agent
3. 选择事件类型、严重程度、描述
4. 可选：上传媒体
5. 点击"创建配置"
6. 配置仅应用到选定的Agent

## 文件修改清单

### 前端
- ✅ [EnvironmentEventCreator.tsx](frontend/components/EnvironmentEventCreator.tsx)
  - 重命名为EnvironmentConfiguration
  - 添加configMode状态
  - 添加selectedAgentId状态
  - 添加模式切换UI
  - 动态显示/隐藏Agent选择器和接收者选择器
  - 传递config_mode和target_agent_id到API

- ✅ [EnvironmentSuggestion.tsx](frontend/components/EnvironmentSuggestion.tsx)
  - 更新导入为EnvironmentConfiguration
  - 更新对话框标题文本

- ✅ [environmentSuggestions.ts](frontend/services/environmentSuggestions.ts)
  - 扩展CustomEnvironmentEvent类型
  - 添加config_mode和target_agent_id字段

- ✅ [zh.json](frontend/locales/zh.json)
  - 添加environmentConfiguration命名空间
  - 包含全部中文翻译

- ✅ [en.json](frontend/locales/en.json)
  - 添加environmentConfiguration命名空间
  - 包含全部英文翻译

### 后端
- ✅ [environment.py](src/socialsim4/backend/api/routes/environment.py)
  - 更新create_custom_environment_event端点
  - 添加config_mode和target_agent_id处理逻辑
  - 全局模式：使用指定receivers或广播
  - Agent模式：强制receivers为目标Agent
  - 在event_data中记录配置元数据

## 技术细节

### 配置应用逻辑
```python
# 全局模式
if config_mode == "global":
    receivers = data.get("receivers")  # 可为None（广播）或特定Agent列表
    
# Agent模式
elif config_mode == "agent":
    target_agent_id = data.get("target_agent_id")
    receivers = [target_agent_id]  # 强制只发送给该Agent
```

### 前端状态管理
```typescript
const [configMode, setConfigMode] = useState<'global' | 'agent'>('global');
const [selectedAgentId, setSelectedAgentId] = useState<string>('');

// 根据mode动态显示UI元素
{configMode === 'agent' && agents.length > 0 && (
  <div>
    {/* Agent选择器 */}
  </div>
)}

{configMode === 'global' && agents.length > 0 && (
  <div>
    {/* 接收者选择器 */}
  </div>
)}
```

## 验证清单
- ✅ 无TypeScript编译错误
- ✅ 无Python导入错误
- ✅ 国际化文本完整（中英文）
- ✅ API端点兼容性维持
- ✅ 向后兼容（EnvironmentEventCreator别名）

## 未来扩展方向
1. 保存Agent配置模板供复用
2. 配置版本控制和历史追踪
3. 批量Agent配置
4. 条件化配置应用（基于Agent属性）
5. 配置调度和分阶段应用
