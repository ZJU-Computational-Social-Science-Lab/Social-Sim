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

# 👇 关键：这里需要上升 3 层到 socialsim4，然后再进入 core
from ....core.llm import create_llm_client, generate_agents_with_archetypes
from ....core.llm_config import LLMConfig, guess_supports_vision

# Import stratified distribution for balanced provider assignment across demographics
from ...services.stratified_distribution import stratified_provider_assignment

class GenerateAgentsRequest(BaseModel):
    count: int = Field(5, ge=1, le=50)
    description: str
    # 前端 generateAgentsWithAI 里传的 provider_id
    provider_id: Optional[int] = None
    language: str = "en"  # Default to English


class DemographicDimension(BaseModel):
    """A demographic dimension with categories (e.g., Age: [18-30, 31-50, 51+])."""
    name: str
    categories: List[str]


class TraitConfig(BaseModel):
    """Configuration for a trait with mean/std bounds."""
    name: str
    mean: int = 50
    std: int = 15


class GenerateAgentsDemographicsRequest(BaseModel):
    """Request model for demographic-based agent generation using AgentTorch."""
    total_agents: int = Field(10, ge=1, le=200)
    demographics: List[DemographicDimension]
    archetype_probabilities: Dict[str, float] = {}
    traits: List[TraitConfig] = []
    language: str = "zh"  # Default to Chinese
    provider_id: Optional[int] = None


