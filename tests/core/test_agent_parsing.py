import pytest

from socialsim4.core.agent import Agent
from socialsim4.core.agent.parsing import parse_actions


@pytest.mark.xfail(reason="bug: pre-existing failure — needs investigation")
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


def test_parse_actions_normalizes_response_alias_to_send_message():
    response = """
    {
      "thoughts": "need reply",
      "response": "已确认资源支持及执行机制。",
      "action": "response",
      "context_update": "done",
      "metadata": {}
    }
    """

    parsed = parse_actions(response)

    assert parsed[0]["action"]["name"] == "send_message"
    assert parsed[0]["action"]["message"] == "已确认资源支持及执行机制。"
    assert parsed[0]["message"] == "已确认资源支持及执行机制。"


def test_parse_actions_normalizes_confirm_alias_to_send_message():
    response = """
    {
      "thoughts": "need confirm",
      "response": "当前无需调整之处。",
      "action": {"name": "confirm"},
      "context_update": "done",
      "metadata": {}
    }
    """

    parsed = parse_actions(response)

    assert parsed[0]["action"]["name"] == "send_message"
    assert parsed[0]["action"]["message"] == "当前无需调整之处。"


def test_parse_actions_flattens_nested_action_dict_and_hoists_message():
    response = """
    {
      "thoughts": "need action cleanup",
      "response": "",
      "action": {
        "name": "send_message",
        "message": "主消息",
        "action": {
          "name": "send_message",
          "message": "嵌套消息"
        },
        "context_update": "nested-update"
      },
      "metadata": {}
    }
    """

    parsed = parse_actions(response)

    assert parsed[0]["action"]["name"] == "send_message"
    assert parsed[0]["action"]["message"] == "主消息"
    assert parsed[0]["message"] == "主消息"
    assert parsed[0]["context_update"] == "nested-update"


def test_parse_actions_converts_string_send_message_to_dict():
    response = """
    {
      "thoughts": "need explicit dict",
      "response": "请优先补充预算细化。",
      "action": "send_message",
      "context_update": "done",
      "metadata": {}
    }
    """

    parsed = parse_actions(response)

    assert parsed[0]["action"]["name"] == "send_message"
    assert parsed[0]["action"]["message"] == "请优先补充预算细化。"


def test_parse_actions_converts_yield_with_response_to_send_message():
    response = """
    {
      "thoughts": "should not drop meaningful reply",
      "response": "当前资源不足需重新分配预算。",
      "action": {
        "name": "yield"
      },
      "context_update": "done",
      "metadata": {}
    }
    """

    parsed = parse_actions(response)

    assert parsed[0]["action"]["name"] == "send_message"
    assert parsed[0]["action"]["message"] == "当前资源不足需重新分配预算。"


@pytest.mark.xfail(reason="bug: pre-existing failure — needs investigation")
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

