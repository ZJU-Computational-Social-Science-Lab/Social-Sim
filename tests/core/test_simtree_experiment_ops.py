"""
Tests for experiment-related SimTree ops: config_params_patch, network_replace.

These tests verify that the ops correctly modify scene.config.parameters and
scene.config.social_network in a cloned simulator context.
"""
import pytest
from unittest.mock import Mock

from socialsim4.core.simtree import SimTree
from socialsim4.core.experiment.config import ExperimentConfig
from socialsim4.core.experiment.scene import ExperimentScene
from socialsim4.backend.services.simtree_runtime import ExperimentRunnerAdapter


# ---------------------------------------------------------------------------
# Test fixtures
# ---------------------------------------------------------------------------

class _DummyLLM:
    """Minimal Dummy LLM that returns a valid response."""

    def chat(self, messages):
        return (
            "--- Thoughts ---\n"
            "Dummy thoughts.\n\n"
            "--- Plan ---\n"
            "1. Do nothing. [CURRENT]\n\n"
            "--- Action ---\n"
            '<Action name="yield" />\n\n'
            "--- Plan Update ---\n"
            "no change\n"
        )


def make_dummy_clients() -> dict:
    c = _DummyLLM()
    return {"chat": c, "default": c}


@pytest.fixture
def simtree_with_experiment():
    """Create a SimTree with an ExperimentScene that has config.parameters."""
    clients = make_dummy_clients()

    # Create an experiment config with parameters
    config = ExperimentConfig(
        scenario_id="test",
        agents=[
            {"name": "Alice", "properties": {}},
            {"name": "Bob", "properties": {}},
        ],
        actions=[
            {"name": "cooperate", "description": "Cooperate with partner"},
            {"name": "defect", "description": "Defect from partner"},
        ],
        parameters={"cooperate_reward": 3, "multiplier": 2.0, "n_rounds": 10},
    )

    # Create an experiment scene
    scene = ExperimentScene(config)

    # Create adapter
    adapter = ExperimentRunnerAdapter(scene, clients)

    # Create SimTree
    tree = SimTree.new(adapter, clients)
    return tree, tree.root


# ---------------------------------------------------------------------------
# config_params_patch tests
# ---------------------------------------------------------------------------

class TestConfigParamsPatch:

    def test_merge_preserves_unspecified_base_keys(self, simtree_with_experiment):
        """Critical: only the specified keys change; other base keys are untouched."""
        tree, root_id = simtree_with_experiment
        # Set up base parameters
        tree.nodes[root_id]["sim"].scene.config.parameters = {
            "cooperate_reward": 3,
            "multiplier": 2.0,
            "n_rounds": 10,
        }

        child_id = tree.branch(root_id, [
            {"op": "config_params_patch", "updates": {"cooperate_reward": 5}}
        ])

        child_params = tree.nodes[child_id]["sim"].scene.config.parameters
        assert child_params["cooperate_reward"] == 5   # patched
        assert child_params["multiplier"] == 2.0        # preserved
        assert child_params["n_rounds"] == 10           # preserved

    def test_overrides_specified_keys(self, simtree_with_experiment):
        tree, root_id = simtree_with_experiment
        tree.nodes[root_id]["sim"].scene.config.parameters = {"cooperate_reward": 1}

        child_id = tree.branch(root_id, [
            {"op": "config_params_patch", "updates": {"cooperate_reward": 5}}
        ])
        assert tree.nodes[child_id]["sim"].scene.config.parameters["cooperate_reward"] == 5

    def test_can_add_new_keys(self, simtree_with_experiment):
        """Updates can add keys not present in base config."""
        tree, root_id = simtree_with_experiment
        tree.nodes[root_id]["sim"].scene.config.parameters = {"existing": 1}

        child_id = tree.branch(root_id, [
            {"op": "config_params_patch", "updates": {"new_key": True}}
        ])
        child_params = tree.nodes[child_id]["sim"].scene.config.parameters
        assert child_params["existing"] == 1
        assert child_params["new_key"] is True

    def test_does_not_affect_parent(self, simtree_with_experiment):
        tree, root_id = simtree_with_experiment
        original = {"cooperate_reward": 1}
        tree.nodes[root_id]["sim"].scene.config.parameters = original.copy()

        tree.branch(root_id, [{"op": "config_params_patch", "updates": {"cooperate_reward": 5}}])

        assert tree.nodes[root_id]["sim"].scene.config.parameters == original

    def test_types_preserved(self, simtree_with_experiment):
        """int, float, bool values round-trip correctly."""
        tree, root_id = simtree_with_experiment
        tree.nodes[root_id]["sim"].scene.config.parameters = {}

        child_id = tree.branch(root_id, [
            {"op": "config_params_patch", "updates": {
                "int_val": 5,
                "float_val": 1.5,
                "bool_val": True,
            }}
        ])
        p = tree.nodes[child_id]["sim"].scene.config.parameters
        assert isinstance(p["int_val"], int) and p["int_val"] == 5
        assert isinstance(p["float_val"], float) and p["float_val"] == 1.5
        assert p["bool_val"] is True


# ---------------------------------------------------------------------------
# network_replace tests
# ---------------------------------------------------------------------------

