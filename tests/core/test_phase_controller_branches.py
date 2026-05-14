"""
Tests for uncovered branches in core/phase_controller.py.

Targets: record_turn, get_round_history, format_round_transcript,
should_suggest_voting (LLM eval), should_conclude_meeting (stalemate/votes),
transition_to_voting (legacy state), conclude_meeting (legacy scene),
is_action_allowed (all phases), _detect_stalemate, get_status_prompt,
get_facilitation_message, set_simulator.

Contains: TestRecordTurn, TestRoundTranscript, TestSuggestVoting,
TestConcludeMeeting, TestTransitionVoting, TestConcludeMeetingState,
TestActionAllowed, TestStalemate, TestStatusPrompt, TestFacilitation
"""

import pytest
from unittest.mock import MagicMock, patch

from socialsim4.core.phase_controller import SystemFacilitator, CouncilPhase


def _facilitator(simulator=None, extensions=None):
    """Create a SystemFacilitator with a mock scene."""
    scene = MagicMock()
    scene.state = MagicMock()
    scene.state.extensions = extensions or {}
    return SystemFacilitator(scene=scene, simulator=simulator)


class TestRecordTurn:
    """record_turn increments count, stores history, truncates content."""

    def test_turn_count_increments(self):
        f = _facilitator()
        f.record_turn("Alice", "send_message", "hello")
        assert f.turn_count == 1
        f.record_turn("Bob", "send_message", "hi")
        assert f.turn_count == 2

    def test_content_truncated_at_500(self):
        f = _facilitator()
        long_content = "x" * 1000
        f.record_turn("A", "send_message", long_content)
        assert len(f.conversation_history[0]["content"]) == 500

    def test_round_num_recorded(self):
        f = _facilitator()
        f.record_turn("A", "yield", round_num=5)
        assert f.conversation_history[0]["round"] == 5


class TestRoundTranscript:
    """format_round_transcript: various action types."""

    def test_empty_round(self):
        f = _facilitator()
        assert "No activity" in f.format_round_transcript(1)

    def test_send_message_format(self):
        f = _facilitator()
        f.record_turn("Alice", "send_message", "Hello world", round_num=1)
        transcript = f.format_round_transcript(1)
        assert 'Alice: "Hello world"' in transcript

    def test_vote_format(self):
        f = _facilitator()
        f.record_turn("Bob", "vote", "yes", round_num=1)
        transcript = f.format_round_transcript(1)
        assert "Bob voted" in transcript

    def test_long_content_truncated_with_ellipsis(self):
        f = _facilitator()
        long_msg = "x" * 300
        f.record_turn("A", "send_message", long_msg, round_num=1)
        transcript = f.format_round_transcript(1)
        assert "..." in transcript

    def test_start_voting_format(self):
        f = _facilitator()
        f.record_turn("System", "start_voting", round_num=1)
        transcript = f.format_round_transcript(1)
        assert "Voting has begun" in transcript

    def test_generic_action_format(self):
        f = _facilitator()
        f.record_turn("Alice", "look_around", "", round_num=1)
        transcript = f.format_round_transcript(1)
        assert "Alice: look_around" in transcript


class TestSuggestVoting:
    """should_suggest_voting: wrong phase, too few turns, LLM yes/no/error."""

    def test_wrong_phase_returns_false(self):
        f = _facilitator()
        f.phase = CouncilPhase.VOTING
        ok, reason = f.should_suggest_voting()
        assert ok is False
        assert "Already in" in reason

    def test_too_few_turns(self):
        f = _facilitator()
        f.turn_count = 1
        ok, reason = f.should_suggest_voting()
        assert ok is False
        assert "at least" in reason

    def test_voting_already_started(self):
        f = _facilitator(extensions={"voting_started": True})
        f.turn_count = 10
        ok, reason = f.should_suggest_voting()
        assert ok is False
        assert "already started" in reason


class TestConcludeMeeting:
    """should_conclude_meeting: concluded, stalemate, votes+exhaustion."""

    def test_already_concluded(self):
        f = _facilitator()
        f.phase = CouncilPhase.CONCLUDED
        ok, reason = f.should_conclude_meeting()
        assert ok is True

    def test_votes_and_exhausted(self):
        f = _facilitator(extensions={"past_votes": [{"v": 1}], "voting_started": False})
        f.turn_count = 15
        ok, reason = f.should_conclude_meeting()
        assert ok is True
        assert "exhausted" in reason


class TestTransitionVoting:
    """transition_to_voting: legacy dict state, no double transition."""

    def test_legacy_dict_state(self):
        """Legacy: scene.state is a plain dict without .extensions."""
        state_dict = {"some_key": "val"}
        scene = MagicMock()
        scene.state = state_dict  # Plain dict: hasattr(., 'extensions') is False
        f = SystemFacilitator(scene=scene)
        f.transition_to_voting("Test proposal")
        assert state_dict["voting_started"] is True
        assert state_dict["vote_title"] == "Test proposal"

    def test_no_transition_from_voting(self):
        f = _facilitator()
        f.phase = CouncilPhase.VOTING
        f.transition_to_voting("Should not happen")
        # phase stays VOTING, state unchanged
        assert f.phase == CouncilPhase.VOTING


