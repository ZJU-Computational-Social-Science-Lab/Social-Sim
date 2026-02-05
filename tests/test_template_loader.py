"""
Tests for the Template Loader module.
"""

import json
import tempfile
from pathlib import Path

import pytest
import yaml

from socialsim4.core.agent import Agent
from socialsim4.templates.loader import TemplateLoader, GenericScene
from socialsim4.templates.semantic_actions import SemanticActionFactory
from socialsim4.templates.schema import GenericTemplate


class TestLoadJsonTemplate:
    """Tests for loading templates from dictionaries."""

    def test_load_from_dict_minimal(self):
        """Test loading a minimal template from dict."""
        loader = TemplateLoader()
        data = {
            "id": "test_template",
            "name": "Test Template",
            "description": "A test template",
        }

        template = loader.load_from_dict(data)

        assert isinstance(template, GenericTemplate)
        assert template.id == "test_template"
        assert template.name == "Test Template"
        assert template.description == "A test template"

    def test_load_from_dict_with_mechanics(self):
        """Test loading a template with mechanics from dict."""
        loader = TemplateLoader()
        data = {
            "id": "test_template",
            "name": "Test Template",
            "description": "A test template",
            "core_mechanics": [
                {"type": "grid", "config": {"width": 10, "height": 10}},
                {"type": "voting", "config": {"threshold": 0.67}},
            ],
        }

        template = loader.load_from_dict(data)

        assert len(template.core_mechanics) == 2
        assert template.core_mechanics[0].type == "grid"
        assert template.core_mechanics[0].config["width"] == 10
        assert template.core_mechanics[1].type == "voting"
        assert template.core_mechanics[1].config["threshold"] == 0.67

    def test_load_from_dict_with_semantic_actions(self):
        """Test loading a template with semantic actions from dict."""
        loader = TemplateLoader()
        data = {
            "id": "test_template",
            "name": "Test Template",
            "description": "A test template",
            "semantic_actions": [
                {
                    "name": "pray",
                    "description": "Pray at the shrine",
                    "instruction": "Use when seeking spiritual guidance",
                    "parameters": [
                        {"name": "deity", "type": "str", "description": "Which deity"}
                    ],
                }
            ],
        }

        template = loader.load_from_dict(data)

        assert len(template.semantic_actions) == 1
        assert template.semantic_actions[0].name == "pray"
        assert template.semantic_actions[0].description == "Pray at the shrine"

    def test_load_from_dict_invalid_raises_error(self):
        """Test that invalid dict raises ValueError."""
        loader = TemplateLoader()
        # Missing required field 'id'
        data = {
            "name": "Test Template",
            "description": "A test template",
        }

        with pytest.raises(ValueError, match="Invalid template data"):
            loader.load_from_dict(data)


