"""
Tests for council_actions.py — StartVoting, VotingStatus, RequestBrief,
Vote, and FinishMeeting handle() methods.

Covers happy paths, state guards, parameter validation,
duplicate-vote rejection, auto-conclude logic, and facilitator updates.
"""

import pytest
from unittest.mock import MagicMock
from enum import Enum

from socialsim4.core.actions.council_actions import (
    StartVotingAction,
    VotingStatusAction,
    RequestBriefAction,
    VoteAction,
    FinishMeetingAction,
)


class _FakePhase(Enum):
    DISCUSSION = "discussion"
    VOTING = "voting"
    CONCLUDED = "concluded"


# --- Fixtures ---------------------------------------------------------------

@pytest.fixture
def agent():
    a = MagicMock()
    a.name = "Alice"
    a.language = "en"
    a.add_env_feedback = MagicMock()
    a.call_llm = MagicMock(return_value="brief material")
    return a


@pytest.fixture
def simulator():
    sim = MagicMock()
    sim.agents = {"Alice": MagicMock(), "Bob": MagicMock()}
    sim.broadcast = MagicMock()
    return sim


@pytest.fixture
def scene():
    s = MagicMock(spec=["state", "complete", "deliver_message"])
    s.state = {}
    s.complete = False
    s.deliver_message = MagicMock()
    return s


# --- StartVotingAction ------------------------------------------------------

class TestStartVotingAction:

    def test_happy_path(self, agent, simulator, scene):
        success, result, summary, meta, pass_ctrl = StartVotingAction().handle(
            {"title": "Proposal A"}, agent, simulator, scene
        )
        assert success is True
        assert result["title"] == "Proposal A"
        assert pass_ctrl is True
        assert scene.state["voting_started"] is True
        assert scene.state["vote_title"] == "Proposal A"
        assert scene.state["votes"] == {}
        simulator.broadcast.assert_called_once()

    def test_updates_facilitator_phase(self, agent, simulator, scene):
        fac = MagicMock()
        fac.phase = _FakePhase.DISCUSSION
        fac.turn_count = 5
        scene.facilitator = fac

        StartVotingAction().handle({"title": "X"}, agent, simulator, scene)
        assert fac.phase == _FakePhase.VOTING
        assert fac.last_facilitation_turn == 5

    def test_no_facilitator_no_error(self, agent, simulator, scene):
        """Works fine when scene has no facilitator attribute."""
        StartVotingAction().handle({"title": "Y"}, agent, simulator, scene)
        assert scene.state["voting_started"] is True


# --- VotingStatusAction -----------------------------------------------------

class TestVotingStatusAction:

    def test_not_started(self, agent, simulator, scene):
        success, result, summary, meta, pass_ctrl = VotingStatusAction().handle(
            {}, agent, simulator, scene
        )
        assert success is True
        assert result["started"] is False
        assert result["members"] == 2
        assert pass_ctrl is False

    def test_active_voting_with_tally(self, agent, simulator, scene):
        scene.state = {
            "voting_started": True,
            "vote_title": "Motion",
            "votes": {"Alice": "yes", "Bob": "no"},
        }
        success, result, summary, meta, pass_ctrl = VotingStatusAction().handle(
            {}, agent, simulator, scene
        )
        assert success is True
        assert result["started"] is True
        assert result["yes"] == 1
        assert result["no"] == 1
        assert result["pending"] == 0

    def test_pending_names_shown(self, agent, simulator, scene):
        scene.state = {
            "voting_started": True,
            "vote_title": "Motion",
            "votes": {"Alice": "yes"},
        }
        _, result, _, _, _ = VotingStatusAction().handle(
            {}, agent, simulator, scene
        )
        assert "Bob" in result["pending_names"]
        assert result["pending"] == 1

    def test_all_voted_no_pending(self, agent, simulator, scene):
        scene.state = {
            "voting_started": True,
            "vote_title": "Motion",
            "votes": {"Alice": "yes", "Bob": "no"},
        }
        _, result, _, _, _ = VotingStatusAction().handle(
            {}, agent, simulator, scene
        )
        assert result["pending_names"] == []
        assert result["pending"] == 0


# --- RequestBriefAction -----------------------------------------------------