class TestNetworkReplace:

    def test_updates_both_config_and_state(self, simtree_with_experiment):
        """Both config.social_network and runner.scene_state['graph'] must be updated."""
        tree, root_id = simtree_with_experiment
        network = {"edges": [["Alice", "Bob"], ["Bob", "Charlie"]], "preset": "ring", "seed": 1}

        child_id = tree.branch(root_id, [{"op": "network_replace", "network": network}])
        child_sim = tree.nodes[child_id]["sim"]

        assert child_sim.scene.config.social_network == network
        # Graph is stored in runner.scene_state for ExperimentScene
        assert child_sim.scene.runner.scene_state["graph"] == network

    def test_does_not_affect_parent(self, simtree_with_experiment):
        tree, root_id = simtree_with_experiment
        original_network = {"edges": [["A", "B"]]}
        tree.nodes[root_id]["sim"].scene.config.social_network = original_network
        tree.nodes[root_id]["sim"].scene.runner.scene_state["graph"] = original_network

        network = {"edges": [["Alice", "Bob"], ["Bob", "Charlie"]], "preset": "star", "seed": 2}
        tree.branch(root_id, [{"op": "network_replace", "network": network}])

        assert tree.nodes[root_id]["sim"].scene.config.social_network == original_network
        assert tree.nodes[root_id]["sim"].scene.runner.scene_state["graph"] == original_network

    def test_edge_format_compatible_with_information_model(self, simtree_with_experiment):
        """The 'edges' key with list-of-pairs format must be present."""
        tree, root_id = simtree_with_experiment
        network = {"edges": [["Alice", "Bob"], ["Bob", "Charlie"]], "preset": "ring", "seed": 1}

        child_id = tree.branch(root_id, [{"op": "network_replace", "network": network}])
        graph = tree.nodes[child_id]["sim"].scene.runner.scene_state["graph"]

        assert "edges" in graph
        assert isinstance(graph["edges"], list)
        assert graph["edges"][0] == ["Alice", "Bob"]

    def test_metadata_fields_stored(self, simtree_with_experiment):
        """preset and seed metadata must survive round-trip to config."""
        tree, root_id = simtree_with_experiment
        network = {"edges": [], "preset": "random", "seed": 12345}

        child_id = tree.branch(root_id, [{"op": "network_replace", "network": network}])
        stored = tree.nodes[child_id]["sim"].scene.config.social_network

        assert stored["preset"] == "random"
        assert stored["seed"] == 12345

    def test_empty_edges(self, simtree_with_experiment):
        tree, root_id = simtree_with_experiment
        network = {"edges": [], "preset": "custom", "seed": 0}

        child_id = tree.branch(root_id, [{"op": "network_replace", "network": network}])
        assert tree.nodes[child_id]["sim"].scene.runner.scene_state["graph"]["edges"] == []


# ---------------------------------------------------------------------------
# config_description_patch tests
# ---------------------------------------------------------------------------

class TestConfigDescriptionPatch:

    def test_updates_description(self, simtree_with_experiment):
        """config_description_patch should update scene.config.description."""
        tree, root_id = simtree_with_experiment
        tree.nodes[root_id]["sim"].scene.config.description = "Original description"

        child_id = tree.branch(root_id, [
            {"op": "config_description_patch", "description": "New description for variant"}
        ])

        assert tree.nodes[child_id]["sim"].scene.config.description == "New description for variant"

    def test_does_not_affect_parent(self, simtree_with_experiment):
        """Patching description should not affect the parent node."""
        tree, root_id = simtree_with_experiment
        tree.nodes[root_id]["sim"].scene.config.description = "Original"

        tree.branch(root_id, [
            {"op": "config_description_patch", "description": "Changed"}
        ])

        assert tree.nodes[root_id]["sim"].scene.config.description == "Original"


# ---------------------------------------------------------------------------
# config_settings_patch tests
# ---------------------------------------------------------------------------

class TestConfigSettingsPatch:

    def test_updates_round_visibility(self, simtree_with_experiment):
        """config_settings_patch should update scene.config.round_visibility."""
        tree, root_id = simtree_with_experiment
        tree.nodes[root_id]["sim"].scene.config.round_visibility = "simultaneous"

        child_id = tree.branch(root_id, [
            {"op": "config_settings_patch", "settings": {"round_visibility": "sequential"}}
        ])

        assert tree.nodes[child_id]["sim"].scene.config.round_visibility == "sequential"

    def test_preserves_unspecified_settings(self, simtree_with_experiment):
        """Settings not in the patch should remain unchanged."""
        tree, root_id = simtree_with_experiment
        tree.nodes[root_id]["sim"].scene.config.round_visibility = "simultaneous"
        tree.nodes[root_id]["sim"].scene.config.description = "Original desc"

        child_id = tree.branch(root_id, [
            {"op": "config_settings_patch", "settings": {"round_visibility": "sequential"}}
        ])

        child_config = tree.nodes[child_id]["sim"].scene.config
        assert child_config.round_visibility == "sequential"
        assert child_config.description == "Original desc"

    def test_does_not_affect_parent(self, simtree_with_experiment):
        """Patching settings should not affect the parent node."""
        tree, root_id = simtree_with_experiment
        tree.nodes[root_id]["sim"].scene.config.round_visibility = "simultaneous"

        tree.branch(root_id, [
            {"op": "config_settings_patch", "settings": {"round_visibility": "sequential"}}
        ])

        assert tree.nodes[root_id]["sim"].scene.config.round_visibility == "simultaneous"
