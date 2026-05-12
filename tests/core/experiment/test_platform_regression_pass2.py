"""Incremental full-platform regression coverage beyond Custom Scenario."""

import asyncio
from unittest.mock import patch

import pytest

from socialsim4.core.experiment.config import ExperimentConfig
from socialsim4.core.experiment.scene import ExperimentScene
from socialsim4.core.experiment.scenes.council_experiment import (
    CouncilCyclePhase,
    CouncilExperimentScene,
)


class ScriptedLLM:
    """Deterministic chat stub that also captures prompts."""

    def __init__(self, responses):
        self.responses = list(responses)
        self.prompts = []

    def chat(self, messages, json_mode=False):
        _ = json_mode
        self.prompts.append(messages[-1]["content"])
        if not self.responses:
            raise AssertionError("No scripted LLM response left for prompt")
        return self.responses.pop(0)


def run_one_round(scene, llm):
    emitted = []
    scene.initialize(llm)
    with patch.dict("os.environ", {"SOCIALSIM_LLM_CONCURRENCY": "1"}):
        result = asyncio.run(
            scene.run_round(lambda event_type, data: emitted.append((event_type, data)))
        )
    return result, emitted


def test_prisoners_dilemma_runtime_round_records_payoffs_and_history():
    config = ExperimentConfig(
        scenario_id="prisoners_dilemma",
        description="PD regression test",
        agents=[
            {"name": "Alice"},
            {"name": "Bob"},
        ],
        actions=[],
        parameters={},
    )
    llm = ScriptedLLM([
        '{"action": "cooperate"}',
        '{"action": "defect"}',
    ])

    scene = ExperimentScene(config)
    result, emitted = run_one_round(scene, llm)

    assert [action.action_name for action in result.actions] == ["cooperate", "defect"]
    assert result.payoffs == {"Alice": 5, "Bob": 0}
    assert len(emitted) == 2
    assert scene.state.round == 1
    assert scene._history[0]["payoffs"] == {"Alice": 5, "Bob": 0}


def test_prisoners_dilemma_invalid_action_is_recorded_as_failure():
    config = ExperimentConfig(
        scenario_id="prisoners_dilemma",
        description="PD invalid-action regression test",
        agents=[
            {"name": "Alice"},
            {"name": "Bob"},
        ],
        actions=[],
        parameters={},
    )
    llm = ScriptedLLM([
        '{"action": "nonsense"}',
        '{"action": "nonsense"}',
    ])

    scene = ExperimentScene(config)
    result, emitted = run_one_round(scene, llm)

    assert all(not action.success for action in result.actions)
    assert all(action.skipped for action in result.actions)
    assert len(emitted) == 2
    assert all(data["success"] is False for _, data in emitted)


def test_public_goods_runtime_tracks_contributions_payoffs_and_last_contribution():
    config = ExperimentConfig(
        scenario_id="public_goods",
        description="PGG regression test",
        agents=[
            {"name": "Alice"},
            {"name": "Bob"},
            {"name": "Charlie"},
        ],
        actions=[],
        parameters={
            "tokens_per_round": 10,
            "multiplier": 1.5,
            "deduction_budget_per_phase": 0,
        },
        social_network={"edges": [("Alice", "Bob"), ("Bob", "Charlie")]},
    )
    llm = ScriptedLLM([
        '{"action": "allocate"}',
        '{"amount": 0}',
        '{"action": "allocate"}',
        '{"amount": 5}',
        '{"action": "allocate"}',
        '{"amount": 10}',
    ])

    scene = ExperimentScene(config)
    result, emitted = run_one_round(scene, llm)

    assert [action.action_name for action in result.actions] == ["allocate", "allocate", "allocate"]
    assert result.payoffs == {"Alice": 17.5, "Bob": 12.5, "Charlie": 7.5}
    assert scene.state.agents["Alice"].properties["last_contribution"] == 0
    assert scene.state.agents["Bob"].properties["last_contribution"] == 5
    assert scene.state.agents["Charlie"].properties["last_contribution"] == 10
    assert len(emitted) == 3


