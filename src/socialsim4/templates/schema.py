"""Pydantic schema models for the generic template system.

This module defines the data models that constitute a generic simulation template.
Templates can be serialized to/from JSON or YAML and validated using these models.

The schema supports:
- Core mechanics: grid, discussion, voting, resources, hierarchy, time
- Semantic actions: User-defined actions with parameters and effects
- Agent archetypes: Reusable agent profiles with prompts and properties
- Environment config: Shared environment settings
"""

from __future__ import annotations

import json
from typing import Literal, Any
from pydantic import BaseModel, Field, field_validator, ConfigDict
from re import match


class CoreMechanic(BaseModel):
    """A core mechanic configuration for a simulation.

    Core mechanics define the fundamental interaction patterns available
    in a simulation. Each mechanic type has its own configuration schema.

    Attributes:
        type: The type of core mechanic (grid, discussion, voting, resources,
            hierarchy, or time).
        config: Mechanism-specific configuration as a key-value dictionary.
    """

    type: Literal["grid", "discussion", "voting", "resources", "hierarchy", "time"] = Field(
        ...,
        description="The type of core mechanic.",
    )
    config: dict[str, Any] = Field(
        default_factory=dict,
        description="Mechanic-specific configuration options.",
    )

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {"type": "grid", "config": {"width": 10, "height": 10, "wrap_around": True}},
                {"type": "discussion", "config": {"max_message_length": 500}},
                {"type": "voting", "config": {"method": "majority", "abstain_allowed": True}},
                {"type": "resources", "config": {"initial_amount": 100, "decay_rate": 0.1}},
                {"type": "hierarchy", "config": {"levels": 3, "promotion_rule": "merit"}},
                {"type": "time", "config": {"start": "2024-01-01", "step": "1d"}},
            ]
        }
    )


