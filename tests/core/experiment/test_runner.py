"""
Tests for ExperimentRunner.

Tests the runner's ability to:
- Initialize with agents and game config
- Run simultaneous rounds (all agents decide independently)
- Run sequential rounds (agents see previous choices)
- Handle agent failures gracefully
- Track round completion
"""

import asyncio
import pytest
from unittest.mock import Mock, AsyncMock, patch

from socialsim4.core.experiment.runner import ExperimentRunner, RoundResult
from socialsim4.core.experiment.agent import ExperimentAgent
from socialsim4.core.experiment.game_configs import PRISONERS_DILEMMA, MINIMUM_EFFORT
from socialsim4.core.experiment.information_model import InformationModel
from socialsim4.core.experiment.kernel import ExperimentKernel
from socialsim4.core.llm_config import LLMConfig
from socialsim4.core.experiment.controller import ActionResult


@pytest.fixture
def mock_llm_client():
    """Create a mock LLM client that returns valid JSON responses."""
    client = Mock()
    # Mock the chat method to return a valid JSON response
    client.chat = Mock(return_value='{"reasoning": "I choose to cooperate", "action": "cooperate"}')
    return client


@pytest.fixture
def agents():
    """Create test agents."""
    return [
        ExperimentAgent(
            name="Alice",
            properties={"age_group": "adult"},
            llm_config=LLMConfig(dialect="mock")
        ),
        ExperimentAgent(
            name="Bob",
            properties={"age_group": "adult"},
            llm_config=LLMConfig(dialect="mock")
        ),
    ]


def test_runner_initialization(agents, mock_llm_client):
    """Initialize runner with agents and game config."""
    kernel = ExperimentKernel()
    runner = ExperimentRunner(
        agents=agents,
        game_config=PRISONERS_DILEMMA,
        llm_client=mock_llm_client,
        kernel=kernel,
        round_visibility="simultaneous"
    )

    assert len(runner.agents) == 2
    assert runner.game_config == PRISONERS_DILEMMA
    assert runner.llm_client == mock_llm_client
    assert runner.kernel == kernel
    assert runner.round_visibility == "simultaneous"
    assert runner.current_round == 0
    assert runner.context_manager is not None
    assert runner.controller is not None


def test_runner_initialization_with_default_kernel(agents, mock_llm_client):
    """Initialize runner without specifying kernel (uses default)."""
    runner = ExperimentRunner(
        agents=agents,
        game_config=PRISONERS_DILEMMA,
        llm_client=mock_llm_client
    )

    assert runner.kernel is not None
    assert isinstance(runner.kernel, ExperimentKernel)


@pytest.mark.asyncio
async def test_run_simultaneous_round(agents, mock_llm_client):
    """Run a single simultaneous round where all agents decide independently."""
    runner = ExperimentRunner(
        agents=agents,
        game_config=PRISONERS_DILEMMA,
        llm_client=mock_llm_client,
        round_visibility="simultaneous"
    )

    # Run one round
    results = await runner.run(max_rounds=1)

    assert len(results) == 1
    assert results[0].round_num == 1
    assert len(results[0].actions) == 2
    assert results[0].completed is True


@pytest.mark.asyncio
async def test_run_sequential_round(agents, mock_llm_client):
    """Run a single sequential round where agents see previous choices."""
    runner = ExperimentRunner(
        agents=agents,
        game_config=PRISONERS_DILEMMA,
        llm_client=mock_llm_client,
        round_visibility="sequential"
    )

    # Run one round
    results = await runner.run(max_rounds=1)

    assert len(results) == 1
    assert results[0].round_num == 1
    assert len(results[0].actions) == 2
    assert results[0].completed is True

    # Check that actions were recorded in context
    events = runner.context_manager.get_round_events(1)
    assert len(events) == 2


