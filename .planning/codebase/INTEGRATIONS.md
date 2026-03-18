# External Integrations

**Analysis Date:** 2026-03-18

## APIs & External Services

**LLM Providers:**
- OpenAI API - GPT models for agent reasoning
  - SDK: `openai` Python package
  - Implementation: `src/socialsim4/core/llm/providers/openai.py`
  - Config: API key, base URL, model name
  - Environment: `OPENAI_API_KEY` or provider config in database

- Google Gemini - Gemini models for agent reasoning
  - SDK: `google-generativeai` Python package
  - Implementation: `src/socialsim4/core/llm/providers/gemini.py`
  - Config: API key, model name
  - Environment: Provider config in database

- Ollama - Local LLM server
  - SDK: HTTP client to Ollama API
  - Implementation: `src/socialsim4/core/llm/providers/ollama.py`
  - Config: Base URL (default: http://127.0.0.1:11434), model name
  - Environment: Provider config in database

- Mock - Testing/offline mode
  - Implementation: `src/socialsim4/core/llm/providers/mock.py`
  - No external dependencies

**Search Providers:**
- DuckDuckGo - Free web search
  - SDK: `duckduckgo-search` Python package
  - Implementation: `src/socialsim4/core/tools/web/search.py`
  - Config: Region, safesearch settings
  - Environment: Search provider config in database

- SerpApi - Google search API
  - SDK: `httpx` HTTP client
  - Implementation: `src/socialsim4/core/tools/web/search.py`
  - Auth: `api_key` required
  - Environment: `SERPAPI_API_KEY` or provider config

- Serper - Google search API
  - SDK: `httpx` HTTP client
  - Implementation: `src/socialsim4/core/tools/web/search.py`
  - Auth: `X-API-KEY` header
  - Environment: Provider config in database

- Tavily - AI-powered search
  - SDK: `httpx` HTTP client
  - Implementation: `src/socialsim4/core/tools/web/search.py`
  - Auth: `api_key` required
  - Environment: `TAVILY_API_KEY` or provider config

**Web Content:**
- Trafilatura - Web page content extraction
  - Package: `trafilatura`
  - Implementation: `src/socialsim4/core/tools/web/view.py`
  - Purpose: Extract main content from web pages

## Data Storage

**Databases:**
- SQLite (default)
  - Connection: `sqlite+aiosqlite:///./socialsim4.db`
  - ORM: SQLAlchemy
  - Client: aiosqlite
  - Config: `SOCIALSIM4_DATABASE_URL`

- PostgreSQL (production)
  - Connection: `postgresql+asyncpg://...`
  - ORM: SQLAlchemy
  - Client: psycopg with async support
  - Config: `SOCIALSIM4_DATABASE_URL`

- Alembic - Database migrations
  - Location: `src/socialsim4/backend/migrations/`

**File Storage:**
- Local filesystem - Primary storage
  - Directory: `uploads/` (configurable via `SOCIALSIM4_UPLOAD_DIR`)
  - Serving: `/uploads` route
  - Config: Cloud base URL support available

**Vector Store:**
- ChromaDB (optional)
  - Purpose: RAG document similarity search
  - Implementation: `src/socialsim4/backend/services/vector_store.py`
  - Config: `SOCIALSIM4_USE_CHROMADB`, `SOCIALSIM4_CHROMADB_PERSIST_DIR`
  - Fallback: In-memory JSON cosine similarity

- sentence-transformers - Embeddings
  - Model: MiniLM (default)
  - Purpose: Generate embeddings for RAG

**Caching:**
- Not implemented (no Redis caching layer yet)

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication
  - Implementation: `src/socialsim4/backend/core/security.py`
  - Token library: python-jose
  - Password hashing: bcrypt
  - Signing key: `SOCIALSIM4_JWT_SIGNING_KEY`
  - Token expiry: 15 min access, 14 days refresh

**Email Verification:**
- Optional email verification flow
  - SMTP support via `SOCIALSIM4_EMAIL_SMTP_*` vars
  - Implementation: `src/socialsim4/backend/services/email.py`

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry or similar integration)

**Logs:**
- Python standard logging
- Console output for development
- No centralized logging configured

**LLM Usage Tracking:**
- Database table: `llm_usage`
  - Tracks token usage, costs, model info
  - Implementation: `src/socialsim4/backend/models/llm_usage.py`

## CI/CD & Deployment

**Hosting:**
- Self-hosted (no cloud platform specified)

**CI Pipeline:**
- None detected (no GitHub Actions, GitLab CI, etc.)

**Task Queue:**
- Celery 5.3.0
  - Implementation: `src/socialsim4/backend/celery_app.py`
  - Broker: Redis
  - Config: `SOCIALSIM4_REDIS_URL` or `REDIS_URL`

## Environment Configuration

**Required env vars:**
- `SOCIALSIM4_JWT_SIGNING_KEY` - JWT token signing (default: "change-me")
- `SOCIALSIM4_DATABASE_URL` - Database connection (default: SQLite)

**Optional env vars:**
- `SOCIALSIM4_REDIS_URL` / `REDIS_URL` - Redis connection for Celery
- `SOCIALSIM4_USE_CHROMADB` - Enable ChromaDB vector store
- `SOCIALSIM4_CHROMADB_PERSIST_DIR` - ChromaDB storage path
- `SOCIALSIM4_UPLOAD_DIR` - File upload directory
- `SOCIALSIM4_REQUIRE_EMAIL_VERIFICATION` - Enable email verification
- `SOCIALSIM4_EMAIL_SMTP_*` - SMTP configuration for emails

**Secrets location:**
- Environment variables (.env file)
- Database: Provider API keys stored in `providers` table

## Webhooks & Callbacks

**Incoming:**
- WebSocket endpoints for real-time simulation updates
  - Implementation: `src/socialsim4/backend/api/routes/simulations/websocket_handlers.py`
  - Purpose: Live simulation state streaming

**Outgoing:**
- None detected (no external webhooks configured)

## Internationalization

**Backend:**
- Custom i18n implementation
  - Location: `src/socialsim4/i18n.py`
  - Languages: English (en), Chinese (zh)
  - Locale files: `src/socialsim4/locales/{en,zh}.json`
  - Function: `T(key, locale=None, **kwargs)`

**Frontend:**
- i18next + react-i18next
  - Locale files: `frontend/locales/{en,zh}.json`
  - Hook: `useTranslation()`

---
