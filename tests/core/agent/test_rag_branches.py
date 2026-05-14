"""
Tests for uncovered branches in core/agent/rag.py.

Targets: all public functions (add_knowledge, remove_knowledge,
get_enabled_knowledge, query_knowledge, get_knowledge_context,
set_global_knowledge, retrieve_from_documents, composite_rag_retrieve,
get_rag_context, sync_documents_to_vector_store) and private helpers
(_generate_search_query_from_memory, _summarize_rag_results,
_get_auto_rag_context).

Contains: TestKnowledgeBase, TestQueryKnowledge, TestKnowledgeContext,
TestRetrieveFromDocuments, TestCompositeRAG, TestGetRAGContext,
TestSyncDocuments, TestSearchQueryFromMemory, TestSummarizeRAG,
TestAutoRAGContext
"""

import pytest
from unittest.mock import MagicMock, patch, PropertyMock

from socialsim4.core.agent.rag import (
    add_knowledge,
    remove_knowledge,
    get_enabled_knowledge,
    query_knowledge,
    get_knowledge_context,
    set_global_knowledge,
    retrieve_from_documents,
    composite_rag_retrieve,
    get_rag_context,
    sync_documents_to_vector_store,
    _generate_search_query_from_memory,
    _summarize_rag_results,
    _get_auto_rag_context,
)


def _agent(**overrides):
    """Create a minimal mock agent for RAG testing."""
    a = MagicMock()
    a.knowledge_base = []
    a.documents = {}
    a._global_knowledge = {}
    a.short_memory = MagicMock()
    for k, v in overrides.items():
        setattr(a, k, v)
    return a


class TestKnowledgeBase:
    """add_knowledge, remove_knowledge, get_enabled_knowledge."""

    def test_add_knowledge_appends(self):
        a = _agent()
        add_knowledge(a, {"id": "k1", "title": "T", "content": "C", "enabled": True})
        assert len(a.knowledge_base) == 1
        assert a.knowledge_base[0]["id"] == "k1"

    def test_remove_knowledge_found(self):
        a = _agent(knowledge_base=[
            {"id": "k1", "title": "A"}, {"id": "k2", "title": "B"},
        ])
        assert remove_knowledge(a, "k1") is True
        assert len(a.knowledge_base) == 1
        assert a.knowledge_base[0]["id"] == "k2"

    def test_remove_knowledge_not_found(self):
        a = _agent(knowledge_base=[{"id": "k1"}])
        assert remove_knowledge(a, "missing") is False

    def test_get_enabled_knowledge_filters_disabled(self):
        a = _agent(knowledge_base=[
            {"id": "1", "enabled": True}, {"id": "2", "enabled": False},
            {"id": "3"},  # default enabled
        ])
        enabled = get_enabled_knowledge(a)
        assert len(enabled) == 2
        ids = [e["id"] for e in enabled]
        assert "1" in ids and "3" in ids


class TestQueryKnowledge:
    """query_knowledge: keyword scoring, empty early returns."""

    def test_empty_query_returns_empty(self):
        a = _agent(knowledge_base=[{"id": "1", "title": "test", "content": "x", "enabled": True}])
        assert query_knowledge(a, "") == []

    def test_empty_kb_returns_empty(self):
        a = _agent()
        assert query_knowledge(a, "search") == []

    def test_keyword_match_returns_scored(self):
        a = _agent(knowledge_base=[
            {"id": "1", "title": "climate change", "content": "global warming data", "enabled": True},
            {"id": "2", "title": "unrelated", "content": "completely different topic", "enabled": True},
        ])
        results = query_knowledge(a, "climate warming")
        assert len(results) == 1
        assert results[0]["id"] == "1"

    def test_max_results_limits_output(self):
        a = _agent(knowledge_base=[
            {"id": str(i), "title": f"topic {i}", "content": f"content {i}", "enabled": True}
            for i in range(10)
        ])
        results = query_knowledge(a, "topic", max_results=3)
        assert len(results) == 3