def test_open_discussion_runtime_records_speech_event():
    config = ExperimentConfig(
        scenario_id="open_discussion",
        description="Open discussion regression test",
        agents=[
            {"name": "Alice"},
            {"name": "Bob"},
        ],
        actions=[],
        parameters={"topic": "How should we spend the shared budget?"},
    )
    llm = ScriptedLLM([
        '{"action": "speak"}',
        "We should invest in parks.",
        '{"action": "speak"}',
        "We should improve transit.",
    ])

    scene = ExperimentScene(config)
    result, emitted = run_one_round(scene, llm)

    assert [action.action_name for action in result.actions] == ["speak", "speak"]
    assert emitted[0][1]["parameters"]["message"] == "We should invest in parks."
    assert emitted[1][1]["parameters"]["message"] == "We should improve transit."
    assert len(scene._history[0]["actions"]) == 2


def test_custom_runtime_rejects_speak_without_message():
    config = ExperimentConfig(
        scenario_id="custom",
        description="Custom regression test",
        agents=[
            {"name": "Alice"},
        ],
        actions=[],
        parameters={
            "custom_prompt": "Discuss neighborhood priorities.",
            "turn_ordering": "sequential",
        },
        round_visibility="sequential",
        social_network={"edges": []},
    )
    llm = ScriptedLLM(['{"action": "speak"}'])

    scene = ExperimentScene(config)
    result, emitted = run_one_round(scene, llm)

    assert result.actions[0].success is False
    assert result.actions[0].skipped is True
    assert emitted[0][1]["success"] is False


def test_echo_chamber_record_only_actions_succeed_with_record_only_flag():
    config = ExperimentConfig(
        scenario_id="echo_chamber",
        description="Echo chamber record-only action test",
        agents=[
            {"name": "Alice"},
            {"name": "Bob"},
        ],
        actions=[],
        parameters={
            "connection_homogeneity": 0.7,
            "opinion_distribution": "balanced",
        },
        social_network={"edges": [("Alice", "Bob")]},
    )
    llm = ScriptedLLM([
        '{"action": "express_opinion"}',
        '{"action": "share_content"}',
    ])

    scene = ExperimentScene(config)
    result, emitted = run_one_round(scene, llm)

    assert [action.action_name for action in result.actions] == ["express_opinion", "share_content"]
    assert all(action.success for action in result.actions)
    # Record-only actions report success=True with record_only=True and effect_applied=False
    assert all(data["success"] is True for _, data in emitted)
    assert all(data["record_only"] is True for _, data in emitted)
    assert all(data["effect_applied"] is False for _, data in emitted)


def test_echo_chamber_unsupported_action_fails_with_success_false():
    """Unknown actions (not in registry) must report success=False in events."""
    config = ExperimentConfig(
        scenario_id="echo_chamber",
        description="Echo chamber unsupported-action regression test",
        agents=[
            {"name": "Alice"},
        ],
        actions=[],
        parameters={
            "connection_homogeneity": 0.7,
            "opinion_distribution": "balanced",
        },
        social_network={"edges": []},
    )
    # Use a totally unknown action that bypasses validation via direct execution test
    scene = ExperimentScene(config)
    llm = ScriptedLLM([])
    scene.initialize(llm)
    exec_result = scene.runner.execute_action("totally_unknown_action", "Alice", {}, scene.state, scene)
    assert exec_result == {"success": False, "error": "Unknown action: totally_unknown_action"}


def test_executable_action_reports_effect_applied_true():
    """Actions with real handlers should report effect_applied=True."""
    config = ExperimentConfig(
        scenario_id="contagion",
        description="Executable action effect_applied test",
        agents=[
            {"name": "Alice", "position": (2, 2)},
            {"name": "Bob", "position": (4, 4)},
        ],
        actions=[],
        parameters={"grid_size": 10},
        social_network={"edges": [("Alice", "Bob")]},
    )
    llm = ScriptedLLM([
        '{"action": "move"}',
        '{"direction": "north"}',
        '{"action": "speak"}',
        "Stay back.",
    ])

    scene = ExperimentScene(config)
    result, emitted = run_one_round(scene, llm)

    # Move is an executable action — should report effect_applied=True
    move_event = emitted[0][1]
    assert move_event["action"] == "move"
    assert move_event["success"] is True
    assert move_event["effect_applied"] is True
    assert scene.state.agents["Alice"].position == (2, 1)


