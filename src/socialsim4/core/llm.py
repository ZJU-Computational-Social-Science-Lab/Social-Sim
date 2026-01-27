import base64
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutTimeout
from threading import BoundedSemaphore
from copy import deepcopy
from urllib.parse import urlparse
from typing import Literal

from openai import OpenAI
import google.generativeai as genai
import httpx

from .llm_config import LLMConfig


# SSRF prevention: allowed URL schemes for media content
_ALLOWED_URL_SCHEMES = {"http", "https", "data"}

# SSRF prevention: denylist of private/internal network patterns
# These patterns prevent the vision model from accessing internal resources
_PRIVATE_NETWORK_PATTERNS = (
    r"127\.\d+\.\d+\.\d+",  # 127.0.0.0/8
    r"10\.\d+\.\d+\.\d+",  # 10.0.0.0/8
    r"172\.(1[6-9]|2\d|3[01])\.\d+\.\d+",  # 172.16.0.0/12
    r"192\.168\.\d+\.\d+",  # 192.168.0.0/16
    r"169\.254\.\d+\.\d+",  # 169.254.0.0/16 (link-local)
    r"::1$",  # IPv6 localhost
    r"fe80::",  # IPv6 link-local
    r"fc00::",  # IPv6 unique local
    r"localhost",  # localhost hostname
    r"0\.0\.0\.0",  # 0.0.0.0
)

def _is_private_network_url(url: str) -> bool:
    """Check if a URL points to a private/internal network (SSRF prevention)."""
    if url.startswith("data:"):
        return False  # data URLs are safe (embedded content)

    try:
        parsed = urlparse(url)
        hostname = parsed.hostname or ""

        # Check against private network patterns
        for pattern in _PRIVATE_NETWORK_PATTERNS:
            if re.search(pattern, hostname, re.IGNORECASE):
                return True

        # Block metadata addresses like <metadata> in cloud providers
        if hostname in ("metadata", "169.254.169.254"):
            return True

        return False
    except Exception:
        # If URL parsing fails, treat as potentially unsafe
        return True


def validate_media_url(url: str) -> Literal["valid", "invalid_scheme", "private_network"]:
    """
    Validate a media URL for SSRF prevention.

    Returns:
        "valid": URL is safe to pass to vision models
        "invalid_scheme": URL uses a disallowed scheme
        "private_network": URL points to a private/internal network
    """
    if not isinstance(url, str):
        return "invalid_scheme"

    # Check scheme
    if not any(url.startswith(f"{scheme}:") for scheme in _ALLOWED_URL_SCHEMES):
        return "invalid_scheme"

    # Check for private network addresses
    if _is_private_network_url(url):
        return "private_network"

    return "valid"


