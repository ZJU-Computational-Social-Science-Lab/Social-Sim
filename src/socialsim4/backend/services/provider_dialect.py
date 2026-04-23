from __future__ import annotations


def normalize_provider_dialect(raw: str | None) -> str:
    value = (raw or "").strip().lower().replace("_", "-")
    if value == "openai-compatible":
        return "openai"
    return value
