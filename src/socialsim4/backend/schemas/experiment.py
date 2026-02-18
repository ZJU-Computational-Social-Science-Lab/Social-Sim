"""
Pydantic schemas for experiment template API.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class ExperimentTemplateCreate(BaseModel):
    """Schema for creating an experiment template."""
    name: str
    description: str
    actions: list[dict[str, Any]]
    settings: dict[str, Any]


class ExperimentTemplateResponse(BaseModel):
    """Schema for experiment template response."""
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: int
    name: str
    description: str
    actions: list[dict[str, Any]]
    settings: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class ExperimentTemplateUpdate(BaseModel):
    """Schema for updating an experiment template."""
    name: str | None = None
    description: str | None = None
    actions: list[dict[str, Any]] | None = None
    settings: dict[str, Any] | None = None


class ExperimentRunRequest(BaseModel):
    """Schema for running an experiment from a template."""
    template_id: int
    agents: list[dict[str, Any]]
    llm_config: dict[str, Any]


class ExperimentRunResponse(BaseModel):
    """Schema for experiment run response."""
    experiment_id: int
    status: str
    initial_state: dict[str, Any]
