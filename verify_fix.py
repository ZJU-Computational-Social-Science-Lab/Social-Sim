"""
Manual verification script for score display fix.
Tests the logic without requiring pytest to be installed.
"""
import sys
sys.path.insert(0, 'src')

from socialsim4.core.experiment.round_context import RoundContextManager
from socialsim4.core.experiment.information_model import InformationModel


def test_score_hidden_when_include_scores_false():
    """Test that 'My score: 0' does not appear when include_scores=False."""
    print("\n=== Test 1: Score hidden when include_scores=False ===")

    # Create an InformationModel with include_scores=False (coordination game)
    info_model = InformationModel(
        scope_type="all",
        include_scores=False,
        recent_window=3,
    )

    # Create context manager with this model
    context_manager = RoundContextManager(
        information_model=info_model,
        all_agent_names=["Alice", "Bob"],
    )

    # Record some events
    context_manager.record_action(
        agent_name="Alice",
        action_name="coordinate",
        parameters={},
        round_num=1,
        summary="Alice coordinated",
        observed_by=["Alice", "Bob"],
        payoff=0,
    )

    context_manager.record_action(
        agent_name="Bob",
        action_name="coordinate",
        parameters={},
        round_num=1,
        summary="Bob coordinated",
        observed_by=["Alice", "Bob"],
        payoff=0,
    )

    # Get context for Alice with agent_score=0
    context = context_manager.get_context_for_agent("Alice", agent_score=0)

    print(f"Context:\n{context}\n")

    # Verify "My score" does NOT appear
    if "My score" in context:
        print("❌ FAIL: Score appears when include_scores=False")
        print(f"   Found 'My score' in: {context}")
        return False
    else:
        print("✅ PASS: Score is hidden when include_scores=False")
        return True


def test_score_shown_when_include_scores_true():
    """Test that 'My score' DOES appear when include_scores=True (default)."""
    print("\n=== Test 2: Score shown when include_scores=True ===")

    # Create an InformationModel with include_scores=True (default)
    info_model = InformationModel(
        scope_type="all",
        include_scores=True,
        recent_window=3,
    )

    # Create context manager with this model
    context_manager = RoundContextManager(
        information_model=info_model,
        all_agent_names=["Alice", "Bob"],
    )

    # Record some events
    context_manager.record_action(
        agent_name="Alice",
        action_name="choose",
        parameters={},
        round_num=1,
        summary="Alice chose",
        observed_by=["Alice", "Bob"],
        payoff=5,
    )

    # Get context for Alice with agent_score=10
    context = context_manager.get_context_for_agent("Alice", agent_score=10)

    print(f"Context:\n{context}\n")

    # Verify "My score: 10" DOES appear
    if "My score: 10" in context:
        print("✅ PASS: Score is shown when include_scores=True")
        return True
    else:
        print("❌ FAIL: Score does not appear when include_scores=True")
        print(f"   Expected 'My score: 10' in: {context}")
        return False


def test_score_hidden_when_agent_score_is_none():
    """Test that score is hidden when agent_score=None regardless of include_scores."""
    print("\n=== Test 3: Score hidden when agent_score=None ===")

    # Create an InformationModel with include_scores=True
    info_model = InformationModel(
        scope_type="all",
        include_scores=True,
        recent_window=3,
    )

    # Create context manager with this model
    context_manager = RoundContextManager(
        information_model=info_model,
        all_agent_names=["Alice"],
    )

    # Record an event
    context_manager.record_action(
        agent_name="Alice",
        action_name="act",
        parameters={},
        round_num=1,
        summary="Alice acted",
        observed_by=["Alice"],
        payoff=5,
    )

    # Get context for Alice with agent_score=None
    context = context_manager.get_context_for_agent("Alice", agent_score=None)

    print(f"Context:\n{context}\n")

    # Verify "My score" does NOT appear
    if "My score" in context:
        print("❌ FAIL: Score appears when agent_score=None")
        print(f"   Found 'My score' in: {context}")
        return False
    else:
        print("✅ PASS: Score is hidden when agent_score=None")
        return True


if __name__ == "__main__":
    print("Running manual verification of score display fix...")

    results = [
        test_score_hidden_when_include_scores_false(),
        test_score_shown_when_include_scores_true(),
        test_score_hidden_when_agent_score_is_none(),
    ]

    print("\n" + "=" * 50)
    print(f"Results: {sum(results)}/{len(results)} tests passed")

    if all(results):
        print("✅ All tests passed!")
        sys.exit(0)
    else:
        print("❌ Some tests failed!")
        sys.exit(1)
