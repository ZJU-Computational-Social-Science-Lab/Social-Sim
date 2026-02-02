"""Template loader for the generic template system.

This module provides functionality to load simulation templates from JSON/YAML
files and build Scene instances from them. The TemplateLoader can parse template
definitions and compose a GenericScene with the appropriate mechanics and
semantic actions.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import yaml

from socialsim4.core.action import Action
from socialsim4.core.agent import Agent
from socialsim4.core.scene import Scene
from socialsim4.templates.mechanics import create_mechanic
from socialsim4.templates.semantic_actions import SemanticAction, SemanticActionFactory
from socialsim4.templates.schema import GenericTemplate


class TemplateLoader:
    """Loads simulation templates from files and builds scenes.

    The TemplateLoader can read template definitions from JSON or YAML files,
    validate them, and build Scene instances with the appropriate mechanics
    and semantic actions.

    Attributes:
        template_dir: Optional directory path for template files.
    """

    def __init__(self, template_dir: str | Path | None = None):
        """Initialize the TemplateLoader.

        Args:
            template_dir: Optional directory path to search for templates.
        """
        self.template_dir = Path(template_dir) if template_dir else None

    def load_from_file(self, path: str | Path) -> GenericTemplate:
        """Load a template from a JSON or YAML file.

        Args:
            path: Path to the template file (.json, .yaml, or .yml).

        Returns:
            A GenericTemplate instance.

        Raises:
            FileNotFoundError: If the file doesn't exist.
            ValueError: If the file format is not supported or content is invalid.
        """
        path = Path(path)

        # Resolve relative paths against template_dir if provided
        if not path.is_absolute() and self.template_dir:
            path = self.template_dir / path

        if not path.exists():
            raise FileNotFoundError(f"Template file not found: {path}")

        # Read file content based on extension
        suffix = path.suffix.lower()
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()

        if suffix == ".json":
            data = json.loads(content)
        elif suffix in (".yaml", ".yml"):
            data = yaml.safe_load(content)
        else:
            raise ValueError(
                f"Unsupported file format: {suffix}. "
                "Supported formats: .json, .yaml, .yml"
            )

        return self.load_from_dict(data)

    def load_from_dict(self, data: dict[str, Any]) -> GenericTemplate:
        """Load a template from a dictionary.

        Args:
            data: Dictionary containing template definition.

        Returns:
            A GenericTemplate instance.

        Raises:
            ValueError: If the template data is invalid.
        """
        try:
            template = GenericTemplate.model_validate(data)
            return template
        except Exception as e:
            raise ValueError(f"Invalid template data: {e}") from e

    def load_from_directory(self, directory: str | Path) -> list[GenericTemplate]:
        """Load all templates from a directory.

        Searches for .json, .yaml, and .yml files in the specified directory.

        Args:
            directory: Path to the directory containing template files.

        Returns:
            List of GenericTemplate instances.

        Raises:
            FileNotFoundError: If the directory doesn't exist.
        """
        dir_path = Path(directory)

        # Resolve relative paths against template_dir if provided
        if not dir_path.is_absolute() and self.template_dir:
            dir_path = self.template_dir / dir_path

        if not dir_path.exists() or not dir_path.is_dir():
            raise FileNotFoundError(f"Directory not found: {dir_path}")

        templates = []
        for pattern in ("*.json", "*.yaml", "*.yml"):
            for file_path in dir_path.glob(pattern):
                try:
                    template = self.load_from_file(file_path)
                    templates.append(template)
                except Exception as e:
                    # Log but continue loading other templates
                    print(f"Warning: Failed to load {file_path}: {e}")

        return templates

    def build_scene_from_template(
        self,
        template: GenericTemplate | dict[str, Any],
    ) -> "GenericScene":
        """Build a Scene instance from a template.

        Creates a GenericScene composed of the mechanics and semantic actions
        defined in the template.

        Args:
            template: A GenericTemplate instance or template dict.

        Returns:
            A GenericScene instance.

        Raises:
            ValueError: If the template is invalid.
        """
        # Convert dict to GenericTemplate if needed
        if isinstance(template, dict):
            template = self.load_from_dict(template)

        # Extract environment configuration
        env_config = template.environment
        if env_config is None:
            # Import inside function to avoid circular import with schema module
            from socialsim4.templates.schema import EnvironmentConfig
            env_config = EnvironmentConfig()

        # Build mechanics configuration
        mechanics_config = []
        for mechanic_def in template.core_mechanics:
            mechanics_config.append({
                "type": mechanic_def.type,
                "config": mechanic_def.config,
            })

        # Build semantic actions configuration
        semantic_actions_config = []
        for action_def in template.semantic_actions:
            # Convert schema SemanticAction to config dict
            params_dict = {}
            for param in action_def.parameters:
                params_dict[param.name] = param.description

            semantic_actions_config.append({
                "name": action_def.name,
                "description": action_def.description,
                "instruction": action_def.instruction,
                "parameters": params_dict,
                "effect": action_def.effect,
            })

        # Build environment dict - only include keys with actual values
        environment = {}
        if env_config.description:
            environment["description"] = env_config.description
        if env_config.rules:
            environment["rules"] = env_config.rules
        if env_config.time_config:
            environment["time_config"] = {
                "start": env_config.time_config.start,
                "step": env_config.time_config.step,
                "format": env_config.time_config.format,
            }
        if env_config.space_config:
            environment["space_config"] = {
                "type": env_config.space_config.type,
                "width": env_config.space_config.width,
                "height": env_config.space_config.height,
                "wrap_around": env_config.space_config.wrap_around,
            }

        # Create the scene
        scene = GenericScene(
            name=template.name,
            initial_event=template.description,
            mechanics_config=mechanics_config if mechanics_config else None,
            semantic_actions_config=semantic_actions_config if semantic_actions_config else None,
            environment=environment,
        )

        return scene


class GenericScene(Scene):
    """A generic scene composed from template mechanics and semantic actions.

    GenericScene composes multiple core mechanics and semantic actions
    to create a flexible simulation scene. It initializes agents with
    mechanic-specific properties and provides actions from both mechanics
    and semantic actions.

    Attributes:
        name: The scene name.
        initial_event: The initial event description.
        mechanics: List of core mechanic instances.
        semantic_actions: List of semantic action instances.
        environment: Environment configuration dict.
    """

    TYPE = "generic_scene"

    def __init__(
        self,
        name: str,
        initial_event: str,
        mechanics_config: list[dict[str, Any]] | None = None,
        semantic_actions_config: list[dict[str, Any]] | None = None,
        environment: dict[str, Any] | None = None,
    ):
        """Initialize a GenericScene.

        Args:
            name: The scene name.
            initial_event: The initial event description.
            mechanics_config: List of mechanic configs with 'type' and 'config' keys.
            semantic_actions_config: List of semantic action configs.
            environment: Environment configuration dict.
        """
        super().__init__(name, initial_event)

        # Initialize mechanics
        self.mechanics: list[Any] = []
        if mechanics_config:
            for mechanic_def in mechanics_config:
                mechanic = create_mechanic(
                    mechanic_def["type"],
                    mechanic_def.get("config", {})
                )
                self.mechanics.append(mechanic)

                # Add mechanic's state contribution to scene state
                scene_state = mechanic.get_scene_state()
                for key, value in scene_state.items():
                    if key not in self.state:
                        self.state[key] = value

        # Initialize semantic actions
        self.semantic_actions: list[SemanticAction] = []
        if semantic_actions_config:
            for action_config in semantic_actions_config:
                action = SemanticActionFactory.create_from_config(action_config)
                self.semantic_actions.append(action)

        # Store environment configuration
        self.environment = environment or {}

    def initialize_agent(self, agent: Agent) -> None:
        """Initialize an agent with all mechanic properties.

        Calls initialize_agent on all mechanics to set up agent-specific
        properties.

        Args:
            agent: The agent to initialize.
        """
        for mechanic in self.mechanics:
            mechanic.initialize_agent(agent, self)

    def get_scene_actions(self, agent: Agent) -> list[Action]:
        """Return all actions available to the agent.

        Collects actions from all mechanics and semantic actions.

        Args:
            agent: The agent to get actions for.

        Returns:
            List of Action instances available to the agent.
        """
        # Start with base scene actions (includes YieldAction)
        actions = super().get_scene_actions(agent)

        # Add actions from each mechanic
        for mechanic in self.mechanics:
            actions.extend(mechanic.get_actions())

        # Add semantic actions
        actions.extend(self.semantic_actions)

        return actions

    def get_compact_description(self) -> str:
        """Build a compact description for 4B models.

        Builds a description by combining contributions from all mechanics.

        Returns:
            A compact description string.
        """
        parts = []

        # Add environment description
        if self.environment:
            desc = self.environment.get("description", "")
            if desc:
                parts.append(desc)

        # Add mechanic-specific descriptions
        for mechanic in self.mechanics:
            mechanic_type = getattr(mechanic, "TYPE", "unknown")

            if mechanic_type == "grid":
                game_map = self.state.get("game_map")
                if game_map:
                    parts.append(
                        f"Location: A {game_map.width}x{game_map.height} grid. "
                        f"You can move, look around, and rest."
                    )
            elif mechanic_type == "voting":
                threshold = self.state.get("voting_threshold", 0.5)
                parts.append(f"Voting: Proposals pass with {threshold*100:.0f}% yes votes.")
            elif mechanic_type == "resources":
                resources = self.state.get("available_resources", [])
                if resources:
                    parts.append(f"Resources: You can gather {', '.join(resources)}.")
            elif mechanic_type == "hierarchy":
                h_type = self.state.get("hierarchy_type", "flat")
                parts.append(f"Hierarchy: {h_type.capitalize()} structure.")
            elif mechanic_type == "discussion":
                moderated = self.state.get("moderated", False)
                if moderated:
                    parts.append("Discussion: Moderated forum with speaking limits.")
                else:
                    parts.append("Discussion: Open forum for all participants.")

        # Add rules if present
        rules = self.environment.get("rules", [])
        if rules:
            parts.append("Rules:\n" + "\n".join(f"- {rule}" for rule in rules))

        return "\n\n".join(parts) if parts else ""

    def get_scenario_description(self) -> str:
        """Return the environment description.

        Returns:
            The environment description string, or initial_event if no description.
        """
        if self.environment:
            desc = self.environment.get("description", "")
            if desc:
                return desc
        # Fall back to initial_event content if no environment description
        return self.initial_event.content if self.initial_event else ""

    def get_behavior_guidelines(self) -> str:
        """Return behavior guidelines from environment rules.

        Returns:
            Rules formatted as a string.
        """
        if self.environment:
            rules = self.environment.get("rules", [])
            if rules:
                return "\n".join(f"- {rule}" for rule in rules)
        return ""

    def serialize_config(self) -> dict:
        """Return scene-specific configuration for serialization.

        Returns:
            Dict with mechanics and semantic actions config.
        """
        return {
            "mechanics_config": [
                {
                    "type": getattr(m, "TYPE", "unknown"),
                    "config": m.get_scene_state(),
                }
                for m in self.mechanics
            ],
            "semantic_actions_config": [
                {
                    "name": sa.NAME,
                    "description": sa.DESC,
                    "instruction": sa._instruction if hasattr(sa, "_instruction") else "",
                    "parameters": sa.parameters if hasattr(sa, "parameters") else {},
                    "effect": sa.effect_code if hasattr(sa, "effect_code") else None,
                }
                for sa in self.semantic_actions
            ],
            "environment": self.environment,
        }

    @classmethod
    def deserialize_config(cls, config: dict) -> dict:
        """Parse config dict and return kwargs for the constructor.

        Args:
            config: Scene-specific configuration dict.

        Returns:
            Dict of kwargs for the constructor.
        """
        return {
            "mechanics_config": config.get("mechanics_config", []),
            "semantic_actions_config": config.get("semantic_actions_config", []),
            "environment": config.get("environment", {}),
        }
