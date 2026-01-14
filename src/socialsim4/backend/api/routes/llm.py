# src/socialsim4/backend/api/routes/llm.py
from __future__ import annotations

from typing import Any, List, Optional, Dict
import logging
logger = logging.getLogger(__name__)

from litestar import Router, post
from litestar.connection import Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_session
from ...dependencies import extract_bearer_token, resolve_current_user
from ...models.user import ProviderConfig

# 🔑 Import from core.llm (4 levels up to socialsim4, then into core)
from ....core.llm import (
    create_llm_client,
    generate_agents_with_archetypes,  # ← AgentTorch integration
)
from ....core.llm_config import LLMConfig


# =============================================================================
# Request/Response Models
# =============================================================================

class GenerateAgentsRequest(BaseModel):
    """Request model for simple description-based agent generation."""
    count: int = Field(5, ge=1, le=50)
    description: str
    provider_id: Optional[int] = None


class DemographicDimension(BaseModel):
    """A demographic dimension with categories (e.g., Age: [18-30, 31-50, 51+])."""
    name: str
    categories: List[str]


class TraitConfig(BaseModel):
    """Configuration for a trait with min/max bounds."""
    name: str
    min: int = 0
    max: int = 100


class GenerateAgentsDemographicsRequest(BaseModel):
    """Request model for demographic-based agent generation using AgentTorch."""
    total_agents: int = Field(10, ge=1, le=200)
    demographics: List[DemographicDimension]
    archetype_probabilities: Dict[str, float] = {}
    traits: List[TraitConfig] = []
    language: str = "zh"  # Default to Chinese
    provider_id: Optional[int] = None


class GeneratedAgent(BaseModel):
    """Response model for a generated agent."""
    id: Optional[str] = None
    name: str
    role: Optional[str] = None
    profile: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    properties: dict[str, Any] = {}
    history: dict[str, Any] = {}
    memory: list[Any] = []
    knowledgeBase: list[Any] = []


# =============================================================================
# Helper Functions
# =============================================================================

async def _select_provider(
    session: AsyncSession,
    user_id: int,
    provider_id: Optional[int],
) -> ProviderConfig:
    """
    Select an LLM provider for the user.
    Priority: provider_id from request > active provider > any provider
    """
    # Priority: use provider_id from frontend if specified
    if provider_id is not None:
        result = await session.execute(
            select(ProviderConfig).where(
                ProviderConfig.user_id == user_id,
                ProviderConfig.id == provider_id,
            )
        )
        provider = result.scalars().first()
        if provider is None:
            raise RuntimeError("指定的 LLM 提供商不存在或不属于当前用户")
    else:
        # Otherwise find active provider or fallback to first available
        result = await session.execute(
            select(ProviderConfig).where(ProviderConfig.user_id == user_id)
        )
        items = result.scalars().all()
        active = [p for p in items if (p.config or {}).get("active")]
        provider = active[0] if len(active) == 1 else (items[0] if items else None)

    if provider is None:
        raise RuntimeError("LLM provider not configured")

    dialect = (provider.provider or "").lower()
    if dialect not in {"openai", "gemini", "mock"}:
        raise RuntimeError("Invalid LLM provider dialect")
    if dialect != "mock" and not provider.api_key:
        raise RuntimeError("LLM API key required")
    if not provider.model:
        raise RuntimeError("LLM model required")

    return provider


# =============================================================================
# Endpoints
# =============================================================================

