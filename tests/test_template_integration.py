"""Integration tests for the generic template system.

These tests verify the end-to-end flow of loading templates and building scenes,
including prompt generation with agents.
"""

import json
import pytest
from pathlib import Path

from socialsim4.core.agent import Agent
from socialsim4.core.scene import Scene
from socialsim4.templates.loader import TemplateLoader, GenericScene
from socialsim4.templates.semantic_actions import SemanticActionFactory
from socialsim4.templates.schema import GenericTemplate


class TestVillageTemplateEndToEnd:
    """End-to-end test for the village template."""

    def setup_method(self):
        """Clear semantic action factory before each test."""
        SemanticActionFactory.clear()

    def test_village_template_end_to_end(self):
        """Load village.json, build scene, create agent, verify properties and actions."""
        # Path to village template
        template_path = (
            Path(__file__).parent.parent
            / "src" / "socialsim4" / "templates" / "templates" / "village.json"
        )

        # Load the template
        loader = TemplateLoader()
        template = loader.load_from_file(template_path)

        # Verify template structure
        assert isinstance(template, GenericTemplate)
        assert template.id == "village"
        assert template.name == "Village Simulation"
        assert len(template.core_mechanics) == 2
        assert template.core_mechanics[0].type == "grid"
        assert template.core_mechanics[1].type == "resources"
        assert len(template.agent_archetypes) == 3

        # Build scene from template
        scene = loader.build_scene_from_template(template)

        assert isinstance(scene, GenericScene)
        assert scene.name == "Village Simulation"
        assert len(scene.mechanics) == 2
        assert scene.mechanics[0].TYPE == "grid"
        assert scene.mechanics[1].TYPE == "resources"

        # Create an agent from the farmer archetype
        farmer_archetype = template.agent_archetypes[0]
        assert farmer_archetype.name == "farmer"

        agent = Agent(
            name="FarmerJohn",
            user_profile=farmer_archetype.user_profile,
            style=farmer_archetype.style,
            role_prompt=farmer_archetype.role_prompt,
            **farmer_archetype.properties
        )

        # Initialize agent with scene
        scene.initialize_agent(agent)

        # Verify agent has grid and resource properties
        assert "hunger" in agent.properties
        assert "energy" in agent.properties
        assert "inventory" in agent.properties
        assert "map_xy" in agent.properties
        assert "map_position" in agent.properties

        # Verify agent has archetype-specific properties
        assert agent.properties["role"] == "farmer"
        assert agent.properties["starting_food"] == 20
        assert agent.properties["special_skill"] == "farming"

        # Verify scene actions are available
        actions = scene.get_scene_actions(agent)
        action_names = [a.NAME for a in actions]

        # Grid mechanic actions
        assert "move_to_location" in action_names
        assert "look_around" in action_names
        assert "rest" in action_names

        # Resource mechanic action
        assert "gather_resource" in action_names

        # Base scene action
        assert "yield" in action_names


class TestCouncilTemplateEndToEnd:
    """End-to-end test for the council template."""

    def setup_method(self):
        """Clear semantic action factory before each test."""
        SemanticActionFactory.clear()

    def test_council_template_end_to_end(self):
        """Load council.json, verify voting mechanics work."""
        # Path to council template
        template_path = (
            Path(__file__).parent.parent
            / "src" / "socialsim4" / "templates" / "templates" / "council.json"
        )

        # Load the template
        loader = TemplateLoader()
        template = loader.load_from_file(template_path)

        # Verify template structure
        assert template.id == "council"
        assert template.name == "Council Chamber"
        assert len(template.core_mechanics) == 3

        # Verify mechanics are discussion, voting, hierarchy
        mechanic_types = [m.type for m in template.core_mechanics]
        assert "discussion" in mechanic_types
        assert "voting" in mechanic_types
        assert "hierarchy" in mechanic_types

        # Build scene from template
        scene = loader.build_scene_from_template(template)

        assert len(scene.mechanics) == 3

        # Get voting mechanic
        voting_mechanic = None
        for mechanic in scene.mechanics:
            if mechanic.TYPE == "voting":
                voting_mechanic = mechanic
                break

        assert voting_mechanic is not None

        # Test voting mechanics work
        proposal = voting_mechanic.add_proposal("Test Proposal", "Agent1")

        assert proposal.title == "Test Proposal"
        assert proposal.proposer == "Agent1"
        assert proposal.active is True

        # Cast votes
        success, msg = voting_mechanic.cast_vote(proposal, "Agent2", "yes")
        assert success is True
        assert proposal.yes_votes == 1

        success, msg = voting_mechanic.cast_vote(proposal, "Agent3", "no")
        assert success is True
        assert proposal.no_votes == 1

        # Check proposal passes (1 yes, 1 no, threshold 0.5 means need more yes than no)
        # With 1 yes and 1 no, that's 50% yes, so should not pass with 0.5 threshold
        assert voting_mechanic.check_proposal_passed(proposal) is False

        # Add another yes vote
        voting_mechanic.cast_vote(proposal, "Agent4", "yes")
        assert proposal.yes_votes == 2
        assert voting_mechanic.check_proposal_passed(proposal) is True


