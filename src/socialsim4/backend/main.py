from __future__ import annotations

from pathlib import Path

from litestar import Litestar, Router, get
from litestar.config.cors import CORSConfig
from litestar.connection import Request
from litestar.enums import MediaType
from litestar.openapi import OpenAPIConfig
from litestar.response import File, Response
from litestar.static_files import create_static_files_router

from .api.routes import router as api_router
from .core.config import get_settings
from .core.database import engine
from .db.base import Base


async def _prepare_database() -> None:
    import socialsim4.backend.models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def _initialize_vector_store() -> None:
    """Initialize the vector store on startup if ChromaDB is enabled."""
    from .core.config import get_settings
    from .services.vector_store import initialize_vector_store

    settings = get_settings()
    if settings.use_chromadb:
        initialize_vector_store(
            use_chromadb=True,
            persist_dir=settings.chromadb_persist_dir
        )
        print(f"[vector_store] ChromaDB initialized at {settings.chromadb_persist_dir}")
    else:
        # Initialize with JSON fallback
        initialize_vector_store(use_chromadb=False)
        print("[vector_store] Using JSON fallback mode")


def internal_error_handler(request: Request, exc: Exception) -> Response:
    # Return JSON error for any unhandled exception (HTTP 500)
    # Note: 4xx HTTPException responses will continue to use Litestar's default handling.
    return Response(content={"error": str(exc)}, media_type=MediaType.JSON, status_code=500)


def create_app() -> Litestar:
    settings = get_settings()

    cors_config = None
    if settings.allowed_origins:
        cors_config = CORSConfig(
            allow_origins=settings.allowed_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    api_prefix = settings.api_prefix or "/api"
    api_routes = Router(path=api_prefix, route_handlers=[api_router])

    # Static uploads
    root_dir = Path(__file__).resolve().parents[3]
    upload_dir = (root_dir / settings.upload_dir).resolve()
    upload_dir.mkdir(parents=True, exist_ok=True)
    upload_router = create_static_files_router(
        path=settings.upload_base_url,
        directories=[str(upload_dir)],
        name="uploads",
    )

    route_handlers = [api_routes, upload_router]

    # 只在生产模式（有 dist 目录）时服务静态文件
    dist_dir = Path(settings.frontend_dist_path or root_dir / "frontend" / "dist").resolve()
    index_file = dist_dir / "index.html"

    if dist_dir.is_dir() and index_file.is_file():
        assets_router = create_static_files_router(
            path="/assets",
            directories=[str(dist_dir / "assets")],
            name="frontend-assets",
        )

        index_path = str(index_file)

        def _spa_response() -> File:
            return File(
                index_path,
                content_disposition_type="inline",
                media_type="text/html",
            )

        @get("/{path:path}")
        async def spa_fallback(path: str = "") -> File:
            return _spa_response()

        @get("/")
        async def home_page() -> File:
            return _spa_response()

        spa_router = Router(path="/", route_handlers=[home_page, spa_fallback])
        # Also serve the SPA under legacy path `/css/socialsim` so links/bookmarks
        # like `/css/socialsim/login` continue to work.
        spa_router_css = Router(path="/css/socialsim", route_handlers=[home_page, spa_fallback])
        route_handlers.extend([assets_router, spa_router, spa_router_css])

    base_router = Router(path=settings.backend_root_path, route_handlers=route_handlers)

    def _log_routes(app: Litestar) -> None:
        for route in sorted(app.routes, key=lambda r: r.path):
            methods = route.methods or ["WS"]
            print(f"[litestar] {sorted(methods)} {route.path}")

    app_kwargs: dict = {
        "route_handlers": [base_router],
        "on_startup": [_prepare_database, _initialize_vector_store, _log_routes],
        "cors_config": cors_config,
        "debug": settings.debug,
        "openapi_config": OpenAPIConfig(title=settings.app_name, version="1.0.0"),
    }

    return Litestar(**app_kwargs)


app = create_app()
