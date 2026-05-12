"""Full-platform scenario/action matrix regression tests.

This module keeps the registry-wide action surface explicit. The goal is not
to silently "fix" legacy mismatches, but to force them to stay documented.
"""

from socialsim4.core.registry import get_information_model
from socialsim4.core.scenarios.registry import ALL_SCENARIOS, get_scenario_actions


SOCIOLOGY_SCENARIOS = {
    "social_norm_disruption",
    "policy_erosion",
    "echo_chamber",
    "resource_scarcity",
    "xihu_yilianbao",
}


KNOWN_BROKEN_ACTIONS = {
    "social_norm_disruption",
    "policy_erosion",
    "echo_chamber",
    "resource_scarcity",
    "xihu_yilianbao",
    "grid_world",
    "werewolf",
    "public_goods",
}


def classify_scenario_action(scenario_id: str, action_id: str) -> str | None:
    if scenario_id in {"prisoners_dilemma", "battle_of_the_sexes", "stag_hunt"}:
        return "payoff_only"

    if scenario_id == "public_goods":
        if action_id in {"allocate", "keep"}:
            return "payoff_only"
        if action_id == "skip":
            return "no_op"
        if action_id == "reduce":
            return "broken"

    if scenario_id in SOCIOLOGY_SCENARIOS:
        return "broken"

    if scenario_id == "open_discussion":
        if action_id == "speak":
            return "record_only"

    if scenario_id == "council_chamber":
        if action_id == "speak":
            return "record_only"
        if action_id == "skip":
            return "no_op"
        if action_id in {"vote_yes", "vote_no", "abstain"}:
            return "executable"

    if scenario_id == "grid_world":
        return "broken"

    if scenario_id == "werewolf":
        if action_id == "speak":
            return "record_only"
        if action_id == "vote":
            return "broken"

    if scenario_id == "coordination_game":
        return None

    if scenario_id == "contagion":
        if action_id == "move":
            return "executable"
        if action_id == "speak":
            return "record_only"

    if scenario_id == "custom":
        if action_id == "speak":
            return "record_only"
        if action_id == "skip":
            return "no_op"

    return None


def test_every_registered_scenario_has_stable_core_metadata():
    for scenario in ALL_SCENARIOS:
        assert scenario["id"]
        assert scenario["name"]
        assert scenario["description"]
        assert scenario["category"]
        assert scenario["grouping_mode"]
        assert scenario["interaction_mode"]
        assert scenario["payoff_type"] is not None


def test_every_registered_action_has_stable_id_and_name():
    for scenario in ALL_SCENARIOS:
        actions = get_scenario_actions(scenario["id"])
        ids = [action["id"] for action in actions]
        assert len(ids) == len(set(ids)), f"Duplicate action ids in {scenario['id']}: {ids}"
        for action in actions:
            assert action["id"], f"Missing action id in {scenario['id']}"
            assert action["name"], f"Missing action name in {scenario['id']}/{action['id']}"
            assert "description" in action, f"Missing action description in {scenario['id']}/{action['id']}"


def test_default_selected_actions_are_valid_for_their_scenarios():
    for scenario in ALL_SCENARIOS:
        default_action_ids = scenario.get("default_action_ids") or []
        exposed = {action["id"] for action in get_scenario_actions(scenario["id"])}
        for action_id in default_action_ids:
            assert action_id in exposed, (
                f"{scenario['id']} default_action_ids contains unknown action {action_id!r}"
            )


def test_custom_scenario_exposes_only_speak_and_skip():
    custom_actions = get_scenario_actions("custom")
    assert [action["id"] for action in custom_actions] == ["speak", "skip"]


def test_every_exposed_action_is_classified_or_explicitly_known_dynamic():
    for scenario in ALL_SCENARIOS:
        actions = get_scenario_actions(scenario["id"])
        if scenario["id"] == "coordination_game":
            assert actions == []
            continue

        for action in actions:
            classification = classify_scenario_action(scenario["id"], action["id"])
            assert classification is not None, (
                f"{scenario['id']}/{action['id']} is exposed but not classified"
            )


def test_known_broken_action_surfaces_are_explicit():
    broken_by_scenario = {}
    for scenario in ALL_SCENARIOS:
        broken_ids = [
            action["id"]
            for action in get_scenario_actions(scenario["id"])
            if classify_scenario_action(scenario["id"], action["id"]) == "broken"
        ]
        if broken_ids:
            broken_by_scenario[scenario["id"]] = broken_ids

    assert set(broken_by_scenario) == KNOWN_BROKEN_ACTIONS


def test_information_model_matches_registry_shape_for_full_matrix():
    expected_scopes = {
        "prisoners_dilemma": "pair",
        "battle_of_the_sexes": "pair",
        "stag_hunt": "all",
        "social_norm_disruption": "all",
        "policy_erosion": "all",
        "echo_chamber": "neighborhood",
        "resource_scarcity": "all",
        "xihu_yilianbao": "all",
        "open_discussion": "all",
        "council_chamber": "all",
        "grid_world": "neighborhood",
        "werewolf": "all",
        "public_goods": "all",
        "coordination_game": "neighborhood",
        "contagion": "neighborhood",
        "custom": "neighborhood",
    }

    for scenario in ALL_SCENARIOS:
        model = get_information_model(scenario["id"])
        assert model.scope_type == expected_scopes[scenario["id"]]
