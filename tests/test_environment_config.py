import pytest
from socialsim4.core.environment_config import EnvironmentConfig


def test_default_config():
    config = EnvironmentConfig()
    assert config.enabled is True
    assert config.turn_interval == 5
    assert config.max_suggestions == 3
    assert config.require_llm_provider is True


def test_custom_config():
    config = EnvironmentConfig(
        enabled=False,
        turn_interval=10,
        max_suggestions=5,
        require_llm_provider=False,
    )
    assert config.enabled is False
    assert config.turn_interval == 10
    assert config.max_suggestions == 5


def test_config_serialize():
    config = EnvironmentConfig()
    data = config.serialize()
    assert data["enabled"] is True
    assert data["turn_interval"] == 5


def test_config_deserialize():
    data = {"enabled": False, "turn_interval": 10, "max_suggestions": 2, "require_llm_provider": True}
    config = EnvironmentConfig.deserialize(data)
    assert config.enabled is False
    assert config.turn_interval == 10