class GeneratedAgent(BaseModel):
    id: Optional[str] = None
    name: str
    role: Optional[str] = None
    profile: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    provider_id: Optional[int] = None  # For stratified provider distribution
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
    if dialect not in {"openai", "gemini", "mock", "ollama"}:
        raise RuntimeError("Invalid LLM provider dialect")
    if dialect in {"openai", "gemini"} and not provider.api_key:
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
            base_url=provider.base_url or ("http://127.0.0.1:11434" if dialect == "ollama" else None),
            temperature=0.7,
            top_p=1.0,
            frequency_penalty=0.0,
            presence_penalty=0.0,
            max_tokens=1024,
            supports_vision=guess_supports_vision(provider.model),
        )
        llm = create_llm_client(cfg)

        # Language-aware prompts
        is_zh = data.language.lower() == "zh"

        if is_zh:
            system_prompt = (
                "你是一个社会模拟平台的智能体生成器。"
                "根据用户提供的场景描述生成多样化的智能体列表。"
                "重要：只返回有效的 JSON 数组，不要 markdown 格式，不要解释，不要代码块。"
                "每个智能体必须包含：name（姓名）、role（角色）、profile（描述）、properties（属性对象）。"
            )

            user_prompt = (
                f"请为以下场景生成恰好 {data.count} 个多样化的智能体：\n\n"
                f"{data.description}\n\n"
                "要求：\n"
                "1. 每个智能体应有不同的身份、立场和性格\n"
                "2. 只返回 JSON 数组，格式如下：\n"
                '[\n'
                '  {"name": "张三", "role": "村长", "profile": "60岁德高望重的领导者...", "properties": {"信任度": 70}},\n'
                '  {"name": "李四", "role": "商人", "profile": "45岁精明的生意人...", "properties": {"信任度": 45}}\n'
                ']\n\n'
                "只输出 JSON 数组，不要其他文字："
            )
            fallback_role = "角色"
            fallback_profile = "LLM返回格式错误"
        else:
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
            fallback_role = "Role"
            fallback_profile = "LLM format error"

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
                    "name": f"{'智能体' if is_zh else 'Agent'} {i+1}",
                    "role": fallback_role,
                    "profile": f"{fallback_profile}。原始输出: {raw_text[:100]}..." if is_zh else f"{fallback_profile}. Raw output: {raw_text[:100]}...",
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
                    name=f"{'智能体' if is_zh else 'Agent'} {idx+1}",
                    role=fallback_role,
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

    try:
        async with get_session() as session:
            current_user = await resolve_current_user(session, token)

            provider = await _select_provider(
                session, current_user.id, data.provider_id
            )

            dialect = (provider.provider or "").lower()
            cfg = LLMConfig(
                dialect=dialect,
                api_key=provider.api_key or "",
                model=provider.model,
                base_url=provider.base_url or ("http://127.0.0.1:11434" if dialect == "ollama" else None),
                temperature=0.7,
                top_p=1.0,
                frequency_penalty=0.0,
                presence_penalty=0.0,
                max_tokens=1024,
                supports_vision=guess_supports_vision(provider.model),
            )
            llm = create_llm_client(cfg)

            # Traits are required
            if not data.traits:
                raise ValueError("Traits are required for demographic generation. Please add at least one trait (e.g., Trust, Empathy) with mean and standard deviation values.")

            # Demographics are required
            if not data.demographics:
                raise ValueError("Demographics are required for demographic generation. Please add at least one demographic dimension (e.g., Age, Political View).")

            # Validate each demographic has categories
            for demo in data.demographics:
                if not demo.categories or len(demo.categories) == 0:
                    raise ValueError(f"Demographic '{demo.name}' must have at least one category.")

            # Validate trait ranges before passing to generation
            for trait in data.traits:
                mean_val = trait.mean if trait.mean is not None else 0
                std_val = trait.std if trait.std is not None else 0

                if not (0 <= mean_val <= 100):
                    raise ValueError(
                        f"Trait '{trait.name}' mean value {mean_val} is outside valid range [0, 100]. "
                        f"Trait means should represent percentages or scores between 0 and 100."
                    )

                if not (0 <= std_val <= 50):
                    raise ValueError(
                        f"Trait '{trait.name}' std value {std_val} is outside valid range [0, 50]. "
                        f"Standard deviation represents variation from the mean and should not exceed 50."
                    )

            # Check probability sum and warn if not normalized
            if data.archetype_probabilities:
                prob_sum = sum(data.archetype_probabilities.values())
                tolerance = 0.01
                if abs(prob_sum - 1.0) > tolerance:
                    logger.warning(
                        f"Archetype probabilities sum to {prob_sum:.3f}, not 1.0. "
                        f"Probabilities will be automatically normalized."
                    )

            # Convert Pydantic models to dicts for llm.py function
            demographics_dicts = [
                {"name": d.name, "categories": d.categories}
                for d in data.demographics
            ]

            traits_dicts = [
                {"name": t.name, "mean": t.mean, "std": t.std}
                for t in data.traits
            ]

            # 🎯 Call the integrated AgentTorch function from llm.py
            # Note: provider_id is NOT passed here to avoid confounding
            # Providers are distributed AFTER generation using stratified distribution
            try:
                agents_data = generate_agents_with_archetypes(
                    total_agents=data.total_agents,
                    demographics=demographics_dicts,
                    archetype_probabilities=data.archetype_probabilities,
                    traits=traits_dicts,
                    llm_client=llm,
                    language=data.language,
                )
            except ValueError as ve:
                # Re-raise ValueError with more context
                raise ValueError(f"Agent generation validation failed: {ve}")
            except RuntimeError as re:
                # LLM or JSON parsing error
                raise RuntimeError(f"LLM agent generation failed: {re}")
            except Exception as e:
                # Unexpected error during generation
                raise RuntimeError(f"Unexpected error during agent generation: {e}")

            # 🎯 STRATIFIED PROVIDER DISTRIBUTION
            # Query all available providers for the user to avoid confounding
            all_providers_result = await session.execute(
                select(ProviderConfig).where(ProviderConfig.user_id == current_user.id)
            )
            all_providers = all_providers_result.scalars().all()

            if not all_providers:
                raise ValueError("No LLM providers configured for user")

            # Build provider ID list for stratified distribution
            provider_ids = [p.id for p in all_providers if p.id is not None]
            provider_map = {p.id: p for p in all_providers}
            num_providers = len(provider_ids)

            # Algorithm for confounding-free distribution:
            # 1. Group agents by archetype
            # 2. Within each archetype, assign models in round-robin
            # 3. Track totals per model to ensure even distribution
            # 4. Goal: each model gets exactly 50/num_providers agents

            agents_per_model = data.total_agents // num_providers
            model_counts = {pid: 0 for pid in provider_ids}
            provider_assignment = {}

            # Group agents by archetype
            from collections import defaultdict
            agents_by_archetype = defaultdict(list)
            for agent in agents_data:
                archetype_id = agent.get("properties", {}).get("archetype_id", "unknown")
                agents_by_archetype[archetype_id].append(agent)

            # DEBUG: Log stratified distribution start
            logger.info(f"🎯 STRATIFIED DISTRIBUTION: {len(agents_data)} agents, {num_providers} providers, {len(agents_by_archetype)} archetypes")
            logger.info(f"🎯 Provider IDs: {provider_ids}, agents_per_model: {agents_per_model}")

            # Track global round-robin index across all archetypes
            global_model_idx = 0

            # Process each archetype and assign models in round-robin
            for archetype_id, archetype_agents in sorted(agents_by_archetype.items()):
                for agent in archetype_agents:
                    agent_name = agent.get("name", "Agent")

                    # Find next model that hasn't reached its quota
                    attempts = 0
                    while attempts < num_providers:
                        model_id = provider_ids[global_model_idx % num_providers]
                        global_model_idx += 1

                        if model_counts[model_id] < agents_per_model:
                            model_counts[model_id] += 1
                            provider_assignment[agent_name] = model_id
                            # DEBUG: Log each assignment
                            logger.info(f"🎯 DEBUG: Assigned provider {model_id} to {agent_name} in archetype {archetype_id}")
                            break
                        attempts += 1
                    else:
                        # If all models at quota, assign to first available
                        # (this handles remainder when 50 % num_providers != 0)
                        for pid in provider_ids:
                            if model_counts[pid] < agents_per_model + 1:
                                model_counts[pid] += 1
                                provider_assignment[agent_name] = pid
                                logger.info(f"🎯 DEBUG: Assigned provider {pid} to {agent_name} (overflow) in archetype {archetype_id}")
                                break

            # DEBUG: Log final distribution
            logger.info(f"🎯 FINAL MODEL COUNTS: {model_counts}")
            logger.info(f"🎯 TOTAL ASSIGNMENTS: {len(provider_assignment)}")

            # Convert to GeneratedAgent response models with stratified provider assignment
            agents: List[GeneratedAgent] = []
            for agent_dict in agents_data:
                agent_name = agent_dict.get("name", "Agent")
                assigned_provider_id = provider_assignment.get(agent_name)

                # Get provider info from the assigned provider
                # Handle case where assigned_provider_id might be None
                if assigned_provider_id is not None and assigned_provider_id in provider_map:
                    assigned_provider = provider_map[assigned_provider_id]
                else:
                    assigned_provider = provider

                agents.append(
                    GeneratedAgent(
                        id=agent_dict.get("id"),
                        name=agent_name,
                        role=agent_dict.get("role"),
                        profile=agent_dict.get("profile", ""),
                        provider=assigned_provider.provider or "backend" if assigned_provider else "backend",
                        model=assigned_provider.model or "default" if assigned_provider else "default",
                        provider_id=assigned_provider_id,
                        properties=agent_dict.get("properties", {}),
                        history=agent_dict.get("history", {}),
                        memory=agent_dict.get("memory", []),
                        knowledgeBase=agent_dict.get("knowledgeBase", []),
                    )
                )

            logger.info(f"Generated {len(agents)} agents using demographic modeling")
            return agents
    except ValueError as e:
        # Validation errors - return 400 with clear message
        logger.warning(f"Validation error in generate_agents_demographics: {e}")
        raise
    except RuntimeError as e:
        # LLM errors - return 500 with error message
        logger.error(f"LLM error in generate_agents_demographics: {e}")
        raise
    except Exception as e:
        # Unexpected errors
        logger.error(f"Unexpected error in generate_agents_demographics: {e}", exc_info=True)
        raise RuntimeError(f"Failed to generate agents: {e}")


# 暴露 /llm 前缀的 Router
router = Router(
    path="/llm",
    route_handlers=[generate_agents, refine_report, generate_agents_demographics],
)
