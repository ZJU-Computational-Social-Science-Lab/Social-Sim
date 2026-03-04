"""
Tests for PayoffEngine - generic payoff calculation.

Tests all payoff types: matrix (pairwise/group), pool, feedback, none.
"""

import pytest
from socialsim4.core.experiment.payoff.engine import PayoffEngine
from socialsim4.core.experiment.controller import ActionResult


class TestPayoffEngine:
    """Test PayoffEngine class."""

    @pytest.fixture
    def engine(self):
        return PayoffEngine()

    @pytest.fixture
    def pd_actions(self):
        """Simple PD actions for two agents."""
        return [
            ActionResult(
                agent_name="Alice",
                action_name="cooperate",
                parameters={},
                summary="Alice chose cooperate",
                success=True,
                skipped=False,
                round_num=1,
            ),
            ActionResult(
                agent_name="Bob",
                action_name="defect",
                parameters={},
                summary="Bob chose defect",
                success=True,
                skipped=False,
                round_num=1,
            ),
        ]

    def test_payoff_engine_exists(self, engine):
        """PayoffEngine can be instantiated."""
        assert engine is not None

    def test_payoff_type_none_returns_empty(self, engine, pd_actions):
        """payoff_type 'none' returns empty dict."""
        result = engine.calculate_round_payoffs(
            payoff_type="none",
            actions=pd_actions,
            config={},
            grouping_mode="pairwise",
        )
        assert result == {}

    def test_payoff_type_feedback_returns_empty(self, engine, pd_actions):
        """payoff_type 'feedback' returns empty dict (no numerical payoffs)."""
        result = engine.calculate_round_payoffs(
            payoff_type="feedback",
            actions=pd_actions,
            config={},
            grouping_mode="neighbor",
        )
        assert result == {}
