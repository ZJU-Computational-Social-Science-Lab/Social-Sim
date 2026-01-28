# RAG Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix embedding consistency, add auto-injected RAG context, integrate ChromaDB hybrid storage, and enable knowledge editing UI.

**Architecture:**
- Use MiniLM for all embeddings (documents + queries)
- Auto-inject RAG context via semantic search with length-based summarization
- Hybrid vector store: ChromaDB when available, JSON fallback
- Inline editing for text-based knowledge items

**Tech Stack:** Python 3.10+, FastAPI, React, TypeScript, sentence-transformers, ChromaDB (optional)

---

## Phase 1: Embedding Consistency Fix

### Task 1: Fix Query Embedding to Use MiniLM

**Files:**
- Modify: `src/socialsim4/core/agent.py:805`

**Step 1: Read the current implementation**

Read `src/socialsim4/core/agent.py` lines 792-830 to understand `composite_rag_retrieve()`.

**Step 2: Write test for MiniLM-based query embedding**

Create: `tests/backend/test_rag_embedding_consistency.py`

```python
"""Test that query embeddings use the same model as document embeddings."""

import pytest
from socialsim4.backend.services.documents import generate_embedding, generate_embeddings_batch
from socialsim4.core.agent import Agent


def test_query_embedding_matches_document_embedding_model():
    """Query embeddings should use MiniLM, not LLM client."""
    # Generate a document embedding using MiniLM
    doc_text = "The village council meets monthly."
    doc_embedding = generate_embedding(doc_text)

    # Verify it's a list of floats with expected dimensions (MiniLM-L6-v2 = 384 dims)
    assert isinstance(doc_embedding, list)
    assert len(doc_embedding) == 384
    assert all(isinstance(x, float) for x in doc_embedding)


def test_agent_composite_rag_uses_minilm(monkeypatch):
    """Agent's composite_rag_retrieve should use MiniLM for queries."""
    # Mock the LLM client to ensure it's NOT called for embeddings
    class MockLLMClient:
        def chat(self, messages):
            return "response"

        def embedding(self, text):
            raise AssertionError("LLM embedding should NOT be called for queries")

    # Create agent with documents
    agent = Agent(
        name="TestAgent",
        user_profile="Test profile",
        style="neutral",
        action_space=[]
    )

    # Add a mock document with embedding
    mock_embedding = generate_embedding("test content")
    agent.documents = {
        "doc_1": {
            "id": "doc_1",
            "filename": "test.txt",
            "chunks": [{"chunk_id": "c000", "text": "test content"}],
            "embeddings": {"c000": mock_embedding}
        }
    }

    # This should NOT call llm_client.embedding()
    # Instead it should use MiniLM via documents service
    from socialsim4.backend.services.documents import composite_rag_retrieval

    results = composite_rag_retrieval(
        query="test",
        agent_documents=agent.documents,
        global_knowledge=None,
        top_k=5
    )

    # Should return results without error
    assert isinstance(results, list)


def test_cosine_similarity_works_with_minilm_embeddings():
    """Cosine similarity should correctly rank MiniLM embeddings."""
    from socialsim4.backend.services.documents import cosine_similarity

    # Generate embeddings for similar and dissimilar text
    similar_embedding = generate_embedding("village council meeting")
    dissimilar_embedding = generate_embedding("quantum physics equations")

    # Query similar to first
    query_embedding = generate_embedding("council gathering")

    # Similar should have higher score
    similar_score = cosine_similarity(query_embedding, similar_embedding)
    dissimilar_score = cosine_similarity(query_embedding, dissimilar_embedding)

    assert similar_score > dissimilar_score
```

**Step 3: Run test to verify it fails**

Run: `pytest tests/backend/test_rag_embedding_consistency.py -v`

Expected: PASS (documents service already uses MiniLM; this validates current behavior)

**Step 4: Update agent.py to remove LLM embedding dependency**

Modify: `src/socialsim4/core/agent.py`

Replace the `composite_rag_retrieve` method (lines 792-827):

```python
def composite_rag_retrieve(self, query: str, llm_client, top_k: int = 5) -> list:
    """
    Composite RAG retrieval merging private documents and global knowledge.
    Returns top_k results sorted by similarity.

    NOTE: llm_client parameter kept for backwards compatibility but NOT used for embeddings.
    Query embeddings use MiniLM to match document embeddings.
    """
    from socialsim4.backend.services.documents import (
        retrieve_from_global_knowledge,
        cosine_similarity,
        generate_embedding,  # Import MiniLM-based generation
    )

    all_results = []

    # Generate query embedding using MiniLM (same as documents)
    query_embedding = generate_embedding(query)

    # Retrieve from private documents
    if self.documents:
        private_results = self.retrieve_from_documents(query_embedding, top_k * 2)
        all_results.extend(private_results)

    # Retrieve from global knowledge
    if self._global_knowledge:
        global_results = retrieve_from_global_knowledge(
            query_embedding,
            self._global_knowledge,
            top_k * 2,
        )
        all_results.extend(global_results)

    # Sort by similarity, with private prioritized on tie
    all_results.sort(
        key=lambda x: (x["similarity"] + (0.001 if x["source"] == "private" else 0)),
        reverse=True
    )

    return all_results[:top_k]
```

**Step 5: Update get_rag_context similarly**

Modify: `src/socialsim4/core/agent.py:829-850`

```python
def get_rag_context(self, query: str, llm_client, top_k: int = 5) -> str:
    """
    Get formatted RAG context from documents to inject into prompts.
    Combines results from private documents and global knowledge.

    NOTE: llm_client parameter kept for backwards compatibility but NOT used.
    Query embeddings use MiniLM to match document embeddings.
    """
    # Only do embedding-based retrieval if we have documents or global knowledge
    if not self.documents and not self._global_knowledge:
        return ""

    results = self.composite_rag_retrieve(query, llm_client, top_k)

    if not results:
        return ""

    context_parts = []
    for i, result in enumerate(results, 1):
        source_label = "Personal knowledge" if result["source"] == "private" else "Shared knowledge"
        filename = result.get("filename", "")
        source_info = f" (from {filename})" if filename else ""
        context_parts.append(f"[{i}] {source_label}{source_info}:\n{result['text']}")

    return "\n\nRelevant Context:\n" + "\n\n".join(context_parts)
```

