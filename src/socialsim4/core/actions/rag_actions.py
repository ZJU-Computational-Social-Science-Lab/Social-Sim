"""RAG (Retrieval-Augmented Generation) actions for agent knowledge base queries."""

from socialsim4.core.action import Action
from socialsim4.i18n import T


class QueryKnowledgeAction(Action):
    """Action that allows agents to query their personal knowledge base."""

    NAME = T("prompts.actions.query_knowledge.name", locale=None)
    DESC = T("prompts.actions.query_knowledge.desc", locale=None)
    INSTRUCTION = T("prompts.actions.query_knowledge.instruction", locale=None)

    def handle(self, action_data, agent, simulator, scene):
        locale = getattr(agent, 'language', None)
        query = str(action_data.get("query", "")).strip()
        max_results = int(action_data.get("max_results", 3) or 3)
        max_results = max(1, min(10, max_results))

        if not query:
            error = T("prompts.actions.query_knowledge.error_no_query", locale=locale)
            agent.add_env_feedback(error)
            return False, {"error": error}, T("prompts.actions.query_knowledge.error_no_query_summary", locale=locale, agent_name=agent.name), {}, False

        if not agent.knowledge_base:
            msg = T("prompts.actions.query_knowledge.feedback_empty_kb", locale=locale, query=query)
            agent.add_env_feedback(msg)
            return True, {"query": query, "results": []}, T("prompts.actions.query_knowledge.summary_empty_kb", locale=locale, agent_name=agent.name), {}, False

        # Query the agent's knowledge base
        results = agent.query_knowledge(query, max_results)

        if not results:
            msg = T("prompts.actions.query_knowledge.feedback_no_matches", locale=locale, query=query)
            agent.add_env_feedback(msg)
            return True, {"query": query, "results": []}, T("prompts.actions.query_knowledge.summary_no_matches", locale=locale, agent_name=agent.name), {}, False

        # Format results for the agent
        lines = [T("prompts.actions.query_knowledge.feedback_results_header", locale=locale, query=query)]
        for i, item in enumerate(results, 1):
            title = item.get("title", "Untitled")
            content = item.get("content", "")
            lines.append(T("prompts.actions.query_knowledge.feedback_results_item", locale=locale, i=i, title=title, content=content))

        agent.add_env_feedback("\n".join(lines))

        result = {
            "query": query,
            "results": [
                {"id": r.get("id"), "title": r.get("title"), "content": r.get("content")}
                for r in results
            ],
        }
        summary = T("prompts.actions.query_knowledge.summary_success", locale=locale, agent_name=agent.name, query=query, count=len(results))
        return True, result, summary, {}, False


class ListKnowledgeAction(Action):
    """Action that lists all items in the agent's knowledge base."""

    NAME = T("prompts.actions.list_knowledge.name", locale=None)
    DESC = T("prompts.actions.list_knowledge.desc", locale=None)
    INSTRUCTION = T("prompts.actions.list_knowledge.instruction", locale=None)

    def handle(self, action_data, agent, simulator, scene):
        locale = getattr(agent, 'language', None)
        items = agent.get_enabled_knowledge()

        if not items:
            msg = T("prompts.actions.list_knowledge.feedback_empty", locale=locale)
            agent.add_env_feedback(msg)
            return True, {"items": []}, T("prompts.actions.list_knowledge.summary_empty", locale=locale, agent_name=agent.name), {}, False

        lines = [T("prompts.actions.list_knowledge.feedback_list_header", locale=locale, count=len(items))]
        for i, item in enumerate(items, 1):
            title = item.get("title", T("prompts.actions.list_knowledge.item_untitled", locale=locale))
            kb_type = item.get("type", "text")
            content_preview = str(item.get("content", ""))[:100]
            if len(str(item.get("content", ""))) > 100:
                content_preview += "..."
            lines.append(T("prompts.actions.list_knowledge.feedback_list_item", locale=locale, i=i, title=title, kb_type=kb_type, content_preview=content_preview))

        agent.add_env_feedback("\n".join(lines))

        result = {
            "items": [
                {"id": r.get("id"), "title": r.get("title"), "type": r.get("type")}
                for r in items
            ]
        }
        summary = T("prompts.actions.list_knowledge.summary_success", locale=locale, agent_name=agent.name, count=len(items))
        return True, result, summary, {}, False