"""
LLM provider configuration API routes.

Handles CRUD operations for user LLM provider configurations including
OpenAI, Gemini, Ollama, and mock providers. Supports provider testing,
activation, and credential management.

Contains:
    - list_providers: GET all providers for current user
    - create_provider: POST create new provider
    - update_provider: PATCH update provider
    - delete_provider: DELETE provider
    - test_provider: POST test provider connectivity
    - activate_provider: POST set provider as active
"""
from datetime import datetime, timezone

from litestar import Router, delete, get, patch, post
from litestar.exceptions import HTTPException
from litestar.connection import Request
from sqlalchemy import select

from socialsim4.core.llm import create_llm_client
from socialsim4.core.llm_config import LLMConfig, guess_supports_vision
from socialsim4.i18n import T

from ...core.database import get_session
from ...dependencies import extract_bearer_token, resolve_current_user
from ...models.user import ProviderConfig
from ...schemas.common import Message
from ...schemas.provider import ProviderBase, ProviderCreate, ProviderUpdate
from ...services.default_providers import ensure_default_ollama_providers


def _normalize_dialect(raw: str, base_url: str | None) -> tuple[str, str | None]:
    """
    Normalize provider dialect and base_url.

    For OpenAI + localhost, converts to Ollama dialect and strips /v1 suffix
    from base_url (since native Ollama API doesn't use /v1 prefix).

    Args:
        raw: Provider type string (e.g., "openai", "ollama", "gemini")
        base_url: Optional base URL for the provider

    Returns:
        Tuple of (normalized_dialect, normalized_base_url)
    """
    val = (raw or "").lower().strip()
    if val == "ollama":
        # Strip /v1 suffix if present (native Ollama API doesn't use it)
        if base_url and "/v1" in base_url:
            base_url = base_url.replace("/v1", "").rstrip("/")
        return "ollama", base_url
    # Heuristic: openai + localhost base_url ⇒ treat as ollama-compatible API
    if val == "openai" and base_url and "localhost" in base_url:
        # Convert to Ollama dialect and strip /v1 suffix
        if "/v1" in base_url:
            base_url = base_url.replace("/v1", "").rstrip("/")
        return "ollama", base_url
    return val, base_url


def _serialize_provider(provider: ProviderConfig) -> ProviderBase:
    return ProviderBase(
        id=provider.id,
        name=provider.name,
        provider=provider.provider,
        model=provider.model,
        base_url=provider.base_url,
        has_api_key=bool(provider.api_key),
        is_active=bool((provider.config or {}).get("active")),
        last_test_status=provider.last_test_status,
        last_tested_at=provider.last_tested_at,
        last_error=provider.last_error,
        config=provider.config,
    )


@get("/")
async def list_providers(request: Request) -> list[ProviderBase]:
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)
        if await ensure_default_ollama_providers(session, current_user.id):
            await session.commit()
        result = await session.execute(
            select(ProviderConfig).where(ProviderConfig.user_id == current_user.id)
        )
        providers = result.scalars().all()
        return [_serialize_provider(p) for p in providers]


@post("/", status_code=201)
async def create_provider(request: Request, data: ProviderCreate) -> ProviderBase:
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)
        # Determine if this will be the first provider for this user
        existing = await session.execute(
            select(ProviderConfig.id)
            .where(ProviderConfig.user_id == current_user.id)
            .limit(1)
        )
        has_any = existing.scalars().first() is not None

        cfg = dict(data.config or {})
        if not has_any:
            # First provider: mark as active by default
            cfg["active"] = True

        provider = ProviderConfig(
            user_id=current_user.id,
            name=data.name,
            provider=data.provider,
            model=data.model,
            base_url=data.base_url,
            api_key=data.api_key,
            config=cfg,
        )
        session.add(provider)
        await session.commit()
        await session.refresh(provider)
        return _serialize_provider(provider)


@patch("/{provider_id:int}")
async def update_provider(
    request: Request, provider_id: int, data: ProviderUpdate
) -> ProviderBase:
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)
        provider = await session.get(ProviderConfig, provider_id)
        assert provider is not None and provider.user_id == current_user.id

        if data.name is not None:
            provider.name = data.name
        if data.provider is not None:
            provider.provider = data.provider
        if data.model is not None:
            provider.model = data.model
        if data.base_url is not None:
            provider.base_url = data.base_url
        if data.api_key is not None:
            provider.api_key = data.api_key
        if data.config is not None:
            provider.config = data.config

        await session.commit()
        await session.refresh(provider)
        return _serialize_provider(provider)


@delete("/{provider_id:int}", status_code=204)
async def delete_provider(request: Request, provider_id: int) -> None:
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)
        provider = await session.get(ProviderConfig, provider_id)
        assert provider is not None and provider.user_id == current_user.id
        await session.delete(provider)
        await session.commit()


@post("/{provider_id:int}/test")
async def test_provider(request: Request, provider_id: int) -> Message:
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)
        provider = await session.get(ProviderConfig, provider_id)
        assert provider is not None and provider.user_id == current_user.id

        dialect, normalized_base_url = _normalize_dialect(provider.provider, provider.base_url)
        cfg = LLMConfig(
            dialect=dialect,
            api_key=provider.api_key or "",
            model=provider.model,
            base_url=normalized_base_url,
            temperature=0.7,
            top_p=1.0,
            frequency_penalty=0.0,
            presence_penalty=0.0,
            max_tokens=64,
            supports_vision=guess_supports_vision(provider.model),
        )

        provider.last_tested_at = datetime.now(timezone.utc)
        try:
            client = create_llm_client(cfg)
            client.chat([{"role": "user", "content": "ping"}])
            provider.last_test_status = "success"
            provider.last_error = None
            await session.commit()
            return Message(message=T('api.providers.connectivity_verified'))
        except Exception as exc:  # Surface connectivity/auth errors
            # Ollama JSON format can return empty content with 200; treat as connectivity OK
            if "Ollama returned empty response" in str(exc):
                provider.last_test_status = "success"
                provider.last_error = None
                await session.commit()
                return Message(message=T('api.providers.connectivity_verified'))

            provider.last_test_status = "failed"
            provider.last_error = str(exc)
            await session.commit()
            raise HTTPException(status_code=502, detail=f"Provider test failed: {exc}")


@post("/{provider_id:int}/activate")
async def activate_provider(request: Request, provider_id: int) -> Message:
    token = extract_bearer_token(request)
    async with get_session() as session:
        current_user = await resolve_current_user(session, token)
        provider = await session.get(ProviderConfig, provider_id)
        assert provider is not None and provider.user_id == current_user.id

        result = await session.execute(
            select(ProviderConfig).where(ProviderConfig.user_id == current_user.id)
        )
        providers = result.scalars().all()
        for p in providers:
            # Preserve existing config when toggling active status
            cfg = dict(p.config or {})
            if p.id == provider.id:
                cfg["active"] = True
            else:
                cfg["active"] = False
            p.config = cfg
        await session.commit()
        return Message(message=T('api.providers.activated'))


router = Router(
    path="/providers",
    route_handlers=[
        list_providers,
        create_provider,
        update_provider,
        delete_provider,
        test_provider,
        activate_provider,
    ],
)
