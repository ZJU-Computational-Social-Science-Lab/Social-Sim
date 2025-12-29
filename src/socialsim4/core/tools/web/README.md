Web tools (search and view)

Overview
- Search client: create via `create_search_client(SearchConfig)` and call `search(query, max_results=5)`.
  - Returns: [{"title": str, "url": str, "snippet": str}]
- View page: `view_page(url, max_chars=4000)`
  - Returns: {"title": Optional[str], "text": str, "truncated": bool, "content_type": Optional[str]}

Search providers
- ddg (DuckDuckGo via duckduckgo_search)
- serpapi (Google via SerpAPI)
- serper (Google via Serper.dev)
- tavily (Tavily API)
- mock (deterministic stub)

Dependencies
- duckduckgo_search (search: ddg)
- trafilatura (content extraction)
- httpx (networking, serpapi)

Notes
- Strict behavior, no retries/fallbacks. Exceptions surface to callers.
