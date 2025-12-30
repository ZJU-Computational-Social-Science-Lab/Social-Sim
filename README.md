# SocialSim4

社会仿真平台 - 基于 LLM 的多智能体社会模拟系统。

## 项目结构

```
socialsim4/
├── frontend/          # React + TypeScript 前端
├── src/socialsim4/    # Python 后端
│   ├── backend/       # FastAPI/Litestar Web 服务
│   ├── core/          # 仿真核心引擎
│   ├── scenarios/     # 预设场景
│   └── services/      # 服务层
├── scripts/           # 辅助脚本
└── tests/             # 测试
```

## 快速启动

### 1. 环境准备

```bash
# 创建 conda 环境
conda create -n socialsim4 python=3.11 -y
conda activate socialsim4

# 安装后端依赖
pip install uvicorn litestar sqlalchemy pydantic pydantic-settings httpx aiosqlite openai google-generativeai bcrypt python-jose email-validator

# 安装前端依赖
cd frontend && npm install && cd ..
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，按需修改：

```bash
cp .env.example .env
```

主要配置项：
- `SOCIALSIM4_DATABASE_URL`: 数据库连接（默认 SQLite）
- `SOCIALSIM4_JWT_SIGNING_KEY`: JWT 签名密钥
- `SOCIALSIM4_REQUIRE_EMAIL_VERIFICATION`: 是否需要邮箱验证（开发时设为 false）

### 3. 启动服务

**启动后端** (端口 8000)：
```bash
conda activate socialsim4
export PYTHONPATH="$(pwd)/src"
uvicorn socialsim4.backend.main:app --host 0.0.0.0 --port 8000 --reload
```

**启动前端** (端口 5173)：
```bash
cd frontend
npm run dev
```

### 4. 访问

- 前端: http://localhost:5173
- 后端 API: http://localhost:8000/api
- API 文档: http://localhost:8000/schema/swagger

## 使用流程

1. 注册账号并登录
2. 在「设置 → LLM 提供商」中添加 API Key（OpenAI/Gemini/Claude 等）
3. 点击「新建模拟」创建仿真
4. 在仿真界面中推进节点、创建分支、查看日志

## 技术栈

- **后端**: Python 3.11+, Litestar, SQLAlchemy, Pydantic
- **前端**: React 19, TypeScript, Vite, Zustand, TailwindCSS
- **数据库**: SQLite (开发) / PostgreSQL (生产)

## 开发说明

详见 [AGENTS.md](./AGENTS.md) 了解项目架构和编码规范。

## 版权
© 2025 liiivan2. All rights reserved. This code is for viewing only.
