"""Tests for the scenes API and template system integration.

These tests verify that GenericScene is properly integrated with the registry
and that the template loading system works correctly.
"""

import json
from pathlib import Path

import pytest

from socialsim4.core.registry import SCENE_ACTIONS, SCENE_MAP, SCENE_DESCRIPTIONS
from socialsim4.core.agent import Agent
from socialsim4.templates.loader import GenericScene, TemplateLoader
from socialsim4.templates.schema import GenericTemplate, export_json_schema


class TestRegistryIntegration:
    """Tests for GenericScene integration with the registry."""

    def test_generic_scene_in_scene_map(self):
        """Test that generic_scene is registered in SCENE_MAP."""
        assert "generic_scene" in SCENE_MAP
        assert SCENE_MAP["generic_scene"] == GenericScene

    def test_generic_scene_in_scene_actions(self):
        """Test that generic_scene has actions defined in SCENE_ACTIONS."""
        assert "generic_scene" in SCENE_ACTIONS
        assert "basic" in SCENE_ACTIONS["generic_scene"]
        assert "allowed" in SCENE_ACTIONS["generic_scene"]
        assert "yield" in SCENE_ACTIONS["generic_scene"]["basic"]

    def test_generic_scene_in_scene_descriptions(self):
        """Test that generic_scene has a description."""
        assert "generic_scene" in SCENE_DESCRIPTIONS
        assert len(SCENE_DESCRIPTIONS["generic_scene"]) > 0


class TestGenericSceneCreation:
    """Tests for creating GenericScene instances."""

    def test_create_minimal_scene(self):
        """Test creating a GenericScene with minimal parameters."""
        scene = GenericScene(
            name="Test Scene",
            initial_event="A test event",
        )
        assert scene.name == "Test Scene"
        assert scene.TYPE == "generic_scene"
        assert len(scene.mechanics) == 0
        assert len(scene.semantic_actions) == 0

    def test_create_scene_with_mechanics(self):
        """Test creating a GenericScene with mechanics."""
        scene = GenericScene(
            name="Grid Scene",
            initial_event="A grid-based scene",
            mechanics_config=[
                {"type": "grid", "config": {"width": 10, "height": 10}},
            ],
        )
        assert len(scene.mechanics) == 1
        assert "game_map" in scene.state

    def test_create_scene_with_semantic_actions(self):
        """Test creating a GenericScene with semantic actions."""
        scene = GenericScene(
            name="Actions Scene",
            initial_event="A scene with custom actions",
            semantic_actions_config=[
                {
                    "name": "custom_action",
                    "description": "A custom action",
                    "instruction": "Do something custom",
                    "parameters": [],
                },
            ],
        )
        assert len(scene.semantic_actions) == 1
        assert scene.semantic_actions[0].NAME == "custom_action"

    def test_create_scene_with_environment(self):
        """Test creating a GenericScene with environment."""
        scene = GenericScene(
            name="Environment Scene",
            initial_event="A scene with environment",
            environment={
                "description": "A test environment",
                "rules": ["Rule 1", "Rule 2"],
            },
        )
        assert scene.environment["description"] == "A test environment"
        assert len(scene.environment["rules"]) == 2

    def test_scene_get_scenario_description(self):
        """Test get_scenario_description returns environment description."""
        scene = GenericScene(
            name="Description Test",
            initial_event="Initial event",
            environment={
                "description": "Environment description",
            },
        )
        assert scene.get_scenario_description() == "Environment description"

    def test_scene_get_behavior_guidelines(self):
        """Test get_behavior_guidelines returns rules."""
        scene = GenericScene(
            name="Rules Test",
            initial_event="Initial event",
            environment={
                "rules": ["First rule", "Second rule"],
            },
        )
        guidelines = scene.get_behavior_guidelines()
        assert "First rule" in guidelines
        assert "Second rule" in guidelines


