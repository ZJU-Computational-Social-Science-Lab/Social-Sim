"""
Tests for the Semantic Action System.
"""

import pytest

from socialsim4.templates.semantic_actions import SemanticAction, SemanticActionFactory


class MockAgent:
    """Mock agent for testing."""

    def __init__(self, name="TestAgent"):
        self.name = name
        self.feedback = []

    def add_env_feedback(self, message):
        self.feedback.append(message)


class MockSimulator:
    """Mock simulator for testing."""

    def __init__(self):
        self.agents = {}


class MockScene:
    """Mock scene for testing."""

    def __init__(self):
        self.state = {"time": "morning"}
        self.chat_range = 5


class TestSemanticActionCreation:
    """Test basic SemanticAction creation."""

    def test_basic_creation(self):
        """Test creating a semantic action with minimal parameters."""
        action = SemanticAction(
            name="test_action",
            description="A test action",
            instruction="Use when testing"
        )

        assert action.NAME == "test_action"
        assert action.DESC == "A test action"
        assert action.parameters == {}
        assert action.effect_code is None

    def test_creation_with_parameters(self):
        """Test creating a semantic action with parameters."""
        params = {
            "target": "Who to target",
            "amount": "How much to give"
        }
        action = SemanticAction(
            name="give",
            description="Give something to someone",
            instruction="Use when sharing resources",
            parameters=params
        )

        assert action.NAME == "give"
        assert action.parameters == params

    def test_creation_with_effect_code(self):
        """Test creating a semantic action with effect code."""
        effect = "result = params['value'] * 2"
        action = SemanticAction(
            name="double",
            description="Double a value",
            instruction="Use when doubling",
            effect_code=effect
        )

        assert action.effect_code == effect


class TestInstructionFormat:
    """Test the INSTRUCTION property format."""

    def test_instruction_without_params(self):
        """Test instruction format for action without parameters."""
        action = SemanticAction(
            name="yield_turn",
            description="End your turn",
            instruction="Use when done speaking"
        )

        instruction = action.INSTRUCTION

        assert "- yield_turn: End your turn" in instruction
        assert "Use when done speaking" in instruction
        assert '<Action name="yield_turn"/>' in instruction

    def test_instruction_with_params(self):
        """Test instruction format for action with parameters."""
        action = SemanticAction(
            name="pray",
            description="Pray at the shrine",
            instruction="Use when seeking spiritual guidance",
            parameters={"deity": "Which deity to pray to"}
        )

        instruction = action.INSTRUCTION

        assert "- pray: Pray at the shrine" in instruction
        assert "Use when seeking spiritual guidance" in instruction
        assert '<Action name="pray">' in instruction
        assert "<deity>deity</deity>" in instruction

    def test_instruction_multiple_params(self):
        """Test instruction format with multiple parameters."""
        action = SemanticAction(
            name="trade",
            description="Trade items with another agent",
            instruction="Use when exchanging goods",
            parameters={
                "target": "Who to trade with",
                "item": "What to trade",
                "quantity": "How many"
            }
        )

        instruction = action.INSTRUCTION

        assert "<target>target</target>" in instruction
        assert "<item>item</item>" in instruction
        assert "<quantity>quantity</quantity>" in instruction

    def test_instruction_empty_instruction(self):
        """Test instruction with empty instruction string."""
        action = SemanticAction(
            name="simple",
            description="A simple action",
            instruction=""
        )

        instruction = action.INSTRUCTION

        assert "- simple: A simple action" in instruction
        # Should have XML template
        assert '<Action name="simple"/>' in instruction


