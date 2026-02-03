"""Template system for SocialSim4.

This module provides a generic, composable template system that allows users
to define simulation templates as JSON or YAML files. Templates can specify
core mechanics, semantic actions, agent archetypes, and environment configurations.
"""

from socialsim4.templates.schema import (
    CoreMechanic,
    SemanticAction as SemanticActionSchema,
    AgentArchetype,
    EnvironmentConfig,
    GenericTemplate,
    export_json_schema,
)
from socialsim4.templates.semantic_actions import (
    SemanticAction,
    SemanticActionFactory,
)
from socialsim4.templates.loader import (
    TemplateLoader,
    GenericScene,
)

__all__ = [
    "CoreMechanic",
    "SemanticActionSchema",
    "SemanticAction",
    "SemanticActionFactory",
    "AgentArchetype",
    "EnvironmentConfig",
    "GenericTemplate",
    "export_json_schema",
    "TemplateLoader",
    "GenericScene",
]
