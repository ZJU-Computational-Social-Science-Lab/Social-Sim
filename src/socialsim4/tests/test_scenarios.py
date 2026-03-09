"""
Unit tests for scenario module and sociology scenarios.

Tests for:
- CATEGORY_ACTION_LIBRARIES export
- Sociology scenario builder functions
- Scenario data structure
"""

import pytest
from socialsim4.core.scenes.experiment_scene import ExperimentScene


class TestCategoryActionLibraries:
    """Test CATEGORY_ACTION_LIBRARIES from core.scenarios.actions."""

    def test_can_import_category_action_libraries(self):
        """Test that CATEGORY_ACTION_LIBRARIES can be imported."""
        from socialsim4.core.scenarios.actions import CATEGORY_ACTION_LIBRARIES
        assert CATEGORY_ACTION_LIBRARIES is not None

    def test_sociology_category_exists(self):
        """Test that sociology category exists in libraries."""
        from socialsim4.core.scenarios.actions import CATEGORY_ACTION_LIBRARIES
        assert 'sociology' in CATEGORY_ACTION_LIBRARIES

    def test_sociology_actions_structure(self):
        """Test that sociology actions are properly structured."""
        from socialsim4.core.scenarios.actions import CATEGORY_ACTION_LIBRARIES
        sociology_actions = CATEGORY_ACTION_LIBRARIES['sociology']

        # Should be a list
        assert isinstance(sociology_actions, list)

        # Should have at least 20 actions
        assert len(sociology_actions) >= 20

        # Each action should have name and description
        for action in sociology_actions:
            assert 'name' in action
            assert 'description' in action
            assert isinstance(action['name'], str)
            assert isinstance(action['description'], str)

    def test_sociology_action_names(self):
        """Test that expected sociology action names exist."""
        from socialsim4.core.scenarios.actions import CATEGORY_ACTION_LIBRARIES
        sociology_actions = CATEGORY_ACTION_LIBRARIES['sociology']
        action_names = {a['name'] for a in sociology_actions}

        # Check for key actions
        expected_actions = [
            'comply_publicly',
            'resist_openly',
            'express_opinion',
            'share_resources',
            'form_contract',
        ]
        for expected in expected_actions:
            assert expected in action_names, f"Expected action '{expected}' not found"


