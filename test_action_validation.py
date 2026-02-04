"""
Manual test script for ActionController validation.
Run this to verify action constraints are working correctly.
"""

from socialsim4.scenarios.basic import build_council_sim
from socialsim4.core.agent import Agent
from socialsim4.core.action_controller import ActionController
from socialsim4.core.actions.council_actions import (
    StartVotingAction,
    VoteAction,
    FinishMeetingAction,
    RequestBriefAction,
)


def print_debug_info(sim):
    """Print debug info about the simulation for platform testing."""
    print("\n" + "=" * 60)
    print("SIMULATION DEBUG INFO")
    print("=" * 60)

    # Scene info
    print(f"\nScene Type: {type(sim.scene).__name__}")
    print(f"Has ActionController: {hasattr(sim.scene, 'action_controller')}")

    # Agents
    print(f"\nAgents ({len(sim.agents)}):")
    for name, agent in sim.agents.items():
        print(f"  - {name}")
        print(f"    Action Space: {[a.NAME for a in agent.action_space]}")

    # Initial scene state
    print(f"\nInitial Scene State: {sim.scene.state}")

    # Test a few validations and print results
    controller = sim.scene.action_controller
    host = sim.agents["Host"]
    member = list(sim.agents.values())[1]  # First non-host

    print(f"\n" + "-" * 40)
    print("VALIDATION TEST RESULTS:")
    print("-" * 40)

    test_cases = [
        ("start_voting", {"title": "Test Vote"}, host, "Host starting vote"),
        ("start_voting", {"title": "Test Vote"}, member, "Member starting vote"),
        ("vote", {"vote": "yes"}, host, "Host voting"),
        ("vote", {"vote": "yes"}, member, "Member voting (before vote started)"),
        ("finish_meeting", {}, host, "Host finishing meeting"),
        ("finish_meeting", {}, member, "Member finishing meeting"),
        ("request_brief", {"desc": "test"}, host, "Host requesting brief"),
        ("request_brief", {"desc": "test"}, member, "Member requesting brief"),
    ]

    for action_name, action_data, agent, description in test_cases:
        # Find action instance
        action_instance = None
        for act in agent.action_space:
            if act.NAME == action_name:
                action_instance = act
                break

        if action_instance:
            allowed, error = controller.validate_action(
                action_name, action_data, agent, sim.scene.state, action_instance
            )
            status = "[OK] ALLOWED" if allowed else "[BLOCKED] BLOCKED"
            print(f"\n{description}:")
            print(f"  Result: {status}")
            if error:
                print(f"  Reason: {error}")
        else:
            print(f"\n{description}:")
            print(f"  Result: ? ACTION NOT FOUND")

    print("\n" + "=" * 60)