def test_contagion_runtime_move_updates_position():
    config = ExperimentConfig(
        scenario_id="contagion",
        description="Contagion move regression test",
        agents=[
            {"name": "Alice", "position": (2, 2)},
            {"name": "Bob", "position": (4, 4)},
        ],
        actions=[],
        parameters={"grid_size": 10},
        social_network={"edges": [("Alice", "Bob")]},
    )
    llm = ScriptedLLM([
        '{"action": "move"}',
        '{"direction": "north"}',
        '{"action": "speak"}',
        "Stay back.",
    ])

    scene = ExperimentScene(config)
    result, emitted = run_one_round(scene, llm)

    assert result.actions[0].action_name == "move"
    assert result.actions[1].action_name == "speak"
    assert scene.state.agents["Alice"].position == (2, 1)
    assert len(emitted) == 2


def test_council_chamber_voting_round_records_votes():
    config = ExperimentConfig(
        scenario_id="council_chamber",
        description="Council voting regression test",
        agents=[
            {"name": "Alice"},
            {"name": "Bob"},
        ],
        actions=[],
        parameters={
            "proposal_text": "Fund the public library.",
            "voting_threshold": 0.5,
            "max_rounds": 5,
            "deliberation_rounds": 1,
        },
    )
    llm = ScriptedLLM([
        '{"action": "vote_yes"}',
        '{"action": "abstain"}',
    ])

    scene = CouncilExperimentScene(config)
    scene.initialize(llm)
    scene.cycle_phase = CouncilCyclePhase.VOTING
    scene.state.extensions["voting_started"] = True

    emitted = []
    with patch.dict("os.environ", {"SOCIALSIM_LLM_CONCURRENCY": "1"}):
        result = asyncio.run(
            scene.run_round(lambda event_type, data: emitted.append((event_type, data)))
        )

    assert [action.action_name for action in result.actions] == ["vote_yes", "abstain"]
    assert scene.state.extensions["votes"] == {"Alice": "yes", "Bob": "abstain"}
    assert len(emitted) == 2


def test_echo_chamber_neighborhood_visibility_hides_non_neighbors_in_next_round_context():
    config = ExperimentConfig(
        scenario_id="echo_chamber",
        description="Echo chamber visibility regression test",
        agents=[
            {"name": "Alice"},
            {"name": "Bob"},
            {"name": "Charlie"},
        ],
        actions=[],
        parameters={
            "connection_homogeneity": 0.7,
            "opinion_distribution": "balanced",
        },
        social_network={"edges": [("Alice", "Bob"), ("Bob", "Charlie")]},
    )
    llm = ScriptedLLM([
        '{"action": "express_opinion"}',
        '{"action": "share_content"}',
        '{"action": "disengage"}',
        '{"action": "express_opinion"}',
        '{"action": "share_content"}',
        '{"action": "disengage"}',
    ])

    scene = ExperimentScene(config)
    scene.initialize(llm)
    with patch.dict("os.environ", {"SOCIALSIM_LLM_CONCURRENCY": "1"}):
        asyncio.run(scene.run_round(lambda event_type, data: None))
        asyncio.run(scene.run_round(lambda event_type, data: None))

    alice_round_two_prompt = llm.prompts[3]
    assert "Bob share_content" in alice_round_two_prompt
    assert "Charlie disengage" not in alice_round_two_prompt


