"""Tests for core mechanics modules."""

import pytest

from socialsim4.core.agent import Agent
from socialsim4.core.scene import Scene
from socialsim4.core.event import PublicEvent
from socialsim4.templates.mechanics import (
    MECHANIC_REGISTRY,
    create_mechanic,
    get_registered_mechanics,
    GridMechanic,
    VotingMechanic,
    ResourceMechanic,
    HierarchyMechanic,
    DiscussionMechanic,
)


@pytest.fixture
def mock_scene():
    """Create a minimal scene for testing."""
    scene = Scene.__new__(Scene)
    scene.name = "test_scene"
    scene.initial_event = PublicEvent("Test event")
    scene.state = {"time": 0}
    return scene


@pytest.fixture
def mock_agent():
    """Create a minimal agent for testing."""
    agent = Agent.__new__(Agent)
    agent.name = "TestAgent"
    agent.properties = {}
    return agent


class TestMechanicRegistry:
    """Tests for the mechanic registry and factory."""

    def test_registry_contains_all_mechanics(self):
        """Test that all mechanic types are registered."""
        expected_types = {"grid", "voting", "resources", "hierarchy", "discussion"}
        registered_types = set(MECHANIC_REGISTRY.keys())
        assert registered_types == expected_types

    def test_get_registered_mechanics(self):
        """Test getting list of registered mechanics."""
        mechanics = get_registered_mechanics()
        assert isinstance(mechanics, list)
        assert len(mechanics) >= 5
        assert "grid" in mechanics

    def test_create_mechanic(self):
        """Test creating mechanics via factory function."""
        grid = create_mechanic("grid", {"width": 10, "height": 10})
        assert isinstance(grid, GridMechanic)
        assert grid.game_map.width == 10

    def test_create_unknown_mechanic_raises_error(self):
        """Test that creating unknown mechanic type raises ValueError."""
        with pytest.raises(ValueError, match="Unknown mechanic type"):
            create_mechanic("unknown_type", {})


class TestGridMechanic:
    """Tests for GridMechanic."""

    def test_from_config_default(self):
        """Test creating GridMechanic with default config."""
        mechanic = GridMechanic.from_config({})
        assert mechanic.game_map.width == 20
        assert mechanic.game_map.height == 20
        assert mechanic.chat_range == 5
        assert mechanic.movement_cost == 1

    def test_from_config_custom(self):
        """Test creating GridMechanic with custom config."""
        mechanic = GridMechanic.from_config({
            "width": 15,
            "height": 25,
            "chat_range": 8,
            "movement_cost": 2,
        })
        assert mechanic.game_map.width == 15
        assert mechanic.game_map.height == 25
        assert mechanic.chat_range == 8
        assert mechanic.movement_cost == 2

    def test_type_attribute(self):
        """Test TYPE attribute is correct."""
        assert GridMechanic.TYPE == "grid"

    def test_initialize_agent(self, mock_agent, mock_scene):
        """Test agent initialization."""
        mechanic = GridMechanic.from_config({})
        mechanic.initialize_agent(mock_agent, mock_scene)

        assert "hunger" in mock_agent.properties
        assert mock_agent.properties["hunger"] == 0
        assert "energy" in mock_agent.properties
        assert mock_agent.properties["energy"] == 100
        assert "inventory" in mock_agent.properties
        assert "map_xy" in mock_agent.properties
        assert "map_position" in mock_agent.properties

    def test_initialize_agent_with_preset_position(self, mock_agent, mock_scene):
        """Test agent initialization with preset position."""
        mechanic = GridMechanic.from_config({"width": 20, "height": 20})
        mock_agent.properties["map_xy"] = [5, 5]
        mechanic.initialize_agent(mock_agent, mock_scene)

        assert mock_agent.properties["map_xy"] == [5, 5]

    def test_get_actions(self):
        """Test getting actions from mechanic."""
        mechanic = GridMechanic.from_config({})
        actions = mechanic.get_actions()

        assert len(actions) == 3
        action_names = [a.NAME for a in actions]
        assert "move_to_location" in action_names
        assert "look_around" in action_names
        assert "rest" in action_names

    def test_get_scene_state(self):
        """Test getting scene state contribution."""
        mechanic = GridMechanic.from_config({"chat_range": 7, "movement_cost": 2})
        state = mechanic.get_scene_state()

        assert "game_map" in state
        assert state["chat_range"] == 7
        assert state["movement_cost"] == 2


