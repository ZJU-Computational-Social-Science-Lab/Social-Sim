# LLM 模型管理 - 后端实现指南

## 🎯 快速概览

前端已完全实现 LLM 配置与测试控制台，需要后端实现模型(Model)管理的 6 个核心 API 端点。本指南提供参考实现。

## 📋 API 规范

### 1. 列表模型 | GET /api/models

**功能**：获取所有模型，支持过滤和排序

**请求**:
```http
GET /api/models?provider_id=1&enabled=true&limit=100&offset=0
```

**查询参数**:
- `provider_id` (optional): 按 Provider 过滤
- `enabled` (optional): true|false 按启用状态过滤
- `capability` (optional): 按能力过滤（text|vision|audio|json|function_call|reasoning）
- `limit` (default: 100): 分页大小
- `offset` (default: 0): 分页偏移

**响应** (200):
```json
{
  "data": [
    {
      "id": "model_1",
      "displayName": "GPT-4 Turbo",
      "modelId": "gpt-4-turbo-2024-04-09",
      "providerId": 1,
      "protocolType": "openai",
      "capabilities": ["text", "vision", "json"],
      "contextWindow": 128000,
      "inputPrice": 0.01,
      "outputPrice": 0.03,
      "tags": ["latest", "production"],
      "enabled": true,
      "isDefault": true,
      "lastTestedAt": "2026-04-20T10:30:00Z",
      "lastTestStatus": "success"
    }
  ],
  "total": 45
}
```

### 2. 创建模型 | POST /api/models

**功能**：创建单个模型

**请求**:
```json
{
  "displayName": "Claude 3 Opus",
  "modelId": "claude-3-opus-20240229",
  "providerId": 2,
  "protocolType": "anthropic",
  "capabilities": ["text"],
  "contextWindow": 200000,
  "inputPrice": 0.015,
  "outputPrice": 0.075,
  "tags": ["claude", "high-performance"],
  "enabled": true,
  "isDefault": false
}
```

**响应** (201):
```json
{
  "data": {
    "id": "model_2",
    "displayName": "Claude 3 Opus",
    "modelId": "claude-3-opus-20240229",
    "providerId": 2,
    "protocolType": "anthropic",
    "capabilities": ["text"],
    "contextWindow": 200000,
    "inputPrice": 0.015,
    "outputPrice": 0.075,
    "tags": ["claude", "high-performance"],
    "enabled": true,
    "isDefault": false,
    "createdAt": "2026-04-20T10:30:00Z"
  }
}
```

**错误** (400):
```json
{
  "error": "Model ID already exists",
  "code": "DUPLICATE_MODEL_ID"
}
```

### 3. 更新模型 | PATCH /api/models/{id}

**功能**：更新模型（支持部分字段更新）

**请求**:
```json
{
  "displayName": "GPT-4 Turbo Updated",
  "enabled": true,
  "inputPrice": 0.01,
  "outputPrice": 0.03,
  "tags": ["latest", "production", "updated"]
}
```

**响应** (200):
```json
{
  "data": {
    "id": "model_1",
    "displayName": "GPT-4 Turbo Updated",
    "modelId": "gpt-4-turbo-2024-04-09",
    "providerId": 1,
    "protocolType": "openai",
    "capabilities": ["text", "vision", "json"],
    "contextWindow": 128000,
    "inputPrice": 0.01,
    "outputPrice": 0.03,
    "tags": ["latest", "production", "updated"],
    "enabled": true,
    "isDefault": true,
    "updatedAt": "2026-04-20T10:35:00Z"
  }
}
```

**错误** (404):
```json
{
  "error": "Model not found",
  "code": "MODEL_NOT_FOUND"
}
```

### 4. 删除模型 | DELETE /api/models/{id}

**功能**：删除模型

**请求**:
```http
DELETE /api/models/model_1
```

**响应** (200):
```json
{
  "message": "Model deleted successfully"
}
```

**错误** (404):
```json
{
  "error": "Model not found",
  "code": "MODEL_NOT_FOUND"
}
```

### 5. 批量创建模型 | POST /api/models/batch

**功能**：一次性创建多个模型

**请求**:
```json
{
  "models": [
    {
      "displayName": "GPT-4",
      "modelId": "gpt-4",
      "providerId": 1,
      "protocolType": "openai",
      "capabilities": ["text", "vision"],
      "contextWindow": 8000,
      "inputPrice": 0.03,
      "outputPrice": 0.06,
      "enabled": true
    },
    {
      "displayName": "GPT-3.5 Turbo",
      "modelId": "gpt-3.5-turbo",
      "providerId": 1,
      "protocolType": "openai",
      "capabilities": ["text"],
      "contextWindow": 4000,
      "inputPrice": 0.0015,
      "outputPrice": 0.002,
      "enabled": true
    }
  ]
}
```