**Step 6: Run tests to verify**

Run: `pytest tests/backend/test_rag_embedding_consistency.py -v`

Expected: All tests PASS

**Step 7: Commit**

```bash
git add src/socialsim4/core/agent.py tests/backend/test_rag_embedding_consistency.py
git commit -m "fix: use MiniLM for query embeddings (consistency with documents)"
```

---

## Phase 2: Auto-Inject RAG Context

### Task 2: Add Configuration for Auto-Inject

**Files:**
- Modify: `src/socialsim4/core/config.py`
- Create: `tests/backend/test_rag_autoinject_config.py`

**Step 1: Add configuration flags**

Add to `src/socialsim4/core/config.py`:

```python
# RAG Auto-Inject Configuration
RAG_AUTO_INJECT = os.getenv("RAG_AUTO_INJECT", "true").lower() == "true"
RAG_SUMMARY_THRESHOLD = int(os.getenv("RAG_SUMMARY_THRESHOLD", "1000"))
RAG_TOP_K_DEFAULT = int(os.getenv("RAG_TOP_K_DEFAULT", "3"))
```

**Step 2: Write test for config defaults**

Create: `tests/backend/test_rag_autoinject_config.py`

```python
"""Test RAG auto-inject configuration."""

import os
import pytest
from socialsim4.core.config import RAG_AUTO_INJECT, RAG_SUMMARY_THRESHOLD, RAG_TOP_K_DEFAULT


def test_default_autoinject_enabled():
    """Auto-inject should be enabled by default."""
    assert RAG_AUTO_INJECT is True


def test_default_summary_threshold():
    """Summary threshold should default to 1000 chars."""
    assert RAG_SUMMARY_THRESHOLD == 1000


def test_default_top_k():
    """Default top-k should be 3."""
    assert RAG_TOP_K_DEFAULT == 3


def test_env_override_autoinject(monkeypatch):
    """Environment variables should override defaults."""
    monkeypatch.setenv("RAG_AUTO_INJECT", "false")
    # Re-import to pick up new env
    import importlib
    import socialsim4.core.config
    importlib.reload(socialsim4.core.config)
    assert socialsim4.core.config.RAG_AUTO_INJECT is False
```

**Step 3: Run test**

Run: `pytest tests/backend/test_rag_autoinject_config.py -v`

Expected: PASS

**Step 4: Commit**

```bash
git add src/socialsim4/core/config.py tests/backend/test_rag_autoinject_config.py
git commit -m "feat: add RAG auto-inject configuration"
```

---

### Task 3: Implement Query Generation from Memory

**Files:**
- Modify: `src/socialsim4/core/agent.py`

**Step 1: Add method to generate search query**

Add to `Agent` class in `src/socialsim4/core/agent.py` (after `get_rag_context`):

```python
def _generate_search_query_from_memory(self) -> str:
    """
    Generate a semantic search query from recent memory.
    Uses last few user messages to extract conversation context.
    """
    recent = self.short_memory.get_all()[-3:]  # Last 3 messages
    if not recent:
        return ""

    # Extract content from user role messages (these contain conversation context)
    user_msgs = [m["content"] for m in recent if m.get("role") == "user"]

    if not user_msgs:
        return ""

    # Use the most recent user message as the query
    # This captures the latest context without being too verbose
    return user_msgs[-1].strip()
```

**Step 2: Write test**

Add to `tests/backend/test_rag_autoinject_config.py`:

```python
def test_generate_search_query_from_memory():
    """Agent should generate search query from recent memory."""
    from socialsim4.core.agent import Agent

    agent = Agent(
        name="TestAgent",
        user_profile="Test profile",
        style="neutral",
        action_space=[]
    )

    # Empty memory returns empty string
    assert agent._generate_search_query_from_memory() == ""

    # Add some memory
    agent.short_memory.append("user", "What are the village rules?")
    agent.short_memory.append("assistant", "Let me check the knowledge base.")

    query = agent._generate_search_query_from_memory()
    assert "village rules" in query.lower()


def test_generate_search_query_ignores_assistant():
    """Search query should prioritize user messages."""
    from socialsim4.core.agent import Agent

    agent = Agent(
        name="TestAgent",
        user_profile="Test profile",
        style="neutral",
        action_space=[]
    )

    agent.short_memory.append("user", "query about taxes")
    agent.short_memory.append("assistant", "I will help with that.")

    # Should extract user message, not assistant
    query = agent._generate_search_query_from_memory()
    assert "taxes" in query.lower()
```

**Step 3: Run test**

Run: `pytest tests/backend/test_rag_autoinject_config.py::test_generate_search_query_from_memory -v`

Expected: PASS

**Step 4: Commit**

```bash
git add src/socialsim4/core/agent.py tests/backend/test_rag_autoinject_config.py
git commit -m "feat: add search query generation from memory"
```

---

### Task 4: Implement RAG Summarization

**Files:**
- Modify: `src/socialsim4/core/agent.py`

**Step 1: Add summarization method**

Add to `Agent` class in `src/socialsim4/core/agent.py`:

