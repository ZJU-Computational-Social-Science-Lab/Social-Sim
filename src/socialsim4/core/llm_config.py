"""LLM provider configuration structures."""

from dataclasses import dataclass


@dataclass
class LLMConfig:
    dialect: str
    api_key: str = ""
    model: str = ""
    base_url: str | None = None
    temperature: float = 0.7
    top_p: float = 1.0
    frequency_penalty: float = 0.0
    presence_penalty: float = 0.0
    max_tokens: int = 1024