class TestTradingTemplateSemanticActions:
    """Test trading post template semantic actions."""

    def setup_method(self):
        """Clear semantic action factory before each test."""
        SemanticActionFactory.clear()

    def test_trading_template_semantic_actions(self):
        """Verify semantic actions are loaded."""
        # Path to trading post template
        template_path = (
            Path(__file__).parent.parent
            / "src" / "socialsim4" / "templates" / "templates" / "trading_post.json"
        )

        # Load the template
        loader = TemplateLoader()
        template = loader.load_from_file(template_path)

        # Verify semantic actions
        assert len(template.semantic_actions) == 3

        action_names = [a.name for a in template.semantic_actions]
        assert "trade" in action_names
        assert "set_price" in action_names
        assert "inspect_goods" in action_names

        # Build scene from template
        scene = loader.build_scene_from_template(template)

        # Verify semantic actions are in scene
        assert len(scene.semantic_actions) == 3

        semantic_action_names = [a.NAME for a in scene.semantic_actions]
        assert "trade" in semantic_action_names
        assert "set_price" in semantic_action_names
        assert "inspect_goods" in semantic_action_names

        # Verify trade action has correct parameters
        trade_action = None
        for action in scene.semantic_actions:
            if action.NAME == "trade":
                trade_action = action
                break

        assert trade_action is not None
        assert "target_agent" in trade_action.parameters
        assert "offer_item" in trade_action.parameters
        assert "offer_amount" in trade_action.parameters
        assert "request_item" in trade_action.parameters
        assert "request_amount" in trade_action.parameters


class TestPromptWithGenericTemplate:
    """Test prompt generation with generic template."""

    def setup_method(self):
        """Clear semantic action factory before each test."""
        SemanticActionFactory.clear()

    def test_prompt_with_generic_template(self):
        """Generate system prompt and verify content."""
        # Create a simple template
        template_data = {
            "id": "test_template",
            "name": "Test Template",
            "description": "A test template for prompt generation",
            "core_mechanics": [
                {"type": "grid", "config": {"width": 10, "height": 10}},
                {"type": "resources", "config": {"resources": ["gold"]}},
            ],
            "semantic_actions": [
                {
                    "name": "custom_action",
                    "description": "A custom action for testing",
                    "instruction": "Use when testing custom actions",
                }
            ],
            "environment": {
                "description": "A test environment for prompt generation",
                "rules": ["Rule 1: Be polite", "Rule 2: Follow instructions"],
            },
        }

        loader = TemplateLoader()
        scene = loader.build_scene_from_template(template_data)

        # Create agent
        agent = Agent(
            name="TestAgent",
            user_profile="A test agent for prompt generation",
            style="formal",
            role_prompt="You are a test agent",
        )

        # Initialize agent with scene
        scene.initialize_agent(agent)

        # Get agent's action space
        agent.action_space = scene.get_scene_actions(agent)

        # Generate system prompt
        prompt = agent.system_prompt(scene)

        # Verify prompt contains key elements
        assert "TestAgent" in prompt
        assert "A test agent for prompt generation" in prompt
        assert "You are a test agent" in prompt

        # Verify scene description is in prompt
        assert "A test environment for prompt generation" in prompt

        # Verify rules are in prompt
        assert "Be polite" in prompt
        assert "Follow instructions" in prompt

        # Verify action catalog includes scene actions
        assert "move_to_location" in prompt
        assert "gather_resource" in prompt
        assert "custom_action" in prompt

        # Verify language setting
        assert "Language: en" in prompt