class TestRequestBriefAction:

    def test_happy_path_llm(self, agent, simulator, scene):
        success, result, summary, meta, pass_ctrl = RequestBriefAction().handle(
            {"desc": "climate policy"}, agent, simulator, scene
        )
        assert success is True
        assert result["desc"] == "climate policy"
        assert result["source"] == "llm"
        assert pass_ctrl is False
        agent.add_env_feedback.assert_called_once()

    def test_fallback_when_llm_empty(self, agent, simulator, scene):
        agent.call_llm.return_value = ""
        success, result, _, _, _ = RequestBriefAction().handle(
            {"desc": "test"}, agent, simulator, scene
        )
        assert result["source"] == "fallback"
        assert "test" in result["material"]

    def test_fallback_when_llm_whitespace(self, agent, simulator, scene):
        agent.call_llm.return_value = "   \n  "
        _, result, _, _, _ = RequestBriefAction().handle(
            {"desc": "x"}, agent, simulator, scene
        )
        assert result["source"] == "fallback"


# --- VoteAction -------------------------------------------------------------

class TestVoteAction:

    def test_happy_path(self, agent, simulator, scene):
        scene.state = {"voting_started": True, "vote_title": "Motion", "votes": {}}
        success, result, summary, meta, pass_ctrl = VoteAction().handle(
            {"vote": "yes"}, agent, simulator, scene
        )
        assert success is True
        assert result["vote"] == "yes"
        assert scene.state["votes"]["Alice"] == "yes"
        scene.deliver_message.assert_called_once()

    def test_duplicate_vote_rejected(self, agent, simulator, scene):
        scene.state = {"voting_started": True, "vote_title": "Motion", "votes": {"Alice": "yes"}}
        success, result, _, _, _ = VoteAction().handle(
            {"vote": "no"}, agent, simulator, scene
        )
        assert success is False
        assert "error" in result

    def test_auto_conclude_majority_yes(self, agent, simulator, scene):
        scene.state = {
            "voting_started": True,
            "vote_title": "Motion",
            "votes": {"Bob": "yes"},
        }
        success, _, _, _, _ = VoteAction().handle(
            {"vote": "yes"}, agent, simulator, scene
        )
        # Both voted yes → auto-conclude
        assert scene.state["voting_started"] is False
        assert scene.state["voting_completed_announced"] is True
        assert scene.state["votes"] == {}
        assert len(scene.state.get("past_votes", [])) == 1
        simulator.broadcast.assert_called()

    def test_auto_conclude_majority_no(self, agent, simulator, scene):
        scene.state = {
            "voting_started": True,
            "vote_title": "Motion",
            "votes": {"Bob": "no"},
        }
        VoteAction().handle({"vote": "no"}, agent, simulator, scene)
        assert scene.state["voting_started"] is False
        past = scene.state.get("past_votes", [])
        assert len(past) == 1

    def test_with_comment(self, agent, simulator, scene):
        scene.state = {"voting_started": True, "vote_title": "Motion", "votes": {}}
        VoteAction().handle(
            {"vote": "abstain", "comment": "need more info"}, agent, simulator, scene
        )
        event = scene.deliver_message.call_args[0][0]
        assert "need more info" in event.message

    def test_no_conclude_when_already_announced(self, agent, simulator, scene):
        scene.state = {
            "voting_started": True,
            "vote_title": "Motion",
            "votes": {"Bob": "yes"},
            "voting_completed_announced": True,
        }
        VoteAction().handle({"vote": "yes"}, agent, simulator, scene)
        # Should NOT auto-conclude again
        assert simulator.broadcast.call_count == 0

    def test_facilitator_phase_reset_on_conclude(self, agent, simulator, scene):
        fac = MagicMock()
        fac.phase = _FakePhase.VOTING
        scene.facilitator = fac
        scene.state = {
            "voting_started": True,
            "vote_title": "Motion",
            "votes": {"Bob": "yes"},
        }
        VoteAction().handle({"vote": "yes"}, agent, simulator, scene)
        assert fac.phase == _FakePhase.DISCUSSION


# --- FinishMeetingAction ----------------------------------------------------

class TestFinishMeetingAction:

    def test_happy_path(self, agent, simulator, scene):
        success, result, summary, meta, pass_ctrl = FinishMeetingAction().handle(
            {}, agent, simulator, scene
        )
        assert success is True
        assert pass_ctrl is True
        assert scene.complete is True
        simulator.broadcast.assert_called_once()

    def test_updates_facilitator(self, agent, simulator, scene):
        fac = MagicMock()
        fac.phase = _FakePhase.DISCUSSION
        scene.facilitator = fac
        FinishMeetingAction().handle({}, agent, simulator, scene)
        assert fac.phase == _FakePhase.CONCLUDED

    def test_no_facilitator_ok(self, agent, simulator, scene):
        FinishMeetingAction().handle({}, agent, simulator, scene)
        assert scene.complete is True