class TestSociologyScenarioBuilders:
    """Test sociology scenario builder functions."""

    def test_can_import_scenario_builders(self):
        """Test that all sociology scenario builders can be imported."""
        # These should all be importable
        from socialsim4.scenarios.social_norm_disruption import build_social_norm_disruption_sim
        from socialsim4.scenarios.policy_erosion import build_policy_erosion_sim
        from socialsim4.scenarios.echo_chamber import build_echo_chamber_sim
        from socialsim4.scenarios.resource_scarcity import build_resource_scarcity_sim

        assert callable(build_social_norm_disruption_sim)
        assert callable(build_policy_erosion_sim)
        assert callable(build_echo_chamber_sim)
        assert callable(build_resource_scarcity_sim)

    def test_social_norm_disruption_builder_returns_experiment_scene(self):
        """Test that social_norm_disruption builder returns ExperimentScene."""
        from socialsim4.scenarios.social_norm_disruption import build_social_norm_disruption_sim

        scene = build_social_norm_disruption_sim()

        assert isinstance(scene, ExperimentScene)
        assert scene.name == 'social_norm_disruption'
        assert scene.TYPE == 'experiment_template'

    def test_social_norm_disruption_template_config(self):
        """Test that social_norm_disruption has correct template config."""
        from socialsim4.scenarios.social_norm_disruption import build_social_norm_disruption_sim

        scene = build_social_norm_disruption_sim()

        assert scene.template_config is not None
        assert 'description' in scene.template_config
        assert 'actions' in scene.template_config
        assert 'settings' in scene.template_config

    def test_social_norm_disruption_actions(self):
        """Test that social_norm_disruption has relevant actions."""
        from socialsim4.scenarios.social_norm_disruption import build_social_norm_disruption_sim

        scene = build_social_norm_disruption_sim()
        actions = scene.template_config['actions']

        assert len(actions) > 0
        action_names = {a['name'] for a in actions}

        # Should include norm-related actions
        expected_actions = ['comply_publicly', 'resist_openly', 'persuade_others', 'form_coalition']
        for expected in expected_actions:
            assert expected in action_names

    def test_policy_erosion_sequential_visibility(self):
        """Test that policy_erosion uses sequential visibility."""
        from socialsim4.scenarios.policy_erosion import build_policy_erosion_sim

        scene = build_policy_erosion_sim()
        settings = scene.template_config['settings']

        assert settings['round_visibility'] == 'sequential'

    def test_echo_chamber_simultaneous_visibility(self):
        """Test that echo_chamber uses simultaneous visibility."""
        from socialsim4.scenarios.echo_chamber import build_echo_chamber_sim

        scene = build_echo_chamber_sim()
        settings = scene.template_config['settings']

        assert settings['round_visibility'] == 'simultaneous'

    def test_resource_scarcity_has_trade_actions(self):
        """Test that resource_scarcity includes trade-related actions."""
        from socialsim4.scenarios.resource_scarcity import build_resource_scarcity_sim

        scene = build_resource_scarcity_sim()
        actions = scene.template_config['actions']
        action_names = {a['name'] for a in actions}

        # Should include resource management actions
        expected_actions = ['share_resources', 'hoard', 'propose_trade', 'form_contract']
        for expected in expected_actions:
            assert expected in action_names

    def test_scenario_exports(self):
        """Test that scenario files export expected constants."""
        from socialsim4.scenarios.social_norm_disruption import (
            SCENARIO_ACTIONS,
            CATEGORY_ACTIONS,
            DEFAULT_ACTION_IDS,
        )

        assert isinstance(SCENARIO_ACTIONS, list)
        assert isinstance(CATEGORY_ACTIONS, list)
        assert isinstance(DEFAULT_ACTION_IDS, list)
        assert len(SCENARIO_ACTIONS) > 0
        assert len(CATEGORY_ACTIONS) > 0


class TestExperimentSceneIntegration:
    """Test ExperimentScene integration with sociology scenarios."""

    def test_experiment_scene_requires_template_config(self):
        """Test that ExperimentScene can be created with template_config."""
        from socialsim4.core.scenes.experiment_scene import ExperimentScene

        template_config = {
            'description': 'Test description',
            'actions': [{'name': 'test_action', 'description': 'Test action'}],
            'settings': {
                'round_visibility': 'simultaneous',
            }
        }

        scene = ExperimentScene(
            name='test_scene',
            initial_event='Test event',
            template_config=template_config,
        )

        assert scene.description == 'Test description'
        assert scene.actions_config == template_config['actions']
        assert scene.round_visibility == 'simultaneous'

    def test_experiment_scene_serialize_config(self):
        """Test that ExperimentScene can serialize and deserialize config."""
        from socialsim4.scenarios.social_norm_disruption import build_social_norm_disruption_sim

        scene1 = build_social_norm_disruption_sim()

        # Simulate running one round to set state
        scene1._current_round = 1
        scene1._first_agent_name = "agent1"

        # Serialize
        config = scene1.serialize_config()

        assert 'template_config' in config
        assert 'current_round' in config
        assert 'first_agent_name' in config

        # Deserialize
        kwargs = ExperimentScene.deserialize_config(config)

        assert 'template_config' in kwargs
        assert 'current_round' in kwargs
        assert 'first_agent_name' in kwargs

        # Create new scene from deserialized config
        scene2 = ExperimentScene(**kwargs)

        assert scene2._current_round == 1
        assert scene2._first_agent_name == "agent1"