```python
def _summarize_rag_results(self, results: list[dict], llm_client) -> str:
    """
    Summarize retrieved chunks using the LLM to reduce prompt size.

    Only called when total chunk length exceeds RAG_SUMMARY_THRESHOLD.
    Falls back to truncated text if LLM call fails.
    """
    if not results:
        return ""

    # Combine chunks with metadata for context
    chunks_text = "\n\n".join([
        f"[Source: {r.get('filename', 'Unknown document')}]\n{r['text']}"
        for r in results
    ])

    summary_prompt = f"""You are a knowledge summarizer. Given the following retrieved document chunks, produce a concise summary (max 150 words) that captures the key information relevant to an agent's decision-making.

Retrieved Chunks:
{chunks_text}

Output ONLY the summary, nothing else."""

    try:
        summary = llm_client.chat([{"role": "user", "content": summary_prompt}])
        return summary.strip()
    except Exception as e:
        # Fallback: return first 300 chars of first result
        if results and results[0].get("text"):
            fallback = results[0]["text"]
            return fallback[:300] + "..." if len(fallback) > 300 else fallback
        return ""
```

**Step 2: Write test**

Add to `tests/backend/test_rag_autoinject_config.py`:

```python
def test_summarize_rag_results():
    """Agent should summarize RAG results when chunks are long."""
    from socialsim4.core.agent import Agent

    agent = Agent(
        name="TestAgent",
        user_profile="Test profile",
        style="neutral",
        action_space=[]
    )

    # Mock results with long text
    long_text = "This is a very long document. " * 50  # > 1000 chars
    results = [
        {"text": long_text, "filename": "doc1.txt", "source": "private"},
        {"text": "Another long document. " * 50, "filename": "doc2.txt", "source": "private"},
    ]

    # Mock LLM client
    class MockLLM:
        def chat(self, messages):
            return "Summary: The documents contain information about village rules."

    mock_client = MockLLM()

    summary = agent._summarize_rag_results(results, mock_client)

    # Should return summary, not raw text
    assert "Summary:" in summary
    assert len(summary) < len(long_text)


def test_summarize_rag_fallback_on_error():
    """Summarization should fallback to truncated text on LLM error."""
    from socialsim4.core.agent import Agent

    agent = Agent(
        name="TestAgent",
        user_profile="Test profile",
        style="neutral",
        action_space=[]
    )

    results = [{"text": "Short text", "filename": "doc.txt", "source": "private"}]

    # Mock LLM that raises error
    class FailingLLM:
        def chat(self, messages):
            raise Exception("LLM unavailable")

    failing_client = FailingLLM()

    summary = agent._summarize_rag_results(results, failing_client)

    # Should fallback to truncated text
    assert "Short text" in summary
```

**Step 3: Run test**

Run: `pytest tests/backend/test_rag_autoinject_config.py::test_summarize_rag_results -v`

Expected: PASS

**Step 4: Commit**

```bash
git add src/socialsim4/core/agent.py tests/backend/test_rag_autoinject_config.py
git commit -m "feat: add RAG result summarization"
```

---

### Task 5: Implement Auto-Inject in system_prompt

**Files:**
- Modify: `src/socialsim4/core/agent.py`

**Step 1: Add auto-retrieval method**

Add to `Agent` class:

```python
def _get_auto_rag_context(self, llm_client) -> str:
    """
    Auto-retrieve and inject relevant context based on recent conversation.
    Applies length-based summarization if chunks are too long.
    """
    from socialsim4.core.config import RAG_SUMMARY_THRESHOLD, RAG_TOP_K_DEFAULT
    from socialsim4.backend.services.documents import composite_rag_retrieval, format_rag_context

    # Only retrieve if we have documents or global knowledge
    if not self.documents and not self._global_knowledge:
        return ""

    # Generate search query from recent memory
    query = self._generate_search_query_from_memory()
    if not query:
        return ""

    # Retrieve relevant chunks
    results = composite_rag_retrieval(
        query=query,
        agent_documents=self.documents,
        global_knowledge=self._global_knowledge,
        top_k=RAG_TOP_K_DEFAULT
    )

    if not results:
        return ""

    # Check total length
    total_length = sum(len(r.get("text", "")) for r in results)

    # Use raw text if under threshold, otherwise summarize
    if total_length <= RAG_SUMMARY_THRESHOLD:
        return format_rag_context(results)
    else:
        return self._summarize_rag_results(results, llm_client)
```

**Step 2: Modify system_prompt to include auto-RAG**

Modify the `system_prompt` method in `src/socialsim4/core/agent.py`.

Find the knowledge_block section (around line 132) and add auto-RAG after it:

```python
def system_prompt(self, scene=None):
    # ... existing code ...

    # Build knowledge base context
    knowledge_block = ""
    enabled_kb = self.get_enabled_knowledge()
    if enabled_kb:
        # ... existing knowledge preview code ...

    # NEW: Auto-injected RAG context from documents
    auto_rag_block = ""
    if RAG_AUTO_INJECT:
        # Note: We can't call _get_auto_rag_context here directly
        # because we don't have llm_client in system_prompt scope.
        # This will be handled in process() method by modifying the context.
        pass  # Placeholder - implementation in next task

    base = f"""
# ... rest of system prompt template with {knowledge_block} ...
"""
    return base
```

**Step 3: Modify process() to inject RAG context**

Modify the `process` method in `src/socialsim4/core/agent.py` (around line 536).

Find where `system_prompt` is called and add RAG injection:

```python
def process(self, clients, initiative=False, scene=None):
    # ... existing offline check ...

    system_prompt = self.system_prompt(scene)

    # NEW: Auto-inject RAG context if enabled
    from socialsim4.core.config import RAG_AUTO_INJECT
    if RAG_AUTO_INJECT:
        llm_client = clients.get("chat")
        if llm_client:
            rag_context = self._get_auto_rag_context(llm_client)
            if rag_context:
                # Append RAG context to system prompt
                system_prompt += f"""

{rag_context}

Use the above context to inform your responses when relevant.
"""

    # Get history from memory
    ctx = self.short_memory.searilize(dialect="default")
    ctx.insert(0, {"role": "system", "content": system_prompt})
    # ... rest of method ...
```

**Step 4: Write integration test**

Add to `tests/backend/test_rag_autoinject_config.py`:

