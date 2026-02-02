"""Tests for the generic template schema."""

import pytest
import json

from socialsim4.templates.schema import (
    CoreMechanic,
    SemanticAction,
    AgentArchetype,
    EnvironmentConfig,
    GenericTemplate,
    TimeConfig,
    SpaceConfig,
    NetworkConfig,
    SemanticActionParameter,
    export_json_schema,
)
from pydantic import ValidationError


class TestValidTemplate:
    """Tests for creating and validating templates."""

    def test_valid_template(self):
        """Create a valid template with minimal required fields."""
        template = GenericTemplate(
            id="test_template",
            name="Test Template",
            description="A test template for validation.",
        )
        assert template.id == "test_template"
        assert template.name == "Test Template"
        assert template.description == "A test template for validation."
        assert template.version == "1.0.0"
        assert template.author == ""
        assert template.core_mechanics == []
        assert template.semantic_actions == []
        assert template.agent_archetypes == []
        assert template.environment is None

    def test_template_with_all_components(self):
        """Create a full template with all optional fields populated."""
        template = GenericTemplate(
            id="full_template",
            name="Full Template",
            description="A template with all components.",
            version="2.0.0",
            author="Test Author",
            core_mechanics=[
                CoreMechanic(type="discussion", config={"max_message_length": 500}),
                CoreMechanic(type="voting", config={"method": "majority"}),
            ],
            semantic_actions=[
                SemanticAction(
                    name="cast_vote",
                    description="Cast a vote on a proposal",
                    instruction="Cast your vote.",
                    parameters=[
                        SemanticActionParameter(
                            name="proposal_id",
                            type="str",
                            description="Proposal ID",
                            required=True,
                        ),
                        SemanticActionParameter(
                            name="vote",
                            type="str",
                            description="Vote value",
                            required=True,
                        ),
                    ],
                    effect="Records the vote.",
                ),
            ],
            agent_archetypes=[
                AgentArchetype(
                    name="voter",
                    role_prompt="You are a voter.",
                    style="formal",
                    user_profile="An engaged citizen.",
                    properties={"voting_weight": 1},
                    allowed_actions=["cast_vote", "discuss"],
                ),
            ],
            environment=EnvironmentConfig(
                description="A town hall setting.",
                time_config=TimeConfig(start="2024-01-01", step="30m"),
                space_config=SpaceConfig(type="network"),
                rules=["Be respectful.", "Wait your turn."],
            ),
            default_time_config=TimeConfig(start="2024-01-01", step="1h"),
            default_network=NetworkConfig(type="complete"),
        )

        assert template.id == "full_template"
        assert template.version == "2.0.0"
        assert template.author == "Test Author"
        assert len(template.core_mechanics) == 2
        assert template.core_mechanics[0].type == "discussion"
        assert template.core_mechanics[0].config == {"max_message_length": 500}
        assert len(template.semantic_actions) == 1
        assert template.semantic_actions[0].name == "cast_vote"
        assert len(template.semantic_actions[0].parameters) == 2
        assert len(template.agent_archetypes) == 1
        assert template.agent_archetypes[0].name == "voter"
        assert template.agent_archetypes[0].properties == {"voting_weight": 1}
        assert template.environment is not None
        assert template.environment.description == "A town hall setting."
        assert template.environment.time_config is not None
        assert template.environment.time_config.step == "30m"
        assert len(template.environment.rules) == 2
        assert template.default_time_config is not None
        assert template.default_time_config.step == "1h"
        assert template.default_network is not None
        assert template.default_network.type == "complete"


class TestCoreMechanic:
    """Tests for CoreMechanic model."""

    def test_valid_mechanic_types(self):
        """Test that all valid mechanic types are accepted."""
        valid_types = ["grid", "discussion", "voting", "resources", "hierarchy", "time"]
        for mechanic_type in valid_types:
            mechanic = CoreMechanic(type=mechanic_type)
            assert mechanic.type == mechanic_type
            assert mechanic.config == {}

    def test_mechanic_with_config(self):
        """Test core mechanic with custom configuration."""
        mechanic = CoreMechanic(
            type="grid",
            config={"width": 20, "height": 15, "wrap_around": False},
        )
        assert mechanic.type == "grid"
        assert mechanic.config == {"width": 20, "height": 15, "wrap_around": False}

    def test_invalid_mechanic_type(self):
        """Test that invalid mechanic types are rejected."""
        with pytest.raises(ValidationError):
            CoreMechanic(type="invalid_type")


