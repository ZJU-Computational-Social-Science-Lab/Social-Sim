"""
Unit tests for phase_controller.py deliberation round tracking.

Tests the automatic phase transition feature where SystemFacilitator
tracks deliberation rounds and transitions to voting after N rounds.
"""

import pytest
from unittest.mock import MagicMock, patch
from socialsim4.core.phase_controller import SystemFacilitator, CouncilPhase


class TestDeliberationRoundTracking:
    """Tests for deliberation round tracking and automatic voting transition."""

    def test_set_deliberation_rounds_valid(self):
        """Test setting deliberation rounds with valid values."""
        # Create mock scene with state
        mock_scene = MagicMock()
        mock_scene.state = MagicMock()
        mock_scene.state.extensions = {}

        facilitator = SystemFacilitator(scene=mock_scene)

        # Test setting to None (agent-controlled voting)
        facilitator.set_deliberation_rounds(None)
        assert facilitator._deliberation_rounds is None

        # Test setting to 0 (immediate voting)
        facilitator.set_deliberation_rounds(0)
        assert facilitator._deliberation_rounds == 0

        # Test setting to positive values
        facilitator.set_deliberation_rounds(2)
        assert facilitator._deliberation_rounds == 2

        facilitator.set_deliberation_rounds(5)
        assert facilitator._deliberation_rounds == 5

    def test_set_deliberation_rounds_invalid(self):
        """Test that negative deliberation rounds raises ValueError."""
        mock_scene = MagicMock()
        mock_scene.state = MagicMock()
        mock_scene.state.extensions = {}

        facilitator = SystemFacilitator(scene=mock_scene)

        with pytest.raises(ValueError, match="deliberation_rounds must be >= 0"):
            facilitator.set_deliberation_rounds(-1)

    def test_deliberation_rounds_transition(self):
        """Test automatic transition to voting after deliberation rounds.

        This is the core test from the plan:
        1. Creates SystemFacilitator with deliberation_rounds=2
        2. Calls check_and_transition_phase(round_num=2) - should NOT transition yet
        3. Calls check_and_transition_phase(round_num=3) - SHOULD transition to VOTING
        4. Verifies phase changed from DISCUSSION to VOTING
        5. Verifies voting_started=True in scene state
        6. Verifies system broadcast occurred
        """
        # Create mock scene with state
        mock_scene = MagicMock()
        mock_scene.state = MagicMock()
        mock_scene.state.extensions = {
            "proposal_text": "Test Proposal"
        }

        # Create mock simulator for broadcast
        mock_simulator = MagicMock()

        facilitator = SystemFacilitator(scene=mock_scene, simulator=mock_simulator)
        facilitator.set_deliberation_rounds(2)

        # Initially should be in DISCUSSION phase
        assert facilitator.phase == CouncilPhase.DISCUSSION

        # Round 1: Should NOT transition (1 <= 2)
        transitioned = facilitator.check_and_transition_phase(round_num=1)
        assert transitioned is False
        assert facilitator.phase == CouncilPhase.DISCUSSION

        # Round 2: Should NOT transition (2 <= 2)
        transitioned = facilitator.check_and_transition_phase(round_num=2)
        assert transitioned is False
        assert facilitator.phase == CouncilPhase.DISCUSSION

        # Round 3: SHOULD transition (3 > 2)
        transitioned = facilitator.check_and_transition_phase(round_num=3)
        assert transitioned is True
        assert facilitator.phase == CouncilPhase.VOTING

        # Verify state was updated
        assert mock_scene.state.extensions["voting_started"] is True
        assert "vote_title" in mock_scene.state.extensions

        # Verify broadcast was called
        assert mock_simulator.broadcast.called

    def test_no_transition_when_deliberation_rounds_none(self):
        """Test that no automatic transition occurs when deliberation_rounds is None.

        When deliberation_rounds=None (default), agents control voting via start_voting action.
        """
        mock_scene = MagicMock()
        mock_scene.state = MagicMock()
        mock_scene.state.extensions = {}

        mock_simulator = MagicMock()

        facilitator = SystemFacilitator(scene=mock_scene, simulator=mock_simulator)
        # deliberation_rounds defaults to None
        assert facilitator._deliberation_rounds is None

        # Even after many rounds, should NOT auto-transition
        for round_num in range(1, 10):
            transitioned = facilitator.check_and_transition_phase(round_num=round_num)
            assert transitioned is False
            assert facilitator.phase == CouncilPhase.DISCUSSION

    def test_immediate_voting_when_deliberation_rounds_zero(self):
        """Test that deliberation_rounds=0 causes immediate voting.

        When deliberation_rounds=0, the first check (round 1 > 0) should trigger voting.
        """
        mock_scene = MagicMock()
        mock_scene.state = MagicMock()
        mock_scene.state.extensions = {}

        mock_simulator = MagicMock()

        facilitator = SystemFacilitator(scene=mock_scene, simulator=mock_simulator)
        facilitator.set_deliberation_rounds(0)

        # Round 1: SHOULD transition immediately (1 > 0)
        transitioned = facilitator.check_and_transition_phase(round_num=1)
        assert transitioned is True
        assert facilitator.phase == CouncilPhase.VOTING
        assert mock_scene.state.extensions["voting_started"] is True

    def test_no_transition_when_already_in_voting_phase(self):
        """Test that check_and_transition_phase does nothing if already in VOTING phase."""
        mock_scene = MagicMock()
        mock_scene.state = MagicMock()
        mock_scene.state.extensions = {}

        mock_simulator = MagicMock()

        facilitator = SystemFacilitator(scene=mock_scene, simulator=mock_simulator)
        facilitator.set_deliberation_rounds(2)

        # Manually transition to voting first
        facilitator.transition_to_voting("Test Proposal")
        assert facilitator.phase == CouncilPhase.VOTING

        # Reset mock to check it's not called again
        mock_simulator.broadcast.reset_mock()

        # Should not transition again
        transitioned = facilitator.check_and_transition_phase(round_num=3)
        assert transitioned is False
        # Broadcast should not have been called again
        assert not mock_simulator.broadcast.called

    def test_no_transition_when_in_concluded_phase(self):
        """Test that check_and_transition_phase does nothing if in CONCLUDED phase."""
        mock_scene = MagicMock()
        mock_scene.state = MagicMock()
        mock_scene.state.extensions = {}

        mock_simulator = MagicMock()

        facilitator = SystemFacilitator(scene=mock_scene, simulator=mock_simulator)
        facilitator.set_deliberation_rounds(2)

        # Manually conclude
        facilitator.conclude_meeting()
        assert facilitator.phase == CouncilPhase.CONCLUDED

        # Should not transition
        transitioned = facilitator.check_and_transition_phase(round_num=3)
        assert transitioned is False


class TestSystemFacilitatorInit:
    """Tests for SystemFacilitator initialization."""

    def test_default_deliberation_rounds_is_none(self):
        """Test that _deliberation_rounds defaults to None for backward compatibility."""
        mock_scene = MagicMock()
        mock_scene.state = MagicMock()
        mock_scene.state.extensions = {}

        facilitator = SystemFacilitator(scene=mock_scene)

        # Should be None by default (agent-controlled voting)
        assert facilitator._deliberation_rounds is None