```python
def test_auto_inject_disabled_by_config(monkeypatch):
    """Auto-inject should respect config flag."""
    from socialsim4.core.agent import Agent
    from socialsim4.core.config import RAG_AUTO_INJECT

    # Temporarily disable
    import importlib
    import socialsim4.core.config
    monkeypatch.setenv("RAG_AUTO_INJECT", "false")
    importlib.reload(socialsim4.core.config)

    agent = Agent(
        name="TestAgent",
        user_profile="Test profile",
        style="neutral",
        action_space=[]
    )

    # Add documents
    from socialsim4.backend.services.documents import generate_embedding
    agent.documents = {
        "doc_1": {
            "id": "doc_1",
            "filename": "test.txt",
            "chunks": [{"chunk_id": "c000", "text": "Village rules prohibit loud noise after 10pm."}],
            "embeddings": {"c000": generate_embedding("test")}
        }
    }

    # Add memory that should trigger search
    agent.short_memory.append("user", "What are the noise rules?")

    # System prompt should not contain auto-injected context when disabled
    prompt = agent.system_prompt()
    assert "Village rules" not in prompt  # Not auto-injected

    # Reset
    monkeypatch.setenv("RAG_AUTO_INJECT", "true")
    importlib.reload(socialsim4.core.config)
```

**Step 5: Run test**

Run: `pytest tests/backend/test_rag_autoinject_config.py -v`

Expected: PASS

**Step 6: Commit**

```bash
git add src/socialsim4/core/agent.py tests/backend/test_rag_autoinject_config.py
git commit -m "feat: add auto-inject RAG context to agent process"
```

---

## Phase 3: ChromaDB Hybrid Integration

### Task 6: Add ChromaDB Dependency

**Files:**
- Modify: `requirements.txt`
- Modify: `pyproject.toml`

**Step 1: Add ChromaDB to requirements**

Add to `requirements.txt`:

```txt
chromadb>=0.4.0  # Optional hybrid vector store
```

**Step 2: Add to pyproject.toml**

Add to `pyproject.toml` dependencies:

```toml
chromadb = { version = ">=0.4.0", optional = true }
```

**Step 3: Install and verify**

Run: `pip install chromadb>=0.4.0`

Expected: Successful installation

**Step 4: Commit**

```bash
git add requirements.txt pyproject.toml
git commit -m "deps: add optional ChromaDB dependency"
```

---

### Task 7: Create Vector Store Service

**Files:**
- Create: `src/socialsim4/backend/services/vector_store.py`
- Create: `tests/backend/test_vector_store.py`

**Step 1: Create vector store module**

Create: `src/socialsim4/backend/services/vector_store.py`

```python
"""
Hybrid vector store supporting ChromaDB with JSON fallback.

When ChromaDB is available and enabled, uses it for efficient similarity search.
Otherwise, falls back to in-memory cosine similarity on JSON embeddings.
"""

import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

# Singleton instance
_vector_store_instance: Optional["VectorStore"] = None


def get_vector_store() -> Optional["VectorStore"]:
    """Get the global vector store instance, or None if not configured."""
    global _vector_store_instance
    return _vector_store_instance


def initialize_vector_store(use_chromadb: bool = False, persist_dir: str = "./chroma_db") -> Optional["VectorStore"]:
    """
    Initialize the global vector store instance.

    Call this during application startup if ChromaDB is desired.
    """
    global _vector_store_instance

    if _vector_store_instance is not None:
        return _vector_store_instance

    if use_chromadb:
        try:
            _vector_store_instance = VectorStore(use_chromadb=True, persist_dir=persist_dir)
            logger.info(f"Vector store initialized: ChromaDB at {persist_dir}")
            return _vector_store_instance
        except Exception as e:
            logger.warning(f"Failed to initialize ChromaDB: {e}. Falling back to JSON.")

    # Not using ChromaDB or initialization failed
    _vector_store_instance = VectorStore(use_chromadb=False)
    logger.info("Vector store initialized: JSON fallback mode")
    return _vector_store_instance


class VectorStore:
    """
    Hybrid vector store with ChromaDB support and JSON fallback.

    Usage:
        # Initialize at startup
        vector_store = initialize_vector_store(use_chromadb=True)

        # Store document
        vector_store.add_document("agent_1", "doc_123", chunks, embeddings)

        # Search
        results = vector_store.search("agent_1", query_embedding, top_k=5)

    If ChromaDB operations fail or return None, caller should use JSON cosine similarity.
    """

    def __init__(self, use_chromadb: bool = False, persist_dir: str = "./chroma_db"):
        self.use_chromadb = use_chromadb
        self.persist_dir = persist_dir
        self._chroma_client = None
        self._collections: Dict[str, Any] = {}

        if use_chromadb:
            self._init_chromadb()

    def _init_chromadb(self):
        """Initialize ChromaDB persistent client."""
        try:
            import chromadb
            self._chroma_client = chromadb.PersistentClient(path=self.persist_dir)
            logger.info(f"ChromaDB initialized at {self.persist_dir}")
        except ImportError:
            logger.warning("ChromaDB package not installed")
            self.use_chromadb = False
        except Exception as e:
            logger.warning(f"ChromaDB initialization failed: {e}")
            self.use_chromadb = False

    def _get_collection(self, collection_name: str):
        """Get or create a ChromaDB collection."""
        if not self._chroma_client:
            return None

        if collection_name not in self._collections:
            try:
                self._collections[collection_name] = self._chroma_client.get_or_create_collection(
                    name=collection_name,
                    metadata={"hnsw:space": "cosine"}
                )
            except Exception as e:
                logger.warning(f"Failed to get collection {collection_name}: {e}")
                return None

        return self._collections[collection_name]

    def add_document(
        self,
        agent_id: str,
        doc_id: str,
        chunks: List[dict],
        embeddings: List[List[float]]
    ) -> bool:
        """
        Store document chunks in vector store.

        Returns True if stored in ChromaDB, False for JSON fallback.
        """
        if not self.use_chromadb or not self._chroma_client:
            return False

        collection_name = f"agent_{agent_id}"
        collection = self._get_collection(collection_name)

        if not collection:
            return False

        try:
            ids = [f"{doc_id}_{c['chunk_id']}" for c in chunks]
            texts = [c['text'] for c in chunks]
            metadatas = [
                {"doc_id": doc_id, "chunk_id": c['chunk_id'], "filename": c.get("filename", "")}
                for c in chunks
            ]

            collection.add(
                ids=ids,
                embeddings=embeddings,
                documents=texts,
                metadatas=metadatas
            )
            logger.info(f"Added {len(chunks)} chunks to collection {collection_name}")
            return True

        except Exception as e:
            logger.warning(f"ChromaDB add failed for {doc_id}: {e}")
            return False

    def search(
        self,
        agent_id: str,
        query_embedding: List[float],
        top_k: int = 5,
        doc_ids: Optional[List[str]] = None
    ) -> Optional[List[dict]]:
        """
        Search for similar chunks.

        Returns results if found in ChromaDB, None for JSON fallback.

        Args:
            agent_id: Agent identifier
            query_embedding: Query vector (MiniLM embedding)
            top_k: Number of results to return
            doc_ids: Optional list of document IDs to filter by
        """
        if not self.use_chromadb or not self._chroma_client:
            return None

        collection_name = f"agent_{agent_id}"
        collection = self._get_collection(collection_name)

        if not collection:
            return None

        try:
            query_params = {
                "query_embeddings": [query_embedding],
                "n_results": top_k
            }

            # Optional document filtering
            if doc_ids:
                query_params["where"] = {"doc_id": {"$in": doc_ids}}

            results = collection.query(**query_params)

            if not results or not results["documents"]:
                return []

            # Convert to our expected format
            formatted_results = []
            for doc, dist, meta in zip(
                results["documents"][0],
                results["distances"][0],
                results["metadatas"][0]
            ):
                formatted_results.append({
                    "text": doc,
                    "similarity": 1.0 - dist,  # Chroma returns distance, convert to similarity
                    "doc_id": meta.get("doc_id"),
                    "chunk_id": meta.get("chunk_id"),
                    "filename": meta.get("filename", ""),
                    "source": "private"
                })

            return formatted_results

        except Exception as e:
            logger.warning(f"ChromaDB search failed: {e}")
            return None

    def delete_document(self, agent_id: str, doc_id: str) -> bool:
        """Delete all chunks for a document."""
        if not self.use_chromadb or not self._chroma_client:
            return False

        collection_name = f"agent_{agent_id}"
        collection = self._get_collection(collection_name)

        if not collection:
            return False

        try:
            # Delete all chunks for this document
            collection.delete(where={"doc_id": doc_id})
            logger.info(f"Deleted document {doc_id} from {collection_name}")
            return True
        except Exception as e:
            logger.warning(f"ChromaDB delete failed: {e}")
            return False

    def delete_agent(self, agent_id: str) -> bool:
        """Delete all data for an agent."""
        if not self.use_chromadb or not self._chroma_client:
            return False

        collection_name = f"agent_{agent_id}"

        try:
            self._chroma_client.delete_collection(collection_name)
            self._collections.pop(collection_name, None)
            logger.info(f"Deleted collection {collection_name}")
            return True
        except Exception as e:
            logger.warning(f"Failed to delete collection {collection_name}: {e}")
            return False
```

