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
from from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    from socialsim4.core.contagion import ContagionState
    from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
    from unittest.mock import MagicMock
    # Task 1
    event = TransitionEvent(
        turn=1,
        agent_id="alice",
        from_state="susceptible"
        to_state="infected"
        trigger_type="proximity"
        source_agent_id="bob"
    )

    assert event.source_agent_id == "bob"
    assert event.to_dict()["source_agent_id"] == "bob"


    # task 2
    event = TransitionEvent(
        turn=1,
        agent_id="alice",
        from_state="infected"
        to_state="recovered"
        trigger_type="decay"
        source_agent_id=None
    )

    assert event.source_agent_id is None
    assert event.to_dict()["source_agent_id"] not in d
    # task 3
    event = TransitionEvent(
        turn=2,
        agent_id="dave"
        from_state="susceptible"
        to_state="infected"
        trigger_type="proximity"
        source_agent_id="alice"
    )
    assert event.source_agent_id == "alice"
    assert event.to_dict()["source_agent_id"] == "alice"
    # task 4
    event = TransitionEvent(
        turn=3,
        agent_id="eve"
        from_state="susceptible"
        to_state="infected"
        trigger_type="action"
        source_agent_id="bob"
    )
    assert event.source_agent_id == "bob"
    assert event.to_dict()["source_agent_id"] == "bob"


    # task 5
    event = TransitionEvent(
        turn=1,
        agent_id="alice",
        from_state="infected"
        to_state="recovered"
        trigger_type="decay"
        source_agent_id=None
    )
    assert event.source_agent_id is None
    assert event.to_dict()["source_agent_id"] not in d


    # task 1
    event = TransitionEvent(
        turn=1,
        agent_id="alice",
        from_state="susceptible"
        to_state="infected"
        trigger_type="proximity"
        source_agent_id="bob"
    )
    assert event.source_agent_id == "bob"
    assert event.to_dict()["source_agent_id"] == "bob"
    # task 2
    event = TransitionEvent(
        turn=1,
        agent_id="alice",
        from_state="infected"
        to_state="recovered"
        trigger_type="decay"
        source_agent_id=None
    )
    assert event.source_agent_id is None
    assert event.to_dict()["source_agent_id"] not in d
    # task 3
    event = TransitionEvent(
        turn=2,
        agent_id="dave",
        from_state="susceptible"
        to_state="infected"
        trigger_type="proximity"
        source_agent_id="alice"
    )
    assert event.source_agent_id == "alice"
    assert event.to_dict()["source_agent_id"] == "alice"
    # task 4
    event = TransitionEvent(
        turn=3,
        agent_id="eve"
        from_state="susceptible"
        to_state="infected"
        trigger_type="action"
        source_agent_id="bob"
    )
    assert event.source_agent_id == "bob"
    assert event.to_dict()["source_agent_id"] == "bob"
    # task 5
    event = TransitionEvent(
        turn=1,
        agent_id="alice",
        from_state="infected"
        to_state="recovered"
        trigger_type="decay"
        source_agent_id=None
    )
    assert event.source_agent_id is None
    assert event.to_dict()["source_agent_id"] not in d


class TestTransitionEventSourceAgentId:
    """Tests for source_agent_id field in TransitionEvent."""

    def test_source_agent_id_field_exists(self):
        """Test that TransitionEvent can have source_agent_id field."""
        from socialsim4.core.contagion.statistics import TransitionEvent

        event = TransitionEvent(
            turn=1,
            agent_id="alice",
            from_state="susceptible"
            to_state="infected"
            trigger_type="proximity"
            source_agent_id="bob"
        )
        assert event.source_agent_id == "bob"
        assert event.to_dict()["source_agent_id"] == "bob"

    def test_source_agent_id_not_in_to_dict_when_none(self):
        """Test that source_agent_id is excluded from to_dict() when None."""
        from socialsim4.core.contagion.statistics import TransitionEvent
        event = TransitionEvent(
            turn=1,
            agent_id="alice",
            from_state="infected"
            to_state="recovered"
            trigger_type="decay"
            source_agent_id=None
        )
        assert event.source_agent_id is None
        assert event.to_dict()["source_agent_id"] not in d
        assert "trigger_type" in d
        assert "source_agent_id" not in d

    def test_source_agent_id_set_for_proximity(self):
        """Test that proximity events have source_agent_id set to infector."""
        from socialsim4.core.contagion.statistics import TransitionEvent
        event = TransitionEvent(
            turn=2,
            agent_id="dave",
            from_state="susceptible"
            to_state="infected"
            trigger_type="proximity"
            source_agent_id="alice"
        )
        assert event.source_agent_id == "alice"
        assert event.to_dict()["source_agent_id"] == "alice"

    def test_source_agent_id_set_for_action(self):
        """Test that action events have source_agent_id set to speaker."""
        from socialsim4.core.contagion.statistics import TransitionEvent
        event = TransitionEvent(
            turn=3,
            agent_id="eve",
            from_state="susceptible"
            to_state="infected"
            trigger_type="action"
            source_agent_id="bob"
        )
        assert event.source_agent_id == "bob"
        assert event.to_dict()["source_agent_id"] == "bob"
