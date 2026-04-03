"""
Manual verification script for coordination game fixes.
Tests all three fixes without requiring pytest.
"""
import sys
sys.path.insert(0, 'src')

from socialsim4.core.experiment.round_context import RoundContextManager
from socialsim4.core.experiment.information_model import InformationModel


def test_fix_1_visibility_filtering():
    """Fix 1: Context shows only neighbors (not all agents)."""
    print("\n=== Fix 1: Visibility Filtering ===")

    # Create information model with neighbor scope
    info_model = InformationModel(
        scope_type="neighbor",
        include_scores=False,
        recent_window=5,
    )

    # Create context manager
    context_manager = RoundContextManager(
        information_model=info_model,
        all_agent_names=["NodeA", "NodeB", "NodeC"],
    )

    # Set up a graph: A-B, B-C (no edge A-C)
    graph = {"edges": [("NodeA", "NodeB"), ("NodeB", "NodeC")]}

    # Record actions for round 1
    context_manager.record_action(
        agent_name="NodeA",
        action_name="choose_color",
        parameters={"color": "red"},
        round_num=1,
        summary="NodeA chose red",
        observed_by=["NodeA", "NodeB"],  # Only B can see A
        payoff=0,
    )

    context_manager.record_action(
        agent_name="NodeB",
        action_name="choose_color",
        parameters={"color": "blue"},
        round_num=1,
        summary="NodeB chose blue",
        observed_by=["NodeA", "NodeB", "NodeC"],  # A and C can see B
        payoff=0,
    )

    context_manager.record_action(
        agent_name="NodeC",
        action_name="choose_color",
        parameters={"color": "green"},
        round_num=1,
        summary="NodeC chose green",
        observed_by=["NodeB", "NodeC"],  # Only B can see C
        payoff=0,
    )

    # Get context for NodeA - should see only NodeB's action (neighbor), not NodeC
    context_a = context_manager.get_context_for_agent(
        "NodeA",
        agent_score=None,
        graph=graph
    )

    print(f"Context for NodeA:\n{context_a}\n")

    # NodeA should see NodeB's action (neighbor)
    has_nodeb = "NodeB" in context_a
    # NodeA should NOT see NodeC's action (not a neighbor)
    has_nodec = "NodeC" in context_a

    if has_nodeb and not has_nodec:
        print("✅ PASS: NodeA sees only neighbor NodeB, not NodeC")
        return True
    else:
        print(f"❌ FAIL: NodeA should see NodeB but not NodeC")
        print(f"   Has NodeB: {has_nodeb}, Has NodeC: {has_nodec}")
        return False


def test_fix_2_no_score_display():
    """Fix 2: No 'My score' line appears when include_scores=False."""
    print("\n=== Fix 2: No Score Display ===")

    # Create information model WITHOUT scores
    info_model = InformationModel(
        scope_type="neighbor",
        include_scores=False,  # This is the key setting
        recent_window=3,
    )

    # Create context manager
    context_manager = RoundContextManager(
        information_model=info_model,
        all_agent_names=["Node1", "Node2"],
    )

    # Record some actions
    context_manager.record_action(
        agent_name="Node1",
        action_name="coordinate",
        parameters={"color": "red"},
        round_num=1,
        summary="Node1 chose red",
        observed_by=["Node1", "Node2"],
        payoff=0,
    )

    context_manager.record_action(
        agent_name="Node2",
        action_name="coordinate",
        parameters={"color": "blue"},
        round_num=1,
        summary="Node2 chose blue",
        observed_by=["Node1", "Node2"],
        payoff=0,
    )

    # Get context for Node1 with agent_score=0
    graph = {"edges": [("Node1", "Node2")]}
    context = context_manager.get_context_for_agent(
        "Node1",
        agent_score=0,
        graph=graph
    )

    print(f"Context for Node1:\n{context}\n")

    # Verify "My score" does NOT appear
    if "My score" in context:
        print("❌ FAIL: Score appears when include_scores=False")
        print(f"   Found 'My score' in context")
        return False
    else:
        print("✅ PASS: No score displayed when include_scores=False")
        return True


def test_fix_3_debug_log_format():
    """Fix 3: Debug log has sequential format (not nested)."""
    print("\n=== Fix 3: Debug Log Format ===")

    # Read the latest debug log
    import glob
    from pathlib import Path

    log_dir = Path("test_results")
    log_files = sorted(log_dir.glob("experiment_debug_*.txt"))

    if not log_files:
        print("⚠️  SKIP: No debug log files found")
        return None

    latest_log = log_files[-1]
    print(f"Checking latest log: {latest_log}")

    with open(latest_log, 'r', encoding='utf-8') as f:
        content = f.read()

    # Check for sequential format markers
    has_agent_header = "## AGENT:" in content
    has_round_header = "## ROUND:" in content
    has_sections = "---" in content and "===" in content

    # Check for sequential agent entries (not nested)
    lines = content.split('\n')
    agent_count = sum(1 for line in lines if line.startswith("## AGENT:"))

    print(f"  Has agent headers: {has_agent_header}")
    print(f"  Has round headers: {has_round_header}")
    print(f"  Has section markers: {has_sections}")
    print(f"  Agent entries found: {agent_count}")

    if has_agent_header and has_round_header and has_sections and agent_count > 0:
        print("✅ PASS: Debug log has sequential format")
        return True
    else:
        print("❌ FAIL: Debug log format is incorrect")
        return False


def main():
    """Run all verification tests."""
    print("=" * 60)
    print("MANUAL VERIFICATION OF COORDINATION GAME FIXES")
    print("=" * 60)

    results = []

    # Test Fix 1: Visibility Filtering
    try:
        results.append(("Fix 1: Visibility Filtering", test_fix_1_visibility_filtering()))
    except Exception as e:
        print(f"❌ ERROR in Fix 1: {e}")
        results.append(("Fix 1: Visibility Filtering", False))

    # Test Fix 2: No Score Display
    try:
        results.append(("Fix 2: No Score Display", test_fix_2_no_score_display()))
    except Exception as e:
        print(f"❌ ERROR in Fix 2: {e}")
        results.append(("Fix 2: No Score Display", False))

    # Test Fix 3: Debug Log Format
    try:
        result = test_fix_3_debug_log_format()
        if result is not None:
            results.append(("Fix 3: Debug Log Format", result))
    except Exception as e:
        print(f"❌ ERROR in Fix 3: {e}")
        results.append(("Fix 3: Debug Log Format", False))

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {name}")

    print(f"\nTotal: {passed}/{total} tests passed")

    if passed == total:
        print("\n✅ ALL FIXES VERIFIED!")
        return 0
    else:
        print("\n❌ SOME FIXES FAILED!")
        return 1


if __name__ == "__main__":
    sys.exit(main())