**Step 2: Write tests**

Create: `tests/backend/test_vector_store.py`

```python
"""Test hybrid vector store."""

import pytest
import tempfile
import shutil
from socialsim4.backend.services.vector_store import VectorStore, initialize_vector_store, get_vector_store


@pytest.fixture
def temp_chroma_dir():
    """Temporary directory for ChromaDB testing."""
    dirpath = tempfile.mkdtemp()
    yield dirpath
    shutil.rmtree(dirpath)


def test_vector_store_json_fallback(temp_chroma_dir):
    """Vector store should work in JSON fallback mode."""
    store = VectorStore(use_chromadb=False)
    assert store.use_chromadb is False

    # Should return False for add operations (use JSON instead)
    result = store.add_document("agent_1", "doc_1", [], [])
    assert result is False

    # Should return None for search (use JSON instead)
    result = store.search("agent_1", [], top_k=5)
    assert result is None


def test_vector_store_chromadb_init(temp_chroma_dir):
    """Vector store should initialize ChromaDB when requested."""
    store = VectorStore(use_chromadb=True, persist_dir=temp_chroma_dir)
    assert store.use_chromadb is True
    assert store._chroma_client is not None


def test_vector_store_add_and_search(temp_chroma_dir):
    """Vector store should add documents and search them."""
    store = VectorStore(use_chromadb=True, persist_dir=temp_chroma_dir)

    chunks = [
        {"chunk_id": "c000", "text": "Village rules prohibit noise after 10pm."},
        {"chunk_id": "c001", "text": "Parking is allowed on Main Street only."}
    ]
    embeddings = [
        [0.1] * 384,  # Mock MiniLM embedding
        [0.2] * 384
    ]

    # Add document
    result = store.add_document("agent_1", "doc_1", chunks, embeddings)
    assert result is True

    # Search with similar embedding
    query = [0.1] * 384
    results = store.search("agent_1", query, top_k=2)

    assert results is not None
    assert len(results) == 2
    assert results[0]["text"] == chunks[0]["text"]
    assert results[0]["similarity"] >= 0.9  # High similarity for identical vector


def test_vector_store_delete_document(temp_chroma_dir):
    """Vector store should delete documents."""
    store = VectorStore(use_chromadb=True, persist_dir=temp_chroma_dir)

    chunks = [{"chunk_id": "c000", "text": "Test text"}]
    embeddings = [[0.1] * 384]

    store.add_document("agent_1", "doc_1", chunks, embeddings)

    # Delete
    result = store.delete_document("agent_1", "doc_1")
    assert result is True

    # Search should return empty
    results = store.search("agent_1", [0.1] * 384)
    assert results == []


def test_global_vector_store_singleton():
    """Global vector store should be a singleton."""
    store1 = initialize_vector_store(use_chromadb=False)
    store2 = get_vector_store()

    assert store1 is store2
```