class TestMultipleMechanicsComposition:
    """Test scene with multiple mechanics."""

    def setup_method(self):
        """Clear semantic action factory before each test."""
        SemanticActionFactory.clear()

    def test_multiple_mechanics_composition(self):
        """Scene with multiple mechanics composes correctly."""
        template_data = {
            "id": "multi_mechanic",
            "name": "Multi Mechanic Scene",
            "description": "A scene with multiple mechanics",
            "core_mechanics": [
                {"type": "grid", "config": {"width": 15, "height": 15}},
                {"type": "resources", "config": {"resources": ["food", "water"]}},
                {"type": "voting", "config": {"threshold": 0.6}},
                {"type": "hierarchy", "config": {"hierarchy_type": "tree"}},
            ],
        }

        loader = TemplateLoader()
        scene = loader.build_scene_from_template(template_data)

        # Verify all mechanics are loaded
        assert len(scene.mechanics) == 4

        mechanic_types = {m.TYPE for m in scene.mechanics}
        assert "grid" in mechanic_types
        assert "resources" in mechanic_types
        assert "voting" in mechanic_types
        assert "hierarchy" in mechanic_types

        # Verify scene state includes all mechanics
        assert "game_map" in scene.state
        assert "available_resources" in scene.state
        assert "voting_threshold" in scene.state
        assert "hierarchy_type" in scene.state

        # Create and initialize agent
        agent = Agent(name="TestAgent", user_profile="", style="")
        scene.initialize_agent(agent)

        # Verify agent has properties from all mechanics
        # Grid mechanic
        assert "hunger" in agent.properties
        assert "energy" in agent.properties
        assert "map_xy" in agent.properties

        # Resource mechanic
        assert "inventory" in agent.properties
        assert agent.properties["inventory"]["food"] == 0  # default initial
        assert agent.properties["inventory"]["water"] == 0

        # Voting mechanic
        assert "votes_cast" in agent.properties

        # Hierarchy mechanic
        assert "role_level" in agent.properties

        # Verify agent has actions from all mechanics
        actions = scene.get_scene_actions(agent)
        action_names = [a.NAME for a in actions]

        # Grid actions
        assert "move_to_location" in action_names
        assert "look_around" in action_names
        assert "rest" in action_names

        # Resource action
        assert "gather_resource" in action_names

        # Voting actions
        assert "vote" in action_names
        assert "voting_status" in action_names


class TestTemplateSerializationRoundtrip:
    """Test serialize and deserialize scene."""

    def setup_method(self):
        """Clear semantic action factory before each test."""
        SemanticActionFactory.clear()

    def test_template_serialization_roundtrip(self):
        """Serialize and deserialize scene."""
        template_data = {
            "id": "serialize_test",
            "name": "Serialization Test",
            "description": "Testing serialization",
            "core_mechanics": [
                {"type": "grid", "config": {"width": 25, "height": 20}},
                {"type": "voting", "config": {"threshold": 0.75}},
            ],
            "semantic_actions": [
                {
                    "name": "test_action",
                    "description": "Test action",
                    "instruction": "Test instruction",
                }
            ],
            "environment": {
                "description": "Test environment",
                "rules": ["Rule 1"],
            },
        }

        loader = TemplateLoader()
        scene = loader.build_scene_from_template(template_data)

        # Serialize scene
        serialized = scene.serialize()

        # Verify serialized structure
        assert serialized["type"] == "generic_scene"
        assert serialized["name"] == "Serialization Test"
        assert serialized["initial_event"] == "Testing serialization"
        assert "config" in serialized
        assert "state" in serialized

        # Deserialize scene
        deserialized = GenericScene.deserialize(serialized)

        # Verify deserialized scene matches original
        assert deserialized.name == scene.name
        assert deserialized.initial_event.content == scene.initial_event.content

        # Verify mechanics are preserved
        assert len(deserialized.mechanics) == len(scene.mechanics)

        # Verify environment is preserved
        assert deserialized.environment["description"] == "Test environment"
        assert deserialized.environment["rules"] == ["Rule 1"]

        # Verify semantic actions are preserved
        assert len(deserialized.semantic_actions) == len(scene.semantic_actions)


