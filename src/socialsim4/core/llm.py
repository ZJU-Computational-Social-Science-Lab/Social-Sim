"""
Core LLM module - Facade for modular structure.

This file provides backwards compatibility by re-exporting the LLM classes
and functions from the new modular llm package.

The actual implementation has been refactored into focused modules:
- llm/client.py: Main LLMClient class
- llm/validation.py: URL validation and SSRF prevention
- llm/generation.py: Archetype generation utilities
- llm/providers/: Provider-specific implementations

The refactoring maintains the same public API for backwards compatibility.
"""

# Import the main classes and functions from the new modular package
from .llm import (
    LLMClient,
    create_llm_client,
    validate_media_url,
    _is_private_network_url,
    generate_archetypes_from_demographics,
    add_gaussian_noise,
    generate_archetype_template,
    generate_agents_with_archetypes,
    _MockModel,
    action_to_xml,
    LLMConfig,
    guess_supports_vision,
)

# Re-export for backwards compatibility
__all__ = [
    "LLMClient",
    "create_llm_client",
    "validate_media_url",
    "_is_private_network_url",
    "generate_archetypes_from_demographics",
    "add_gaussian_noise",
    "generate_archetype_template",
    "generate_agents_with_archetypes",
    "_MockModel",
    "action_to_xml",
    "LLMConfig",
    "guess_supports_vision",
]
