"""Debug script to test payoff calculation."""
import sys
import os

# Add src directory to path
script_dir = os.path.dirname(os.path.abspath(__file__))
src_dir = os.path.join(script_dir, "src")
sys.path.insert(0, src_dir)

from dataclasses import dataclass
from socialsim4.core.experiment.payoff.engine import PayoffEngine
from socialsim4.core.experiment.state import ExperimentState, AgentState


@dataclass
class MockAction:
    """Mock action for testing."""
    agent_name: str
    action_name: str
    parameters: dict
    skipped: bool = False


def test_payoff():
    """Test the payoff calculation."""
    engine = PayoffEngine()

    # Create actions matching the debug log
    actions = [
        MockAction("Test 1", "contribute", {"amount": 5, "pool": 10}),
        MockAction("Test 2", "contribute", {"amount": 5, "pool": 10}),
        MockAction("Test 3", "contribute", {"amount": 5, "pool": 10}),
    ]

    # Config from the debug log
    config = {
        "multiplier": 1.5,
        "initial_tokens": 10,
    }

    # Create state with agent token balances
    state = ExperimentState(
        agents={
            "Test 1": AgentState(resources={"tokens": 10}),
            "Test 2": AgentState(resources={"tokens": 10}),
            "Test 3": AgentState(resources={"tokens": 10}),
        }
    )

    # Calculate payoffs
    result = engine.calculate_round_payoffs(
        payoff_type="pool",
        actions=actions,
        config=config,
        grouping_mode="group",
        state=state,
    )

    print("=" * 50)
    print("PAYOFF CALCULATION DEBUG")
    print("=" * 50)
    print(f"Config: {config}")
    print(f"Actions: {[a.action_name for a in actions]}")
    print(f"Amounts: {[a.parameters.get('amount') for a in actions]}")
    print()
    print("Expected calculation:")
    print(f"  Total contribution = 5 + 5 + 5 = 15")
    print(f"  Pool return = 15 * 1.5 / 3 = 7.5")
    print(f"  Each payoff = (10 - 5) + 7.5 = 12.5")
    print()
    print(f"Actual result: {result}")
    print()

    # Check if correct
    expected = {"Test 1": 12.5, "Test 2": 12.5, "Test 3": 12.5}
    if result == expected:
        print("✓ PASS - Payoff calculation is correct!")
    else:
        print("✗ FAIL - Payoff calculation is wrong!")
        print(f"  Expected: {expected}")
        print(f"  Got: {result}")


if __name__ == "__main__":
    test_payoff()
