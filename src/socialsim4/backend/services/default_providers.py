from __future__ import annotations

import os
from typing import Iterable

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.user import ProviderConfig


DEFAULT_OLLAMA_MODELS = [
    "qwen3:4b-instruct-2507-q4_K_M",
    "gemma3:4b-it-qat",
    "ministral-3:3b",
    "granite4:3b",
    "phi4-mini:latest",
    "gemma3:12b",
    "qwen3:0.6b",
]

DEFAULT_ACTIVE_MODEL = "qwen3:4b-instruct-2507-q4_K_M"


def get_default_ollama_base_url() -> str:
    return (
        os.getenv("SOCIALSIM4_OLLAMA_BASE_URL")
        or os.getenv("OLLAMA_BASE_URL")
        or "http://localhost:11434"
    ).rstrip("/")


async def _list_installed_ollama_models() -> list[str]:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{get_default_ollama_base_url()}/api/tags")
            response.raise_for_status()
    except Exception:
        return []

    data = response.json() or {}
    models = data.get("models") or []
    names = [str(item.get("name", "")).strip() for item in models if item.get("name")]
    return [name for name in names if name]


def _ordered_unique(items: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for item in items:
        if item and item not in seen:
            seen.add(item)
            ordered.append(item)
    return ordered


async def get_default_ollama_models() -> list[str]:
    installed = await _list_installed_ollama_models()
    if not installed:
        return []

    preferred = [model for model in DEFAULT_OLLAMA_MODELS if model in installed]
    extras = [model for model in installed if model not in preferred]
    return _ordered_unique([*preferred, *extras])


def _pick_active_model(models: list[str]) -> str | None:
    if not models:
        return None
    if DEFAULT_ACTIVE_MODEL in models:
        return DEFAULT_ACTIVE_MODEL
    return models[0]


def _build_provider_name(model: str, existing_names: set[str]) -> str:
    if model not in existing_names:
        return model

    candidate = f"{model} (ollama)"
    if candidate not in existing_names:
        return candidate

    index = 2
    while True:
        candidate = f"{model} (ollama {index})"
        if candidate not in existing_names:
            return candidate
        index += 1


async def ensure_default_ollama_providers(session: AsyncSession, user_id: int) -> bool:
    result = await session.execute(
        select(ProviderConfig).where(ProviderConfig.user_id == user_id)
    )
    providers = result.scalars().all()
    existing_names = {str(provider.name or "").strip() for provider in providers}
    existing_ollama_by_model = {
        str(provider.model or "").strip(): provider
        for provider in providers
        if (provider.provider or "").lower() == "ollama" and provider.model
    }

    desired_models = await get_default_ollama_models()
    desired_active_model = _pick_active_model(desired_models)
    has_active_provider = any(bool((provider.config or {}).get("active")) for provider in providers)

    changed = False
    for model in desired_models:
        provider = existing_ollama_by_model.get(model)
        if provider is not None:
            if not provider.base_url:
                provider.base_url = get_default_ollama_base_url()
                changed = True
            continue

        config = {"active": False}
        if not has_active_provider and model == desired_active_model:
            config["active"] = True

        new_provider = ProviderConfig(
            user_id=user_id,
            name=_build_provider_name(model, existing_names),
            provider="ollama",
            model=model,
            base_url=get_default_ollama_base_url(),
            api_key="",
            config=config,
        )
        session.add(new_provider)
        providers.append(new_provider)
        existing_names.add(new_provider.name)
        existing_ollama_by_model[model] = new_provider
        changed = True

    if not has_active_provider and desired_active_model:
        target = existing_ollama_by_model.get(desired_active_model)
        if target is not None and not bool((target.config or {}).get("active")):
            config = dict(target.config or {})
            config["active"] = True
            target.config = config
            changed = True

    return changed