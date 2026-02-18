"""
LLM client implementation with timeout, retry, and concurrency control.

Contains:
    - LLMClient: Main client class supporting multiple providers
    - create_llm_client: Factory function for creating LLM clients

The LLMClient provides:
- Multiple provider support (OpenAI, Gemini, Ollama, Mock)
- Concurrent request limiting per client
- Timeout control for all providers
- Automatic retry with exponential backoff
- Vision/multimodal support with SSRF prevention
- Chat, completion, and embedding APIs

Environment variables:
    LLM_TIMEOUT_S: Request timeout in seconds (default: 30)
    LLM_MAX_RETRIES: Maximum retry attempts (default: 2)
    LLM_RETRY_BACKOFF_S: Initial retry backoff in seconds (default: 1.0)
    LLM_MAX_CONCURRENT_PER_CLIENT: Max concurrent requests (default: 8)
"""

import os
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutTimeout
from copy import deepcopy
from threading import BoundedSemaphore
from typing import List, Dict, Any

from .llm_config import LLMConfig
from .validation import validate_media_url
from .providers import _MockModel, _import_openai, _import_gemini, _import_ollama


# Lazy-loaded provider modules
_openai = None
_gemini = None
_ollama = None


def _get_openai():
    """Get OpenAI provider functions (lazy loaded)."""
    global _openai
    if _openai is None:
        _openai = _import_openai()
    return _openai


def _get_gemini():
    """Get Gemini provider functions (lazy loaded)."""
    global _gemini
    if _gemini is None:
        _gemini = _import_gemini()
    return _gemini


def _get_ollama():
    """Get Ollama provider functions (lazy loaded)."""
    global _ollama
    if _ollama is None:
        _ollama = _import_ollama()
    return _ollama