class LLMClient:
    def __init__(self, provider: LLMConfig):
        self.provider = provider

        # Timeout and retry settings (environment-driven defaults)
        self.timeout_s = float(os.getenv("LLM_TIMEOUT_S", "30"))
        self.max_retries = int(os.getenv("LLM_MAX_RETRIES", "2"))
        self.retry_backoff_s = float(os.getenv("LLM_RETRY_BACKOFF_S", "1.0"))

        # 每个 LLMClient 自身的并发限流（避免一个模型被同时打崩）
        max_concurrent = int(os.getenv("LLM_MAX_CONCURRENT_PER_CLIENT", "8"))
        if max_concurrent < 1:
            max_concurrent = 1
        self._sem = BoundedSemaphore(max_concurrent)

        # 根据 dialect 初始化底层 client
        if provider.dialect == "openai":
            self.client = OpenAI(api_key=provider.api_key, base_url=provider.base_url)
        elif provider.dialect == "gemini":
            genai.configure(api_key=provider.api_key)
            self.client = genai.GenerativeModel(provider.model)
        elif provider.dialect == "mock":
            self.client = _MockModel()
        elif provider.dialect == "ollama":
            base_url = provider.base_url or os.getenv("OLLAMA_BASE_URL") or "http://127.0.0.1:11434"
            self.client = httpx.Client(base_url=base_url, timeout=self.timeout_s)
        else:
            raise ValueError(f"Unknown LLM provider dialect: {provider.dialect}")

    # ----------- 新增：用于“强隔离模式”的 clone 方法 -----------
    def clone(self) -> "LLMClient":
        """
        为 LLMClientPool 的“强隔离模式”提供支持：创建一个
        “功能等价但完全独立”的 LLMClient 实例。

        - provider 使用 deepcopy，避免后续修改互相影响；
        - 底层 OpenAI/Gemini/Mock 客户端重新初始化（新连接）；
        - timeout / retries / backoff 从当前实例继承；
        - semaphore 独立，避免并发配额互相影响。
        """
        # 1. 深拷贝 provider 配置
        cloned_provider = deepcopy(self.provider)

        # 2. 构造一个“空壳”实例（绕过 __init__，手动赋值）
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
        elif cloned_provider.dialect == "ollama":
            base_url = cloned_provider.base_url or os.getenv("OLLAMA_BASE_URL") or "http://127.0.0.1:11434"
            cloned.client = httpx.Client(base_url=base_url, timeout=self.timeout_s)
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
        # 统一规范消息：支持 text + images，并在不支持 vision 的模型上降级为带占位符的纯文本
        supports_vision = bool(getattr(self.provider, "supports_vision", False))

        def _safe_media_urls(urls):
            """Validate and filter media URLs for SSRF prevention."""
            safe = []
            for url in urls or []:
                if not isinstance(url, str):
                    continue
                validation = validate_media_url(url)
                if validation == "valid":
                    safe.append(url)
                else:
                    # Log unsafe URL and skip it
                    print(f"[LLMClient] Skipping unsafe media URL ({validation}): {url[:50]}...")
            return safe

        def _merge_with_placeholders(text, images, audio, video, include_image_placeholder):
            parts = []
            if text:
                parts.append(text)
            if include_image_placeholder and images:
                parts.append("\n".join([f"[image: {u}]" for u in images]))
            if audio:
                parts.append("\n".join([f"[audio: {u}]" for u in audio]))
            if video:
                parts.append("\n".join([f"[video: {u}]" for u in video]))
            return "\n".join([p for p in parts if p])

        def _normalize_for_openai(msgs, allow_vision):
            norm = []
            for m in msgs:
                role = m.get("role")
                if role not in ("system", "user", "assistant"):
                    continue
                text = m.get("content") or ""
                images = _safe_media_urls(m.get("images"))
                audio = _safe_media_urls(m.get("audio"))
                video = _safe_media_urls(m.get("video"))
                if allow_vision and images:
                    merged_text = _merge_with_placeholders(text, [], audio, video, include_image_placeholder=False)
                    parts = []
                    if merged_text:
                        parts.append({"type": "text", "text": merged_text})
                    for url in images:
                        if not url:
                            continue
                        parts.append({"type": "image_url", "image_url": {"url": url}})
                    norm.append({"role": role, "content": parts})
                else:
                    content = _merge_with_placeholders(text, images, audio, video, include_image_placeholder=True)
                    norm.append({"role": role, "content": content})
            return norm

        def _normalize_for_gemini(msgs, allow_vision):
            norm = []
            for m in msgs:
                role = m.get("role")
                if role not in ("system", "user", "assistant"):
                    continue
                text = m.get("content") or ""
                images = _safe_media_urls(m.get("images"))
                audio = _safe_media_urls(m.get("audio"))
                video = _safe_media_urls(m.get("video"))
                if allow_vision and images:
                    merged_text = _merge_with_placeholders(text, [], audio, video, include_image_placeholder=False)
                    parts = []
                    if merged_text:
                        parts.append({"text": merged_text})
                    for url in images:
                        if not url:
                            continue
                        parts.append({"image_url": url})
                    norm.append({"role": ("model" if role == "assistant" else "user"), "parts": parts})
                else:
                    merged = _merge_with_placeholders(text, images, audio, video, include_image_placeholder=True)
                    norm.append({"role": ("model" if role == "assistant" else "user"), "parts": [{"text": merged}]})
            return norm

        def _normalize_for_mock(msgs):
            norm = []
            for m in msgs:
                role = m.get("role")
                if role not in ("system", "user", "assistant"):
                    continue
                text = m.get("content") or ""
                images = _safe_media_urls(m.get("images"))
                audio = _safe_media_urls(m.get("audio"))
                video = _safe_media_urls(m.get("video"))
                merged = _merge_with_placeholders(text, images, audio, video, include_image_placeholder=True)
                norm.append({"role": role, "content": merged})
            return norm

        def _normalize_for_ollama(msgs, allow_vision):
            norm = []
            for m in msgs:
                role = m.get("role")
                if role not in ("system", "user", "assistant"):
                    continue
                text = m.get("content") or ""
                images = _safe_media_urls(m.get("images"))
                audio = _safe_media_urls(m.get("audio"))
                video = _safe_media_urls(m.get("video"))
                entry = {
                    "role": role,
                    "content": _merge_with_placeholders(
                        text,
                        [] if allow_vision else images,
                        audio,
                        video,
                        include_image_placeholder=not allow_vision,
                    ),
                }
                if allow_vision and images:
                    entry["images"] = images
                norm.append(entry)
            return norm

        if self.provider.dialect == "openai":

            def _do():
                msgs = _normalize_for_openai(messages, supports_vision)
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
                contents = _normalize_for_gemini(messages, supports_vision)
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
                msgs = _normalize_for_mock(messages)
                return self.client.chat(msgs)

            return self._with_timeout_and_retry(_do)

        if self.provider.dialect == "ollama":

            def _encode_images(urls):
                encoded = []
                for url in urls or []:
                    if url.startswith("data:"):
                        parts = url.split(",", 1)
                        if len(parts) == 2:
                            encoded.append(parts[1])
                        continue
                    # Validate URL before fetching (SSRF protection)
                    validation = validate_media_url(url)
                    if validation != "valid":
                        print(f"[LLMClient] Skipping unsafe image URL ({validation}): {url[:50]}...")
                        continue
                    resp = self.client.get(url, timeout=10)
                    resp.raise_for_status()
                    encoded.append(base64.b64encode(resp.content).decode("utf-8"))
                return encoded

            def _do():
                msgs = _normalize_for_ollama(messages, supports_vision)
                for m in msgs:
                    if supports_vision and m.get("images"):
                        m["images"] = _encode_images(m.get("images"))
                payload = {
                    "model": self.provider.model,
                    "messages": msgs,
                    "stream": False,
                    "options": {
                        "temperature": self.provider.temperature,
                        "top_p": self.provider.top_p,
                        "num_predict": self.provider.max_tokens,
                    },
                }
                resp = self.client.post("/api/chat", json=payload, timeout=self.timeout_s)
                resp.raise_for_status()
                data = resp.json()
                message = data.get("message") or {}
                content = message.get("content") or data.get("response") or ""
                return str(content).strip()

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

        if self.provider.dialect == "ollama":

            def _do():
                payload = {
                    "model": self.provider.model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": self.provider.temperature,
                        "top_p": self.provider.top_p,
                        "num_predict": self.provider.max_tokens,
                    },
                }
                resp = self.client.post("/api/generate", json=payload, timeout=self.timeout_s)
                resp.raise_for_status()
                data = resp.json()
                return str(data.get("response") or "").strip()

            return self._with_timeout_and_retry(_do)

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

        if self.provider.dialect == "ollama":

            def _do():
                payload = {"model": self.provider.model, "prompt": text}
                resp = self.client.post("/api/embeddings", json=payload, timeout=self.timeout_s)
                resp.raise_for_status()
                data = resp.json()
                embedding = data.get("embedding")
                if embedding is None:
                    raise ValueError("Ollama did not return embedding")
                return embedding

            return self._with_timeout_and_retry(_do)

        raise ValueError(f"Unknown LLM dialect: {self.provider.dialect}")


