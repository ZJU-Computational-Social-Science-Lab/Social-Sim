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

