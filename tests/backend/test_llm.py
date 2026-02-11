"""
Comprehensive tests for LLM module functionality.

Tests for:
- URL validation and SSRF prevention
- LLM client initialization for all providers
- Chat API with vision support
- Completion API
- Embedding API
- Retry and timeout behavior
- Mock model scene detection
- Archetype generation functions
"""

import os
import json
import random
from unittest.mock import Mock, MagicMock, patch
from concurrent.futures import TimeoutError as FutTimeout

import pytest
import httpx

# Check for optional dependencies
try:
    import google.genai
    HAS_GEMINI = True
except ImportError:
    HAS_GEMINI = False

try:
    import openai
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False

from socialsim4.core.llm import (
    validate_media_url,
    _is_private_network_url,
    LLMClient,
    create_llm_client,
    _MockModel,
    action_to_xml,
    generate_archetypes_from_demographics,
    add_gaussian_noise,
    generate_archetype_template,
    generate_agents_with_archetypes,
)
from socialsim4.core.llm_config import LLMConfig


# =============================================================================
# URL Validation Tests (SSRF Prevention)
# =============================================================================

class TestURLValidation:
    """Tests for URL validation and SSRF prevention."""

    def test_validate_media_url_valid_http(self):
        """Test validation of valid HTTP URL."""
        result = validate_media_url("http://example.com/image.jpg")
        assert result == "valid"

    def test_validate_media_url_valid_https(self):
        """Test validation of valid HTTPS URL."""
        result = validate_media_url("https://example.com/image.jpg")
        assert result == "valid"

    def test_validate_media_url_valid_data(self):
        """Test validation of data URL (embedded content)."""
        result = validate_media_url("data:image/png;base64,iVBORw0KG...")
        assert result == "valid"

    def test_validate_media_url_invalid_scheme(self):
        """Test rejection of URL with disallowed scheme (file://)."""
        result = validate_media_url("file:///etc/passwd")
        assert result == "invalid_scheme"

    def test_validate_media_url_invalid_scheme_ftp(self):
        """Test rejection of FTP URL."""
        result = validate_media_url("ftp://example.com/file")
        assert result == "invalid_scheme"

    def test_validate_media_url_private_network_127(self):
        """Test rejection of 127.0.0.0/8 loopback addresses."""
        result = validate_media_url("http://127.0.0.1:8080/image.jpg")
        assert result == "private_network"

    def test_validate_media_url_private_network_10(self):
        """Test rejection of 10.0.0.0/8 private network addresses."""
        result = validate_media_url("http://10.0.0.1/image.jpg")
        assert result == "private_network"

    def test_validate_media_url_private_network_172(self):
        """Test rejection of 172.16.0.0/12 private network addresses."""
        result = validate_media_url("http://172.16.0.1/image.jpg")
        assert result == "private_network"

    def test_validate_media_url_private_network_192(self):
        """Test rejection of 192.168.0.0/16 private network addresses."""
        result = validate_media_url("http://192.168.1.1/image.jpg")
        assert result == "private_network"

    def test_validate_media_url_localhost(self):
        """Test rejection of localhost hostname."""
        result = validate_media_url("http://localhost:8080/image.jpg")
        assert result == "private_network"

    def test_validate_media_url_169_254_metadata(self):
        """Test rejection of cloud metadata address 169.254.169.254."""
        result = validate_media_url("http://169.254.169.254/latest/meta-data/")
        assert result == "private_network"

    def test_validate_media_url_link_local_ipv6(self):
        """Test rejection of IPv6 link-local addresses."""
        result = validate_media_url("http://[fe80::1]/image.jpg")
        assert result == "private_network"

    def test_validate_media_url_ipv6_localhost(self):
        """Test rejection of IPv6 localhost ::1."""
        result = validate_media_url("http://[::1]/image.jpg")
        assert result == "private_network"

    def test_validate_media_url_non_string(self):
        """Test validation of non-string input returns invalid_scheme."""
        result = validate_media_url(12345)
        assert result == "invalid_scheme"

    def test_validate_media_url_none(self):
        """Test validation of None input returns invalid_scheme."""
        result = validate_media_url(None)
        assert result == "invalid_scheme"

    def test_validate_media_url_empty_string(self):
        """Test validation of empty string returns invalid_scheme."""
        result = validate_media_url("")
        assert result == "invalid_scheme"

    def test_is_private_network_url_data_url(self):
        """Test data URLs are not considered private network."""
        result = _is_private_network_url("data:image/png;base64,abc123")
        assert result is False


# =============================================================================
# LLM Client Initialization Tests
# =============================================================================