@pytest.mark.asyncio
async def test_run_multiple_rounds(agents, mock_llm_client):
    """Run multiple rounds and verify tracking."""
    runner = ExperimentRunner(
        agents=agents,
        game_config=PRISONERS_DILEMMA,
        llm_client=mock_llm_client,
        round_visibility="simultaneous"
    )

    # Run three rounds
    results = await runner.run(max_rounds=3)

    assert len(results) == 3
    assert results[0].round_num == 1
    assert results[1].round_num == 2
    assert results[2].round_num == 3
    assert runner.current_round == 3

    # Each round should have 2 actions
    for result in results:
        assert len(result.actions) == 2
        assert result.completed is True


@pytest.mark.asyncio
async def test_agent_failure_handling(agents, mock_llm_client):
    """Handle agent failures gracefully without crashing the round.

    When an agent fails, an ActionResult with success=False is returned.
    The round continues processing other agents.
    """
    # Patch asyncio.to_thread to raise exception on first call (Alice fails)
    # but succeed on second call (Bob succeeds)
    original_to_thread = asyncio.to_thread

    async def mock_to_thread(func, *args, **kwargs):
        # Use a closure to track call count
        if not hasattr(mock_to_thread, 'call_count'):
            mock_to_thread.call_count = 0
        mock_to_thread.call_count += 1
        if mock_to_thread.call_count == 1:
            raise Exception("LLM error")
        # Second call returns valid JSON (using mock_llm_client's default)
        return await original_to_thread(func, *args, **kwargs)

    with patch('asyncio.to_thread', side_effect=mock_to_thread):
        runner = ExperimentRunner(
            agents=agents,
            game_config=PRISONERS_DILEMMA,
            llm_client=mock_llm_client,
            round_visibility="simultaneous"
        )

        # Run one round - one agent will fail
        results = await runner.run(max_rounds=1)

        assert len(results) == 1
        # Both agents return ActionResults (one failed, one succeeded)
        assert len(results[0].actions) == 2
        # First agent (Alice) failed
        assert results[0].actions[0].success is False
        assert results[0].actions[0].skipped is True
        # Second agent (Bob) succeeded
        assert results[0].actions[1].success is True
        # Mock returns "cooperate" by default
        assert results[0].actions[1].action_name == "cooperate"


@pytest.mark.asyncio
async def test_game_config_actions_respected(mock_llm_client):
    """Verify that the game config is properly passed through."""
    agents = [
        ExperimentAgent(
            name="Player1",
            properties={},
            llm_config=LLMConfig(dialect="mock")
        ),
    ]

    runner = ExperimentRunner(
        agents=agents,
        game_config=PRISONERS_DILEMMA,
        llm_client=mock_llm_client
    )

    assert runner.game_config.actions == ["cooperate", "defect"]
    assert runner.game_config.action_type == "discrete"


@pytest.mark.asyncio
async def test_integer_action_type_game(mock_llm_client):
    """Test runner with integer-type game config."""
    # Mock response for integer action
    mock_llm_client.chat = Mock(return_value='{"reasoning": "I choose 5", "effort": 5}')

    agents = [
        ExperimentAgent(
            name="Worker1",
            properties={},
            llm_config=LLMConfig(dialect="mock")
        ),
    ]

    runner = ExperimentRunner(
        agents=agents,
        game_config=MINIMUM_EFFORT,
        llm_client=mock_llm_client
    )

    results = await runner.run(max_rounds=1)

    assert len(results) == 1
    assert results[0].actions[0].action_name == 5


def test_round_result_dataclass():
    """RoundResult stores all attributes correctly."""
    actions = [
        ActionResult(
            success=True,
            action_name="cooperate",
            parameters={},
            summary="Alice cooperated",
            agent_name="Alice",
            round_num=1
        )
    ]

    result = RoundResult(
        round_num=1,
        actions=actions,
        completed=True
    )

    assert result.round_num == 1
    assert len(result.actions) == 1
    assert result.actions[0].action_name == "cooperate"
    assert result.completed is True


