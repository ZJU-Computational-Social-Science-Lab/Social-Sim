# 环境事件建议功能增强

## 概述
扩展了环境事件建议系统，支持自定义事件创建和多模态内容注入（文本、图片、音频）。用户现在可以：
1. 应用系统建议的环境事件
2. 创建完全自定义的环境事件
3. 为事件添加图片和音频
4. 指定特定的事件接收者（智能体）
5. 使用通知模式（不触发系统广播）

## 前端改动

### 新文件
- **[EnvironmentEventCreator.tsx](frontend/components/EnvironmentEventCreator.tsx)** - 自定义环境事件编辑器组件
  - 事件类型选择（天气、紧急情况、通知、公众舆论、事故、社会事件等）
  - 严重程度选择（轻微、中度、严重）
  - 描述文本编辑
  - 图片上传
  - 音频上传
  - 智能体接收者选择（单选/多选）
  - 通知模式开关

### 修改的文件
1. **[EnvironmentSuggestion.tsx](frontend/components/EnvironmentSuggestion.tsx)**
   - 添加选项卡切换：系统建议 <-> 自定义事件
   - 集成EnvironmentEventCreator组件
   - 显示建议事件中的多模态内容（图片）
   - 动态获取当前模拟中的智能体列表

2. **[environmentSuggestions.ts](frontend/services/environmentSuggestions.ts)**
   - 扩展类型定义支持多模态内容
   - 添加`MultimodalContent`接口
   - 添加`CustomEnvironmentEvent`接口
   - 新增API函数：`createCustomEnvironmentEvent()`
   - 新增API函数：`uploadMediaForEvent()`

3. **[zh.json](frontend/locales/zh.json)** - 中文翻译
   - 新增选项卡标签和提示文字
   - 事件类型扩展（事故、社会事件）
   - 多模态上传相关文本

4. **[en.json](frontend/locales/en.json)** - 英文翻译
   - 同步所有中文翻译对应的英文版本

## 后端改动

### 修改的文件
- **[environment.py](src/socialsim4/backend/api/routes/environment.py)**

#### 新增端点

1. **POST `/simulations/{simulation_id}/events/upload-media`**
   - 功能：上传环境事件的媒体文件（图片或音频）
   - 参数：
     - `file`: 多部分表单文件
     - `media_type`: "image" 或 "audio"
   - 响应：`{success: true, url: "相对路径"}`
   - 限制：
     - 最大文件大小：50MB
     - 允许的图片格式：JPEG、PNG、WebP、GIF
     - 允许的音频格式：MP3、WAV、OGG、WebM、M4A

2. **POST `/simulations/{simulation_id}/events/custom-environment`**
   - 功能：创建并应用自定义环境事件
   - 请求体：
     ```json
     {
       "event_type": "weather|emergency|notification|...",
       "severity": "mild|moderate|severe",
       "description": "事件描述",
       "notice_only": false,
       "receivers": ["agent_id_1", "agent_id_2"],
       "multimodal": {
         "text": "可选的额外文本",
         "image_url": "上传的图片URL",
         "audio_url": "上传的音频URL"
       },
       "is_custom": true
     }
   - 响应：`{success: true, message: "...", event: {...}}`
   - 验证：
     - 必须有event_type和severity
     - 必须至少有description、image_url或audio_url之一
     - 广播事件到所有智能体或指定接收者

#### 功能特性

- **媒体管理**：文件保存在`./uploads/environment_media/`
- **UUID文件名**：确保文件名唯一性和安全性
- **MIME类型验证**：严格验证文件类型
- **多模态支持**：事件可以包含文本、图片和音频的任意组合
- **接收者指定**：支持广播到所有智能体或指定特定接收者
- **通知模式**：支持`notice_only`标志用于不触发系统级响应的事件

## 数据流

### 系统建议事件流
```
用户点击"环境事件"按钮
    ↓
检查是否有可用建议
    ↓
显示对话框（系统建议选项卡）
    ↓
用户选择建议并应用 或 手动创建自定义事件
    ↓
广播到智能体
```

### 自定义事件创建流
```
用户点击"自定义事件"选项卡
    ↓
填写事件详情（类型、严重程度、描述）
    ↓
可选：上传媒体（图片/音频）
    ↓
可选：选择特定接收者
    ↓
点击"创建事件"
    ↓
POST /events/custom-environment
    ↓
广播事件到智能体
    ↓
显示成功提示
```

## 使用场景

### 场景1：快速响应
主持人可以迅速创建和注入环境事件，模拟突发情况。

### 场景2：特定干预
通过选择特定接收者，可以向某些智能体注入定向信息。

### 场景3：多模态信息传递
可以为事件添加图片（如灾难现场照片）和音频（如紧急通知），提高沉浸感。

### 场景4：实验设计
研究人员可以通过自定义事件创建受控的实验干预。

## 技术细节

### 前端架构
- **状态管理**：Zustand（useSimulationStore）
- **UI组件**：选项卡界面、表单、文件上传
- **API通信**：Axios客户端
- **国际化**：react-i18next（中英文）

### 后端架构
- **框架**：Litestar（异步API框架）
- **文件处理**：多部分表单解析、文件验证和保存
- **事件广播**：reuse existing `broadcast_environment_event()`
- **错误处理**：HTTP异常和详细的错误消息

## 未来扩展

1. **视频支持**：扩展多模态以支持视频文件
2. **事件模板**：预设常见事件类型的模板
3. **事件历史**：记录和重放已应用的事件
4. **高级接收者筛选**：基于角色、属性等更复杂的接收者选择
5. **事件调度**：计划在未来回合执行事件
6. **条件触发**：基于模拟状态条件触发事件

## 测试建议

1. 测试所有事件类型和严重程度的组合
2. 验证多模态文件上传（各种格式）
3. 测试指定接收者的事件广播
4. 验证通知模式不触发系统级响应
5. 测试文件大小限制
6. 验证国际化文本显示正确
