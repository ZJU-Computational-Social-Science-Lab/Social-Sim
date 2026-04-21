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
│   ├── backend/       # Litestar web service
│   ├── core/          # Simulation core engine
│   ├── scenarios/     # Preset scenarios
│   └── services/      # Service layer
├── scripts/           # Utility scripts
└── tests/             # Tests
```

### Quick Start

This section is the verified startup path for this repository on Windows.

#### 1. First-Time Setup (Windows PowerShell)

```powershell
cd C:\Users\Guo\Documents\GitHub\Social-Sim1

# If .venv does not exist, create it once
py -3.11 -m venv .venv

# Install backend dependencies into .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

# Install frontend dependencies
cd frontend
npm install
cd ..
```

#### 2. Configure Environment Variables (once)

Copy `.env.example` to `.env` and modify as needed:

```powershell
Copy-Item .env.example .env
```

Key configuration options:
- `SOCIALSIM4_DATABASE_URL`: Database connection (default: SQLite)
- `SOCIALSIM4_JWT_SIGNING_KEY`: JWT signing key
- `SOCIALSIM4_REQUIRE_EMAIL_VERIFICATION`: Email verification required (set to `false` for development)

#### 3. Daily Start (Windows PowerShell)

Open two PowerShell terminals.

Terminal 1 (Backend, port 8000):

```powershell
cd C:\Users\Guo\Documents\GitHub\Social-Sim1
$env:PYTHONPATH = "$PWD\src"
.\.venv\Scripts\python.exe -m uvicorn socialsim4.backend.main:app --host 0.0.0.0 --port 8000 --reload
```

Terminal 2 (Frontend, port 5173):

```powershell
cd C:\Users\Guo\Documents\GitHub\Social-Sim1\frontend
npm run dev
```

Stop services: press `Ctrl + C` in each terminal.

#### 4. Troubleshooting

- If backend reports `ModuleNotFoundError: socialsim4`, make sure `PYTHONPATH` is set to `$PWD\src` in the same terminal before running uvicorn.
- If frontend reports missing packages, run `cd frontend; npm install` once.
- If port is occupied, change `--port 8000` (backend) or edit frontend dev port in `frontend/package.json`.

#### 5. Access

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
│   ├── backend/       # Litestar Web 服务
│   ├── core/          # 仿真核心引擎
│   ├── scenarios/     # 预设场景
│   └── services/      # 服务层
├── scripts/           # 辅助脚本
└── tests/             # 测试
```

### 快速启动

本节是该仓库在 Windows 上实测可运行的启动路径。

#### 1. 首次准备（Windows PowerShell）

```powershell
cd C:\Users\Guo\Documents\GitHub\Social-Sim1

# 如果 .venv 不存在，首次创建
py -3.11 -m venv .venv

# 把后端依赖安装到 .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

# 安装前端依赖
cd frontend
npm install
cd ..
```

#### 2. 配置环境变量（首次一次）

复制 `.env.example` 为 `.env`，按需修改：

```powershell
Copy-Item .env.example .env
```

主要配置项：
- `SOCIALSIM4_DATABASE_URL`: 数据库连接（默认 SQLite）
- `SOCIALSIM4_JWT_SIGNING_KEY`: JWT 签名密钥
- `SOCIALSIM4_REQUIRE_EMAIL_VERIFICATION`: 是否需要邮箱验证（开发时设为 `false`）

#### 3. 每次启动（Windows PowerShell）

**Windows 每次启动（推荐）**

打开两个 PowerShell 终端。

终端 1（后端，8000 端口）：

```powershell
cd C:\Users\Guo\Documents\GitHub\Social-Sim1
$env:PYTHONPATH = "$PWD\src"
.\.venv\Scripts\python.exe -m uvicorn socialsim4.backend.main:app --host 0.0.0.0 --port 8000 --reload
```

终端 2（前端，5173 端口）：

```powershell
cd C:\Users\Guo\Documents\GitHub\Social-Sim1\frontend
npm run dev
```

停止服务：分别在两个终端按 `Ctrl + C`。

#### 4. 常见问题

- 如果后端报 `ModuleNotFoundError: socialsim4`，确认在同一个终端先设置了 `$env:PYTHONPATH = "$PWD\src"` 再启动。
- 如果前端报缺包，执行一次 `cd frontend; npm install`。
- 如果端口冲突，后端改 `--port 8000`，前端改 `frontend/package.json` 里的 dev 端口。

#### 5. 访问

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


