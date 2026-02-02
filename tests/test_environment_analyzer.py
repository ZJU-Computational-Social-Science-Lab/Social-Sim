import pytest
from unittest.mock import Mock, MagicMock
from socialsim4.core.environment_analyzer import EnvironmentAnalyzer


@pytest.fixture
def mock_clients():
    """Mock LLM clients."""
    chat_client = Mock()
    chat_client.call = MagicMock(return_value="Mock LLM response")
    return {"chat": chat_client, "default": chat_client}


@pytest.fixture
def sample_context():
    """Sample context for analysis."""
    return {
        "recent_events": [
            {"type": "system_broadcast", "text": "Alice: We need more supplies."},
            {"type": "system_broadcast", "text": "Bob: I'll go to the store."},
        ],
        "agent_count": 3,
        "current_turn": 5,
        "scene_time": 540,
    }


def test_analyzer_initialization(mock_clients):
    analyzer = EnvironmentAnalyzer(mock_clients)
    assert analyzer.clients == mock_clients


def test_summarize_context(mock_clients, sample_context):
    analyzer = EnvironmentAnalyzer(mock_clients)
    summary = analyzer.summarize_context(sample_context)

    assert isinstance(summary, dict)
    assert "themes" in summary
    assert "sentiment" in summary
    assert "notable_actions" in summary


def test_generate_suggestions_returns_list(mock_clients, sample_context):
    analyzer = EnvironmentAnalyzer(mock_clients)
    # Mock the summarize to return a fixed summary
    analyzer.summarize_context = Mock(return_value={
        "themes": ["resource shortage"],
        "sentiment": "tense",
        "notable_actions": ["Bob went to store"],
    })

    suggestions = analyzer.generate_suggestions(sample_context)

    assert isinstance(suggestions, list)
    assert len(suggestions) <= 3
    for suggestion in suggestions:
        assert "event_type" in suggestion
        assert "description" in suggestion
        assert "severity" in suggestion
