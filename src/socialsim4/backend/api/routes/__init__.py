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
    llm,  # LLM related routes
    experiments,  # Simulation experiment routes (A/B testing)
    experiment_templates,  # Experiment template management routes
    uploads,
    environment,  # Dynamic environment routes
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
        llm.router,
        experiments.router,
        experiment_templates.router,  # Experiment template CRUD and run
        uploads.router,
        admin.router,
        environment.router,
    ],
)