class TestTemplateLoaderIntegration:
    """Tests for TemplateLoader with GenericScene."""

    def test_build_scene_from_template_dict(self):
        """Test building a scene from a template dictionary."""
        template_data = {
            "id": "test_template",
            "name": "Test Template",
            "description": "A test template",
            "core_mechanics": [
                {"type": "grid", "config": {"width": 5, "height": 5}},
            ],
        }

        loader = TemplateLoader()
        scene = loader.build_scene_from_template(template_data)

        assert isinstance(scene, GenericScene)
        assert scene.name == "Test Template"
        assert len(scene.mechanics) == 1

    def test_build_scene_from_full_template(self):
        """Test building a scene from a full template."""
        template_data = {
            "id": "full_template",
            "name": "Full Template",
            "description": "A complete template",
            "version": "1.0.0",
            "author": "Test Author",
            "core_mechanics": [
                {"type": "grid", "config": {"width": 10, "height": 10}},
                {"type": "voting", "config": {"method": "majority"}},
            ],
            "semantic_actions": [
                {
                    "name": "cast_vote",
                    "description": "Cast a vote",
                    "instruction": "Cast your vote",
                    "parameters": [],
                },
            ],
            "environment": {
                "description": "A voting environment",
                "rules": ["Be respectful"],
            },
        }

        loader = TemplateLoader()
        scene = loader.build_scene_from_template(template_data)

        assert isinstance(scene, GenericScene)
        assert scene.name == "Full Template"
        assert len(scene.mechanics) == 2
        assert len(scene.semantic_actions) == 1
        assert scene.environment["description"] == "A voting environment"

    def test_load_and_build_from_json_file(self, tmp_path):
        """Test loading a template from JSON file and building a scene."""
        template_data = {
            "id": "json_template",
            "name": "JSON Template",
            "description": "From JSON file",
            "core_mechanics": [
                {"type": "discussion", "config": {"max_message_length": 500}},
            ],
        }

        template_file = tmp_path / "test.json"
        with open(template_file, "w") as f:
            json.dump(template_data, f)

        loader = TemplateLoader()
        template = loader.load_from_file(template_file)
        scene = loader.build_scene_from_template(template)

        assert scene.name == "JSON Template"
        assert len(scene.mechanics) == 1


class TestAgentInitialization:
    """Tests for agent initialization with GenericScene."""

    def test_initialize_agent_with_no_mechanics(self):
        """Test agent initialization when scene has no mechanics."""
        scene = GenericScene(
            name="No Mechanics",
            initial_event="No mechanics",
        )

        agent = Agent(name="Test Agent", user_profile="Test", style="neutral")
        scene.initialize_agent(agent)

        # Agent should still have basic properties
        assert agent.name == "Test Agent"

    def test_initialize_agent_with_grid_mechanic(self):
        """Test agent initialization with grid mechanic."""
        scene = GenericScene(
            name="Grid Scene",
            initial_event="Grid scene",
            mechanics_config=[
                {"type": "grid", "config": {"width": 10, "height": 10}},
            ],
        )

        agent = Agent(name="Grid Agent", user_profile="Test", style="neutral")
        scene.initialize_agent(agent)

        # Agent should have grid properties
        assert "map_xy" in agent.properties
        assert "map_position" in agent.properties
        assert "hunger" in agent.properties
        assert "energy" in agent.properties

    def test_initialize_agent_with_voting_mechanic(self):
        """Test agent initialization with voting mechanic."""
        scene = GenericScene(
            name="Voting Scene",
            initial_event="Voting scene",
            mechanics_config=[
                {"type": "voting", "config": {"method": "majority"}},
            ],
        )

        agent = Agent(name="Voting Agent", user_profile="Test", style="neutral")
        scene.initialize_agent(agent)

        # Agent should have voting properties
        assert "votes_cast" in agent.properties

    def test_initialize_agent_with_multiple_mechanics(self):
        """Test agent initialization with multiple mechanics."""
        scene = GenericScene(
            name="Multi Scene",
            initial_event="Multi mechanic scene",
            mechanics_config=[
                {"type": "grid", "config": {"width": 10, "height": 10}},
                {"type": "voting", "config": {"method": "majority"}},
                {"type": "resources", "config": {"initial_amount": 100}},
            ],
        )

        agent = Agent(name="Multi Agent", user_profile="Test", style="neutral")
        scene.initialize_agent(agent)

        # Agent should have properties from all mechanics
        assert "map_xy" in agent.properties  # From grid
        assert "votes_cast" in agent.properties  # From voting
        # Resources mechanic adds inventory items
        assert "inventory" in agent.properties


