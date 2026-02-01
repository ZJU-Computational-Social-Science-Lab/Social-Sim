from dataclasses import dataclass, asdict
from typing import Dict, Any


@dataclass
class EnvironmentConfig:
    """Configuration for the dynamic environment feature."""

    enabled: bool = True
    turn_interval: int = 5
    max_suggestions: int = 3
    require_llm_provider: bool = True

    def serialize(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def deserialize(cls, data: Dict[str, Any]) -> "EnvironmentConfig":
        return cls(
            enabled=data.get("enabled", True),
            turn_interval=data.get("turn_interval", 5),
            max_suggestions=data.get("max_suggestions", 3),
            require_llm_provider=data.get("require_llm_provider", True),
        )
