"""Tests for ExperimentScene state integration."""
import pytest
from socialsim4.core.experiment.scene import ExperimentScene
from socialsim4.core.experiment.config import ExperimentConfig


class TestExperimentSceneState:
    def test_scene_has_state(self):
        """ExperimentScene has ExperimentState."""
        config = ExperimentConfig(
            scenario_id="test",
            agents=[{"name": "Alice"}],
            actions=[],
        )
        scene = ExperimentScene(config)
        assert scene.state is not None
        assert scene.state.round == 0

    def test_scene_initializes_agent_states(self):
        """Scene creates AgentState for each agent."""
        config = ExperimentConfig(
            scenario_id="test",
            agents=[
                {"name": "Alice"},
                {"name": "Bob"},
            ],
            actions=[],
        )
        scene = ExperimentScene(config)
        scene._initialize_state()

        assert "Alice" in scene.state.agents
        assert "Bob" in scene.state.agents

    def test_scene_applies_state_schema(self):
        """Scene applies state_schema from config."""
        config = ExperimentConfig(
            scenario_id="public_goods",
            agents=[{"name": "Alice"}],
            actions=[],
        )
        # Set state_schema directly (normally comes from scenario)
        config.state_schema = {
            "extensions": {"pools": {"main": 0}},
        }
        scene = ExperimentScene(config)
        scene._initialize_state()

        assert scene.state.extensions["pools"]["main"] == 0

    def test_scene_initializes_resources(self):
        """Scene initializes agent resources from config."""
        config = ExperimentConfig(
            scenario_id="test",
            agents=[{"name": "Alice", "resources": {"tokens": 20}}],
            actions=[],
        )
        scene = ExperimentScene(config)
        scene._initialize_state()

        assert scene.state.agents["Alice"].resources["tokens"] == 20
