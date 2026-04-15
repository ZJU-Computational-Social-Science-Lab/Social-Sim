import os
from pathlib import Path


def get_runtime_debug_dir(*parts: str) -> Path:
    root = Path(os.getenv("SOCIALSIM4_DEBUG_LOG_DIR", "/tmp/socialsim4_debug"))
    path = root.joinpath(*parts)
    path.mkdir(parents=True, exist_ok=True)
    return path