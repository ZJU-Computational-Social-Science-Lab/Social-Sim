"""
Shared debug logging for experiment execution.

Provides a single debug file that both runner and controller write to,
making it easy to follow the full prompt/response flow.
"""

from pathlib import Path
from datetime import datetime
import threading

# Shared debug file path - created once per session
_debug_dir = Path("test_results")
_debug_dir.mkdir(exist_ok=True)

# Use a lock for thread-safe writes
_write_lock = threading.Lock()

# Global debug file for this session
_session_debug_file: Path | None = None


def get_debug_file() -> Path:
    """Get the shared debug file for this session.

    Creates a new file on first call, then returns the same file
    for all subsequent calls in this session.

    Returns:
        Path to the debug file
    """
    global _session_debug_file

    with _write_lock:
        if _session_debug_file is None:
            _session_debug_file = _debug_dir / f"experiment_debug_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
            # Write header
            with open(_session_debug_file, 'w', encoding='utf-8') as f:
                f.write(f"Experiment Debug Log - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write("=" * 80 + "\n\n")

        return _session_debug_file


def write_debug(content: str) -> None:
    """Write content to the shared debug file.

    Args:
        content: Text to write to the debug file
    """
    debug_file = get_debug_file()
    with _write_lock:
        with open(debug_file, 'a', encoding='utf-8') as f:
            f.write(content)


def reset_debug_file() -> Path:
    """Reset the debug file for a new session.

    Useful for testing or when starting a new experiment run.

    Returns:
        Path to the new debug file
    """
    global _session_debug_file
    _session_debug_file = None
    return get_debug_file()