def test_action_constraints():
    """Test that action constraints work as expected."""
    print("=" * 60)
    print("Testing ActionController Constraints")
    print("=" * 60)

    controller = ActionController()
    host = Agent("Host", "profile", "style", [], {})
    member = Agent("Rep. Chen", "profile", "style", [], {})

    # Test 1: Host-only actions (with proper action_data)
    print("\n[Test 1] Host-only actions (start_voting, request_brief, finish_meeting)")
    test_actions = [
        (StartVotingAction, {"title": "Test Vote"}),
        (RequestBriefAction, {"desc": "Test brief"}),
        (FinishMeetingAction, {}),
    ]
    for action_class, action_data in test_actions:
        action = action_class()
        allowed, _ = controller.validate_action(action_class.NAME, action_data, host, {}, action)
        print(f"  {action_class.NAME}: Host allowed = {allowed}")
        assert allowed, f"Host should be allowed for {action_class.NAME}"

    print("  [OK] Host can execute Host-only actions")

    # Test 2: Non-Host rejected for Host-only actions
    print("\n[Test 2] Non-Host agents rejected from Host-only actions")
    for action_class, action_data in test_actions:
        action = action_class()
        allowed, error = controller.validate_action(action_class.NAME, action_data, member, {}, action)
        print(f"  {action_class.NAME}: Member allowed = {allowed}")
        assert not allowed, f"Member should NOT be allowed for {action_class.NAME}"

    print("  [OK] Non-Host agents blocked from Host-only actions")

    # Test 3: Vote action excludes Host
    print("\n[Test 3] VoteAction excludes Host, allows members")
    vote_action = VoteAction()
    state_voting_active = {"voting_started": True}

    allowed, _ = controller.validate_action("vote", {"vote": "yes"}, host, state_voting_active, vote_action)
    print(f"  Host can vote: {allowed}")
    assert not allowed, "Host should NOT be allowed to vote"

    allowed, _ = controller.validate_action("vote", {"vote": "yes"}, member, state_voting_active, vote_action)
    print(f"  Member can vote: {allowed}")
    assert allowed, "Member should be allowed to vote"

    print("  [OK] VoteAction correctly excludes Host")

    # Test 4: State guards
    print("\n[Test 4] State guards block invalid states")

    # Vote requires voting started
    vote_action = VoteAction()
    state_voting_inactive = {"voting_started": False}
    allowed, error = controller.validate_action("vote", {"vote": "yes"}, member, state_voting_inactive, vote_action)
    print(f"  Vote blocked when not started: {not allowed}")
    assert not allowed, "Vote should be blocked when voting not started"
    assert "not started" in error.lower()

    # Finish meeting blocked during voting
    finish_action = FinishMeetingAction()
    state_voting_active = {"voting_started": True}
    allowed, error = controller.validate_action("finish_meeting", {}, host, state_voting_active, finish_action)
    print(f"  Finish blocked during voting: {not allowed}")
    assert not allowed, "Finish meeting should be blocked during voting"
    assert "voting is still in progress" in error.lower()

    # Start voting blocked when already started
    start_action = StartVotingAction()
    state_voting_active = {"voting_started": True}
    allowed, error = controller.validate_action("start_voting", {"title": "Budget"}, host, state_voting_active, start_action)
    print(f"  Start voting blocked when already active: {not allowed}")
    assert not allowed, "Start voting should be blocked when already active"
    assert "already in progress" in error.lower()

    print("  [OK] State guards working correctly")

    # Test 5: Parameter validation
    print("\n[Test 5] Parameter validators reject invalid input")

    # Empty title rejected
    start_action = StartVotingAction()
    allowed, error = controller.validate_action("start_voting", {"title": "   "}, host, {}, start_action)
    print(f"  Empty title rejected: {not allowed}")
    assert not allowed, "Empty title should be rejected"

    # Invalid vote value rejected
    vote_action = VoteAction()
    allowed, error = controller.validate_action("vote", {"vote": "maybe"}, member, {"voting_started": True}, vote_action)
    print(f"  Invalid vote value rejected: {not allowed}")
    assert not allowed, "Invalid vote value should be rejected"

    print("  [OK] Parameter validation working correctly")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED [OK]")
    print("=" * 60)


def test_scene_integration():
    """Test that Scene properly integrates ActionController."""
    print("\n" + "=" * 60)
    print("Testing Scene Integration")
    print("=" * 60)

    sim = build_council_sim()

    # Verify ActionController exists on scene
    assert hasattr(sim.scene, 'action_controller'), "Scene should have action_controller"
    print("  [OK] Scene has ActionController")

    # Verify we can access the controller
    controller = sim.scene.action_controller
    assert controller is not None
    print("  [OK] ActionController is accessible")

    # Get Host agent
    host = sim.agents["Host"]
    member = sim.agents["Rep. Chen Wei"]

    # Test validation through the scene
    start_voting = StartVotingAction()

    # Host should be allowed
    allowed, _ = controller.validate_action("start_voting", {"title": "Test"}, host, sim.scene.state, start_voting)
    assert allowed, "Host should be allowed to start voting"
    print("  [OK] Scene controller allows Host to start voting")

    # Member should NOT be allowed
    allowed, error = controller.validate_action("start_voting", {"title": "Test"}, member, sim.scene.state, start_voting)
    assert not allowed, "Member should NOT be allowed to start voting"
    print("  [OK] Scene controller blocks Member from starting voting")

    print("\n" + "=" * 60)
    print("SCENE INTEGRATION TESTS PASSED [OK]")
    print("=" * 60)


if __name__ == "__main__":
    # First, print debug info for manual inspection
    sim = build_council_sim()
    print_debug_info(sim)

    # Then run automated tests
    print("\n")
    test_action_constraints()
    test_scene_integration()
    print("\n[SUCCESS] All manual tests passed! Ready to push.")