**Step 3: Run tests**

Run: `pytest tests/backend/test_vector_store.py -v`

Expected: PASS

**Step 4: Commit**

```bash
git add src/socialsim4/backend/services/vector_store.py tests/backend/test_vector_store.py
git commit -m "feat: add hybrid ChromaDB vector store service"
```

---

### Task 8: Integrate Vector Store with Agent

**Files:**
- Modify: `src/socialsim4/core/agent.py`

**Step 1: Update agent to use vector store**

Modify `retrieve_from_documents` in `src/socialsim4/core/agent.py`:

```python
def retrieve_from_documents(self, query_embedding: list, top_k: int = 5) -> list:
    """
    Retrieve relevant chunks from agent's private documents.

    Uses ChromaDB if available, otherwise falls back to JSON cosine similarity.
    Returns list of results sorted by similarity.
    """
    from socialsim4.backend.services.vector_store import get_vector_store
    from socialsim4.backend.services.documents import cosine_similarity

    # Try ChromaDB first
    vector_store = get_vector_store()
    if vector_store and vector_store.use_chromadb:
        results = vector_store.search(self.name, query_embedding, top_k)
        if results:
            return results
        # Fall through to JSON if ChromaDB returns empty

    # JSON fallback: existing cosine similarity code
    results = []
    for doc_id, doc in self.documents.items():
        embeddings = doc.get("embeddings", {})
        chunks = {c["chunk_id"]: c for c in doc.get("chunks", [])}

        for chunk_id, embedding in embeddings.items():
            similarity = cosine_similarity(query_embedding, embedding)
            chunk_data = chunks.get(chunk_id, {})

            results.append({
                "source": "private",
                "doc_id": doc_id,
                "chunk_id": chunk_id,
                "filename": doc.get("filename", ""),
                "text": chunk_data.get("text", ""),
                "similarity": similarity,
            })

    results.sort(key=lambda x: x["similarity"], reverse=True)
    return results[:top_k]
```

**Step 2: Add method to sync documents to vector store**

Add to `Agent` class:

```python
def sync_documents_to_vector_store(self) -> bool:
    """
    Sync agent's documents to ChromaDB vector store.

    Called after document upload. Returns True if sync succeeded.
    """
    from socialsim4.backend.services.vector_store import get_vector_store

    vector_store = get_vector_store()
    if not vector_store or not vector_store.use_chromadb:
        return False

    for doc_id, doc in self.documents.items():
        chunks = doc.get("chunks", [])
        embeddings = list(doc.get("embeddings", {}).values())

        if chunks and embeddings:
            vector_store.add_document(self.name, doc_id, chunks, embeddings)

    return True
```

**Step 3: Write integration test**

Add to `tests/backend/test_vector_store.py`:

```python
def test_agent_uses_vector_store(temp_chroma_dir):
    """Agent should use vector store when available."""
    from socialsim4.core.agent import Agent
    from socialsim4.backend.services.vector_store import initialize_vector_store

    # Initialize vector store
    initialize_vector_store(use_chromadb=True, persist_dir=temp_chroma_dir)

    agent = Agent(
        name="TestAgent",
        user_profile="Test profile",
        style="neutral",
        action_space=[]
    )

    # Add document with embedding
    from socialsim4.backend.services.documents import generate_embedding
    text = "Village rules prohibit loud noise."
    agent.documents = {
        "doc_1": {
            "id": "doc_1",
            "filename": "rules.txt",
            "chunks": [{"chunk_id": "c000", "text": text}],
            "embeddings": {"c000": generate_embedding(text)}
        }
    }

    # Sync to vector store
    result = agent.sync_documents_to_vector_store()
    assert result is True

    # Retrieve should use vector store
    query_emb = generate_embedding("noise rules")
    results = agent.retrieve_from_documents(query_emb, top_k=5)

    assert len(results) > 0
    assert results[0]["text"] == text
```

**Step 4: Run tests**

Run: `pytest tests/backend/test_vector_store.py -v`

Expected: PASS

**Step 5: Commit**

```bash
git add src/socialsim4/core/agent.py tests/backend/test_vector_store.py
git commit -m "feat: integrate vector store with agent document retrieval"
```

---

### Task 9: Add Vector Store to Backend Startup

**Files:**
- Modify: `src/socialsim4/backend/dependencies.py` or main app file

**Step 1: Find the backend startup file**

Check for `main.py`, `app.py`, or FastAPI initialization in `src/socialsim4/backend/`.

**Step 2: Add vector store initialization**

Add to backend startup:

```python
from socialsim4.backend.services.vector_store import initialize_vector_store

# Read from environment
USE_CHROMADB = os.getenv("USE_CHROMADB", "false").lower() == "true"
CHROMADB_DIR = os.getenv("CHROMADB_PERSIST_DIR", "./chroma_db")

# Initialize on startup
@app.on_event("startup")
async def startup_event():
    """Initialize application services."""
    if USE_CHROMADB:
        initialize_vector_store(use_chromadb=True, persist_dir=CHROMADB_DIR)
```

**Step 3: Commit**

```bash
git add src/socialsim4/backend/dependencies.py
git commit -m "feat: initialize ChromaDB vector store on backend startup"
```

---

## Phase 4: Knowledge Editing UI

### Task 10: Add Store Method for Knowledge Editing

**Files:**
- Modify: `frontend/store.ts`

**Step 1: Add updateKnowledgeInAgent to store**

Add to `AppState` interface and implementation in `frontend/store.ts`:

