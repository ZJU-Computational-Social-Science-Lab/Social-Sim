"""RAG (Retrieval-Augmented Generation) actions for agent knowledge base queries."""

from socialsim4.core.action import Action


class QueryKnowledgeAction(Action):
    """Action that allows agents to query their personal knowledge base."""

    NAME = "query_knowledge"
    DESC = "Query your knowledge base for relevant information on a topic."
    INSTRUCTION = """- To query your knowledge base:
<Action name="query_knowledge"><query>[your search query]</query><max_results>3</max_results></Action>
"""

    def handle(self, action_data, agent, simulator, scene):
        query = str(action_data.get("query", "")).strip()
        max_results = int(action_data.get("max_results", 3) or 3)
        max_results = max(1, min(10, max_results))

        if not query:
            error = "query_knowledge: no query provided."
            agent.add_env_feedback(error)
            return False, {"error": error}, f"{agent.name} query_knowledge failed: no query", {}, False

        if not agent.knowledge_base:
            msg = f"Knowledge base query for '{query}': No knowledge items in your knowledge base."
            agent.add_env_feedback(msg)
            return True, {"query": query, "results": []}, f"{agent.name} queried knowledge base (empty)", {}, False

        # Query the agent's knowledge base
        results = agent.query_knowledge(query, max_results)

        if not results:
            msg = f"Knowledge base query for '{query}': No matching results found."
            agent.add_env_feedback(msg)
            return True, {"query": query, "results": []}, f"{agent.name} queried knowledge base (no matches)", {}, False

        # Format results for the agent
        lines = [f"Knowledge base results for '{query}':"]
        for i, item in enumerate(results, 1):
            title = item.get("title", "Untitled")
            content = item.get("content", "")
            lines.append(f"[{i}] {title}: {content}")

        agent.add_env_feedback("\n".join(lines))

        result = {
            "query": query,
            "results": [
                {"id": r.get("id"), "title": r.get("title"), "content": r.get("content")}
                for r in results
            ],
        }
        summary = f"{agent.name} queried knowledge base: '{query}' ({len(results)} results)"
        return True, result, summary, {}, False


class ListKnowledgeAction(Action):
    """Action that lists all items in the agent's knowledge base."""

    NAME = "list_knowledge"
    DESC = "List all items in your knowledge base."
    INSTRUCTION = """- To list all knowledge base items:
<Action name="list_knowledge" />
"""

    def handle(self, action_data, agent, simulator, scene):
        items = agent.get_enabled_knowledge()

        if not items:
            msg = "Your knowledge base is empty."
            agent.add_env_feedback(msg)
            return True, {"items": []}, f"{agent.name} listed knowledge base (empty)", {}, False

        lines = [f"Your knowledge base ({len(items)} items):"]
        for i, item in enumerate(items, 1):
            title = item.get("title", "Untitled")
            kb_type = item.get("type", "text")
            content_preview = str(item.get("content", ""))[:100]
            if len(str(item.get("content", ""))) > 100:
                content_preview += "..."
            lines.append(f"[{i}] ({kb_type}) {title}: {content_preview}")

        agent.add_env_feedback("\n".join(lines))

        result = {
            "items": [
                {"id": r.get("id"), "title": r.get("title"), "type": r.get("type")}
                for r in items
            ]
        }
        summary = f"{agent.name} listed knowledge base ({len(items)} items)"
        return True, result, summary, {}, False