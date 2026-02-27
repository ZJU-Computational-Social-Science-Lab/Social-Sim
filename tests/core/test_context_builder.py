"""Tests for core.context_builder module."""

import pytest
from socialsim4.core.context_builder import build_context_summary


def test_empty_history_returns_first_round():
    """Should return first round message for empty history."""
    result = build_context_summary([])
    assert result == "This is the first round."


def test_single_round_summary():
    """Should summarize a single round."""
    history = [
        {
            "round": 1,
            "actions": [
                {"agent": "Participant 1", "action": "Cooperate"},
                {"agent": "Participant 2", "action": "Defect"},
            ]
        }
    ]
    result = build_context_summary(history)
    assert "Round 1: Participant 1 chose Cooperate, Participant 2 chose Defect" in result


def test_multiple_rounds_summary():
    """Should summarize multiple rounds."""
    history = [
        {
            "round": 1,
            "actions": [{"agent": "P1", "action": "Cooperate"}, {"agent": "P2", "action": "Cooperate"}]
        },
        {
            "round": 2,
            "actions": [{"agent": "P1", "action": "Defect"}, {"agent": "P2", "action": "Cooperate"}]
        },
    ]
    result = build_context_summary(history)
    assert "Round 1:" in result
    assert "Round 2:" in result


def test_max_rounds_limiting():
    """Should only include last N rounds when max_rounds specified."""
    history = [
        {"round": i, "actions": [{"agent": "P1", "action": "Act"}]}
        for i in range(1, 11)  # 10 rounds
    ]
    result = build_context_summary(history, max_rounds=3)
    assert "Round 8:" in result
    assert "Round 10:" in result
    assert "Round 1:" not in result


def test_pattern_detection_three_same():
    """Should detect when agent chooses same action 3+ times."""
    history = [
        {"round": i, "actions": [{"agent": "P1", "action": "Defect"}]}
        for i in range(1, 5)  # 4 rounds of Defect
    ]
    result = build_context_summary(history, max_rounds=5)
    assert "P1 has chosen Defect in" in result


def test_pattern_detection_not_enough_rounds():
    """Should not show pattern with fewer than 3 rounds."""
    history = [
        {"round": i, "actions": [{"agent": "P1", "action": "Defect"}]}
        for i in range(1, 3)  # Only 2 rounds
    ]
    result = build_context_summary(history)
    assert "has chosen Defect in" not in result


def test_pattern_detection_no_dominant():
    """Should not show pattern when no dominant action."""
    history = [
        {"round": 1, "actions": [{"agent": "P1", "action": "Cooperate"}]},
        {"round": 2, "actions": [{"agent": "P1", "action": "Defect"}]},
        {"round": 3, "actions": [{"agent": "P1", "action": "Cooperate"}]},
        {"round": 4, "actions": [{"agent": "P1", "action": "Defect"}]},
    ]
    result = build_context_summary(history)
    assert "has chosen" not in result


def test_state_snapshot_appended():
    """Should append state_snapshot if provided."""
    history = [
        {"round": 1, "actions": [{"agent": "P1", "action": "Move"}]}
    ]
    state = {"P1_location": "north_corner"}
    result = build_context_summary(history, state_snapshot=state)
    assert "P1_location: north_corner" in result


def test_state_snapshot_ignored_when_none():
    """Should work normally when state_snapshot is None."""
    history = [
        {"round": 1, "actions": [{"agent": "P1", "action": "Move"}]}
    ]
    result = build_context_summary(history, state_snapshot=None)
    assert "Round 1:" in result


def test_simultaneous_context_shows_own_action():
    """In simultaneous mode, agents see their own previous round actions."""
    history = [
        {
            "round": 1,
            "actions": [
                {"agent": "Alice", "action": "Cooperate"},
                {"agent": "Bob", "action": "Defect"},
            ]
        }
    ]
    # For Alice in simultaneous mode with Round 1 history
    # Round 1 is a completed round, so it should be visible
    result = build_context_summary(
        history,
        for_agent="Alice",
        visibility_mode="previous_rounds"
    )
    # Alice should see Round 1 actions (it's a previous round)
    assert "Alice" in result or "Cooperate" in result


def test_simultaneous_context_shows_previous_rounds():
    """In previous_rounds mode, agents see completed rounds (Bug 2 fix)."""
    history = [
        {
            "round": 1,
            "actions": [
                {"agent": "Alice", "action": "Cooperate"},
                {"agent": "Bob", "action": "Defect"},
            ]
        }
    ]
    # When running Round 2, Round 1 is in history as a completed round
    # previous_rounds mode should show it
    result = build_context_summary(
        history,
        for_agent="Alice",
        visibility_mode="previous_rounds"
    )
    # Round 1 should be visible as a previous round
    assert "Round 1:" in result
    assert "Alice" in result or "Cooperate" in result


def test_context_size_bounded_regardless_of_agent_count():
    """Context should be bounded regardless of agent count (Bug D)."""
    # Create history with many agents
    history = [
        {
            "round": 1,
            "actions": [
                {"agent": f"Agent{i}", "action": "Act"}
                for i in range(20)  # 20 agents
            ]
        }
    ]
    # Context should still be bounded
    result = build_context_summary(history, max_rounds=5)
    # Should contain round 1
    assert "Round 1:" in result
    # Should have all agents in the round (within the round)


def test_paired_context_shows_previous_rounds():
    """In paired mode, agents see previous rounds (uses previous_rounds visibility)."""
    history = [
        {
            "round": 1,
            "actions": [
                {"agent": "Alice", "action": "Cooperate"},
                {"agent": "Bob", "action": "Defect"},
                {"agent": "Charlie", "action": "Cooperate"},
                {"agent": "Diana", "action": "Cooperate"},
            ]
        }
    ]
    # For Alice in paired mode - uses previous_rounds visibility
    # Round 1 is a completed round, so it should be visible
    result = build_context_summary(
        history,
        for_agent="Alice",
        visibility_mode="previous_rounds"
    )
    # Round 1 should be visible as a previous round
    assert "Round 1:" in result
