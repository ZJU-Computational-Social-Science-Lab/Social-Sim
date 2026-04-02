"""Test that council experiments deserialize correctly."""
import sys
sys.path.insert(0, "C:\\Users\\Justin\\Documents\\ZJU_Work\\Social-Sim")

from socialsim4.backend.services.simtree_runtime import ExperimentRunnerAdapter
from socialsim4.core.experiment.config import ExperimentConfig
from socialsim4.core.experiment.scenes.council_experiment import CouncilExperimentScene

def test_deserialize_council():
    """Test that deserializing a council experiment creates CouncilExperimentScene."""
    # Create a council experiment
    config = ExperimentConfig(
        agents=[{"name": "Agent 1", "properties": {}}],
        actions=[{"name": "speak"}, {"name": "skip"}, {"name": "vote_yes"}],
        parameters={"deliberation_rounds": 3, "proposal_text": "Test proposal"},
        description="Test council",
        scenario_id="council",
        round_visibility="sequential",
    )

    scene = CouncilExperimentScene(config)

    # Serialize it
    adapter = ExperimentRunnerAdapter(scene, {})
    serialized = adapter.serialize()

    print("Serialized data:")
    print(f"  scenario_id: {serialized['scene']['config']['config']['scenario_id']}")

    # Deserialize it
    deserialized = ExperimentRunnerAdapter.deserialize(serialized, {})

    print("\nDeserialized scene:")
    print(f"  Type: {type(deserialized.scene).__name__}")
    print(f"  Has get_scene_actions: {hasattr(deserialized.scene, 'get_scene_actions')}")

    # Verify it's a CouncilExperimentScene
    assert isinstance(deserialized.scene, CouncilExperimentScene), \
        f"Expected CouncilExperimentScene, got {type(deserialized.scene).__name__}"
    assert hasattr(deserialized.scene, 'get_scene_actions'), \
        "Deserialized scene should have get_scene_actions method"

    print("\n✅ Test passed! Council experiments deserialize correctly.")

if __name__ == "__main__":
    test_deserialize_council()