class TestParameterExtraction:
    """Test parameter extraction in handle() method."""

    def test_extract_single_parameter(self):
        """Test extracting a single parameter."""
        action = SemanticAction(
            name="greet",
            description="Greet someone",
            parameters={"target": "Who to greet"}
        )

        agent = MockAgent()
        simulator = MockSimulator()
        scene = MockScene()

        action_data = {"target": "Alice"}
        success, result, summary, meta, pass_control = action.handle(
            action_data, agent, simulator, scene
        )

        assert success is True
        assert result["params"] == {"target": "Alice"}
        assert "Alice" in summary

    def test_extract_multiple_parameters(self):
        """Test extracting multiple parameters."""
        action = SemanticAction(
            name="attack",
            description="Attack a target",
            parameters={"target": "Who to attack", "weapon": "Weapon to use"}
        )

        agent = MockAgent()
        simulator = MockSimulator()
        scene = MockScene()

        action_data = {"target": "Enemy", "weapon": "sword"}
        success, result, summary, meta, pass_control = action.handle(
            action_data, agent, simulator, scene
        )

        assert success is True
        assert result["params"]["target"] == "Enemy"
        assert result["params"]["weapon"] == "sword"

    def test_extract_partial_parameters(self):
        """Test when only some parameters are provided."""
        action = SemanticAction(
            name="cast_spell",
            description="Cast a magical spell",
            parameters={"spell": "Which spell", "target": "Target", "power": "Power level"}
        )

        agent = MockAgent()
        simulator = MockSimulator()
        scene = MockScene()

        action_data = {"spell": "fireball"}  # Only spell provided
        success, result, summary, meta, pass_control = action.handle(
            action_data, agent, simulator, scene
        )

        assert success is True
        assert result["params"] == {"spell": "fireball"}

    def test_no_parameters(self):
        """Test action with no parameters."""
        action = SemanticAction(
            name="rest",
            description="Take a rest"
        )

        agent = MockAgent()
        simulator = MockSimulator()
        scene = MockScene()

        action_data = {}
        success, result, summary, meta, pass_control = action.handle(
            action_data, agent, simulator, scene
        )

        assert success is True
        assert result["params"] == {}

    def test_return_values_structure(self):
        """Test that handle returns correct 5-tuple structure."""
        action = SemanticAction(
            name="test",
            description="Test action",
            parameters={"value": "A value"}
        )

        agent = MockAgent()
        simulator = MockSimulator()
        scene = MockScene()

        action_data = {"value": "test"}
        result = action.handle(action_data, agent, simulator, scene)

        assert isinstance(result, tuple)
        assert len(result) == 5
        success, result_dict, summary, meta, pass_control = result
        assert isinstance(success, bool)
        assert isinstance(result_dict, dict)
        assert isinstance(summary, str)
        assert isinstance(meta, dict)
        assert isinstance(pass_control, bool)


class TestFactoryRegister:
    """Test SemanticActionFactory registration."""

    def setup_method(self):
        """Clear factory before each test."""
        SemanticActionFactory.clear()

    def test_register_action(self):
        """Test registering an action."""
        action = SemanticAction(
            name="test",
            description="Test action",
            instruction="Test instruction"
        )

        returned = SemanticActionFactory.register(action)
        assert returned is action
        assert SemanticActionFactory.get_action("test") is action

    def test_register_multiple_actions(self):
        """Test registering multiple actions."""
        action1 = SemanticAction(name="action1", description="First")
        action2 = SemanticAction(name="action2", description="Second")

        SemanticActionFactory.register(action1)
        SemanticActionFactory.register(action2)

        assert SemanticActionFactory.get_action("action1") is action1
        assert SemanticActionFactory.get_action("action2") is action2

    def test_register_non_action_raises(self):
        """Test that registering non-SemanticAction raises TypeError."""
        with pytest.raises(TypeError):
            SemanticActionFactory.register("not an action")

        with pytest.raises(TypeError):
            SemanticActionFactory.register(None)

    def test_list_actions(self):
        """Test listing all registered actions."""
        action1 = SemanticAction(name="a1", description="First")
        action2 = SemanticAction(name="a2", description="Second")

        SemanticActionFactory.register(action1)
        SemanticActionFactory.register(action2)

        actions = SemanticActionFactory.list_actions()
        assert set(actions) == {"a1", "a2"}

    def test_get_nonexistent_action(self):
        """Test getting a non-existent action returns None."""
        assert SemanticActionFactory.get_action("nonexistent") is None

    def test_clear(self):
        """Test clearing the factory."""
        action = SemanticAction(name="test", description="Test")
        SemanticActionFactory.register(action)

        SemanticActionFactory.clear()

        assert SemanticActionFactory.get_action("test") is None
        assert SemanticActionFactory.list_actions() == []


