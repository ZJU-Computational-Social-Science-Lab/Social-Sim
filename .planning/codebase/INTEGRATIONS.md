# External Integrations

**Analysis Date:** 2026-03-08

## APIs & External Services

**LLM Providers:**
- **OpenAI** - GPT models for agent reasoning and simulation
  - SDK/Client: `openai` Python package 1.58.1+
  - Implementation: `src/socialsim4/core/llm/providers/openai.py`
  - Supports: Chat, completion, embedding APIs
  - Features: Vision/multimodal support, JSON mode with fallback

- **Google Gemini** - Google's LLM models
  - SDK/Client: `google-generativeai` Python package 0.7.2+
  - Implementation: `src/socialsim4/core/llm/providers/gemini.py`
  - Supports: Chat, completion, embedding APIs
  - Features: Vision support, JSON mode

- **Ollama** - Local LLM hosting
  - SDK/Client: HTTP-based (via `httpx`)
  - Implementation: `src/socialsim4/core/llm/providers/ollama.py`
  - Supports: Chat, completion, embedding APIs
  - Features: OpenAI-compatible endpoint support, JSON mode with fallback

**Search Providers:**
- **DuckDuckGo** - Free web search (no API key)
  - SDK/Client: `duckduckgo-search` Python package 7.3.2+
  - Implementation: `src/socialsim4/core/tools/web/search.py` (DDGSearchClient)
  - Use case: Default search provider for agent web tools

- **SerpApi** - Google search via API
  - SDK/Client: Custom HTTP client via `httpx`
  - Implementation: `src/socialsim4/core/tools/web/search.py` (SerpApiSearchClient)
  - Auth: `api_key` in SearchConfig
  - Use case: Google search results with API

- **Serper** - Google search via API
  - SDK/Client: Custom HTTP client via `httpx`
  - Implementation: `src/socialsim4/core/tools/web/search.py` (SerperSearchClient)
  - Auth: `X-API-KEY` header
  - Use case: Alternative Google search API

- **Tavily** - AI-optimized search API
  - SDK/Client: Custom HTTP client via `httpx`
  - Implementation: `src/socialsim4/core/tools/web/search.py` (TavilySearchClient)
  - Auth: `api_key` in request payload
  - Use case: Search with advanced options (depth, domains, etc.)

**Web Content Extraction:**
- **Trafilatura** - Web page content extraction
  - Package: `trafilatura` 1.12.2+
  - Implementation: `src/socialsim4/core/tools/web/view.py`
  - Use case: Extract main content from web pages for agent knowledge

## Data Storage

**Databases:**
- **SQLite (aiosqlite)**
  - Connection: `sqlite+aiosqlite:///./socialsim4.db` (default)
  - Client: SQLAlchemy 2.0.23+ async ORM
  - Implementation: `src/socialsim4/backend/core/database.py`
  - Use case: Default development database, embedded in backend

- **PostgreSQL**
  - Connection: `postgresql+asyncpg://...` (optional)
  - Client: SQLAlchemy 2.0.23+ async ORM with `psycopg` binary driver
  - Implementation: `src/socialsim4/backend/core/database.py`
  - Use case: Production database for multi-instance deployments

**File Storage:**
- **Local filesystem**
  - Upload directory: `uploads/` (configurable via `SOCIALSIM4_UPLOAD_DIR`)
  - Implementation: `src/socialsim4/backend/main.py` (static file router)
  - Served at: `/uploads` path
  - Use case: Document uploads, agent knowledge files

- **Cloud storage (optional)**
  - Backend: Configurable via `SOCIALSIM4_UPLOAD_BACKEND=cloud`
  - Implementation: Writes to mounted directory with cloud URL return
  - Use case: S3-compatible bucket mounting for distributed deployments

**Vector Store (Optional):**
- **ChromaDB**
  - Package: `chromadb` 0.4.0+ (optional dependency)
  - Implementation: `src/socialsim4/backend/services/vector_store.py`
  - Config: `SOCIALSIM4_USE_CHROMADB=true`
  - Persist dir: `SOCIALSIM4_CHROMADB_PERSIST_DIR` (default: `./chroma_db`)
  - Use case: Hybrid vector store for RAG/knowledge base

- **JSON fallback** - In-memory JSON-based vector store
  - Implementation: `src/socialsim4/backend/services/vector_store.py`
  - Use case: Default fallback when ChromaDB is not enabled

