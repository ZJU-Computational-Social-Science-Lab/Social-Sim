"""
Experiment Agent - lightweight agent for experiment scenarios.

Unlike legacy agents, ExperimentAgent has no Plan/Thoughts/Emotion.
It only carries properties (demographics) and LLM configuration.
"""

from dataclasses import dataclass
from typing import Any, Dict

from socialsim4.core.llm_config import LLMConfig


@dataclass
class ExperimentAgent:
    """Lightweight agent for experiment scenarios.

    Experiment agents are simpler than legacy agents:
    - No Plan/Thoughts/Emotion tracking
    - Properties come from demographic builder
    - LLM configuration specifies which model to use

    Attributes:
        name: Agent's display name
        properties: Demographic properties (age, profession, traits, etc.)
        llm_config: Which LLM provider/model to use for this agent
    """

    name: str
    properties: Dict[str, Any]
    llm_config: LLMConfig

    def get_properties_dict(self) -> Dict[str, Any]:
        """Return properties as dict for prompt builder."""
        return self.properties

    def get_property(self, key: str, default: Any = None) -> Any:
        """Get a single property value."""
        return self.properties.get(key, default)

    def has_property(self, key: str) -> bool:
        """Check if agent has a property."""
        return key in self.properties
