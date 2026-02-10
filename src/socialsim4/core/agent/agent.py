"""
Core Agent class for social simulations.

The Agent class represents an autonomous agent in social simulations.
It coordinates between memory, action execution, tools, and LLM integration.

This is a refactored version that delegates specialized functionality
to focused submodules while maintaining backwards compatibility.

Contains:
    - Agent: Main agent class with state and orchestration logic
"""

import logging

from socialsim4.core.config import MAX_REPEAT
from socialsim4.core.memory import ShortTermMemory
from .parsing import (
    parse_full_response,
    parse_emotion_update,
    parse_plan_update,
    parse_actions,
)
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
    maintains its own memory, knowledge base, and planning state.

    This refactored version delegates to specialized modules while
    maintaining the same public API for backwards compatibility.
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
        self.emotion = kwargs.get("emotion", "neutral")
        self.emotion_enabled = bool(kwargs.get("emotion_enabled", False))

        # Plan state persisted across turns
        self.plan_state = {
            "goals": [],
            "milestones": [],
            "strategy": "",
            "notes": "",
        }

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
    # System Prompt & Output Format
    # -------------------------------------------------------------------------

    def system_prompt(self, scene=None):
        """Generate the system prompt for LLM calls."""
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

        # Prompt for plan initialization if empty
        if not self.plan_state or (
            not self.plan_state.get("goals") and not self.plan_state.get("milestones")
        ):
            plan_state_block += "\nPlan State is empty. In this turn, include a plan update block using tags to initialize numbered Goals and Milestones.\n"

        # Build action catalog and usage instructions
        action_catalog = "\n".join([
            f"- {getattr(action, 'NAME', '')}: {getattr(action, 'DESC', '')}".strip()
            for action in self.action_space
        ])
        action_instructions = "".join(
            getattr(action, "INSTRUCTION", "") for action in self.action_space
        )

        # Examples block from scene
        examples_block = ""
        if scene and hasattr(scene, 'get_examples') and scene.get_examples():
            examples_block = f"Here are some examples:\n{scene.get_examples()}"

        # Emotion prompt
        emotion_prompt = (
            f"Your current emotion is {self.emotion}."
            if self.emotion_enabled else ""
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
                kb_list += f"\n  ... and {kb_count - 5} more items"
            knowledge_block = f"""
Knowledge Base:
You have a personal knowledge base with {kb_count} item(s) containing information you can reference:
{kb_list}

Use the query_knowledge action to search for specific information when needed. The knowledge base contains facts and information that you should use to inform your responses when relevant.
"""

        # Identity line
        identity_parts = [self.name]
        if self.role_prompt:
            identity_parts.append(self.role_prompt)
        if self.style and self.style != "neutral":
            identity_parts.append(f"({self.style})")
        identity_line = " - ".join(identity_parts)

        base = f"""{identity_line}

{self.user_profile if len(self.user_profile) < 200 else self.user_profile[:200] + "..."}

{self.role_prompt if len(self.role_prompt or "") < 200 else ""}{knowledge_block}{plan_state_block}

Language: {self.language}. Action XML in English; content in {self.language}.

{scene.get_compact_description() if scene and hasattr(scene, 'get_compact_description') else (scene.get_scenario_description() if scene else "")}

{scene.get_behavior_guidelines() if scene else ""}

Action Space:
{action_catalog}

Usage:
{action_instructions}

{examples_block}

{self.get_output_format()}

{self.initial_instruction}
"""
        return base

    def get_output_format(self):
        """Get the output format specification for the agent."""
        base_prompt = """--- Thoughts ---
[What you're thinking right now - brief]

--- Plan ---
Goals: [your goals]
Milestones: [completed ✓, pending →]

--- Action ---
<Action name="[action_name]">
  [params if needed]
</Action>

Example:
--- Thoughts ---
Need to gather food.

--- Plan ---
Goals: Collect dinner
Milestones: ✓ at market, → gather food

--- Action ---
<Action name="gather_resource"><resource>food</resource></Action>
"""
        if self.emotion_enabled:
            emotion_rules = """

--- Emotion Update ---
// Mandatory: Output your emotion after each turn
// Use Plutchik emotions: Joy, Trust, Fear, Surprise, Sadness, Disgust, Anger, Anticipation
// Base on: goal progress (+→ Joy/Trust, -→ Sadness/Fear), novelty (→ Surprise), conflict (→ Anger/Disgust)
<Emotion>[emotion]</Emotion>
"""
            return base_prompt + emotion_rules
        return base_prompt

    # -------------------------------------------------------------------------
    # LLM Interaction
    # -------------------------------------------------------------------------

    def call_llm(self, clients, messages, client_name="chat"):
        """Call the LLM with the provided messages."""
        client = clients.get(client_name)
        if not client:
            raise ValueError(f"LLM client '{client_name}' not found.")
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
        summary_output = self.call_llm(client, messages)

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
            llm_client = clients.get("chat")
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

        # Retry loop
        attempts = int(getattr(self, "max_repeat", 0) or 0) + 1
        plan_update = None
        action_data = []
        llm_output = ""
        success = False

        for i in range(attempts):
            # Step 1: Call LLM
            try:
                llm_output = self.call_llm(clients, ctx)
            except Exception as e:
                self._record_llm_error("llm_call", e, i + 1, i == attempts - 1)
                if getattr(self, "is_offline", False):
                    break
                if i < attempts - 1:
                    continue
                break

            # Step 2: Parse response
            try:
                (
                    thoughts,
                    plan,
                    action_block,
                    plan_update_block,
                    emotion_update_block,
                ) = parse_full_response(llm_output)

                action_data = parse_actions(action_block) or parse_actions(llm_output)
                plan_update = parse_plan_update(plan_update_block)

                if self.emotion_enabled:
                    emotion_update = parse_emotion_update(emotion_update_block)
                    if emotion_update:
                        self.emotion = emotion_update
                        if self.log_event:
                            self.log_event(
                                "emotion_update",
                                {"agent": self.name, "emotion": emotion_update},
                            )

                success = True
                self.consecutive_llm_errors = 0  # Reset on success
                break

            except Exception as e:
                self._record_llm_error("parse", e, i + 1, i == attempts - 1)
                if getattr(self, "is_offline", False):
                    break
                if i < attempts - 1:
                    print(f"{self.name} action parse error: {e}; retry {i + 1}/{attempts - 1}...")
                    continue
                print(f"{self.name} action parse error after {attempts} attempts: {e}")
                print(f"LLM output (last):\n{llm_output}\n{'-' * 40}")
                break

        # If failed, return empty
        if not success:
            return {}

        # Apply plan update
        if plan_update:
            self._apply_plan_update(plan_update)

        # Store LLM output in memory
        self.short_memory.append("assistant", llm_output)
        if self.log_event:
            self.log_event(
                "agent_ctx_delta",
                {"agent": self.name, "role": "assistant", "content": llm_output},
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
    # Plan Management
    # -------------------------------------------------------------------------

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

    # -------------------------------------------------------------------------
    # LLM Error Handling
    # -------------------------------------------------------------------------

    def _record_llm_error(self, kind: str, error, attempt: int, final: bool):
        """Record an LLM call/parse error and mark agent offline if threshold exceeded."""
        self.consecutive_llm_errors += 1

        if self.log_event:
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