class TestFactoryCreateFromConfig:
    """Test SemanticActionFactory.create_from_config."""

    def setup_method(self):
        """Clear factory before each test."""
        SemanticActionFactory.clear()

    def test_create_minimal_config(self):
        """Test creating from minimal config."""
        config = {
            "name": "minimal_action"
        }

        action = SemanticActionFactory.create_from_config(config)

        assert action.NAME == "minimal_action"
        assert action.DESC == ""
        assert action.parameters == {}
        assert action.effect_code is None
        assert SemanticActionFactory.get_action("minimal_action") is action

    def test_create_full_config(self):
        """Test creating from full config."""
        config = {
            "name": "full_action",
            "description": "A fully configured action",
            "instruction": "Use when testing full config",
            "parameters": {
                "param1": "First parameter",
                "param2": "Second parameter"
            },
            "effect": "result = params['param1'] + params['param2']"
        }

        action = SemanticActionFactory.create_from_config(config)

        assert action.NAME == "full_action"
        assert action.DESC == "A fully configured action"
        assert action.parameters == {"param1": "First parameter", "param2": "Second parameter"}
        assert action.effect_code == "result = params['param1'] + params['param2']"

    def test_create_with_parameters(self):
        """Test creating action with parameters."""
        config = {
            "name": "with_params",
            "description": "Action with params",
            "parameters": {
                "target": "Target agent",
                "amount": "Amount to transfer"
            }
        }

        action = SemanticActionFactory.create_from_config(config)

        assert action.parameters == {
            "target": "Target agent",
            "amount": "Amount to transfer"
        }

    def test_create_with_effect_code(self):
        """Test creating action with effect code."""
        config = {
            "name": "with_effect",
            "description": "Action with effect",
            "effect": "summary = f'Effect executed with {params}'"
        }

        action = SemanticActionFactory.create_from_config(config)

        assert action.effect_code == "summary = f'Effect executed with {params}'"

    def test_create_missing_name_raises(self):
        """Test that config without name raises ValueError."""
        config = {"description": "No name provided"}

        with pytest.raises(ValueError, match="name"):
            SemanticActionFactory.create_from_config(config)

    def test_create_invalid_type_raises(self):
        """Test that non-dict config raises TypeError."""
        with pytest.raises(TypeError):
            SemanticActionFactory.create_from_config("not a dict")

        with pytest.raises(TypeError):
            SemanticActionFactory.create_from_config(None)


class TestActionWithEffectCode:
    """Test effect_code execution."""

    def setup_method(self):
        """Clear factory before each test."""
        SemanticActionFactory.clear()

    def test_simple_effect_code(self):
        """Test effect code that sets a result."""
        effect = "result = params['value'] * 2"
        action = SemanticAction(
            name="double",
            description="Double a value",
            parameters={"value": "Value to double"},
            effect_code=effect
        )

        agent = MockAgent()
        simulator = MockSimulator()
        scene = MockScene()

        action_data = {"value": 5}
        success, result, summary, meta, pass_control = action.handle(
            action_data, agent, simulator, scene
        )

        assert success is True
        assert result["effect_result"] == 10

    def test_effect_code_modifies_agent(self):
        """Test effect code that can access agent."""
        effect = "agent.test_value = params['value']"
        action = SemanticAction(
            name="set_value",
            description="Set agent value",
            parameters={"value": "Value to set"},
            effect_code=effect
        )

        agent = MockAgent()
        simulator = MockSimulator()
        scene = MockScene()

        action_data = {"value": 42}
        success, result, summary, meta, pass_control = action.handle(
            action_data, agent, simulator, scene
        )

        assert success is True
        assert agent.test_value == 42

    def test_effect_code_error_handling(self):
        """Test that effect code errors are handled gracefully."""
        effect = "raise ValueError('Test error')"
        action = SemanticAction(
            name="error_action",
            description="Action with error",
            effect_code=effect
        )

        agent = MockAgent()
        simulator = MockSimulator()
        scene = MockScene()

        action_data = {}
        success, result, summary, meta, pass_control = action.handle(
            action_data, agent, simulator, scene
        )

        assert success is False
        assert "error" in result
        assert "Effect code execution failed" in result["error"]
        assert len(agent.feedback) > 0

    def test_effect_code_with_builtins(self):
        """Test that allowed builtins are available."""
        effect = "result = sum([params['a'], params['b'], params['c']])"
        action = SemanticAction(
            name="sum_action",
            description="Sum values",
            parameters={"a": "First", "b": "Second", "c": "Third"},
            effect_code=effect
        )

        agent = MockAgent()
        simulator = MockSimulator()
        scene = MockScene()

        action_data = {"a": 1, "b": 2, "c": 3}
        success, result, summary, meta, pass_control = action.handle(
            action_data, agent, simulator, scene
        )

        assert success is True
        assert result["effect_result"] == 6

    def test_effect_code_no_result(self):
        """Test effect code that doesn't set result."""
        effect = "agent.effect_ran = True"
        action = SemanticAction(
            name="no_result",
            description="No result effect",
            effect_code=effect
        )

        agent = MockAgent()
        simulator = MockSimulator()
        scene = MockScene()

        success, result, summary, meta, pass_control = action.handle(
            action_data={}, agent=agent, simulator=simulator, scene=scene
        )

        assert success is True
        assert "effect_result" not in result
        assert agent.effect_ran is True


