"""
Health check and metrics endpoints for monitoring and load testing.

Provides application health status, uptime, and key resource metrics
including active simulations, WebSocket connections, LLM semaphore state,
thread pool usage, and database connection pool statistics.

Contains:
    - health_check: Full metrics endpoint
    - liveness_check: Lightweight liveness probe
"""

import time

from litestar import Router, get

from socialsim4.backend.core.database import engine


# Set by on_startup in main.py
_app_start_time: float = 0.0


def set_app_start_time() -> None:
    """Record app start time for uptime calculation. Called on startup."""
    global _app_start_time
    _app_start_time = time.monotonic()


@get("/health")
async def health_check() -> dict:
    """
    Return application health status and key metrics.

    Returns:
        Dictionary with status, uptime, and resource metrics:
        - active_simulations: Number of in-memory SimTree records
        - active_websocket_connections: Total WS subscriber queues
        - db_pool: SQLAlchemy connection pool statistics
    """
    from socialsim4.backend.services.simtree_runtime import SIM_TREE_REGISTRY

    registry_metrics = SIM_TREE_REGISTRY.metrics()

    db_pool = engine.pool
    return {
        "status": "ok",
        "uptime_seconds": int(time.monotonic() - _app_start_time) if _app_start_time else 0,
        "active_simulations": registry_metrics["active_simulations"],
        "active_websocket_connections": registry_metrics["active_websocket_connections"],
        "db_pool": {
            "pool_size": db_pool.size(),
            "checked_out": db_pool.checkedout(),
            "overflow": db_pool.overflow(),
            "checked_in": db_pool.checkedin(),
        },
    }


@get("/health/live")
async def liveness_check() -> dict:
    """
    Lightweight liveness check for Docker health probes.

    Returns:
        Minimal status dictionary
    """
    return {"status": "ok"}


router = Router(path="", route_handlers=[health_check, liveness_check])