class TestLLMClientInit:
    """Tests for LLM client initialization."""

    def test_openai_client_init(self):
        """Test OpenAI client initialization."""
        config = LLMConfig(
            dialect="openai",
            api_key="test-key",
            model="gpt-4",
            base_url="https://api.openai.com/v1"
        )
        client = LLMClient(config)
        assert client.provider.dialect == "openai"
        assert client.provider.api_key == "test-key"
        assert client._sem is not None

    @pytest.mark.skipif(not HAS_GEMINI, reason="google.genai not installed")
    def test_gemini_client_init(self):
        """Test Gemini client initialization."""
        config = LLMConfig(
            dialect="gemini",
            api_key="test-key",
            model="gemini-pro"
        )
        client = LLMClient(config)
        assert client.provider.dialect == "gemini"
        assert client.provider.api_key == "test-key"

    def test_ollama_client_init(self):
        """Test Ollama client initialization."""
        config = LLMConfig(
            dialect="ollama",
            model="llama2"
        )
        client = LLMClient(config)
        assert client.provider.dialect == "ollama"
        assert isinstance(client.client, httpx.Client)

    def test_ollama_client_init_with_base_url(self):
        """Test Ollama client with custom base URL."""
        config = LLMConfig(
            dialect="ollama",
            model="llama2",
            base_url="http://localhost:11434"
        )
        client = LLMClient(config)
        assert client.provider.dialect == "ollama"
        assert client.provider.base_url == "http://localhost:11434"

    def test_mock_client_init(self):
        """Test Mock client initialization."""
        config = LLMConfig(dialect="mock")
        client = LLMClient(config)
        assert client.provider.dialect == "mock"
        assert isinstance(client.client, _MockModel)

    def test_unknown_dialect_raises(self):
        """Test unknown dialect raises ValueError."""
        config = LLMConfig(dialect="unknown")
        with pytest.raises(ValueError, match="Unknown LLM provider dialect"):
            LLMClient(config)

    def test_timeout_from_env(self):
        """Test timeout setting from environment variable."""
        with patch.dict(os.environ, {"LLM_TIMEOUT_S": "60"}):
            config = LLMConfig(dialect="mock")
            client = LLMClient(config)
            assert client.timeout_s == 60.0

    def test_max_retries_from_env(self):
        """Test max_retries setting from environment variable."""
        with patch.dict(os.environ, {"LLM_MAX_RETRIES": "5"}):
            config = LLMConfig(dialect="mock")
            client = LLMClient(config)
            assert client.max_retries == 5

    def test_retry_backoff_from_env(self):
        """Test retry_backoff setting from environment variable."""
        with patch.dict(os.environ, {"LLM_RETRY_BACKOFF_S": "2.5"}):
            config = LLMConfig(dialect="mock")
            client = LLMClient(config)
            assert client.retry_backoff_s == 2.5

    def test_max_concurrent_from_env(self):
        """Test max_concurrent setting from environment variable."""
        with patch.dict(os.environ, {"LLM_MAX_CONCURRENT_PER_CLIENT": "4"}):
            config = LLMConfig(dialect="mock")
            client = LLMClient(config)
            # Semaphore is initialized with value 4
            assert client._sem._value == 4


# =============================================================================
# OpenAI Provider Tests
# =============================================================================

