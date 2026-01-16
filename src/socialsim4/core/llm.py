import os
import re
import time
import random
import math
import json
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutTimeout
from threading import BoundedSemaphore
from copy import deepcopy
from typing import List, Dict, Any, Optional

import google.generativeai as genai
from openai import OpenAI

from .llm_config import LLMConfig


class LLMClient:
    def __init__(self, provider: LLMConfig):
        self.provider = provider

        # 根据 dialect 初始化底层 client
        if provider.dialect == "openai":
            self.client = OpenAI(api_key=provider.api_key, base_url=provider.base_url)
        elif provider.dialect == "gemini":
            genai.configure(api_key=provider.api_key)
            self.client = genai.GenerativeModel(provider.model)
        elif provider.dialect == "mock":
            self.client = _MockModel()
        else:
            raise ValueError(f"Unknown LLM provider dialect: {provider.dialect}")

        # Timeout and retry settings (environment-driven defaults)
        self.timeout_s = float(os.getenv("LLM_TIMEOUT_S", "30"))
        self.max_retries = int(os.getenv("LLM_MAX_RETRIES", "2"))
        self.retry_backoff_s = float(os.getenv("LLM_RETRY_BACKOFF_S", "1.0"))

        # 每个 LLMClient 自身的并发限流（避免一个模型被同时打崩）
        max_concurrent = int(os.getenv("LLM_MAX_CONCURRENT_PER_CLIENT", "8"))
        if max_concurrent < 1:
            max_concurrent = 1
        self._sem = BoundedSemaphore(max_concurrent)

    # ----------- 新增：用于"强隔离模式"的 clone 方法 -----------
    def clone(self) -> "LLMClient":
        """
        为 LLMClientPool 的"强隔离模式"提供支持：创建一个
        "功能等价但完全独立"的 LLMClient 实例。

        - provider 使用 deepcopy，避免后续修改互相影响；
        - 底层 OpenAI/Gemini/Mock 客户端重新初始化（新连接）；
        - timeout / retries / backoff 从当前实例继承；
        - semaphore 独立，避免并发配额互相影响。
        """
        # 1. 深拷贝 provider 配置
        cloned_provider = deepcopy(self.provider)

        # 2. 构造一个"空壳"实例（绕过 __init__，手动赋值）
        cloned = LLMClient.__new__(LLMClient)
        cloned.provider = cloned_provider

        # 3. 重新初始化底层 client
        if cloned_provider.dialect == "openai":
            cloned.client = OpenAI(
                api_key=cloned_provider.api_key,
                base_url=cloned_provider.base_url,
            )
        elif cloned_provider.dialect == "gemini":
            genai.configure(api_key=cloned_provider.api_key)
            cloned.client = genai.GenerativeModel(cloned_provider.model)
        elif cloned_provider.dialect == "mock":
            cloned.client = _MockModel()
        else:
            raise ValueError(f"Unknown LLM provider dialect: {cloned_provider.dialect}")

        # 4. 继承调用策略配置
        cloned.timeout_s = self.timeout_s
        cloned.max_retries = self.max_retries
        cloned.retry_backoff_s = self.retry_backoff_s

        # 5. 为 clone 分配独立 semaphore
        max_concurrent = int(os.getenv("LLM_MAX_CONCURRENT_PER_CLIENT", "8"))
        if max_concurrent < 1:
            max_concurrent = 1
        cloned._sem = BoundedSemaphore(max_concurrent)

        return cloned

    # ----------- 公共调用封装：并发 + 超时 + 重试 -----------
    def _with_timeout_and_retry(self, fn):
        """
        对单次 LLM 调用做：
        - 并发限流（每个 client 有自己的 semaphore）
        - 超时控制（非 openai 通过线程 + future.timeout，openai 靠 SDK timeout）
        - 重试 + 指数退避

        注意：fn() 本身不应捕获最终异常，否则 retry 机制无法生效。
        """
        last_err = None
        delay = self.retry_backoff_s

        for attempt in range(self.max_retries + 1):
            try:
                with self._sem:
                    if self.provider.dialect == "openai":
                        # OpenAI: 直接调用，超时交给 SDK 的 timeout 参数
                        result = fn()
                    else:
                        # 其他（如 Gemini）：用线程强制执行超时
                        with ThreadPoolExecutor(max_workers=1) as ex:
                            fut = ex.submit(fn)
                            result = fut.result(timeout=self.timeout_s)
                # 调用成功，直接返回结果，结束重试循环
                return result
            except (FutTimeout, Exception) as e:
                last_err = e
                # 如果还有剩余重试次数，做指数退避
                if attempt < self.max_retries:
                    # 这里你可以改成 logger.warning(...)，现在先简单 print
                    print(
                        f"[LLMClient] call failed (attempt {attempt + 1}/{self.max_retries + 1}): "
                        f"{repr(e)}; sleep {delay:.2f}s then retry..."
                    )
                    time.sleep(max(0.0, delay))
                    delay *= 2
                    continue
                # 用尽重试次数，抛出最后一次的异常
                raise last_err

    # ----------- Chat API -----------
    def chat(self, messages):
        if self.provider.dialect == "openai":

            def _do():
                msgs = [
                    {"role": m["role"], "content": m["content"]}
                    for m in messages
                    if m["role"] in ("system", "user", "assistant")
                ]
                resp = self.client.chat.completions.create(
                    model=self.provider.model,
                    messages=msgs,
                    frequency_penalty=self.provider.frequency_penalty,
                    presence_penalty=self.provider.presence_penalty,
                    max_tokens=self.provider.max_tokens,
                    temperature=self.provider.temperature,
                    timeout=self.timeout_s,  # SDK 级别超时
                )
                return resp.choices[0].message.content.strip()

            return self._with_timeout_and_retry(_do)

        if self.provider.dialect == "gemini":

            def _do():
                contents = [
                    {
                        "role": ("model" if m["role"] == "assistant" else "user"),
                        "parts": [{"text": m["content"]}],
                    }
                    for m in messages
                    if m["role"] in ("system", "user", "assistant")
                ]
                resp = self.client.generate_content(
                    contents,
                    generation_config={
                        "temperature": self.provider.temperature,
                        "max_output_tokens": self.provider.max_tokens,
                        "top_p": self.provider.top_p,
                        "frequency_penalty": self.provider.frequency_penalty,
                        "presence_penalty": self.provider.presence_penalty,
                    },
                )
                # Some responses may not populate resp.text; extract from candidates if present
                text = ""
                cands = getattr(resp, "candidates", None)
                if cands:
                    first = cands[0] if len(cands) > 0 else None
                    if first is not None:
                        content = getattr(first, "content", None)
                        parts = getattr(content, "parts", None) if content is not None else None
                        if parts:
                            text = "".join([getattr(p, "text", "") for p in parts])
                return text.strip()

            return self._with_timeout_and_retry(_do)

        if self.provider.dialect == "mock":

            def _do():
                return self.client.chat(messages)

            return self._with_timeout_and_retry(_do)

        raise ValueError(f"Unknown LLM dialect: {self.provider.dialect}")

    # ----------- Completion API -----------
    def completion(self, prompt):
        # 这些接口通常不在主仿真路径里，但也可以复用 retry 逻辑
        if self.provider.dialect == "openai":

            def _do():
                resp = self.client.completions.create(
                    model=self.provider.model,
                    prompt=prompt,
                    temperature=self.provider.temperature,
                    max_tokens=self.provider.max_tokens,
                    timeout=self.timeout_s,
                )
                return resp.choices[0].text.strip()

            return self._with_timeout_and_retry(_do)

        if self.provider.dialect == "gemini":

            def _do():
                resp = self.client.generate_content(prompt)
                return resp.text.strip() if getattr(resp, "text", None) else ""

            return self._with_timeout_and_retry(_do)

        if self.provider.dialect == "mock":
            return ""

        raise ValueError(f"Unknown LLM dialect: {self.provider.dialect}")

    # ----------- Embedding API -----------
    def embedding(self, text):
        if self.provider.dialect == "openai":

            def _do():
                resp = self.client.embeddings.create(
                    model=self.provider.model,
                    input=text,
                    timeout=self.timeout_s,
                )
                return resp.data[0].embedding

            return self._with_timeout_and_retry(_do)

        if self.provider.dialect == "gemini":

            def _do():
                return genai.embed_content(
                    model=self.provider.model,
                    content=text,
                )["embedding"]

            return self._with_timeout_and_retry(_do)

        if self.provider.dialect == "mock":
            return []

        raise ValueError(f"Unknown LLM dialect: {self.provider.dialect}")