class LLMClient:
    """
    LLM client with support for multiple providers and automatic retry.

    The LLMClient provides a unified interface for interacting with various
    LLM providers including OpenAI, Google Gemini, Ollama (local), and a
    mock provider for testing.

    Attributes:
        provider: LLMConfig with provider settings
        timeout_s: Request timeout in seconds
        max_retries: Maximum number of retry attempts
        retry_backoff_s: Initial backoff delay between retries
        _sem: BoundedSemaphore for concurrent request limiting
    """

    def __init__(self, provider: LLMConfig):
        """
        Initialize LLM client with provider configuration.

        Args:
            provider: LLMConfig with dialect, api_key, model, and other settings

        Raises:
            ValueError: If provider dialect is unknown
        """
        self.provider = provider

        # Timeout and retry settings (environment-driven defaults)
        self.timeout_s = float(os.getenv("LLM_TIMEOUT_S", "30"))
        self.max_retries = int(os.getenv("LLM_MAX_RETRIES", "2"))
        self.retry_backoff_s = float(os.getenv("LLM_RETRY_BACKOFF_S", "1.0"))

        # Concurrent request limiting per client
        max_concurrent = int(os.getenv("LLM_MAX_CONCURRENT_PER_CLIENT", "8"))
        if max_concurrent < 1:
            max_concurrent = 1
        self._sem = BoundedSemaphore(max_concurrent)

        # Initialize provider-specific client
        if provider.dialect == "openai":
            openai = _get_openai()
            self.client = openai["create_openai_client"](provider.api_key, provider.base_url)
        elif provider.dialect == "gemini":
            gemini = _get_gemini()
            self.client = gemini["create_gemini_client"](provider.model, provider.api_key)
        elif provider.dialect == "mock":
            self.client = _MockModel()
        elif provider.dialect == "ollama":
            ollama = _get_ollama()
            self.client = ollama["create_ollama_client"](provider.base_url, self.timeout_s)
        else:
            raise ValueError(f"Unknown LLM provider dialect: {provider.dialect}")

    def clone(self) -> "LLMClient":
        """
        Create an independent clone of this LLM client.

        For "strong isolation" mode in connection pools, creates a
        functionally equivalent but completely independent LLMClient
        instance with:
        - Deep-copied provider configuration
        - Freshly initialized underlying client (new connection)
        - Inherited timeout/retry/backoff settings
        - Independent semaphore for concurrency control

        Returns:
            New LLMClient instance
        """
        # Deep copy provider configuration
        cloned_provider = deepcopy(self.provider)

        # Create empty instance (bypass __init__)
        cloned = LLMClient.__new__(LLMClient)
        cloned.provider = cloned_provider

        # Reinitialize underlying client
        if cloned_provider.dialect == "openai":
            openai = _get_openai()
            cloned.client = openai["clone_openai_client"](cloned_provider, self.timeout_s)
        elif cloned_provider.dialect == "gemini":
            gemini = _get_gemini()
            cloned.client = gemini["clone_gemini_client"](cloned_provider)
        elif cloned_provider.dialect == "mock":
            cloned.client = _MockModel()
        elif cloned_provider.dialect == "ollama":
            ollama = _get_ollama()
            cloned.client = ollama["clone_ollama_client"](cloned_provider.base_url, self.timeout_s)
        else:
            raise ValueError(f"Unknown LLM provider dialect: {cloned_provider.dialect}")

        # Inherit configuration
        cloned.timeout_s = self.timeout_s
        cloned.max_retries = self.max_retries
        cloned.retry_backoff_s = self.retry_backoff_s

        # Independent semaphore
        max_concurrent = int(os.getenv("LLM_MAX_CONCURRENT_PER_CLIENT", "8"))
        if max_concurrent < 1:
            max_concurrent = 1
        cloned._sem = BoundedSemaphore(max_concurrent)

        return cloned

    def _with_timeout_and_retry(self, fn):
        """
        Wrap an LLM call with concurrency limiting, timeout, and retry.

        Provides:
        - Concurrent request limiting (per-client semaphore)
        - Timeout control (via thread executor for non-OpenAI providers)
        - Retry with exponential backoff

        Args:
            fn: Callable that performs the actual LLM request

        Returns:
            Result of fn() on success

        Raises:
            Exception: The last exception if all retries exhausted
        """
        last_err = None
        delay = self.retry_backoff_s

        for attempt in range(self.max_retries + 1):
            try:
                with self._sem:
                    if self.provider.dialect == "openai":
                        # OpenAI: direct call, timeout via SDK parameter
                        result = fn()
                    else:
                        # Others: use thread executor for timeout
                        with ThreadPoolExecutor(max_workers=1) as ex:
                            fut = ex.submit(fn)
                            result = fut.result(timeout=self.timeout_s)
                return result
            except (FutTimeout, Exception) as e:
                last_err = e
                if attempt < self.max_retries:
                    print(
                        f"[LLMClient] call failed (attempt {attempt + 1}/{self.max_retries + 1}): "
                        f"{repr(e)}; sleep {delay:.2f}s then retry..."
                    )
                    time.sleep(max(0.0, delay))
                    delay *= 2
                    continue
                raise last_err

    # -------------------------------------------------------------------------
    # Chat API
    # -------------------------------------------------------------------------

    def chat(self, messages: List[Dict[str, Any]], json_mode: bool = False) -> str:
        """
        Generate chat completion with vision support.

        Supports text, images, audio, and video content. Media URLs are
        validated for SSRF prevention. For providers without vision support,
        media content is converted to text placeholders.

        Args:
            messages: List of message dicts with role, content, and optional
                     images/audio/video lists
            json_mode: If True, enforce JSON output via:
                       - OpenAI/Ollama: response_format={"type": "json_object"}
                       - Gemini: generation_config={"response_mime_type": "application/json"}

        Returns:
            Generated text response

        Raises:
            ValueError: If provider dialect is unknown
        """
        supports_vision = bool(getattr(self.provider, "supports_vision", False))

        if self.provider.dialect == "openai":
            openai = _get_openai()
            def _do():
                return openai["openai_chat"](
                    client=self.client,
                    model=self.provider.model,
                    messages=messages,
                    temperature=self.provider.temperature,
                    max_tokens=self.provider.max_tokens,
                    frequency_penalty=self.provider.frequency_penalty,
                    presence_penalty=self.provider.presence_penalty,
                    timeout=self.timeout_s,
                    allow_vision=supports_vision,
                    safe_urls_func=validate_media_url,
                    json_mode=json_mode,
                )
            return self._with_timeout_and_retry(_do)

        if self.provider.dialect == "gemini":
            gemini = _get_gemini()
            def _do():
                return gemini["gemini_chat"](
                    client=self.client,
                    model=self.provider.model,
                    messages=messages,
                    temperature=self.provider.temperature,
                    max_tokens=self.provider.max_tokens,
                    top_p=self.provider.top_p,
                    frequency_penalty=self.provider.frequency_penalty,
                    presence_penalty=self.provider.presence_penalty,
                    safe_urls_func=validate_media_url,
                    allow_vision=supports_vision,
                    json_mode=json_mode,
                )
            return self._with_timeout_and_retry(_do)

        if self.provider.dialect == "mock":
            def _do():
                openai = _get_openai()
                msgs = openai["normalize_messages_for_openai"](messages, False, validate_media_url)
                return self.client.chat(msgs)
            return self._with_timeout_and_retry(_do)

        if self.provider.dialect == "ollama":
            ollama = _get_ollama()
            def _do():
                return ollama["ollama_chat"](
                    client=self.client,
                    model=self.provider.model,
                    messages=messages,
                    temperature=self.provider.temperature,
                    top_p=self.provider.top_p,
                    max_tokens=self.provider.max_tokens,
                    timeout=self.timeout_s,
                    allow_vision=supports_vision,
                    safe_urls_func=validate_media_url,
                    json_mode=json_mode,
                )
            return self._with_timeout_and_retry(_do)

        raise ValueError(f"Unknown LLM dialect: {self.provider.dialect}")

    # -------------------------------------------------------------------------
    # Completion API
    # -------------------------------------------------------------------------

    def completion(self, prompt: str) -> str:
        """
        Generate text completion from a prompt.

        Args:
            prompt: Text prompt to complete

        Returns:
            Generated text completion

        Raises:
            ValueError: If provider dialect is unknown
        """
        if self.provider.dialect == "openai":
            openai = _get_openai()
            def _do():
                return openai["openai_completion"](
                    client=self.client,
                    model=self.provider.model,
                    prompt=prompt,
                    temperature=self.provider.temperature,
                    max_tokens=self.provider.max_tokens,
                    timeout=self.timeout_s,
                )
            return self._with_timeout_and_retry(_do)

        if self.provider.dialect == "gemini":
            gemini = _get_gemini()
            def _do():
                return gemini["gemini_completion"](self.client, prompt)
            return self._with_timeout_and_retry(_do)

        if self.provider.dialect == "mock":
            return ""

        if self.provider.dialect == "ollama":
            ollama = _get_ollama()
            def _do():
                return ollama["ollama_completion"](
                    client=self.client,
                    model=self.provider.model,
                    prompt=prompt,
                    temperature=self.provider.temperature,
                    top_p=self.provider.top_p,
                    max_tokens=self.provider.max_tokens,
                    timeout=self.timeout_s,
                )
            return self._with_timeout_and_retry(_do)

        raise ValueError(f"Unknown LLM dialect: {self.provider.dialect}")

    # -------------------------------------------------------------------------
    # Embedding API
    # -------------------------------------------------------------------------

    def embedding(self, text: str) -> List[float]:
        """
        Generate text embedding vector.

        Args:
            text: Text to embed

        Returns:
            List of embedding float values

        Raises:
            ValueError: If provider dialect is unknown
        """
        if self.provider.dialect == "openai":
            openai = _get_openai()
            def _do():
                return openai["openai_embedding"](
                    client=self.client,
                    model=self.provider.model,
                    text=text,
                    timeout=self.timeout_s,
                )
            return self._with_timeout_and_retry(_do)

        if self.provider.dialect == "gemini":
            gemini = _get_gemini()
            def _do():
                return gemini["gemini_embedding"](self.provider.model, text)
            return self._with_timeout_and_retry(_do)

        if self.provider.dialect == "mock":
            return []

        if self.provider.dialect == "ollama":
            ollama = _get_ollama()
            def _do():
                return ollama["ollama_embedding"](
                    client=self.client,
                    model=self.provider.model,
                    text=text,
                    timeout=self.timeout_s,
                )
            return self._with_timeout_and_retry(_do)

        raise ValueError(f"Unknown LLM dialect: {self.provider.dialect}")


def create_llm_client(provider: LLMConfig) -> LLMClient:
    """
    Factory function to create an LLM client.

    Args:
        provider: LLMConfig with provider settings

    Returns:
        Configured LLMClient instance
    """
    return LLMClient(provider)
