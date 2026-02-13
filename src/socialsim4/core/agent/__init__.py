"""
Agent module - Core agent implementation.

This module contains the Agent class and related components for
social simulation agents. The Agent class represents an autonomous
agent that can perceive, reason, and act within a simulation.

The module is organized as follows:
- agent.py: Main Agent class (orchestrator)
- parsing.py: Response parsing utilities
- rag.py: RAG and knowledge base management
- serialization.py: Agent serialization/deserialization
- registry.py: Action space registry for deserialization

This is a refactored version that delegates specialized functionality
to focused submodules while maintaining backwards compatibility.
"""

# Import the main Agent class from the agent subpackage
from .agent import Agent

# Export for backwards compatibility
__all__ = ["Agent"]

# Re-export parsing functions for any code that imports them
from .parsing import (
    parse_full_response,
    parse_emotion_update,
    parse_plan_update,
    parse_actions,
)

from .serialization import serialize_agent, deserialize_agent
from .registry import ACTION_SPACE_MAP, register_action

__all__.extend([
    "parse_full_response",
    "parse_emotion_update",
    "parse_plan_update",
    "parse_actions",
    "serialize_agent",
    "deserialize_agent",
    "ACTION_SPACE_MAP",
    "register_action",
])