class TestVotingMechanic:
    """Tests for VotingMechanic."""

    def test_from_config_default(self):
        """Test creating VotingMechanic with default config."""
        mechanic = VotingMechanic.from_config({})
        assert mechanic.threshold == 0.5
        assert mechanic.timeout_turns == 10
        assert mechanic.allow_abstain is True

    def test_from_config_custom(self):
        """Test creating VotingMechanic with custom config."""
        mechanic = VotingMechanic.from_config({
            "threshold": 0.67,
            "timeout_turns": 20,
            "allow_abstain": False,
        })
        assert mechanic.threshold == 0.67
        assert mechanic.timeout_turns == 20
        assert mechanic.allow_abstain is False

    def test_type_attribute(self):
        """Test TYPE attribute is correct."""
        assert VotingMechanic.TYPE == "voting"

    def test_initialize_agent(self, mock_agent, mock_scene):
        """Test agent initialization."""
        mechanic = VotingMechanic.from_config({})
        mechanic.initialize_agent(mock_agent, mock_scene)

        assert "votes_cast" in mock_agent.properties
        assert mock_agent.properties["votes_cast"] == 0

    def test_get_actions(self):
        """Test getting actions from mechanic."""
        mechanic = VotingMechanic.from_config({})
        actions = mechanic.get_actions()

        assert len(actions) == 2
        action_names = [a.NAME for a in actions]
        assert "vote" in action_names
        assert "voting_status" in action_names

    def test_get_scene_state(self):
        """Test getting scene state contribution."""
        mechanic = VotingMechanic.from_config({"threshold": 0.67})
        state = mechanic.get_scene_state()

        assert state["voting_threshold"] == 0.67
        assert state["voting_timeout"] == 10
        assert state["allow_abstain"] is True
        assert "proposals" in state

    def test_add_proposal(self):
        """Test adding a proposal."""
        mechanic = VotingMechanic.from_config({})
        proposal = mechanic.add_proposal("Test Proposal", "Agent1", turn=5)

        assert proposal.title == "Test Proposal"
        assert proposal.proposer == "Agent1"
        assert proposal.turn_created == 5
        assert proposal.active is True
        assert len(mechanic.proposals) == 1

    def test_cast_vote(self):
        """Test casting a vote."""
        mechanic = VotingMechanic.from_config({})
        proposal = mechanic.add_proposal("Test", "Agent1")

        success, msg = mechanic.cast_vote(proposal, "Agent2", "yes")

        assert success is True
        assert proposal.yes_votes == 1
        assert proposal.votes_by_agent["Agent2"] == "yes"

    def test_cast_vote_duplicate_rejected(self):
        """Test that duplicate votes are rejected."""
        mechanic = VotingMechanic.from_config({})
        proposal = mechanic.add_proposal("Test", "Agent1")

        mechanic.cast_vote(proposal, "Agent2", "yes")
        success, msg = mechanic.cast_vote(proposal, "Agent2", "no")

        assert success is False
        assert "already voted" in msg.lower()

    def test_check_proposal_passed(self):
        """Test checking if proposal passed."""
        mechanic = VotingMechanic.from_config({"threshold": 0.5})
        proposal = mechanic.add_proposal("Test", "Agent1")

        # No votes yet
        assert mechanic.check_proposal_passed(proposal) is False

        # Add yes votes
        mechanic.cast_vote(proposal, "Agent2", "yes")
        mechanic.cast_vote(proposal, "Agent3", "yes")
        mechanic.cast_vote(proposal, "Agent4", "no")

        # 2 yes, 1 no = 2/3 = 66% > 50% threshold
        assert mechanic.check_proposal_passed(proposal) is True

    def test_get_active_proposals(self):
        """Test getting active proposals."""
        mechanic = VotingMechanic.from_config({})
        p1 = mechanic.add_proposal("Active", "Agent1")
        p2 = mechanic.add_proposal("Another", "Agent2")

        p1.active = False

        active = mechanic.get_active_proposals()
        assert len(active) == 1
        assert active[0].title == "Another"


