"""Debug logger for full prompt/response tracing during development."""

import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, Any


class DebugLogger:
    """Logs full prompts, LLM responses, and controller actions.

    Outputs to:
    - Console (stdout with timestamps)
    - File: test_results/debug_logs/session_YYYYMMDD_HHMMSS.txt
    """

    def __init__(self, log_dir: Path = Path("test_results/debug_logs")):
        """Initialize debug logger.

        Args:
            log_dir: Directory for log files (created if doesn't exist)
        """
        self.log_dir = log_dir
        self.log_dir.mkdir(parents=True, exist_ok=True)

        # Console logger (stdout)
        self.console = logging.getLogger("debug_trace")
        # Clear any existing handlers
        self.console.handlers.clear()
        self.console.setLevel(logging.DEBUG)
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(
            '[%(asctime)s] %(message)s',
            datefmt='%H:%M:%S'
        ))
        self.console.addHandler(handler)

        # File logger (per-session)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.file_path = self.log_dir / f"session_{timestamp}.txt"

    def log_prompt(self, agent_name: str, prompt: str) -> None:
        """Log full prompt to console and file.

        Args:
            agent_name: Name of the agent
            prompt: Full prompt text
        """
        msg = (
            f"\n{'='*60}\n"
            f"[PROMPT] Agent: {agent_name}\n"
            f"{'='*60}\n"
            f"{prompt}\n"
            f"{'='*60}"
        )
        self.console.debug(msg)
        self._write_to_file(msg)

    def log_llm_response(self, agent_name: str, response: str) -> None:
        """Log full LLM response to console and file.

        Args:
            agent_name: Name of the agent
            response: Raw LLM response text
        """
        msg = (
            f"\n{'='*60}\n"
            f"[LLM RESPONSE] Agent: {agent_name}\n"
            f"{'='*60}\n"
            f"{response}\n"
            f"{'='*60}"
        )
        self.console.debug(msg)
        self._write_to_file(msg)

    def log_controller_action(
        self,
        agent_name: str,
        action: str,
        params: Dict[str, Any],
        elaborated: bool = False
    ) -> None:
        """Log controller action to console and file.

        Args:
            agent_name: Name of the agent
            action: Action name
            params: Action parameters
            elaborated: Whether this was after re-prompting for parameters
        """
        elaboration_note = " (elaborated)" if elaborated else ""
        msg = f"\n[CONTROLLER]{elaboration_note} Agent: {agent_name} -> Action: {action}, Params: {params}"
        self.console.debug(msg)
        self._write_to_file(msg)

    def log_error(self, agent_name: str, error: str) -> None:
        """Log error to console and file.

        Args:
            agent_name: Name of the agent
            error: Error message
        """
        msg = f"\n[ERROR] Agent: {agent_name} -> {error}"
        self.console.debug(msg)
        self._write_to_file(msg)

    def _write_to_file(self, content: str) -> None:
        """Append content to session file.

        Args:
            content: Content to write
        """
        with open(self.file_path, 'a', encoding='utf-8') as f:
            f.write(content + "\n")