class TestLoadFromFile:
    """Tests for loading templates from files."""

    def test_load_from_json_file(self):
        """Test loading a template from a JSON file."""
        data = {
            "id": "json_template",
            "name": "JSON Template",
            "description": "Loaded from JSON",
            "core_mechanics": [
                {"type": "grid", "config": {"width": 15, "height": 15}},
            ],
        }

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f:
            json.dump(data, f)
            path = f.name

        try:
            loader = TemplateLoader()
            template = loader.load_from_file(path)

            assert template.id == "json_template"
            assert template.name == "JSON Template"
            assert len(template.core_mechanics) == 1
            assert template.core_mechanics[0].config["width"] == 15
        finally:
            Path(path).unlink()

    def test_load_from_yaml_file(self):
        """Test loading a template from a YAML file."""
        data = {
            "id": "yaml_template",
            "name": "YAML Template",
            "description": "Loaded from YAML",
            "core_mechanics": [
                {"type": "voting", "config": {"threshold": 0.75}},
            ],
        }

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".yaml", delete=False
        ) as f:
            yaml.dump(data, f)
            path = f.name

        try:
            loader = TemplateLoader()
            template = loader.load_from_file(path)

            assert template.id == "yaml_template"
            assert template.name == "YAML Template"
            assert len(template.core_mechanics) == 1
            assert template.core_mechanics[0].config["threshold"] == 0.75
        finally:
            Path(path).unlink()

    def test_load_from_yml_extension(self):
        """Test loading a template from .yml file."""
        data = {
            "id": "yml_template",
            "name": "YML Template",
            "description": "Loaded from YML",
        }

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".yml", delete=False
        ) as f:
            yaml.dump(data, f)
            path = f.name

        try:
            loader = TemplateLoader()
            template = loader.load_from_file(path)

            assert template.id == "yml_template"
        finally:
            Path(path).unlink()

    def test_load_from_file_not_found_raises_error(self):
        """Test that loading non-existent file raises FileNotFoundError."""
        loader = TemplateLoader()

        with pytest.raises(FileNotFoundError, match="not found"):
            loader.load_from_file("/nonexistent/path/template.json")

    def test_load_from_file_unsupported_extension_raises_error(self):
        """Test that unsupported file extension raises ValueError."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".txt", delete=False
        ) as f:
            f.write("not a valid format")
            path = f.name

        try:
            loader = TemplateLoader()
            with pytest.raises(ValueError, match="Unsupported file format"):
                loader.load_from_file(path)
        finally:
            Path(path).unlink()


class TestLoadFromDirectory:
    """Tests for loading multiple templates from a directory."""

    def test_load_from_directory(self):
        """Test loading all templates from a directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create JSON template
            json_data = {
                "id": "json_template",
                "name": "JSON Template",
                "description": "From JSON",
            }
            json_path = Path(tmpdir) / "template1.json"
            with open(json_path, "w") as f:
                json.dump(json_data, f)

            # Create YAML template
            yaml_data = {
                "id": "yaml_template",
                "name": "YAML Template",
                "description": "From YAML",
            }
            yaml_path = Path(tmpdir) / "template2.yaml"
            with open(yaml_path, "w") as f:
                yaml.dump(yaml_data, f)

            loader = TemplateLoader()
            templates = loader.load_from_directory(tmpdir)

            assert len(templates) == 2
            template_ids = {t.id for t in templates}
            assert "json_template" in template_ids
            assert "yaml_template" in template_ids

    def test_load_from_directory_not_found_raises_error(self):
        """Test that non-existent directory raises FileNotFoundError."""
        loader = TemplateLoader()

        with pytest.raises(FileNotFoundError, match="not found"):
            loader.load_from_directory("/nonexistent/directory")

    def test_load_from_directory_with_template_dir(self):
        """Test loading from relative path with template_dir set."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create subdirectory
            subdir = Path(tmpdir) / "templates"
            subdir.mkdir()

            # Create template file
            data = {
                "id": "relative_template",
                "name": "Relative Template",
                "description": "Loaded with relative path",
            }
            template_path = subdir / "template.json"
            with open(template_path, "w") as f:
                json.dump(data, f)

            # Load with template_dir set
            loader = TemplateLoader(template_dir=subdir)
            templates = loader.load_from_directory(".")

            assert len(templates) == 1
            assert templates[0].id == "relative_template"


class TestBuildSceneWithGridMechanic:
    """Tests for building scenes with grid mechanic."""

    def test_build_scene_with_grid_mechanic(self):
        """Test building a scene with grid mechanic."""
        SemanticActionFactory.clear()  # Clear before test

        loader = TemplateLoader()
        template = {
            "id": "grid_scene",
            "name": "Grid Scene",
            "description": "A scene with grid navigation",
            "core_mechanics": [
                {"type": "grid", "config": {"width": 20, "height": 20}},
            ],
        }

        scene = loader.build_scene_from_template(template)

        assert isinstance(scene, GenericScene)
        assert scene.name == "Grid Scene"
        assert len(scene.mechanics) == 1
        assert scene.mechanics[0].TYPE == "grid"
        assert "game_map" in scene.state
        assert scene.state["game_map"].width == 20

    def test_scene_initializes_agent_with_grid_properties(self):
        """Test that scene initializes agent with grid properties."""
        SemanticActionFactory.clear()

        loader = TemplateLoader()
        template = {
            "id": "grid_scene",
            "name": "Grid Scene",
            "description": "A scene with grid navigation",
            "core_mechanics": [
                {"type": "grid", "config": {"width": 20, "height": 20}},
            ],
        }

        scene = loader.build_scene_from_template(template)
        agent = Agent(name="TestAgent", user_profile="", style="")

        scene.initialize_agent(agent)

        assert "hunger" in agent.properties
        assert "energy" in agent.properties
        assert "inventory" in agent.properties
        assert "map_xy" in agent.properties
        assert "map_position" in agent.properties


class TestBuildSceneWithVotingMechanic:
    """Tests for building scenes with voting mechanic."""

    def test_build_scene_with_voting_mechanic(self):
        """Test building a scene with voting mechanic."""
        SemanticActionFactory.clear()

        loader = TemplateLoader()
        template = {
            "id": "voting_scene",
            "name": "Voting Scene",
            "description": "A scene with voting",
            "core_mechanics": [
                {
                    "type": "voting",
                    "config": {"threshold": 0.67, "timeout_turns": 15},
                },
            ],
        }

        scene = loader.build_scene_from_template(template)

        assert isinstance(scene, GenericScene)
        assert len(scene.mechanics) == 1
        assert scene.mechanics[0].TYPE == "voting"
        assert scene.state["voting_threshold"] == 0.67
        assert scene.state["voting_timeout"] == 15

    def test_scene_initializes_agent_with_voting_properties(self):
        """Test that scene initializes agent with voting properties."""
        SemanticActionFactory.clear()

        loader = TemplateLoader()
        template = {
            "id": "voting_scene",
            "name": "Voting Scene",
            "description": "A scene with voting",
            "core_mechanics": [
                {"type": "voting", "config": {}},
            ],
        }

        scene = loader.build_scene_from_template(template)
        agent = Agent(name="TestAgent", user_profile="", style="")

        scene.initialize_agent(agent)

        assert "votes_cast" in agent.properties
        assert agent.properties["votes_cast"] == 0


class TestBuildSceneWithMultipleMechanics:
    """Tests for building scenes with multiple mechanics."""

    def test_build_scene_with_grid_resources_and_voting(self):
        """Test building a scene with grid, resources, and voting mechanics."""
        SemanticActionFactory.clear()

        loader = TemplateLoader()
        template = {
            "id": "complex_scene",
            "name": "Complex Scene",
            "description": "A scene with multiple mechanics",
            "core_mechanics": [
                {"type": "grid", "config": {"width": 25, "height": 25}},
                {
                    "type": "resources",
                    "config": {
                        "resources": ["food", "wood", "stone"],
                        "initial_amount": 5,
                    },
                },
                {"type": "voting", "config": {"threshold": 0.6}},
            ],
        }

        scene = loader.build_scene_from_template(template)

        assert len(scene.mechanics) == 3

        mechanic_types = {m.TYPE for m in scene.mechanics}
        assert "grid" in mechanic_types
        assert "resources" in mechanic_types
        assert "voting" in mechanic_types

        # Check state contributions
        assert "game_map" in scene.state
        assert "available_resources" in scene.state
        assert "voting_threshold" in scene.state

    def test_scene_initializes_agent_with_all_mechanic_properties(self):
        """Test that scene initializes agent with all mechanic properties."""
        SemanticActionFactory.clear()

        loader = TemplateLoader()
        template = {
            "id": "complex_scene",
            "name": "Complex Scene",
            "description": "A scene with multiple mechanics",
            "core_mechanics": [
                {"type": "grid", "config": {}},
                {"type": "resources", "config": {"resources": ["food"]}},
                {"type": "voting", "config": {}},
            ],
        }

        scene = loader.build_scene_from_template(template)
        agent = Agent(name="TestAgent", user_profile="", style="")

        scene.initialize_agent(agent)

        # Grid properties
        assert "hunger" in agent.properties
        assert "energy" in agent.properties
        assert "map_xy" in agent.properties

        # Resource properties
        assert "inventory" in agent.properties
        assert "food" in agent.properties["inventory"]

        # Voting properties
        assert "votes_cast" in agent.properties


class TestSceneActionsIncludeMechanics:
    """Tests for scene actions from mechanics."""

    def setup_method(self):
        """Clear semantic action factory before each test."""
        SemanticActionFactory.clear()

    def test_scene_actions_include_grid_actions(self):
        """Test that scene provides grid mechanic actions."""
        loader = TemplateLoader()
        template = {
            "id": "grid_scene",
            "name": "Grid Scene",
            "description": "A scene with grid",
            "core_mechanics": [{"type": "grid", "config": {}}],
        }

        scene = loader.build_scene_from_template(template)
        agent = Agent(name="TestAgent", user_profile="", style="")
        scene.initialize_agent(agent)

        actions = scene.get_scene_actions(agent)
        action_names = [a.NAME for a in actions]

        assert "move_to_location" in action_names
        assert "look_around" in action_names
        assert "rest" in action_names

    def test_scene_actions_include_voting_actions(self):
        """Test that scene provides voting mechanic actions."""
        loader = TemplateLoader()
        template = {
            "id": "voting_scene",
            "name": "Voting Scene",
            "description": "A scene with voting",
            "core_mechanics": [{"type": "voting", "config": {}}],
        }

        scene = loader.build_scene_from_template(template)
        agent = Agent(name="TestAgent", user_profile="", style="")
        scene.initialize_agent(agent)

        actions = scene.get_scene_actions(agent)
        action_names = [a.NAME for a in actions]

        assert "vote" in action_names
        assert "voting_status" in action_names

    def test_scene_actions_include_resource_actions(self):
        """Test that scene provides resource mechanic actions."""
        loader = TemplateLoader()
        template = {
            "id": "resource_scene",
            "name": "Resource Scene",
            "description": "A scene with resources",
            "core_mechanics": [{"type": "resources", "config": {}}],
        }

        scene = loader.build_scene_from_template(template)
        agent = Agent(name="TestAgent", user_profile="", style="")
        scene.initialize_agent(agent)

        actions = scene.get_scene_actions(agent)
        action_names = [a.NAME for a in actions]

        assert "gather_resource" in action_names

    def test_scene_actions_include_yield_from_base_scene(self):
        """Test that scene always includes yield action from base Scene."""
        loader = TemplateLoader()
        template = {
            "id": "minimal_scene",
            "name": "Minimal Scene",
            "description": "A minimal scene",
        }

        scene = loader.build_scene_from_template(template)
        agent = Agent(name="TestAgent", user_profile="", style="")

        actions = scene.get_scene_actions(agent)
        action_names = [a.NAME for a in actions]

        # Base Scene always provides YieldAction (named "yield")
        assert "yield" in action_names


class TestSceneActionsIncludeSemanticActions:
    """Tests for semantic actions in scenes."""

    def test_scene_actions_include_semantic_actions(self):
        """Test that scene provides semantic actions."""
        SemanticActionFactory.clear()

        loader = TemplateLoader()
        template = {
            "id": "semantic_scene",
            "name": "Semantic Scene",
            "description": "A scene with semantic actions",
            "semantic_actions": [
                {
                    "name": "pray",
                    "description": "Pray at the shrine",
                    "instruction": "Use when seeking guidance",
                    "parameters": [
                        {"name": "deity", "type": "str", "description": "Which deity"}
                    ],
                },
                {
                    "name": "trade",
                    "description": "Trade with another agent",
                    "instruction": "Use when exchanging goods",
                },
            ],
        }

        scene = loader.build_scene_from_template(template)
        agent = Agent(name="TestAgent", user_profile="", style="")

        actions = scene.get_scene_actions(agent)
        action_names = [a.NAME for a in actions]

        assert "pray" in action_names
        assert "trade" in action_names
        # Should also have yield from base Scene
        assert "yield" in action_names

    def test_semantic_action_has_correct_properties(self):
        """Test that semantic actions have correct properties."""
        SemanticActionFactory.clear()

        loader = TemplateLoader()
        template = {
            "id": "semantic_scene",
            "name": "Semantic Scene",
            "description": "A scene with semantic actions",
            "semantic_actions": [
                {
                    "name": "cast_spell",
                    "description": "Cast a magical spell",
                    "instruction": "Use when casting magic",
                    "parameters": [
                        {"name": "spell", "type": "str", "description": "Spell name"},
                        {"name": "target", "type": "str", "description": "Target"},
                    ],
                },
            ],
        }

        scene = loader.build_scene_from_template(template)

        assert len(scene.semantic_actions) == 1
        action = scene.semantic_actions[0]
        assert action.NAME == "cast_spell"
        assert action.DESC == "Cast a magical spell"
        assert "spell" in action.parameters
        assert "target" in action.parameters


class TestAgentInitialization:
    """Tests for agent initialization with mechanics."""

    def setup_method(self):
        """Clear semantic action factory before each test."""
        SemanticActionFactory.clear()

    def test_agent_initialization_with_no_mechanics(self):
        """Test agent initialization when scene has no mechanics."""
        loader = TemplateLoader()
        template = {
            "id": "empty_scene",
            "name": "Empty Scene",
            "description": "A scene without mechanics",
        }

        scene = loader.build_scene_from_template(template)
        agent = Agent(name="TestAgent", user_profile="", style="", properties={})

        # Should not raise an error
        scene.initialize_agent(agent)

    def test_agent_initialization_preserves_existing_properties(self):
        """Test that initialization doesn't overwrite existing properties."""
        loader = TemplateLoader()
        template = {
            "id": "grid_scene",
            "name": "Grid Scene",
            "description": "A scene with grid",
            "core_mechanics": [{"type": "grid", "config": {}}],
        }

        scene = loader.build_scene_from_template(template)
        agent = Agent(
            name="TestAgent",
            user_profile="",
            style="",
            custom_prop="custom_value",
            energy=50
        )

        scene.initialize_agent(agent)

        # Custom property should be preserved
        assert agent.properties["custom_prop"] == "custom_value"
        # Grid mechanic should use setdefault, so existing energy should be preserved
        assert agent.properties["energy"] == 50

    def test_multiple_agents_get_independent_properties(self):
        """Test that multiple agents get independent property sets."""
        loader = TemplateLoader()
        template = {
            "id": "grid_scene",
            "name": "Grid Scene",
            "description": "A scene with grid",
            "core_mechanics": [
                {"type": "grid", "config": {}},
                {"type": "resources", "config": {"resources": ["food"]}},
            ],
        }

        scene = loader.build_scene_from_template(template)
        agent1 = Agent(name="Agent1", user_profile="", style="")
        agent2 = Agent(name="Agent2", user_profile="", style="")

        scene.initialize_agent(agent1)
        scene.initialize_agent(agent2)

        # Each agent should have their own independent properties
        assert agent1.properties["map_xy"] == agent2.properties["map_xy"]
        # But we can modify one independently
        agent1.properties["energy"] = 75
        assert agent2.properties["energy"] == 100  # Default value


