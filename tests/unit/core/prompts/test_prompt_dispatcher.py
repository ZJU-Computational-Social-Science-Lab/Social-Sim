"""
Tests for prompt dispatcher.

Verifies that the dispatcher routes to the correct prompt builder
based on scenario ID.
"""

import pytest
from socialsim4.core.prompts.prompt_dispatcher import get_prompt_builder, build_prompt


class TestPromptDispatcher:
    """Tests for prompt dispatcher routing."""

    def test_routes_battle_of_the_sexes(self):
        """Should route battle_of_the_sexes to correct builder."""
        builder = get_prompt_builder("battle_of_the_sexes")
        assert builder is not None
        assert callable(builder)

    def test_routes_stag_hunt(self):
        """Should route stag_hunt to correct builder."""
        builder = get_prompt_builder("stag_hunt")
        assert builder is not None
        assert callable(builder)

    def test_routes_public_goods(self):
        """Should route public_goods to correct builder."""
        builder = get_prompt_builder("public_goods")
        assert builder is not None
        assert callable(builder)

    def test_returns_none_for_unsupported_scenario(self):
        """Should return None for scenarios without custom builders."""
        builder = get_prompt_builder("prisoners_dilemma")
        assert builder is None

    def test_build_prompt_returns_string(self):
        """Should return a string prompt."""
        prompt = build_prompt("battle_of_the_sexes", {}, language="en")
        assert isinstance(prompt, str)
        assert len(prompt) > 0

    def test_build_prompt_returns_none_for_unsupported(self):
        """Should return None for scenarios without builders."""
        prompt = build_prompt("unknown_scenario", {}, language="en")
        assert prompt is None
