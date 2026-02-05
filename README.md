# SocialSim4

**English** | [中文](#中文版)

---

## English Version

A social simulation platform - LLM-based multi-agent social simulation system.

### Project Structure

```
socialsim4/
├── frontend/          # React + TypeScript frontend
├── src/socialsim4/    # Python backend
│   ├── backend/       # FastAPI/Litestar web service
│   ├── core/          # Simulation core engine
│   ├── scenarios/     # Preset scenarios
│   └── services/      # Service layer
├── scripts/           # Utility scripts
└── tests/             # Tests
```

### Quick Start

#### 1. Environment Setup

```bash
# Create conda environment
conda create -n socialsim4 python=3.11 -y
conda activate socialsim4

# Install backend dependencies (Option A: pip)
pip install -r requirements.txt

# Install backend dependencies (Option B: Poetry)
pip install poetry
poetry install

# Install frontend dependencies
cd frontend && npm install && cd ..
```

#### 2. Configure Environment Variables

Copy `.env.example` to `.env` and modify as needed:

```bash
cp .env.example .env
```

Key configuration options:
- `SOCIALSIM4_DATABASE_URL`: Database connection (default: SQLite)
- `SOCIALSIM4_JWT_SIGNING_KEY`: JWT signing key
- `SOCIALSIM4_REQUIRE_EMAIL_VERIFICATION`: Email verification required (set to `false` for development)

#### 3. Start Services

**Start Backend** (port 8000):

```bash
conda activate socialsim4
```

Set the Python path based on your operating system:

**Linux / macOS:**
```bash
export PYTHONPATH="$(pwd)/src"
uvicorn socialsim4.backend.main:app --host 0.0.0.0 --port 8000 --reload
```

**Windows PowerShell:**
```powershell
$env:PYTHONPATH = "$(Get-Location)\src"
uvicorn socialsim4.backend.main:app --host 0.0.0.0 --port 8000 --reload
```

**Windows Command Prompt:**
```cmd
set PYTHONPATH=%cd%\src
uvicorn socialsim4.backend.main:app --host 0.0.0.0 --port 8000 --reload
```

**Start Frontend** (port 5173):
```bash
cd frontend
npm run dev
```

#### 4. Access

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api
- API Documentation: http://localhost:8000/schema/swagger

### Usage

1. Register an account and log in
2. Go to "Settings → LLM Providers" to add your API Key 
3. Click "New Simulation" to create a simulation
4. In the simulation interface, advance nodes, create branches, and view logs

### Dynamic Environment Events

The simulation can suggest environmental events based on recent activity, adding contextual events that agents can react to:

- **Weather Changes**: Rain, storms, snow, temperature shifts
- **Emergencies**: Fire, power outage, medical emergencies, accidents
- **Notifications**: Government announcements, policy changes, school closures
- **Public Opinion**: Rumors spreading, sentiment shifts, trending topics

**How it works:**
- Suggestions are offered every 5 turns during simulation
- An "Environment Events Available" indicator appears when suggestions are ready
- Click the indicator to view AI-generated suggestions based on recent simulation context
- Apply a suggestion to broadcast it to all agents, who will react naturally based on their personalities
- Events are logged in the timeline with special styling (green/emerald highlighting)

**Configuration:**
The feature can be enabled/disabled per simulation and the turn interval can be customized in the simulation settings.

### Tech Stack

- **Backend**: Python 3.11+, Litestar, SQLAlchemy, Pydantic
- **Frontend**: React 19, TypeScript, Vite, Zustand, TailwindCSS
- **Database**: SQLite (development) / PostgreSQL (production)

### Development

See [AGENTS.md](./AGENTS.md) for project architecture and coding conventions.

---

## 中文版

[English](#english-version) | **中文**

社会仿真平台 - 基于 LLM 的多智能体社会模拟系统。

### 项目结构

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

### 快速启动

#### 1. 环境准备

```bash
# 创建 conda 环境
conda create -n socialsim4 python=3.11 -y
conda activate socialsim4

# 安装后端依赖（方式 A：pip）
pip install -r requirements.txt

# 安装后端依赖（方式 B：Poetry）
pip install poetry
poetry install

# 安装前端依赖
cd frontend && npm install && cd ..
```

#### 2. 配置环境变量

复制 `.env.example` 为 `.env`，按需修改：

```bash
cp .env.example .env
```

主要配置项：
- `SOCIALSIM4_DATABASE_URL`: 数据库连接（默认 SQLite）
- `SOCIALSIM4_JWT_SIGNING_KEY`: JWT 签名密钥
- `SOCIALSIM4_REQUIRE_EMAIL_VERIFICATION`: 是否需要邮箱验证（开发时设为 `false`）

#### 3. 启动服务

**启动后端**（端口 8000）：

```bash
conda activate socialsim4
```

根据操作系统设置 Python 路径：

**Linux / macOS：**
```bash
export PYTHONPATH="$(pwd)/src"
uvicorn socialsim4.backend.main:app --host 0.0.0.0 --port 8000 --reload
```

**Windows PowerShell：**
```powershell
$env:PYTHONPATH = "$(Get-Location)\src"
uvicorn socialsim4.backend.main:app --host 0.0.0.0 --port 8000 --reload
```

**Windows 命令提示符：**
```cmd
set PYTHONPATH=%cd%\src
uvicorn socialsim4.backend.main:app --host 0.0.0.0 --port 8000 --reload
```

**启动前端**（端口 5173）：
```bash
cd frontend
npm run dev
```

#### 4. 访问

- 前端: http://localhost:5173
- 后端 API: http://localhost:8000/api
- API 文档: http://localhost:8000/schema/swagger

### 使用流程

1. 注册账号并登录
2. 在「设置 → LLM 提供商」中添加 API Key
3. 点击「新建模拟」创建仿真
4. 在仿真界面中推进节点、创建分支、查看日志

### 技术栈

- **后端**: Python 3.11+, Litestar, SQLAlchemy, Pydantic
- **前端**: React 19, TypeScript, Vite, Zustand, TailwindCSS
- **数据库**: SQLite (开发) / PostgreSQL (生产)

### 开发说明

详见 [AGENTS.md](./AGENTS.md) 了解项目架构和编码规范。


