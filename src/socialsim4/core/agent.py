"""
Core Agent class - Facade for modular structure.

This file provides backwards compatibility by re-exporting the Agent class
from the new modular agent package.

The actual implementation has been refactored into focused modules:
- agent/agent.py: Main Agent class (orchestrator)
- agent/parsing.py: Response parsing utilities
- agent/rag.py: RAG and knowledge base management
- agent/serialization.py: Agent serialization/deserialization
- agent/registry.py: Action space registry

Each module has detailed documentation explaining its purpose.
"""

# Import the Agent class from the new modular package
from .agent import Agent

# Re-export for backwards compatibility
__all__ = ["Agent"]
