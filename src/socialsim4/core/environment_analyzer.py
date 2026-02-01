import json
import logging
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)


class EnvironmentAnalyzer:
    """Analyzes simulation context and generates environmental event suggestions."""

    def __init__(self, clients: Dict[str, Any]):
        self.clients = clients

    def summarize_context(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Summarize recent simulation context using LLM.

        Args:
            context: Dict with recent_events, agent_count, current_turn, scene_time

        Returns:
            Dict with themes, sentiment, notable_actions, suggested_event_types
        """
        chat_client = self.clients.get("chat") or self.clients.get("default")

        # Build context summary prompt
        events_text = "\n".join(
            f"- {e.get('text', str(e.get('type', 'unknown')))}"
            for e in context.get("recent_events", [])[:10]
        )

        prompt = f"""Analyze the following simulation context and provide a brief summary.

Recent events (last 5 turns):
{events_text}

Agent count: {context.get('agent_count', 0)}
Current turn: {context.get('current_turn', 0)}
Scene time: {context.get('scene_time', 0)} minutes

Respond in JSON format with these keys:
- themes: list of main themes (e.g., ["conflict", "planning"])
- sentiment: overall mood (e.g., "tense", "calm", "excited")
- notable_actions: list of key actions taken
- suggested_event_types: list of appropriate event types (weather, emergency, notification, opinion)

JSON only, no explanation."""

        try:
            response = chat_client.chat([{"role": "user", "content": prompt}])
            # Parse JSON from response (handle potential markdown code blocks)
            response = response.strip()
            logger.debug(f"LLM summarize response: {response[:200]}...")
            if response.startswith("```"):
                response = response.split("```")[1]
                if response.startswith("json"):
                    response = response[4:]
            if not response.strip():
                raise ValueError("Empty LLM response")
            return json.loads(response.strip())
        except Exception as e:
            logger.exception("Failed to summarize context with LLM: %s", e)
            # Fallback to basic analysis
            return {
                "themes": ["general"],
                "sentiment": "neutral",
                "notable_actions": [],
                "suggested_event_types": ["notification"],
            }

    def generate_suggestions(
        self,
        context: Dict[str, Any],
        count: int = 3,
    ) -> List[Dict[str, Any]]:
        """
        Generate environmental event suggestions based on context.

        Args:
            context: Simulation context
            count: Maximum number of suggestions to generate

        Returns:
            List of suggestion dicts with event_type, description, severity
        """
        summary = self.summarize_context(context)
        chat_client = self.clients.get("chat") or self.clients.get("default")

        prompt = f"""Based on the following simulation summary, suggest {count} environmental events that could naturally occur.

Simulation Summary:
- Themes: {', '.join(summary.get('themes', []))}
- Sentiment: {summary.get('sentiment', 'neutral')}
- Notable actions: {', '.join(summary.get('notable_actions', []))}

Event types can be:
- weather: rain, storm, snow, temperature change
- emergency: fire, power outage, medical emergency, accident
- notification: government announcement, policy change, school closure
- opinion: rumor spreading, sentiment shift, trending topic

For each suggestion, provide:
- event_type: one of the above
- description: brief natural language description (1 sentence)
- severity: mild, moderate, or severe

Respond in JSON format as a list:
[
  {{"event_type": "...", "description": "...", "severity": "..."}},
  ...
]

JSON only, no explanation."""

        try:
            response = chat_client.chat([{"role": "user", "content": prompt}])
            response = response.strip()
            logger.debug(f"LLM suggestions response: {response[:200]}...")
            if not response:
                raise ValueError("Empty LLM response")
            if response.startswith("```"):
                response = response.split("```")[1]
                if response.startswith("json"):
                    response = response[4:]
            if not response.strip():
                raise ValueError("Empty LLM response after cleaning")
            suggestions = json.loads(response.strip())

            # Validate and sanitize
            valid_severities = {"mild", "moderate", "severe"}
            valid_types = {"weather", "emergency", "notification", "opinion"}

            result = []
            for s in suggestions[:count]:
                if s.get("event_type") in valid_types and s.get("description") and s.get("severity") in valid_severities:
                    result.append({
                        "event_type": s["event_type"],
                        "description": s["description"],
                        "severity": s["severity"],
                    })

            return result
        except Exception as e:
            logger.exception("Failed to generate suggestions: %s", e)
            # Fallback suggestion
            return [{
                "event_type": "notification",
                "description": "A community announcement is posted on the bulletin board.",
                "severity": "mild",
            }]