class SemanticActionParameter(BaseModel):
    """A parameter definition for a semantic action.

    Attributes:
        name: The parameter name (must be snake_case).
        type: The parameter type (str, int, float, bool, list, dict).
        description: Human-readable description of the parameter.
        required: Whether this parameter is required.
        default: Default value if not required (optional).
    """

    name: str = Field(..., description="Parameter name in snake_case.")
    type: Literal["str", "int", "float", "bool", "list", "dict"] = Field(
        ...,
        description="Parameter data type.",
    )
    description: str = Field(
        default="",
        description="Human-readable description of the parameter.",
    )
    required: bool = Field(
        default=True,
        description="Whether this parameter is required.",
    )
    default: Any | None = Field(
        default=None,
        description="Default value for optional parameters.",
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate that parameter name is snake_case."""
        if not match(r"^[a-z_][a-z0-9_]*$", v):
            raise ValueError(
                f"Parameter name '{v}' must be snake_case (lowercase letters, "
                "numbers, and underscores, starting with letter or underscore)"
            )
        return v


class SemanticAction(BaseModel):
    """A user-defined semantic action available to agents.

    Semantic actions extend the base simulation with domain-specific behaviors
    that agents can perform. Each action has a name, description, instruction
    prompt for the LLM, parameters, and effect description.

    Attributes:
        name: The action name (must be snake_case matching ^[a-z_]+$).
        description: Human-readable description of what this action does.
        instruction: The instruction prompt for the LLM when invoking this action.
        parameters: List of parameter definitions for this action.
        effect: Description of the effect this action has on the simulation state.
    """

    name: str = Field(
        ...,
        pattern=r"^[a-z_]+$",
        description="Action name in snake_case (lowercase letters and underscores only).",
    )
    description: str = Field(
        ...,
        description="Human-readable description of what this action does.",
    )
    instruction: str = Field(
        ...,
        description="The instruction prompt for the LLM when invoking this action.",
    )
    parameters: list[SemanticActionParameter] = Field(
        default_factory=list,
        description="List of parameter definitions for this action.",
    )
    effect: str = Field(
        default="",
        description="Description of the effect this action has on simulation state.",
    )

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "name": "cast_vote",
                    "description": "Cast a vote on a proposal",
                    "instruction": "You are casting your vote. Consider the proposal carefully.",
                    "parameters": [
                        {
                            "name": "proposal_id",
                            "type": "str",
                            "description": "ID of the proposal to vote on",
                            "required": True,
                        },
                        {
                            "name": "vote",
                            "type": "str",
                            "description": "Your vote (yes/no/abstain)",
                            "required": True,
                        },
                    ],
                    "effect": "Records the agent's vote for the specified proposal.",
                },
                {
                    "name": "transfer_resources",
                    "description": "Transfer resources to another agent",
                    "instruction": "Specify the recipient and amount to transfer.",
                    "parameters": [
                        {
                            "name": "recipient_id",
                            "type": "str",
                            "description": "ID of the agent receiving resources",
                            "required": True,
                        },
                        {
                            "name": "amount",
                            "type": "int",
                            "description": "Amount of resources to transfer",
                            "required": True,
                        },
                    ],
                    "effect": "Transfers resources from sender to recipient if sufficient balance.",
                },
            ]
        }
    )


class AgentArchetype(BaseModel):
    """A reusable agent profile template.

    Agent archetypes define the basic characteristics and behaviors of agents.
    When creating agents from an archetype, specific values can override the
    archetype defaults.

    Attributes:
        name: Unique identifier for this archetype.
        role_prompt: The role/perspective prompt for this type of agent.
        style: Communication style (formal, casual, terse, verbose, etc.).
        user_profile: Background information about the agent.
        properties: Custom properties specific to this agent type.
        allowed_actions: List of action names this archetype can perform.
    """

    name: str = Field(..., description="Unique identifier for this archetype.")
    role_prompt: str = Field(
        ...,
        description="The role/perspective prompt for this type of agent.",
    )
    style: str = Field(
        default="neutral",
        description="Communication style (e.g., formal, casual, terse, verbose).",
    )
    user_profile: str = Field(
        default="",
        description="Background information about the agent.",
    )
    properties: dict[str, Any] = Field(
        default_factory=dict,
        description="Custom properties specific to this agent type.",
    )
    allowed_actions: list[str] = Field(
        default_factory=list,
        description="List of action names this archetype can perform.",
    )

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "name": "voter",
                    "role_prompt": "You are a citizen participating in a democratic process.",
                    "style": "thoughtful",
                    "user_profile": "An average citizen concerned about community issues.",
                    "properties": {"voting_weight": 1},
                    "allowed_actions": ["cast_vote", "discuss"],
                },
                {
                    "name": "moderator",
                    "role_prompt": "You are a moderator responsible for maintaining order.",
                    "style": "formal",
                    "user_profile": "An experienced facilitator.",
                    "properties": {"authority_level": 5},
                    "allowed_actions": ["cast_vote", "discuss", "mute_user", "close_debate"],
                },
            ]
        }
    )


class TimeConfig(BaseModel):
    """Time configuration for the simulation.

    Attributes:
        start: Starting time for the simulation (ISO 8601 format or simple string).
        step: Time step increment (e.g., "1h", "1d", "1w").
        format: Display format for timestamps (optional).
    """

    start: str = Field(
        default="2024-01-01",
        description="Starting time for the simulation.",
    )
    step: str = Field(
        default="1h",
        description="Time step increment (e.g., '1h', '1d', '1w').",
    )
    format: str = Field(
        default="%Y-%m-%d %H:%M",
        description="Display format for timestamps.",
    )


class SpaceConfig(BaseModel):
    """Space configuration for grid-based simulations.

    Attributes:
        type: Type of space (grid, network, continuous).
        width: Width of the space (for grid).
        height: Height of the space (for grid).
        wrap_around: Whether edges wrap around (toroidal).
    """

    type: Literal["grid", "network", "continuous"] = Field(
        default="grid",
        description="Type of space.",
    )
    width: int = Field(
        default=10,
        description="Width of the space (for grid).",
    )
    height: int = Field(
        default=10,
        description="Height of the space (for grid).",
    )
    wrap_around: bool = Field(
        default=True,
        description="Whether edges wrap around (toroidal).",
    )


class EnvironmentConfig(BaseModel):
    """Environment configuration for a simulation.

    Defines the shared environment settings that apply to all agents
    in the simulation.

    Attributes:
        description: Description of the simulation environment.
        time_config: Time-related settings.
        space_config: Space-related settings.
        rules: List of environment rules/constraints.
    """

    description: str = Field(
        default="",
        description="Description of the simulation environment.",
    )
    time_config: TimeConfig | None = Field(
        default=None,
        description="Time-related settings.",
    )
    space_config: SpaceConfig | None = Field(
        default=None,
        description="Space-related settings.",
    )
    rules: list[str] = Field(
        default_factory=list,
        description="List of environment rules/constraints.",
    )

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "description": "A town hall meeting where citizens debate proposals.",
                    "time_config": {"start": "2024-01-01", "step": "30m"},
                    "space_config": {"type": "network"},
                    "rules": [
                        "Speakers must wait for recognition from the moderator.",
                        "Time limits are enforced for speaking turns.",
                    ],
                }
            ]
        }
    )


class NetworkConfig(BaseModel):
    """Network configuration for agent relationships.

    Attributes:
        type: Network type (complete, random, small_world, scale_free, custom).
        parameters: Network-specific parameters.
    """

    type: Literal["complete", "random", "small_world", "scale_free", "custom"] = Field(
        default="complete",
        description="Network type.",
    )
    parameters: dict[str, Any] = Field(
        default_factory=dict,
        description="Network-specific parameters.",
    )


class GenericTemplate(BaseModel):
    """A complete simulation template.

    The GenericTemplate brings together all components needed to define
    a reusable simulation scenario. Templates can be saved as JSON/YAML
    and loaded to create new simulations.

    Attributes:
        id: Unique identifier for this template.
        name: Human-readable name.
        description: Detailed description of the template's purpose.
        version: Semantic version string.
        author: Template author/creator.
        core_mechanics: List of core mechanics used in this template.
        semantic_actions: Custom actions available to agents.
        agent_archetypes: Reusable agent profiles.
        environment: Shared environment settings.
        default_time_config: Default time settings (used if environment.time_config is None).
        default_network: Default network configuration.
    """

    id: str = Field(..., description="Unique identifier for this template.")
    name: str = Field(..., description="Human-readable name.")
    description: str = Field(
        ...,
        description="Detailed description of the template's purpose.",
    )
    version: str = Field(
        default="1.0.0",
        description="Semantic version string.",
    )
    author: str = Field(
        default="",
        description="Template author/creator.",
    )
    core_mechanics: list[CoreMechanic] = Field(
        default_factory=list,
        description="List of core mechanics used in this template.",
    )
    semantic_actions: list[SemanticAction] = Field(
        default_factory=list,
        description="Custom actions available to agents.",
    )
    agent_archetypes: list[AgentArchetype] = Field(
        default_factory=list,
        description="Reusable agent profiles.",
    )
    environment: EnvironmentConfig | None = Field(
        default=None,
        description="Shared environment settings.",
    )
    default_time_config: TimeConfig | None = Field(
        default=None,
        description="Default time settings.",
    )
    default_network: NetworkConfig | None = Field(
        default=None,
        description="Default network configuration.",
    )

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "id": "town_hall_voting",
                    "name": "Town Hall Voting",
                    "description": "A template for simulating town hall meetings with voting.",
                    "version": "1.0.0",
                    "author": "SocialSim4 Team",
                    "core_mechanics": [
                        {"type": "discussion", "config": {"max_message_length": 500}},
                        {"type": "voting", "config": {"method": "majority"}},
                    ],
                    "semantic_actions": [
                        {
                            "name": "cast_vote",
                            "description": "Cast a vote on a proposal",
                            "instruction": "Cast your vote on the proposal.",
                            "parameters": [
                                {"name": "proposal_id", "type": "str", "required": True},
                                {"name": "vote", "type": "str", "required": True},
                            ],
                        },
                    ],
                    "agent_archetypes": [
                        {
                            "name": "citizen",
                            "role_prompt": "You are a concerned citizen.",
                            "allowed_actions": ["cast_vote", "discuss"],
                        }
                    ],
                    "environment": {
                        "description": "A town hall setting.",
                        "time_config": {"start": "2024-01-01", "step": "30m"},
                    },
                }
            ]
        }
    )


def export_json_schema() -> dict[str, Any]:
    """Export the JSON schema for the template system.

    Returns a JSON schema dictionary that can be used for frontend validation,
    documentation generation, or integration with other tools.

    Returns:
        A dictionary containing the JSON Schema for all template models.
    """
    schema: dict[str, Any] = GenericTemplate.model_json_schema()
    return {
        "$schema": "http://json-schema.org/draft-07/schema#",
        **schema,
    }