class TestAgentActionExecution:
    """Test execute an action from template."""

    def setup_method(self):
        """Clear semantic action factory before each test."""
        SemanticActionFactory.clear()

    def test_agent_action_execution(self):
        """Execute an action from template."""
        # Create template with voting mechanic
        template_data = {
            "id": "action_test",
            "name": "Action Execution Test",
            "description": "Testing action execution",
            "core_mechanics": [
                {"type": "voting", "config": {"threshold": 0.5}},
            ],
        }

        loader = TemplateLoader()
        scene = loader.build_scene_from_template(template_data)

        # Get voting mechanic
        voting_mechanic = None
        for mechanic in scene.mechanics:
            if mechanic.TYPE == "voting":
                voting_mechanic = mechanic
                break

        assert voting_mechanic is not None

        # Create a proposal
        proposal = voting_mechanic.add_proposal("Test Proposal", "Agent1")

        # Get vote action
        vote_action = None
        for action in voting_mechanic.get_actions():
            if action.NAME == "vote":
                vote_action = action
                break

        assert vote_action is not None

        # Create mock agent and simulator
        class MockAgent:
            def __init__(self):
                self.name = "Agent2"
                self.properties = {"votes_cast": 0}
                self.feedback = []

            def add_env_feedback(self, message):
                self.feedback.append(message)

        class MockSimulator:
            def __init__(self):
                self.agents = {}

            def emit_event_later(self, event_type, params):
                pass

        agent = MockAgent()
        simulator = MockSimulator()

        # Execute vote action
        action_data = {
            "action": "vote",
            "proposal": proposal.title,
            "vote": "yes",
        }

        success, result, summary, meta, pass_control = vote_action.handle(
            action_data, agent, simulator, scene
        )

        # Verify action executed
        assert success is True
        assert summary is not None
        assert proposal.yes_votes == 1
        assert proposal.votes_by_agent["Agent2"] == "yes"


class TestMechanicStateIsolation:
    """Test that mechanics don't interfere."""

    def setup_method(self):
        """Clear semantic action factory before each test."""
        SemanticActionFactory.clear()

    def test_mechanic_state_isolation(self):
        """Verify mechanics don't interfere with each other."""
        # Create two scenes with different configurations
        template1 = {
            "id": "scene1",
            "name": "Scene 1",
            "description": "First scene",
            "core_mechanics": [
                {"type": "grid", "config": {"width": 10, "height": 10}},
                {"type": "voting", "config": {"threshold": 0.5}},
            ],
        }

        template2 = {
            "id": "scene2",
            "name": "Scene 2",
            "description": "Second scene",
            "core_mechanics": [
                {"type": "grid", "config": {"width": 30, "height": 30}},
                {"type": "voting", "config": {"threshold": 0.75}},
            ],
        }

        loader = TemplateLoader()
        scene1 = loader.build_scene_from_template(template1)
        scene2 = loader.build_scene_from_template(template2)

        # Verify scene1 has its own configuration
        assert scene1.state["game_map"].width == 10
        assert scene1.state["game_map"].height == 10
        assert scene1.state["voting_threshold"] == 0.5

        # Verify scene2 has its own configuration
        assert scene2.state["game_map"].width == 30
        assert scene2.state["game_map"].height == 30
        assert scene2.state["voting_threshold"] == 0.75

        # Modify scene1 state
        scene1.state["game_map"].width = 15
        scene1.state["voting_threshold"] = 0.6

        # Verify scene2 is not affected
        assert scene2.state["game_map"].width == 30
        assert scene2.state["voting_threshold"] == 0.75

        # Create agents for each scene
        agent1 = Agent(name="Agent1", user_profile="", style="")
        agent2 = Agent(name="Agent2", user_profile="", style="")

        scene1.initialize_agent(agent1)
        scene2.initialize_agent(agent2)

        # Verify agents have independent properties
        agent1.properties["energy"] = 50
        agent1.properties["votes_cast"] = 3

        # Agent2 should not be affected
        assert agent2.properties["energy"] == 100  # Default value
        assert agent2.properties["votes_cast"] == 0  # Default value


