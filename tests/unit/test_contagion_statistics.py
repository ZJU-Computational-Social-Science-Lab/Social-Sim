"""
Unit tests for contagion statistics tracking.

Tests the ContagionStatistics and TransitionEvent classes that track
agent state counts and log transition events for the frontend.
"""
import pytest
from unittest.mock import MagicMock
from typing import Optional

from socialsim4.core.contagion.states import ContagionState
from socialsim4.core.contagion.rules import StateTransition, check_probability
from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent


class TestTransitionEvent:
    """Tests for TransitionEvent dataclass."""

    def test_transition_event_creation(self):
        """Test basic TransitionEvent creation."""
        event = TransitionEvent(
            turn=1,
            agent_id="alice",
            from_state="susceptible",
            to_state="infected",
            trigger_type="proximity"
        )
        assert event.turn == 1
        assert event.agent_id == "alice"
        assert event.from_state == "susceptible"
        assert event.to_state == "infected"
        assert event.trigger_type == "proximity"

    def test_transition_event_to_dict(self):
        """Test TransitionEvent serialization."""
        event = TransitionEvent(
            turn=2,
            agent_id="bob",
            from_state="infected",
            to_state="recovered",
            trigger_type="decay"
        )
        d = event.to_dict()
        assert d["turn"] == 2
        assert d["agent_id"] == "bob"
        assert d["from_state"] == "infected"
        assert d["to_state"] == "recovered"
        assert d["trigger_type"] == "decay"


class TestTransitionEventSourceAgentId:
    """Tests for source_agent_id field in TransitionEvent."""

    def test_source_agent_id_field_exists(self):
        """Test that source_agent_id field exists on TransitionEvent."""
        event = TransitionEvent(
            turn=1,
            agent_id="alice",
            from_state="susceptible",
            to_state="infected",
            trigger_type="proximity",
            source_agent_id="bob"
        )
        assert event.source_agent_id == "bob"

    def test_source_agent_id_defaults_to_none(self):
        """Test that source_agent_id defaults to None when not provided."""
        event = TransitionEvent(
            turn=1,
            agent_id="alice",
            from_state="susceptible",
            to_state="infected",
            trigger_type="proximity"
        )
        assert event.source_agent_id is None

    def test_source_agent_id_not_in_to_dict_when_none(self):
        """Test that source_agent_id is excluded from to_dict() when None."""
        event = TransitionEvent(
            turn=1,
            agent_id="alice",
            from_state="infected",
            to_state="recovered",
            trigger_type="decay",
            source_agent_id=None
        )
        d = event.to_dict()
        assert "source_agent_id" not in d

    def test_source_agent_id_in_to_dict_when_set(self):
        """Test that source_agent_id is included in to_dict() when set."""
        event = TransitionEvent(
            turn=1,
            agent_id="alice",
            from_state="susceptible",
            to_state="infected",
            trigger_type="proximity",
            source_agent_id="bob"
        )
        d = event.to_dict()
        assert "source_agent_id" in d
        assert d["source_agent_id"] == "bob"

    def test_source_agent_id_for_proximity_event(self):
        """Test proximity events can track infection source."""
        event = TransitionEvent(
            turn=5,
            agent_id="dave",
            from_state="susceptible",
            to_state="infected",
            trigger_type="proximity",
            source_agent_id="alice"
        )
        assert event.source_agent_id == "alice"
        assert event.to_dict()["source_agent_id"] == "alice"

    def test_source_agent_id_for_action_event(self):
        """Test action events can track infection source (speaker)."""
        event = TransitionEvent(
            turn=3,
            agent_id="eve",
            from_state="susceptible",
            to_state="infected",
            trigger_type="action",
            source_agent_id="bob"
        )
        assert event.source_agent_id == "bob"
        assert event.to_dict()["source_agent_id"] == "bob"

    def test_source_agent_id_none_for_decay_event(self):
        """Test decay events have source_agent_id=None (no external source)."""
        event = TransitionEvent(
            turn=10,
            agent_id="charlie",
            from_state="infected",
            to_state="recovered",
            trigger_type="decay"
        )
        assert event.source_agent_id is None
        assert "source_agent_id" not in event.to_dict()


class TestContagionStatistics:
    """Tests for ContagionStatistics class."""

    def test_statistics_initialization(self):
        """Test ContagionStatistics initializes with empty data."""
        stats = ContagionStatistics()
        assert stats.counts == {}
        assert stats.events == []

    def test_statistics_update_counts(self):
        """Test update() correctly counts agent states."""
        stats = ContagionStatistics()

        # Create mock agents with different states
        agent1 = MagicMock()
        agent1.properties = {"contagion_state": "susceptible"}
        agent1.name = "alice"

        agent2 = MagicMock()
        agent2.properties = {"contagion_state": "infected"}
        agent2.name = "bob"

        agent3 = MagicMock()
        agent3.properties = {"contagion_state": "susceptible"}
        agent3.name = "charlie"

        agents = {"alice": agent1, "bob": agent2, "charlie": agent3}
        stats.update(agents)

        assert stats.counts["susceptible"] == 2
        assert stats.counts["infected"] == 1

    def test_statistics_record_transition(self):
        """Test record_transition() appends events."""
        stats = ContagionStatistics()

        event1 = TransitionEvent(
            turn=1, agent_id="alice",
            from_state="susceptible", to_state="infected",
            trigger_type="proximity"
        )
        event2 = TransitionEvent(
            turn=2, agent_id="bob",
            from_state="infected", to_state="recovered",
            trigger_type="decay"
        )

        stats.record_transition(event1)
        stats.record_transition(event2)

        assert len(stats.events) == 2
        assert stats.events[0].agent_id == "alice"
        assert stats.events[1].agent_id == "bob"

    def test_statistics_to_dict(self):
        """Test to_dict() serializes counts and events."""
        stats = ContagionStatistics()

        agent = MagicMock()
        agent.properties = {"contagion_state": "infected"}
        agent.name = "alice"

        stats.update({"alice": agent})

        event = TransitionEvent(
            turn=1, agent_id="alice",
            from_state="susceptible", to_state="infected",
            trigger_type="proximity", source_agent_id="bob"
        )
        stats.record_transition(event)

        d = stats.to_dict()
        assert d["counts"]["infected"] == 1
        assert len(d["events"]) == 1
        assert d["events"][0]["source_agent_id"] == "bob"

    def test_get_agent_states(self):
        """Test get_agent_states() returns name -> state mapping."""
        stats = ContagionStatistics()

        agent1 = MagicMock()
        agent1.properties = {"contagion_state": "susceptible"}
        agent1.name = "alice"

        agent2 = MagicMock()
        agent2.properties = {"contagion_state": "infected"}
        agent2.name = "bob"

        states = stats.get_agent_states({"alice": agent1, "bob": agent2})
        assert states["alice"] == "susceptible"
        assert states["bob"] == "infected"