class TestSceneActions:
    """Tests for scene actions from GenericScene."""

    def test_scene_actions_include_yield(self):
        """Test that scene actions always include yield."""
        scene = GenericScene(
            name="Yield Test",
            initial_event="Test",
        )

        agent = Agent(name="Test Agent", user_profile="Test", style="neutral")
        actions = scene.get_scene_actions(agent)

        action_names = [a.NAME for a in actions if hasattr(a, "NAME")]
        assert "yield" in action_names

    def test_scene_actions_include_mechanic_actions(self):
        """Test that scene actions include actions from mechanics."""
        scene = GenericScene(
            name="Mechanic Actions",
            initial_event="Test",
            mechanics_config=[
                {"type": "grid", "config": {"width": 10, "height": 10}},
            ],
        )

        agent = Agent(name="Test Agent", user_profile="Test", style="neutral")
        actions = scene.get_scene_actions(agent)

        action_names = [a.NAME for a in actions if hasattr(a, "NAME")]
        # Grid mechanic should add move_to_location, look_around, etc.
        assert "move_to_location" in action_names

    def test_scene_actions_include_semantic_actions(self):
        """Test that scene actions include semantic actions."""
        scene = GenericScene(
            name="Semantic Actions",
            initial_event="Test",
            semantic_actions_config=[
                {
                    "name": "custom_action",
                    "description": "Custom",
                    "instruction": "Do it",
                    "parameters": [],
                },
            ],
        )

        agent = Agent(name="Test Agent", user_profile="Test", style="neutral")
        actions = scene.get_scene_actions(agent)

        action_names = [a.NAME for a in actions if hasattr(a, "NAME")]
        assert "custom_action" in action_names


class TestSceneSerialization:
    """Tests for scene serialization and deserialization."""

    def test_scene_serialize_config(self):
        """Test scene serialization."""
        scene = GenericScene(
            name="Serialize Test",
            initial_event="Test",
            mechanics_config=[
                {"type": "grid", "config": {"width": 8, "height": 8}},
            ],
            semantic_actions_config=[
                {
                    "name": "test_action",
                    "description": "Test",
                    "instruction": "Test",
                    "parameters": [],
                },
            ],
            environment={"description": "Test env"},
        )

        config = scene.serialize_config()

        assert "mechanics_config" in config
        assert "semantic_actions_config" in config
        assert "environment" in config
        assert len(config["mechanics_config"]) == 1
        assert len(config["semantic_actions_config"]) == 1
        assert config["environment"]["description"] == "Test env"

    def test_scene_deserialize_config(self):
        """Test scene deserialization."""
        config = {
            "mechanics_config": [
                {"type": "grid", "config": {"width": 12, "height": 12}},
            ],
            "semantic_actions_config": [
                {
                    "name": "test_action",
                    "description": "Test",
                    "instruction": "Test",
                    "parameters": [],
                },
            ],
            "environment": {"description": "Test env"},
        }

        kwargs = GenericScene.deserialize_config(config)

        assert kwargs["mechanics_config"][0]["type"] == "grid"
        assert kwargs["environment"]["description"] == "Test env"


class TestJsonSchemaExport:
    """Tests for JSON schema export functionality."""

    def test_export_json_schema_returns_dict(self):
        """Test that export_json_schema returns a dictionary."""
        schema = export_json_schema()
        assert isinstance(schema, dict)

    def test_json_schema_has_dollar_schema(self):
        """Test that JSON schema has $schema field."""
        schema = export_json_schema()
        assert "$schema" in schema
        assert "json-schema.org" in schema["$schema"]

    def test_json_schema_has_properties(self):
        """Test that JSON schema has properties."""
        schema = export_json_schema()
        assert "properties" in schema

        # Check for expected template properties
        props = schema["properties"]
        assert "id" in props
        assert "name" in props
        assert "description" in props


class TestTemplateValidation:
    """Tests for template validation."""

    def test_valid_minimal_template(self):
        """Test validation of a minimal valid template."""
        data = {
            "id": "minimal",
            "name": "Minimal",
            "description": "A minimal template",
        }

        template = GenericTemplate.model_validate(data)
        assert template.id == "minimal"
        assert template.name == "Minimal"

    def test_invalid_template_missing_required_field(self):
        """Test that validation fails with missing required field."""
        data = {
            "name": "Incomplete",
            # Missing 'id' and 'description'
        }

        with pytest.raises(Exception):  # ValidationError
            GenericTemplate.model_validate(data)

    def test_invalid_mechanic_type(self):
        """Test that invalid mechanic type fails validation."""
        data = {
            "id": "invalid",
            "name": "Invalid",
            "description": "Invalid mechanic",
            "core_mechanics": [
                {"type": "not_a_real_type", "config": {}},
            ],
        }

        with pytest.raises(Exception):  # ValidationError
            GenericTemplate.model_validate(data)

    def test_invalid_action_name_format(self):
        """Test that invalid action name format fails validation."""
        data = {
            "id": "invalid_action",
            "name": "Invalid Action",
            "description": "Invalid action name",
            "semantic_actions": [
                {
                    "name": "InvalidCamelCase",
                    "description": "Bad format",
                    "instruction": "Bad",
                },
            ],
        }

        with pytest.raises(Exception):  # ValidationError
            GenericTemplate.model_validate(data)