```typescript
// In AppState interface
updateKnowledgeInAgent: (agentId: string, itemId: string, updates: Partial<KnowledgeItem>) => void;

// In store implementation
updateKnowledgeInAgent: (agentId, itemId, updates) => {
  const agents = get().agents;
  const agent = agents.find((a) => a.id === agentId);

  if (agent) {
    const item = agent.knowledgeBase.find((k) => k.id === itemId);

    if (item) {
      // Update the item
      Object.assign(item, {
        ...updates,
        timestamp: updates.timestamp || new Date().toISOString()
      });

      // Trigger reactivity
      set({ agents: [...agents] });
    }
  }
},
```

**Step 2: Write type test**

The TypeScript compiler will verify type correctness.

**Step 3: Commit**

```bash
git add frontend/store.ts
git commit -m "feat: add updateKnowledgeInAgent store method"
```

---

### Task 11: Add Edit UI to AgentPanel

**Files:**
- Modify: `frontend/components/AgentPanel.tsx`

**Step 1: Add edit state to AgentCard**

Add state variables to `AgentCard` component (around line 21):

```tsx
const [editingItemId, setEditingItemId] = useState<string | null>(null);
const [editTitle, setEditTitle] = useState('');
const [editContent, setEditContent] = useState('');
```

**Step 2: Add edit handlers**

Add handlers after `handleDeleteDocument`:

```tsx
const handleStartEdit = (kb: KnowledgeItem) => {
  setEditingItemId(kb.id);
  setEditTitle(kb.title);
  setEditContent(kb.content);
};

const handleSaveEdit = () => {
  if (!editingItemId || !newKbTitle.trim()) return;

  updateKnowledgeInAgent(agent.id, editingItemId, {
    title: editTitle,
    content: editContent,
    timestamp: new Date().toISOString()
  });

  setEditingItemId(null);
  setEditTitle('');
  setEditContent('');
};

const handleCancelEdit = () => {
  setEditingItemId(null);
  setEditTitle('');
  setEditContent('');
};
```

**Step 3: Update knowledge base rendering**

Modify the knowledge base items rendering (around line 240-254):

```tsx
{agent.knowledgeBase.map((kb) => {
  const isEditing = editingItemId === kb.id;

  return (
    <div key={kb.id} className="bg-white border rounded p-2 text-xs relative group">
      {isEditing ? (
        // Edit mode
        <div className="space-y-2">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full p-1 border rounded text-xs outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="标题"
          />
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full p-1 border rounded text-xs h-20 resize-none outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="知识内容..."
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={handleSaveEdit}
              disabled={!editTitle.trim()}
              className="px-2 py-1 text-green-600 hover:text-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              保存
            </button>
            <button
              onClick={handleCancelEdit}
              className="px-2 py-1 text-slate-500 hover:text-slate-600"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        // View mode
        <>
          <div className="flex items-center gap-2 font-bold text-slate-700 mb-1">
            <FileText size={12} className="text-blue-500" />
            {kb.title}
          </div>
          <p className="text-slate-500 line-clamp-2">{kb.content}</p>
          <div className="flex gap-2 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => handleStartEdit(kb)}
              className="text-slate-400 hover:text-blue-500"
              title="编辑"
            >
              ✏️
            </button>
            <button
              onClick={() => removeKnowledgeFromAgent(agent.id, kb.id)}
              className="text-slate-400 hover:text-red-500"
              title="删除"
            >
              🗑️
            </button>
          </div>
        </>
      )}
    </div>
  );
})}
```

**Step 4: Get updateKnowledgeInAgent from store**

Add to the store hooks at the top of AgentCard:

```tsx
const updateKnowledgeInAgent = useSimulationStore(state => state.updateKnowledgeInAgent);
```

**Step 5: Test UI manually**

Run the frontend and verify:
1. Click edit button on knowledge item
2. Edit title/content
3. Click save - changes persist
4. Click cancel - changes discarded

**Step 6: Commit**

```bash
git add frontend/components/AgentPanel.tsx
git commit -m "feat: add inline editing for knowledge base items"
```

---

## Phase 5: Integration and Testing

### Task 12: End-to-End Integration Test

**Files:**
- Create: `tests/backend/test_rag_e2e.py`

**Step 1: Create comprehensive E2E test**

Create: `tests/backend/test_rag_e2e.py`

```python
"""End-to-end integration test for RAG improvements."""

import pytest
from socialsim4.core.agent import Agent
from socialsim4.backend.services.documents import (
    process_document,
    generate_embedding,
    composite_rag_retrieval,
    format_rag_context
)
from socialsim4.backend.services.vector_store import initialize_vector_store, get_vector_store
import tempfile
import shutil


@pytest.fixture
def chroma_dir():
    """Temporary ChromaDB directory."""
    dirpath = tempfile.mkdtemp()
    yield dirpath
    shutil.rmtree(dirpath)


def test_full_rag_pipeline_with_consistent_embeddings(chroma_dir):
    """Test full RAG pipeline with MiniLM-only embeddings."""
    # 1. Initialize vector store
    initialize_vector_store(use_chromadb=True, persist_dir=chroma_dir)

    # 2. Create agent
    agent = Agent(
        name="VillageChief",
        user_profile="Village chief responsible for rules",
        style="formal",
        action_space=[]
    )

    # 3. Upload and process a document
    doc_content = b"Village Rules:\n1. No loud noise after 10pm\n2. Parking only on Main Street\n3. Dogs must be leashed"
    document = process_document(
        file_content=doc_content,
        filename="rules.txt",
        file_size=len(doc_content)
    )

    # 4. Add to agent
    agent.documents[document["id"]] = document

    # 5. Sync to vector store
    agent.sync_documents_to_vector_store()

    # 6. Generate query embedding using MiniLM
    query = "What are the parking rules?"
    query_embedding = generate_embedding(query)

    # 7. Retrieve using vector store
    results = agent.retrieve_from_documents(query_embedding, top_k=3)

    # 8. Verify results
    assert len(results) > 0
    assert any("parking" in r["text"].lower() for r in results)

    # 9. Format context for prompt
    context = format_rag_context(results)
    assert "parking" in context.lower()


def test_auto_inject_with_summarization(chroma_dir):
    """Test auto-inject RAG with length-based summarization."""
    from socialsim4.core.config import RAG_SUMMARY_THRESHOLD

    # Initialize
    initialize_vector_store(use_chromadb=True, persist_dir=chroma_dir)

    agent = Agent(
        name="TestAgent",
        user_profile="Test",
        style="neutral",
        action_space=[]
    )

    # Add long document that will trigger summarization
    long_text = "This is a very long document. " * 100  # > 1000 chars
    doc_content = long_text.encode()
    document = process_document(doc_content, "long.txt", len(doc_content))
    agent.documents[document["id"]] = document

    # Add memory to trigger search
    agent.short_memory.append("user", "Tell me about the document content")

    # Mock LLM client for summarization
    class MockLLM:
        def chat(self, messages):
            return "Summary: The document contains repeated text about being very long."

    # Get auto RAG context
    context = agent._get_auto_rag_context(MockLLM())

    # Should be summarized (much shorter than original)
    assert len(context) < len(long_text)
    assert "Summary:" in context or len(context) < RAG_SUMMARY_THRESHOLD


def test_chromadb_fallback_to_json():
    """Test fallback to JSON when ChromaDB is not available."""
    # Don't initialize ChromaDB

    agent = Agent(
        name="TestAgent",
        user_profile="Test",
        style="neutral",
        action_space=[]
    )

    # Add document with embedding
    text = "Test content about village rules"
    agent.documents = {
        "doc_1": {
            "id": "doc_1",
            "filename": "test.txt",
            "chunks": [{"chunk_id": "c000", "text": text}],
            "embeddings": {"c000": generate_embedding(text)}
        }
    }

    # Should still work with JSON fallback
    query_emb = generate_embedding("village rules")
    results = agent.retrieve_from_documents(query_emb, top_k=5)

    assert len(results) > 0
    assert results[0]["text"] == text
```