class TestCompactDescription:
    """Tests for compact description generation."""

    def setup_method(self):
        """Clear semantic action factory before each test."""
        SemanticActionFactory.clear()

    def test_compact_description_with_environment(self):
        """Test compact description includes environment description."""
        loader = TemplateLoader()
        template = {
            "id": "env_scene",
            "name": "Environment Scene",
            "description": "A scenic village",
            "environment": {
                "description": "A peaceful village surrounded by mountains",
                "rules": ["Be respectful", "Help your neighbors"],
            },
        }

        scene = loader.build_scene_from_template(template)
        description = scene.get_compact_description()

        assert "peaceful village" in description
        assert "mountains" in description
        assert "Be respectful" in description
        assert "Help your neighbors" in description

    def test_compact_description_with_grid_mechanic(self):
        """Test compact description includes grid information."""
        loader = TemplateLoader()
        template = {
            "id": "grid_scene",
            "name": "Grid Scene",
            "description": "A grid scene",
            "core_mechanics": [{"type": "grid", "config": {"width": 30, "height": 30}}],
        }

        scene = loader.build_scene_from_template(template)
        description = scene.get_compact_description()

        assert "30x30" in description
        assert "grid" in description.lower()

    def test_compact_description_with_voting_mechanic(self):
        """Test compact description includes voting information."""
        loader = TemplateLoader()
        template = {
            "id": "voting_scene",
            "name": "Voting Scene",
            "description": "A voting scene",
            "core_mechanics": [{"type": "voting", "config": {"threshold": 0.75}}],
        }

        scene = loader.build_scene_from_template(template)
        description = scene.get_compact_description()

        assert "75%" in description
        assert "voting" in description.lower()

    def test_compact_description_with_resources_mechanic(self):
        """Test compact description includes resources information."""
        loader = TemplateLoader()
        template = {
            "id": "resource_scene",
            "name": "Resource Scene",
            "description": "A resource scene",
            "core_mechanics": [
                {
                    "type": "resources",
                    "config": {"resources": ["gold", "silver", "gems"]},
                }
            ],
        }

        scene = loader.build_scene_from_template(template)
        description = scene.get_compact_description()

        assert "gold" in description
        assert "silver" in description
        assert "gems" in description

    def test_compact_description_with_multiple_mechanics(self):
        """Test compact description combines multiple mechanics."""
        loader = TemplateLoader()
        template = {
            "id": "complex_scene",
            "name": "Complex Scene",
            "description": "A complex scene",
            "core_mechanics": [
                {"type": "grid", "config": {"width": 20, "height": 20}},
                {"type": "voting", "config": {"threshold": 0.5}},
                {"type": "resources", "config": {"resources": ["food"]}},
            ],
        }

        scene = loader.build_scene_from_template(template)
        description = scene.get_compact_description()

        # Should include all mechanics
        assert "grid" in description.lower()
        assert "voting" in description.lower()
        assert "food" in description

    def test_compact_description_empty_for_minimal_scene(self):
        """Test compact description for scene with minimal configuration."""
        loader = TemplateLoader()
        template = {
            "id": "minimal_scene",
            "name": "Minimal Scene",
            "description": "",
        }

        scene = loader.build_scene_from_template(template)
        description = scene.get_compact_description()

        # Should return empty string or minimal content
        assert description == "" or len(description) < 10


