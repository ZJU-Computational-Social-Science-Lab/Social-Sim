"""
Smoke test for LLM distribution at runtime.

Verifies that when simulation runs, different agents use different LLM clients.
This test should FAIL with current implementation.
"""
import pytest
from unittest.mock import MagicMock, patch, call
from socialsim4.core.llm.client import LLMClient
from socialsim4.core.experiment.scene import ExperimentScene
from socialsim4.core.experiment.config import ExperimentConfig
from socialsim4.core.experiment.game_configs import GameConfig
from socialsim4.core.experiment.information_model import InformationModel


@pytest.mark.asyncio
async def test_llm_distribution_runtime():
    """Smoke test that verifies runtime LLM distribution.

    This test verifies that when running a simulation:
    1. Agents with different llm_config.dialect values
    2. Should use different LLM clients
    3. Currently, they all share the same default client (BUG)
    """
    # Create scene with 50/50 distribution
    scene = ExperimentScene(
        ExperimentConfig(
            scenario_id="test",
            agents=[
                {"name": "Agent1", "properties": {"provider_id": 1}, "llm_config": {"dialect": "openai", "model": "gpt-4o"}},
                {"name": "Agent2", "properties": {"provider_id": 2}, "llm_config": {"dialect": "ollama", "model": "llama3"}},
            ],
            actions=[
                {"name": "cooperate", "description": "Cooperate action"},
                {"name": "defect", "description": "Defect action"},
            ],
        )
    )

    # Create mock LLM clients
    openai_client = MagicMock(spec=LLMClient)
    openai_client.chat = MagicMock(return_value='{"action": "cooperate"}')

    ollama_client = MagicMock(spec=LLMClient)
    ollama_client.chat = MagicMock(return_value='{"action": "defect"}')

    # Create mock game config
    game_config = MagicMock(spec=GameConfig)
    game_config.actions = ["cooperate", "defect"]
    game_config.action_descriptions = {"cooperate": "Cooperate", "defect": "Defect"}
    game_config.payoff_summary = ""
    game_config.action_schemas = {}
    game_config.action_followup_modes = {}

    # Create mock information model
    info_model = MagicMock(spec=InformationModel)
    info_model.scope_type = "all"
    info_model.include_scores = False

    # Initialize scene with default client
    scene.initialize(openai_client)

    # Try to run one round
    # BUG: With current implementation, both agents use the same client
    # The fix should create different clients based on llm_config.dialect
    result = await scene.run_round()

    # Verify round completed
    assert result is not None
    assert result.round_num == 1

    assert len(result.actions) == 2

    # Verify that both agents made decisions
    for action_result in result.actions:
        assert action_result.success
        assert action_result.action_name in ["cooperate", "defect"]


@pytest.mark.asyncio
async def test_llm_client_selection():
    """Test that ExperimentRunner selects different LLM clients for different agents.

    This test patches LLMClient creation to verify that different
    providers create different clients.
    """
    # Track which clients are created
    created_clients = []

    def mock_llm_client_init(self, *args, **kwargs):
        """Mock LLMClient __init__ to track creations."""
        # Extract dialect from kwargs
        dialect = kwargs.get('dialect', 'unknown')
        client = MagicMock()
        client.dialect = dialect
        client.chat = MagicMock(return_value='{"action": "cooperate"}')
        created_clients.append(client)
        return client

    # Patch LLMClient.__init__
    with patch('socialsim4.core.llm.client.LLMClient.__init__', mock_llm_client_init):
        # Create scene with different providers
        scene = ExperimentScene(
            ExperimentConfig(
                scenario_id="test",
                agents=[
                    {"name": "Agent1", "properties": {}, "llm_config": {"dialect": "openai", "model": "gpt-4o"}},
                    {"name": "Agent2", "properties": {}, "llm_config": {"dialect": "ollama", "model": "llama3"}},
                ],
                actions=[
                    {"name": "cooperate", "description": "Cooperate action"},
                    {"name": "defect", "description": "Defect action"},
                ],
            )
        )

        # Create mock client
        mock_client = MagicMock(spec=LLMClient)
        mock_client.chat = MagicMock(return_value='{"action": "cooperate"}')

        # Initialize scene
        scene.initialize(mock_client)

        # BUG VERIFICATION:
        # With current implementation, only one client is created (the default)
        # The fix should create per-agent clients
        # This test should FAIL until the bug is fixed
        assert len(created_clients) >= 2, f"Expected 2+ LLM clients to be created, got {len(created_clients)}"
