from datetime import datetime, timezone

from litestar import Router, delete, get, patch, post
from litestar.connection import Request
from sqlalchemy import select

from socialsim4.core.llm import create_llm_client
from socialsim4.core.llm_config import LLMConfig

from ...core.database import get_session
from ...dependencies import extract_bearer_token, resolve_current_user
from ...models.user import ProviderConfig
from ...schemas.common import Message
from ...schemas.provider import ProviderBase, ProviderCreate, ProviderUpdate


def _serialize_provider(provider: ProviderConfig) -> ProviderBase:
    return ProviderBase(
        id=provider.id,
        name=provider.name,
        provider=provider.provider,
        model=provider.model,
        base_url=provider.base_url,
        has_api_key=bool(provider.api_key),
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

        dialect = (provider.provider or "").lower()
        cfg = LLMConfig(
            dialect=dialect,
            api_key=provider.api_key or "",
            model=provider.model,
            base_url=provider.base_url,
            temperature=0.7,
            top_p=1.0,
            frequency_penalty=0.0,
            presence_penalty=0.0,
            max_tokens=64,
        )

        provider.last_tested_at = datetime.now(timezone.utc)
        client = create_llm_client(cfg)
        client.chat([{"role": "user", "content": "ping"}])
        provider.last_test_status = "success"
        provider.last_error = None
        await session.commit()
        return Message(message="Provider connectivity verified")


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
            if p.id == provider.id:
                p.config = {"active": True}
            else:
                p.config = {}
        await session.commit()
        return Message(message="Activated provider")


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
