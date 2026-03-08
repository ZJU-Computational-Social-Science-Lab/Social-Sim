# Technology Stack

**Analysis Date:** 2026-03-08

## Languages

**Primary:**
- Python 3.11+ - Backend simulation engine and web API (`src/socialsim4/`)

**Secondary:**
- TypeScript 5.8.2 - Frontend UI (`frontend/`)

## Runtime

**Environment:**
- Python 3.12 (project default) - Python 3.14 is not compatible with required packages
- Node.js - Frontend development and build

**Package Manager:**
- Poetry (backend) - Python dependency management
- npm (frontend) - Node.js dependencies
- Lockfile: `poetry.lock` (present), `package-lock.json` (present)

## Frameworks

**Core (Python):**
- Litestar 2.8.3+ - Async web framework for REST API and WebSocket endpoints
- SQLAlchemy 2.0.23+ - Async ORM with SQLite (aiosqlite) and PostgreSQL (psycopg) support
- Pydantic 2.4.2+ - Data validation and settings management
- Uvicorn 0.30.0+ - ASGI server

**Testing (Python):**
- pytest 7.4.3+ - Test runner with async support (pytest-asyncio)
- pytest-cov 4.1.0+ - Coverage reporting
- Litestar testing utilities - TestClient for API testing

**Testing (TypeScript):**
- Vitest 4.0.18+ - Unit and component testing with jsdom environment
- @testing-library/react 16.3.2+ - Component testing utilities
- @testing-library/user-event 14.6.1+ - User interaction simulation

**Build/Dev (Python):**
- ruff 0.1.6+ - Fast Python linter
- mypy 1.6.0+ - Static type checker
- Alembic 1.13.1+ - Database migration tool

**Build/Dev (TypeScript):**
- Vite 6.2.0+ - Build tool and dev server
- @vitejs/plugin-react 5.0.0+ - React support for Vite
- Tailwind CSS 3.4.17+ - Utility-first CSS framework
- Autoprefixer 10.4.20+ - CSS vendor prefixing
- PostCSS 8.4.49+ - CSS transformation

**Frontend Core:**
- React 19.2.0+ - UI library
- React Router DOM 7.9.6+ - Client-side routing
- Zustand 5.0.9+ - State management
- @tanstack/react-query 5.90.11+ - Server state management
- i18next 25.7.1+ - Internationalization
- react-i18next 16.3.5+ - React i18n bindings
- D3.js 7.9.0+ - Data visualization
- ReactFlow 11.11.4+ - Interactive graph/tree visualization
- Recharts 3.5.1+ - Chart components
- Radix UI - Accessible component primitives (dropdown, select, icons)

## Key Dependencies

**Critical (Backend):**
- openai 1.58.1+ - OpenAI API client for LLM integration
- google-generativeai 0.7.2+ - Google Gemini API client
- httpx 0.27.0+ - Async HTTP client for external API calls
- python-jose 3.3.0+ - JWT token handling for authentication
- bcrypt 5.0.0+ - Password hashing

**Infrastructure (Backend):**
- Celery 5.3.0+ - Distributed task queue for async experiment runs
- Redis - Message broker for Celery (via REDIS_URL env var)
- sentence-transformers 2.2.0+ - Text embeddings for RAG/knowledge base
- chromadb 0.4.0+ - Optional vector store for embeddings

**Document Processing:**
- pypdf 4.0.0+ - PDF text extraction
- python-docx 1.1.0+ - Word document text extraction
- pdfplumber 0.11.4+ - Advanced PDF processing
- pytesseract 0.3.13+ - OCR for image-to-text conversion (optional)
- Pillow 10.4.0+ - Image processing

**Web Scraping & Search:**
- duckduckgo-search 7.3.2+ - Free web search (no API key required)
- trafilatura 1.12.2+ - Web content extraction
- httpx - HTTP client for search APIs

**Critical (Frontend):**
- axios 1.13.2+ - HTTP client for API requests
- papaparse 5.4.1 - CSV parsing for data export/import

## Configuration

**Environment:**
- Pydantic Settings - Config via `src/socialsim4/backend/core/config.py`
- Environment prefix: `SOCIALSIM4_`
- Config file: `.env` (gitignored)
- Example config: `.env.example`

**Key configs required:**
- `SOCIALSIM4_DATABASE_URL` - SQLite or PostgreSQL connection string
- `SOCIALSIM4_JWT_SIGNING_KEY` - Secret for JWT tokens
- `SOCIALSIM4_ALLOWED_ORIGINS` - CORS allowed origins for frontend
- `REDIS_URL` or `SOCIALSIM4_REDIS_URL` - Celery broker URL
- `SOCIALSIM4_UPLOAD_DIR` - File upload directory (default: "uploads")

**Build (Frontend):**
- `vite.config.ts` - Vite build configuration with React plugin
- `tsconfig.json` - TypeScript compiler configuration (target: ES2022)
- `tailwind.config.cjs` - Tailwind CSS customization
- `postcss.config.cjs` - PostCSS plugins (Tailwind, Autoprefixer)

**Build (Backend):**
- `pyproject.toml` - Poetry project configuration with dependencies
- `requirements.txt` - Pip-compatible requirements export

## Platform Requirements

**Development:**
- Python 3.11+ (3.12 recommended for this project)
- Node.js 18+ (for Vite frontend build)
- Redis (optional, for Celery async tasks)
- Tesseract OCR (optional, for image OCR in document uploads)

**Production:**
- Backend: Any ASGI-compatible server (Uvicorn recommended)
- Database: SQLite (default) or PostgreSQL
- Frontend: Static files served by backend or separate CDN
- Optional: Redis for Celery task queue
- Optional: ChromaDB for vector store

---

*Stack analysis: 2026-03-08*
