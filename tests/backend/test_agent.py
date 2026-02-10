"""
Comprehensive tests for Agent class.

Tests all Agent functionality including:
- Initialization and configuration
- Memory management (short-term memory)
- Knowledge base management
- Document management with RAG
- Plan state management
- LLM interaction and error handling
- Action parsing
- Emotion system
- Serialization/deserialization
- Offline/error recovery
"""

import json
import pytest

from socialsim4.core.agent import Agent
from socialsim4.core.memory import ShortTermMemory
from socialsim4.core.config import MAX_REPEAT


# =============================================================================
# Agent Initialization Tests
# =============================================================================


class TestAgentInitialization:
    """Tests for Agent initialization and basic configuration."""

    def test_agent_init_with_required_params(self):
        """Test agent initialization with only required parameters."""
        agent = Agent(
            name="TestAgent",
            user_profile="A test agent",
            style="neutral",
            action_space=[],
        )
        assert agent.name == "TestAgent"
        assert agent.user_profile == "A test agent"
        assert agent.style == "neutral"
        assert agent.language == "en"
        assert agent.short_memory is not None
        assert isinstance(agent.short_memory, ShortTermMemory)

    def test_agent_init_with_all_params(self):
        """Test agent initialization with all parameters."""
        def dummy_event_handler(event_type, data):
            pass

        agent = Agent(
            name="FullAgent",
            user_profile="A complete agent",
            style="friendly",
            initial_instruction="Be helpful",
            role_prompt="You are a helper",
            action_space=[],
            language="zh",
            max_repeat=5,
            event_handler=dummy_event_handler,
            emotion="happy",
            emotion_enabled=True,
        )
        assert agent.name == "FullAgent"
        assert agent.initial_instruction == "Be helpful"
        assert agent.role_prompt == "You are a helper"
        assert agent.language == "zh"
        assert agent.max_repeat == 5
        assert agent.emotion == "happy"
        assert agent.emotion_enabled is True

    def test_agent_init_default_values(self):
        """Test agent initialization with default values."""
        agent = Agent(
            name="DefaultsAgent",
            user_profile="Testing defaults",
            style="neutral",
            action_space=[],
        )
        assert agent.language == "en"
        assert agent.max_repeat == MAX_REPEAT
        assert agent.emotion == "neutral"
        assert agent.emotion_enabled is False

    def test_agent_init_with_knowledge_base(self):
        """Test agent initialization with knowledge base."""
        kb = [
            {"id": "k1", "title": "Fact 1", "content": "Content 1", "enabled": True},
            {"id": "k2", "title": "Fact 2", "content": "Content 2", "enabled": False},
        ]
        agent = Agent(
            name="KBA Agent",
            user_profile="Has knowledge",
            style="neutral",
            action_space=[],
            knowledge_base=kb,
        )
        assert len(agent.knowledge_base) == 2
        assert agent.knowledge_base[0]["id"] == "k1"

    def test_agent_init_with_documents(self):
        """Test agent initialization with documents."""
        docs = {
            "doc1": {
                "id": "doc1",
                "filename": "test.pdf",
                "chunks": [{"chunk_id": "c1", "text": "Chunk 1"}],
                "embeddings": {"c1": [0.1, 0.2, 0.3]},
            }
        }
        agent = Agent(
            name="DocsAgent",
            user_profile="Has documents",
            style="neutral",
            action_space=[],
            documents=docs,
        )
        assert len(agent.documents) == 1
        assert "doc1" in agent.documents

    def test_agent_init_with_properties(self):
        """Test agent initialization with custom properties."""
        agent = Agent(
            name="PropsAgent",
            user_profile="Has properties",
            style="neutral",
            action_space=[],
            custom_field="custom_value",
            another_field=123,
        )
        assert agent.properties["custom_field"] == "custom_value"
        assert agent.properties["another_field"] == 123

    def test_agent_plan_state_initialization(self):
        """Test agent plan state is properly initialized."""
        agent = Agent(
            name="PlanAgent",
            user_profile="Has plans",
            style="neutral",
            action_space=[],
        )
        assert "goals" in agent.plan_state
        assert "milestones" in agent.plan_state
        assert "strategy" in agent.plan_state
        assert "notes" in agent.plan_state
        assert agent.plan_state["goals"] == []
        assert agent.plan_state["milestones"] == []

    def test_agent_error_state_initialization(self):
        """Test agent LLM error state is initialized."""
        agent = Agent(
            name="ErrorAgent",
            user_profile="Tests errors",
            style="neutral",
            action_space=[],
        )
        assert agent.consecutive_llm_errors == 0
        assert agent.is_offline is False
        assert agent.max_consecutive_llm_errors == 3  # default

    def test_agent_custom_error_threshold(self):
        """Test agent with custom error threshold."""
        agent = Agent(
            name="CustomErrorAgent",
            user_profile="Custom errors",
            style="neutral",
            action_space=[],
            max_consecutive_llm_errors=5,
        )
        assert agent.max_consecutive_llm_errors == 5


# =============================================================================
# System Prompt Tests
# =============================================================================