class TestResourceMechanic:
    """Tests for ResourceMechanic."""

    def test_from_config_default(self):
        """Test creating ResourceMechanic with default config."""
        mechanic = ResourceMechanic.from_config({})
        assert mechanic.resources == ["food", "wood", "water"]
        assert mechanic.initial_amount == 0
        assert mechanic.max_stack_size == 100

    def test_from_config_custom(self):
        """Test creating ResourceMechanic with custom config."""
        mechanic = ResourceMechanic.from_config({
            "resources": ["gold", "silver"],
            "initial_amount": 10,
            "max_stack_size": 50,
        })
        assert mechanic.resources == ["gold", "silver"]
        assert mechanic.initial_amount == 10
        assert mechanic.max_stack_size == 50

    def test_type_attribute(self):
        """Test TYPE attribute is correct."""
        assert ResourceMechanic.TYPE == "resources"

    def test_initialize_agent(self, mock_agent, mock_scene):
        """Test agent initialization."""
        mechanic = ResourceMechanic.from_config({
            "resources": ["food", "wood"],
            "initial_amount": 5,
        })
        mechanic.initialize_agent(mock_agent, mock_scene)

        assert "inventory" in mock_agent.properties
        assert mock_agent.properties["inventory"]["food"] == 5
        assert mock_agent.properties["inventory"]["wood"] == 5

    def test_get_actions(self):
        """Test getting actions from mechanic."""
        mechanic = ResourceMechanic.from_config({})
        actions = mechanic.get_actions()

        assert len(actions) == 1
        assert actions[0].NAME == "gather_resource"

    def test_get_scene_state(self):
        """Test getting scene state contribution."""
        mechanic = ResourceMechanic.from_config({"max_stack_size": 200})
        state = mechanic.get_scene_state()

        assert state["available_resources"] == ["food", "wood", "water"]
        assert state["max_stack_size"] == 200

    def test_add_resource(self, mock_agent):
        """Test adding resources to agent."""
        mechanic = ResourceMechanic.from_config({})
        mock_agent.properties["inventory"] = {}

        success, msg = mechanic.add_resource(mock_agent, "food", 10)

        assert success is True
        assert mock_agent.properties["inventory"]["food"] == 10

    def test_add_resource_max_stack(self, mock_agent):
        """Test adding resources respects max stack size."""
        mechanic = ResourceMechanic.from_config({"max_stack_size": 50})
        mock_agent.properties["inventory"] = {"food": 45}

        success, msg = mechanic.add_resource(mock_agent, "food", 10)

        assert success is True
        assert mock_agent.properties["inventory"]["food"] == 50
        assert "full" in msg.lower()

    def test_add_resource_unknown_type(self, mock_agent):
        """Test adding unknown resource type."""
        mechanic = ResourceMechanic.from_config({})
        mock_agent.properties["inventory"] = {}

        success, msg = mechanic.add_resource(mock_agent, "gold", 10)

        assert success is False
        assert "unknown" in msg.lower()

    def test_remove_resource(self, mock_agent):
        """Test removing resources from agent."""
        mechanic = ResourceMechanic.from_config({})
        mock_agent.properties["inventory"] = {"food": 20}

        success, msg = mechanic.remove_resource(mock_agent, "food", 5)

        assert success is True
        assert mock_agent.properties["inventory"]["food"] == 15

    def test_remove_resource_insufficient(self, mock_agent):
        """Test removing insufficient resources fails."""
        mechanic = ResourceMechanic.from_config({})
        mock_agent.properties["inventory"] = {"food": 5}

        success, msg = mechanic.remove_resource(mock_agent, "food", 10)

        assert success is False
        assert "not enough" in msg.lower()

    def test_get_resource_count(self, mock_agent):
        """Test getting resource count."""
        mechanic = ResourceMechanic.from_config({})
        mock_agent.properties["inventory"] = {"food": 15, "wood": 5}

        assert mechanic.get_resource_count(mock_agent, "food") == 15
        assert mechanic.get_resource_count(mock_agent, "wood") == 5
        assert mechanic.get_resource_count(mock_agent, "gold") == 0


