"""Tests for the template API endpoints in scenes routes."""

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from socialsim4.backend.api.routes.scenes import (
    build_scene_from_template,
    get_template_loader,
    get_template_schema,
    list_templates,
    load_all_templates,
    validate_template,
)
from socialsim4.templates.loader import GenericScene, TemplateLoader
from socialsim4.templates.schema import GenericTemplate


class TestListTemplates:
    """Tests for the list_templates endpoint."""

    def test_list_templates_returns_dict(self):
        """Test that list_templates returns a dict with system and user keys."""
        result = list_templates()
        assert isinstance(result, dict)
        assert "system" in result
        assert "user" in result
        assert isinstance(result["system"], list)
        assert isinstance(result["user"], list)

    def test_list_templates_empty_initially(self):
        """Test that list_templates returns empty lists when no templates exist."""
        result = list_templates()
        # Assuming no templates are present initially
        assert len(result["system"]) == 0  # System templates may not exist
        assert len(result["user"]) == 0  # User templates should be empty


class TestValidateTemplate:
    """Tests for the validate_template endpoint."""

    def test_validate_minimal_template(self):
        """Test validating a minimal valid template."""
        data = {
            "id": "test_template",
            "name": "Test Template",
            "description": "A test template",
        }
        result = validate_template(data)
        assert result["valid"] is True
        assert result["template"]["id"] == "test_template"
        assert result["template"]["name"] == "Test Template"

    def test_validate_full_template(self):
        """Test validating a full template with all components."""
        data = {
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
                }
            ],
            "environment": {
                "description": "A test environment",
                "rules": ["Rule 1", "Rule 2"],
            },
        }
        result = validate_template(data)
        assert result["valid"] is True
        assert result["template"]["id"] == "full_template"
        assert result["template"]["version"] == "1.0.0"
        assert result["template"]["author"] == "Test Author"

    def test_validate_missing_required_fields(self):
        """Test that validation fails with missing required fields."""
        data = {
            "name": "Incomplete Template",
            # Missing required 'id' and 'description'
        }
        result = validate_template(data)
        assert result["valid"] is False
        assert "errors" in result
        assert len(result["errors"]) > 0

    def test_validate_invalid_mechanic_type(self):
        """Test that validation fails with invalid mechanic type."""
        data = {
            "id": "invalid_mechanic",
            "name": "Invalid Mechanic",
            "description": "Template with invalid mechanic",
            "core_mechanics": [
                {"type": "invalid_type", "config": {}},
            ],
        }
        result = validate_template(data)
        assert result["valid"] is False
        assert "errors" in result

    def test_validate_invalid_action_name(self):
        """Test that validation fails with invalid action name."""
        data = {
            "id": "invalid_action",
            "name": "Invalid Action",
            "description": "Template with invalid action name",
            "semantic_actions": [
                {
                    "name": "InvalidName",  # Not snake_case
                    "description": "Invalid",
                    "instruction": "Invalid",
                },
            ],
        }
        result = validate_template(data)
        assert result["valid"] is False
        assert "errors" in result


class TestBuildSceneFromTemplate:
    """Tests for the build_scene_from_template endpoint."""

    def test_build_scene_minimal_template(self):
        """Test building a scene from a minimal template."""
        data = {
            "id": "minimal_scene",
            "name": "Minimal Scene",
            "description": "A minimal scene for testing",
        }
        result = build_scene_from_template(data)
        assert result["scene_type"] == "generic_scene"
        assert result["scene_name"] == "Minimal Scene"
        assert result["description"] == "A minimal scene for testing"

    def test_build_scene_with_mechanics(self):
        """Test building a scene with core mechanics."""
        data = {
            "id": "mechanics_scene",
            "name": "Mechanics Scene",
            "description": "Scene with mechanics",
            "core_mechanics": [
                {"type": "grid", "config": {"width": 15, "height": 20}},
            ],
        }
        result = build_scene_from_template(data)
        assert result["scene_type"] == "generic_scene"
        assert len(result["mechanics_config"]) == 1
        assert result["mechanics_config"][0]["type"] == "grid"

    def test_build_scene_with_semantic_actions(self):
        """Test building a scene with semantic actions."""
        data = {
            "id": "actions_scene",
            "name": "Actions Scene",
            "description": "Scene with semantic actions",
            "semantic_actions": [
                {
                    "name": "custom_action",
                    "description": "A custom action",
                    "instruction": "Perform this action",
                    "parameters": [
                        {
                            "name": "target",
                            "type": "str",
                            "description": "Target of the action",
                            "required": True,
                        }
                    ],
                },
            ],
        }
        result = build_scene_from_template(data)
        assert result["scene_type"] == "generic_scene"
        assert len(result["semantic_actions_config"]) == 1
        assert result["semantic_actions_config"][0]["name"] == "custom_action"

    def test_build_scene_with_environment(self):
        """Test building a scene with environment configuration."""
        data = {
            "id": "env_scene",
            "name": "Environment Scene",
            "description": "Scene with environment",
            "environment": {
                "description": "A custom environment",
                "rules": ["Rule 1", "Rule 2"],
                "time_config": {"start": "2024-01-01", "step": "1h"},
            },
        }
        result = build_scene_from_template(data)
        assert result["scene_type"] == "generic_scene"
        assert result["environment"]["description"] == "A custom environment"
        assert len(result["environment"]["rules"]) == 2

    def test_build_full_scene(self):
        """Test building a scene with all components."""
        data = {
            "id": "full_scene",
            "name": "Full Scene",
            "description": "A complete scene",
            "version": "1.0.0",
            "core_mechanics": [
                {"type": "grid", "config": {"width": 10, "height": 10}},
                {"type": "voting", "config": {"method": "majority"}},
            ],
            "semantic_actions": [
                {
                    "name": "cast_vote",
                    "description": "Cast a vote",
                    "instruction": "Cast your vote on a proposal",
                    "parameters": [
                        {"name": "proposal_id", "type": "str", "required": True},
                        {"name": "vote", "type": "str", "required": True},
                    ],
                }
            ],
            "environment": {
                "description": "A town hall meeting",
                "time_config": {"start": "2024-01-01", "step": "30m"},
            },
        }
        result = build_scene_from_template(data)
        assert result["scene_type"] == "generic_scene"
        assert result["scene_name"] == "Full Scene"
        assert len(result["mechanics_config"]) == 2
        assert len(result["semantic_actions_config"]) == 1
        assert result["environment"]["description"] == "A town hall meeting"


