from socialsim4.backend.api.routes.scenes import scene_config_template
from socialsim4.core.registry import get_scene_class


def test_council_experiment_scene_config_template_builds_without_instantiation_error():
    data = scene_config_template("council_experiment", get_scene_class("council_experiment"))

    assert data["type"] == "council_experiment"
    assert data["name"] == "CouncilExperimentScene"
    assert data["config_schema"]["deliberation_rounds"] == 3
    assert data["config_schema"]["voting_threshold"] == 0.5
    assert data["config_schema"]["proposal_text"]
    assert "speak" in data["basic_actions"]
    assert "vote_yes" in data["basic_actions"]
