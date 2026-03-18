from socialsim4.core.agent import Agent
from socialsim4.core.agent.parsing import parse_actions


def test_parse_actions_skips_conflicting_duplicate_action_and_uses_later_valid_json():
    response = """
    {
      "thoughts": "bad",
      "action": {"name": "send_message", "message": "x"},
      "action": {"name": "yield"}
    }

    {
      "thoughts": "good",
      "response": "",
      "action": {"name": "send_message", "message": "ok"},
      "context_update": "done",
      "metadata": {}
    }
    """

    parsed = parse_actions(response)

    assert parsed[0]["action"]["name"] == "send_message"
    assert parsed[0]["action"]["message"] == "ok"


def test_agent_only_counts_final_parse_failure_per_turn():
    agent = Agent(
        name="Tester",
        user_profile="profile",
        style="",
        action_space=[],
        max_repeat=2,
        max_consecutive_llm_errors=3,
    )
    outputs = [
        "[Action] send_message\nhello",
        "当前已没有任何动作倾向，建议注入新的环境事件或发布新的政策。",
        "[Action] yield",
    ]
    agent.call_llm = lambda clients, ctx: outputs.pop(0)
    agent.add_env_feedback("new event")

    result = agent.process({}, initiative=False, scene=None)

    assert result == {}
    assert agent.consecutive_llm_errors == 1
    assert agent.is_offline is False