class TestScenarioDescription:
    """Tests for scenario description method."""

    def test_get_scenario_description_with_environment(self):
        """Test get_scenario_description returns environment description."""
        SemanticActionFactory.clear()

        loader = TemplateLoader()
        template = {
            "id": "test_scene",
            "name": "Test Scene",
            "description": "This is the scenario description",
        }

        scene = loader.build_scene_from_template(template)
        desc = scene.get_scenario_description()

        assert desc == "This is the scenario description"

    def test_get_scenario_description_without_environment(self):
        """Test get_scenario_description returns empty string when no environment."""
        SemanticActionFactory.clear()

        loader = TemplateLoader()
        template = {
            "id": "test_scene",
            "name": "Test Scene",
            "description": "",
        }

        scene = loader.build_scene_from_template(template)
        desc = scene.get_scenario_description()

        assert desc == ""


class TestBehaviorGuidelines:
    """Tests for behavior guidelines method."""

    def test_get_behavior_guidelines_with_rules(self):
        """Test get_behavior_guidelines returns rules."""
        SemanticActionFactory.clear()

        loader = TemplateLoader()
        template = {
            "id": "test_scene",
            "name": "Test Scene",
            "description": "A test scene",
            "environment": {
                "rules": ["Rule 1", "Rule 2", "Rule 3"],
            },
        }

        scene = loader.build_scene_from_template(template)
        guidelines = scene.get_behavior_guidelines()

        assert "- Rule 1" in guidelines
        assert "- Rule 2" in guidelines
        assert "- Rule 3" in guidelines

    def test_get_behavior_guidelines_without_rules(self):
        """Test get_behavior_guidelines returns empty string when no rules."""
        SemanticActionFactory.clear()

        loader = TemplateLoader()
        template = {
            "id": "test_scene",
            "name": "Test Scene",
            "description": "A test scene",
        }

        scene = loader.build_scene_from_template(template)
        guidelines = scene.get_behavior_guidelines()

        assert guidelines == ""


