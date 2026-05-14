"""
Branch coverage tests for core.agent.serialization.

Targets untested branches in deserialize_agent: default agent_class,
deep-copy knowledge base, and deep-copy documents.

Contains: TestDeserializeBranches
"""

import json
import logging

import pytest

from socialsim4.core.agent import Agent
from socialsim4.core.agent.serialization import deserialize_agent, serialize_agent


def _make_data(**overrides):
    """Build a minimal valid serialized agent dict."""
    base = {
        "name": "TestAgent",
        "user_profile": "test profile",
        "style": "neutral",
        "initial_instruction": "",
        "role_prompt": "",
        "action_space": [],
        "language": "en",
    }
    base.update(overrides)
    return base


class TestDeserializeBranches:
    """Branch coverage for deserialize_agent."""

    def test_defaults_to_agent_class_when_none(self):
        """agent_class defaults to Agent when not provided (line 98)."""
        data = _make_data()
        agent = deserialize_agent(data)
        assert isinstance(agent, Agent)

    def test_uses_custom_agent_class(self):
        """Custom agent_class is used when provided (line 104)."""

        class CustomAgent(Agent):
            pass

        data = _make_data()
        agent = deserialize_agent(data, agent_class=CustomAgent)
        assert isinstance(agent, CustomAgent)

    def test_deep_copies_knowledge_base(self):
        """Mutating agent KB must not affect source dict (lines 132-133)."""
        kb = [{"id": "k1", "title": "Original", "content": "C1", "enabled": True}]
        data = _make_data(knowledge_base=kb)
        agent = deserialize_agent(data)

        agent.knowledge_base[0]["title"] = "Modified"
        assert data["knowledge_base"][0]["title"] == "Original"

    def test_deep_copies_documents(self):
        """Mutating agent documents must not affect source dict (lines 142-143)."""
        docs = {"doc1": {"id": "doc1", "content": "Original"}}
        data = _make_data(documents=docs)
        agent = deserialize_agent(data)

        agent.documents["doc1"]["content"] = "Modified"
        assert data["documents"]["doc1"]["content"] == "Original"

    def test_logs_kb_items_at_debug(self, caplog):
        """KB items are logged at DEBUG level during deserialization (lines 134-137)."""
        kb = [
            {"id": "k1", "title": "First Item", "content": "C1", "enabled": True},
            {"id": "k2", "title": "Second", "content": "C2", "enabled": False},
        ]
        data = _make_data(knowledge_base=kb)
        with caplog.at_level(logging.DEBUG, logger="socialsim4.core.agent.serialization"):
            agent = deserialize_agent(data)

        assert len(agent.knowledge_base) == 2
        assert any("k1" in r.message for r in caplog.records)

    def test_logs_document_count_at_debug(self, caplog):
        """Document count is logged at DEBUG level during deserialization (line 143)."""
        docs = {"d1": {"id": "d1", "content": "C1"}}
        data = _make_data(documents=docs)
        with caplog.at_level(logging.DEBUG, logger="socialsim4.core.agent.serialization"):
            agent = deserialize_agent(data)

        assert len(agent.documents) == 1
        assert any("documents" in r.message for r in caplog.records)

    def test_restores_error_state(self):
        """LLM error state is restored from serialized data."""
        data = _make_data(
            consecutive_llm_errors=2,
            is_offline=True,
            max_consecutive_llm_errors=5,
        )
        agent = deserialize_agent(data)
        assert agent.consecutive_llm_errors == 2
        assert agent.is_offline is True
        assert agent.max_consecutive_llm_errors == 5

    def test_no_kb_and_no_docs_does_not_error(self):
        """Deserialize works when KB and docs are absent."""
        data = _make_data()
        agent = deserialize_agent(data)
        assert agent.knowledge_base == []
        assert agent.documents == {}

    def test_serialize_deserialize_roundtrip_preserves_kb(self):
        """Full roundtrip preserves knowledge base content."""
        agent = Agent(
            name="RT",
            user_profile="profile",
            style="neutral",
            action_space=[],
            knowledge_base=[
                {"id": "k1", "title": "Fact", "content": "Data", "enabled": True}
            ],
        )
        serialized = serialize_agent(agent)
        restored = deserialize_agent(serialized)
        assert len(restored.knowledge_base) == 1
        assert restored.knowledge_base[0]["title"] == "Fact"
