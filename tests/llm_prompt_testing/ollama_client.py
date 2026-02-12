"""
Ollama API client for LLM prompt testing.

Provides a wrapper around the Ollama API with retry logic, timeout handling,
and standardized request/response formats.
"""

import json
import logging
import time
from dataclasses import dataclass
from typing import Any, List, Optional

import requests

from .config import OllamaConfig

logger = logging.getLogger(__name__)


@dataclass
class ChatMessage:
    """A chat message for the Ollama API."""

    role: str  # "system", "user", "assistant"
    content: str


@dataclass
class LLMResponse:
    """Response from an LLM."""

    content: str
    model: str
    finish_reason: str | None = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    time_ms: int = 0


class OllamaError(Exception):
    """Base exception for Ollama errors."""

    pass


class OllamaConnectionError(OllamaError):
    """Exception for connection errors."""

    pass


class OllamaTimeoutError(OllamaError):
    """Exception for timeout errors."""

    pass


class OllamaClient:
    """
    Client for interacting with Ollama API.

    Supports chat completions with configurable models, retry logic,
    and error handling.
    """

    def __init__(
        self,
        base_url: str | None = None,
        timeout: int | None = None,
        max_retries: int | None = None,
    ):
        """
        Initialize the Ollama client.

        Args:
            base_url: Ollama API base URL (defaults to config)
            timeout: Request timeout in seconds (defaults to config)
            max_retries: Maximum retry attempts (defaults to config)
        """
        # Use default config values if not provided
        default_config = OllamaConfig()
        self.base_url = (base_url or default_config.base_url).rstrip("/")
        self.timeout = timeout or default_config.timeout
        self.max_retries = max_retries or default_config.max_retries
        # Create a retry_delay value (default from config)
        delay_value = 1.0  # Default if not provided
        self.retry_delay = delay_value

        # Build endpoints
        self._chat_endpoint = f"{self.base_url}/chat/completions"
        self._models_endpoint = f"{self.base_url}/models"

    def list_models(self) -> List[str]:
        """
        List available models from Ollama.

        Returns:
            List of model names available on the server.

        Raises:
            OllamaConnectionError: If connection fails
        """
        try:
            response = requests.get(self._models_endpoint, timeout=10)
            response.raise_for_status()
            data = response.json()
            return [m.get("id", m.get("name", "")) for m in data.get("data", [])]
        except requests.RequestException as e:
            raise OllamaConnectionError(f"Failed to list models: {e}")

    def chat_completion(
        self,
        messages: List[ChatMessage],
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> LLMResponse:
        """
        Send a chat completion request to Ollama.

        Args:
            messages: List of chat messages
            model: Model name (e.g., "qwen3:4b")
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate

        Returns:
            LLMResponse with the generated content

        Raises:
            OllamaConnectionError: If connection fails
            OllamaTimeoutError: If request times out
            OllamaError: For other errors
        """
        payload = {
            "model": model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        last_error = None
        for attempt in range(self.max_retries):
            try:
                start_time = time.time()
                response = requests.post(
                    self._chat_endpoint,
                    json=payload,
                    timeout=self.timeout,
                )
                elapsed_ms = int((time.time() - start_time) * 1000)

                if response.status_code == 408:
                    raise OllamaTimeoutError(f"Request timeout after {self.timeout}s")

                response.raise_for_status()
                data = response.json()

                # Parse response
                choice = data.get("choices", [{}])[0]
                message = choice.get("message", {})
                content = message.get("content", "")

                # Some models (e.g., qwen3:4b) return empty content but use "reasoning" field
                # Note: empty string "" is falsy, so check explicitly
                if content == "" or content.strip() == "":
                    content = message.get("reasoning", "")

                # Log if we had to use reasoning field
                if content and not message.get("content", ""):
                    logger.debug(f"Model {model} used 'reasoning' field instead of 'content'")

                # Try to get token counts (Ollama may not always provide)
                usage = data.get("usage", {})
                prompt_tokens = usage.get("prompt_tokens", 0)
                completion_tokens = usage.get("completion_tokens", 0)
                total_tokens = usage.get("total_tokens", prompt_tokens + completion_tokens)

                return LLMResponse(
                    content=content,
                    model=model,
                    finish_reason=choice.get("finish_reason"),
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=total_tokens,
                    time_ms=elapsed_ms,
                )

            except requests.Timeout as e:
                last_error = OllamaTimeoutError(f"Request timeout: {e}")
                logger.warning(f"Attempt {attempt + 1}/{self.max_retries}: Timeout")
            except requests.RequestException as e:
                last_error = OllamaConnectionError(f"Connection error: {e}")
                logger.warning(f"Attempt {attempt + 1}/{self.max_retries}: {e}")
            except Exception as e:
                last_error = OllamaError(f"Unexpected error: {e}")
                logger.warning(f"Attempt {attempt + 1}/{self.max_retries}: {e}")

            # Wait before retry (except on last attempt)
            if attempt < self.max_retries - 1:
                time.sleep(self.retry_delay * (2**attempt))  # Exponential backoff

        # All retries exhausted
        raise last_error or OllamaError("Max retries exhausted")

    def test_connection(self) -> bool:
        """
        Test connection to Ollama server.

        Returns:
            True if connection successful, False otherwise
        """
        try:
            models = self.list_models()
            logger.info(f"Connected to Ollama. Found {len(models)} models.")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to Ollama: {e}")
            return False


# Create default client instance
default_client = OllamaClient()