**Step 2: Run E2E test**

Run: `pytest tests/backend/test_rag_e2e.py -v`

Expected: All tests PASS

**Step 3: Commit**

```bash
git add tests/backend/test_rag_e2e.py
git commit -m "test: add end-to-end RAG integration tests"
```

---

### Task 13: Documentation

**Files:**
- Create: `docs/rag-improvements.md`
- Modify: `AGENTS.md` (if needed)

**Step 1: Create user documentation**

Create: `docs/rag-improvements.md`

```markdown
# RAG Improvements Guide

## Overview

The RAG (Retrieval-Augmented Generation) system has been enhanced with automatic context injection, ChromaDB support, and knowledge editing.

## Features

### 1. Automatic RAG Context Injection

Agents now automatically retrieve relevant knowledge based on conversation context. No manual action required.

**Configuration:**
```bash
# Enable/disable auto-inject (default: true)
RAG_AUTO_INJECT=true

# Set summary threshold in characters (default: 1000)
RAG_SUMMARY_THRESHOLD=1000

# Set default number of chunks to retrieve (default: 3)
RAG_TOP_K_DEFAULT=3
```

### 2. ChromaDB Integration (Optional)

For better performance with large document collections, enable ChromaDB:

```bash
# Enable ChromaDB
USE_CHROMADB=true

# Set persistent storage location
CHROMADB_PERSIST_DIR=./chroma_db
```

**Installation:**
```bash
pip install chromadb>=0.4.0
```

### 3. Knowledge Editing

Click the pencil icon on any knowledge item to edit it inline.

## Architecture

- **Embeddings:** All embeddings use `all-MiniLM-L6-v2` for consistency
- **Storage:** Hybrid ChromaDB + JSON fallback
- **Retrieval:** Semantic similarity search with cosine distance
- **Summarization:** LLM-based summarization for long context

## Migration

No migration needed. All changes are backward compatible.
```

**Step 2: Update AGENTS.md**

Add to `AGENTS.md` after the Parser note section:

```markdown
## RAG (Retrieval-Augmented Generation)

Agents have two knowledge sources:
1. **Knowledge Base:** Simple text items (keyword search)
2. **Documents:** Uploaded files with embeddings (semantic search)

Auto-inject: Agents automatically retrieve relevant document context based on conversation.

Vector Store: ChromaDB hybrid storage with JSON fallback.

See `docs/rag-improvements.md` for details.
```

**Step 3: Commit**

```bash
git add docs/rag-improvements.md AGENTS.md
git commit -m "docs: add RAG improvements documentation"
```

---

### Task 14: Final Verification

**Step 1: Run all tests**

```bash
pytest tests/backend/test_rag_embedding_consistency.py -v
pytest tests/backend/test_rag_autoinject_config.py -v
pytest tests/backend/test_vector_store.py -v
pytest tests/backend/test_rag_e2e.py -v
```

Expected: All PASS

**Step 2: Type check frontend**

```bash
cd frontend
npm run type-check
# or
npx tsc --noEmit
```

Expected: No errors

**Step 3: Final commit**

```bash
git add .
git commit -m "feat: complete RAG improvements implementation

- Fix embedding consistency (MiniLM for queries)
- Add auto-inject RAG with length-based summarization
- Integrate ChromaDB hybrid vector store
- Add inline knowledge editing UI

See docs/plans/2026-01-28-rag-improvements-design.md for details."
```

---

## Summary

This plan implements 4 major improvements:

| Phase | Feature | Files | Tests |
|-------|---------|-------|-------|
| 1 | Embedding Consistency | agent.py | test_rag_embedding_consistency.py |
| 2 | Auto-Inject RAG | agent.py, config.py | test_rag_autoinject_config.py |
| 3 | ChromaDB Hybrid | vector_store.py, agent.py | test_vector_store.py |
| 4 | Knowledge Editing | AgentPanel.tsx, store.ts | Manual UI test |
| 5 | Integration | docs | test_rag_e2e.py |

**Total Tasks:** 14
**Estimated Time:** 3-4 hours

All changes are backward compatible and opt-in via environment variables.