**Embeddings:**
- **sentence-transformers**
  - Model: `all-MiniLM-L6-v2` (default)
  - Implementation: `src/socialsim4/backend/services/documents.py`
  - Use case: Local text embedding generation for RAG/knowledge base

**Caching:**
- **Redis**
  - Connection: `redis://localhost:6379/0` (default)
  - Environment: `REDIS_URL` or `SOCIALSIM4_REDIS_URL`
  - Implementation: `src/socialsim4/backend/celery_app.py`
  - Use case: Celery task queue broker for async experiment runs

## Authentication & Identity

**Auth Provider:**
- **Custom JWT-based authentication**
  - Implementation: `src/socialsim4/backend/api/routes/auth.py`
  - JWT signing: `python-jose` with `SOCIALSIM4_JWT_SIGNING_KEY`
  - Algorithm: HS256 (default)
  - Token expiration: Access token 15 min, refresh token 14 days
  - Password hashing: bcrypt 5.0.0+

**Email Verification (Optional):**
- SMTP-based email delivery
  - Config: `SOCIALSIM4_EMAIL_SMTP_HOST`, `SOCIALSIM4_EMAIL_SMTP_PORT`
  - Auth: `SOCIALSIM4_EMAIL_SMTP_USERNAME`, `SOCIALSIM4_EMAIL_SMTP_PASSWORD`
  - Implementation: `src/socialsim4/backend/services/email.py`
  - Use case: User verification emails, password reset

## Monitoring & Observability

**Error Tracking:**
- None (errors handled via Litestar exception handlers)

**Logs:**
- Console/stdout logging
- Implementation: `src/socialsim4/backend/main.py` (internal_error_handler)
- Debug mode: `SOCIALSIM4_DEBUG=true` enables SQLAlchemy query echo

## CI/CD & Deployment

**Hosting:**
- Self-hosted (backend serves frontend static files in production)
- Frontend: Vite build output served via Litestar static file router
- SPA fallback: All non-API routes return `index.html` for client-side routing

**CI Pipeline:**
- None detected (manual deployment)

## Environment Configuration

**Required env vars:**
- `SOCIALSIM4_DATABASE_URL` - Database connection string
- `SOCIALSIM4_JWT_SIGNING_KEY` - Secret for JWT token signing
- `SOCIALSIM4_ALLOWED_ORIGINS` - Comma-separated CORS origins

**Optional env vars:**
- `REDIS_URL` or `SOCIALSIM4_REDIS_URL` - Redis connection for Celery
- `SOCIALSIM4_USE_CHROMADB` - Enable ChromaDB vector store (true/false)
- `SOCIALSIM4_CHROMADB_PERSIST_DIR` - ChromaDB persistence directory
- `SOCIALSIM4_UPLOAD_DIR` - File upload directory (default: "uploads")
- `SOCIALSIM4_UPLOAD_BACKEND` - "local" or "cloud"
- `SOCIALSIM4_EMAIL_SMTP_HOST` - SMTP server for emails
- `SOCIALSIM4_EMAIL_SMTP_PORT` - SMTP port
- `SOCIALSIM4_EMAIL_SMTP_USERNAME` - SMTP username
- `SOCIALSIM4_EMAIL_SMTP_PASSWORD` - SMTP password
- `SOCIALSIM4_DEBUG` - Enable debug mode (true/false)

**LLM Configuration:**
- Stored in database `llm_providers` table
- Per-provider: `dialect`, `api_key`, `base_url`, `model`, `temperature`, etc.
- Implementation: `src/socialsim4/backend/api/routes/providers.py`

**Search Provider Configuration:**
- Stored in database `search_providers` table
- Per-provider: `dialect`, `api_key`, `base_url`, `params`
- Implementation: `src/socialsim4/backend/api/routes/search_providers.py`

**Secrets location:**
- Environment variables (`.env` file, gitignored)
- Database for provider credentials (api_key stored in `llm_providers` and `search_providers` tables)

## Webhooks & Callbacks

**Incoming:**
- None (no webhook endpoints)

**Outgoing:**
- None (no outgoing webhooks)

## WebSocket Connections

**Real-time communication:**
- **Simulation events** - Live simulation progress updates
  - Endpoint: `/api/simulations/{simulation_id}/ws`
  - Implementation: `src/socialsim4/backend/api/routes/simulations/websocket_handlers.py`
  - Use case: Stream agent actions, turn events, simulation status

---

*Integration audit: 2026-03-08*
