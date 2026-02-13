"""
Agent RAG (Retrieval-Augmented Generation) and knowledge base management.

This module handles the agent's knowledge base, document management,
and RAG retrieval for both private documents and global knowledge.

Contains:
    - add_knowledge: Add item to agent's knowledge base
    - remove_knowledge: Remove knowledge item by ID
    - get_enabled_knowledge: Get all enabled knowledge items
    - query_knowledge: Keyword-based search in knowledge base
    - get_knowledge_context: Format knowledge context for prompts
    - retrieve_from_documents: Vector similarity search in documents
    - composite_rag_retrieve: Merge private and global knowledge retrieval
    - get_rag_context: Format RAG results for prompt injection
    - set_global_knowledge: Set reference to global knowledge base
    - sync_documents_to_vector_store: Sync documents to ChromaDB
"""

import logging
from typing import Any


logger = logging.getLogger(__name__)


def add_knowledge(agent, item: dict) -> None:
    """
    Add a knowledge item to the agent's knowledge base.

    Args:
        agent: Agent instance
        item: Knowledge item dict with id, title, content, enabled keys
    """
    agent.knowledge_base.append(item)


def remove_knowledge(agent, item_id: str) -> bool:
    """
    Remove a knowledge item by ID.

    Args:
        agent: Agent instance
        item_id: Knowledge item ID to remove

    Returns:
        True if found and removed, False otherwise
    """
    before_len = len(agent.knowledge_base)
    agent.knowledge_base = [k for k in agent.knowledge_base if k.get("id") != item_id]
    return len(agent.knowledge_base) < before_len


def get_enabled_knowledge(agent) -> list:
    """
    Get all enabled knowledge items.

    Args:
        agent: Agent instance

    Returns:
        List of enabled knowledge items
    """
    return [k for k in agent.knowledge_base if k.get("enabled", True)]


def query_knowledge(agent, query: str, max_results: int = 3) -> list:
    """
    Simple keyword-based retrieval from the knowledge base.

    Returns top matching knowledge items based on keyword overlap
    between query and title/content.

    Args:
        agent: Agent instance
        query: Search query string
        max_results: Maximum number of results to return

    Returns:
        List of matching knowledge items sorted by relevance
    """
    if not query or not agent.knowledge_base:
        return []

    query_lower = query.lower()
    query_words = set(query_lower.split())

    scored = []
    for item in get_enabled_knowledge(agent):
        title = str(item.get("title", "")).lower()
        content = str(item.get("content", "")).lower()
        combined = f"{title} {content}"

        # Simple scoring: count matching words + boost for title matches
        combined_words = set(combined.split())
        title_words = set(title.split())

        word_matches = len(query_words & combined_words)
        title_matches = len(query_words & title_words)

        # Check for substring matches
        substring_score = 0
        for qw in query_words:
            if qw in combined:
                substring_score += 1
            if qw in title:
                substring_score += 2  # Boost title substring matches

        score = word_matches + (title_matches * 2) + substring_score

        if score > 0:
            scored.append((score, item))

    # Sort by score descending
    scored.sort(key=lambda x: x[0], reverse=True)
    return [item for score, item in scored[:max_results]]


def get_knowledge_context(agent, query: str = "", max_items: int = 5) -> str:
    """
    Get formatted knowledge context to inject into prompts.

    If query is provided, retrieves relevant items. Otherwise returns
    all enabled items.

    Args:
        agent: Agent instance
        query: Optional search query
        max_items: Maximum items to include

    Returns:
        Formatted knowledge context string
    """
    if query:
        items = query_knowledge(agent, query, max_items)
    else:
        items = get_enabled_knowledge(agent)[:max_items]

    if not items:
        return ""

    lines = ["Your Knowledge Base:"]
    for i, item in enumerate(items, 1):
        title = item.get("title", "Untitled")
        content = item.get("content", "")
        lines.append(f"[{i}] {title}: {content}")

    return "\n".join(lines)


def set_global_knowledge(agent, global_knowledge: dict) -> None:
    """
    Set reference to global knowledge base for composite retrieval.

    Args:
        agent: Agent instance
        global_knowledge: Global knowledge dict from scene_config
    """
    agent._global_knowledge = global_knowledge


def retrieve_from_documents(agent, query_embedding: list, top_k: int = 5) -> list:
    """
    Retrieve relevant chunks from agent's private documents.

    Uses ChromaDB if available, otherwise falls back to JSON cosine similarity.

    Args:
        agent: Agent instance
        query_embedding: Query vector embedding
        top_k: Maximum number of chunks to return

    Returns:
        List of results sorted by similarity, each with:
        - source: "private"
        - doc_id: Document ID
        - chunk_id: Chunk ID
        - filename: Original filename
        - text: Chunk text content
        - similarity: Cosine similarity score
    """
    from socialsim4.backend.services.vector_store import get_vector_store
    from socialsim4.backend.services.documents import cosine_similarity

    # Try ChromaDB first
    vector_store = get_vector_store()
    if vector_store and vector_store.use_chromadb:
        results = vector_store.search(agent.name, query_embedding, top_k)
        if results:
            return results

    # JSON fallback: cosine similarity
    results = []
    for doc_id, doc in agent.documents.items():
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


