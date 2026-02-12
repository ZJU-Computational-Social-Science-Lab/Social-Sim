"""
Configuration management for LLM prompt testing framework.

Handles Ollama API connection settings, model configurations, and test parameters.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List


@dataclass
class OllamaConfig:
    """Configuration for Ollama API connection."""

    base_url: str = "http://localhost:11434/v1"
    timeout: int = 120  # seconds
    max_retries: int = 3
    retry_delay: float = 1.0  # seconds


@dataclass
class ModelConfig:
    """Configuration for an LLM model."""

    name: str  # e.g., "qwen3:4b"
    display_name: str  # e.g., "Qwen3 4B"
    api_name: str  # Name to send to API
    max_tokens: int = 2048
    temperature: float = 0.7


# Available models for testing
AVAILABLE_MODELS: List[ModelConfig] = [
    ModelConfig(
        name="gemma3_4b_it_qat",
        display_name="Gemma3 4B IT QAT",
        api_name="gemma3:4b-it-qat",
    ),
    ModelConfig(
        name="ministral_3b",
        display_name="Ministral 3B",
        api_name="ministral-3:3b",
    ),
]

# qwen3:4b is excluded due to fundamental incompatibility with structured Action/XML output format
# The model outputs conversational text instead of the required Action tags, even with
# extensive prompting and few-shot examples. This appears to be a training/alignment
# limitation specific to this model variant.
# Note: If alternative qwen models are available (qwen3:7b, qwen2.5:14b), they may work better.


@dataclass
class TestConfig:
    """Configuration for test execution."""

    # Iteration settings
    runs_per_iteration: int = 3
    max_iterations: int = 5
    stop_on_perfect: bool = True

    # Cross-LLM portability
    min_models_for_pass: int = 2  # 2 out of 3 must pass

    # Output settings
    results_dir: Path = field(default_factory=lambda: Path("test_results"))
    detailed_csv: bool = True

    # Logging
    log_level: str = "INFO"
    log_file: Path = field(default_factory=lambda: Path("test_results/test.log"))


# Interaction patterns
INTERACTION_PATTERNS = [
    "Strategic Decisions",
    "Opinions & Influence",
    "Network & Spread",
    "Markets & Exchange",
    "Spatial & Movement",
    "Open Conversation",
]


# Scenarios per pattern
SCENARIOS_BY_PATTERN = {
    "Strategic Decisions": [
        "prisoners_dilemma",
        "stag_hunt",
        "minimum_effort",
    ],
    "Opinions & Influence": [
        "opinion_polarization",
        "consensus_game",
        "design_your_own",
    ],
    "Network & Spread": [
        "information_cascade",
        "opinion_spread",
        "design_your_own",
    ],
    "Markets & Exchange": [
        "basic_trading",
        "double_auction",
        "design_your_own",
    ],
    "Spatial & Movement": [
        "spatial_cooperation",
        "segregation_model",
        "design_your_own",
    ],
    "Open Conversation": [
        "focus_group",
        "deliberation",
        "design_your_own",
    ],
}


# Global configuration instances
ollama_config = OllamaConfig()
test_config = TestConfig()


def get_model_by_name(name: str) -> ModelConfig | None:
    """Get model configuration by name."""
    for model in AVAILABLE_MODELS:
        if model.name == name or model.api_name == name:
            return model
    return None


def get_all_model_names() -> List[str]:
    """Get all available model names."""
    return [m.api_name for m in AVAILABLE_MODELS]


def get_scenarios_for_pattern(pattern: str) -> List[str]:
    """Get scenarios for a given pattern."""
    return SCENARIOS_BY_PATTERN.get(pattern, [])
