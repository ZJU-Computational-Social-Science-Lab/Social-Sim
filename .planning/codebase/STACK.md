# Technology Stack

**Analysis Date:** 2026-03-18

## Languages

**Primary:**
- Python 3.11+ - Backend simulation engine, API server, data processing

**Secondary:**
- TypeScript 5.8.2 - Frontend React application

## Runtime

**Environment:**
- Python 3.11+ (backend)
- Node.js (frontend, via npm)

**Package Manager:**
- Backend: Poetry (pyproject.toml) or pip (requirements.txt)
- Frontend: npm (package-lock.json present)
- Lockfile: present (package-lock.json, poetry.lock optional)

## Frameworks

**Core:**
- Litestar 2.8.3 - ASGI web framework for backend API
- React 19.2.0 - Frontend UI framework
- Vite 6.2.0 - Frontend build tool and dev server

**Testing:**
- pytest 7.4.3 - Python test runner
- pytest-asyncio 0.21.1 - Async test support
- Vitest 4.0.18 - TypeScript/JavaScript test runner
- @testing-library/react 16.3.2 - React testing utilities

**Build/Dev:**
- Uvicorn 0.30.0 - ASGI server
- TypeScript 5.8.2 - TypeScript compiler
- Tailwind CSS 3.4.17 - CSS utility framework
- PostCSS 8.4.49 - CSS processing

## Key Dependencies

**Critical:**
- openai 1.58.1 - OpenAI API client for LLM integration
- google-generativeai 0.7.2 - Google Gemini API client
- sentence-transformers 2.2.0 - Text embeddings for RAG
- Pydantic 2.4.2 - Data validation and settings

**Infrastructure:**
- SQLAlchemy 2.0.23 - Database ORM
- Alembic 1.13.1 - Database migrations
- Celery 5.3.0 - Async task queue
- httpx 0.27.0 - Async HTTP client

**Frontend:**
- @tanstack/react-query 5.90.11 - Server state management
- zustand 5.0.9 - Client state management
- react-router-dom 7.9.6 - Client-side routing
- i18next 25.7.1 - Internationalization
- react-i18next 16.3.5 - React i18n bindings
- d3 7.9.0 - Data visualization
- reactflow 11.11.4 - Flow chart visualization
- recharts 3.5.1 - Chart components

**Backend:**
- bcrypt 5.0.0 - Password hashing
- python-jose 3.3.0 - JWT token handling
- aiosqlite 0.20.0 - Async SQLite adapter
- psycopg 3.1.18 - PostgreSQL adapter
- duckduckgo-search 7.3.2 - Web search integration
- trafilatura 1.12.2 - Web content extraction
- pdfplumber 0.11.4 - PDF document processing
- python-docx 1.1.0 - Word document processing
- pytesseract 0.3.13 - OCR for image text extraction

**Optional:**
- chromadb 0.4.0+ - Vector database for RAG (optional)
- Pillow 10.4.0 - Image processing

## Configuration

**Environment:**
- Pydantic Settings with .env file support
- Prefix: SOCIALSIM4_
- Config via `src/socialsim4/backend/core/config.py`

**Build:**
- Backend: Poetry (pyproject.toml) or pip (requirements.txt)
- Frontend: Vite (vite.config.ts) with custom virtual docs plugin
- TypeScript config: tsconfig.json with ES2022 target
- Tailwind config: tailwind.config.cjs

## Platform Requirements

**Development:**
- Python 3.11 or 3.12 (3.14 not compatible)
- Node.js 18+ (for Vite 6.x)
- Redis (optional, for Celery broker)
- PostgreSQL or SQLite (database)

**Production:**
- ASGI-compatible server (Uvicorn recommended)
- Database: PostgreSQL (production) or SQLite (development)
- Redis: Required for Celery tasks
- File storage: Local filesystem or cloud-mounted directory

---