def composite_rag_retrieve(agent, query: str, llm_client, top_k: int = 5) -> list:
    """
    Composite RAG retrieval merging private documents and global knowledge.

    Combines results from agent's private documents and simulation
    global knowledge, sorted by similarity.

    Args:
        agent: Agent instance
        query: Search query string
        llm_client: LLM client (kept for compatibility, not used for embeddings)
        top_k: Maximum number of results to return

    Returns:
        List of results sorted by similarity
    """
    from socialsim4.backend.services.documents import (
        retrieve_from_global_knowledge,
        generate_embedding,
    )

    all_results = []

    # Generate query embedding using MiniLM
    query_embedding = generate_embedding(query)

    # Retrieve from private documents
    if agent.documents:
        private_results = retrieve_from_documents(agent, query_embedding, top_k * 2)
        all_results.extend(private_results)

    # Retrieve from global knowledge
    if agent._global_knowledge:
        global_results = retrieve_from_global_knowledge(
            query_embedding,
            agent._global_knowledge,
            top_k * 2,
        )
        all_results.extend(global_results)

    # Sort by similarity, with private prioritized on tie
    all_results.sort(
        key=lambda x: (x["similarity"] + (0.001 if x["source"] == "private" else 0)),
        reverse=True
    )

    return all_results[:top_k]


def get_rag_context(agent, query: str, llm_client, top_k: int = 5) -> str:
    """
    Get formatted RAG context from documents to inject into prompts.

    Combines results from private documents and global knowledge
    into a formatted context string.

    Args:
        agent: Agent instance
        query: Search query string
        llm_client: LLM client (kept for compatibility, not used)
        top_k: Maximum number of chunks to include

    Returns:
        Formatted context string with retrieved chunks
    """
    # Only do embedding-based retrieval if we have documents or global knowledge
    if not agent.documents and not agent._global_knowledge:
        return ""

    results = composite_rag_retrieve(agent, query, llm_client, top_k)

    if not results:
        return ""

    context_parts = []
    for i, result in enumerate(results, 1):
        source_label = "Personal knowledge" if result["source"] == "private" else "Shared knowledge"
        filename = result.get("filename", "")
        source_info = f" (from {filename})" if filename else ""
        context_parts.append(f"[{i}] {source_label}{source_info}:\n{result['text']}")

    return "\n\nRelevant Context:\n" + "\n\n".join(context_parts)


def sync_documents_to_vector_store(agent) -> bool:
    """
    Sync agent's documents to ChromaDB vector store.

    Called after document upload to make documents searchable.

    Args:
        agent: Agent instance

    Returns:
        True if sync succeeded, False otherwise
    """
    from socialsim4.backend.services.vector_store import get_vector_store

    vector_store = get_vector_store()
    if not vector_store or not vector_store.use_chromadb:
        return False

    for doc_id, doc in agent.documents.items():
        chunks = doc.get("chunks", [])
        # Convert embeddings dict values to list in order
        embeddings = [doc.get("embeddings", {}).get(c["chunk_id"]) for c in chunks]

        # Filter out chunks without embeddings
        valid_chunks = []
        valid_embeddings = []
        for chunk, emb in zip(chunks, embeddings):
            if emb is not None:
                valid_chunks.append(chunk)
                valid_embeddings.append(emb)

        if valid_chunks and valid_embeddings:
            vector_store.add_document(agent.name, doc_id, valid_chunks, valid_embeddings)

    return True


def _generate_search_query_from_memory(agent) -> str:
    """
    Generate a semantic search query from recent memory.

    Uses last few user messages to extract conversation context.

    Args:
        agent: Agent instance

    Returns:
        Query string based on recent conversation, or empty string
    """
    recent = agent.short_memory.get_all()[-3:]  # Last 3 messages
    if not recent:
        return ""

    # Extract content from user role messages
    user_msgs = [m["content"] for m in recent if m.get("role") == "user"]

    if not user_msgs:
        return ""

    # Use the most recent user message as the query
    return user_msgs[-1].strip()


def _summarize_rag_results(agent, results: list, llm_client) -> str:
    """
    Summarize retrieved chunks using the LLM to reduce prompt size.

    Only called when total chunk length exceeds threshold.
    Falls back to truncated text if LLM call fails.

    Args:
        agent: Agent instance
        results: List of retrieved chunks
        llm_client: LLM client for summarization

    Returns:
        Summary string or fallback truncated text
    """
    from socialsim4.core.config import RAG_SUMMARY_THRESHOLD

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
        logger.exception(f"Failed to summarize RAG results: {e}")
        # Fallback: return first 300 chars of first result
        if results and results[0].get("text"):
            fallback = results[0]["text"]
            return fallback[:300] + "..." if len(fallback) > 300 else fallback
        return ""


def _get_auto_rag_context(agent, llm_client) -> str:
    """
    Auto-retrieve and inject relevant context based on recent conversation.

    Applies length-based summarization if chunks are too long.

    Args:
        agent: Agent instance
        llm_client: LLM client for embeddings and summarization

    Returns:
        Formatted context string or empty string
    """
    from socialsim4.core.config import RAG_SUMMARY_THRESHOLD, RAG_TOP_K_DEFAULT
    from socialsim4.backend.services.documents import composite_rag_retrieval, format_rag_context

    # Only retrieve if we have documents or global knowledge
    if not agent.documents and not agent._global_knowledge:
        return ""

    # Generate search query from recent memory
    query = _generate_search_query_from_memory(agent)
    if not query:
        return ""

    # Retrieve relevant chunks
    results = composite_rag_retrieval(
        query=query,
        agent_documents=agent.documents,
        global_knowledge=agent._global_knowledge,
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
        return _summarize_rag_results(agent, results, llm_client)