class TestHierarchyMechanic:
    """Tests for HierarchyMechanic."""

    def test_from_config_tree(self):
        """Test creating HierarchyMechanic with tree type."""
        mechanic = HierarchyMechanic.from_config({
            "hierarchy_type": "tree",
            "levels": {"leader": 3, "worker": 1},
        })
        assert mechanic.hierarchy_type == "tree"
        assert mechanic.levels == {"leader": 3, "worker": 1}

    def test_from_config_flat(self):
        """Test creating HierarchyMechanic with flat type."""
        mechanic = HierarchyMechanic.from_config({
            "hierarchy_type": "flat",
        })
        assert mechanic.hierarchy_type == "flat"
        assert mechanic.levels == {}

    def test_from_config_invalid_type_raises_error(self):
        """Test that invalid hierarchy_type raises ValueError."""
        with pytest.raises(ValueError):
            HierarchyMechanic(hierarchy_type="invalid")

    def test_type_attribute(self):
        """Test TYPE attribute is correct."""
        assert HierarchyMechanic.TYPE == "hierarchy"

    def test_initialize_agent_with_role(self, mock_agent, mock_scene):
        """Test agent initialization with role."""
        mechanic = HierarchyMechanic.from_config({
            "levels": {"leader": 3, "worker": 1},
        })
        mock_agent.properties["role"] = "leader"
        mechanic.initialize_agent(mock_agent, mock_scene)

        assert mock_agent.properties["role_level"] == 3

    def test_initialize_agent_no_role(self, mock_agent, mock_scene):
        """Test agent initialization without role."""
        mechanic = HierarchyMechanic.from_config({})
        mechanic.initialize_agent(mock_agent, mock_scene)

        assert mock_agent.properties["role_level"] == 1

    def test_get_actions(self):
        """Test that hierarchy provides no direct actions."""
        mechanic = HierarchyMechanic.from_config({})
        assert mechanic.get_actions() == []

    def test_get_scene_state(self):
        """Test getting scene state contribution."""
        mechanic = HierarchyMechanic.from_config({
            "hierarchy_type": "tree",
            "levels": {"boss": 3},
        })
        state = mechanic.get_scene_state()

        assert state["hierarchy_type"] == "tree"
        assert state["role_levels"] == {"boss": 3}
        assert state["can_command"] is True

    def test_get_level(self, mock_agent):
        """Test getting agent's level."""
        mechanic = HierarchyMechanic.from_config({})
        mock_agent.properties["role_level"] = 5

        assert mechanic.get_level(mock_agent) == 5

    def test_can_agent_command(self):
        """Test command authority check."""
        mechanic = HierarchyMechanic.from_config({
            "hierarchy_type": "tree",
            "can_command": True,
        })

        agent1 = Agent.__new__(Agent)
        agent1.properties = {"role_level": 3}
        agent2 = Agent.__new__(Agent)
        agent2.properties = {"role_level": 1}

        assert mechanic.can_agent_command(agent1, agent2) is True
        assert mechanic.can_agent_command(agent2, agent1) is False

    def test_can_agent_command_flat(self):
        """Test command authority doesn't apply in flat hierarchy."""
        mechanic = HierarchyMechanic.from_config({
            "hierarchy_type": "flat",
            "can_command": True,
        })

        agent1 = Agent.__new__(Agent)
        agent1.properties = {"role_level": 3}
        agent2 = Agent.__new__(Agent)
        agent2.properties = {"role_level": 1}

        assert mechanic.can_agent_command(agent1, agent2) is False