**响应** (201):
```json
{
  "data": [
    {
      "id": "model_3",
      "displayName": "GPT-4",
      "modelId": "gpt-4",
      ...
    },
    {
      "id": "model_4",
      "displayName": "GPT-3.5 Turbo",
      "modelId": "gpt-3.5-turbo",
      ...
    }
  ],
  "created": 2,
  "failed": 0
}
```

**错误处理** (207 Multi-Status):
```json
{
  "data": [
    {
      "id": "model_3",
      "displayName": "GPT-4",
      ...
    }
  ],
  "errors": [
    {
      "index": 1,
      "error": "Model ID 'gpt-3.5-turbo' already exists",
      "code": "DUPLICATE_MODEL_ID"
    }
  ],
  "created": 1,
  "failed": 1
}
```

### 6. 测试模型 | POST /api/models/{id}/test

**功能**：测试模型连接和响应

**请求**:
```json
{
  "systemPrompt": "You are a helpful assistant.",
  "userPrompt": "Say hello!",
  "temperature": 0.7,
  "maxTokens": 100,
  "responseFormat": "text"
}
```

**响应** (200):
```json
{
  "data": {
    "success": true,
    "responseTime": 523,
    "tokensUsed": {
      "prompt": 15,
      "completion": 10,
      "total": 25
    },
    "content": "Hello! How can I help you today?",
    "timestamp": "2026-04-20T10:40:00Z"
  }
}
```

**错误** (503):
```json
{
  "data": {
    "success": false,
    "error": "Connection timeout",
    "errorCode": "TIMEOUT",
    "timestamp": "2026-04-20T10:40:00Z"
  }
}
```

## 🗄️ 数据库模型

### Models 表结构

```sql
CREATE TABLE models (
  id VARCHAR(36) PRIMARY KEY,
  display_name VARCHAR(255) NOT NULL,
  model_id VARCHAR(255) NOT NULL UNIQUE,
  provider_id INT NOT NULL,
  protocol_type VARCHAR(50) NOT NULL DEFAULT 'openai',
  capabilities JSON NOT NULL DEFAULT '[]',
  context_window INT NOT NULL DEFAULT 4096,
  input_price DECIMAL(10, 6) DEFAULT NULL,
  output_price DECIMAL(10, 6) DEFAULT NULL,
  tags JSON DEFAULT '[]',
  enabled BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  last_tested_at TIMESTAMP NULL,
  last_test_status VARCHAR(20) NULL,
  custom_metadata JSON DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
  INDEX idx_provider_id (provider_id),
  INDEX idx_enabled (enabled),
  INDEX idx_model_id (model_id)
);
```

## 🏗️ 示例实现（Python FastAPI）

### 类型定义

```python
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class ModelCapability(str, Enum):
    TEXT = "text"
    VISION = "vision"
    AUDIO = "audio"
    JSON = "json"
    FUNCTION_CALL = "function_call"
    REASONING = "reasoning"

class ModelRecord(BaseModel):
    id: Optional[str] = None
    displayName: str
    modelId: str
    providerId: int
    protocolType: str = "openai"
    capabilities: List[ModelCapability] = ["text"]
    contextWindow: int = 4096
    inputPrice: Optional[float] = None
    outputPrice: Optional[float] = None
    tags: List[str] = []
    enabled: bool = True
    isDefault: bool = False
    lastTestedAt: Optional[datetime] = None
    lastTestStatus: Optional[str] = None
    customMetadata: Optional[dict] = None

class TestModelRequest(BaseModel):
    systemPrompt: str = "You are a helpful assistant."
    userPrompt: str
    temperature: float = 0.7
    maxTokens: int = 500
    responseFormat: str = "text"

class TestModelResponse(BaseModel):
    success: bool
    responseTime: int  # milliseconds
    tokensUsed: Optional[dict] = None
    content: Optional[str] = None
    error: Optional[str] = None
```

### 路由实现

