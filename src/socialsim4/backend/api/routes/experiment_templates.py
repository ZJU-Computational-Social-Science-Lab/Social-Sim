"""
API routes for experiment template management and execution.

Researchers can:
- Create, list, update, delete experiment templates
- Run experiments from templates
"""

from datetime import datetime, timezone
from typing import Any

from litestar import Router, post, get, put, delete
from litestar.connection import Request
from litestar.exceptions import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from socialsim4.backend.core.database import get_session
from socialsim4.backend.dependencies import extract_bearer_token, resolve_current_user
from socialsim4.backend.models.experiment_template import ExperimentTemplate
from socialsim4.backend.models.simulation import Simulation
from socialsim4.backend.schemas.experiment import (
    ExperimentTemplateCreate,
    ExperimentTemplateResponse,
    ExperimentTemplateUpdate,
    ExperimentRunRequest,
    ExperimentRunResponse,
)


async def get_template_for_owner(
    session: AsyncSession,
    user_id: int,
    template_id: int,
) -> ExperimentTemplate:
    """
    Get an experiment template and verify ownership.

    Args:
        session: Database session
        user_id: Current user ID
        template_id: Template ID to fetch

    Returns:
        The experiment template

    Raises:
        HTTPException: If template not found or access denied
    """
    template = await session.get(ExperimentTemplate, template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")

    if template.created_by != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    return template


@post("/templates", status_code=201)
async def create_template(
    request: Request,
    data: ExperimentTemplateCreate,
) -> ExperimentTemplateResponse:
    """
    Create a new experiment template.

    Args:
        request: Litestar request with auth token
        data: Template creation data

    Returns:
        Created experiment template

    Raises:
        HTTPException: If authentication fails
    """
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)

        db_template = ExperimentTemplate(
            name=data.name,
            description=data.description,
            actions=data.actions,
            settings=data.settings,
            created_by=current_user.id,
        )
        session.add(db_template)
        await session.commit()
        await session.refresh(db_template)

        return ExperimentTemplateResponse.model_validate(db_template)


@get("/templates")
async def list_templates(
    request: Request,
    skip: int = 0,
    limit: int = 100,
) -> dict[str, Any]:
    """
    List all templates for current user.

    Args:
        request: Litestar request with auth token
        skip: Number of templates to skip (pagination)
        limit: Maximum number of templates to return

    Returns:
        Dictionary with list of templates

    Raises:
        HTTPException: If authentication fails
    """
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)

        result = await session.execute(
            select(ExperimentTemplate)
            .where(ExperimentTemplate.created_by == current_user.id)
            .offset(skip)
            .limit(limit)
            .order_by(ExperimentTemplate.created_at.desc())
        )
        templates = result.scalars().all()

        return {
            "templates": [
                ExperimentTemplateResponse.model_validate(t)
                for t in templates
            ],
            "count": len(templates),
        }


@get("/templates/{template_id:int}")
async def get_template(
    request: Request,
    template_id: int,
) -> ExperimentTemplateResponse:
    """
    Get a specific experiment template.

    Args:
        request: Litestar request with auth token
        template_id: Template ID

    Returns:
        Experiment template details

    Raises:
        HTTPException: If authentication fails, template not found,
                      or access denied
    """
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)
        template = await get_template_for_owner(session, current_user.id, template_id)

        return ExperimentTemplateResponse.model_validate(template)


@put("/templates/{template_id:int}")
async def update_template(
    request: Request,
    template_id: int,
    data: ExperimentTemplateUpdate,
) -> ExperimentTemplateResponse:
    """
    Update an existing experiment template.

    Args:
        request: Litestar request with auth token
        template_id: Template ID
        data: Template update data

    Returns:
        Updated experiment template

    Raises:
        HTTPException: If authentication fails, template not found,
                      or access denied
    """
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)
        template = await get_template_for_owner(session, current_user.id, template_id)

        # Update fields that are set
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(template, field, value)

        template.updated_at = datetime.now(timezone.utc)
        await session.commit()
        await session.refresh(template)

        return ExperimentTemplateResponse.model_validate(template)


@delete("/templates/{template_id:int}", status_code=200)
async def delete_template(
    request: Request,
    template_id: int,
) -> dict[str, str]:
    """
    Delete an experiment template.

    Args:
        request: Litestar request with auth token
        template_id: Template ID

    Returns:
        Success message

    Raises:
        HTTPException: If authentication fails, template not found,
                      or access denied
    """
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)
        template = await get_template_for_owner(session, current_user.id, template_id)

        await session.delete(template)
        await session.commit()

        return {"message": "Template deleted"}


@post("/run")
async def run_experiment(
    request: Request,
    data: ExperimentRunRequest,
) -> ExperimentRunResponse:
    """
    Launch an experiment from a template.

    Creates a new simulation based on the template configuration
    and returns the experiment ID for tracking.

    Args:
        request: Litestar request with auth token
        data: Experiment run request data

    Returns:
        Experiment run response with experiment ID and initial state

    Raises:
        HTTPException: If authentication fails, template not found,
                      or access denied

    Note:
        This endpoint creates a simulation record. The actual experiment
        execution is handled by the background experiment runner service.
    """
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)

        # Get and verify template ownership
        template = await get_template_for_owner(session, current_user.id, data.template_id)

        # Create simulation record from template
        # TODO: Integrate with existing simulation system for full execution
        from socialsim4.backend.services.simulations import generate_simulation_id

        simulation_id = generate_simulation_id()

        # Build scene_config from template
        scene_config = {
            "description": template.description,
            "actions": template.actions,
            "settings": template.settings,
        }

        simulation = Simulation(
            id=simulation_id,
            owner_id=current_user.id,
            name=f"Experiment: {template.name}",
            scene_type="experiment_template",
            scene_config=scene_config,
            agent_config={"agents": data.agents},
            status="draft",
        )
        session.add(simulation)
        await session.commit()
        await session.refresh(simulation)

        return ExperimentRunResponse(
            experiment_id=simulation.id,
            status="running",
            initial_state={
                "simulation_id": simulation.id,
                "template_id": template.id,
                "scene_config": scene_config,
            },
        )


router = Router(
    path="/experiment-templates",
    route_handlers=[
        create_template,
        list_templates,
        get_template,
        update_template,
        delete_template,
        run_experiment,
    ],
)