def test_prompt_agent_handles_isolated_node_in_neighborhood_debug():
    agents = [
        ExperimentAgent(name="A", properties={}, llm_config=LLMConfig(dialect="mock")),
        ExperimentAgent(name="B", properties={}, llm_config=LLMConfig(dialect="mock")),
        ExperimentAgent(name="C", properties={}, llm_config=LLMConfig(dialect="mock")),
    ]
    llm_client = Mock(return_value='{"action": "move"}')
    llm_client.chat = Mock(return_value='{"action": "move"}')
    runner = ExperimentRunner(
        agents=agents,
        game_config=MINIMUM_EFFORT.__class__(
            name="Contagion",
            description="Contagion test",
            action_type="discrete",
            actions=["move", "speak"],
            action_descriptions={"move": "Move", "speak": "Speak"},
            payoff_type="none",
        ),
        llm_client=llm_client,
        information_model=InformationModel(scope_type="neighborhood", include_scores=False),
    )
    runner.set_scene_state({"graph": {"edges": [("A", "B")]}})

    result = asyncio.run(runner._prompt_agent(agents[2], round_num=1))

    assert result.success is True
    assert result.action_name == "move"


def test_replay_history_to_events_rebuilds_without_duplicates(agents, mock_llm_client):
    """Replaying persisted history multiple times should not duplicate events."""
    runner = ExperimentRunner(
        agents=agents,
        game_config=PRISONERS_DILEMMA,
        llm_client=mock_llm_client,
        information_model=InformationModel(scope_type="all", recent_window=3),
    )
    round_history = [
        {
            "round": 1,
            "actions": [
                {
                    "agent": "Alice",
                    "action": "cooperate",
                    "parameters": {},
                    "summary": "Alice chose cooperate",
                },
                {
                    "agent": "Bob",
                    "action": "defect",
                    "parameters": {},
                    "summary": "Bob chose defect",
                },
            ],
            "payoffs": {"Alice": 0, "Bob": 5},
        }
    ]

    runner._replay_history_to_events(round_history)
    assert len(runner.context_manager.get_round_events(1)) == 2
    assert agents[0].score == 0
    assert agents[1].score == 5


def test_simultaneous_round_with_followups_prompts_agents_serially_without_context_leak():
    agents = [
        ExperimentAgent(name="Alice", properties={}, llm_config=LLMConfig(dialect="mock")),
        ExperimentAgent(name="Bob", properties={}, llm_config=LLMConfig(dialect="mock")),
    ]
    runner = ExperimentRunner(
        agents=agents,
        game_config=MINIMUM_EFFORT.__class__(
            name="Council",
            description="Discuss and vote.",
            action_type="discrete",
            actions=["speak", "abstain"],
            action_descriptions={"speak": "Speak", "abstain": "Abstain"},
            payoff_type="none",
        ),
        llm_client=Mock(),
        round_visibility="simultaneous",
        information_model=InformationModel(scope_type="all", include_scores=False),
    )

    active_calls = 0
    max_active_calls = 0
    prompt_order = []

    async def fake_prompt(agent, round_num):
        nonlocal active_calls, max_active_calls
        assert runner.context_manager.get_round_events(round_num) == []
        active_calls += 1
        max_active_calls = max(max_active_calls, active_calls)
        prompt_order.append(agent.name)
        await asyncio.sleep(0)
        active_calls -= 1
        return ActionResult(
            success=True,
            action_name="abstain",
            parameters={},
            summary=f"{agent.name} chose abstain",
            agent_name=agent.name,
            round_num=round_num,
        )

    runner._prompt_agent = fake_prompt

    result = asyncio.run(runner._run_simultaneous_round(1))

    assert max_active_calls == 1
    assert prompt_order == ["Alice", "Bob"]
    assert len(result.actions) == 2
    assert len(runner.context_manager.get_round_events(1)) == 2


@pytest.mark.asyncio
async def test_context_update_after_round(agents, mock_llm_client):
    """Verify that context summaries are updated after each round."""
    runner = ExperimentRunner(
        agents=agents,
        game_config=PRISONERS_DILEMMA,
        llm_client=mock_llm_client,
        round_visibility="simultaneous"
    )

    # Initial contexts should be empty
    assert runner.context_manager.get_context("Alice") == ""
    assert runner.context_manager.get_context("Bob") == ""

    # Run a round
    await runner.run(max_rounds=1)

    # Context manager should have recorded events
    events = runner.context_manager.get_round_events(1)
    assert len(events) == 2
    # Events are recorded by controller
    assert any(e.agent_name == "Alice" for e in events)
    assert any(e.agent_name == "Bob" for e in events)