```python
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select, insert, update, delete

router = APIRouter(prefix="/api/models", tags=["models"])

# GET /api/models
@router.get("")
async def list_models(
    provider_id: Optional[int] = Query(None),
    enabled: Optional[bool] = Query(None),
    capability: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0)
):
    query = select(ModelRecord)
    
    if provider_id:
        query = query.where(ModelRecord.provider_id == provider_id)
    if enabled is not None:
        query = query.where(ModelRecord.enabled == enabled)
    if capability:
        query = query.where(ModelRecord.capabilities.contains(capability))
    
    total = await db.scalar(select(func.count()).select_from(ModelRecord).where(*query.whereclause.clauses))
    models = await db.execute(query.limit(limit).offset(offset))
    
    return {"data": models.scalars().all(), "total": total}

# POST /api/models
@router.post("", status_code=201)
async def create_model(payload: ModelRecord):
    existing = await db.execute(
        select(ModelRecord).where(ModelRecord.model_id == payload.modelId)
    )
    if existing.scalar():
        raise HTTPException(status_code=400, detail="Model ID already exists")
    
    model = ModelRecord(id=uuid4(), **payload.dict())
    db.add(model)
    await db.commit()
    return {"data": model}

# PATCH /api/models/{id}
@router.patch("/{model_id}")
async def update_model(model_id: str, payload: ModelRecord):
    model = await db.get(ModelRecord, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    for key, value in payload.dict(exclude_unset=True).items():
        setattr(model, key, value)
    
    await db.commit()
    return {"data": model}

# DELETE /api/models/{id}
@router.delete("/{model_id}")
async def delete_model(model_id: str):
    model = await db.get(ModelRecord, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    await db.delete(model)
    await db.commit()
    return {"message": "Model deleted successfully"}

# POST /api/models/batch
@router.post("/batch", status_code=201)
async def batch_create_models(payload: dict):
    models_data = payload.get("models", [])
    created = []
    errors = []
    
    for idx, model_data in enumerate(models_data):
        try:
            existing = await db.execute(
                select(ModelRecord).where(ModelRecord.model_id == model_data["modelId"])
            )
            if existing.scalar():
                raise ValueError("Model ID already exists")
            
            model = ModelRecord(id=str(uuid4()), **model_data)
            db.add(model)
            created.append(model)
        except Exception as e:
            errors.append({"index": idx, "error": str(e)})
    
    await db.commit()
    return {
        "data": created,
        "errors": errors,
        "created": len(created),
        "failed": len(errors)
    }

# POST /api/models/{id}/test
@router.post("/{model_id}/test")
async def test_model(model_id: str, payload: TestModelRequest):
    model = await db.get(ModelRecord, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    provider = await db.get(Provider, model.provider_id)
    start = time.time()
    
    try:
        response = await call_llm_provider(
            provider=provider,
            model=model.model_id,
            system_prompt=payload.systemPrompt,
            user_prompt=payload.userPrompt,
            temperature=payload.temperature,
            max_tokens=payload.maxTokens
        )
        
        response_time = int((time.time() - start) * 1000)
        
        # Update model test status
        model.last_tested_at = datetime.now(timezone.utc)
        model.last_test_status = "success"
        await db.commit()
        
        return {
            "data": {
                "success": True,
                "responseTime": response_time,
                "tokensUsed": response.get("usage"),
                "content": response.get("content"),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        }
    except Exception as e:
        response_time = int((time.time() - start) * 1000)
        
        model.last_tested_at = datetime.now(timezone.utc)
        model.last_test_status = "failed"
        await db.commit()
        
        return {
            "data": {
                "success": False,
                "error": str(e),
                "errorCode": type(e).__name__,
                "responseTime": response_time,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        }
```

## 🔐 权限检查

建议在所有端点上添加认证和权限检查：

```python
from fastapi import Depends

async def verify_token(token: str = Depends(oauth2_scheme)) -> User:
    # 验证 JWT token
    ...

@router.get("", dependencies=[Depends(verify_token)])
async def list_models(...):
    # 仅返回用户有权访问的模型
    ...
```

## ✅ 测试清单

- [ ] POST /api/models - 创建单个模型
- [ ] GET /api/models - 列表查询和过滤
- [ ] PATCH /api/models/{id} - 部分更新
- [ ] DELETE /api/models/{id} - 删除
- [ ] POST /api/models/batch - 批量创建
- [ ] POST /api/models/{id}/test - 测试连接
- [ ] 验证 Provider 外键约束
- [ ] 验证 modelId 唯一性
- [ ] 验证分页和过滤
- [ ] 验证权限检查（如适用）

## 🚀 集成步骤

1. **定义模型**：在数据模型中添加 Model 类
2. **创建表**：运行迁移脚本创建 models 表
3. **实现路由**：根据上述示例添加 6 个端点
4. **测试**：使用前端控制台验证每个端点
5. **部署**：提交代码并发布到生产环境

---

**状态**: 准备实现 ✅
**完成度**: 规范 100%
**示例代码**: FastAPI 完整参考实现
