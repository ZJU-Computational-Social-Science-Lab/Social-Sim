from socialsim4.core.agent.agent import Agent


class _MockClient:
    def __init__(self, label: str):
        self.label = label
        self.calls = []

    def chat(self, messages):
        self.calls.append(messages)
        return self.label


def test_call_llm_uses_provider_specific_client():
    agent = Agent("Alice", "", "", provider_id=2)
    default_client = _MockClient("default")
    provider_client = _MockClient("provider-2")

    result = agent.call_llm(
        {
            "chat": default_client,
            "providers": {2: provider_client},
        },
        [{"role": "user", "content": "hello"}],
    )

    assert result == "provider-2"
    assert provider_client.calls == [[{"role": "user", "content": "hello"}]]
    assert default_client.calls == []


def test_call_llm_falls_back_to_default_client_without_provider_mapping():
    agent = Agent("Alice", "", "", provider_id=9)
    default_client = _MockClient("default")

    result = agent.call_llm(
        {
            "chat": default_client,
            "providers": {2: _MockClient("provider-2")},
        },
        [{"role": "user", "content": "hello"}],
    )

    assert result == "default"
    assert default_client.calls == [[{"role": "user", "content": "hello"}]]