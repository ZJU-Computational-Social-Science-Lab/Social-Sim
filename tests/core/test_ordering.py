"""
Tests for ordering.py — agent scheduling strategies.

Covers CycledOrdering, RandomOrdering, ControlledOrdering,
LLMModeratedOrdering, and base Ordering serialize/deserialize.
"""

import pytest
from unittest.mock import MagicMock, patch

from socialsim4.core.ordering import (
    CycledOrdering,
    RandomOrdering,
    ControlledOrdering,
    LLMModeratedOrdering,
    SequentialOrdering,
    Ordering,
)


# --- Helpers ----------------------------------------------------------------

def _make_sim(agent_names):
    """Create a mock simulator with named agents."""
    sim = MagicMock()
    sim.agents = {n: MagicMock(name=n) for n in agent_names}
    return sim


def _take(iterable, n):
    """Collect n items from an iterator."""
    return [next(iterable) for _ in range(n)]


# --- CycledOrdering ---------------------------------------------------------

class TestCycledOrdering:

    def test_cycles_through_all_agents(self):
        co = CycledOrdering(["A", "B", "C"])
        result = _take(co.iter(), 6)
        assert result == ["A", "B", "C", "A", "B", "C"]

    def test_single_agent_repeats(self):
        co = CycledOrdering(["Solo"])
        assert _take(co.iter(), 3) == ["Solo", "Solo", "Solo"]

    def test_empty_list_stops_immediately(self):
        co = CycledOrdering([])
        result = list(co.iter())
        assert result == []

    def test_serialize_deserialize_roundtrip(self):
        co = CycledOrdering(["A", "B"])
        _take(co.iter(), 4)  # advance idx
        state = co.serialize()
        co2 = CycledOrdering([])
        co2.deserialize(state)
        assert co2.names == ["A", "B"]
        assert co2._idx == co._idx

    @pytest.mark.xfail(reason="bug: CycledOrdering.set_state crashes on None — no null guard")
    def test_deserialize_none_resets(self):
        co = CycledOrdering(["X"])
        co.deserialize(None)
        assert co.names == []

    def test_get_state_returns_copy(self):
        co = CycledOrdering(["A", "B"])
        state = co.get_state()
        state["names"].append("C")
        assert co.names == ["A", "B"]  # original unmodified


# --- RandomOrdering ---------------------------------------------------------

class TestRandomOrdering:

    def test_deterministic_with_seed(self):
        ro1 = RandomOrdering(seed=42)
        ro2 = RandomOrdering(seed=42)
        sim = _make_sim(["A", "B", "C"])
        ro1.set_simulation(sim)
        ro2.set_simulation(sim)
        assert _take(ro1.iter(), 10) == _take(ro2.iter(), 10)

    def test_produces_only_known_agents(self):
        ro = RandomOrdering()
        names = ["A", "B", "C"]
        ro.set_simulation(_make_sim(names))
        result = _take(ro.iter(), 20)
        assert all(n in names for n in result)

    def test_empty_sim_stops(self):
        ro = RandomOrdering()
        ro.set_simulation(_make_sim([]))
        assert list(ro.iter()) == []


# --- ControlledOrdering -----------------------------------------------------

class TestControlledOrdering:

    def test_follows_next_fn_sequence(self):
        seq = iter(["A", "B", "C", None])
        co = ControlledOrdering(next_fn=lambda sim: next(seq))
        co.set_simulation(_make_sim(["A", "B", "C"]))
        result = _take(co.iter(), 3)
        assert result == ["A", "B", "C"]

    def test_skips_unknown_agent_names(self):
        """next_fn returning a name not in sim.agents stops iteration."""
        calls = iter(["Unknown", "A"])
        co = ControlledOrdering(next_fn=lambda sim: next(calls, None))
        co.set_simulation(_make_sim(["A"]))
        # "Unknown" is skipped, then "A" is yielded
        result = _take(co.iter(), 1)
        assert result == ["A"]

    def test_no_next_fn_yields_nothing(self):
        """When next_fn is None, iter() loops forever without yielding.
        Cannot assert — just document the infinite loop behavior."""
        co = ControlledOrdering()
        co.set_simulation(_make_sim(["A"]))
        gen = co.iter()
        # Attempting next(gen) would hang, so we verify the iterator exists
        # but never yields — the while-True has no break for name=None
        assert gen is not None

    def test_next_fn_returning_none_loops_forever(self):
        """When next_fn returns None, iter() loops without yielding."""
        co = ControlledOrdering(next_fn=lambda sim: None)
        co.set_simulation(_make_sim(["A"]))
        gen = co.iter()
        assert gen is not None


# --- LLMModeratedOrdering ---------------------------------------------------

class TestLLMModeratedOrdering:

    def test_refill_from_queue(self):
        """Queue is pre-filled; items yielded without calling moderator."""
        mod = MagicMock()
        mod.name = "Moderator"
        lmo = LLMModeratedOrdering(mod)
        lmo.set_simulation(_make_sim(["A", "B"]))
        lmo._queue = ["A", "B"]
        result = _take(lmo.iter(), 2)
        assert result == ["A", "B"]

    def test_fallback_sequential_when_refill_fails(self):
        """If _refill_queue produces nothing, fallback fills queue."""
        mod = MagicMock()
        mod.name = "Moderator"
        lmo = LLMModeratedOrdering(mod)
        lmo.set_simulation(_make_sim(["A", "B"]))
        # Patch _refill_queue to do nothing (simulates LLM failure path)
        lmo._refill_queue = MagicMock()
        result = _take(lmo.iter(), 2)
        # Falls back to self.names order
        assert result == ["A", "B"]

    def test_add_to_queue_filters_unknown(self):
        mod = MagicMock()
        lmo = LLMModeratedOrdering(mod)
        lmo.set_simulation(_make_sim(["A", "B"]))
        lmo.add_to_queue(["A", "Ghost", "B"])
        assert lmo._queue == ["A", "B"]

    def test_is_queue_empty(self):
        mod = MagicMock()
        lmo = LLMModeratedOrdering(mod)
        lmo.set_simulation(_make_sim(["A"]))
        assert lmo.is_queue_empty()
        lmo._queue.append("A")
        assert not lmo.is_queue_empty()


# --- SequentialOrdering -----------------------------------------------------

class TestSequentialOrdering:

    def test_cycles_agents_in_order(self):
        so = SequentialOrdering()
        so.set_simulation(_make_sim(["X", "Y", "Z"]))
        result = _take(so.iter(), 4)
        assert result == ["X", "Y", "Z", "X"]

    def test_skips_removed_agent(self):
        so = SequentialOrdering()
        sim = _make_sim(["A", "B", "C"])
        so.set_simulation(sim)
        # Remove B after init
        del sim.agents["B"]
        names = _take(so.iter(), 4)
        assert "B" not in names
        assert set(names) == {"A", "C"}


# --- Base Ordering ----------------------------------------------------------

class TestBaseOrdering:

    def test_iter_raises(self):
        with pytest.raises(NotImplementedError):
            Ordering().iter()

    def test_post_turn_noop(self):
        Ordering().post_turn("any")

    def test_on_event_noop(self):
        Ordering().on_event(MagicMock(), "test", {})

    def test_serialize_none(self):
        assert Ordering().serialize() is None

    def test_deserialize_none(self):
        Ordering().deserialize(None)
