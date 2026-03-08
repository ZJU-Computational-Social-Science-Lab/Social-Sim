"""
Unit tests for StateTransition dataclass and rule evaluation.

Tests the declarative rule system for contagion state transitions.
"""
import pytest
from socialsim4.core.contagion import ContagionState, StateTransition, check_probability


def test_state_transition_accepts_parameters():
    """Test that StateTransition accepts required parameters."""
    transition = StateTransition(
        from_state=ContagionState.SUSCEPTIBLE,
        to_state=ContagionState.INFECTED,
        trigger_type="proximity",
        probability=0.3
    )

    assert transition.from_state == ContagionState.SUSCEPTIBLE
    assert transition.to_state == ContagionState.INFECTED
    assert transition.trigger_type == "proximity"
    assert transition.probability == 0.3


def test_state_transition_validates_probability_range():
    """Test that StateTransition validates probability must be 0.0-1.0."""
    # Test probability too low
    with pytest.raises(ValueError, match="probability must be between 0.0 and 1.0"):
        StateTransition(
            from_state=ContagionState.SUSCEPTIBLE,
            to_state=ContagionState.INFECTED,
            trigger_type="proximity",
            probability=-0.1
        )

    # Test probability too high
    with pytest.raises(ValueError, match="probability must be between 0.0 and 1.0"):
        StateTransition(
            from_state=ContagionState.SUSCEPTIBLE,
            to_state=ContagionState.INFECTED,
            trigger_type="proximity",
            probability=1.5
        )


def test_state_transition_validates_trigger_type():
    """Test that StateTransition validates trigger_type must be valid."""
    with pytest.raises(ValueError, match="trigger_type must be one of"):
        StateTransition(
            from_state=ContagionState.SUSCEPTIBLE,
            to_state=ContagionState.INFECTED,
            trigger_type="invalid_type",
            probability=0.5
        )


def test_state_transition_requires_decay_turns():
    """Test that StateTransition requires decay_turns when trigger_type is 'decay'."""
    with pytest.raises(ValueError, match="decay_turns is required when trigger_type is 'decay'"):
        StateTransition(
            from_state=ContagionState.INFECTED,
            to_state=ContagionState.RECOVERED,
            trigger_type="decay",
            probability=1.0
        )

    # Should not raise when decay_turns is provided
    transition = StateTransition(
        from_state=ContagionState.INFECTED,
        to_state=ContagionState.RECOVERED,
        trigger_type="decay",
        probability=1.0,
        decay_turns=5
    )
    assert transition.decay_turns == 5


def test_decay_turns_defaults_to_none():
    """Test that decay_turns is Optional[int] and defaults to None."""
    transition = StateTransition(
        from_state=ContagionState.SUSCEPTIBLE,
        to_state=ContagionState.INFECTED,
        trigger_type="proximity",
        probability=0.3
    )
    assert transition.decay_turns is None


def test_check_probability_returns_bool():
    """Test that check_probability(prob) returns True when random.random() < prob."""
    # Mock random to control test
    import random
    original_random = random.random

    try:
        # Test when random() < probability (should return True)
        random.random = lambda: 0.2
        assert check_probability(0.3) is True

        # Test when random() >= probability (should return False)
        random.random = lambda: 0.5
        assert check_probability(0.3) is False

        # Test edge case: random() == probability (should return False)
        random.random = lambda: 0.3
        assert check_probability(0.3) is False

        # Test edge case: probability = 0.0 (should always return False)
        random.random = lambda: 0.0
        assert check_probability(0.0) is False

        # Test edge case: probability = 1.0 (should always return True)
        random.random = lambda: 0.999
        assert check_probability(1.0) is True
    finally:
        random.random = original_random
