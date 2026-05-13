import re

import httpx

from socialsim4.core.action import Action
from socialsim4.core.tools.web import view_page as tool_view_page
from socialsim4.i18n import T


class WebSearchAction(Action):
    NAME = T("prompts.actions.web_search.name", locale=None)
    DESC = T("prompts.actions.web_search.desc", locale=None)
    INSTRUCTION = T("prompts.actions.web_search.instruction", locale=None)

    def handle(self, action_data, agent, simulator, scene):
        locale = getattr(agent, 'language', None)
        print(f"{agent.name} Searching {action_data}")
        query = action_data["query"]
        max_results = int((action_data or {}).get("max_results", 5))
        max_results = max(1, min(10, max_results))

        search_client = simulator.clients.get("search")
        if search_client is None:
            raise ValueError(T("prompts.actions.web_search.error_no_client", locale=getattr(agent, 'language', None)))
        results = search_client.search(query, max_results)

        if not results:
            error = T("prompts.actions.web_search.error_no_results", locale=locale)
            agent.add_env_feedback(error)
            return False, {"error": error}, T("prompts.actions.web_search.summary_failed", locale=locale, agent_name=agent.name), {}, False

        # Format and deliver results to the agent only (not broadcast)
        lines = [T("prompts.actions.web_search.feedback_results_header", locale=locale, query=query)]
        for i, r in enumerate(results, 1):
            title = r.get("title", "").strip()
            url = r.get("url", "").strip()
            snippet = r.get("snippet", "").strip()
            if snippet:
                snippet = re.sub(r"\s+", " ", snippet)
            lines.append(f"{i}. {title} - {url}")
            if snippet:
                lines.append(f"   {snippet}")
        agent.add_env_feedback("\n".join(lines))
        result = {"query": query, "results": results}
        summary = T("prompts.actions.web_search.summary_success", locale=locale, agent_name=agent.name, query=query, count=len(results))
        return True, result, summary, {}, False


class ViewPageAction(Action):
    NAME = T("prompts.actions.view_page.name", locale=None)
    DESC = T("prompts.actions.view_page.desc", locale=None)
    INSTRUCTION = T("prompts.actions.view_page.instruction", locale=None)

    def handle(self, action_data, agent, simulator, scene):
        locale = getattr(agent, 'language', None)
        url = action_data["url"].strip()
        max_chars = int((action_data or {}).get("max_chars", 4000))
        max_chars = max(500, min(20000, max_chars))

        try:
            data = tool_view_page(url, max_chars)
        except httpx.HTTPError as e:
            error = T("prompts.actions.view_page.error_http", locale=locale, error=str(e))
            agent.add_env_feedback(error)
            return False, {"error": "http_error", "detail": str(e)}, T("prompts.actions.view_page.summary_failed", locale=locale, agent_name=agent.name), {}, False
        except Exception as e:
            error = T("prompts.actions.view_page.error_general", locale=locale, error=str(e))
            agent.add_env_feedback(error)
            return False, {"error": "view_error", "detail": str(e)}, T("prompts.actions.view_page.summary_failed", locale=locale, agent_name=agent.name), {}, False

        title = data.get("title")
        text = data.get("text", "")
        header = T("prompts.actions.view_page.feedback_header_with_title", locale=locale, title=title) if title else T("prompts.actions.view_page.feedback_header_no_title", locale=locale)
        agent.add_env_feedback(T("prompts.actions.view_page.feedback_body", locale=locale, header=header, url=url, text=text))
        result = {
            "url": url,
            "title": title,
            "text": text,
            "truncated": bool(data.get("truncated")),
        }
        title_or_url = title or url
        summary = T("prompts.actions.view_page.summary_success", locale=locale, agent_name=agent.name, title_or_url=title_or_url)
        return True, result, summary, {}, False