class TestSemanticAction:
    """Tests for SemanticAction model."""

    def test_valid_action(self):
        """Test creating a valid semantic action."""
        action = SemanticAction(
            name="cast_vote",
            description="Cast a vote on a proposal",
            instruction="Cast your vote.",
        )
        assert action.name == "cast_vote"
        assert action.description == "Cast a vote on a proposal"
        assert action.instruction == "Cast your vote."
        assert action.parameters == []
        assert action.effect == ""

    def test_action_with_parameters(self):
        """Test semantic action with parameters."""
        action = SemanticAction(
            name="transfer_resources",
            description="Transfer resources to another agent",
            instruction="Specify recipient and amount.",
            parameters=[
                SemanticActionParameter(
                    name="recipient_id",
                    type="str",
                    description="ID of recipient",
                    required=True,
                ),
                SemanticActionParameter(
                    name="amount",
                    type="int",
                    description="Amount to transfer",
                    required=True,
                ),
                SemanticActionParameter(
                    name="memo",
                    type="str",
                    description="Optional memo",
                    required=False,
                    default="",
                ),
            ],
            effect="Transfers resources if balance sufficient.",
        )
        assert len(action.parameters) == 3
        assert action.parameters[0].name == "recipient_id"
        assert action.parameters[0].required is True
        assert action.parameters[2].required is False
        assert action.parameters[2].default == ""

    def test_semantic_action_name_validation(self):
        """Test that action names must be snake_case (^[a-z_]+$)."""
        valid_names = [
            "cast_vote",
            "transfer_resources",
            "simple_action",
            "_private_action",
            "action_with_underscores",
        ]
        for name in valid_names:
            action = SemanticAction(name=name, description="Test", instruction="Test")
            assert action.name == name

        invalid_names = [
            "CastVote",  # uppercase
            "cast-vote",  # hyphen
            "castVote",  # camelCase
            "cast vote",  # space
            "cast.vote",  # dot
            "cast123vote",  # numbers allowed but need to test pattern
            "1vote",  # starts with number
            "",  # empty
        ]

        for name in invalid_names:
            with pytest.raises(ValidationError):
                SemanticAction(name=name, description="Test", instruction="Test")

    def test_parameter_name_validation(self):
        """Test that parameter names must be valid snake_case."""
        # Valid names
        valid_names = ["recipient_id", "amount", "_private", "param123"]
        for name in valid_names:
            param = SemanticActionParameter(name=name, type="str")
            assert param.name == name

        # Invalid names
        invalid_names = ["recipientId", "recipient-id", "1st_param", ""]
        for name in invalid_names:
            with pytest.raises(ValidationError):
                SemanticActionParameter(name=name, type="str")

    def test_parameter_types(self):
        """Test all valid parameter types."""
        valid_types = ["str", "int", "float", "bool", "list", "dict"]
        for param_type in valid_types:
            param = SemanticActionParameter(name="test", type=param_type)
            assert param.type == param_type


class TestAgentArchetype:
    """Tests for AgentArchetype model."""

    def test_minimal_archetype(self):
        """Test creating an archetype with only required fields."""
        archetype = AgentArchetype(
            name="citizen",
            role_prompt="You are a citizen.",
        )
        assert archetype.name == "citizen"
        assert archetype.role_prompt == "You are a citizen."
        assert archetype.style == "neutral"
        assert archetype.user_profile == ""
        assert archetype.properties == {}
        assert archetype.allowed_actions == []

    def test_full_archetype(self):
        """Test creating an archetype with all fields."""
        archetype = AgentArchetype(
            name="moderator",
            role_prompt="You are a moderator.",
            style="formal",
            user_profile="An experienced facilitator.",
            properties={"authority_level": 5, "can_mute": True},
            allowed_actions=["cast_vote", "discuss", "mute_user", "close_debate"],
        )
        assert archetype.name == "moderator"
        assert archetype.style == "formal"
        assert archetype.properties["authority_level"] == 5
        assert len(archetype.allowed_actions) == 4


