import re

import httpx

from socialsim4.core.action import Action
from socialsim4.core.tools.web import view_page as tool_view_page


class WebSearchAction(Action):
    NAME = "web_search"
    DESC = "Search the web and return top results (title, URL, snippet). Use this action to find up-to-date information with a concrete query.                                                                  "
    INSTRUCTION = """- To search the web for information:
<Action name=\"web_search\"><query>[keywords or question]</query><max_results>5</max_results></Action>
"""

    def handle(self, action_data, agent, simulator, scene):
        print(f"{agent.name} Searching {action_data}")
        query = action_data["query"]
        max_results = int((action_data or {}).get("max_results", 5))
        max_results = max(1, min(10, max_results))

        search_client = simulator.clients.get("search")
        if search_client is None:
            raise ValueError("Search client not configured")
        results = search_client.search(query, max_results)

        if not results:
            error = "web_search: no results or network unavailable."
            agent.add_env_feedback(error)
            return False, {"error": error}, f"{agent.name} web_search failed", {}, False

        # Format and deliver results to the agent only (not broadcast)
        lines = [f"Web search results for '{query}':"]
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
        summary = f"{agent.name} searched: '{query}' ({len(results)} results)"
        return True, result, summary, {}, False


class ViewPageAction(Action):
    NAME = "view_page"
    DESC = "Fetch and preview the text content of a web page."
    INSTRUCTION = """- To view a web page's text content:
<Action name=\"view_page\"><url>https://example.com/article</url><max_chars>4000</max_chars></Action>
"""

    def handle(self, action_data, agent, simulator, scene):
        url = action_data["url"].strip()
        max_chars = int((action_data or {}).get("max_chars", 4000))
        max_chars = max(500, min(20000, max_chars))

        try:
            data = tool_view_page(url, max_chars)
        except httpx.HTTPError as e:
            error = f"view_page HTTP error: {e}"
            agent.add_env_feedback(error)
            return False, {"error": "http_error", "detail": str(e)}, f"{agent.name} view_page failed", {}, False
        except Exception as e:
            error = f"view_page failed: {e}"
            agent.add_env_feedback(error)
            return False, {"error": "view_error", "detail": str(e)}, f"{agent.name} view_page failed", {}, False

        title = data.get("title")
        text = data.get("text", "")
        header = f"Page content preview: {title}" if title else "Page content preview:"
        agent.add_env_feedback(f"{header}\nURL: {url}\n\n{text}")
        result = {
            "url": url,
            "title": title,
            "text": text,
            "truncated": bool(data.get("truncated")),
        }
        title_or_url = title or url
        summary = f"{agent.name} viewed page: {title_or_url}"
        return True, result, summary, {}, False