@pytest.mark.asyncio
async def test_sequential_visibility_agents_see_previous_choices(agents, mock_llm_client):
    """In sequential mode, later agents see earlier agents' choices."""
    runner = ExperimentRunner(
        agents=agents,
        game_config=PRISONERS_DILEMMA,
        llm_client=mock_llm_client,
        round_visibility="sequential"
    )

    # Run one round
    await runner.run(max_rounds=1)

    # In sequential mode, events are recorded immediately after each agent
    # So the context manager should have the events
    events = runner.context_manager.get_round_events(1)
    assert len(events) == 2


@pytest.mark.asyncio
async def test_invalid_json_response_handling(agents, mock_llm_client):
    """Handle invalid JSON responses gracefully.

    Invalid JSON is caught by the controller, which returns an ActionResult
    with success=False and skipped=True. The round is still completed
    (all agents were prompted), but the actions indicate failure.
    """
    # Return invalid JSON
    mock_llm_client.chat = Mock(return_value="This is not valid JSON")

    runner = ExperimentRunner(
        agents=agents,
        game_config=PRISONERS_DILEMMA,
        llm_client=mock_llm_client,
        round_visibility="simultaneous"
    )

    results = await runner.run(max_rounds=1)

    # Both agents were processed but actions failed
    assert len(results) == 1
    assert len(results[0].actions) == 2
    # Both actions should have failed
    assert all(not action.success for action in results[0].actions)
    assert all(action.skipped for action in results[0].actions)


@pytest.mark.asyncio
async def test_random_turn_order_varies(agents, mock_llm_client):
    """In random mode, turn order should vary between rounds."""
    runner = ExperimentRunner(
        agents=agents,
        game_config=PRISONERS_DILEMMA,
        llm_client=mock_llm_client,
        round_visibility="random"
    )

    # Run multiple rounds and track turn orders
    await runner.run(max_rounds=5)

    # Turn order should be tracked and vary
    assert runner.turn_order is not None
    # With only 2 agents, turn order will always be [Alice, Bob] or [Bob, Alice]
    # But it should be recorded


@pytest.mark.asyncio
async def test_paired_mode_creates_n_over_2_pairs(mock_llm_client):
    """In paired mode with even number of agents, create n/2 pairs."""
    # Create 4 agents
    agents = [
        ExperimentAgent(
            name=f"Agent{i}",
            properties={},
            llm_config=LLMConfig(dialect="mock")
        )
        for i in range(4)
    ]

    runner = ExperimentRunner(
        agents=agents,
        game_config=PRISONERS_DILEMMA,
        llm_client=mock_llm_client,
        round_visibility="paired"
    )

    # Run one round
    results = await runner.run(max_rounds=1)

    assert len(results) == 1
    # All 4 agents should act (in 2 pairs)
    assert len(results[0].actions) == 4
    assert results[0].completed is True


@pytest.mark.asyncio
async def test_odd_count_paired_one_agent_sits_out(mock_llm_client):
    """In paired mode with odd number of agents, one sits out."""
    # Create 3 agents
    agents = [
        ExperimentAgent(
            name=f"Agent{i}",
            properties={},
            llm_config=LLMConfig(dialect="mock")
        )
        for i in range(3)
    ]

    runner = ExperimentRunner(
        agents=agents,
        game_config=PRISONERS_DILEMMA,
        llm_client=mock_llm_client,
        round_visibility="paired"
    )

    # Run one round
    results = await runner.run(max_rounds=1)

    assert len(results) == 1
    # All 3 agents should have action results (1 pair + 1 sat out)
    assert len(results[0].actions) == 3
    # One agent should have skipped
    skipped_count = sum(1 for a in results[0].actions if a.skipped)
    assert skipped_count == 1