@post("/generate_agents")
async def generate_agents(
    request: Request,
    data: GenerateAgentsRequest,
) -> List[GeneratedAgent]:
    """
    POST /llm/generate_agents
    
    Simple description-based agent generation.
    Frontend's generateAgentsWithAI() calls this endpoint.
    """
    token = extract_bearer_token(request)

    async with get_session() as session:
        current_user = await resolve_current_user(session, token)

        provider = await _select_provider(
            session, current_user.id, data.provider_id
        )

        cfg = LLMConfig(
            dialect=(provider.provider or "").lower(),
            api_key=provider.api_key or "",
            model=provider.model,
            base_url=provider.base_url,
            temperature=0.7,
            top_p=1.0,
            frequency_penalty=0.0,
            presence_penalty=0.0,
            max_tokens=1024,
        )
        llm = create_llm_client(cfg)

        system_prompt = (
            "You are an agent generator for a social simulation platform. "
            "Generate a list of diverse agents based on the user's scenario description. "
            "IMPORTANT: Return ONLY a valid JSON array, no markdown, no explanation, no code blocks. "
            "Each agent must have: name (string), role (string), profile (string), properties (object)."
        )

        user_prompt = (
            f"Generate exactly {data.count} diverse agents for this scenario:\n\n"
            f"{data.description}\n\n"
            "Requirements:\n"
            "1. Each agent should have different identity, stance, and personality\n"
            "2. Return ONLY a JSON array in this exact format:\n"
            '[\n'
            '  {"name": "Zhang San", "role": "Village Chief", "profile": "60-year-old respected leader...", "properties": {"trust": 70}},\n'
            '  {"name": "Li Si", "role": "Merchant", "profile": "45-year-old shrewd businessman...", "properties": {"trust": 45}}\n'
            ']\n\n'
            "OUTPUT ONLY THE JSON ARRAY, NO OTHER TEXT:"
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        raw_text = llm.chat(messages)
        
        # Print raw output for debugging
        logger.debug(f"LLM raw output (first 500 chars): {raw_text[:500]}")
        
        import json
        import re
        
        # Clean LLM output: remove markdown code block markers
        cleaned_text = raw_text.strip()

        # Remove markdown code block markers
        if cleaned_text.startswith("```"):
            # Match ```json or ``` with content
            match = re.search(r'```(?:json)?\s*\n(.*?)\n```', cleaned_text, re.DOTALL)
            if match:
                cleaned_text = match.group(1).strip()
            else:
                # Simple removal of ``` markers
                cleaned_text = re.sub(r'^```(?:json)?|```$', '', cleaned_text, flags=re.MULTILINE).strip()
        
        # Try to find first [ or {
        json_start = min(
            (cleaned_text.find('[') if '[' in cleaned_text else len(cleaned_text)),
            (cleaned_text.find('{') if '{' in cleaned_text else len(cleaned_text))
        )
        if json_start < len(cleaned_text):
            cleaned_text = cleaned_text[json_start:]

        try:
            parsed = json.loads(cleaned_text)
        except Exception as e:
            logger.error(f"JSON parse failed: {e}")
            logger.error(f"Cleaned text (first 300 chars): {cleaned_text[:300]}")
            # Fallback when LLM doesn't return proper JSON
            parsed = [
                {
                    "name": f"Agent {i+1}",
                    "role": "角色",
                    "profile": f"LLM返回格式错误。原始输出: {raw_text[:100]}...",
                    "properties": {},
                }
                for i in range(data.count)
            ]

        # Handle different return formats
        if isinstance(parsed, dict) and "agents" in parsed:
            items = parsed["agents"]
        elif isinstance(parsed, list):
            items = parsed
        else:
            items = []

        if not isinstance(items, list):
            items = []

        agents: List[GeneratedAgent] = []
        for i, a in enumerate(items):
            if not isinstance(a, dict):
                continue
            agents.append(
                GeneratedAgent(
                    id=a.get("id") or None,
                    name=a.get("name") or f"Agent {i+1}",
                    role=a.get("role"),
                    profile=a.get("profile"),
                    provider=provider.provider or "backend",
                    model=provider.model or "default",
                    properties=a.get("properties") or {},
                    history=a.get("history") or {},
                    memory=a.get("memory") or [],
                    knowledgeBase=a.get("knowledgeBase") or [],
                )
            )

        # Fill to requested count if model returned fewer
        while len(agents) < data.count:
            idx = len(agents)
            agents.append(
                GeneratedAgent(
                    name=f"Agent {idx+1}",
                    role="角色",
                    profile=data.description,
                    provider=provider.provider or "backend",
                    model=provider.model or "default",
                )
            )

        return agents


@post("/generate_agents_demographics")
async def generate_agents_demographics(
    request: Request,
    data: GenerateAgentsDemographicsRequest,
) -> List[GeneratedAgent]:
    """
    POST /llm/generate_agents_demographics
    
    Demographic-based agent generation using AgentTorch framework.
    Frontend's generateAgentsWithDemographics() calls this endpoint.
    
    Process:
    1. Generate archetypes from demographic cross-product
    2. For each archetype, ONE LLM call to get description, roles, and trait distributions
    3. Generate agents with Gaussian-sampled traits
    4. Return agents with demographic properties
    """
    token = extract_bearer_token(request)

    async with get_session() as session:
        current_user = await resolve_current_user(session, token)

        provider = await _select_provider(
            session, current_user.id, data.provider_id
        )

        cfg = LLMConfig(
            dialect=(provider.provider or "").lower(),
            api_key=provider.api_key or "",
            model=provider.model,
            base_url=provider.base_url,
            temperature=0.7,
            top_p=1.0,
            frequency_penalty=0.0,
            presence_penalty=0.0,
            max_tokens=1024,
        )
        llm = create_llm_client(cfg)

        # Default traits if none provided
        if not data.traits:
            data.traits = [
                TraitConfig(name="信任度", min=0, max=100),
                TraitConfig(name="同理心", min=0, max=100),
                TraitConfig(name="果断性", min=0, max=100)
            ]

        # Convert Pydantic models to dicts for llm.py function
        demographics_dicts = [
            {"name": d.name, "categories": d.categories} 
            for d in data.demographics
        ]
        
        traits_dicts = [
            {"name": t.name, "min": t.min, "max": t.max} 
            for t in data.traits
        ]

        # 🎯 Call the integrated AgentTorch function from llm.py
        try:
            agents_data = generate_agents_with_archetypes(
                total_agents=data.total_agents,
                demographics=demographics_dicts,
                archetype_probabilities=data.archetype_probabilities,
                traits=traits_dicts,
                llm_client=llm,
                language=data.language
            )
        except Exception as e:
            logger.error(f"AgentTorch generation failed: {e}")
            # Fallback: create simple agents
            agents_data = []
            for i in range(data.total_agents):
                agents_data.append({
                    "id": f"agent_{i+1}",
                    "name": f"Agent {i+1}",
                    "role": "角色",
                    "profile": f"生成失败的备用智能体 {i+1}",
                    "properties": {},
                    "history": {},
                    "memory": [],
                    "knowledgeBase": []
                })

        # Convert to GeneratedAgent response models
        agents: List[GeneratedAgent] = []
        for agent_dict in agents_data:
            agents.append(
                GeneratedAgent(
                    id=agent_dict.get("id"),
                    name=agent_dict.get("name", "Agent"),
                    role=agent_dict.get("role"),
                    profile=agent_dict.get("profile", ""),
                    provider=provider.provider or "backend",
                    model=provider.model or "default",
                    properties=agent_dict.get("properties", {}),
                    history=agent_dict.get("history", {}),
                    memory=agent_dict.get("memory", []),
                    knowledgeBase=agent_dict.get("knowledgeBase", []),
                )
            )

        logger.info(f"Generated {len(agents)} agents using demographic modeling")
        return agents


# =============================================================================
# Router
# =============================================================================

router = Router(
    path="/llm",
    route_handlers=[
        generate_agents,               # Simple generation
        generate_agents_demographics,  # AgentTorch demographic generation
    ],
)