def create_llm_client(provider: LLMConfig) -> LLMClient:
    return LLMClient(provider)


class _MockModel:
    """Deterministic local stub for offline testing."""

    def __init__(self):
        self.agent_calls = {}

    def chat(self, messages):
        sys_text = next((m["content"] for m in messages if m["role"] == "system"), "")
        m = re.search(r"You are\s+([^\n\.]+)", sys_text)
        agent_name = m.group(1).strip() if m else "Agent"
        self.agent_calls[agent_name] = self.agent_calls.get(agent_name, 0) + 1
        call_n = self.agent_calls[agent_name]
        sys_lower = sys_text.lower()

        if "grid-based virtual village" in sys_lower:
            scene = "map"
        elif "vote" in sys_lower or "voting" in sys_lower:
            scene = "council"
        elif "you are living in a virtual village" in sys_lower:
            scene = "village"
        elif "werewolf" in sys_lower:
            scene = "werewolf"
        elif "dou dizhu" in sys_lower or "landlord" in sys_lower:
            scene = "landlord"
        else:
            scene = "chat"

        if scene == "council":
            if agent_name.lower() == "host":
                if call_n == 1:
                    action = {"action": "send_message", "message": "Good morning, council."}
                    thought = "Open the session briefly."
                    plan = "1. Greet. [CURRENT]"
                else:
                    action = {"action": "yield"}
                    thought = "Yield the floor for members to respond."
                    plan = "1. Yield. [CURRENT]"
            else:
                if call_n == 1:
                    action = {"action": "send_message", "message": "I support moving forward."}
                    thought = "Make a brief opening remark."
                    plan = "1. Remark. [CURRENT]"
                else:
                    action = {"action": "yield"}
                    thought = "No further comment now."
                    plan = "1. Yield. [CURRENT]"
            plan_update = "no change"

        elif scene == "map":
            if call_n == 1:
                action = {"action": "look_around"}
                thought = "Scout surroundings before moving."
                plan = "1. Look around. [CURRENT]"
            else:
                action = {"action": "yield"}
                thought = "Pause to let others act."
                plan = "1. Yield. [CURRENT]"
            plan_update = "no change"

        elif scene == "village":
            if call_n == 1:
                action = {
                    "action": "send_message",
                    "message": "Good morning everyone!",
                }
                thought = "Greet others in the village."
                plan = "1. Greet. [CURRENT]"
            else:
                action = {"action": "yield"}
                thought = "No need to say more now."
                plan = "1. Yield. [CURRENT]"
            plan_update = "no change"

        elif scene == "werewolf":
            # Heuristic role detection from system profile
            role = "villager"
            if "you are the seer" in sys_lower or "you are seer" in sys_lower:
                role = "seer"
            elif "you are the witch" in sys_lower or "you are witch" in sys_lower:
                role = "witch"
            elif "you are a werewolf" in sys_lower or "you are werewolf" in sys_lower:
                role = "werewolf"

            # Use fixed names from demo to make actions meaningful
            default_targets = ["Pia", "Taro", "Elena", "Bram", "Ronan", "Mira"]

            def pick_other(exclude):
                for n in default_targets:
                    if n != exclude:
                        return n
                return "Pia"

            if call_n == 1:
                if role == "werewolf":
                    action = {"action": "night_kill", "target": "Pia"}
                    thought = "Coordinate a night kill discreetly."
                    plan = "1. Night kill. [CURRENT]"
                elif role == "seer":
                    action = {"action": "inspect", "target": "Ronan"}
                    thought = "Inspect a likely suspect."
                    plan = "1. Inspect. [CURRENT]"
                elif role == "witch":
                    action = {"action": "witch_save"}
                    thought = "Prepare to save tonight's victim."
                    plan = "1. Save. [CURRENT]"
                else:  # villager
                    action = {"action": "yield"}
                    thought = "Nothing to do at night."
                    plan = "1. Wait. [CURRENT]"
            else:
                # Daytime: cast a vote
                target = "Ronan" if role != "werewolf" else "Elena"
                action = {"action": "vote_lynch", "target": target}
                thought = "Participate in the day vote."
                plan = "1. Vote. [CURRENT]"

            plan_update = "no change"

        elif scene == "landlord":
            # Parse latest status to infer phase and current actor
            status = None
            for m in reversed(messages):
                if (
                    m.get("role") == "user"
                    and isinstance(m.get("content"), str)
                    and "Status:" in m.get("content")
                ):
                    status = m["content"]
                    break
            phase = ""
            if status:
                mm = re.search(r"Phase:\s*([a-zA-Z_]+)", status)
                if mm:
                    phase = mm.group(1).strip()
            # Default conservative policy
            act = {"action": "yield"}
            if phase == "bidding":
                # First time: try to call, otherwise pass
                if self.agent_calls[agent_name] == 1:
                    act = {"action": "call_landlord"}
                else:
                    act = {"action": "pass"}
                thought = "Decide whether to call landlord."
                plan = "1. Act in bidding. [CURRENT]"
            elif phase == "doubling":
                act = {"action": "no_double"}
                thought = "Decline doubling."
                plan = "1. Consider doubling. [CURRENT]"
            elif phase == "playing":
                # Try to play the smallest single from the explicit Hand tokens in status
                smallest = None
                if status:
                    hm = re.search(r"Hand:\s*([\w\s]+)", status)
                    if hm:
                        toks = [
                            t
                            for t in hm.group(1).strip().split()
                            if t and t != "(empty)"
                        ]
                        order = [
                            "3",
                            "4",
                            "5",
                            "6",
                            "7",
                            "8",
                            "9",
                            "10",
                            "J",
                            "Q",
                            "K",
                            "A",
                            "2",
                            "SJ",
                            "BJ",
                        ]
                        for r in order:
                            if r in toks:
                                smallest = r
                                break
                if smallest is None:
                    act = {"action": "yield"}
                    thought = "No cards to play."
                    plan = "1. Yield. [CURRENT]"
                else:
                    act = {"action": "play_cards", "cards": smallest}
                    thought = "Try a small single."
                    plan = "1. Play a small single. [CURRENT]"
            else:
                thought = "Wait."
                plan = "1. Yield. [CURRENT]"

            # Render response
            # Produce exact one Action block
            inner = ""
            if act["action"] == "play_cards":
                inner = f"<cards>{act['cards']}</cards>"
            xml = (
                f'<Action name="{act["action"]}">{inner}</Action>'
                if inner
                else f'<Action name="{act["action"]}" />'
            )
            plan_update = "no change"
            return (
                f"--- Thoughts ---\n{thought}\n\n"
                f"--- Plan ---\n{plan}\n\n"
                f"--- Action ---\n{xml}\n\n"
                f"--- Plan Update ---\n{plan_update}"
            )

        else:  # simple chat
            # One sentence per turn: if this is an intra-turn continuation (agent was nudged with 'Continue.'), then yield.
            last_user = None
            for m in reversed(messages):
                if m.get("role") == "user":
                    last_user = (m.get("content") or "").strip()
                    break
            is_continuation = (last_user == "Continue.")
            if is_continuation:
                action = {"action": "yield"}
                thought = "Already spoke this turn; yield."
                plan = "1. Yield. [CURRENT]"
            else:
                # Speak exactly once per turn
                idx = self.agent_calls.get(agent_name, 1)
                action = {
                    "action": "send_message",
                    "message": f"[{idx}] Hello from {agent_name}.",
                }
                thought = "Say one line this turn."
                plan = "1. Speak once. [CURRENT]"
            plan_update = "no change"

        # Compose full response with XML Action
        return (
            f"--- Thoughts ---\n{thought}\n\n"
            f"--- Plan ---\n{plan}\n\n"
            f"--- Action ---\n{action_to_xml(action)}\n\n"
            f"--- Plan Update ---\n{plan_update}\n"
        )


