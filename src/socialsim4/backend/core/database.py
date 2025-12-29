from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from .config import get_settings


settings = get_settings()

# Configure engine with optional pool tuning from settings. Only include values
# explicitly provided to avoid passing unsupported args for some dialects.
engine_kwargs: dict = {"echo": settings.debug}
if settings.db_pool_size is not None:
    engine_kwargs["pool_size"] = settings.db_pool_size
if settings.db_max_overflow is not None:
    engine_kwargs["max_overflow"] = settings.db_max_overflow
if settings.db_pool_timeout is not None:
    engine_kwargs["pool_timeout"] = settings.db_pool_timeout
if settings.db_pool_recycle is not None:
    engine_kwargs["pool_recycle"] = settings.db_pool_recycle
if settings.db_pool_pre_ping is not None:
    engine_kwargs["pool_pre_ping"] = settings.db_pool_pre_ping

engine = create_async_engine(settings.database_url, **engine_kwargs)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


@asynccontextmanager
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