class TestMultipleActions:
    """Test handling multiple registered actions."""

    def setup_method(self):
        """Clear factory and setup actions."""
        SemanticActionFactory.clear()

    def test_multiple_actions_different_params(self):
        """Test multiple actions with different parameters."""
        action1 = SemanticAction(
            name="pray",
            description="Pray at the shrine",
            instruction="Use when seeking spiritual guidance",
            parameters={"deity": "Which deity"}
        )
        action2 = SemanticAction(
            name="trade",
            description="Trade items",
            instruction="Use when exchanging goods",
            parameters={"target": "Who to trade with", "item": "What to trade"}
        )

        SemanticActionFactory.register(action1)
        SemanticActionFactory.register(action2)

        assert len(SemanticActionFactory.list_actions()) == 2

        # Test both actions work
        agent = MockAgent()
        simulator = MockSimulator()
        scene = MockScene()

        success1, result1, summary1, _, _ = action1.handle(
            {"deity": "Zeus"}, agent, simulator, scene
        )
        success2, result2, summary2, _, _ = action2.handle(
            {"target": "Alice", "item": "gold"}, agent, simulator, scene
        )

        assert success1 is True
        assert result1["params"]["deity"] == "Zeus"
        assert success2 is True
        assert result2["params"]["target"] == "Alice"
        assert result2["params"]["item"] == "gold"

    def test_factory_create_multiple_from_configs(self):
        """Test creating multiple actions from config list."""
        configs = [
            {
                "name": "action1",
                "description": "First action",
                "parameters": {"value": "A value"}
            },
            {
                "name": "action2",
                "description": "Second action",
                "parameters": {"target": "Target"}
            },
            {
                "name": "action3",
                "description": "Third action"
            }
        ]

        for config in configs:
            SemanticActionFactory.create_from_config(config)

        actions = SemanticActionFactory.list_actions()
        assert set(actions) == {"action1", "action2", "action3"}

        # Verify each can be retrieved
        for name in ["action1", "action2", "action3"]:
            action = SemanticActionFactory.get_action(name)
            assert action is not None
            assert action.NAME == name

    def test_instructions_combination(self):
        """Test combining instructions from multiple actions."""
        action1 = SemanticAction(
            name="speak",
            description="Say something",
            instruction="Use when you want to communicate"
        )
        action2 = SemanticAction(
            name="listen",
            description="Listen to others",
            instruction="Use when you want to observe"
        )

        combined_instructions = action1.INSTRUCTION + "\n" + action2.INSTRUCTION

        assert "speak: Say something" in combined_instructions
        assert "listen: Listen to others" in combined_instructions
        assert "Use when you want to communicate" in combined_instructions
        assert "Use when you want to observe" in combined_instructions
