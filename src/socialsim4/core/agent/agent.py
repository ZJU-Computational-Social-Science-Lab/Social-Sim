"""
Core Agent class for social simulations.

The Agent class represents an autonomous agent in social simulations.
It coordinates between memory, action execution, tools, and LLM integration.

This is a refactored version that uses clean JSON prompts for LLM interaction,
delegating specialized functionality to focused submodules.

Contains:
    - Agent: Main agent class with state and orchestration logic
"""

import json
import logging
from pathlib import Path
from datetime import datetime

from socialsim4.core.config import MAX_REPEAT
from socialsim4.core.memory import ShortTermMemory
from socialsim4.core.agent.parsing import parse_actions
from socialsim4.core.runtime_paths import get_runtime_debug_dir
from socialsim4.i18n import T

# Debug file for agent prompts/responses
_debug_dir = get_runtime_debug_dir()
_debug_file = _debug_dir / f"agent_debug_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
from .rag import (
    add_knowledge,
    remove_knowledge,
    get_enabled_knowledge,
    query_knowledge,
    get_knowledge_context,
    set_global_knowledge,
    retrieve_from_documents,
    composite_rag_retrieve,
    get_rag_context,
    sync_documents_to_vector_store,
    _get_auto_rag_context,
)
from .serialization import serialize_agent, deserialize_agent


logger = logging.getLogger(__name__)


