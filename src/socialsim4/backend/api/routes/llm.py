# src/socialsim4/backend/api/routes/llm.py
from __future__ import annotations

from typing import Any, List, Optional
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


class RefineReportRequest(BaseModel):
    prompt: str
    provider_id: Optional[int] = None


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
   # 打印原始输出用于调试
        logger.debug(f"LLM raw output (first 500 chars): {raw_text[:500]}")
        
        import json
        import re
        
        # 清理 LLM 输出：去除 markdown 代码块标记
        cleaned_text = raw_text.strip()

        # 移除markdown代码块标记
        if cleaned_text.startswith("```"):
            # 匹配 ```json 或 ``` 开头的代码块
            match = re.search(r'```(?:json)?\s*\n(.*?)\n```', cleaned_text, re.DOTALL)
            if match:
                cleaned_text = match.group(1).strip()
            else:
                # 简单移除```标记
                cleaned_text = re.sub(r'^```(?:json)?|```$', '', cleaned_text, flags=re.MULTILINE).strip()
        
        # 尝试找到第一个[或{
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
            # LLM 没按要求返回 JSON 时的兜底，前端依然能跑
            parsed = [
                {
                    "name": f"Agent {i+1}",
                    "role": "角色",
                    "profile": f"LLM返回格式错误。原始输出: {raw_text[:100]}...",
                    "properties": {},
                }
                for i in range(data.count)
            ]

        # 处理不同的返回格式
        if isinstance(parsed, dict) and "agents" in parsed:
            items = parsed["agents"]
        elif isinstance(parsed, list):
            items = parsed
        else:
            # 如果解析出来不是列表也不是包含 agents 的字典，创建占位角色
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


@post("/refine_report")
async def refine_report(request: Request, data: RefineReportRequest) -> dict:
    token = extract_bearer_token(request)

    async with get_session() as session:
        current_user = await resolve_current_user(session, token)
        provider = await _select_provider(session, current_user.id, data.provider_id)
        cfg = LLMConfig(
            dialect=(provider.provider or "").lower(),
            api_key=provider.api_key or "",
            model=provider.model,
            base_url=provider.base_url,
            temperature=0.4,
            top_p=1.0,
            frequency_penalty=0.0,
            presence_penalty=0.0,
            max_tokens=512,
        )
        llm = create_llm_client(cfg)

        messages: list[dict[str, str]] = [
            {"role": "system", "content": "你是一名报告精炼助手，请严格返回 JSON。"},
            {"role": "user", "content": data.prompt},
        ]
        text = llm.chat(messages)
        return {"text": text}
# 暴露 /llm 前缀的 Router
router = Router(
    path="/llm",
    route_handlers=[generate_agents, refine_report],
)