def create_llm_client(provider: LLMConfig) -> LLMClient:
    return LLMClient(provider)


class _MockModel:
    """Deterministic local stub for offline testing.
    Produces valid Thoughts/Plan/Action and optional Plan Update, with simple heuristics.
    """

    def __init__(self):
        self.agent_calls = {}

    def chat(self, messages):
        # Extract system content (single string)
        sys_text = next((m["content"] for m in messages if m["role"] == "system"), "")

        # Identify agent name
        m = re.search(r"You are\s+([^\n\.]+)", sys_text)
        agent_name = m.group(1).strip() if m else "Agent"
        self.agent_calls[agent_name] = self.agent_calls.get(agent_name, 0) + 1
        call_n = self.agent_calls[agent_name]

        sys_lower = sys_text.lower()

        # Pick scene by keywords in system prompt
        if "grid-based virtual village" in sys_lower:
            scene = "map"
        elif "vote" in sys_lower or "voting" in sys_lower:
            scene = "council"
        elif "you are living in a virtual village" in sys_lower:
            scene = "village"
        else:
            # Detect scenes by keyword
            if "werewolf" in sys_lower:
                scene = "werewolf"
            elif (
                "dou dizhu" in sys_lower
                or "landlord" in sys_lower
                or "landlord_scene" in sys_lower
            ):
                scene = "landlord"
            else:
                scene = "chat"

        if scene == "council":
            if agent_name.lower() == "host":
                if call_n == 1:
                    action = {
                        "action": "send_message",
                        "message": "Good morning, council.",
                    }
                    thought = "Open the session briefly."
                    plan = "1. Greet. [CURRENT]"
                else:
                    action = {"action": "yield"}
                    thought = "Yield the floor for members to respond."
                    plan = "1. Yield. [CURRENT]"
            else:
                if call_n == 1:
                    action = {
                        "action": "send_message",
                        "message": "I support moving forward.",
                    }
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
