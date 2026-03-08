"""
Unit tests for ContagionState enum.

Tests the core contagion state types that define agent infection status.
"""
import pytest
from enum import Enum


def test_contagion_state_susceptible():
    """Test that SUSCEPTIBLE state equals 'susceptible'."""
    from socialsim4.core.contagion import ContagionState

    assert ContagionState.SUSCEPTIBLE.value == "susceptible"


def test_contagion_state_infected():
    """Test that INFECTED state equals 'infected'."""
    from socialsim4.core.contagion import ContagionState

    assert ContagionState.INFECTED.value == "infected"


def test_contagion_state_recovered():
    """Test that RECOVERED state equals 'recovered'."""
    from socialsim4.core.contagion import ContagionState

    assert ContagionState.RECOVERED.value == "recovered"


def test_contagion_state_exposed():
    """Test that EXPOSED state equals 'exposed'."""
    from socialsim4.core.contagion import ContagionState

    assert ContagionState.EXPOSED.value == "exposed"


def test_contagion_states_are_string_enums():
    """Test that all states inherit from str and Enum."""
    from socialsim4.core.contagion import ContagionState

    # Check that ContagionState inherits from str and Enum
    assert issubclass(ContagionState, str)
    assert issubclass(ContagionState, Enum)

    # Check that all values are strings
    for state in ContagionState:
        assert isinstance(state.value, str)