class TestDiscussionMechanic:
    """Tests for DiscussionMechanic."""

    def test_from_config_default(self):
        """Test creating DiscussionMechanic with default config."""
        mechanic = DiscussionMechanic.from_config({})
        assert mechanic.moderated is False
        assert mechanic.speaking_time_limit == 0
        assert mechanic.allow_private is True
        assert mechanic.max_message_length == 1000

    def test_from_config_custom(self):
        """Test creating DiscussionMechanic with custom config."""
        mechanic = DiscussionMechanic.from_config({
            "moderated": True,
            "speaking_time_limit": 3,
            "allow_private": False,
            "max_message_length": 500,
        })
        assert mechanic.moderated is True
        assert mechanic.speaking_time_limit == 3
        assert mechanic.allow_private is False
        assert mechanic.max_message_length == 500

    def test_type_attribute(self):
        """Test TYPE attribute is correct."""
        assert DiscussionMechanic.TYPE == "discussion"

    def test_initialize_agent(self, mock_agent, mock_scene):
        """Test agent initialization."""
        mechanic = DiscussionMechanic.from_config({})
        mechanic.initialize_agent(mock_agent, mock_scene)

        assert "speaking_turn" in mock_agent.properties
        assert "has_spoken_this_turn" in mock_agent.properties
        assert "message_count" in mock_agent.properties

    def test_get_actions(self):
        """Test getting actions from mechanic."""
        mechanic = DiscussionMechanic.from_config({})
        actions = mechanic.get_actions()

        assert len(actions) == 1
        assert actions[0].NAME == "send_message"

    def test_get_scene_state(self):
        """Test getting scene state contribution."""
        mechanic = DiscussionMechanic.from_config({"moderated": True})
        state = mechanic.get_scene_state()

        assert state["moderated"] is True
        assert state["max_message_length"] == 1000

    def test_can_speak_unlimited(self, mock_agent):
        """Test can_speak with unlimited speaking time."""
        mechanic = DiscussionMechanic.from_config({"speaking_time_limit": 0})
        mock_agent.properties["message_count"] = 100

        assert mechanic.can_speak(mock_agent) is True

    def test_can_speak_limited(self, mock_agent):
        """Test can_speak with limited speaking time."""
        mechanic = DiscussionMechanic.from_config({"speaking_time_limit": 3})
        mock_agent.properties["message_count"] = 2

        assert mechanic.can_speak(mock_agent) is True

        mock_agent.properties["message_count"] = 3
        assert mechanic.can_speak(mock_agent) is False

    def test_record_message(self, mock_agent):
        """Test recording a message."""
        mechanic = DiscussionMechanic.from_config({})
        mock_agent.properties["message_count"] = 5
        mock_agent.properties["has_spoken_this_turn"] = False

        mechanic.record_message(mock_agent)

        assert mock_agent.properties["message_count"] == 6
        assert mock_agent.properties["has_spoken_this_turn"] is True

    def test_reset_turn(self, mock_agent):
        """Test resetting turn state."""
        mechanic = DiscussionMechanic.from_config({})
        mock_agent.properties["has_spoken_this_turn"] = True
        mock_agent.properties["message_count"] = 5

        mechanic.reset_turn(mock_agent)

        assert mock_agent.properties["has_spoken_this_turn"] is False
        assert mock_agent.properties["message_count"] == 0

    def test_validate_message_valid(self):
        """Test validating a valid message."""
        mechanic = DiscussionMechanic.from_config({})
        valid, msg = mechanic.validate_message("Hello, world!")

        assert valid is True
        assert msg == ""

    def test_validate_message_empty(self):
        """Test validating an empty message."""
        mechanic = DiscussionMechanic.from_config({})
        valid, msg = mechanic.validate_message("")

        assert valid is False
        assert "empty" in msg.lower()

    def test_validate_message_too_long(self):
        """Test validating a message that's too long."""
        mechanic = DiscussionMechanic.from_config({"max_message_length": 10})
        valid, msg = mechanic.validate_message("This is way too long!")

        assert valid is False
        assert "too long" in msg.lower()