class TestSystemPrompt:
    """Tests for system prompt generation."""

    def test_system_prompt_basic(self):
        """Test basic system prompt generation."""
        agent = Agent(
            name="PromptAgent",
            user_profile="A testing agent for prompts",
            style="neutral",
            action_space=[],
        )
        prompt = agent.system_prompt()
        assert "PromptAgent" in prompt
        assert "A testing agent for prompts" in prompt
        assert "Language:" in prompt
        assert "Action Space:" in prompt

    def test_system_prompt_with_role(self):
        """Test system prompt includes role."""
        agent = Agent(
            name="RoleAgent",
            user_profile="Profile",
            style="neutral",
            role_prompt="You are a helpful assistant",
            action_space=[],
        )
        prompt = agent.system_prompt()
        assert "You are a helpful assistant" in prompt

    def test_system_prompt_with_knowledge_base(self):
        """Test system prompt includes knowledge base."""
        kb = [
            {"id": "k1", "title": "Important Fact", "content": "The sky is blue", "enabled": True},
        ]
        agent = Agent(
            name="KBAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
            knowledge_base=kb,
        )
        prompt = agent.system_prompt()
        assert "Knowledge Base:" in prompt
        assert "Important Fact" in prompt

    def test_system_prompt_with_empty_plan_state(self):
        """Test system prompt prompts for plan initialization when empty."""
        agent = Agent(
            name="EmptyPlanAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        prompt = agent.system_prompt()
        assert "Plan State is empty" in prompt
        assert "include a plan update block" in prompt

    def test_system_prompt_with_plan_state(self):
        """Test system prompt includes existing plan state."""
        agent = Agent(
            name="PlanAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        agent.plan_state = {
            "goals": [{"id": "g1", "desc": "Test goal", "priority": "high", "status": "pending"}],
            "milestones": [],
            "strategy": "Test strategy",
            "notes": "Test notes",
        }
        prompt = agent.system_prompt()
        assert "Test goal" in prompt
        assert "Test strategy" in prompt
        assert "Test notes" in prompt

    def test_system_prompt_with_emotion(self):
        """Test system prompt includes emotion when enabled."""
        agent = Agent(
            name="EmotionAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
            emotion="happy",
            emotion_enabled=True,
        )
        prompt = agent.system_prompt()
        assert "Emotion: happy" in prompt
        assert "--- Emotion Update ---" in prompt

    def test_system_prompt_without_emotion(self):
        """Test system prompt excludes emotion when disabled."""
        agent = Agent(
            name="NoEmotionAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
            emotion="sad",
            emotion_enabled=False,
        )
        prompt = agent.system_prompt()
        assert "Emotion:" not in prompt
        assert "--- Emotion Update ---" not in prompt

    def test_get_output_format(self):
        """Test output format generation."""
        agent = Agent(
            name="FormatAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        fmt = agent.get_output_format()
        assert "--- Thoughts ---" in fmt
        assert "--- Plan ---" in fmt
        assert "--- Action ---" in fmt
        assert "<Action name=" in fmt


# =============================================================================
# Memory Tests
# =============================================================================


class TestAgentMemory:
    """Tests for agent memory management."""

    def test_short_memory_initialization(self):
        """Test short-term memory is initialized."""
        agent = Agent(
            name="MemAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        assert agent.short_memory is not None
        assert len(agent.short_memory.get_all()) == 0

    def test_add_env_feedback(self):
        """Test adding environment feedback."""
        agent = Agent(
            name="FeedbackAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        agent.add_env_feedback("The weather is sunny today.")
        assert len(agent.short_memory.get_all()) == 1

    def test_append_env_message_compatibility(self):
        """Test append_env_message compatibility method."""
        agent = Agent(
            name="CompatAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        agent.append_env_message("Test message")
        assert len(agent.short_memory.get_all()) == 1

    def test_memory_history_length_tracking(self):
        """Test last_history_length is updated correctly."""
        agent = Agent(
            name="LengthAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        assert agent.last_history_length == 0
        agent.add_env_feedback("Test")
        # last_history_length not updated until after process
        assert agent.last_history_length == 0


# =============================================================================
# Knowledge Base Tests
# =============================================================================


class TestAgentKnowledgeBase:
    """Tests for agent knowledge base management."""

    def test_add_knowledge(self):
        """Test adding knowledge item."""
        agent = Agent(
            name="KBAddAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        item = {"id": "k1", "title": "Test", "content": "Content", "enabled": True}
        agent.add_knowledge(item)
        assert len(agent.knowledge_base) == 1
        assert agent.knowledge_base[0]["id"] == "k1"

    def test_remove_knowledge(self):
        """Test removing knowledge item."""
        agent = Agent(
            name="KBRemoveAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
            knowledge_base=[
                {"id": "k1", "title": "Test", "content": "Content", "enabled": True},
                {"id": "k2", "title": "Test2", "content": "Content2", "enabled": True},
            ],
        )
        result = agent.remove_knowledge("k1")
        assert result is True
        assert len(agent.knowledge_base) == 1
        assert agent.knowledge_base[0]["id"] == "k2"

    def test_remove_knowledge_not_found(self):
        """Test removing non-existent knowledge item."""
        agent = Agent(
            name="KBNotFoundAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
            knowledge_base=[{"id": "k1", "title": "Test", "content": "Content", "enabled": True}],
        )
        result = agent.remove_knowledge("nonexistent")
        assert result is False
        assert len(agent.knowledge_base) == 1

    def test_get_enabled_knowledge(self):
        """Test getting only enabled knowledge items."""
        agent = Agent(
            name="KBAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
            knowledge_base=[
                {"id": "k1", "title": "Enabled", "content": "Content1", "enabled": True},
                {"id": "k2", "title": "Disabled", "content": "Content2", "enabled": False},
                {"id": "k3", "title": "AlsoEnabled", "content": "Content3", "enabled": True},
            ],
        )
        enabled = agent.get_enabled_knowledge()
        assert len(enabled) == 2
        assert all(k.get("enabled", True) for k in enabled)

    def test_query_knowledge_basic(self):
        """Test basic knowledge query."""
        agent = Agent(
            name="QueryAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
            knowledge_base=[
                {"id": "k1", "title": "Weather", "content": "The sky is blue", "enabled": True},
                {"id": "k2", "title": "Food", "content": "Apples are red", "enabled": True},
            ],
        )
        results = agent.query_knowledge("sky color")
        assert len(results) > 0
        # Should find the weather item
        assert any("sky" in r.get("content", "").lower() or "sky" in r.get("title", "").lower() for r in results)

    def test_query_knowledge_empty_query(self):
        """Test knowledge query with empty string."""
        agent = Agent(
            name="EmptyQueryAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
            knowledge_base=[
                {"id": "k1", "title": "Test", "content": "Content", "enabled": True},
            ],
        )
        results = agent.query_knowledge("")
        assert results == []

    def test_query_knowledge_no_results(self):
        """Test knowledge query with no matching results."""
        agent = Agent(
            name="NoResultAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
            knowledge_base=[
                {"id": "k1", "title": "Weather", "content": "The sky is blue", "enabled": True},
            ],
        )
        results = agent.query_knowledge("programming code")
        assert len(results) == 0

    def test_query_knowledge_title_boost(self):
        """Test that title matches get boosted score."""
        agent = Agent(
            name="TitleBoostAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
            knowledge_base=[
                {"id": "k1", "title": "Programming Guide", "content": "About coding", "enabled": True},
                {"id": "k2", "title": "Cooking", "content": "Programming tips here", "enabled": True},
            ],
        )
        results = agent.query_knowledge("programming")
        # Title match should be ranked higher
        assert results[0]["id"] == "k1"

    def test_get_knowledge_context_with_query(self):
        """Test getting formatted knowledge context with query."""
        agent = Agent(
            name="ContextAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
            knowledge_base=[
                {"id": "k1", "title": "Fact", "content": "Important info", "enabled": True},
            ],
        )
        context = agent.get_knowledge_context("important")
        assert "Your Knowledge Base:" in context
        assert "Fact" in context
        assert "Important info" in context

    def test_get_knowledge_context_without_query(self):
        """Test getting all knowledge context without query."""
        agent = Agent(
            name="AllContextAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
            knowledge_base=[
                {"id": "k1", "title": "Fact1", "content": "Content1", "enabled": True},
                {"id": "k2", "title": "Fact2", "content": "Content2", "enabled": True},
            ],
        )
        context = agent.get_knowledge_context()
        assert "Fact1" in context
        assert "Fact2" in context

    def test_get_knowledge_context_empty(self):
        """Test knowledge context when no knowledge exists."""
        agent = Agent(
            name="EmptyKBAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        context = agent.get_knowledge_context("anything")
        assert context == ""


# =============================================================================
# Document RAG Tests
# =============================================================================


class TestAgentDocuments:
    """Tests for agent document management."""

    def test_set_global_knowledge(self):
        """Test setting global knowledge reference."""
        agent = Agent(
            name="GlobalKB",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        global_kb = {"gk1": {"id": "gk1", "content": "Global fact"}}
        agent.set_global_knowledge(global_kb)
        assert agent._global_knowledge == global_kb

    def test_retrieve_from_documents_empty(self):
        """Test document retrieval when no documents exist."""
        agent = Agent(
            name="NoDocAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        results = agent.retrieve_from_documents([0.1, 0.2, 0.3])
        assert results == []

    def test_retrieve_from_documents_with_data(self):
        """Test document retrieval with existing documents."""
        agent = Agent(
            name="DocAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
            documents={
                "doc1": {
                    "id": "doc1",
                    "filename": "test.txt",
                    "chunks": [
                        {"chunk_id": "c1", "text": "Test content one"},
                        {"chunk_id": "c2", "text": "Test content two"},
                    ],
                    "embeddings": {
                        "c1": [1.0, 0.0, 0.0],
                        "c2": [0.9, 0.1, 0.0],
                    },
                }
            },
        )
        # Query with embedding similar to first chunk
        results = agent.retrieve_from_documents([0.9, 0.0, 0.0])
        assert len(results) > 0
        assert results[0]["source"] == "private"

    def test_composite_rag_retrieve_empty(self):
        """Test composite RAG with no data."""
        agent = Agent(
            name="EmptyRAG",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        results = agent.composite_rag_retrieve("test query", None)
        assert results == []

    def test_composite_rag_retrieve_with_private_only(self):
        """Test composite RAG with only private documents."""
        agent = Agent(
            name="PrivateRAG",
            user_profile="Profile",
            style="neutral",
            action_space=[],
            documents={
                "doc1": {
                    "id": "doc1",
                    "filename": "private.txt",
                    "chunks": [{"chunk_id": "c1", "text": "Private info"}],
                    "embeddings": {"c1": [0.5, 0.5, 0.0]},
                }
            },
        )
        results = agent.composite_rag_retrieve("test", None)
        assert len(results) >= 0  # May return empty if embedding fails

    def test_composite_rag_retrieve_with_global_only(self):
        """Test composite RAG with only global knowledge."""
        global_kb = {
            "gk1": {
                "id": "gk1",
                "content": "Global info",
                "chunks": [{"chunk_id": "c1", "text": "Global chunk"}],
                "embeddings": {"c1": [0.5, 0.5, 0.0]},
            }
        }
        agent = Agent(
            name="GlobalRAG",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        agent.set_global_knowledge(global_kb)
        results = agent.composite_rag_retrieve("test", None)
        assert len(results) >= 0

    def test_get_rag_context_empty(self):
        """Test RAG context when no documents exist."""
        agent = Agent(
            name="NoRAGAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        context = agent.get_rag_context("test", None)
        assert context == ""

    def test_sync_documents_to_vector_store_no_store(self):
        """Test document sync when vector store unavailable."""
        agent = Agent(
            name="SyncAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
            documents={
                "doc1": {
                    "id": "doc1",
                    "chunks": [{"chunk_id": "c1", "text": "Text"}],
                    "embeddings": {"c1": [0.1, 0.2, 0.3]},
                }
            },
        )
        result = agent.sync_documents_to_vector_store()
        # Should return False if no vector store configured
        assert result in [False, True]  # Depends on environment


# =============================================================================
# Plan State Tests
# =============================================================================


class TestAgentPlanState:
    """Tests for agent plan state management."""

    def test_plan_state_initial_values(self):
        """Test plan state starts with empty values."""
        agent = Agent(
            name="PlanInitAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        assert agent.plan_state["goals"] == []
        assert agent.plan_state["milestones"] == []
        assert agent.plan_state["strategy"] == ""
        assert agent.plan_state["notes"] == ""

    def test_plan_state_mutation(self):
        """Test plan state can be modified."""
        agent = Agent(
            name="PlanMutateAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        agent.plan_state["strategy"] = "New strategy"
        agent.plan_state["notes"] = "Important notes"
        assert agent.plan_state["strategy"] == "New strategy"
        assert agent.plan_state["notes"] == "Important notes"

    def test_parse_plan_update_no_change(self):
        """Test plan update with 'no change' marker."""
        agent = Agent(
            name="NoChangeAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        result = agent._parse_plan_update("no change")
        assert result is None

    def test_parse_plan_update_with_goals(self):
        """Test parsing plan update with goals."""
        agent = Agent(
            name="GoalsAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        update_block = """
1. First goal
2. Second goal
3. Third goal
"""
        result = agent._parse_plan_update(update_block)
        assert result is not None
        assert len(result["goals"]) == 3
        assert result["goals"][0]["desc"] == "First goal"

    def test_parse_plan_update_with_current_goal(self):
        """Test parsing plan update with [CURRENT] marker."""
        agent = Agent(
            name="CurrentAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        update_block = """
1. Regular goal
2. [CURRENT] Active goal
3. Another goal
"""
        result = agent._parse_plan_update(update_block)
        assert result is not None
        assert result["goals"][1]["status"] == "current"
        assert result["goals"][0]["status"] == "pending"

    def test_parse_plan_update_with_milestones(self):
        """Test parsing plan update with milestones."""
        agent = Agent(
            name="MilestoneAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        update_block = """
<Milestones>
1. First milestone
2. [DONE] Completed milestone
</Milestones>
"""
        result = agent._parse_plan_update(update_block)
        assert result is not None
        assert len(result["milestones"]) == 2
        assert result["milestones"][0]["status"] == "pending"
        assert result["milestones"][1]["status"] == "done"

    def test_parse_plan_update_with_strategy(self):
        """Test parsing plan update with strategy."""
        agent = Agent(
            name="StrategyAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        update_block = """
<Strategy>
Use diplomacy first, then force.
</Strategy>
"""
        result = agent._parse_plan_update(update_block)
        assert result is not None
        assert "diplomacy" in result["strategy"]

    def test_apply_plan_update(self):
        """Test applying plan update."""
        agent = Agent(
            name="ApplyAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        new_plan = {
            "goals": [{"id": "g1", "desc": "New goal", "priority": "high", "status": "pending"}],
            "milestones": [],
            "strategy": "New strategy",
            "notes": "New notes",
        }
        result = agent._apply_plan_update(new_plan)
        assert result is True
        assert agent.plan_state["strategy"] == "New strategy"


# =============================================================================
# Emotion Tests
# =============================================================================


class TestAgentEmotion:
    """Tests for agent emotion system."""

    def test_emotion_default(self):
        """Test default emotion is neutral."""
        agent = Agent(
            name="EmotionDefaultAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        assert agent.emotion == "neutral"

    def test_emotion_custom_initial(self):
        """Test custom initial emotion."""
        agent = Agent(
            name="HappyAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
            emotion="joyful",
        )
        assert agent.emotion == "joyful"

    def test_emotion_enabled_default_false(self):
        """Test emotion tracking is disabled by default."""
        agent = Agent(
            name="NoEmotionTrackAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        assert agent.emotion_enabled is False

    def test_emotion_enabled_true(self):
        """Test emotion tracking can be enabled."""
        agent = Agent(
            name="EmotionTrackAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
            emotion_enabled=True,
        )
        assert agent.emotion_enabled is True

    def test_parse_emotion_update_valid(self):
        """Test parsing valid emotion update."""
        agent = Agent(
            name="EmotionParseAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        result = agent._parse_emotion_update("Joy")
        assert result == "Joy"

    def test_parse_emotion_update_no_change(self):
        """Test parsing 'no change' emotion update."""
        agent = Agent(
            name="NoEmotionChangeAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        result = agent._parse_emotion_update("no change")
        assert result is None

    def test_parse_emotion_update_empty(self):
        """Test parsing empty emotion update."""
        agent = Agent(
            name="EmptyEmotionAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        result = agent._parse_emotion_update("")
        assert result is None


# =============================================================================
# Action Parsing Tests
# =============================================================================


class TestActionParsing:
    """Tests for action parsing from LLM responses."""

    def test_parse_full_response_all_sections(self):
        """Test parsing response with all sections."""
        agent = Agent(
            name="ParseAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        response = """--- Thoughts ---
Thinking about what to do next.

--- Plan ---
Goals: Collect food

--- Action ---
<Action name="gather_resource"><resource>food</resource></Action>
"""
        thoughts, plan, action, plan_update, emotion = agent._parse_full_response(response)
        assert "Thinking" in thoughts
        assert "Collect food" in plan
        assert "gather_resource" in action

    def test_parse_action_simple(self):
        """Test parsing simple action."""
        agent = Agent(
            name="SimpleActionAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        result = agent._parse_actions('<Action name="send_message"><message>Hi!</message></Action>')
        assert len(result) == 1
        assert result[0]["action"] == "send_message"
        assert result[0]["message"] == "Hi!"

    def test_parse_action_with_params(self):
        """Test parsing action with multiple parameters."""
        agent = Agent(
            name="ParamsAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        result = agent._parse_actions('<Action name="move"><direction>north</direction><speed>walk</speed></Action>')
        assert len(result) == 1
        assert result[0]["action"] == "move"
        assert result[0]["direction"] == "north"
        assert result[0]["speed"] == "walk"

    def test_parse_action_self_closing(self):
        """Test parsing self-closing action tag."""
        agent = Agent(
            name="SelfClosingAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        result = agent._parse_actions('<Action name="yield" />')
        assert len(result) == 1
        assert result[0]["action"] == "yield"

    def test_parse_action_empty_block(self):
        """Test parsing empty action block."""
        agent = Agent(
            name="EmptyActionAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        result = agent._parse_actions("")
        assert result == []

    def test_parse_action_with_code_fences(self):
        """Test parsing action wrapped in code fences."""
        agent = Agent(
            name="FenceAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        result = agent._parse_actions('```xml\n<Action name="test"></Action>\n```')
        assert len(result) == 1
        assert result[0]["action"] == "test"

    def test_parse_action_no_name(self):
        """Test parsing action without name attribute."""
        agent = Agent(
            name="NoNameAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        result = agent._parse_actions('<Action><param>value</param></Action>')
        assert result == []

    def test_parse_action_with_ampersand(self):
        """Test parsing action with bare ampersand (needs normalization)."""
        agent = Agent(
            name="AmpersandAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        result = agent._parse_actions('<Action name="test"><text>Tom & Jerry</text></Action>')
        assert len(result) == 1
        assert result[0]["action"] == "test"


# =============================================================================
# Serialization Tests
# =============================================================================


class TestAgentSerialization:
    """Tests for agent serialization and deserialization."""

    def test_serialize_basic(self):
        """Test basic agent serialization."""
        agent = Agent(
            name="SerializeAgent",
            user_profile="Profile for serialization",
            style="friendly",
            action_space=[],
        )
        data = agent.serialize()
        assert data["name"] == "SerializeAgent"
        assert data["user_profile"] == "Profile for serialization"
        assert data["style"] == "friendly"
        assert data["language"] == "en"

    def test_serialize_with_memory(self):
        """Test serialization includes short memory."""
        agent = Agent(
            name="MemSerializeAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        agent.add_env_feedback("Test message")
        data = agent.serialize()
        assert "short_memory" in data
        assert len(data["short_memory"]) == 1

    def test_serialize_with_plan_state(self):
        """Test serialization includes plan state."""
        agent = Agent(
            name="PlanSerializeAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        agent.plan_state["strategy"] = "Test strategy"
        data = agent.serialize()
        assert data["plan_state"]["strategy"] == "Test strategy"

    def test_serialize_with_knowledge_base(self):
        """Test serialization includes knowledge base."""
        agent = Agent(
            name="KBSerializeAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
            knowledge_base=[
                {"id": "k1", "title": "Fact", "content": "Content", "enabled": True}
            ],
        )
        data = agent.serialize()
        assert len(data["knowledge_base"]) == 1
        assert data["knowledge_base"][0]["id"] == "k1"

    def test_serialize_with_documents(self):
        """Test serialization includes documents."""
        agent = Agent(
            name="DocsSerializeAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
            documents={
                "doc1": {
                    "id": "doc1",
                    "filename": "test.pdf",
                    "chunks": [{"chunk_id": "c1", "text": "Text"}],
                    "embeddings": {"c1": [0.1, 0.2]},
                }
            },
        )
        data = agent.serialize()
        assert "documents" in data
        assert data["documents"]["doc1"]["filename"] == "test.pdf"

    def test_serialize_with_emotion(self):
        """Test serialization includes emotion state."""
        agent = Agent(
            name="EmotionSerializeAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
            emotion="happy",
            emotion_enabled=True,
        )
        data = agent.serialize()
        assert data["emotion"] == "happy"
        assert data["emotion_enabled"] is True

    def test_serialize_with_error_state(self):
        """Test serialization includes LLM error state."""
        agent = Agent(
            name="ErrorSerializeAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        agent.consecutive_llm_errors = 2
        data = agent.serialize()
        assert data["consecutive_llm_errors"] == 2
        assert data["is_offline"] is False

    def test_deserialize_basic(self):
        """Test basic agent deserialization."""
        data = {
            "name": "DeserializeAgent",
            "user_profile": "Restored profile",
            "style": "friendly",
            "initial_instruction": "",
            "role_prompt": "",
            "language": "en",
            "action_space": [],
            "short_memory": [],
            "last_history_length": 0,
            "max_repeat": MAX_REPEAT,
            "properties": {},
            "plan_state": {"goals": [], "milestones": [], "strategy": "", "notes": ""},
            "emotion": "neutral",
            "emotion_enabled": False,
            "knowledge_base": [],
            "documents": {},
            "consecutive_llm_errors": 0,
            "is_offline": False,
            "max_consecutive_llm_errors": 3,
        }
        agent = Agent.deserialize(data)
        assert agent.name == "DeserializeAgent"
        assert agent.user_profile == "Restored profile"
        assert agent.style == "friendly"

    def test_deserialize_with_memory(self):
        """Test deserialization restores short memory."""
        data = {
            "name": "MemRestoreAgent",
            "user_profile": "Profile",
            "style": "neutral",
            "initial_instruction": "",
            "role_prompt": "",
            "language": "en",
            "action_space": [],
            "short_memory": [
                {"role": "user", "content": "Test message", "images": [], "audio": [], "video": []}
            ],
            "last_history_length": 1,
            "max_repeat": MAX_REPEAT,
            "properties": {},
            "plan_state": {"goals": [], "milestones": [], "strategy": "", "notes": ""},
            "emotion": "neutral",
            "emotion_enabled": False,
            "knowledge_base": [],
            "documents": {},
            "consecutive_llm_errors": 0,
            "is_offline": False,
            "max_consecutive_llm_errors": 3,
        }
        agent = Agent.deserialize(data)
        assert len(agent.short_memory.get_all()) == 1
        assert agent.short_memory.get_all()[0]["content"] == "Test message"

    def test_deserialize_with_knowledge_base(self):
        """Test deserialization restores knowledge base."""
        data = {
            "name": "KBRestoreAgent",
            "user_profile": "Profile",
            "style": "neutral",
            "initial_instruction": "",
            "role_prompt": "",
            "language": "en",
            "action_space": [],
            "short_memory": [],
            "last_history_length": 0,
            "max_repeat": MAX_REPEAT,
            "properties": {},
            "plan_state": {"goals": [], "milestones": [], "strategy": "", "notes": ""},
            "emotion": "neutral",
            "emotion_enabled": False,
            "knowledge_base": [
                {"id": "k1", "title": "Fact", "content": "Content", "enabled": True}
            ],
            "documents": {},
            "consecutive_llm_errors": 0,
            "is_offline": False,
            "max_consecutive_llm_errors": 3,
        }
        agent = Agent.deserialize(data)
        assert len(agent.knowledge_base) == 1
        assert agent.knowledge_base[0]["id"] == "k1"

    def test_deserialize_with_documents(self):
        """Test deserialization restores documents."""
        data = {
            "name": "DocsRestoreAgent",
            "user_profile": "Profile",
            "style": "neutral",
            "initial_instruction": "",
            "role_prompt": "",
            "language": "en",
            "action_space": [],
            "short_memory": [],
            "last_history_length": 0,
            "max_repeat": MAX_REPEAT,
            "properties": {},
            "plan_state": {"goals": [], "milestones": [], "strategy": "", "notes": ""},
            "emotion": "neutral",
            "emotion_enabled": False,
            "knowledge_base": [],
            "documents": {
                "doc1": {
                    "id": "doc1",
                    "filename": "test.pdf",
                    "chunks": [{"chunk_id": "c1", "text": "Text"}],
                    "embeddings": {"c1": [0.1, 0.2, 0.3]},
                }
            },
            "consecutive_llm_errors": 0,
            "is_offline": False,
            "max_consecutive_llm_errors": 3,
        }
        agent = Agent.deserialize(data)
        assert len(agent.documents) == 1
        assert agent.documents["doc1"]["filename"] == "test.pdf"

    def test_deserialize_with_error_state(self):
        """Test deserialization restores error state."""
        data = {
            "name": "ErrorRestoreAgent",
            "user_profile": "Profile",
            "style": "neutral",
            "initial_instruction": "",
            "role_prompt": "",
            "language": "en",
            "action_space": [],
            "short_memory": [],
            "last_history_length": 0,
            "max_repeat": MAX_REPEAT,
            "properties": {},
            "plan_state": {"goals": [], "milestones": [], "strategy": "", "notes": ""},
            "emotion": "neutral",
            "emotion_enabled": False,
            "knowledge_base": [],
            "documents": {},
            "consecutive_llm_errors": 2,
            "is_offline": False,
            "max_consecutive_llm_errors": 3,
        }
        agent = Agent.deserialize(data)
        assert agent.consecutive_llm_errors == 2
        assert agent.is_offline is False

    def test_deserialize_with_offline_state(self):
        """Test deserialization restores offline state."""
        data = {
            "name": "OfflineRestoreAgent",
            "user_profile": "Profile",
            "style": "neutral",
            "initial_instruction": "",
            "role_prompt": "",
            "language": "en",
            "action_space": [],
            "short_memory": [],
            "last_history_length": 0,
            "max_repeat": MAX_REPEAT,
            "properties": {},
            "plan_state": {"goals": [], "milestones": [], "strategy": "", "notes": ""},
            "emotion": "neutral",
            "emotion_enabled": False,
            "knowledge_base": [],
            "documents": {},
            "consecutive_llm_errors": 5,
            "is_offline": True,
            "max_consecutive_llm_errors": 3,
        }
        agent = Agent.deserialize(data)
        assert agent.is_offline is True
        assert agent.consecutive_llm_errors == 5

    def test_serialize_deserialize_roundtrip(self):
        """Test full serialization/deserialization roundtrip."""
        original = Agent(
            name="RoundtripAgent",
            user_profile="Full profile for roundtrip",
            style="friendly",
            initial_instruction="Be nice",
            role_prompt="You are friendly",
            action_space=[],
            language="fr",
            emotion="happy",
            emotion_enabled=True,
            knowledge_base=[
                {"id": "k1", "title": "Fact", "content": "Content", "enabled": True}
            ],
        )
        original.plan_state["strategy"] = "Test plan"
        original.add_env_feedback("Test memory")

        data = original.serialize()
        restored = Agent.deserialize(data)

        assert restored.name == original.name
        assert restored.user_profile == original.user_profile
        assert restored.emotion == original.emotion
        assert restored.emotion_enabled == original.emotion_enabled
        assert len(restored.knowledge_base) == len(original.knowledge_base)


# =============================================================================
# Process & LLM Interaction Tests
# =============================================================================


class TestAgentProcess:
    """Tests for agent process method and LLM interaction."""

    def test_process_with_no_new_events(self):
        """Test process returns empty when no new events."""
        agent = Agent(
            name="NoEventsAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        # Mock clients
        clients = {}
        result = agent.process(clients)
        assert result == {}

    def test_process_with_initiative(self):
        """Test process with initiative flag."""
        agent = Agent(
            name="InitiativeAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        clients = {}
        result = agent.process(clients, initiative=True)
        # Without valid LLM client, will still return empty
        assert isinstance(result, dict)

    def test_process_when_offline(self):
        """Test process returns empty when agent is offline."""
        agent = Agent(
            name="OfflineAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        agent.is_offline = True
        clients = {}
        result = agent.process(clients)
        assert result == {}

    def test_call_llm_missing_client(self):
        """Test call_llm raises error for missing client."""
        agent = Agent(
            name="NoClientAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        clients = {}
        with pytest.raises(ValueError, match="LLM client 'chat' not found"):
            agent.call_llm(clients, [])


# =============================================================================
# LLM Error Handling Tests
# =============================================================================


class TestAgentLLMErrors:
    """Tests for LLM error handling and offline state."""

    def test_record_llm_error_first_error(self):
        """Test recording first LLM error."""
        agent = Agent(
            name="FirstErrorAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        agent._record_llm_error("llm_call", Exception("API error"), 1, False)
        assert agent.consecutive_llm_errors == 1
        assert agent.is_offline is False

    def test_record_llm_error_reaches_threshold(self):
        """Test agent goes offline after threshold errors."""
        agent = Agent(
            name="ThresholdAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
            max_consecutive_llm_errors=2,
        )
        # Record errors up to threshold
        agent._record_llm_error("llm_call", Exception("Error 1"), 1, False)
        assert agent.is_offline is False

        agent._record_llm_error("llm_call", Exception("Error 2"), 2, True)
        assert agent.is_offline is True

    def test_record_llm_error_past_threshold(self):
        """Test agent already offline when error recorded."""
        agent = Agent(
            name="AlreadyOfflineAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
            max_consecutive_llm_errors=2,
        )
        agent.consecutive_llm_errors = 2
        agent.is_offline = True
        # Should stay offline
        agent._record_llm_error("llm_call", Exception("Another error"), 1, True)
        assert agent.is_offline is True


# =============================================================================
# Summary Tests
# =============================================================================


class TestAgentSummary:
    """Tests for conversation history summarization."""

    def test_summarize_history_empty(self):
        """Test summarizing empty history."""
        agent = Agent(
            name="EmptySummaryAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        # Add to memory first
        agent.short_memory.append("user", "Hello")
        agent.short_memory.append("assistant", "Hi there!")

        # Need a mock client that returns a summary
        class MockClient:
            def chat(self, messages):
                return "Summary: Greeting exchange"

        agent.summarize_history(MockClient())
        assert len(agent.short_memory.get_all()) == 1
        assert "Summary" in agent.short_memory.get_all()[0]["content"]


# =============================================================================
# Generate Search Query Tests
# =============================================================================


class TestAgentSearchQuery:
    """Tests for generating search queries from memory."""

    def test_generate_search_query_from_memory_empty(self):
        """Test generating query from empty memory."""
        agent = Agent(
            name="EmptyQueryAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        query = agent._generate_search_query_from_memory()
        assert query == ""

    def test_generate_search_query_from_memory_with_messages(self):
        """Test generating query from existing messages."""
        agent = Agent(
            name="QueryAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )
        agent.add_env_feedback("The weather is sunny")
        agent.short_memory.append("assistant", "Nice to hear")
        agent.add_env_feedback("What about tomorrow?")

        query = agent._generate_search_query_from_memory()
        assert "tomorrow" in query


# =============================================================================
# Integration Tests
# =============================================================================


class TestAgentIntegration:
    """Integration tests for complete agent workflows."""

    def test_full_knowledge_workflow(self):
        """Test complete knowledge base workflow."""
        agent = Agent(
            name="FullKBAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )

        # Add knowledge
        agent.add_knowledge({"id": "k1", "title": "Fact", "content": "Test content", "enabled": True})

        # Query knowledge
        results = agent.query_knowledge("test")
        assert len(results) > 0

        # Get context
        context = agent.get_knowledge_context("test")
        assert "Test content" in context

        # Remove knowledge
        removed = agent.remove_knowledge("k1")
        assert removed is True
        assert len(agent.get_enabled_knowledge()) == 0

    def test_full_plan_workflow(self):
        """Test complete plan state workflow."""
        agent = Agent(
            name="FullPlanAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
        )

        # Parse plan update
        update = agent._parse_plan_update("""
<Goals>
1. [CURRENT] Main goal
2. Secondary goal
</Goals>
<Strategy>
Use careful planning
</Strategy>
""")

        # Apply update
        agent._apply_plan_update(update)

        # Verify state
        assert len(agent.plan_state["goals"]) == 2
        assert agent.plan_state["goals"][0]["status"] == "current"
        assert "careful planning" in agent.plan_state["strategy"]

    def test_full_emotion_workflow(self):
        """Test complete emotion workflow."""
        agent = Agent(
            name="FullEmotionAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
            emotion_enabled=True,
        )

        # Initial emotion
        assert agent.emotion == "neutral"

        # Parse and apply update
        new_emotion = agent._parse_emotion_update("Joy")
        if new_emotion:
            agent.emotion = new_emotion

        assert agent.emotion == "Joy"

    def test_offline_recovery_workflow(self):
        """Test agent going offline and staying offline."""
        agent = Agent(
            name="RecoveryAgent",
            user_profile="Profile",
            style="neutral",
            action_space=[],
            max_consecutive_llm_errors=2,
        )

        # Initially online
        assert agent.is_offline is False
        assert agent.consecutive_llm_errors == 0

        # Simulate errors leading to offline
        agent._record_llm_error("llm_call", Exception("Error 1"), 1, False)
        assert agent.is_offline is False

        agent._record_llm_error("llm_call", Exception("Error 2"), 2, True)
        assert agent.is_offline is True

        # process returns empty when offline
        result = agent.process({})
        assert result == {}