class Agent:
    """
    Autonomous agent for social simulations.

    The Agent class represents an entity that can perceive, reason,
    and act within a social simulation environment. Each agent
    maintains its own memory and knowledge base.

    This refactored version uses clean JSON prompts for LLM interaction
    and delegates to specialized modules for focused functionality.
    """

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

        # Knowledge Base (RAG) - list of knowledge items
        self.knowledge_base = list(kwargs.get("knowledge_base", []) or [])

        # Documents (Embedded RAG) - dict of documents with embeddings
        self.documents = dict(kwargs.get("documents", {}) or {})

        # Reference to global knowledge
        self._global_knowledge = None

        # LLM error tracking
        self.consecutive_llm_errors = 0
        self.max_consecutive_llm_errors = int(
            kwargs.get("max_consecutive_llm_errors", 3) or 3
        )
        self.is_offline = False

    # -------------------------------------------------------------------------
    # System Prompt
    # -------------------------------------------------------------------------

    def system_prompt(self, scene=None, context_summary=None) -> str:
        """Generate the system prompt for LLM calls.

        Args:
            scene: Optional scene object with scenario information
            context_summary: Optional summary of recent context

        Returns:
            Complete system prompt string with 5-section JSON output format
        """
        # Build action catalog and usage instructions
        action_catalog = "\n".join([
            f"- {getattr(action, 'NAME', '')}: {getattr(action, 'DESC', '')}".strip()
            for action in self.action_space
        ])
        action_instructions = "".join(
            getattr(action, "INSTRUCTION", "") for action in self.action_space
        )

        # Knowledge base preview
        knowledge_block = ""
        enabled_kb = get_enabled_knowledge(self)
        if enabled_kb:
            kb_count = len(enabled_kb)
            kb_preview = []
            for i, item in enumerate(enabled_kb[:5], 1):
                title = item.get("title", "Untitled")
                content_preview = str(item.get("content", ""))[:80]
                if len(str(item.get("content", ""))) > 80:
                    content_preview += "..."
                kb_preview.append(f"  [{i}] {title}: {content_preview}")
            kb_list = "\n".join(kb_preview)
            if kb_count > 5:
                kb_list += "\n  " + T('prompts.agent.knowledge_base_more', count=kb_count - 5)
            knowledge_block = f"""
{T('prompts.agent.knowledge_base_header')}
{T('prompts.agent.knowledge_base_intro', count=kb_count)}
{kb_list}

{T('prompts.agent.query_instruction')}
"""

        # Identity line
        identity_parts = [self.name]
        if self.role_prompt:
            identity_parts.append(self.role_prompt)
        if self.style and self.style != "neutral":
            identity_parts.append(f"({self.style})")
        identity_line = " - ".join(identity_parts)

        # Scene description
        scene_block = ""
        if scene:
            if hasattr(scene, 'get_compact_description'):
                scene_block = scene.get_compact_description()
            elif hasattr(scene, 'get_scenario_description'):
                scene_block = scene.get_scenario_description()

            if hasattr(scene, 'get_behavior_guidelines'):
                scene_block += f"\n\n{scene.get_behavior_guidelines()}"

        # Context summary if provided
        context_block = ""
        if context_summary:
            context_block = f"""
Recent Context Summary:
{context_summary}
"""

        default_example = """Example JSON response:
    ```json
    {
        "thoughts": "I need to respond to the greeting and consider next steps",
        "response": "Hello! Nice to meet you.",
        "action": {
        "name": "send_message",
        "target": "other_agent",
        "message": "Hello! Nice to meet you."
        },
        "context_update": "Met a new agent, should learn more about them",
        "metadata": {}
    }
    ```

    If you only want to speak without taking an action:
    ```json
    {
        "thoughts": "Just responding to the question",
        "response": "My opinion is...",
        "action": {
            "name": "send_message",
            "message": "My opinion is..."
        },
        "context_update": "Shared my opinion on the topic",
        "metadata": {}
    }
    ```"""

        example_block = default_example
        if scene and getattr(scene, "TYPE", "") == "policy_cascade_scene":
            def _compact_policy_example(text: str) -> str:
                if hasattr(scene, "_policy_prompt_excerpt"):
                    summary = scene._policy_prompt_excerpt(text)
                    if summary:
                        return summary
                cleaned = str(text or "").strip()
                return cleaned[:48] if cleaned else "逐级传达政策，并保留关键执行条款"

            private_event = scene._private_event_for(self.name) if hasattr(scene, "_private_event_for") else {}
            has_private_source = bool(private_event)
            task_mode = str(private_event.get("task_mode") or scene.state.get("task_mode", "notice") or "notice")
            notice_kind = str(private_event.get("notice_kind") or scene.state.get("notice_kind", "execution") or "execution")
            cascade_mode = str(scene.state.get("cascade_mode", "strict_cascade") or "strict_cascade")
            policy_text = str(private_event.get("relayed_policy") or private_event.get("latest_policy") or scene.state.get("relayed_policy", "") or scene.state.get("latest_policy", "") or "").strip()
            source_policy_text = str(private_event.get("source_policy") or scene.state.get("source_policy", "") or policy_text).strip()
            notice_text = str(private_event.get("latest_notice") or scene.state.get("latest_notice", "") or "").strip()
            tier = str(getattr(scene, "_tier_map", {}).get(self.name, self.properties.get("tier", "")) or "").strip()
            role_kind = scene._tier_role_kind(tier) if hasattr(scene, "_tier_role_kind") else "mid"
            if task_mode == "cascade":
                example_policy = policy_text or source_policy_text or "最新政策原文"
                example_policy_summary = _compact_policy_example(source_policy_text or example_policy)
                if cascade_mode == "distortion_cascade":
                    if role_kind == "top":
                        if has_private_source:
                            example_message = f"对于这条仅向我私下传达的政策，我决定先强调“{example_policy_summary}”，暂不展开全部资源承诺。"
                        else:
                            example_message = f"关于上级刚才的传达，我决定继续强调“{example_policy_summary}”，暂不展开全部资源承诺。"
                        context_update = "已按本层利益重述政策重点，并保留部分信息"
                    elif role_kind == "mid":
                        if has_private_source:
                            example_message = f"我会只向下传达可立即执行的部分，先保留“{example_policy_summary}”，其余内容暂缓。"
                        else:
                            example_message = f"考虑到本部门考核压力，我只向下传达可立即执行的部分，先保留“{example_policy_summary}”。"
                        context_update = "已结合中层压力选择性下传政策"
                    else:
                        if has_private_source:
                            example_message = f"该政策与一线负担存在冲突，我会先按基层可执行口径保留“{example_policy_summary}”，并上报执行困难。"
                        else:
                            example_message = f"该政策与一线负担存在冲突，我会先保留“{example_policy_summary}”中的最低执行要求。"
                        context_update = "已因基层执行冲突而弱化落实"
                    distortion_note = (
                        f"当前失真参数：失真强度={float(scene.state.get('distortion_strength', 0.6) or 0.6):.2f}，"
                        f"利益冲突敏感度={float(scene.state.get('conflict_sensitivity', 0.5) or 0.5):.2f}，"
                        f"截留概率={float(scene.state.get('block_probability', 0.25) or 0.25):.2f}。"
                    )
                elif role_kind == "top":
                    example_message = f"我会按原文继续传达“{example_policy_summary}”。态度：完全支持并按原文执行。补充：由我批准专项预算并建立月度问责机制。"
                    context_update = "已按原文转发，并补充高层统筹与资源安排"
                elif role_kind == "mid":
                    example_message = f"我会按原文继续传达“{example_policy_summary}”。态度：完全支持并按原文执行。补充：我将在48小时内拆解任务到各部门并建立周报台账。"
                    context_update = "已按原文转发，并补充中层协调与任务拆解"
                else:
                    example_message = f"我会按原文继续传达“{example_policy_summary}”。态度：完全支持并按原文执行。补充：我将按排查清单逐项核验，并在发现异常后24小时内上报。"
                    context_update = "已按原文转发，并补充基层执行与异常上报"
                message_json = json.dumps(example_message, ensure_ascii=False)
                silent_context = "等待下一级反馈" if cascade_mode != "distortion_cascade" else "因本层利益冲突暂缓下传"
                example_block = f"""Example JSON response:
    ```json
    {{
        "thoughts": "转发最新政策，保持原文并附执行计划。",
        "response": "",
        "action": {{
        "name": "send_message",
        "message": {message_json}
        }},
        "context_update": "{context_update}",
        "metadata": {{}}
    }}
    ```

    If you only want to speak without taking an action:
    ```json
    {{
        "thoughts": "无需转发时保持静默等待。",
        "response": "",
        "action": {{
            "name": "yield"
        }},
        "context_update": "{silent_context}",
        "metadata": {{}}
    }}
    ```"""
                if cascade_mode == "distortion_cascade":
                    example_block = distortion_note + "\n\n" + example_block
            else:
                if notice_kind == "analysis":
                    if role_kind == "top":
                        notice_message = f"作为高层，我对“{notice_text or '最新任务'}”的看法是：优点在于有利于统一部署、压实责任和跟踪问效；缺点在于如果资源和配套制度不足，容易形成层层加码；建议同步明确牵头单位、预算安排和督促检查节奏。"
                        context_update = "已从高层视角完成政策解读与优缺点分析"
                    elif role_kind == "mid":
                        notice_message = f"作为中层，我对“{notice_text or '最新任务'}”的看法是：优点在于便于分解任务、建立台账和协同推进；缺点在于若验收标准不清，容易造成重复报送和责任交叉；建议尽快细化举措、明确时间表和周报机制。"
                        context_update = "已从中层视角完成政策解读与优缺点分析"
                    else:
                        notice_message = f"作为基层执行者，我对“{notice_text or '最新任务'}”的看法是：优点在于有助于逐项排查、现场核验和及时上报；缺点在于若模板过多、口径频繁变化，会增加执行负担；建议简化报送字段并明确整改、复查和销号标准。"
                        context_update = "已从基层视角完成政策解读与优缺点分析"
                elif role_kind == "top":
                    notice_message = f"关于系统公告“{notice_text or '最新任务'}”，作为高层，我将明确总体目标、资源投放、压实责任和考核机制，并指定牵头负责人。"
                    context_update = "已从高层视角回应系统公告"
                elif role_kind == "mid":
                    notice_message = f"关于系统公告“{notice_text or '最新任务'}”，作为中层，我将分解任务、协调相关单位、建立工作台账，并给出周度推进时间表。"
                    context_update = "已从中层视角回应系统公告"
                else:
                    notice_message = f"关于系统公告“{notice_text or '最新任务'}”，作为基层执行者，我将按清单落实排查步骤、现场核验问题、推进整改复查并及时上报反馈。"
                    context_update = "已从基层视角回应系统公告"
                message_json = json.dumps(notice_message, ensure_ascii=False)
                example_block = f"""Example JSON response:
    ```json
    {{
        "thoughts": "需要直接回应最新系统公告，并给出符合本职位职责的解读。",
        "response": "",
        "action": {{
        "name": "send_message",
        "message": {message_json}
        }},
        "context_update": "{context_update}",
        "metadata": {{}}
    }}
    ```

    If you only want to speak without taking an action:
    ```json
    {{
        "thoughts": "当前没有新增任务时可以结束回合。",
        "response": "",
        "action": {{
            "name": "yield"
        }},
        "context_update": "等待下一条系统公告",
        "metadata": {{}}
    }}
    ```"""

        # Build the prompt with new JSON output format
        prompt = f"""{identity_line}

    {self.user_profile if len(self.user_profile) < 500 else self.user_profile[:500] + "..."}

    {self.role_prompt if len(self.role_prompt or "") < 500 else ""}{knowledge_block}
    Language: {self.language}. Respond in {self.language} for content; use English for action names.

    {scene_block}
    {context_block}
    Action Space:
    {action_catalog}

    Usage:
    {action_instructions}

    {self.initial_instruction}

    IMPORTANT - Output Format:
    You MUST respond with a valid JSON object containing these 5 sections:

    1. "thoughts": Your brief thinking about the current situation (1-2 sentences)

    2. "response": What you want to communicate (can be empty string if no speech needed)

    3. "action": The action you want to take, containing:
       - "name": action name from the Action Space above
       - Additional key-value pairs for action parameters (if required)

    4. "context_update": Brief notes to remember for future (goals, observations, plans)

    5. "metadata": Optional object with any additional metadata

    {example_block}

    You must always provide an "action" with a valid "name" from the Action Space. If you only want to speak, use "send_message" and include the text in the "message" field. Use "yield" when you are done with your turn.
    """
        return prompt

    def _tr(self, key: str, **kwargs) -> str:
        return T(key, locale=self.language, **kwargs)

    def _json_retry_feedback(self, error) -> str:
        return self._tr("prompts.agent.json_retry_feedback", error=str(error))

    # -------------------------------------------------------------------------
    # LLM Interaction
    # -------------------------------------------------------------------------

    def _resolve_llm_client(self, clients, client_name="chat"):
        provider_id = self.properties.get("provider_id")
        provider_clients = clients.get("providers") or {}
        if provider_id is not None and provider_id in provider_clients:
            return provider_clients[provider_id]
        client = clients.get(client_name)
        if not client:
            raise ValueError(f"LLM client '{client_name}' not found.")
        return client

    def call_llm(self, clients, messages, client_name="chat"):
        """Call the LLM with the provided messages."""
        client = self._resolve_llm_client(clients, client_name)
        return client.chat(messages)

    def summarize_history(self, client):
        """Summarize conversation history when it gets too long."""
        import re

        # Build summary prompt
        history_content = "\n".join([
            f"[{msg['role']}] {msg['content']}"
            for msg in self.short_memory.get_all()
        ])
        summary_prompt = f"""
Summarize the following conversation history from {self.name}'s perspective. Be concise but capture key points, opinions, ongoing topics, and important events. Output ONLY as 'Summary: [your summary text]'.

History:
{history_content}
"""

        # Call LLM for summary
        messages = [{"role": "user", "content": summary_prompt}]
        summary_output = client.chat(messages)

        # Extract summary
        summary_match = re.search(r"Summary: (.*)", summary_output, re.DOTALL)
        if summary_match:
            summary = summary_match.group(1).strip()
        else:
            summary = summary_output

        # Replace history with summary
        self.short_memory.clear()
        self.short_memory.append("user", f"Summary: {summary}")
        print(f"{self.name} summarized history.")

    # -------------------------------------------------------------------------
    # Process Method - Main Decision Loop
    # -------------------------------------------------------------------------

    def process(self, clients, initiative=False, scene=None):
        """
        Main agent decision-making method.

        Generates actions based on current state and context.
        Handles LLM calls, response parsing, plan updates, and error tracking.
        """
        # Return empty if offline
        if getattr(self, "is_offline", False):
            return {}

        current_length = len(self.short_memory)
        if current_length == self.last_history_length and not initiative:
            # No new events, no reaction
            return {}

        system_prompt = self.system_prompt(scene)

        # Auto-inject RAG context if enabled
        from socialsim4.core.config import RAG_AUTO_INJECT
        if RAG_AUTO_INJECT:
            llm_client = self._resolve_llm_client(clients)
            if llm_client:
                rag_context = _get_auto_rag_context(self, llm_client)
                if rag_context:
                    system_prompt += f"""

{rag_context}

Use the above context to inform your responses when relevant.
"""

        # Build context from memory
        ctx = self.short_memory.searilize(dialect="default")
        ctx.insert(0, {"role": "system", "content": system_prompt})

        # Add continuation hint if needed
        last_role = ctx[-1].get("role") if len(ctx) > 1 else None
        if initiative or last_role == "assistant":
            hint = "Continue."
            self.short_memory.append("user", hint)
            ctx.append({"role": "user", "content": hint})

        # Debug: Write prompt to file
        try:
            with open(_debug_file, 'a', encoding='utf-8') as f:
                f.write(f"\n{'='*80}\n")
                f.write(f"[AGENT PROCESS] {self.name}\n")
                f.write(f"{'='*80}\n")
                f.write(f"Scene: {scene.__class__.__name__ if scene else 'None'}\n")
                f.write(f"Action space: {[getattr(a, 'NAME', str(a)) for a in self.action_space]}\n")
                f.write(f"\n--- SYSTEM PROMPT ---\n")
                f.write(system_prompt)
                f.write(f"\n--- END SYSTEM PROMPT ---\n\n")
                f.write(f"\n--- CONTEXT MESSAGES ({len(ctx)} total) ---\n")
                for msg in ctx:
                    f.write(f"[{msg.get('role')}]: {msg.get('content', '')[:500]}\n")
                f.write(f"--- END CONTEXT ---\n\n")
            # Debug info written to test_results file instead of terminal
        except Exception as e:
            # Debug file write failed — non-critical
            pass

        # Retry loop
        attempts = int(getattr(self, "max_repeat", 0) or 0) + 1
        action_data = []
        llm_output = ""
        success = False

        for i in range(attempts):
            # Step 1: Call LLM
            try:
                llm_output = self.call_llm(clients, ctx)

                # Debug: Write LLM output to file
                try:
                    with open(_debug_file, 'a', encoding='utf-8') as f:
                        f.write(f"\n--- LLM OUTPUT ---\n")
                        f.write(llm_output)
                        f.write(f"\n--- END LLM OUTPUT ---\n\n")
                except Exception:
                    pass

                # LLM response captured in debug file

            except Exception as e:
                self._record_llm_error("llm_call", e, i + 1, i == attempts - 1)
                if getattr(self, "is_offline", False):
                    break
                if i < attempts - 1:
                    ctx.append({"role": "user", "content": self._json_retry_feedback(e)})
                    continue
                break

            # Step 2: Parse response (JSON format)
            try:
                action_data = parse_actions(
                    llm_output,
                    strict_duplicate_actions=bool(scene and getattr(scene, "TYPE", "") == "policy_cascade_scene"),
                )

                # Debug: Write parsed actions to file
                try:
                    with open(_debug_file, 'a', encoding='utf-8') as f:
                        f.write(f"\n--- PARSED ACTIONS ---\n")
                        f.write(f"Parsed action_data: {action_data}\n")
                        f.write(f"--- END PARSED ACTIONS ---\n\n")
                except Exception:
                    pass

                # Parsed actions captured in debug file

                success = True
                self.consecutive_llm_errors = 0  # Reset on success
                break

            except Exception as e:
                self._record_llm_error("parse", e, i + 1, i == attempts - 1)
                if getattr(self, "is_offline", False):
                    break
                if i < attempts - 1:
                    ctx.append({"role": "user", "content": self._json_retry_feedback(e)})
                    # Action parse error — retrying (details in debug file)
                    continue
                # Action parse error after all attempts (details in debug file)
                break

        # If failed, return empty
        if not success:
            return {}

        # --- Reprompt handling for actions requiring free-text input ---
        reprompt_storage_handled = False
        action_lookup = {
            getattr(action, "NAME", ""): action
            for action in self.action_space
        }

        for item in action_data:
            action_payload = item.get("action") or {}
            if type(action_payload) is dict:
                action_name = str(action_payload.get("name") or action_payload.get("action") or "").strip()
            else:
                action_name = str(action_payload or item.get("action") or item.get("name") or "").strip()

            if not action_name:
                continue

            action_def = action_lookup.get(action_name)
            if not action_def:
                continue

            reprompt_param = getattr(action_def, "REPROMPT_PARAM", None)
            if not reprompt_param:
                continue

            reprompt_scene_types = getattr(action_def, "REPROMPT_SCENE_TYPES", None)
            if reprompt_scene_types:
                scene_type = getattr(scene, "TYPE", "") if scene else ""
                if scene_type not in reprompt_scene_types:
                    continue

            reprompt_task_modes = getattr(action_def, "REPROMPT_TASK_MODES", None)
            if reprompt_task_modes:
                task_mode = scene._effective_task_mode_for(self)
                if task_mode not in reprompt_task_modes:
                    continue

            existing_value = ""
            if type(action_payload) is dict:
                existing_value = str(action_payload.get(reprompt_param) or "").strip()
            else:
                existing_value = str(item.get(reprompt_param) or "").strip()
            if existing_value:
                continue

            self.short_memory.append("assistant", llm_output)
            if self.log_event:
                self.log_event(
                    "agent_ctx_delta",
                    {"agent": self.name, "role": "assistant", "content": llm_output},
                )
            reprompt_storage_handled = True

            reprompt_instruction = (
                self._tr(
                    "prompts.agent.reprompt_instruction",
                    action_name=action_name,
                    reprompt_param=reprompt_param,
                )
            )
            self.short_memory.append("user", reprompt_instruction)
            if self.log_event:
                self.log_event(
                    "agent_ctx_delta",
                    {"agent": self.name, "role": "user", "content": reprompt_instruction},
                )

            reprompt_ctx = self.short_memory.serialize(dialect="default")
            reprompt_ctx.insert(0, {"role": "system", "content": system_prompt})

            reprompt_output = self.call_llm(clients, reprompt_ctx).strip()

            if type(action_payload) is dict:
                action_payload[reprompt_param] = reprompt_output
            else:
                item[reprompt_param] = reprompt_output

            self.short_memory.append("assistant", reprompt_output)
            if self.log_event:
                self.log_event(
                    "agent_ctx_delta",
                    {"agent": self.name, "role": "assistant", "content": reprompt_output},
                )

            try:
                with open(_debug_file, 'a', encoding='utf-8') as f:
                    f.write(f"\n--- REPROMPT for '{action_name}' ---\n")
                    f.write(f"Instruction: {reprompt_instruction}\n")
                    f.write(f"Response: {reprompt_output}\n")
                    f.write(f"--- END REPROMPT ---\n\n")
            except Exception:
                pass

        # --- End reprompt handling ---

        # Store a compact assistant memory instead of raw JSON to reduce self-copying
        memory_parts = []
        scene_type = getattr(scene, "TYPE", "") if scene else ""
        scene_mode = str(scene.state.get("task_mode", "") or "") if scene else ""
        for item in action_data:
            response = str(item.get("response", "") or "").strip()
            if response:
                memory_parts.append(response)

            action_payload = item.get("action") or {}
            action_name = ""
            action_message = ""
            if type(action_payload) is dict:
                action_name = str(action_payload.get("name") or action_payload.get("action") or "").strip()
                action_message = str(action_payload.get("message", "") or "").strip()

            if action_message and action_message != response and not (scene_type == "policy_cascade_scene" and scene_mode == "notice"):
                memory_parts.append(action_message)

            context_update = str(item.get("context_update", "") or "").strip()
            if context_update:
                memory_parts.append(f"[Remember] {context_update}")

        assistant_memory = "\n".join(memory_parts).strip()
        if not assistant_memory:
            fallback_parts = []
            for item in action_data:
                action_payload = item.get("action") or {}
                if type(action_payload) is not dict:
                    continue
                action_name = str(action_payload.get("name") or action_payload.get("action") or "").strip()
                if not action_name or action_name == "yield":
                    continue
                target = str(action_payload.get("target", "") or "").strip()
                if target:
                    fallback_parts.append(f"[Action] {action_name} -> {target}")
                else:
                    fallback_parts.append(f"[Action] {action_name}")
            assistant_memory = "\n".join(fallback_parts).strip()

        if assistant_memory and not reprompt_storage_handled:
            self.short_memory.append("assistant", assistant_memory)
            if self.log_event:
                self.log_event(
                    "agent_ctx_delta",
                    {"agent": self.name, "role": "assistant", "content": assistant_memory},
                )
        self.last_history_length = len(self.short_memory)

        return action_data

    # -------------------------------------------------------------------------
    # Environment Interaction
    # -------------------------------------------------------------------------

    def add_env_feedback(self, content, images=None, audio=None, video=None):
        """Add feedback from the simulation environment to agent's context."""
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

    # -------------------------------------------------------------------------
    # LLM Error Handling
    # -------------------------------------------------------------------------

    def _record_llm_error(self, kind: str, error, attempt: int, final: bool):
        """Record an LLM call/parse error and mark agent offline if threshold exceeded."""
        if not final:
            return

        self.consecutive_llm_errors += 1

        should_emit_error = True

        if self.log_event and should_emit_error:
            self.log_event(
                "agent_error",
                {
                    "agent": self.name,
                    "kind": kind,
                    "error": str(error),
                    "attempt": int(attempt),
                    "consecutive_errors": int(self.consecutive_llm_errors),
                    "final_attempt": bool(final),
                },
            )

        # Mark offline if threshold exceeded
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

    # -------------------------------------------------------------------------
    # Knowledge Base Methods (delegated to rag module)
    # -------------------------------------------------------------------------

    def add_knowledge(self, item: dict) -> None:
        """Add a knowledge item to the agent's knowledge base."""
        add_knowledge(self, item)

    def remove_knowledge(self, item_id: str) -> bool:
        """Remove a knowledge item by ID. Returns True if found and removed."""
        return remove_knowledge(self, item_id)

    def get_enabled_knowledge(self) -> list:
        """Get all enabled knowledge items."""
        return get_enabled_knowledge(self)

    def query_knowledge(self, query: str, max_results: int = 3) -> list:
        """Simple keyword-based retrieval from the knowledge base."""
        return query_knowledge(self, query, max_results)

    def get_knowledge_context(self, query: str = "", max_items: int = 5) -> str:
        """Get formatted knowledge context to inject into prompts."""
        return get_knowledge_context(self, query, max_items)

    # -------------------------------------------------------------------------
    # Document RAG Methods (delegated to rag module)
    # -------------------------------------------------------------------------

    def set_global_knowledge(self, global_knowledge: dict) -> None:
        """Set reference to global knowledge base for composite retrieval."""
        set_global_knowledge(self, global_knowledge)

    def retrieve_from_documents(self, query_embedding: list, top_k: int = 5) -> list:
        """Retrieve relevant chunks from agent's private documents."""
        return retrieve_from_documents(self, query_embedding, top_k)

    def composite_rag_retrieve(self, query: str, llm_client, top_k: int = 5) -> list:
        """Composite RAG retrieval merging private documents and global knowledge."""
        return composite_rag_retrieve(self, query, llm_client, top_k)

    def get_rag_context(self, query: str, llm_client, top_k: int = 5) -> str:
        """Get formatted RAG context from documents to inject into prompts."""
        return get_rag_context(self, query, llm_client, top_k)

    def sync_documents_to_vector_store(self) -> bool:
        """Sync agent's documents to ChromaDB vector store."""
        return sync_documents_to_vector_store(self)

    # -------------------------------------------------------------------------
    # Serialization
    # -------------------------------------------------------------------------

    def serialize(self):
        """Convert agent to serializable dictionary."""
        return serialize_agent(self)

    @classmethod
    def deserialize(cls, data, event_handler=None):
        """Create agent from serialized dictionary."""
        return deserialize_agent(data, event_handler, cls)
