"""
Tests for uncovered simulator.py branch paths.

Targets: emit_event exception handling, run loop error recovery,
offline agent handling in run loop.
"""

import pytest
from unittest.mock import MagicMock, patch
from socialsim4.core.simulator import Simulator
from socialsim4.core.agent import Agent
from socialsim4.core.ordering import SequentialOrdering


def _make_scene():
    """Create a mock scene that satisfies the run loop."""
    scene = MagicMock()
    scene.state = {"time": 0}
    scene.is_complete.return_value = False
    scene.get_agent_status_prompt.return_value = None
    scene.should_skip_turn.return_value = False
    scene.should_extend_run.return_value = False
    scene.post_turn.return_value = None
    scene.get_scene_actions.return_value = []
    scene.parse_and_handle_action.return_value = (True, "ok", "", {}, True)
    return scene


def _make_sim(agents=None, scene=None, event_handler=None):
    """Create a minimal simulator with broadcast_initial=False."""
    if agents is None:
        agents = [
            Agent(name="A1", user_profile="p", style="neutral", action_space=[]),
            Agent(name="A2", user_profile="p", style="neutral", action_space=[]),
        ]
    if scene is None:
        scene = _make_scene()
    ordering = SequentialOrdering()
    clients = {"chat": MagicMock()}
    return Simulator(
        agents=agents, scene=scene, clients=clients,
        broadcast_initial=False, ordering=ordering,
        event_handler=event_handler,
    )


# ---------------------------------------------------------------------------
# emit_event Exception Paths
# ---------------------------------------------------------------------------


class TestEmitEventExceptions:
    """Exceptions in event handlers are caught, not propagated."""

    def test_log_handler_exception_swallowed(self):
        handler = MagicMock(side_effect=RuntimeError("handler crashed"))
        sim = _make_sim(event_handler=handler)
        # Should NOT raise
        sim.emit_event("test_event", {"key": "val"})
        handler.assert_called_once_with("test_event", {"key": "val"})

    def test_ordering_on_event_exception_swallowed(self):
        sim = _make_sim()
        sim.started = True
        sim.ordering.on_event = MagicMock(side_effect=RuntimeError("ordering crashed"))
        sim.emit_event("test_event", {"key": "val"})
        sim.ordering.on_event.assert_called_once()

    def test_agent_error_offline_emits_system_log(self):
        """agent_error with kind=offline triggers a second system_log event."""
        handler = MagicMock()
        sim = _make_sim(event_handler=handler)
        sim.emit_event("agent_error", {"kind": "offline", "agent": "A1"})
        assert handler.call_count == 2
        assert handler.call_args_list[1][0][0] == "system_log"
        system_data = handler.call_args_list[1][0][1]
        assert system_data["level"] == "warning"
        assert "A1" in system_data["message"]

    def test_system_log_failure_swallowed(self):
        """If system_log emission also fails, it's caught."""
        handler = MagicMock()
        # First call (agent_error) succeeds, second (system_log) raises
        handler.side_effect = [None, RuntimeError("system_log fail")]
        sim = _make_sim(event_handler=handler)
        sim.emit_event("agent_error", {"kind": "offline", "agent": "A1"})
        # Both calls were attempted
        assert handler.call_count == 2


# ---------------------------------------------------------------------------
# Run Loop Error Recovery
# ---------------------------------------------------------------------------


class TestRunLoopErrorRecovery:
    """When agent.process() raises mid-run, simulator catches and continues."""

    def test_agent_exception_continues_to_next_agent(self):
        sim, a1, a2 = _make_sim_with_mocked_process()
        a1.process.side_effect = RuntimeError("Agent A1 crashed")
        a2.process.return_value = [{"action": {"name": "yield"}}]

        sim.scene.parse_and_handle_action.return_value = (True, "ok", "", {}, True)
        sim.run(max_turns=2)
        # a2 should still be processed after a1 crashed
        a2.process.assert_called_once()

    def test_agent_exception_emits_error_event(self):
        handler = MagicMock()
        sim, a1, _ = _make_sim_with_mocked_process(event_handler=handler)
        a1.process.side_effect = RuntimeError("boom")
        sim.run(max_turns=1)
        # At least one error event should have been emitted
        error_calls = [c for c in handler.call_args_list if c[0][0] == "error"]
        assert len(error_calls) >= 1

    def test_offline_agent_handled_gracefully(self):
        """Agent with is_offline=True returns {} without crashing simulator."""
        a1 = Agent(name="A1", user_profile="p", style="neutral", action_space=[])
        a1.is_offline = True
        a2 = Agent(name="A2", user_profile="p", style="neutral", action_space=[])
        sim = _make_sim(agents=[a1, a2])
        # Run should complete without error
        sim.run(max_turns=2)
        assert sim.turns == 2


def _make_sim_with_mocked_process(event_handler=None):
    """Create simulator with real agents whose process() is mocked."""
    a1 = Agent(name="A1", user_profile="p", style="neutral", action_space=[])
    a2 = Agent(name="A2", user_profile="p", style="neutral", action_space=[])
    sim = _make_sim(agents=[a1, a2], event_handler=event_handler)
    # Replace process methods after construction
    a1.process = MagicMock()
    a2.process = MagicMock()
    return sim, a1, a2
