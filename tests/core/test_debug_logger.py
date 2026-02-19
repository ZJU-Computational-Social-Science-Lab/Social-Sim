"""Tests for core.debug_logger module."""

import pytest
from pathlib import Path
from socialsim4.core.debug_logger import DebugLogger


def test_logger_creates_log_directory():
    """Should create log directory if it doesn't exist."""
    import tempfile
    with tempfile.TemporaryDirectory() as tmpdir:
        logger = DebugLogger(log_dir=Path(tmpdir) / "logs")
        assert (Path(tmpdir) / "logs").exists()


def test_log_prompt_writes_to_file():
    """Should write prompt to file."""
    import tempfile
    with tempfile.TemporaryDirectory() as tmpdir:
        logger = DebugLogger(log_dir=Path(tmpdir) / "logs")
        logger.log_prompt("Agent1", "You are Agent1.")

        files = list((Path(tmpdir) / "logs").glob("session_*.txt"))
        assert len(files) == 1

        content = files[0].read_text(encoding='utf-8')
        assert "Agent1" in content
        assert "You are Agent1." in content


def test_log_llm_response_writes_to_file():
    """Should write LLM response to file."""
    import tempfile
    with tempfile.TemporaryDirectory() as tmpdir:
        logger = DebugLogger(log_dir=Path(tmpdir) / "logs")
        logger.log_llm_response("Agent1", '{"action": "Move"}')

        files = list((Path(tmpdir) / "logs").glob("session_*.txt"))
        content = files[0].read_text(encoding='utf-8')
        assert '[LLM RESPONSE]' in content
        assert '{"action": "Move"}' in content


def test_log_controller_action_writes_to_file():
    """Should write controller action to file."""
    import tempfile
    with tempfile.TemporaryDirectory() as tmpdir:
        logger = DebugLogger(log_dir=Path(tmpdir) / "logs")
        logger.log_controller_action("Agent1", "Move", {"direction": "North"}, elaborated=True)

        files = list((Path(tmpdir) / "logs").glob("session_*.txt"))
        content = files[0].read_text(encoding='utf-8')
        assert '[CONTROLLER]' in content
        assert '(elaborated)' in content


def test_log_error_writes_to_file():
    """Should write error to file."""
    import tempfile
    with tempfile.TemporaryDirectory() as tmpdir:
        logger = DebugLogger(log_dir=Path(tmpdir) / "logs")
        logger.log_error("Agent1", "Invalid JSON")

        files = list((Path(tmpdir) / "logs").glob("session_*.txt"))
        content = files[0].read_text(encoding='utf-8')
        assert '[ERROR]' in content
        assert 'Invalid JSON' in content


def test_multiple_logs_append_to_same_file():
    """Multiple logs should append to the same session file."""
    import tempfile
    with tempfile.TemporaryDirectory() as tmpdir:
        logger = DebugLogger(log_dir=Path(tmpdir) / "logs")
        logger.log_prompt("Agent1", "Prompt 1")
        logger.log_llm_response("Agent1", "Response 1")
        logger.log_controller_action("Agent1", "Move", {}, elaborated=False)

        files = list((Path(tmpdir) / "logs").glob("session_*.txt"))
        assert len(files) == 1

        content = files[0].read_text(encoding='utf-8')
        assert '[PROMPT]' in content
        assert '[LLM RESPONSE]' in content
        assert '[CONTROLLER]' in content