class TestKnowledgeContext:
    """get_knowledge_context: with/without query, empty returns."""

    def test_with_query(self):
        a = _agent(knowledge_base=[
            {"id": "1", "title": "Rules", "content": "Follow them", "enabled": True},
        ])
        ctx = get_knowledge_context(a, query="Rules")
        assert "Your Knowledge Base:" in ctx
        assert "Rules" in ctx

    def test_without_query_returns_all_enabled(self):
        a = _agent(knowledge_base=[
            {"id": str(i), "title": f"T{i}", "content": f"C{i}", "enabled": True}
            for i in range(7)
        ])
        ctx = get_knowledge_context(a, max_items=5)
        assert "T0" in ctx
        assert "T6" not in ctx  # limited to 5

    def test_empty_kb_returns_empty_string(self):
        a = _agent()
        assert get_knowledge_context(a) == ""


class TestRetrieveFromDocuments:
    """retrieve_from_documents: ChromaDB path vs JSON fallback."""

    @patch("socialsim4.backend.services.documents.cosine_similarity", return_value=0.9)
    @patch("socialsim4.backend.services.vector_store.get_vector_store", return_value=None)
    def test_json_fallback_with_no_vector_store(self, mock_vs, mock_cos):
        a = _agent()
        a.documents = {
            "doc1": {
                "filename": "test.txt",
                "chunks": [{"chunk_id": "c1", "text": "hello world"}],
                "embeddings": {"c1": [0.1, 0.2]},
            }
        }
        results = retrieve_from_documents(a, [0.1, 0.2], top_k=5)
        assert len(results) == 1
        assert results[0]["source"] == "private"
        assert results[0]["filename"] == "test.txt"

    @patch("socialsim4.backend.services.vector_store.get_vector_store")
    def test_chromadb_path_returns_results(self, mock_get_vs):
        mock_vs = MagicMock()
        mock_vs.use_chromadb = True
        mock_vs.search.return_value = [{"source": "private", "text": "found", "similarity": 0.95}]
        mock_get_vs.return_value = mock_vs

        a = _agent()
        results = retrieve_from_documents(a, [0.1], top_k=5)
        assert len(results) == 1
        assert results[0]["text"] == "found"


class TestGetRAGContext:
    """get_rag_context: early returns and formatted output."""

    def test_no_documents_no_global_returns_empty(self):
        a = _agent()
        assert get_rag_context(a, "query", None) == ""

    @patch("socialsim4.core.agent.rag.composite_rag_retrieve", return_value=[], create=True)
    def test_no_results_returns_empty(self, mock_retrieve):
        a = _agent(documents={"d": {}})
        assert get_rag_context(a, "query", None) == ""

    @patch("socialsim4.core.agent.rag.composite_rag_retrieve", create=True)
    def test_results_formatted_correctly(self, mock_retrieve):
        mock_retrieve.return_value = [
            {"source": "private", "text": "private content", "filename": "doc.txt", "similarity": 0.9},
            {"source": "global", "text": "global content", "filename": "", "similarity": 0.8},
        ]
        a = _agent(documents={"d": {}})
        ctx = get_rag_context(a, "query", None)
        assert "Personal knowledge (from doc.txt)" in ctx
        assert "Shared knowledge" in ctx
        assert "private content" in ctx


class TestSyncDocuments:
    """sync_documents_to_vector_store: ChromaDB vs no-store paths."""

    @patch("socialsim4.backend.services.vector_store.get_vector_store", return_value=None)
    def test_no_vector_store_returns_false(self, mock_vs):
        a = _agent()
        assert sync_documents_to_vector_store(a) is False

    @patch("socialsim4.backend.services.vector_store.get_vector_store")
    def test_non_chromadb_returns_false(self, mock_get_vs):
        mock_vs = MagicMock()
        mock_vs.use_chromadb = False
        mock_get_vs.return_value = mock_vs
        a = _agent()
        assert sync_documents_to_vector_store(a) is False

    @patch("socialsim4.backend.services.vector_store.get_vector_store")
    def test_sync_adds_valid_chunks(self, mock_get_vs):
        mock_vs = MagicMock()
        mock_vs.use_chromadb = True
        mock_get_vs.return_value = mock_vs

        a = _agent()
        a.documents = {
            "doc1": {
                "chunks": [
                    {"chunk_id": "c1", "text": "hello"},
                    {"chunk_id": "c2", "text": "world"},
                ],
                "embeddings": {"c1": [0.1], "c2": None},  # c2 has no embedding
            }
        }
        result = sync_documents_to_vector_store(a)
        assert result is True
        mock_vs.add_document.assert_called_once()
        call_args = mock_vs.add_document.call_args
        # Only c1 should be added (c2 has None embedding)
        assert len(call_args[0][2]) == 1  # valid_chunks


