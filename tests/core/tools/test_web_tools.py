"""
Tests for core/tools/web/http.py and core/tools/web/view.py.

Covers http_get, strip_html_text, safe_http_https_only, view_page.
Mocks httpx and trafilatura to avoid real network calls.

Contains: TestHttpGet, TestStripHtml, TestSafeUrl, TestViewPage
"""

from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# http.py tests
# ---------------------------------------------------------------------------

class TestHttpGet:
    """http_get: success path, error propagation."""

    @patch("socialsim4.core.tools.web.http.httpx.Client")
    def test_success_returns_text_and_content_type(self, mock_client_cls):
        mock_resp = MagicMock()
        mock_resp.text = "<html>hi</html>"
        mock_resp.headers = {"content-type": "text/html"}
        mock_resp.raise_for_status = MagicMock()
        mock_client_cls.return_value.__enter__ = MagicMock(return_value=MagicMock(get=MagicMock(return_value=mock_resp)))
        mock_client_cls.return_value.__exit__ = MagicMock(return_value=False)

        # Rebuild with proper context manager
        ctx = MagicMock()
        ctx.__enter__ = MagicMock(return_value=MagicMock(get=MagicMock(return_value=mock_resp)))
        ctx.__exit__ = MagicMock(return_value=False)
        mock_client_cls.return_value = ctx

        from socialsim4.core.tools.web.http import http_get
        text, ct = http_get("https://example.com")
        assert text == "<html>hi</html>"
        assert ct == "text/html"

    @patch("socialsim4.core.tools.web.http.httpx.Client")
    def test_http_error_raises_runtime(self, mock_client_cls):
        import httpx as _hx
        mock_resp = MagicMock()
        mock_resp.raise_for_status.side_effect = _hx.HTTPStatusError(
            "404", request=MagicMock(), response=MagicMock()
        )
        ctx = MagicMock()
        ctx.__enter__ = MagicMock(return_value=MagicMock(get=MagicMock(return_value=mock_resp)))
        ctx.__exit__ = MagicMock(return_value=False)
        mock_client_cls.return_value = ctx

        from socialsim4.core.tools.web.http import http_get
        with pytest.raises(_hx.HTTPStatusError):
            http_get("https://example.com/missing")


class TestStripHtml:
    """strip_html_text removes tags, scripts, styles, and unescapes entities."""

    def test_removes_script_and_style(self):
        from socialsim4.core.tools.web.http import strip_html_text
        result = strip_html_text("<script>alert(1)</script><style>x{}</style>Hello")
        assert "alert" not in result
        assert "Hello" in result

    def test_block_elements_to_newlines(self):
        from socialsim4.core.tools.web.http import strip_html_text
        result = strip_html_text("<p>A</p><p>B</p>")
        assert "A" in result
        assert "B" in result

    def test_unescapes_entities(self):
        from socialsim4.core.tools.web.http import strip_html_text
        assert "&" in strip_html_text("a &amp; b")


class TestSafeUrl:
    """safe_http_https_only validates URL scheme."""

    def test_http_valid(self):
        from socialsim4.core.tools.web.http import safe_http_https_only
        assert safe_http_https_only("http://x.com") is True

    def test_https_valid(self):
        from socialsim4.core.tools.web.http import safe_http_https_only
        assert safe_http_https_only("https://x.com") is True

    def test_ftp_invalid(self):
        from socialsim4.core.tools.web.http import safe_http_https_only
        assert safe_http_https_only("ftp://x.com") is False

    def test_javascript_invalid(self):
        from socialsim4.core.tools.web.http import safe_http_https_only
        assert safe_http_https_only("javascript:alert(1)") is False


# ---------------------------------------------------------------------------
# view.py tests
# ---------------------------------------------------------------------------

class TestViewPage:
    """view_page: full pipeline, title extraction, truncation, invalid URL."""

    @patch("socialsim4.core.tools.web.view.trafilatura")
    @patch("socialsim4.core.tools.web.view.http_get")
    def test_extracts_text_and_title(self, mock_get, mock_traf):
        html_body = "<html><head><title>My Page</title></head><body>Hello world</body></html>"
        mock_get.return_value = (html_body, "text/html")
        mock_traf.extract.return_value = "Hello world"

        from socialsim4.core.tools.web.view import view_page
        result = view_page("https://example.com")
        assert result["title"] == "My Page"
        assert "Hello world" in result["text"]
        assert result["truncated"] is False

    def test_invalid_url_raises(self):
        from socialsim4.core.tools.web.view import view_page
        with pytest.raises(ValueError, match="only http/https"):
            view_page("ftp://bad.com")

    @patch("socialsim4.core.tools.web.view.http_get")
    def test_non_html_uses_strip(self, mock_get):
        mock_get.return_value = ("<plain>text</plain>", "text/plain")
        from socialsim4.core.tools.web.view import view_page
        result = view_page("https://example.com/file.txt")
        assert result["content_type"] == "text/plain"

    @patch("socialsim4.core.tools.web.view.trafilatura")
    @patch("socialsim4.core.tools.web.view.http_get")
    def test_truncates_long_text(self, mock_get, mock_traf):
        mock_get.return_value = ("<html><body>x</body></html>", "text/html")
        mock_traf.extract.return_value = "word " * 10000
        from socialsim4.core.tools.web.view import view_page
        result = view_page("https://example.com", max_chars=1000)
        assert result["truncated"] is True
        assert len(result["text"]) < 2000