class TestSceneSerialization:
    """Tests for scene serialization and deserialization."""

    def setup_method(self):
        """Clear semantic action factory before each test."""
        SemanticActionFactory.clear()

    def test_scene_serialization_config(self):
        """Test scene serialize_config returns correct structure."""
        loader = TemplateLoader()
        template = {
            "id": "test_scene",
            "name": "Test Scene",
            "description": "A test scene",
            "core_mechanics": [{"type": "grid", "config": {"width": 20}}],
            "semantic_actions": [
                {
                    "name": "test_action",
                    "description": "A test action",
                    "instruction": "Test instruction",
                }
            ],
            "environment": {"description": "Test environment", "rules": ["Rule 1"]},
        }

        scene = loader.build_scene_from_template(template)
        config = scene.serialize_config()

        assert "mechanics_config" in config
        assert "semantic_actions_config" in config
        assert "environment" in config
        assert len(config["mechanics_config"]) == 1
        assert config["mechanics_config"][0]["type"] == "grid"
        assert len(config["semantic_actions_config"]) == 1
        assert config["semantic_actions_config"][0]["name"] == "test_action"
        assert config["environment"]["description"] == "Test environment"

    def test_scene_deserialization_config(self):
        """Test scene deserialize_config returns correct kwargs."""
        config = {
            "mechanics_config": [{"type": "grid", "config": {"width": 20}}],
            "semantic_actions_config": [{"name": "test"}],
            "environment": {"description": "Test"},
        }

        kwargs = GenericScene.deserialize_config(config)

        assert "mechanics_config" in kwargs
        assert "semantic_actions_config" in kwargs
        assert "environment" in kwargs
        assert kwargs["mechanics_config"][0]["type"] == "grid"
        assert kwargs["semantic_actions_config"][0]["name"] == "test"
        assert kwargs["environment"]["description"] == "Test"

    def test_scene_full_serialization(self):
        """Test full scene serialization through base class method."""
        loader = TemplateLoader()
        template = {
            "id": "test_scene",
            "name": "Test Scene",
            "description": "A test scene",
            "core_mechanics": [{"type": "grid", "config": {"width": 20}}],
        }

        scene = loader.build_scene_from_template(template)
        serialized = scene.serialize()

        assert serialized["type"] == "generic_scene"
        assert serialized["name"] == "Test Scene"
        assert serialized["initial_event"] == "A test scene"
        assert "config" in serialized
        assert "mechanics_config" in serialized["config"]
