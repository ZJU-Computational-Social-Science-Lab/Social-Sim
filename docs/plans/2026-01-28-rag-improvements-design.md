# RAG Improvements Design Document

**Date:** 2026-01-28
**Status:** Approved
**Related PR:** RAG capability feature review feedback

## Overview

This document outlines improvements to the RAG (Retrieval-Augmented Generation) capability based on code review feedback. The design maintains backward compatibility while addressing embedding consistency, automatic context injection, vector database integration, and knowledge editing.

## Problem Statement

The current RAG implementation has four key issues:

1. **Embedding Inconsistency:** Documents use MiniLM embeddings but queries use LLM embeddings, creating mismatched vector spaces
2. **Manual RAG Only:** Agents must explicitly call actions to retrieve knowledge; no automatic injection
3. **JSON Storage:** Embeddings stored in JSON don't scale efficiently
4. **No Editing UI:** Knowledge items can be added/deleted but not edited

## Design Decisions

### 1. Embedding Consistency (Use MiniLM Everywhere)

**Decision:** Use `all-MiniLM-L6-v2` for both document and query embeddings.

**Rationale:** Single vector space ensures accurate similarity search. The sentence-transformers model is already loaded for documents.

**Implementation:**
- File: `src/socialsim4/core/agent.py`
- Change: Line 805 in `composite_rag_retrieve()`
- Replace `query_embedding = llm_client.embedding(query)` with MiniLM-based generation

### 2. Auto-Inject RAG Context

**Decision:** Automatically retrieve and inject relevant context based on semantic search of recent conversation.

**Rationale:** Reduces friction for agents; they don't need to remember to query knowledge.

**Implementation:**
- Add `_generate_search_query_from_memory()` to extract topics from recent messages
- Add `_get_auto_rag_context()` to retrieve relevant chunks
- Add `_summarize_rag_results()` for length-based summarization (>1000 chars)
- Modify `system_prompt()` to include RAG context

**Trigger:** Semantic search generated from last 3 messages in short-term memory.

### 3. Hybrid ChromaDB Integration

**Decision:** Add ChromaDB as optional vector store with JSON fallback.

**Rationale:** Non-breaking, gradual rollout, local dev simplicity.

**Implementation:**
- New file: `src/socialsim4/backend/services/vector_store.py`
- Config flag: `USE_CHROMADB` environment variable
- Agent methods use vector store when available, fall back to cosine similarity
- One collection per agent (privacy) + global knowledge collection

**Storage Model:**
- Agent documents: Separate collections per agent for isolation
- Global knowledge: Single shared collection
- Metadata: `doc_id`, `chunk_id`, `source_type`

### 4. Knowledge Editing UI

**Decision:** Add inline editing for text-based knowledge items.

**Rationale:** Improves usability; users can correct mistakes without recreating items.

**Implementation:**
- Component: `AgentPanel.tsx`
- Add edit mode state and handlers
- Store method: `updateKnowledgeInAgent()`
- UI: Edit button next to delete, inline input fields

**Limitation:** Document uploads (PDF, DOCX) require re-upload; cannot edit extracted text.

## Architecture Changes

```
┌─────────────────────────────────────────────────────────────────┐
│                         Agent                                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────────────────────────────┐  │
│  │ Knowledge    │    │         Documents (JSON)              │  │
│  │ Base         │    │         ┌─────────────┐               │  │
│  │ (editable)   │    │         │   Embeds    │               │  │
│  └──────────────┘    │         └──────┬──────┘               │  │
│                      │                │                       │  │
│                      │         ┌──────▼──────┐                │  │
│                      │         │  VectorStore │◄──── Hybrid   │  │
│                      │         │  (ChromaDB) │     Layer      │  │
│                      │         └──────┬──────┘                │  │
│                      └────────────────┘                       │  │
├─────────────────────────────────────────────────────────────────┤
│  system_prompt()                                                 │
│    ├── _get_auto_rag_context()  ──► semantic search           │
│    │   ├── _generate_search_query_from_memory()               │
│    │   ├── composite_rag_retrieval()  ──► MiniLM query embed │
│    │   └── _summarize_rag_results()  (if >1000 chars)         │
│    └── Injected into prompt                                     │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Auto-Injected RAG Context

```
Agent.process() called
    │
    ▼
system_prompt(scene) generated
    │
    ▼
_generate_search_query_from_memory()
    │ (extract from last 3 messages)
    ▼
composite_rag_retrieval(query)
    │
    ├──► generate_embedding(query)  [MiniLM]
    │
    ├──► VectorStore.search()  [ChromaDB if enabled]
    │     │
    │     └──► OR cosine_similarity()  [JSON fallback]
    │
    └──► Results returned
         │
         ▼
    If total_length > 1000 chars:
         │
         ├──► _summarize_rag_results()  [LLM call]
         │
         └──► Summary injected
    Else:
         └──► Raw context injected
```

## Configuration

```python
# core/config.py
USE_CHROMADB = os.getenv("USE_CHROMADB", "false").lower() == "true"
CHROMADB_PERSIST_DIR = os.getenv("CHROMADB_PERSIST_DIR", "./chroma_db")
RAG_SUMMARY_THRESHOLD = int(os.getenv("RAG_SUMMARY_THRESHOLD", "1000"))
RAG_AUTO_INJECT = os.getenv("RAG_AUTO_INJECT", "true").lower() == "true"
```

## Dependencies

```toml
# Added to requirements.txt and pyproject.toml
chromadb >= 0.4.0  # Optional, for hybrid vector store
```

## Migration Path

1. **Phase 1:** Embedding consistency fix (breaking query behavior)
2. **Phase 2:** Auto-inject with summarization (non-breaking, opt-out)
3. **Phase 3:** ChromaDB hybrid (non-breaking, opt-in)
4. **Phase 4:** Knowledge editing UI (frontend only)

## Testing Considerations

- Verify retrieval quality with consistent embeddings
- Measure prompt size impact with auto-injection
- Benchmark ChromaDB vs JSON performance
- Test knowledge editing persistence across turns

## Future Work (Out of Scope)

- External knowledge sources (RSS, Wiki, news)
- Retrieval intensity adjustment (high/medium/low)
- Blacklist filtering for specific topics
- Performance optimization for bulk imports
