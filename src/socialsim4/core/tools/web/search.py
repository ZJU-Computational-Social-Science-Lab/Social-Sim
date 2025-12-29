from __future__ import annotations

from typing import List

import httpx
from duckduckgo_search import DDGS

from socialsim4.core.search_config import SearchConfig


class SearchClient:
    def search(self, query: str, max_results: int = 5) -> List[dict]:
        raise NotImplementedError


class DDGSearchClient(SearchClient):
    def __init__(self, config: SearchConfig):
        self.config = config

    def search(self, query: str, max_results: int = 5) -> List[dict]:
        max_results = max(1, min(10, int(max_results)))
        out: List[dict] = []
        params = self.config.params or {}
        region = params.get("region")
        safesearch = params.get("safesearch")
        with DDGS() as ddgs:
            results = ddgs.text(query, max_results=max_results, region=region, safesearch=safesearch)
            for item in results:
                out.append(
                    {
                        "title": item.get("title", ""),
                        "url": item.get("href", ""),
                        "snippet": item.get("body", ""),
                    }
                )
        return out


class SerpApiSearchClient(SearchClient):
    def __init__(self, config: SearchConfig):
        self.config = config

    def search(self, query: str, max_results: int = 5) -> List[dict]:
        api_key = self.config.api_key
        if not api_key:
            raise ValueError("SERPAPI api_key required")
        base = self.config.base_url or "https://serpapi.com/search.json"
        params = {
            "engine": "google",
            "q": query,
            "num": max(1, min(10, int(max_results))),
            "api_key": api_key,
        }
        extra = self.config.params or {}
        for k, v in extra.items():
            params[k] = v
        with httpx.Client(timeout=30) as client:
            resp = client.get(base, params=params)
            data = resp.json()
        items = data.get("organic_results") or []
        out: List[dict] = []
        for item in items:
            out.append(
                {
                    "title": item.get("title", ""),
                    "url": item.get("link", ""),
                    "snippet": item.get("snippet", ""),
                }
            )
        return out

class SerperSearchClient(SearchClient):
    def __init__(self, config: SearchConfig):
        self.config = config

    def search(self, query: str, max_results: int = 5) -> List[dict]:
        api_key = self.config.api_key
        if not api_key:
            raise ValueError("SERPER api_key required")
        base = self.config.base_url or "https://google.serper.dev/search"
        payload = {
            "q": query,
            "num": max(1, min(10, int(max_results))),
        }
        headers = {"X-API-KEY": api_key, "Content-Type": "application/json"}
        with httpx.Client(timeout=30) as client:
            resp = client.post(base, json=payload, headers=headers)
            data = resp.json()
        items = data.get("organic") or []
        out: List[dict] = []
        for item in items:
            out.append(
                {
                    "title": item.get("title", ""),
                    "url": item.get("link", ""),
                    "snippet": item.get("snippet", ""),
                }
            )
        return out


class MockSearchClient(SearchClient):
    def __init__(self, config: SearchConfig):
        self.config = config

    def search(self, query: str, max_results: int = 5) -> List[dict]:
        n = max(1, min(10, int(max_results)))
        return [
            {
                "title": f"Mock result {i} for {query}",
                "url": f"https://example.com/search?q={query}&i={i}",
                "snippet": f"This is a mock search result {i} for '{query}'.",
            }
            for i in range(1, n + 1)
        ]


class TavilySearchClient(SearchClient):
    def __init__(self, config: SearchConfig):
        self.config = config

    def search(self, query: str, max_results: int = 5) -> List[dict]:
        api_key = self.config.api_key
        if not api_key:
            raise ValueError("TAVILY api_key required")
        base = self.config.base_url or "https://api.tavily.com/search"
        payload = {
            "query": query,
            "max_results": max(1, min(10, int(max_results))),
            "include_answer": False,
        }
        extra = self.config.params or {}
        # Allowlisted optional params for Tavily
        for key in [
            "search_depth",
            "include_answer",
            "topic",
            "days",
            "include_domains",
            "exclude_domains",
        ]:
            if key in extra:
                payload[key] = extra[key]
        with httpx.Client(timeout=30) as client:
            resp = client.post(base, json={"api_key": api_key, **payload})
            data = resp.json()
        items = data.get("results") or []
        out: List[dict] = []
        for item in items:
            out.append(
                {
                    "title": item.get("title", ""),
                    "url": item.get("url", ""),
                    "snippet": item.get("content", "") or item.get("snippet", ""),
                }
            )
        return out


def create_search_client(config: SearchConfig) -> SearchClient:
    name = (config.dialect or "").lower()
    if name in {"ddg", "duckduckgo"}:
        return DDGSearchClient(config)
    if name in {"serp", "serpapi"}:
        return SerpApiSearchClient(config)
    if name in {"serper"}:
        return SerperSearchClient(config)
    if name in {"tavily", "taivly", "tav"}:
        return TavilySearchClient(config)
    if name == "mock":
        return MockSearchClient(config)
    raise ValueError(f"Unsupported search provider: {config.dialect}")
