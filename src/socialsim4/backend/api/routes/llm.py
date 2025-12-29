# src/socialsim4/backend/api/routes/llm.py
from __future__ import annotations

from typing import Any, List, Optional

from litestar import Router, post
from litestar.connection import Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_session
from ...dependencies import extract_bearer_token, resolve_current_user
from ...models.user import ProviderConfig

# 👇 关键：这里需要上升 3 层到 socialsim4，然后再进入 core
from ....core.llm import create_llm_client
from ....core.llm_config import LLMConfig

class GenerateAgentsRequest(BaseModel):
    count: int = Field(5, ge=1, le=50)
    description: str
    # 前端 generateAgentsWithAI 里传的 provider_id
    provider_id: Optional[int] = None


class GeneratedAgent(BaseModel):
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
async def _select_provider(
    session: AsyncSession,
    user_id: int,
    provider_id: Optional[int],
) -> ProviderConfig:
    # 优先用前端传入的 provider_id
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
        # 否则找 config.active 的那个；都没标 active 就随便挑一个
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
@post("/generate_agents")
async def generate_agents(
    request: Request,
    data: GenerateAgentsRequest,
) -> List[GeneratedAgent]:
    """
    POST /llm/generate_agents

    前端的 generateAgentsWithAI() 就是调的这个接口。
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
            "你是一个社会模拟平台的角色生成助手。"
            "根据用户提供的场景描述，生成一组角色配置，返回 JSON 格式。"
            "只输出 JSON，不要解释文字。"
            "每个角色包含字段：name, role, profile, properties。"
        )

        user_prompt = (
            f"请根据以下场景描述，生成 {data.count} 个多样化的角色：\n\n"
            f"{data.description}\n\n"
            "要求：\n"
            "1. 角色之间身份、立场、性格要有差异。\n"
            "2. 直接返回 JSON 数组，例如：\n"
            "[\n"
            "  {\"name\": \"张三\", \"role\": \"村长\", \"profile\": \"...\", \"properties\": {\"信任值\": 70}},\n"
            "  {\"name\": \"李四\", \"role\": \"商人\", \"profile\": \"...\", \"properties\": {\"信任值\": 45}}\n"
            "]"
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        raw_text = llm.chat(messages)

        import json

        try:
            parsed = json.loads(raw_text)
        except Exception:
            # LLM 没按要求返回 JSON 时的兜底，前端依然能跑
            parsed = [
                {
                    "name": f"Agent {i+1}",
                    "role": "角色",
                    "profile": f"占位角色，原始输出无法解析为 JSON：{raw_text[:50]}...",
                    "properties": {},
                }
                for i in range(data.count)
            ]

        if isinstance(parsed, dict) and "agents" in parsed:
            items = parsed["agents"]
        else:
            items = parsed

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

        # 如果模型返回的不足 count 个，简单补齐
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
# 暴露 /llm 前缀的 Router
router = Router(
    path="/llm",
    route_handlers=[generate_agents],
)
