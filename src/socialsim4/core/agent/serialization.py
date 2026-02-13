"""
Agent serialization and deserialization utilities.

This module handles converting agents to/from dictionaries for
persistence and snapshot restoration.

Contains:
    - serialize_agent: Convert agent to serializable dict
    - deserialize_agent: Create agent from serialized dict
"""

import json
import logging

from socialsim4.core.config import MAX_REPEAT


logger = logging.getLogger(__name__)


def serialize_agent(agent) -> dict:
    """
    Convert agent to serializable dictionary.

    Deep-copies dict/list fields to avoid sharing across snapshots.
    Preserves all agent state including memory, plans, knowledge,
    documents, and error state.

    Args:
        agent: Agent instance to serialize

    Returns:
        Dictionary with all agent state, suitable for JSON serialization
    """
    # Deep-copy memory
    mem = [
        {
            "role": m.get("role"),
            "content": m.get("content"),
            "images": m.get("images", []),
            "audio": m.get("audio", []),
            "video": m.get("video", []),
        }
        for m in agent.short_memory.get_all()
    ]

    # Deep-copy properties
    props = json.loads(json.dumps(agent.properties))

    # Deep-copy plan state
    plan = json.loads(json.dumps(agent.plan_state))

    # Deep-copy knowledge base
    kb = json.loads(json.dumps(agent.knowledge_base))

    # Deep-copy documents
    docs = json.loads(json.dumps(agent.documents))

    return {
        "name": agent.name,
        "user_profile": agent.user_profile,
        "style": agent.style,
        "initial_instruction": agent.initial_instruction,
        "role_prompt": agent.role_prompt,
        "language": agent.language,
        "action_space": [action.NAME for action in agent.action_space],
        "short_memory": mem,
        "last_history_length": agent.last_history_length,
        "max_repeat": agent.max_repeat,
        "properties": props,
        "plan_state": plan,
        "emotion": agent.emotion,
        "emotion_enabled": agent.emotion_enabled,
        # Knowledge Base (RAG)
        "knowledge_base": kb,
        # Documents (Embedded RAG)
        "documents": docs,
        # LLM error state
        "consecutive_llm_errors": int(getattr(agent, "consecutive_llm_errors", 0)),
        "is_offline": bool(getattr(agent, "is_offline", False)),
        "max_consecutive_llm_errors": int(getattr(agent, "max_consecutive_llm_errors", 3)),
    }


def deserialize_agent(data: dict, event_handler=None, agent_class=None) -> object:
    """
    Create agent from serialized dictionary.

    Restores all agent state including memory, plans, knowledge,
    documents, and error state.

    Args:
        data: Serialized agent dictionary
        event_handler: Optional event handler function
        agent_class: Agent class to instantiate (defaults to Agent)

    Returns:
        Restored Agent instance
    """
    from socialsim4.core.agent import Agent
    from .registry import ACTION_SPACE_MAP

    if agent_class is None:
        agent_class = Agent

    # Deep-copy properties to avoid sharing
    raw_props = data.get("properties", {}) or {}
    props = json.loads(json.dumps(raw_props))

    # Handle emotion_enabled: check top-level data, then props, then default to False
    if "emotion_enabled" in data:
        props.setdefault("emotion_enabled", data["emotion_enabled"])
    else:
        props.setdefault("emotion_enabled", False)

    agent = agent_class(
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
        # Other properties (including emotion_enabled) from props
        **props,
    )

    # Restore emotion value
    agent.emotion = data.get("emotion", "neutral")
    agent.emotion_enabled = bool(props.get("emotion_enabled", False))

    # Restore memory
    agent.short_memory.history = json.loads(
        json.dumps(data.get("short_memory", []))
    )
    agent.last_history_length = data.get("last_history_length", 0)

    # Restore plan state
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

    # Restore knowledge base
    kb_data = data.get("knowledge_base", [])
    logger.debug(f"Agent.deserialize '{agent.name}': kb_data has {len(kb_data)} items")
    if kb_data:
        agent.knowledge_base = json.loads(json.dumps(kb_data))
        logger.debug(f"Agent.deserialize '{agent.name}': after copy, knowledge_base has {len(agent.knowledge_base)} items")
        for i, item in enumerate(agent.knowledge_base):
            logger.debug(
                f"  KB[{i}]: id={item.get('id')}, title='{item.get('title', '')[:40]}', enabled={item.get('enabled')}"
            )

    # Restore documents
    docs_data = data.get("documents", {})
    if docs_data:
        agent.documents = json.loads(json.dumps(docs_data))
        logger.debug(f"Agent.deserialize '{agent.name}': documents has {len(agent.documents)} items")

    # Restore LLM error state
    agent.consecutive_llm_errors = data.get("consecutive_llm_errors", 0)
    agent.is_offline = data.get("is_offline", False)
    agent.max_consecutive_llm_errors = data.get("max_consecutive_llm_errors", 3)

    return agent