class TestSearchQueryFromMemory:
    """_generate_search_query_from_memory: various memory states."""

    def test_no_memory_returns_empty(self):
        a = _agent()
        a.short_memory.get_all.return_value = []
        assert _generate_search_query_from_memory(a) == ""

    def test_no_user_messages_returns_empty(self):
        a = _agent()
        a.short_memory.get_all.return_value = [{"role": "assistant", "content": "hi"}]
        assert _generate_search_query_from_memory(a) == ""

    def test_extracts_last_user_message(self):
        a = _agent()
        a.short_memory.get_all.return_value = [
            {"role": "user", "content": "first question"},
            {"role": "assistant", "content": "answer"},
            {"role": "user", "content": "second question"},
        ]
        assert _generate_search_query_from_memory(a) == "second question"


class TestSummarizeRAG:
    """_summarize_rag_results: LLM success, LLM failure, empty results."""

    def test_empty_results_returns_empty(self):
        a = _agent()
        assert _summarize_rag_results(a, [], None) == ""

    def test_llm_success_returns_summary(self):
        a = _agent()
        mock_client = MagicMock()
        mock_client.chat.return_value = "  Concise summary of results.  "
        results = [{"text": "long text", "filename": "doc.txt"}]
        assert _summarize_rag_results(a, results, mock_client) == "Concise summary of results."

    def test_llm_failure_falls_back_to_truncation(self):
        a = _agent()
        mock_client = MagicMock()
        mock_client.chat.side_effect = RuntimeError("LLM down")
        long_text = "x" * 500
        results = [{"text": long_text, "filename": "doc.txt"}]
        result = _summarize_rag_results(a, results, mock_client)
        assert result.startswith("x" * 300)
        assert result.endswith("...")

    def test_llm_failure_short_text_no_truncation(self):
        a = _agent()
        mock_client = MagicMock()
        mock_client.chat.side_effect = RuntimeError("LLM down")
        results = [{"text": "short", "filename": "doc.txt"}]
        assert _summarize_rag_results(a, results, mock_client) == "short"


class TestAutoRAGContext:
    """_get_auto_rag_context: full pipeline with early returns."""

    @patch("socialsim4.core.agent.rag._generate_search_query_from_memory", return_value="")
    def test_empty_query_returns_empty(self, mock_query):
        a = _agent(documents={"d": {}})
        assert _get_auto_rag_context(a, None) == ""

    @patch("socialsim4.core.config.RAG_SUMMARY_THRESHOLD", 1000)
    @patch("socialsim4.backend.services.documents.format_rag_context", return_value="formatted")
    @patch("socialsim4.backend.services.documents.composite_rag_retrieval")
    @patch("socialsim4.core.agent.rag._generate_search_query_from_memory", return_value="test query")
    def test_short_results_use_raw_text(self, mock_query, mock_retrieve, mock_format):
        mock_retrieve.return_value = [{"text": "short", "similarity": 0.9}]
        a = _agent(documents={"d": {}})
        assert _get_auto_rag_context(a, None) == "formatted"

    @patch("socialsim4.core.config.RAG_SUMMARY_THRESHOLD", 1)
    @patch("socialsim4.core.agent.rag._summarize_rag_results", return_value="summary")
    @patch("socialsim4.backend.services.documents.composite_rag_retrieval")
    @patch("socialsim4.core.agent.rag._generate_search_query_from_memory", return_value="test query")
    def test_long_results_trigger_summarization(self, mock_query, mock_retrieve, mock_summarize):
        mock_retrieve.return_value = [{"text": "x" * 500, "similarity": 0.9}]
        a = _agent(documents={"d": {}})
        assert _get_auto_rag_context(a, None) == "summary"