class TestGetTemplateSchema:
    """Tests for the get_template_schema endpoint."""

    def test_schema_returns_dict(self):
        """Test that schema endpoint returns a dictionary."""
        schema = get_template_schema()
        assert isinstance(schema, dict)

    def test_schema_has_required_fields(self):
        """Test that schema has required JSON Schema fields."""
        schema = get_template_schema()
        assert "$schema" in schema
        assert schema["$schema"] == "http://json-schema.org/draft-07/schema#"

    def test_schema_contains_template_properties(self):
        """Test that schema contains GenericTemplate properties."""
        schema = get_template_schema()
        # The schema should contain properties from GenericTemplate
        assert "properties" in schema
        props = schema["properties"]
        # Check for some expected properties
        assert "id" in props
        assert "name" in props
        assert "description" in props


class TestLoadAllTemplates:
    """Tests for the load_all_templates function."""

    def test_load_templates_from_empty_directory(self, tmp_path):
        """Test loading templates from an empty directory."""
        # Create a temporary empty directory
        empty_dir = tmp_path / "templates"
        empty_dir.mkdir()

        loader = TemplateLoader(template_dir=str(empty_dir))
        templates = loader.load_from_directory(empty_dir)

        assert isinstance(templates, list)
        assert len(templates) == 0

    def test_load_templates_with_json_file(self, tmp_path):
        """Test loading templates from a JSON file."""
        template_data = {
            "id": "test_json",
            "name": "JSON Template",
            "description": "A template from JSON",
        }

        template_file = tmp_path / "test_template.json"
        with open(template_file, "w") as f:
            json.dump(template_data, f)

        loader = TemplateLoader(template_dir=str(tmp_path))
        templates = loader.load_from_directory(tmp_path)

        assert len(templates) == 1
        assert templates[0].id == "test_json"
        assert templates[0].name == "JSON Template"

    def test_load_templates_with_yaml_file(self, tmp_path):
        """Test loading templates from a YAML file."""
        yaml_content = """
id: test_yaml
name: YAML Template
description: A template from YAML
"""
        template_file = tmp_path / "test_template.yaml"
        with open(template_file, "w") as f:
            f.write(yaml_content)

        loader = TemplateLoader(template_dir=str(tmp_path))
        templates = loader.load_from_directory(tmp_path)

        assert len(templates) == 1
        assert templates[0].id == "test_yaml"
        assert templates[0].name == "YAML Template"


class TestGetTemplateLoader:
    """Tests for the get_template_loader function."""

    def test_loader_has_template_dir_set(self):
        """Test that the loader has template_dir configured."""
        loader = get_template_loader()
        assert loader.template_dir is not None
        assert isinstance(loader.template_dir, Path)

    def test_user_templates_dir_exists(self):
        """Test that the user templates directory is created."""
        from socialsim4.backend.api.routes.scenes import USER_TEMPLATES_DIR

        # The directory should exist after calling get_template_loader
        loader = get_template_loader()
        assert USER_TEMPLATES_DIR.exists()
        assert USER_TEMPLATES_DIR.is_dir()
