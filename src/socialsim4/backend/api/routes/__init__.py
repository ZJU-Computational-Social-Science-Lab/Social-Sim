# src/socialsim4/backend/api/__init__.py
from litestar import Router

from . import (
    admin,
    auth,
    config,
    providers,
    scenes,
    simulations,
    search_providers,
    llm,  # 👈 新增：LLM 相关路由
    experiments,
    uploads,
)

router = Router(
    path="",
    route_handlers=[
        auth.router,
        config.router,
        scenes.router,
        simulations.router,
        providers.router,
        search_providers.router,
        llm.router,   # 👈 新增：挂载 /llm 路由（包含 /llm/generate_agents）
        experiments.router,
        uploads.router,
        admin.router,
    ],
)