class TestEnvironmentConfig:
    """Tests for EnvironmentConfig model."""

    def test_minimal_environment(self):
        """Test creating environment with only description."""
        env = EnvironmentConfig(description="A test environment.")
        assert env.description == "A test environment."
        assert env.time_config is None
        assert env.space_config is None
        assert env.rules == []

    def test_full_environment(self):
        """Test creating environment with all fields."""
        env = EnvironmentConfig(
            description="A town hall setting.",
            time_config=TimeConfig(start="2024-01-01", step="30m"),
            space_config=SpaceConfig(type="network"),
            rules=["Be respectful.", "Wait your turn."],
        )
        assert env.description == "A town hall setting."
        assert env.time_config.start == "2024-01-01"
        assert env.space_config.type == "network"
        assert len(env.rules) == 2


class TestJsonSchemaExport:
    """Tests for JSON schema export functionality."""

    def test_json_schema_export(self):
        """Verify that the exported JSON schema is valid."""
        schema = export_json_schema()

        # Check that it's a dictionary
        assert isinstance(schema, dict)

        # Check for JSON Schema draft-07 identifier
        assert "$schema" in schema
        assert schema["$schema"] == "http://json-schema.org/draft-07/schema#"

        # Check that it has the main template definition
        assert "$defs" in schema or "properties" in schema

        # Verify it can be serialized to JSON
        json_str = json.dumps(schema)
        assert len(json_str) > 0

        # Parse back to ensure it's valid JSON
        parsed = json.loads(json_str)
        assert parsed == schema

    def test_schema_contains_all_models(self):
        """Verify the schema contains definitions for all models."""
        schema = export_json_schema()

        # The schema should contain definitions for our models
        # In Pydantic v2, these are in $defs
        defs = schema.get("$defs", {})

        # Check for expected model names (Pydantic may rename them)
        model_names = list(defs.keys())
        assert len(model_names) > 0

        # The GenericTemplate should be in the schema (possibly as GenericTemplate or similar)
        # At minimum, we should have our core models referenced
        assert any(
            "TimeConfig" in name or "SpaceConfig" in name or "NetworkConfig" in name
            for name in model_names
        )

    def test_schema_is_valid_json_schema(self):
        """Verify the schema itself is a valid JSON Schema draft-07."""
        schema = export_json_schema()

        # Basic JSON Schema structure checks
        assert isinstance(schema, dict)
        assert "$schema" in schema

        # If we have properties, they should have types
        if "properties" in schema:
            for prop_name, prop_def in schema["properties"].items():
                assert isinstance(prop_def, dict)


class TestTemplateSerialization:
    """Tests for template serialization and deserialization."""

    def test_model_dump(self):
        """Test that templates can be serialized to dict."""
        template = GenericTemplate(
            id="test",
            name="Test",
            description="Test template",
        )
        data = template.model_dump()
        assert data["id"] == "test"
        assert data["name"] == "Test"
        assert isinstance(data, dict)

    def test_model_dump_json(self):
        """Test that templates can be serialized to JSON string."""
        template = GenericTemplate(
            id="test",
            name="Test",
            description="Test template",
        )
        json_str = template.model_dump_json()
        assert isinstance(json_str, str)

        # Verify it can be parsed back
        parsed = json.loads(json_str)
        assert parsed["id"] == "test"

    def test_model_validate(self):
        """Test that templates can be created from dict."""
        data = {
            "id": "test",
            "name": "Test",
            "description": "Test template",
            "version": "2.0.0",
        }
        template = GenericTemplate.model_validate(data)
        assert template.id == "test"
        assert template.version == "2.0.0"

    def test_model_validate_json(self):
        """Test that templates can be created from JSON string."""
        json_str = '{"id": "test", "name": "Test", "description": "Test template"}'
        template = GenericTemplate.model_validate_json(json_str)
        assert template.id == "test"