@pytest.mark.xfail(
    reason="Known investigation area: public_goods still defaults to all-agent average instead of network-neighbor average",
    strict=False,
)
def test_public_goods_average_prompt_should_use_neighbors_not_global_population():
    config = ExperimentConfig(
        scenario_id="public_goods",
        description="PGG neighbor-average regression test",
        agents=[
            {"name": "Alice"},
            {"name": "Bob"},
            {"name": "Charlie"},
        ],
        actions=[],
        parameters={
            "tokens_per_round": 10,
            "multiplier": 1.5,
            "deduction_budget_per_phase": 0,
            "show_average_contribution": True,
        },
        social_network={"edges": [("Alice", "Bob"), ("Bob", "Charlie")]},
    )
    llm = ScriptedLLM([
        '{"action": "allocate", "amount": 0}',
        '{"action": "allocate", "amount": 5}',
        '{"action": "allocate", "amount": 10}',
        '{"action": "keep"}',
        '{"action": "keep"}',
        '{"action": "keep"}',
    ])

    scene = ExperimentScene(config)
    scene.initialize(llm)
    with patch.dict("os.environ", {"SOCIALSIM_LLM_CONCURRENCY": "1"}):
        asyncio.run(scene.run_round(lambda event_type, data: None))
        asyncio.run(scene.run_round(lambda event_type, data: None))

    alice_round_two_prompt = llm.prompts[3]
    assert "Average contribution from 1 neighbors: 5.0" in alice_round_two_prompt
    assert "Average contribution from 2 other agents: 7.5" not in alice_round_two_prompt


def test_custom_simultaneous_mode_hides_same_round_earlier_actions():
    config = ExperimentConfig(
        scenario_id="custom",
        description="Custom simultaneous visibility regression test",
        agents=[
            {"name": "Alice"},
            {"name": "Bob"},
        ],
        actions=[],
        parameters={
            "custom_prompt": "Discuss neighborhood safety.",
            "turn_ordering": "simultaneous",
        },
        round_visibility="simultaneous",
        social_network={"edges": [("Alice", "Bob")]},
    )
    llm = ScriptedLLM([
        '{"action": "speak", "message": "Hello from Alice"}',
        '{"action": "speak", "message": "Hello from Bob"}',
    ])

    scene = ExperimentScene(config)
    scene.initialize(llm)
    with patch.dict("os.environ", {"SOCIALSIM_LLM_CONCURRENCY": "1"}):
        asyncio.run(scene.run_round(lambda event_type, data: None))

    bob_prompt = llm.prompts[1]
    assert "Hello from Alice" not in bob_prompt


def test_custom_sequential_mode_exposes_same_round_earlier_actions():
    config = ExperimentConfig(
        scenario_id="custom",
        description="Custom sequential visibility regression test",
        agents=[
            {"name": "Alice"},
            {"name": "Bob"},
        ],
        actions=[],
        parameters={
            "custom_prompt": "Discuss neighborhood safety.",
            "turn_ordering": "sequential",
        },
        round_visibility="sequential",
        social_network={"edges": [("Alice", "Bob")]},
    )
    llm = ScriptedLLM([
        '{"action": "speak", "message": "Hello from Alice"}',
        '{"action": "speak", "message": "Hello from Bob"}',
    ])

    scene = ExperimentScene(config)
    scene.initialize(llm)
    with patch.dict("os.environ", {"SOCIALSIM_LLM_CONCURRENCY": "1"}):
        asyncio.run(scene.run_round(lambda event_type, data: None))

    bob_prompt = llm.prompts[1]
    assert "Hello from Alice" in bob_prompt


def test_custom_random_mode_uses_random_order_and_current_visibility_behavior():
    config = ExperimentConfig(
        scenario_id="custom",
        description="Custom random visibility regression test",
        agents=[
            {"name": "Alice"},
            {"name": "Bob"},
        ],
        actions=[],
        parameters={
            "custom_prompt": "Discuss neighborhood safety.",
            "turn_ordering": "random_sequential",
        },
        round_visibility="random",
        social_network={"edges": [("Alice", "Bob")]},
    )
    llm = ScriptedLLM([
        '{"action": "speak", "message": "Hello from Bob"}',
        '{"action": "speak", "message": "Hello from Alice"}',
    ])

    scene = ExperimentScene(config)
    scene.initialize(llm)
    with patch("random.shuffle", lambda values: values.reverse()):
        with patch.dict("os.environ", {"SOCIALSIM_LLM_CONCURRENCY": "1"}):
            asyncio.run(scene.run_round(lambda event_type, data: None))

    assert scene.runner.turn_order == ["Bob", "Alice"]
    alice_prompt = llm.prompts[1]
    assert "Hello from Bob" in alice_prompt