class TestOpenAIProvider:
    """Tests for OpenAI provider functionality."""

    @patch('socialsim4.core.llm.providers.openai.OpenAI')
    def test_openai_chat_basic(self, mock_openai):
        """Test basic OpenAI chat completion."""
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Hello, how can I help?"
        mock_openai.return_value.chat.completions.create.return_value = mock_response

        config = LLMConfig(
            dialect="openai",
            api_key="test-key",
            model="gpt-4"
        )
        client = LLMClient(config)

        messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Hello"}
        ]
        result = client.chat(messages)

        assert result == "Hello, how can I help?"
        mock_openai.assert_called_once()

    @patch('socialsim4.core.llm.providers.openai.OpenAI')
    def test_openai_chat_with_vision(self, mock_openai):
        """Test OpenAI chat with vision (images)."""
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "I see an image."
        mock_openai.return_value.chat.completions.create.return_value = mock_response

        config = LLMConfig(
            dialect="openai",
            api_key="test-key",
            model="gpt-4o",
            supports_vision=True
        )
        client = LLMClient(config)

        messages = [
            {"role": "user", "content": "What do you see?", "images": ["https://example.com/image.jpg"]}
        ]
        result = client.chat(messages)

        assert result == "I see an image."

    @patch('socialsim4.core.llm.providers.openai.OpenAI')
    def test_openai_chat_unsafe_url_filtered(self, mock_openai):
        """Test that private network URLs are filtered in OpenAI chat."""
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Response"
        mock_openai.return_value.chat.completions.create.return_value = mock_response

        config = LLMConfig(
            dialect="openai",
            api_key="test-key",
            model="gpt-4o",
            supports_vision=True
        )
        client = LLMClient(config)

        messages = [
            {"role": "user", "content": "What do you see?", "images": ["http://192.168.1.1/image.jpg"]}
        ]
        result = client.chat(messages)

        # Should complete without error, private URL filtered
        assert result == "Response"

    @patch('socialsim4.core.llm.providers.openai.OpenAI')
    def test_openai_completion(self, mock_openai):
        """Test OpenAI completion API."""
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].text = "Completion text"
        mock_openai.return_value.completions.create.return_value = mock_response

        config = LLMConfig(
            dialect="openai",
            api_key="test-key",
            model="gpt-4"
        )
        client = LLMClient(config)

        result = client.completion("Complete this")

        assert result == "Completion text"

    @patch('socialsim4.core.llm.providers.openai.OpenAI')
    def test_openai_embedding(self, mock_openai):
        """Test OpenAI embedding API."""
        mock_response = MagicMock()
        mock_response.data = [MagicMock()]
        mock_response.data[0].embedding = [0.1, 0.2, 0.3]
        mock_openai.return_value.embeddings.create.return_value = mock_response

        config = LLMConfig(
            dialect="openai",
            api_key="test-key",
            model="text-embedding-ada-002"
        )
        client = LLMClient(config)

        result = client.embedding("test text")

        assert result == [0.1, 0.2, 0.3]

    @patch('socialsim4.core.llm.providers.openai.OpenAI')
    def test_openai_chat_with_temperature(self, mock_openai):
        """Test OpenAI chat with temperature parameter."""
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Response"
        mock_openai.return_value.chat.completions.create.return_value = mock_response

        config = LLMConfig(
            dialect="openai",
            api_key="test-key",
            model="gpt-4",
            temperature=0.9
        )
        client = LLMClient(config)

        messages = [{"role": "user", "content": "Test"}]
        client.chat(messages)

        # Verify temperature was passed
        call_args = mock_openai.return_value.chat.completions.create.call_args
        assert call_args[1]["temperature"] == 0.9

    @patch('socialsim4.core.llm.providers.openai.OpenAI')
    def test_openai_chat_with_max_tokens(self, mock_openai):
        """Test OpenAI chat with max_tokens parameter."""
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Response"
        mock_openai.return_value.chat.completions.create.return_value = mock_response

        config = LLMConfig(
            dialect="openai",
            api_key="test-key",
            model="gpt-4",
            max_tokens=2048
        )
        client = LLMClient(config)

        messages = [{"role": "user", "content": "Test"}]
        client.chat(messages)

        call_args = mock_openai.return_value.chat.completions.create.call_args
        assert call_args[1]["max_tokens"] == 2048

    @patch('socialsim4.core.llm.providers.openai.OpenAI')
    def test_openai_chat_with_frequency_penalty(self, mock_openai):
        """Test OpenAI chat with frequency_penalty parameter."""
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Response"
        mock_openai.return_value.chat.completions.create.return_value = mock_response

        config = LLMConfig(
            dialect="openai",
            api_key="test-key",
            model="gpt-4",
            frequency_penalty=0.5
        )
        client = LLMClient(config)

        messages = [{"role": "user", "content": "Test"}]
        client.chat(messages)

        call_args = mock_openai.return_value.chat.completions.create.call_args
        assert call_args[1]["frequency_penalty"] == 0.5

    @patch('socialsim4.core.llm.providers.openai.OpenAI')
    def test_openai_clone(self, mock_openai):
        """Test cloning an OpenAI client."""
        mock_openai_instance = MagicMock()
        mock_openai.return_value = mock_openai_instance

        config = LLMConfig(
            dialect="openai",
            api_key="test-key",
            model="gpt-4"
        )
        client = LLMClient(config)
        cloned = client.clone()

        assert cloned.provider.dialect == "openai"
        assert cloned is not client
        assert cloned._sem is not client._sem


# =============================================================================
# Gemini Provider Tests
# =============================================================================

@pytest.mark.skipif(not HAS_GEMINI, reason="google.genai not installed")
class TestGeminiProvider:
    """Tests for Gemini provider functionality."""

    @patch('socialsim4.core.llm.providers.gemini.genai')
    def test_gemini_chat_basic(self, mock_genai):
        """Test basic Gemini chat completion."""
        mock_model = MagicMock()
        mock_response = MagicMock()
        mock_response.text = "Gemini response"
        mock_model.generate_content.return_value = mock_response
        mock_genai.GenerativeModel.return_value = mock_model

        config = LLMConfig(
            dialect="gemini",
            api_key="test-key",
            model="gemini-pro"
        )
        client = LLMClient(config)

        messages = [
            {"role": "user", "content": "Hello"}
        ]
        result = client.chat(messages)

        assert result == "Gemini response"

    @patch('socialsim4.core.llm.providers.gemini.genai')
    def test_gemini_chat_with_vision(self, mock_genai):
        """Test Gemini chat with vision support."""
        mock_model = MagicMock()
        mock_response = MagicMock()
        mock_response.text = "I see an image"
        mock_model.generate_content.return_value = mock_response
        mock_genai.GenerativeModel.return_value = mock_model

        config = LLMConfig(
            dialect="gemini",
            api_key="test-key",
            model="gemini-pro-vision",
            supports_vision=True
        )
        client = LLMClient(config)

        messages = [
            {"role": "user", "content": "What do you see?", "images": ["https://example.com/image.jpg"]}
        ]
        result = client.chat(messages)

        assert result == "I see an image"

    @patch('socialsim4.core.llm.providers.gemini.genai')
    def test_gemini_completion(self, mock_genai):
        """Test Gemini completion API."""
        mock_model = MagicMock()
        mock_response = MagicMock()
        mock_response.text = "Completion text"
        mock_model.generate_content.return_value = mock_response
        mock_genai.GenerativeModel.return_value = mock_model

        config = LLMConfig(
            dialect="gemini",
            api_key="test-key",
            model="gemini-pro"
        )
        client = LLMClient(config)

        result = client.completion("Complete this")

        assert result == "Completion text"

    @patch('socialsim4.core.llm.providers.gemini.genai')
    def test_gemini_embedding(self, mock_genai):
        """Test Gemini embedding API."""
        mock_genai.embed_content.return_value = {"embedding": [0.1, 0.2, 0.3]}

        config = LLMConfig(
            dialect="gemini",
            api_key="test-key",
            model="embedding-001"
        )
        client = LLMClient(config)

        result = client.embedding("test text")

        assert result == [0.1, 0.2, 0.3]

    @patch('socialsim4.core.llm.providers.gemini.genai')
    def test_gemini_clone(self, mock_genai):
        """Test cloning a Gemini client."""
        mock_model = MagicMock()
        mock_genai.GenerativeModel.return_value = mock_model

        config = LLMConfig(
            dialect="gemini",
            api_key="test-key",
            model="gemini-pro"
        )
        client = LLMClient(config)
        cloned = client.clone()

        assert cloned.provider.dialect == "gemini"
        assert cloned is not client
        assert cloned._sem is not client._sem


