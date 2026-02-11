"""
Helper functions for simulation route handlers.

This module contains shared utility functions used across multiple
simulation route modules. Includes database access, authentication,
tree record management, and event broadcasting.

Contains:
    - get_simulation_for_owner: Fetch simulation with ownership check
    - get_tree_record: Get or create SimTreeRecord for a simulation
    - get_simulation_and_tree: Get both simulation and tree record
    - get_simulation_and_tree_any: Get simulation/tree without owner check
    - resolve_user_from_token: Resolve user from JWT token
    - broadcast_tree_event: Broadcast event to all tree subscribers
"""

import logging
from typing import Any

from jose import JWTError, jwt
from litestar.exceptions import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from socialsim4.core.llm_config import LLMConfig, guess_supports_vision
from socialsim4.core.search_config import SearchConfig
from socialsim4.core.llm import create_llm_client
from socialsim4.core.tools.web.search import create_search_client
from socialsim4.backend.core.database import get_session
from socialsim4.backend.dependencies import settings

from socialsim4.backend.models.simulation import Simulation
from socialsim4.backend.models.user import ProviderConfig, SearchProviderConfig, User
from socialsim4.backend.services.simtree_runtime import SIM_TREE_REGISTRY, SimTreeRecord


logger = logging.getLogger(__name__)


async def get_simulation_for_owner(
    session: AsyncSession,
    owner_id: int,
    simulation_id: str,
) -> Simulation:
    """
    Fetch a simulation by ID and owner.

    Args:
        session: Database session
        owner_id: User ID who owns the simulation
        simulation_id: Simulation identifier

    Returns:
        The Simulation object

    Raises:
        sqlalchemy.exc.NoResultFound: If simulation not found
    """
    result = await session.execute(
        select(Simulation).where(
            Simulation.owner_id == owner_id,
            Simulation.id == simulation_id.upper()
        )
    )
    return result.scalar_one()


async def get_tree_record(
    sim: Simulation,
    session: AsyncSession,
    user_id: int,
) -> SimTreeRecord:
    """
    Get or create a SimTreeRecord for a simulation.

    Loads the user's LLM and Search provider configurations,
    creates the appropriate clients, and gets or creates a
    SimTreeRecord from the registry.

    Args:
        sim: The simulation object
        session: Database session
        user_id: User ID for loading provider configs

    Returns:
        SimTreeRecord with tree and client instances

    Raises:
        HTTPException: If provider configuration is invalid or missing
    """
    # Load LLM Provider configuration
    result = await session.execute(
        select(ProviderConfig).where(ProviderConfig.user_id == user_id)
    )
    items = result.scalars().all()
    active = [p for p in items if (p.config or {}).get("active")]

    if len(active) != 1:
        raise HTTPException(
            status_code=400,
            detail="LLM provider not configured (need exactly one active)"
        )

    provider = active[0]
    dialect = (provider.provider or "").lower()

    if dialect not in {"openai", "gemini", "mock", "ollama"}:
        raise HTTPException(status_code=400, detail="Invalid LLM provider dialect")

    if dialect in {"openai", "gemini"} and not provider.api_key:
        raise HTTPException(status_code=400, detail="LLM API key required")

    if not provider.model:
        raise HTTPException(status_code=400, detail="LLM model required")

    # Create LLM client
    cfg = LLMConfig(
        dialect=dialect,
        api_key=provider.api_key or "",
        model=provider.model,
        base_url=provider.base_url or (
            "http://127.0.0.1:11434" if dialect == "ollama" else None
        ),
        temperature=0.7,
        top_p=1.0,
        frequency_penalty=0.0,
        presence_penalty=0.0,
        max_tokens=1024,
        supports_vision=guess_supports_vision(provider.model),
    )
    llm_client = create_llm_client(cfg)

    # Load Search Provider configuration
    result_s = await session.execute(
        select(SearchProviderConfig).where(SearchProviderConfig.user_id == user_id)
    )
    sprov = result_s.scalars().first()

    if sprov is None:
        s_cfg = SearchConfig(dialect="ddg", api_key="", base_url=None, params={})
    else:
        s_cfg = SearchConfig(
            dialect=(sprov.provider or "ddg"),
            api_key=sprov.api_key or "",
            base_url=sprov.base_url,
            params=sprov.config or {},
        )

    search_client = create_search_client(s_cfg)
    clients = {"chat": llm_client, "default": llm_client, "search": search_client}

    return await SIM_TREE_REGISTRY.get_or_create_from_sim(sim, clients)


async def get_simulation_and_tree(
    session: AsyncSession,
    owner_id: int,
    simulation_id: str,
) -> tuple[Simulation, SimTreeRecord]:
    """
    Get both simulation and tree record for an owner.

    Convenience function that combines get_simulation_for_owner
    and get_tree_record.

    Args:
        session: Database session
        owner_id: User ID who owns the simulation
        simulation_id: Simulation identifier

    Returns:
        Tuple of (Simulation, SimTreeRecord)
    """
    sim = await get_simulation_for_owner(session, owner_id, simulation_id)
    record = await get_tree_record(sim, session, owner_id)
    return sim, record


async def get_simulation_and_tree_any(
    session: AsyncSession,
    simulation_id: str,
) -> tuple[Simulation, SimTreeRecord]:
    """
    Get simulation and tree without ownership check.

    Used for endpoints that don't require authentication (e.g.,
    tree operations that use the simulation's owner_id directly).

    Args:
        session: Database session
        simulation_id: Simulation identifier

    Returns:
        Tuple of (Simulation, SimTreeRecord)

    Raises:
        HTTPException: If simulation not found
    """
    sim = await session.get(Simulation, simulation_id.upper())
    if sim is None:
        raise HTTPException(status_code=404, detail="Simulation not found")
    record = await get_tree_record(sim, session, sim.owner_id)
    return sim, record


async def resolve_user_from_token(
    token: str,
    session: AsyncSession,
) -> User | None:
    """
    Resolve a user from a JWT bearer token.

    Args:
        token: JWT token string
        session: Database session

    Returns:
        User object if valid token, None otherwise
    """
    if not token:
        return None

    try:
        payload = jwt.decode(
            token,
            settings.jwt_signing_key.get_secret_value(),
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError:
        return None

    subject = payload.get("sub")
    if subject is None:
        return None

    user = await session.get(User, int(subject))
    if user is None or not user.is_active:
        return None

    return user


def broadcast_tree_event(
    record: SimTreeRecord,
    event: dict,
) -> None:
    """
    Broadcast an event to all tree-level subscribers.

    Used for HTTP-triggered events like run_start, run_finish,
    and attached notifications.

    Args:
        record: SimTreeRecord with subscribers
        event: Event dictionary to broadcast
    """
    for queue in list(record.subs):
        try:
            queue.put_nowait(event)
        except Exception:
            logger.exception("failed to enqueue tree-level broadcast event")
