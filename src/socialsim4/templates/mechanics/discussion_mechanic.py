"""Discussion mechanic for structured communication.

Provides turn-based or free-form discussion with optional moderation.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from socialsim4.core.actions.base_actions import SendMessageAction
from socialsim4.templates.mechanics.base import CoreMechanic

if TYPE_CHECKING:
    from socialsim4.core.agent import Agent
    from socialsim4.core.scene import Scene


class DiscussionMechanic(CoreMechanic):
    """Discussion mechanic for agent communication.

    Manages speaking turns, message history, and optional moderation.
    Can be configured for moderated or unstructured discussion.

    Config:
        moderated: Whether discussion has a moderator (default: False)
        speaking_time_limit: Maximum messages per turn (default: 0 = unlimited)
        allow_private: Whether private messages are allowed (default: True)
        max_message_length: Maximum characters per message (default: 1000)
    """

    TYPE = "discussion"

    def __init__(
        self,
        moderated: bool = False,
        speaking_time_limit: int = 0,
        allow_private: bool = True,
        max_message_length: int = 1000,
    ):
        self.moderated = moderated
        self.speaking_time_limit = speaking_time_limit
        self.allow_private = allow_private
        self.max_message_length = max_message_length
        self._actions = [
            SendMessageAction(),
        ]

    @classmethod
    def from_config(cls, config: dict) -> "DiscussionMechanic":
        """Create DiscussionMechanic from config dict."""
        return cls(
            moderated=config.get("moderated", False),
            speaking_time_limit=config.get("speaking_time_limit", 0),
            allow_private=config.get("allow_private", True),
            max_message_length=config.get("max_message_length", 1000),
        )

    def initialize_agent(self, agent: Agent, scene: Scene) -> None:
        """Initialize agent with discussion properties."""
        agent.properties.setdefault("speaking_turn", 0)
        agent.properties.setdefault("has_spoken_this_turn", False)
        agent.properties.setdefault("message_count", 0)

    def get_actions(self) -> list:
        """Return discussion action classes."""
        return self._actions

    def get_scene_state(self) -> dict:
        """Return discussion mechanic's contribution to scene state."""
        return {
            "moderated": self.moderated,
            "speaking_time_limit": self.speaking_time_limit,
            "allow_private": self.allow_private,
            "max_message_length": self.max_message_length,
        }

    def can_speak(self, agent: Agent) -> bool:
        """Check if agent can speak (respects time limits)."""
        if self.speaking_time_limit <= 0:
            return True
        return agent.properties.get("message_count", 0) < self.speaking_time_limit

    def record_message(self, agent: Agent) -> None:
        """Record that agent sent a message."""
        agent.properties["message_count"] = agent.properties.get("message_count", 0) + 1
        agent.properties["has_spoken_this_turn"] = True

    def reset_turn(self, agent: Agent) -> None:
        """Reset speaking state for a new turn."""
        agent.properties["has_spoken_this_turn"] = False
        agent.properties["message_count"] = 0

    def validate_message(self, message: str) -> tuple[bool, str]:
        """Validate a message against constraints.

        Returns:
            (is_valid, error_message)
        """
        if not message or not message.strip():
            return False, "Message cannot be empty."

        if len(message) > self.max_message_length:
            return False, (
                f"Message too long ({len(message)} chars, "
                f"max {self.max_message_length})."
            )

        return True, ""
