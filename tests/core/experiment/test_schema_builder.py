"""
Tests for schema builder module.

Tests the JSON schema generation for constrained decoding.
"""

import pytest

from socialsim4.core.experiment.game_configs import PRISONERS_DILEMMA, MINIMUM_EFFORT
from socialsim4.core.experiment.schema_builder import build_schema


def test_build_schema_discrete():
    """Schema for discrete actions includes enum constraint."""
    schema = build_schema(PRISONERS_DILEMMA)

    assert schema["type"] == "object"
    assert "reasoning" in schema["properties"]
    assert "action" in schema["properties"]
    assert schema["properties"]["action"]["type"] == "string"
    assert schema["properties"]["action"]["enum"] == ["cooperate", "defect"]
    assert schema["required"] == ["action"]


def test_build_schema_integer():
    """Schema for integer actions includes type constraint."""
    schema = build_schema(MINIMUM_EFFORT)

    assert schema["type"] == "object"
    assert "reasoning" in schema["properties"]
    assert "effort" in schema["properties"]
    assert schema["properties"]["effort"]["type"] == "integer"
    assert schema["required"] == ["effort"]