class TestEdgeCases:
    """Test edge cases and error handling."""

    def setup_method(self):
        """Clear semantic action factory before each test."""
        SemanticActionFactory.clear()

    def test_template_with_no_mechanics(self):
        """Test template with no mechanics."""
        template_data = {
            "id": "empty",
            "name": "Empty Template",
            "description": "Template with no mechanics",
        }

        loader = TemplateLoader()
        scene = loader.build_scene_from_template(template_data)

        assert len(scene.mechanics) == 0
        assert len(scene.semantic_actions) == 0

        # Agent should initialize without errors
        agent = Agent(name="TestAgent", user_profile="", style="")
        scene.initialize_agent(agent)

        # Should still have yield action
        actions = scene.get_scene_actions(agent)
        action_names = [a.NAME for a in actions]
        assert "yield" in action_names

    def test_template_with_invalid_mechanic_type(self):
        """Test that invalid mechanic type raises error."""
        from socialsim4.templates.mechanics import create_mechanic

        with pytest.raises(ValueError, match="Unknown mechanic type"):
            create_mechanic("invalid_type", {})

    def test_template_with_empty_environment(self):
        """Test template with empty environment."""
        template_data = {
            "id": "no_env",
            "name": "No Environment",
            "description": "Template without environment config",
        }

        loader = TemplateLoader()
        scene = loader.build_scene_from_template(template_data)

        # Should have empty environment dict
        assert scene.environment == {}

        # Compact description should be empty
        description = scene.get_compact_description()
        assert description == ""

    def test_agent_archetype_property_initialization(self):
        """Test that archetype properties are applied to agent."""
        template_data = {
            "id": "archetype_test",
            "name": "Archetype Test",
            "description": "Testing archetype properties",
            "agent_archetypes": [
                {
                    "name": "custom_role",
                    "role_prompt": "You are a custom role",
                    "style": "casual",
                    "user_profile": "A custom agent",
                    "properties": {
                        "custom_prop": "custom_value",
                        "number_prop": 42,
                    },
                }
            ],
        }

        loader = TemplateLoader()
        template = loader.load_from_dict(template_data)

        archetype = template.agent_archetypes[0]

        # Create agent with archetype properties
        agent = Agent(
            name="CustomAgent",
            user_profile=archetype.user_profile,
            style=archetype.style,
            role_prompt=archetype.role_prompt,
            **archetype.properties,
        )

        # Verify properties are set
        assert agent.user_profile == "A custom agent"
        assert agent.style == "casual"
        assert agent.role_prompt == "You are a custom role"
        assert agent.properties["custom_prop"] == "custom_value"
        assert agent.properties["number_prop"] == 42


class TestTemplateLoaderFromDirectory:
    """Test loading multiple templates from directory."""

    def setup_method(self):
        """Clear semantic action factory before each test."""
        SemanticActionFactory.clear()

    def test_load_all_example_templates(self):
        """Test loading all example templates from templates directory."""
        template_dir = (
            Path(__file__).parent.parent
            / "src" / "socialsim4" / "templates" / "templates"
        )

        loader = TemplateLoader()
        templates = loader.load_from_directory(template_dir)

        # Should have at least the three example templates
        assert len(templates) >= 3

        template_ids = {t.id for t in templates}
        assert "village" in template_ids
        assert "council" in template_ids
        assert "trading_post" in template_ids

        # Verify each template can build a scene
        for template in templates:
            scene = loader.build_scene_from_template(template)
            assert isinstance(scene, GenericScene)
            assert scene.name == template.name


class TestSemanticActionExecution:
    """Test semantic action execution in scenes."""

    def setup_method(self):
        """Clear semantic action factory before each test."""
        SemanticActionFactory.clear()

    def test_semantic_action_execution(self):
        """Test that semantic actions execute correctly."""
        template_data = {
            "id": "semantic_test",
            "name": "Semantic Action Test",
            "description": "Testing semantic action execution",
            "semantic_actions": [
                {
                    "name": "custom_greet",
                    "description": "Greet another agent",
                    "instruction": "Use when you want to greet someone",
                    "parameters": [
                        {
                            "name": "target",
                            "type": "str",
                            "description": "Who to greet",
                            "required": True,
                        }
                    ],
                }
            ],
        }

        loader = TemplateLoader()
        scene = loader.build_scene_from_template(template_data)

        # Get semantic action
        greet_action = scene.semantic_actions[0]
        assert greet_action.NAME == "custom_greet"

        # Create mock agent
        class MockAgent:
            def __init__(self):
                self.name = "Greeter"
                self.feedback = []

            def add_env_feedback(self, message):
                self.feedback.append(message)

        agent = MockAgent()

        # Execute semantic action
        action_data = {"target": "Alice"}
        success, result, summary, meta, pass_control = greet_action.handle(
            action_data, agent, None, scene
        )

        # Verify execution
        assert success is True
        assert result["params"]["target"] == "Alice"
        assert "Greeter" in summary
        assert "custom_greet" in summary
