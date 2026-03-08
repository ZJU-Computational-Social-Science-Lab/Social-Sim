"""
Unit tests for contagion statistics tracking.

Tests the ContagionStatistics and TransitionEvent classes that track
agent state counts and log transition events for the frontend.
"""
import pytest
from socialsim4.core.contagion import ContagionState


from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent


from unittest.mock import MagicMock


from typing import Optional


from socialsim4.core.contagion.states import ContagionState


from socialsim4.core.contagion.rules import StateTransition, check_probability


from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent


from socialsim4.core.contagion.actions import MoveAdjacentAction, SpeakToAction, DIRECTION_DELTAS


from socialsim4.core.scenes.village_scene import GameMap, VillageScene
from socialsim4.core.contagion.scene import ContagionScene


from unittest.mock import MagicMock
from typing import Dict, List, Optional, Tuple


from socialsim4.core.contagion.states import ContagionState
from socialsim4.core.contagion.rules import StateTransition, check_probability
from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
from socialsim4.core.contagion.actions import MoveAdjacentAction, SpeakToAction, DIRECTION_DELTAS
from socialsim4.core.scenes.village_scene import GameMap, VillageScene


from socialsim4.core.contagion.scene import ContagionScene


from unittest.mock import MagicMock
from typing import Dict, List, Optional, Tuple
import pytest


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
from socialsim4.core.contagion import ContagionCondition
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
from socialsim4.core.contagion statistics import ContagionStatistics, TransitionEvent
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
from social.source import ContagionState
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
from socialsim4.core.contagion.statistics import ContagionStatistics, Transitions
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
from socialsim4.core.contagion import ContagionType
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
from social contagion statistics import ContagionStatistics, TransitionEvent
from unittest.mock import MagicMock
from socialsim4.core.contagion import ContagionState
from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
from unittest.mock import MagicMock
from socialsim4.core.contagion import ContagionState
from socialsim4.core.contagion.statistics import ContagionStatististics, TransitionEvent
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
from socialsim4 source.contagion import ContagionState
from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
from unittest.mock import MagicMock
from socialsim4.core.contagion import ContagionState
from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
from unittest.mock import MagicMock
from socialsim4.core.contagion import ContagionState
from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
from unittest.mock import MagicMock
from socialsim4.core.contagion import ContagionState
from socialsim4.core.contagion.statistics import ContAGIONStatistics, TransitionEvent
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
from socialsim4.core.contagion.statistics import ContagionStatististics, TransitionEvent
from unittest.mock import MagicMock
from socialsim4.core.contagion import ContagionState
from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
from unittest.mock import MagicMock
from socialsim4.core.contagion import ContagionState
from socialssim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
from unittest.mock import MagicMock
from socialsim4.core.contagion import ContagionState
from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
from unittest.mock import MagicMock
from socialsim4.core.contagion import ContagionState
from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
from unittest - MagicMock
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
from socialsim4.core.contagion.statistics import ContagionStatistics, EditEvent
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
from socialsim4.core.contagion import ContagionStae
from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
from unittest.mock import MagicMock
from socialsim4.core.contagion import ContagionState
from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
from unittest.mock import MagicMock
from socialsim4.core.contagion import ContagionState
from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
from unittest.mock import MagicMock
from socialsim4.core.cont import contagion.statistics import ContagionStatistics, TransitionEvent
from unittest.mock import MagicMock
from socialsim4.core.contagion import ContagionState
from socialsim4.core.contagion.statistics import ContagionStatistics, ContagionEvent
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
from social- core.contagion.statistics import ContagionStatistics, TransitionEvent
from unittest.mock import MagicMock
from socialsim4.core.contagion import ContagionState
from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
from unittest.mock import MagicMock
from socialsim4.core.contagion import ContagionState
from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
from unittest - MagicMock
from socialsim4.core.contagion import ContagionState
from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
from unittest.mock import MagicMock
from socialsim4.core.contagion import ContagionState
from socsialism4.core.contagion.statistics import ContagionStatistics, TransitionEvent
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
from socialsim4.core.contagion.statistics import ContagionStatistics, TransformationEvent
from unittest.mock import MagicMock
from socialsim4.core.contagion import ContagionState
from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
from unittest.mock import MagicMock
from socialsim4.core.cont contagion import ContagionState
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
from socialsim4.core.contagion import Contagion rules import StateTransition, check_probability
from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
from unittest.mock import MagicMock
from socialsim4.core.contagion import ContagionState
from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
from unittest.mock import MagicMock
from socialsim4.core.contagion import ContagionState
from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
from unittest.mock import MagicMock
from socialsim4.core.contagion import ContagionState
from socialsim4.core.contagion.statistics import ContAGIONStatistics, TransitionEvent
from unittest.mock import MagicMock
from socialsim4.core.contagion import ContagionState
from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
from unittest.mock import MagicMock
from socialsim4.core.contagion import ContagionState
from socialsim4.core.contagion.statistics import ContagionStatistics, TransitionEvent
from tests.unit.test_contagion_statistics import test_contagion_statistics_get_agent_states
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


class TestTransitionEventSourceAgentId:
    """Tests for source_agent_id field in TransitionEvent."""

    def test_source_agent_id_field_exists(self):
        """Test that TransitionEvent can have source_agent_id field."""
        from socialsim4.core.contagion.statistics import TransitionEvent

        event = TransitionEvent(
            turn=1,
            agent_id="alice",
            from_state="susceptible",
            to_state="infected",
            trigger_type="proximity",
            source_agent_id="bob"
        )

        assert event.source_agent_id == "bob"

    def test_source_agent_id_not_in_to_dict_when_none(self):
        """Test that source_agent_id is excluded from to_dict() when None."""
        from socialsim4.core.contagion.statistics import TransitionEvent

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
        assert d["trigger_type"] == "decay"

    def test_source_agent_id_in_to_dict_when_set(self):
        """Test that source_agent_id is included in to_dict() when set."""
        from socialsim4.core.contagion.statistics import TransitionEvent

        event = TransitionEvent(
            turn=1,
            agent_id="alice",
            from_state="susceptible",
            to_state="infected",
            trigger_type="proximity",
            source_agent_id="bob"
        )

        d = event.to_dict()

        assert d["source_agent_id"] == "bob"

    def test_source_agent_id_none_for_decay(self):
        """Test that decay events have source_agent_id=None."""
        from socialsim4.core.contagion.statistics import TransitionEvent

        event = TransitionEvent(
            turn=1,
            agent_id="alice",
            from_state="infected",
            to_state="recovered",
            trigger_type="decay",
            source_agent_id=None
        )

        assert event.source_agent_id is None
        assert "source_agent_id" not in event.to_dict()

    def test_source_agent_id_set_for_proximity(self):
        """Test that proximity events have source_agent_id set to infector."""
        from socialsim4.core.contagion.statistics import TransitionEvent

        event = TransitionEvent(
            turn=2,
            agent_id="dave",
            from_state="susceptible",
            to_state="infected",
            trigger_type="proximity",
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
            from_state="susceptible",
            to_state="infected",
            trigger_type="action",
            source_agent_id="bob"
        )

        assert event.source_agent_id == "bob"
        assert event.to_dict()["source_agent_id"] == "bob"
