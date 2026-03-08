"""
Unit tests for contagion statistics tracking.

Tests the ContagionStatistics and TransitionEvent classes that track
agent state counts and log transition events for the frontend.
"""
import pytest
from socialsim4.core.contagion import ContagionState


def test_transition_event_records_required_fields():
    """Test that TransitionEvent records turn, agent_id, from_state, to_state, trigger_type."""
    from socialsim4.core.contagion.statistics import TransitionEvent

    event = TransitionEvent(
        turn=5,
        agent_id="agent_1",
        from_state="susceptible",
        to_state="infected",
        trigger_type="proximity"
    )

    assert event.turn == 5
    assert event.agent_id == "agent_1"
    assert event.from_state == "susceptible"
    assert event.to_state == "infected"
    assert event.trigger_type == "proximity"


def test_transition_event_to_dict_returns_serializable():
    """Test that TransitionEvent.to_dict() returns serializable event dict."""
    from socialsim4.core.contagion.statistics import TransitionEvent

    event = TransitionEvent(
        turn=10,
        agent_id="agent_2",
        from_state="infected",
        to_state="recovered",
        trigger_type="decay"
    )

    result = event.to_dict()

    assert isinstance(result, dict)
    assert result["turn"] == 10
    assert result["agent_id"] == "agent_2"
    assert result["from_state"] == "infected"
    assert result["to_state"] == "recovered"
    assert result["trigger_type"] == "decay"


def test_contagion_statistics_counts_returns_state_counts():
    """Test that ContagionStatistics.counts returns dict of state -> count."""
    from socialsim4.core.contagion.statistics import ContagionStatistics

    stats = ContagionStatistics()
    stats.counts = {"susceptible": 3, "infected": 2, "recovered": 1}

    assert stats.counts["susceptible"] == 3
    assert stats.counts["infected"] == 2
    assert stats.counts["recovered"] == 1


def test_contagion_statistics_update_counts_agents_per_state():
    """Test that ContagionStatistics.update(agents) counts agents per state."""
    from socialsim4.core.contagion.statistics import ContagionStatistics
    from unittest.mock import MagicMock

    stats = ContagionStatistics()

    # Create mock agents with different states
    agent1 = MagicMock()
    agent1.name = "agent_1"
    agent1.properties = {"contagion_state": "susceptible"}

    agent2 = MagicMock()
    agent2.name = "agent_2"
    agent2.properties = {"contagion_state": "susceptible"}

    agent3 = MagicMock()
    agent3.name = "agent_3"
    agent3.properties = {"contagion_state": "infected"}

    agents = {"agent_1": agent1, "agent_2": agent2, "agent_3": agent3}

    stats.update(agents)

    assert stats.counts.get("susceptible", 0) == 2
    assert stats.counts.get("infected", 0) == 1


def test_contagion_statistics_to_dict_returns_serializable_counts():
    """Test that ContagionStatistics.to_dict() returns serializable counts."""
    from socialsim4.core.contagion.statistics import ContagionStatistics

    stats = ContagionStatistics()
    stats.counts = {"susceptible": 4, "infected": 2}

    result = stats.to_dict()

    assert isinstance(result, dict)
    assert "counts" in result
    assert result["counts"]["susceptible"] == 4
    assert result["counts"]["infected"] == 2


def test_contagion_statistics_record_transition_appends_event():
    """Test that record_transition appends TransitionEvent to events list."""
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent

    stats = ContagionStatistics()
    event = TransitionEvent(
        turn=3,
        agent_id="agent_1",
        from_state="susceptible",
        to_state="infected",
        trigger_type="proximity"
    )

    stats.record_transition(event)

    assert len(stats.events) == 1
    assert stats.events[0] == event


def test_contagion_statistics_get_agent_states():
    """Test that get_agent_states returns {agent_name: state} dict."""
    from socialsim4.core.contagion.statistics import ContagionStatistics
    from unittest.mock import MagicMock

    stats = ContagionStatistics()

    agent1 = MagicMock()
    agent1.name = "alice"
    agent1.properties = {"contagion_state": "infected"}

    agent2 = MagicMock()
    agent2.name = "bob"
    agent2.properties = {"contagion_state": "susceptible"}

    agents = {"alice": agent1, "bob": agent2}

    result = stats.get_agent_states(agents)

    assert result == {"alice": "infected", "bob": "susceptible"}