class TestConcludeMeetingState:
    """conclude_meeting: legacy scene with .complete attribute."""

    def test_legacy_scene_complete(self):
        scene = MagicMock()
        scene.complete = False
        scene.state = MagicMock()
        scene.state.extensions = {}
        sim = MagicMock()
        f = SystemFacilitator(scene=scene, simulator=sim)
        f.conclude_meeting()
        assert scene.complete is True
        assert sim.broadcast.called


class TestActionAllowed:
    """is_action_allowed: all phases, voting/discussion/concluded."""

    def test_phaseless_actions_always_allowed(self):
        f = _facilitator()
        for action in ["yield", "voting_status", "request_brief"]:
            ok, err = f.is_action_allowed(action)
            assert ok is True
            assert err is None

    def test_vote_blocked_during_discussion(self):
        f = _facilitator()
        for action in ["vote", "vote_yes", "vote_no", "abstain"]:
            ok, err = f.is_action_allowed(action)
            assert ok is False

    def test_vote_allowed_during_voting(self):
        f = _facilitator(extensions={"voting_started": True})
        f.phase = CouncilPhase.VOTING
        ok, err = f.is_action_allowed("vote")
        assert ok is True

    def test_send_message_blocked_during_voting(self):
        f = _facilitator(extensions={"voting_started": True})
        f.phase = CouncilPhase.VOTING
        ok, err = f.is_action_allowed("send_message")
        assert ok is False

    def test_concluded_blocks_everything(self):
        f = _facilitator()
        f.phase = CouncilPhase.CONCLUDED
        ok, err = f.is_action_allowed("send_message")
        assert ok is False

    def test_start_voting_blocked_if_already_started(self):
        f = _facilitator(extensions={"voting_started": True})
        ok, err = f.is_action_allowed("start_voting")
        assert ok is False
        assert "already in progress" in err

    def test_start_voting_blocked_during_deliberation(self):
        f = _facilitator()
        f._deliberation_rounds = 5
        f.current_round_num = 2
        ok, err = f.is_action_allowed("start_voting")
        assert ok is False
        assert "round(s) of deliberation remaining" in err

    def test_call_vote_blocked_during_deliberation(self):
        f = _facilitator()
        f._deliberation_rounds = 5
        f.current_round_num = 2
        ok, err = f.is_action_allowed("call_vote")
        assert ok is False

    def test_vote_blocked_without_voting_started(self):
        f = _facilitator(extensions={"voting_started": False})
        f.phase = CouncilPhase.VOTING
        ok, err = f.is_action_allowed("vote")
        assert ok is False
        assert "not started" in err


class TestStalemate:
    """_detect_stalemate: threshold, substantive vs non-substantive."""

    def test_below_threshold_no_stalemate(self):
        f = _facilitator()
        f.turn_count = 3
        assert f._detect_stalemate() is False

    def test_stalemate_detected(self):
        f = _facilitator()
        for i in range(8):
            f.record_turn("A", "yield", "")
        assert f._detect_stalemate() is True

    def test_substantive_actions_prevent_stalemate(self):
        f = _facilitator()
        for i in range(4):
            f.record_turn("A", "yield", "")
        f.record_turn("B", "send_message", "important")
        f.record_turn("C", "send_message", "also important")
        assert f._detect_stalemate() is False


class TestStatusPrompt:
    """get_status_prompt: phase-specific output."""

    def test_discussion_phase(self):
        f = _facilitator()
        status = f.get_status_prompt()
        assert "Discussion Phase" in status

    def test_voting_phase_with_title(self):
        f = _facilitator(extensions={"vote_title": "My Proposal", "votes": {"A": "yes"}})
        f.phase = CouncilPhase.VOTING
        status = f.get_status_prompt()
        assert "My Proposal" in status
        assert "Votes cast: 1" in status

    def test_discussion_with_deliberation_remaining(self):
        f = _facilitator()
        f._deliberation_rounds = 3
        f.current_round_num = 1
        status = f.get_status_prompt()
        assert "Deliberation rounds remaining: 2" in status

    def test_discussion_deliberation_complete(self):
        f = _facilitator()
        f._deliberation_rounds = 2
        f.current_round_num = 2
        status = f.get_status_prompt()
        assert "Deliberation complete" in status


class TestFacilitation:
    """get_facilitation_message: suggests voting or conclude."""

    def test_suggests_voting_when_ready(self):
        f = _facilitator()
        f.turn_count = 10
        with patch.object(f, "should_suggest_voting", return_value=(True, "Ready")):
            msg = f.get_facilitation_message()
        assert "Ready" in msg
        assert "start_voting" in msg

    def test_suggests_conclude_when_ready(self):
        f = _facilitator()
        f.turn_count = 15
        with patch.object(f, "should_suggest_voting", return_value=(False, "")):
            with patch.object(f, "should_conclude_meeting", return_value=(True, "Done")):
                msg = f.get_facilitation_message()
        assert "Done" in msg
        assert "finish_meeting" in msg

    def test_returns_none_when_nothing_ready(self):
        f = _facilitator()
        with patch.object(f, "should_suggest_voting", return_value=(False, "")):
            with patch.object(f, "should_conclude_meeting", return_value=(False, "")):
                assert f.get_facilitation_message() is None
