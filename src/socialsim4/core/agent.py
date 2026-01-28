import json
import re
import xml.etree.ElementTree as ET

from socialsim4.core.config import MAX_REPEAT
from socialsim4.core.memory import ShortTermMemory

# 假设的最大上下文字符长度（可调整，根据模型实际上下文窗口）
MAX_CONTEXT_CHARS = 100000000
SUMMARY_THRESHOLD = int(MAX_CONTEXT_CHARS * 0.7)  # 70% 阈值


class Agent:
    def __init__(
        self,
        name,
        user_profile,
        style,
        initial_instruction="",
        role_prompt="",
        action_space=[],
        language="en",
        max_repeat=MAX_REPEAT,
        event_handler=None,
        **kwargs,
    ):
        self.name = name
        self.user_profile = user_profile
        self.style = style
        self.initial_instruction = initial_instruction
        self.role_prompt = role_prompt
        self.action_space = action_space
        self.language = language or "en"
        self.short_memory = ShortTermMemory()
        self.last_history_length = 0
        self.max_repeat = max_repeat
        self.properties = kwargs
        self.log_event = event_handler
        self.emotion = kwargs.get("emotion", "neutral")
        self.emotion_enabled = bool(kwargs.get("emotion_enabled", False))

        # Lightweight, scene-agnostic plan state persisted across turns
        self.plan_state = {
            "goals": [],
            "milestones": [],
            "strategy": "",
            "notes": "",
        }

        # ---- Knowledge Base (RAG) ----
        # List of knowledge items: [{id, title, type, content, enabled, timestamp}, ...]
        self.knowledge_base = list(kwargs.get("knowledge_base", []) or [])

        # ---- Documents (Embedded RAG) ----
        # Dict of documents with embeddings: {doc_id: {id, filename, chunks, embeddings, ...}}
        self.documents = dict(kwargs.get("documents", {}) or {})

        # Reference to global knowledge (set by simulator/scene when available)
        self._global_knowledge = None

        # ---- NEW: LLM 错误计数 & 掉线标记 ----
        # 连续 LLM 相关错误计数（调用失败 / 解析失败）
        self.consecutive_llm_errors = 0
        # 连续错误阈值，超过后认为 agent 掉线（可通过 kwargs 覆盖，默认 3）
        self.max_consecutive_llm_errors = int(
            kwargs.get("max_consecutive_llm_errors", 3) or 3
        )
        # agent 是否已被标记为掉线；掉线后 process 会直接返回空动作
        self.is_offline = False
        # ---- NEW END ----


    def system_prompt(self, scene=None):
        # Render plan state for inclusion in system prompt
        def _fmt_list(items):
            if not items:
                return "(none)"
            return "\n".join([f"- {item}" for item in items])

        def _fmt_goals(goals):
            if not goals:
                return "(none)"
            lines = []
            for g in goals:
                gid = g.get("id", "?")
                desc = g.get("desc", "")
                pr = g.get("priority", "")
                st = g.get("status", "pending")
                lines.append(f"- [{gid}] {desc} (priority: {pr}, status: {st})")
            return "\n".join(lines)

        def _fmt_milestones(milestones):
            if not milestones:
                return "(none)"
            lines = []
            for m in milestones:
                mid = m.get("id", "?")
                desc = m.get("desc", "")
                st = m.get("status", "pending")
                lines.append(f"- [{mid}] {desc} (status: {st})")
            return "\n".join(lines)

        plan_state_block = f"""
Internal Plan State:
Internal Goals:
{_fmt_goals(self.plan_state.get("goals"))}

Internal Milestones:
{_fmt_milestones(self.plan_state.get("milestones"))}

Internal Strategy:
{self.plan_state.get("strategy", "")}

Internal Notes:
{self.plan_state.get("notes", "")}
"""

        # If plan_state is empty, explicitly ask the model to initialize it
        if not self.plan_state or (not self.plan_state.get("goals") and not self.plan_state.get("milestones")):
            plan_state_block += "\nPlan State is empty. In this turn, include a plan update block using tags to initialize numbered Goals and Milestones.\n"

        # Build action catalog and usage
        action_catalog = "\n".join([f"- {getattr(action, 'NAME', '')}: {getattr(action, 'DESC', '')}".strip() for action in self.action_space])
        action_instructions = "".join(getattr(action, "INSTRUCTION", "") for action in self.action_space)
        examples_block = ""
        if scene and scene.get_examples():
            examples_block = f"Here are some examples:\n{scene.get_examples()}"

        emotion_prompt = f"Your current emotion is {self.emotion}." if self.emotion_enabled else ""

        # Build knowledge base context
        knowledge_block = ""
        enabled_kb = self.get_enabled_knowledge()
        if enabled_kb:
            kb_count = len(enabled_kb)
            kb_preview = []
            for i, item in enumerate(enabled_kb[:5], 1):  # Show first 5 items as preview
                title = item.get("title", "Untitled")
                content_preview = str(item.get("content", ""))[:80]
                if len(str(item.get("content", ""))) > 80:
                    content_preview += "..."
                kb_preview.append(f"  [{i}] {title}: {content_preview}")
            kb_list = "\n".join(kb_preview)
            if kb_count > 5:
                kb_list += f"\n  ... and {kb_count - 5} more items"
            knowledge_block = f"""
Knowledge Base:
You have a personal knowledge base with {kb_count} item(s) containing information you can reference:
{kb_list}

Use the query_knowledge action to search for specific information when needed. The knowledge base contains facts and information that you should use to inform your responses when relevant.
"""

        base = f"""
You are {self.name}.
You speak in a {self.style} style.
{emotion_prompt}

{self.user_profile}

{self.role_prompt}
{knowledge_block}
{plan_state_block}

Language Policy:
- Output all public messages in {self.language}.
- Keep Action XML element and attribute names in English; localize only values (e.g., <message>…</message>).
- Plan Update tag names remain English; content may be written in {self.language}.
- Do not switch languages unless explicitly asked.

{scene.get_scenario_description() if scene else ""}

{scene.get_behavior_guidelines() if scene else ""}

Action Space:

Available Actions:
{action_catalog}

Usage:
{action_instructions}


{examples_block}


{self.get_output_format()}


Initial instruction:
{self.initial_instruction}
"""
        return base

    def get_output_format(self):
        base_prompt = """
Planning guidelines:
- The Goals, Milestones, Plan, and Current Focus you author here are your inner behavioral plans, not scene-wide commitments. Use them to decide Actions;
- Goals: stable end-states. Rarely change; name and describe them briefly.
- Milestones: observable sub-results that indicate progress toward goals.
- Current Focus: the single step you are executing now. Align Action with this.
- Strategy: a brief approach for achieving the goals over time.
- Prefer continuity: preserve unaffected goals/milestones; make the smallest coherent change when adapting to new information. State what stays the same.
- Avoid repeating the same action, message, or summary across turns. If nothing new advances the plan, yield instead of restating.

Turn Flow:
- Output exactly one Thoughts/Plan/Action block per response.
- Each time you can choose one action from the Action Space to execute.
- Some actions may return immediate results (e.g., briefs, searches). Incorporate them and proceed;
- Some actions may require multiple steps (e.g., complex messages, multi-step tasks), do not yield the floor. The system will schedule your next turn.
- If the next step is clear, take it; when finished, yield the floor with <Action name="yield"></Action>.

Your entire response MUST follow the format below. 
For your first action in each turn, always include Thoughts, Plan, and Action. 
For subsequent actions, output only the Action element. omit Thoughts, Plan, and Plan Update.
Include Plan Update in the end, only when you decide to modify the plan.

--- Thoughts ---
Your internal monologue. Analyze the current situation, your persona, your long-term goals, and the information you have.
Re-evaluation: Compare the latest events with your current plan. Is your plan still relevant? Should you add, remove, or reorder steps? Should you jump to a different step instead of proceeding sequentially? Prefer continuity; preserve unaffected goals and milestones. Explicitly state whether you are keeping or changing the plan and why.
Strategy for This Turn: Based on your re-evaluation, state your immediate objective for this turn and the short rationale for how you will achieve it.

--- Plan ---
// Update the living plan if needed; mark your immediate focus with [CURRENT]. Keep steps concise and executable.
1. [Step 1]
2. [Step 2] [CURRENT]
3. [Step 3]


--- Action ---
// Output exactly one Action XML element. No extra text.
// Do not wrap the Action XML in code fences or other decorations.
// Use one of the actions listed in Available Actions.
// If no avaliable actions, yield.

--- Plan Update ---
// Optional. Include ONLY if you are changing the plan.
// Output either "no change"
// or one or more of these tags (no extra text, no code fences):
//   <Goals>\n1. ...\n2. ... [CURRENT]\n</Goals>
//   <Milestones>\n1. ... [DONE]\n</Milestones>
//   <Strategy>...</Strategy>
//   <Notes>...</Notes>
// Use numbered lists for Goals and Milestones.
"""
        if self.emotion_enabled:
            emotion_rules = """
--- Emotion Update ---
// This section is mandatory.
Emotion Update Rules:
- Always output one emotion after each turn to represent your affective state.
- Use Plutchik’s 8 primary emotions: Joy, Trust, Fear, Surprise, Sadness, Disgust, Anger, Anticipation.
- Combine two if appropriate to form a Dyad emotion (e.g., Joy + Anticipation = Hope).
- Determine emotion by analyzing:
  - Progress toward goals or milestones (positive → Joy/Trust; negative → Sadness/Fear).
  - Novelty or unexpected events (→ Surprise).
  - Conflict or obstacles (→ Anger or Disgust).
  - Anticipation of success or new opportunity (→ Anticipation).
- Prefer continuity; avoid abrupt switches unless major events occur.
"""
            return base_prompt + emotion_rules
        return base_prompt

    def call_llm(self, clients, messages, client_name="chat"):
        client = clients.get(client_name)
        if not client:
            raise ValueError(f"LLM client '{client_name}' not found.")
        # Delegate timeout/retry logic to the client implementation
        return client.chat(messages)

    def summarize_history(self, client):
        # 构建总结prompt
        history_content = "\n".join([f"[{msg['role']}] {msg['content']}" for msg in self.short_memory.get_all()])
        summary_prompt = f"""
Summarize the following conversation history from {self.name}'s perspective. Be concise but capture key points, opinions, ongoing topics, and important events. Output ONLY as 'Summary: [your summary text]'.

History:
{history_content}
"""

        # 为总结调用LLM（使用简单messages）
        messages = [{"role": "user", "content": summary_prompt}]
        summary_output = self.call_llm(client, messages)

        # 提取总结（假设模型遵循格式）
        summary_match = re.search(r"Summary: (.*)", summary_output, re.DOTALL)
        if summary_match:
            summary = summary_match.group(1).strip()
        else:
            summary = summary_output  # Fallback

        # 替换personal_history：用总结作为新的user消息起点
        self.short_memory.clear()
        self.short_memory.append("user", f"Summary: {summary}")
        print(f"{self.name} summarized history.")

    def _parse_full_response(self, full_response):
        """Extracts thoughts, plan, action block, and optional plan update from the response."""
        thoughts_match = re.search(r"--- Thoughts ---\s*(.*?)\s*--- Plan ---", full_response, re.DOTALL)
        plan_match = re.search(r"--- Plan ---\s*(.*?)\s*--- Action ---", full_response, re.DOTALL)
        action_match = re.search(
            r"--- Action ---\s*(.*?)(?:\n--- Plan Update ---|\Z)",
            full_response,
            re.DOTALL,
        )
        plan_update_match = re.search(
            r"--- Plan Update ---\s*(.*?)(?:\n--- Emotion Update ---|\Z)",
            full_response,
            re.DOTALL,
        )
        emotion_update_match = re.search(r"--- Emotion Update ---\s*(.*)$", full_response, re.DOTALL)

        thoughts = thoughts_match.group(1).strip() if thoughts_match else ""
        plan = plan_match.group(1).strip() if plan_match else ""
        action = action_match.group(1).strip() if action_match else ""
        plan_update_block = plan_update_match.group(1).strip() if plan_update_match else ""
        emotion_update_block = emotion_update_match.group(1).strip() if emotion_update_match else ""

        return thoughts, plan, action, plan_update_block, emotion_update_block

    def _parse_emotion_update(self, block):
        """Parse Emotion Update block.
        Returns an emotion string or None (for 'no change').
        """
        if not block:
            return None
        text = block.strip()
        if text.lower().startswith("no change"):
            return None
        return text

    def _parse_plan_update(self, block):
        """Parse Plan Update block in strict tag format.
        Returns a plan_state dict or None (for 'no change').
        """
        if not block:
            return None
        text = block.strip()
        if text.lower().startswith("no change"):
            return None
        xml_text = "<Update>" + text + "</Update>"
        # Normalize bare ampersands so XML parser won't choke on plain '&'
        xml_text = re.sub(
            r"&(?!#\d+;|#x[0-9A-Fa-f]+;|[A-Za-z][A-Za-z0-9]*;)",
            "&amp;",
            xml_text,
        )
        root = ET.fromstring(xml_text)
        if root.tag != "Update":
            return None

        goals_el = None
        milestones_el = None
        strategy_el = None
        notes_el = None
        for child in list(root):
            t = child.tag
            if t == "Goals":
                goals_el = child
            elif t == "Milestones":
                milestones_el = child
            elif t == "Strategy":
                strategy_el = child
            elif t == "Notes":
                notes_el = child
            else:
                raise ValueError(f"Unknown Plan Update tag: {t}")

        def _parse_numbered_lines(txt):
            if txt.strip() == "" or txt.strip().lower() == "(none)":
                return []
            items = []
            lines = [l.strip() for l in (txt or "").splitlines() if l.strip()]
            for l in lines:
                m = re.match(r"^(\d+)\.\s*(.*)$", l)
                if not m:
                    raise ValueError("Malformed Plan Update list line: " + l)
                items.append(m.group(2).strip())
            return items

        result = {
            "goals": [],
            "milestones": [],
            "strategy": "",
            "notes": "",
        }

        current_idx = None
        if goals_el is not None:
            items = _parse_numbered_lines(goals_el.text or "")
            goals = []
            for i, desc in enumerate(items):
                is_cur = "[CURRENT]" in desc
                clean = desc.replace("[CURRENT]", "").strip()
                gid = f"g{i + 1}"
                goals.append(
                    {
                        "id": gid,
                        "desc": clean,
                        "priority": "normal",
                        "status": "current" if is_cur else "pending",
                    }
                )
                if is_cur:
                    if current_idx is not None:
                        raise ValueError("Multiple [CURRENT] markers in Goals")
                    current_idx = i
            result["goals"] = goals

        if milestones_el is not None:
            items = _parse_numbered_lines(milestones_el.text or "")
            ms = []
            for i, desc in enumerate(items):
                done = "[DONE]" in desc
                clean = desc.replace("[DONE]", "").strip()
                ms.append(
                    {
                        "id": f"m{i + 1}",
                        "desc": clean,
                        "status": "done" if done else "pending",
                    }
                )
            result["milestones"] = ms

        if strategy_el is not None:
            result["strategy"] = (strategy_el.text or "").strip()
        if notes_el is not None:
            result["notes"] = (notes_el.text or "").strip()

        return result

    def _apply_plan_update(self, update):
        """Apply plan update by full replace with the provided plan_state dict."""
        if not update:
            return False
        self.plan_state = update
        if self.log_event:
            self.log_event(
                "plan_update",
                {"agent": self.name, "kind": "replace", "plan": update},
            )
        return True

    # Removed: JSON/heuristic inference of plan from free-form Plan text; plan updates are tag-based and replace-only.

    # ---- NEW: LLM 错误记录 & 掉线事件 ----
    def _record_llm_error(self, kind: str, error, attempt: int, final: bool):
        """记录一次 LLM 调用/解析错误，并在超过阈值时触发 agent_error 事件。"""
        self.consecutive_llm_errors += 1

        if self.log_event:
            self.log_event(
                "agent_error",
                {
                    "agent": self.name,
                    "kind": kind,  # "llm_call" / "parse"
                    "error": str(error),
                    "attempt": int(attempt),
                    "consecutive_errors": int(self.consecutive_llm_errors),
                    "final_attempt": bool(final),
                },
            )

        # 超过阈值时，标记掉线并额外发一条 offline 事件（只发一次）
        if (
            self.consecutive_llm_errors >= self.max_consecutive_llm_errors
            and not getattr(self, "is_offline", False)
        ):
            self.is_offline = True
            if self.log_event:
                self.log_event(
                    "agent_error",
                    {
                        "agent": self.name,
                        "kind": "offline",
                        "reason": "too_many_llm_errors",
                        "consecutive_errors": int(self.consecutive_llm_errors),
                    },
                )
    # ---- NEW END ----

    def _parse_actions(self, action_block):
        """Parses the Action XML block and returns a single action dict.
        Expected format:
          <Action name="send_message"><message>Hi</message></Action>
          <Action name="yield"></Action>
        Returns [dict] with keys: 'action' and child tags as top-level fields.
        """

        if not action_block:
            return []
        text = action_block.strip()
        # Strip the content before < and after >
        # help me write it: Strip the content before < and after >
        m1 = re.search(r"<Action.*?>.*</Action>", text, re.DOTALL)
        m2 = re.search(r"<Action.*?/>", text, re.DOTALL)
        m = m1 or m2
        if m:
            text = m.group(0).strip()
        else:
            return []

        # Strip code fences
        if text.startswith("```xml") and text.endswith("```"):
            text = text[6:-3].strip()
        elif text.startswith("```") and text.endswith("```"):
            text = text[3:-3].strip()
        elif text.startswith("`") and text.endswith("`"):
            text = text.strip("`")
        text = text.strip("`")

        # Normalize bare ampersands so XML parser won't choke on plain '&'
        text = re.sub(
            r"&(?!#\d+;|#x[0-9A-Fa-f]+;|[A-Za-z][A-Za-z0-9]*;)",
            "&amp;",
            text,
        )

        # Parse as a single Action element
        root = ET.fromstring(text)

        if root is None or root.tag.lower() != "action":
            return []
        name = root.attrib.get("name") or root.attrib.get("NAME")
        if not name:
            return []
        result = {"action": name}
        # Copy child elements as top-level params (simple text nodes)
        for child in list(root):
            tag = child.tag
            val = (child.text or "").strip()
            if tag and val is not None:
                result[tag] = val
        return [result]

    def process(self, clients, initiative=False, scene=None):
        # 如果已经被标记为掉线，直接不再调用 LLM，返回空动作
        if getattr(self, "is_offline", False):
            return {}

        current_length = len(self.short_memory)
        if current_length == self.last_history_length and not initiative:
            # 没有新事件，无反应
            return {}

        system_prompt = self.system_prompt(scene)

        # Auto-inject RAG context if enabled
        from socialsim4.core.config import RAG_AUTO_INJECT
        if RAG_AUTO_INJECT:
            llm_client = clients.get("chat")
            if llm_client:
                rag_context = self._get_auto_rag_context(llm_client)
                if rag_context:
                    # Append RAG context to system prompt
                    system_prompt += f"""

{rag_context}

Use the above context to inform your responses when relevant.
"""

        # Get history from memory
        ctx = self.short_memory.searilize(dialect="default")
        ctx.insert(0, {"role": "system", "content": system_prompt})

        # Non-ephemeral action-only nudge for intra-turn calls or when last was assistant
        last_role = ctx[-1].get("role") if len(ctx) > 1 else None
        if initiative or last_role == "assistant":
            hint = "Continue."
            self.short_memory.append("user", hint)
            ctx.append({"role": "user", "content": hint})

        # Retry policy: total attempts = 1 + max_repeat (from env/config)
        attempts = int(getattr(self, "max_repeat", 0) or 0) + 1
        plan_update = None
        action_data = []
        llm_output = ""
        success = False  # 标记本轮是否成功拿到可解析输出

        for i in range(attempts):
            # --- 第一步：调用 LLM ---
            try:
                llm_output = self.call_llm(clients, ctx)
            except Exception as e:
                # LLM 调用层面出错（超时 / API 错误等）
                self._record_llm_error(
                    kind="llm_call",
                    error=e,
                    attempt=i + 1,
                    final=(i == attempts - 1),
                )
                # 如果已经被标记为掉线，就不再重试
                if getattr(self, "is_offline", False):
                    break
                # 未掉线且还有重试次数，则继续下一次尝试
                if i < attempts - 1:
                    continue
                # 最后一次尝试也失败，跳出循环（success 仍为 False）
                break

            # --- 第二步：解析 Thoughts/Plan/Action/Plan Update ---
            try:
                (
                    thoughts,
                    plan,
                    action_block,
                    plan_update_block,
                    emotion_update_block,
                ) = self._parse_full_response(llm_output)

                action_data = self._parse_actions(action_block) or self._parse_actions(
                    llm_output
                )
                plan_update = self._parse_plan_update(plan_update_block)

                if self.emotion_enabled:
                    emotion_update = self._parse_emotion_update(
                        emotion_update_block
                    )
                    if emotion_update:
                        self.emotion = emotion_update
                        if self.log_event:
                            self.log_event(
                                "emotion_update",
                                {"agent": self.name, "emotion": emotion_update},
                            )

                # 到这里说明本次调用 + 解析成功
                success = True
                # 成功后重置连续错误计数
                self.consecutive_llm_errors = 0
                break

            except Exception as e:
                # 解析 Action / Plan Update 失败
                self._record_llm_error(
                    kind="parse",
                    error=e,
                    attempt=i + 1,
                    final=(i == attempts - 1),
                )
                if getattr(self, "is_offline", False):
                    break
                if i < attempts - 1:
                    # 打印一下方便本地调试
                    print(
                        f"{self.name} action parse error: {e}; retry {i + 1}/{attempts - 1}..."
                    )
                    continue
                # 最后一次解析也失败，跳出循环（success 仍为 False）
                print(
                    f"{self.name} action parse error after {attempts} attempts: {e}"
                )
                print(
                    f"LLM output (last):\n{llm_output}\n{'-' * 40}"
                )
                break

        # 如果本轮没有成功获取可用 action，就不追加 assistant 消息，也不更新 last_history_length
        if not success:
            return {}

        if plan_update:
            self._apply_plan_update(plan_update)

        # 正常成功路径：把 LLM 输出写入记忆和日志
        self.short_memory.append("assistant", llm_output)
        if self.log_event:
            self.log_event(
                "agent_ctx_delta",
                {"agent": self.name, "role": "assistant", "content": llm_output},
            )
        self.last_history_length = len(self.short_memory)

        return action_data


    def add_env_feedback(self, content, images=None, audio=None, video=None):
        """Add feedback from the simulation environment to the agent's context.

        Stores the feedback as a `user` role entry in short-term memory so the
        agent can react to system/status updates, private confirmations, and
        scene messages.
        """
        self.short_memory.append("user", content, images=images, audio=audio, video=video)
        if self.log_event:
            self.log_event(
                "agent_ctx_delta",
                {
                    "agent": self.name,
                    "role": "user",
                    "content": content,
                    "images": images or [],
                    "audio": audio or [],
                    "video": video or [],
                },
            )

    def append_env_message(self, content):
        """Deprecated: use add_env_feedback(). Kept for compatibility."""
        return self.add_env_feedback(content)

    # ---- Knowledge Base (RAG) methods ----
    def add_knowledge(self, item: dict) -> None:
        """Add a knowledge item to the agent's knowledge base."""
        self.knowledge_base.append(item)

    def remove_knowledge(self, item_id: str) -> bool:
        """Remove a knowledge item by ID. Returns True if found and removed."""
        before_len = len(self.knowledge_base)
        self.knowledge_base = [k for k in self.knowledge_base if k.get("id") != item_id]
        return len(self.knowledge_base) < before_len

    def get_enabled_knowledge(self) -> list:
        """Get all enabled knowledge items."""
        return [k for k in self.knowledge_base if k.get("enabled", True)]

    def query_knowledge(self, query: str, max_results: int = 3) -> list:
        """
        Simple keyword-based retrieval from the knowledge base.
        Returns top matching knowledge items based on keyword overlap.
        """
        if not query or not self.knowledge_base:
            return []

        query_lower = query.lower()
        query_words = set(query_lower.split())

        scored = []
        for item in self.get_enabled_knowledge():
            title = str(item.get("title", "")).lower()
            content = str(item.get("content", "")).lower()
            combined = f"{title} {content}"

            # Simple scoring: count matching words + boost for title matches
            combined_words = set(combined.split())
            title_words = set(title.split())

            word_matches = len(query_words & combined_words)
            title_matches = len(query_words & title_words)

            # Also check for substring matches
            substring_score = 0
            for qw in query_words:
                if qw in combined:
                    substring_score += 1
                if qw in title:
                    substring_score += 2  # Boost title substring matches

            score = word_matches + (title_matches * 2) + substring_score

            if score > 0:
                scored.append((score, item))

        # Sort by score descending, return top results
        scored.sort(key=lambda x: x[0], reverse=True)
        return [item for score, item in scored[:max_results]]

    def get_knowledge_context(self, query: str = "", max_items: int = 5) -> str:
        """
        Get formatted knowledge context to inject into prompts.
        If query is provided, retrieves relevant items. Otherwise returns all enabled items.
        """
        if query:
            items = self.query_knowledge(query, max_items)
        else:
            items = self.get_enabled_knowledge()[:max_items]

        if not items:
            return ""

        lines = ["Your Knowledge Base:"]
        for i, item in enumerate(items, 1):
            title = item.get("title", "Untitled")
            content = item.get("content", "")
            lines.append(f"[{i}] {title}: {content}")

        return "\n".join(lines)

    # ---- Document RAG methods ----
    def set_global_knowledge(self, global_knowledge: dict) -> None:
        """Set reference to global knowledge base for composite retrieval."""
        self._global_knowledge = global_knowledge

    def retrieve_from_documents(self, query_embedding: list, top_k: int = 5) -> list:
        """
        Retrieve relevant chunks from agent's private documents.

        Uses ChromaDB if available, otherwise falls back to JSON cosine similarity.
        Returns list of results sorted by similarity.
        """
        from socialsim4.backend.services.vector_store import get_vector_store
        from socialsim4.backend.services.documents import cosine_similarity

        # Try ChromaDB first
        vector_store = get_vector_store()
        if vector_store and vector_store.use_chromadb:
            results = vector_store.search(self.name, query_embedding, top_k)
            if results:
                return results
            # Fall through to JSON if ChromaDB returns empty

        # JSON fallback: existing cosine similarity code
        results = []
        for doc_id, doc in self.documents.items():
            embeddings = doc.get("embeddings", {})
            chunks = {c["chunk_id"]: c for c in doc.get("chunks", [])}

            for chunk_id, embedding in embeddings.items():
                similarity = cosine_similarity(query_embedding, embedding)
                chunk_data = chunks.get(chunk_id, {})

                results.append({
                    "source": "private",
                    "doc_id": doc_id,
                    "chunk_id": chunk_id,
                    "filename": doc.get("filename", ""),
                    "text": chunk_data.get("text", ""),
                    "similarity": similarity,
                })

        results.sort(key=lambda x: x["similarity"], reverse=True)
        return results[:top_k]

    def composite_rag_retrieve(self, query: str, llm_client, top_k: int = 5) -> list:
        """
        Composite RAG retrieval merging private documents and global knowledge.
        Returns top_k results sorted by similarity.

        NOTE: llm_client parameter kept for backwards compatibility but NOT used for embeddings.
        Query embeddings use MiniLM to match document embeddings.
        """
        from socialsim4.backend.services.documents import (
            retrieve_from_global_knowledge,
            cosine_similarity,
            generate_embedding,  # Import MiniLM-based generation
        )

        all_results = []

        # Generate query embedding using MiniLM (same as documents)
        query_embedding = generate_embedding(query)

        # Retrieve from private documents
        if self.documents:
            private_results = self.retrieve_from_documents(query_embedding, top_k * 2)
            all_results.extend(private_results)

        # Retrieve from global knowledge
        if self._global_knowledge:
            global_results = retrieve_from_global_knowledge(
                query_embedding,
                self._global_knowledge,
                top_k * 2,
            )
            all_results.extend(global_results)

        # Sort by similarity, with private prioritized on tie
        all_results.sort(
            key=lambda x: (x["similarity"] + (0.001 if x["source"] == "private" else 0)),
            reverse=True
        )

        return all_results[:top_k]

    def get_rag_context(self, query: str, llm_client, top_k: int = 5) -> str:
        """
        Get formatted RAG context from documents to inject into prompts.
        Combines results from private documents and global knowledge.

        NOTE: llm_client parameter kept for backwards compatibility but NOT used.
        Query embeddings use MiniLM to match document embeddings.
        """
        # Only do embedding-based retrieval if we have documents or global knowledge
        if not self.documents and not self._global_knowledge:
            return ""

        results = self.composite_rag_retrieve(query, llm_client, top_k)

        if not results:
            return ""

        context_parts = []
        for i, result in enumerate(results, 1):
            source_label = "Personal knowledge" if result["source"] == "private" else "Shared knowledge"
            filename = result.get("filename", "")
            source_info = f" (from {filename})" if filename else ""
            context_parts.append(f"[{i}] {source_label}{source_info}:\n{result['text']}")

        return "\n\nRelevant Context:\n" + "\n\n".join(context_parts)

    def _generate_search_query_from_memory(self) -> str:
        """
        Generate a semantic search query from recent memory.
        Uses last few user messages to extract conversation context.
        """
        recent = self.short_memory.get_all()[-3:]  # Last 3 messages
        if not recent:
            return ""

        # Extract content from user role messages (these contain conversation context)
        user_msgs = [m["content"] for m in recent if m.get("role") == "user"]

        if not user_msgs:
            return ""

        # Use the most recent user message as the query
        # This captures the latest context without being too verbose
        return user_msgs[-1].strip()

    def _summarize_rag_results(self, results: list, llm_client) -> str:
        """
        Summarize retrieved chunks using the LLM to reduce prompt size.

        Only called when total chunk length exceeds RAG_SUMMARY_THRESHOLD.
        Falls back to truncated text if LLM call fails.
        """
        if not results:
            return ""

        # Combine chunks with metadata for context
        chunks_text = "\n\n".join([
            f"[Source: {r.get('filename', 'Unknown document')}]\n{r['text']}"
            for r in results
        ])

        summary_prompt = f"""You are a knowledge summarizer. Given the following retrieved document chunks, produce a concise summary (max 150 words) that captures the key information relevant to an agent's decision-making.

Retrieved Chunks:
{chunks_text}

Output ONLY the summary, nothing else."""

        try:
            summary = llm_client.chat([{"role": "user", "content": summary_prompt}])
            return summary.strip()
        except Exception as e:
            # Fallback: return first 300 chars of first result
            if results and results[0].get("text"):
                fallback = results[0]["text"]
                return fallback[:300] + "..." if len(fallback) > 300 else fallback
            return ""

    def _get_auto_rag_context(self, llm_client) -> str:
        """
        Auto-retrieve and inject relevant context based on recent conversation.
        Applies length-based summarization if chunks are too long.
        """
        from socialsim4.core.config import RAG_SUMMARY_THRESHOLD, RAG_TOP_K_DEFAULT
        from socialsim4.backend.services.documents import composite_rag_retrieval, format_rag_context

        # Only retrieve if we have documents or global knowledge
        if not self.documents and not self._global_knowledge:
            return ""

        # Generate search query from recent memory
        query = self._generate_search_query_from_memory()
        if not query:
            return ""

        # Retrieve relevant chunks
        results = composite_rag_retrieval(
            query=query,
            agent_documents=self.documents,
            global_knowledge=self._global_knowledge,
            top_k=RAG_TOP_K_DEFAULT
        )

        if not results:
            return ""

        # Check total length
        total_length = sum(len(r.get("text", "")) for r in results)

        # Use raw text if under threshold, otherwise summarize
        if total_length <= RAG_SUMMARY_THRESHOLD:
            return format_rag_context(results)
        else:
            return self._summarize_rag_results(results, llm_client)

    def sync_documents_to_vector_store(self) -> bool:
        """
        Sync agent's documents to ChromaDB vector store.

        Called after document upload. Returns True if sync succeeded.
        """
        from socialsim4.backend.services.vector_store import get_vector_store

        vector_store = get_vector_store()
        if not vector_store or not vector_store.use_chromadb:
            return False

        for doc_id, doc in self.documents.items():
            chunks = doc.get("chunks", [])
            # Convert embeddings dict values to list in order
            embeddings = [doc.get("embeddings", {}).get(c["chunk_id"]) for c in chunks]

            # Filter out chunks without embeddings
            valid_chunks = []
            valid_embeddings = []
            for chunk, emb in zip(chunks, embeddings):
                if emb is not None:
                    valid_chunks.append(chunk)
                    valid_embeddings.append(emb)

            if valid_chunks and valid_embeddings:
                vector_store.add_document(self.name, doc_id, valid_chunks, valid_embeddings)

        return True

    def serialize(self):
        # Deep-copy dict/list fields to avoid sharing across snapshots
        mem = [
            {
                "role": m.get("role"),
                "content": m.get("content"),
                "images": m.get("images", []),
                "audio": m.get("audio", []),
                "video": m.get("video", []),
            }
            for m in self.short_memory.get_all()
        ]
        props = json.loads(json.dumps(self.properties))
        plan = json.loads(json.dumps(self.plan_state))
        kb = json.loads(json.dumps(self.knowledge_base))
        docs = json.loads(json.dumps(self.documents))
        return {
            "name": self.name,
            "user_profile": self.user_profile,
            "style": self.style,
            "initial_instruction": self.initial_instruction,
            "role_prompt": self.role_prompt,
            "language": self.language,
            "action_space": [action.NAME for action in self.action_space],
            "short_memory": mem,
            "last_history_length": self.last_history_length,
            "max_repeat": self.max_repeat,
            "properties": props,
            "plan_state": plan,
            "emotion": self.emotion,
            "emotion_enabled": self.emotion_enabled,
            # ---- Knowledge Base (RAG) ----
            "knowledge_base": kb,
            # ---- Documents (Embedded RAG) ----
            "documents": docs,
            # ---- LLM 错误状态序列化 ----
            "consecutive_llm_errors": int(getattr(self, "consecutive_llm_errors", 0)),
            "is_offline": bool(getattr(self, "is_offline", False)),
            "max_consecutive_llm_errors": int(
                getattr(self, "max_consecutive_llm_errors", 3)
            ),
        }

    @classmethod
    def deserialize(cls, data, event_handler=None):
        from .registry import ACTION_SPACE_MAP

        # 原始 properties（可能是 None）
        raw_props = data.get("properties", {}) or {}
        # 深拷贝一份，防止共享引用
        props = json.loads(json.dumps(raw_props))

        # 统一处理 emotion_enabled：
        #   1. 如果 data 里有顶层的 "emotion_enabled"，优先用它
        #   2. 否则看 props 里有没有（旧版本可能放在 properties 里）
        #   3. 都没有就默认 False
        if "emotion_enabled" in data:
            props.setdefault("emotion_enabled", data["emotion_enabled"])
        else:
            props.setdefault("emotion_enabled", False)

        agent = cls(
            name=data["name"],
            user_profile=data["user_profile"],
            style=data["style"],
            initial_instruction=data["initial_instruction"],
            role_prompt=data["role_prompt"],
            language=data.get("language", "en"),
            action_space=[
                ACTION_SPACE_MAP[action_name] for action_name in data["action_space"]
            ],
            max_repeat=data.get("max_repeat", MAX_REPEAT),
            event_handler=event_handler,
            # 其他属性（包括 emotion_enabled）统一从 props 进 __init__
            **props,
        )

        # 恢复情绪状态本身（值），开关已经在 __init__ 里从 props 读过了
        agent.emotion = data.get("emotion", "neutral")
        agent.emotion_enabled = bool(props.get("emotion_enabled", False))

        # 恢复记忆、计划等
        agent.short_memory.history = json.loads(
            json.dumps(data.get("short_memory", []))
        )
        agent.last_history_length = data.get("last_history_length", 0)
        agent.plan_state = json.loads(
            json.dumps(
                data.get(
                    "plan_state",
                    {
                        "goals": [],
                        "milestones": [],
                        "strategy": "",
                        "notes": "",
                    },
                )
            )
        )

        # ---- Knowledge Base (RAG) ----
        # Restore from top-level data or use what was passed through props
        kb_data = data.get("knowledge_base", [])
        print(f"[KB-DEBUG] Agent.deserialize '{agent.name}': kb_data has {len(kb_data)} items")
        if kb_data:
            agent.knowledge_base = json.loads(json.dumps(kb_data))
            print(f"[KB-DEBUG] Agent.deserialize '{agent.name}': after copy, knowledge_base has {len(agent.knowledge_base)} items")
            for i, item in enumerate(agent.knowledge_base):
                print(f"[KB-DEBUG]   KB[{i}]: id={item.get('id')}, title='{item.get('title', '')[:40]}', enabled={item.get('enabled')}")

        # ---- Documents (Embedded RAG) ----
        docs_data = data.get("documents", {})
        if docs_data:
            agent.documents = json.loads(json.dumps(docs_data))
            print(f"[KB-DEBUG] Agent.deserialize '{agent.name}': documents has {len(agent.documents)} items")

        # ---- 恢复 LLM 错误状态 ----
        agent.consecutive_llm_errors = data.get("consecutive_llm_errors", 0)
        agent.is_offline = data.get("is_offline", False)
        agent.max_consecutive_llm_errors = data.get(
            "max_consecutive_llm_errors", 3
        )

        return agent