def action_to_xml(a):
    name = a.get("action") or a.get("name") or "yield"
    params = [k for k in a.keys() if k not in ("action", "name")]
    if not params:
        return f'<Action name="{name}" />'
    parts = "".join([f"<{k}>{a[k]}</{k}>" for k in params])
    return f'<Action name="{name}">{parts}</Action>'


# =============================================================================
# AgentTorch Integration: Archetype-Based Agent Generation
# =============================================================================

def generate_archetypes_from_demographics(demographics: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Generate all archetype combinations from demographics.
    
    Args:
        demographics: List of {"name": str, "categories": List[str]}
    
    Returns:
        List of archetypes: [{"id", "attributes", "label", "probability"}, ...]
    """
    if not demographics:
        return []
    
    # Start with first demographic
    combinations = [{demographics[0]["name"]: cat} for cat in demographics[0]["categories"]]
    
    # Cross-product with remaining demographics
    for demo in demographics[1:]:
        new_combinations = []
        for combo in combinations:
            for cat in demo["categories"]:
                new_combo = dict(combo)
                new_combo[demo["name"]] = cat
                new_combinations.append(new_combo)
        combinations = new_combinations
    
    # Create archetype objects
    equal_prob = 1.0 / len(combinations) if combinations else 0
    archetypes = []
    for i, attrs in enumerate(combinations):
        label = " | ".join(f"{k}: {v}" for k, v in attrs.items())
        archetypes.append({
            "id": f"arch_{i}",
            "attributes": attrs,
            "label": label,
            "probability": equal_prob
        })
    
    return archetypes


def add_gaussian_noise(value: float, std_dev: float, min_val: float = 0, max_val: float = 100) -> int:
    """Add Gaussian noise to a value and clamp to min/max range."""
    u1 = random.random() or 0.0001
    u2 = random.random()
    z = math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)
    noisy = value + z * std_dev
    return int(round(max(min_val, min(max_val, noisy))))


def generate_archetype_template(
    archetype: Dict[str, Any], 
    llm_client: LLMClient,
    language: str = "en"
) -> Dict[str, Any]:
    """
    Make ONE LLM call to get description and roles only.
    Traits are now user-specified, not LLM-generated.
    """
    attrs_str = ", ".join(f"{k}: {v}" for k, v in archetype["attributes"].items())

    if language == "zh":
        prompt = f"""为此人口创建角色模板: {attrs_str}

返回这个格式的JSON:
{{"description": "一句人物描述", "roles": ["职业1", "职业2", "职业3", "职业4", "职业5"]}}

仅输出JSON，无其他文字。"""
    else:
        prompt = f"""Create agent template for: {attrs_str}

Return JSON in this exact format:
{{"description": "one sentence bio", "roles": ["Job Title 1", "Job Title 2", "Job Title 3", "Job Title 4", "Job Title 5"]}}

JSON only, no other text."""

    messages = [
        {"role": "system", "content": "Return only valid JSON."},
        {"role": "user", "content": prompt}
    ]
    
    response = llm_client.chat(messages)

    # DEBUG
    print(f"\n{'='*60}")
    print(f"[DEBUG] Archetype: {attrs_str}")
    print(f"[DEBUG] LLM Response: {response}")
    print(f"{'='*60}\n")

    # Strip markdown code blocks if present
    cleaned = response.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned)
        cleaned = re.sub(r'\s*```$', '', cleaned)

    # Try to parse JSON from response
    json_match = re.search(r'\{[\s\S]*\}', cleaned)
    if not json_match:
        raise RuntimeError(f"No JSON found in LLM response for archetype {attrs_str}")

    parsed = json.loads(json_match.group())

    # Validate required fields
    if "description" not in parsed or not isinstance(parsed["description"], str):
        raise RuntimeError(f"Missing or invalid 'description' for archetype {attrs_str}")
    if "roles" not in parsed or not isinstance(parsed["roles"], list) or len(parsed["roles"]) == 0:
        raise RuntimeError(f"Missing or invalid 'roles' for archetype {attrs_str}")

    # Validate roles are strings
    for i, r in enumerate(parsed["roles"]):
        if not isinstance(r, str):
            raise RuntimeError(f"Role {i} must be a string, got {type(r).__name__} for archetype {attrs_str}")

    return {
        "description": parsed["description"],
        "roles": parsed["roles"]
    }


def generate_agents_with_archetypes(
    total_agents: int,
    demographics: List[Dict[str, Any]],
    archetype_probabilities: Optional[Dict[str, float]],
    traits: List[Dict[str, Any]],
    llm_client: LLMClient,
    language: str = "en"
) -> List[Dict[str, Any]]:
    """
    Generate agents based on demographics and archetype probabilities.
    Traits use user-specified mean/std directly.
    """
    # Validate inputs
    if not traits:
        raise ValueError("Traits are required for agent generation")
    
    # Validate trait format
    for trait in traits:
        if "mean" not in trait or "std" not in trait:
            raise ValueError(f"Trait '{trait.get('name', 'unknown')}' must have 'mean' and 'std'")
    
    # Step 1: Generate archetypes
    archetypes = generate_archetypes_from_demographics(demographics)
    if not archetypes:
        return []
    
    # Step 2: Apply custom probabilities
    if archetype_probabilities:
        for arch in archetypes:
            if arch["id"] in archetype_probabilities:
                arch["probability"] = archetype_probabilities[arch["id"]]
    
    # Step 3: Calculate agent counts per archetype
    total_prob = sum(a["probability"] for a in archetypes) or 1.0
    counts = {}
    remaining = total_agents
    
    for i, arch in enumerate(archetypes):
        if i == len(archetypes) - 1:
            counts[arch["id"]] = remaining
        else:
            normalized_prob = arch["probability"] / total_prob
            count = int(round(total_agents * normalized_prob))
            count = min(count, remaining)
            counts[arch["id"]] = count
            remaining -= count
    
    # Step 4: Generate agents - ONE ARCHETYPE AT A TIME
    agents = []
    global_index = 0
    
    for arch in archetypes:
        count = counts.get(arch["id"], 0)
        if count == 0:
            continue
        
        # ONE LLM call per archetype to get description and roles only
        template = generate_archetype_template(arch, llm_client, language)
        
        # Create agents with random role and Gaussian noise on traits
        for i in range(count):
            agent_num = global_index + 1
            name = f"Agent {agent_num}"
            
            # Randomly assign a role from LLM-generated list
            role = random.choice(template["roles"]) if template["roles"] else "Citizen"
            
            # Generate trait values with Gaussian noise using USER-SPECIFIED mean/std
            properties = {
                "archetype_id": arch["id"],
                "archetype_label": arch["label"],
                **arch["attributes"]
            }
            
            for trait in traits:
                value = add_gaussian_noise(
                    trait["mean"], 
                    trait["std"],
                    0,    # min clamp
                    100   # max clamp (or make configurable)
                )
                properties[trait["name"]] = value
            
            # Profile is just the description
            profile = template["description"]
            
            agent = {
                "id": f"agent_{agent_num}",
                "name": name,
                "role": role,
                "avatarUrl": f"https://api.dicebear.com/7.x/avataaars/svg?seed=agent{agent_num}",
                "profile": profile,
                "properties": properties,
                "history": {},
                "memory": [],
                "knowledgeBase": []
            }
            
            agents.append(agent)
            global_index += 1
    
    return agents
