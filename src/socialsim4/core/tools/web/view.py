import re
import trafilatura

from .http import http_get, safe_http_https_only, strip_html_text


def view_page(url: str, max_chars: int = 4000):
    """Fetch and return a text preview of a web page.

    Returns dict: {title: str|None, text: str, truncated: bool, content_type: str|None}
    Raises: Exception on invalid URL or network errors
    """
    if not safe_http_https_only(url):
        raise ValueError("only http/https URLs are allowed")

    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; SocialSim/1.0)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    body, content_type = http_get(url, headers=headers, timeout=15)

    # Extract HTML with trafilatura (simple prototype); fallback to naive strip
    text = body
    title = None
    if content_type and "text/html" in content_type:
        extracted = trafilatura.extract(
            body, include_comments=False, include_tables=False
        )
        if extracted:
            text = extracted

        if text == body or not text:
            text = strip_html_text(body)

        # Try to extract title from raw HTML regardless
        m = re.search(r"<title[^>]*>([\s\S]*?)</title>", body, flags=re.IGNORECASE)
        if m:
            title = strip_html_text(m.group(1))

    max_chars = max(500, min(20000, int(max_chars)))
    truncated = len(text) > max_chars
    preview = text[:max_chars] + ("\n...[truncated]" if truncated else "")

    return {
        "title": title,
        "text": preview,
        "truncated": truncated,
        "content_type": content_type,
    }
