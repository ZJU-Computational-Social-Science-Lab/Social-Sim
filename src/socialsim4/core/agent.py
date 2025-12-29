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
        base = f"""
You are {self.name}.
You speak in a {self.style} style.
{emotion_prompt}

{self.user_profile}

{self.role_prompt}

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


    def add_env_feedback(self, content: str):
        """Add feedback from the simulation environment to the agent's context.

        Stores the feedback as a `user` role entry in short-term memory so the
        agent can react to system/status updates, private confirmations, and
        scene messages.
        """
        self.short_memory.append("user", content)
        if self.log_event:
            self.log_event(
                "agent_ctx_delta",
                {"agent": self.name, "role": "user", "content": content},
            )

    def append_env_message(self, content):
        """Deprecated: use add_env_feedback(). Kept for compatibility."""
        return self.add_env_feedback(content)

    def serialize(self):
        # Deep-copy dict/list fields to avoid sharing across snapshots
        mem = [{"role": m.get("role"), "content": m.get("content")} for m in self.short_memory.get_all()]
        props = json.loads(json.dumps(self.properties))
        plan = json.loads(json.dumps(self.plan_state))
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
            # ---- NEW: LLM 错误状态序列化 ----
            "consecutive_llm_errors": int(getattr(self, "consecutive_llm_errors", 0)),
            "is_offline": bool(getattr(self, "is_offline", False)),
            "max_consecutive_llm_errors": int(
                getattr(self, "max_consecutive_llm_errors", 3)
            ),
            # ---- NEW END ----
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

        # ---- NEW: 恢复 LLM 错误状态 ----
        agent.consecutive_llm_errors = data.get("consecutive_llm_errors", 0)
        agent.is_offline = data.get("is_offline", False)
        agent.max_consecutive_llm_errors = data.get(
            "max_consecutive_llm_errors", 3
        )
        # ---- NEW END ----

        return agent