# =============================================================================
# Ollama Provider Tests
# =============================================================================

class TestOllamaProvider:
    """Tests for Ollama provider functionality."""

    def test_ollama_client_init(self):
        """Test Ollama client initialization."""
        config = LLMConfig(
            dialect="ollama",
            model="llama2"
        )
        client = LLMClient(config)
        assert client.provider.dialect == "ollama"
        assert isinstance(client.client, httpx.Client)

    @patch('socialsim4.core.llm.providers.ollama.httpx.Client')
    def test_ollama_chat_basic(self, mock_httpx_client):
        """Test basic Ollama chat."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"message": {"content": "Ollama response"}}
        mock_response.raise_for_status = MagicMock()
        mock_client_instance = MagicMock()
        mock_client_instance.post.return_value = mock_response
        mock_httpx_client.return_value = mock_client_instance

        config = LLMConfig(
            dialect="ollama",
            model="llama2"
        )
        client = LLMClient(config)

        messages = [{"role": "user", "content": "Hello"}]
        result = client.chat(messages)

        assert result == "Ollama response"

    @patch('socialsim4.core.llm.providers.ollama.httpx.Client')
    def test_ollama_completion(self, mock_httpx_client):
        """Test Ollama completion API."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"response": "Completion text"}
        mock_response.raise_for_status = MagicMock()
        mock_client_instance = MagicMock()
        mock_client_instance.post.return_value = mock_response
        mock_httpx_client.return_value = mock_client_instance

        config = LLMConfig(
            dialect="ollama",
            model="llama2"
        )
        client = LLMClient(config)

        result = client.completion("Complete this")

        assert result == "Completion text"

    @patch('socialsim4.core.llm.providers.ollama.httpx.Client')
    def test_ollama_embedding(self, mock_httpx_client):
        """Test Ollama embedding API."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"embedding": [0.1, 0.2, 0.3]}
        mock_response.raise_for_status = MagicMock()
        mock_client_instance = MagicMock()
        mock_client_instance.post.return_value = mock_response
        mock_httpx_client.return_value = mock_client_instance

        config = LLMConfig(
            dialect="ollama",
            model="llama2"
        )
        client = LLMClient(config)

        result = client.embedding("test text")

        assert result == [0.1, 0.2, 0.3]

    @patch('socialsim4.core.llm.providers.ollama.httpx.Client')
    def test_ollama_embedding_missing_raises(self, mock_httpx_client):
        """Test Ollama embedding raises when embedding not returned."""
        mock_response = MagicMock()
        mock_response.json.return_value = {}
        mock_response.raise_for_status = MagicMock()
        mock_client_instance = MagicMock()
        mock_client_instance.post.return_value = mock_response
        mock_httpx_client.return_value = mock_client_instance

        config = LLMConfig(
            dialect="ollama",
            model="llama2"
        )
        client = LLMClient(config)

        with pytest.raises(ValueError, match="Ollama did not return embedding"):
            client.embedding("test text")

    @patch('socialsim4.core.llm.providers.ollama.httpx.Client')
    def test_ollama_clone(self, mock_httpx_client):
        """Test cloning an Ollama client."""
        mock_client_instance = MagicMock()
        mock_httpx_client.return_value = mock_client_instance

        config = LLMConfig(
            dialect="ollama",
            model="llama2"
        )
        client = LLMClient(config)
        cloned = client.clone()

        assert cloned.provider.dialect == "ollama"
        assert cloned is not client
        assert cloned._sem is not client._sem


# =============================================================================
# Mock Provider Tests
# =============================================================================

class TestMockProvider:
    """Tests for Mock provider functionality."""

    def test_mock_basic_chat(self):
        """Test basic mock chat response."""
        mock_model = _MockModel()
        messages = [
            {"role": "system", "content": "You are Agent"},
            {"role": "user", "content": "Hello"}
        ]
        result = mock_model.chat(messages)

        assert "--- Thoughts ---" in result
        assert "--- Plan ---" in result
        assert "--- Action ---" in result
        assert "--- Plan Update ---" in result
        assert "send_message" in result or "yield" in result

    def test_mock_council_scene_host(self):
        """Test mock behavior for council scene as host."""
        mock_model = _MockModel()
        messages = [
            {"role": "system", "content": "You are Host\nThis is a voting scenario."},
            {"role": "user", "content": "Start the council"}
        ]
        result = mock_model.chat(messages)

        assert "send_message" in result
        assert "Good morning" in result

    def test_mock_village_scene(self):
        """Test mock behavior for village scene."""
        mock_model = _MockModel()
        messages = [
            {"role": "system", "content": "You are Agent\nYou are living in a virtual village."},
            {"role": "user", "content": "Morning"}
        ]
        result = mock_model.chat(messages)

        assert "send_message" in result
        assert "Good morning" in result or "Hello" in result

    def test_mock_werewolf_scene_werewolf(self):
        """Test mock behavior for werewolf scene as werewolf."""
        mock_model = _MockModel()
        messages = [
            {"role": "system", "content": "You are Werewolf\nYou are a werewolf in this game."},
            {"role": "user", "content": "Night falls"}
        ]
        result = mock_model.chat(messages)

        assert "night_kill" in result

    def test_mock_werewolf_scene_seer(self):
        """Test mock behavior for werewolf scene as seer."""
        mock_model = _MockModel()
        messages = [
            {"role": "system", "content": "You are Seer\nYou are the seer in this werewolf game."},
            {"role": "user", "content": "Night falls"}
        ]
        result = mock_model.chat(messages)

        assert "inspect" in result

    def test_mock_continuation_yield(self):
        """Test mock yields on continuation prompt."""
        mock_model = _MockModel()
        messages = [
            {"role": "system", "content": "You are Agent"},
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there"},
            {"role": "user", "content": "Continue."}
        ]
        result = mock_model.chat(messages)

        assert "yield" in result

    def test_mock_agent_call_tracking(self):
        """Test mock tracks agent calls."""
        mock_model = _MockModel()
        messages = [
            {"role": "system", "content": "You are Agent"},
            {"role": "user", "content": "Hello"}
        ]
        mock_model.chat(messages)
        mock_model.chat(messages)

        assert mock_model.agent_calls.get("Agent") == 2

    def test_action_to_xml_no_params(self):
        """Test action_to_xml with action without parameters."""
        action = {"action": "yield"}
        result = action_to_xml(action)
        assert result == '<Action name="yield" />'

    def test_action_to_xml_with_params(self):
        """Test action_to_xml with action with parameters."""
        action = {"action": "send_message", "message": "Hello"}
        result = action_to_xml(action)
        assert result == '<Action name="send_message"><message>Hello</message></Action>'

    def test_action_to_xml_with_multiple_params(self):
        """Test action_to_xml with multiple parameters."""
        action = {"action": "vote", "target": "Alice", "reason": "suspicious"}
        result = action_to_xml(action)
        assert '<Action name="vote">' in result
        assert '<target>Alice</target>' in result
        assert '<reason>suspicious</reason>' in result


# =============================================================================
# Factory Function Tests
# =============================================================================

class TestLLMClientFactory:
    """Tests for LLM client factory function."""

    def test_create_llm_client_openai(self):
        """Test creating OpenAI client via factory."""
        config = LLMConfig(dialect="openai", api_key="test")
        with patch('socialsim4.core.llm.providers.openai.OpenAI'):
            client = create_llm_client(config)
            assert isinstance(client, LLMClient)

    @pytest.mark.skipif(not HAS_GEMINI, reason="google.genai not installed")
    def test_create_llm_client_gemini(self):
        """Test creating Gemini client via factory."""
        config = LLMConfig(dialect="gemini", api_key="test")
        with patch('socialsim4.core.llm.providers.gemini.genai'):
            client = create_llm_client(config)
            assert isinstance(client, LLMClient)

    def test_create_llm_client_ollama(self):
        """Test creating Ollama client via factory."""
        config = LLMConfig(dialect="ollama")
        client = create_llm_client(config)
        assert isinstance(client, LLMClient)

    def test_create_llm_client_mock(self):
        """Test creating Mock client via factory."""
        config = LLMConfig(dialect="mock")
        client = create_llm_client(config)
        assert isinstance(client, LLMClient)
        assert isinstance(client.client, _MockModel)


# =============================================================================
# Archetype Generation Tests
# =============================================================================

class TestArchetypeGeneration:
    """Tests for archetype generation functions."""

    def test_generate_archetypes_empty_demographics(self):
        """Test archetype generation with empty demographics."""
        result = generate_archetypes_from_demographics([])
        assert result == []

    def test_generate_archetypes_single_demographic(self):
        """Test archetype generation with single demographic."""
        demographics = [
            {"name": "gender", "categories": ["Male", "Female"]}
        ]
        result = generate_archetypes_from_demographics(demographics)

        assert len(result) == 2
        assert result[0]["attributes"]["gender"] == "Male"
        assert result[1]["attributes"]["gender"] == "Female"

    def test_generate_archetypes_multiple_demographics(self):
        """Test archetype generation with multiple demographics."""
        demographics = [
            {"name": "gender", "categories": ["Male", "Female"]},
            {"name": "age", "categories": ["Young", "Old"]}
        ]
        result = generate_archetypes_from_demographics(demographics)

        assert len(result) == 4
        # Check all combinations exist
        combinations = [(a["attributes"]["gender"], a["attributes"]["age"]) for a in result]
        assert ("Male", "Young") in combinations
        assert ("Male", "Old") in combinations
        assert ("Female", "Young") in combinations
        assert ("Female", "Old") in combinations

    def test_generate_archetypes_equal_probability(self):
        """Test archetypes have equal probability by default."""
        demographics = [
            {"name": "gender", "categories": ["Male", "Female", "Non-binary"]}
        ]
        result = generate_archetypes_from_demographics(demographics)

        for arch in result:
            assert arch["probability"] == 1/3

    def test_archetype_has_id_and_label(self):
        """Test each archetype has id and label."""
        demographics = [
            {"name": "gender", "categories": ["Male"]}
        ]
        result = generate_archetypes_from_demographics(demographics)

        assert "id" in result[0]
        assert result[0]["id"].startswith("arch_")
        assert "label" in result[0]
        assert "gender: Male" in result[0]["label"]

    def test_add_gaussian_noise_within_range(self):
        """Test Gaussian noise is clamped to range."""
        # Set seed for reproducibility
        random.seed(42)
        result = add_gaussian_noise(50, 5, min_val=0, max_val=100)

        assert 0 <= result <= 100
        assert isinstance(result, int)

    def test_add_gaussian_noise_mean(self):
        """Test Gaussian noise centers around mean."""
        results = [add_gaussian_noise(50, 5, min_val=0, max_val=100) for _ in range(100)]
        avg = sum(results) / len(results)

        # Average should be close to 50 (within 10)
        assert 40 < avg < 60

    def test_add_gaussian_noise_clamping(self):
        """Test Gaussian noise is clamped at boundaries."""
        # Even with high std_dev, values should stay in range
        results = [add_gaussian_noise(50, 100, min_val=0, max_val=100) for _ in range(100)]

        for r in results:
            assert 0 <= r <= 100


# =============================================================================
# Generate Agents with Archetypes Tests
# =============================================================================

class TestGenerateAgentsWithArchetypes:
    """Tests for generate_agents_with_archetypes function."""

    @patch('socialsim4.core.llm.generation.generate_archetype_template')
    def test_generate_agents_basic(self, mock_template):
        """Test basic agent generation."""
        mock_template.return_value = {
            "description": "A test agent",
            "roles": ["Doctor", "Teacher"]
        }

        demographics = [{"name": "gender", "categories": ["Male", "Female"]}]
        traits = [{"name": "openness", "mean": 50, "std": 10}]
        config = LLMConfig(dialect="mock")
        llm_client = LLMClient(config)

        agents = generate_agents_with_archetypes(
            total_agents=4,
            demographics=demographics,
            archetype_probabilities=None,
            traits=traits,
            llm_client=llm_client
        )

        assert len(agents) == 4
        assert agents[0]["name"] == "Agent 1"
        assert agents[0]["profile"] == "A test agent"

    @patch('socialsim4.core.llm.generation.generate_archetype_template')
    def test_generate_agents_custom_probabilities(self, mock_template):
        """Test agent generation with custom archetype probabilities."""
        mock_template.return_value = {
            "description": "A test agent",
            "roles": ["Doctor"]
        }

        demographics = [{"name": "type", "categories": ["A", "B"]}]
        archetype_probabilities = {"arch_0": 0.8, "arch_1": 0.2}
        traits = [{"name": "openness", "mean": 50, "std": 10}]
        config = LLMConfig(dialect="mock")
        llm_client = LLMClient(config)

        agents = generate_agents_with_archetypes(
            total_agents=10,
            demographics=demographics,
            archetype_probabilities=archetype_probabilities,
            traits=traits,
            llm_client=llm_client
        )

        # First archetype should have ~8 agents, second ~2
        assert len(agents) == 10

    @patch('socialsim4.core.llm.generation.generate_archetype_template')
    def test_generate_agents_requires_traits(self, mock_template):
        """Test that traits are required."""
        mock_template.return_value = {
            "description": "A test agent",
            "roles": ["Doctor"]
        }

        demographics = [{"name": "gender", "categories": ["Male"]}]
        config = LLMConfig(dialect="mock")
        llm_client = LLMClient(config)

        with pytest.raises(ValueError, match="Traits are required"):
            generate_agents_with_archetypes(
                total_agents=1,
                demographics=demographics,
                archetype_probabilities=None,
                traits=[],
                llm_client=llm_client
            )

    @patch('socialsim4.core.llm.generation.generate_archetype_template')
    def test_generate_agents_trait_validation(self, mock_template):
        """Test trait validation (must have mean and std)."""
        mock_template.return_value = {
            "description": "A test agent",
            "roles": ["Doctor"]
        }

        demographics = [{"name": "gender", "categories": ["Male"]}]
        traits = [{"name": "openness", "mean": 50}]  # Missing std
        config = LLMConfig(dialect="mock")
        llm_client = LLMClient(config)

        with pytest.raises(ValueError, match="must have 'mean' and 'std'"):
            generate_agents_with_archetypes(
                total_agents=1,
                demographics=demographics,
                archetype_probabilities=None,
                traits=traits,
                llm_client=llm_client
            )

    @patch('socialsim4.core.llm.generation.generate_archetype_template')
    def test_generate_agents_structure(self, mock_template):
        """Test generated agents have correct structure."""
        mock_template.return_value = {
            "description": "A test agent",
            "roles": ["Doctor"]
        }

        demographics = [{"name": "gender", "categories": ["Male"]}]
        traits = [{"name": "openness", "mean": 50, "std": 10}]
        config = LLMConfig(dialect="mock")
        llm_client = LLMClient(config)

        agents = generate_agents_with_archetypes(
            total_agents=1,
            demographics=demographics,
            archetype_probabilities=None,
            traits=traits,
            llm_client=llm_client
        )

        agent = agents[0]
        required_keys = ["id", "name", "role", "avatarUrl", "profile", "properties", "history", "memory", "knowledgeBase"]
        for key in required_keys:
            assert key in agent

        # Check properties include archetype info and traits
        assert "archetype_id" in agent["properties"]
        assert "openness" in agent["properties"]

    @patch('socialsim4.core.llm.generation.generate_archetype_template')
    def test_generate_agents_language_chinese(self, mock_template):
        """Test agent generation with Chinese language."""
        mock_template.return_value = {
            "description": "测试代理",
            "roles": ["医生"]
        }

        demographics = [{"name": "gender", "categories": ["Male"]}]
        traits = [{"name": "openness", "mean": 50, "std": 10}]
        config = LLMConfig(dialect="mock")
        llm_client = LLMClient(config)

        agents = generate_agents_with_archetypes(
            total_agents=1,
            demographics=demographics,
            archetype_probabilities=None,
            traits=traits,
            llm_client=llm_client,
            language="zh"
        )

        assert agents[0]["profile"] == "测试代理"


# =============================================================================
# Generate Archetype Template Tests
# =============================================================================

class TestGenerateArchetypeTemplate:
    """Tests for generate_archetype_template function."""

    @patch('socialsim4.core.llm.client.LLMClient.chat')
    def test_generate_archetype_template_basic(self, mock_chat):
        """Test basic archetype template generation."""
        mock_chat.return_value = '{"description": "A young professional", "roles": ["Engineer", "Designer", "Manager", "Teacher", "Doctor"]}'

        archetype = {
            "id": "arch_0",
            "attributes": {"gender": "Male", "age": "Young"},
            "label": "gender: Male | age: Young",
            "probability": 0.5
        }
        config = LLMConfig(dialect="mock")
        llm_client = LLMClient(config)

        result = generate_archetype_template(archetype, llm_client)

        assert result["description"] == "A young professional"
        assert len(result["roles"]) == 5
        assert "Engineer" in result["roles"]

    @patch('socialsim4.core.llm.client.LLMClient.chat')
    def test_generate_archetype_template_with_markdown(self, mock_chat):
        """Test handling JSON wrapped in markdown code blocks."""
        mock_chat.return_value = '```json\n{"description": "Test", "roles": ["A", "B", "C", "D", "E"]}\n```'

        archetype = {
            "id": "arch_0",
            "attributes": {"type": "A"},
            "label": "type: A",
            "probability": 1.0
        }
        config = LLMConfig(dialect="mock")
        llm_client = LLMClient(config)

        result = generate_archetype_template(archetype, llm_client)

        assert result["description"] == "Test"
        assert len(result["roles"]) == 5

    @patch('socialsim4.core.llm.client.LLMClient.chat')
    def test_generate_archetype_template_missing_description_raises(self, mock_chat):
        """Test error when description is missing."""
        mock_chat.return_value = '{"roles": ["A", "B", "C", "D", "E"]}'

        archetype = {
            "id": "arch_0",
            "attributes": {"type": "A"},
            "label": "type: A",
            "probability": 1.0
        }
        config = LLMConfig(dialect="mock")
        llm_client = LLMClient(config)

        with pytest.raises(RuntimeError, match="Missing or invalid 'description'"):
            generate_archetype_template(archetype, llm_client)

    @patch('socialsim4.core.llm.client.LLMClient.chat')
    def test_generate_archetype_template_missing_roles_raises(self, mock_chat):
        """Test error when roles are missing."""
        mock_chat.return_value = '{"description": "Test"}'

        archetype = {
            "id": "arch_0",
            "attributes": {"type": "A"},
            "label": "type: A",
            "probability": 1.0
        }
        config = LLMConfig(dialect="mock")
        llm_client = LLMClient(config)

        with pytest.raises(RuntimeError, match="Missing or invalid 'roles'"):
            generate_archetype_template(archetype, llm_client)

    @patch('socialsim4.core.llm.client.LLMClient.chat')
    def test_generate_archetype_template_empty_roles_raises(self, mock_chat):
        """Test error when roles array is empty."""
        mock_chat.return_value = '{"description": "Test", "roles": []}'

        archetype = {
            "id": "arch_0",
            "attributes": {"type": "A"},
            "label": "type: A",
            "probability": 1.0
        }
        config = LLMConfig(dialect="mock")
        llm_client = LLMClient(config)

        with pytest.raises(RuntimeError, match="Missing or invalid 'roles'"):
            generate_archetype_template(archetype, llm_client)

    @patch('socialsim4.core.llm.client.LLMClient.chat')
    def test_generate_archetype_template_non_string_role_raises(self, mock_chat):
        """Test error when a role is not a string."""
        mock_chat.return_value = '{"description": "Test", "roles": ["A", 123, "C", "D", "E"]}'

        archetype = {
            "id": "arch_0",
            "attributes": {"type": "A"},
            "label": "type: A",
            "probability": 1.0
        }
        config = LLMConfig(dialect="mock")
        llm_client = LLMClient(config)

        with pytest.raises(RuntimeError, match="Role 1 must be a string"):
            generate_archetype_template(archetype, llm_client)

    @patch('socialsim4.core.llm.client.LLMClient.chat')
    def test_generate_archetype_template_chinese(self, mock_chat):
        """Test archetype template generation in Chinese."""
        mock_chat.return_value = '{"description": "一个年轻的专业人士", "roles": ["工程师", "设计师", "经理", "教师", "医生"]}'

        archetype = {
            "id": "arch_0",
            "attributes": {"gender": "Male"},
            "label": "gender: Male",
            "probability": 1.0
        }
        config = LLMConfig(dialect="mock")
        llm_client = LLMClient(config)

        result = generate_archetype_template(archetype, llm_client, language="zh")

        assert result["description"] == "一个年轻的专业人士"
        assert "工程师" in result["roles"]


# =============================================================================
# Retry and Timeout Tests
# =============================================================================

class TestRetryAndTimeout:
    """Tests for retry and timeout behavior."""

    @patch('socialsim4.core.llm.providers.openai.OpenAI')
    def test_retry_on_failure(self, mock_openai):
        """Test client retries on failure."""
        # Fail twice, succeed on third attempt
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Success"

        call_count = [0]
        def side_effect(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] < 3:
                raise Exception("Temporary error")
            return mock_response

        mock_openai.return_value.chat.completions.create.side_effect = side_effect

        config = LLMConfig(dialect="openai", api_key="test")
        client = LLMClient(config)
        client.max_retries = 3

        messages = [{"role": "user", "content": "Test"}]
        result = client.chat(messages)

        assert result == "Success"
        assert call_count[0] == 3

    @patch('socialsim4.core.llm.providers.openai.OpenAI')
    def test_max_retries_exceeded(self, mock_openai):
        """Test client gives up after max retries."""
        mock_openai.return_value.chat.completions.create.side_effect = Exception("Permanent error")

        config = LLMConfig(dialect="openai", api_key="test")
        client = LLMClient(config)
        client.max_retries = 2

        messages = [{"role": "user", "content": "Test"}]

        with pytest.raises(Exception, match="Permanent error"):
            client.chat(messages)


# =============================================================================
# Message Normalization Tests
# =============================================================================

class TestMessageNormalization:
    """Tests for message normalization across providers."""

    @patch('socialsim4.core.llm.providers.openai.OpenAI')
    def test_normalize_openai_with_images(self, mock_openai):
        """Test OpenAI normalizes messages with images correctly."""
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Response"
        mock_openai.return_value.chat.completions.create.return_value = mock_response

        config = LLMConfig(
            dialect="openai",
            api_key="test",
            model="gpt-4o",
            supports_vision=True
        )
        client = LLMClient(config)

        messages = [
            {"role": "user", "content": "What do you see?", "images": ["https://example.com/image.jpg"]}
        ]
        client.chat(messages)

        # Check the call was made with proper structure
        call_args = mock_openai.return_value.chat.completions.create.call_args
        normalized = call_args[1]["messages"]
        assert normalized[0]["role"] == "user"
        assert isinstance(normalized[0]["content"], list)

    @patch('socialsim4.core.llm.providers.openai.OpenAI')
    def test_normalize_openai_without_vision(self, mock_openai):
        """Test OpenAI falls back to text content without vision support."""
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Response"
        mock_openai.return_value.chat.completions.create.return_value = mock_response

        config = LLMConfig(
            dialect="openai",
            api_key="test",
            model="gpt-4",
            supports_vision=False
        )
        client = LLMClient(config)

        messages = [
            {"role": "user", "content": "Hello", "images": ["https://example.com/image.jpg"]}
        ]
        client.chat(messages)

        call_args = mock_openai.return_value.chat.completions.create.call_args
        normalized = call_args[1]["messages"]
        # Content should be string with image placeholder
        assert isinstance(normalized[0]["content"], str)
        assert "[image:" in normalized[0]["content"]


# =============================================================================
# Integration Tests
# =============================================================================

class TestLLMIntegration:
    """Integration tests for LLM module."""

    def test_full_workflow_openai_to_action_xml(self):
        """Test full workflow from LLM response to action XML."""
        action = {"action": "send_message", "message": "Hello world"}
        xml = action_to_xml(action)

        assert xml == '<Action name="send_message"><message>Hello world</message></Action>'

    def test_full_workflow_with_mock_client(self):
        """Test full workflow with mock client."""
        config = LLMConfig(dialect="mock")
        client = LLMClient(config)

        messages = [
            {"role": "system", "content": "You are Agent"},
            {"role": "user", "content": "Hello"}
        ]
        result = client.chat(messages)

        assert "--- Thoughts ---" in result
        assert "--- Action ---" in result

    def test_full_archetype_workflow(self):
        """Test full archetype generation workflow."""
        demographics = [
            {"name": "gender", "categories": ["Male", "Female"]},
            {"name": "age", "categories": ["Young", "Old"]}
        ]

        archetypes = generate_archetypes_from_demographics(demographics)

        assert len(archetypes) == 4
        for arch in archetypes:
            assert "id" in arch
            assert "attributes" in arch
            assert "label" in arch
            assert "probability" in arch
