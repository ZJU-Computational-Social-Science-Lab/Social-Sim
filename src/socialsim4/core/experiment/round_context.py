"""
Round Context Manager - maintains cumulative per-agent summaries.

After each round, the context manager updates each agent's summary
with the round's events, creating a running narrative of what happened.

Contains: RoundEvent dataclass, RoundContextManager class.
"""

from dataclasses import dataclass
from typing import Dict, List, Any
import asyncio
import logging

from socialsim4.core.experiment.agent import ExperimentAgent
from socialsim4.core.llm.client import LLMClient


logger = logging.getLogger(__name__)


@dataclass
class RoundEvent:
    """Single event within a round for context tracking.

    Attributes:
        agent_name: Who performed the action
        action_name: What action they took
        parameters: Action parameters
        round_num: Which round this occurred in
        summary: Human-readable summary
    """
    agent_name: str
    action_name: str
    parameters: Dict[str, Any]
    round_num: int
    summary: str


class RoundContextManager:
    """Manages cumulative per-agent context summaries.

    After each round, each agent gets an updated summary that includes
    all previous actions (from their perspective or globally, depending
    on round_visibility setting).
    """

    def __init__(self, initial_contexts: Dict[str, str] | None = None):
        """Initialize context manager.

        Args:
            initial_contexts: Optional starting contexts for each agent
        """
        self._summaries: Dict[str, str] = initial_contexts or {}
        self._round_events: List[RoundEvent] = []

    def record_action(
        self,
        agent_name: str,
        action_name: str,
        parameters: Dict[str, Any],
        round_num: int,
        summary: str
    ) -> None:
        """Record an action for context tracking.

        Args:
            agent_name: Agent who acted
            action_name: Action they took
            parameters: Action parameters
            round_num: Current round number
            summary: Human-readable summary
        """
        event = RoundEvent(
            agent_name=agent_name,
            action_name=action_name,
            parameters=parameters,
            round_num=round_num,
            summary=summary
        )
        self._round_events.append(event)

    def get_round_events(self, round_num: int) -> List[RoundEvent]:
        """Get all events for a specific round.

        Args:
            round_num: Round number to query

        Returns:
            List of RoundEvent objects for the specified round
        """
        return [e for e in self._round_events if e.round_num == round_num]

    def get_context(self, agent_name: str) -> str:
        """Get the current context summary for an agent.

        Args:
            agent_name: Agent to get context for

        Returns:
            Context summary string, or empty string if none
        """
        return self._summaries.get(agent_name, "")

    async def update_summaries(
        self,
        llm_client: LLMClient,
        agents: List[ExperimentAgent],
        round_num: int
    ) -> None:
        """Update all agent summaries after a round.

        Each agent gets an LLM-generated summary of what happened.
        The summary is cumulative - it includes previous context plus new events.

        Args:
            llm_client: LLM client for generating summaries
            agents: List of agents in the experiment
            round_num: Current round number
        """
        # Get events for this round
        round_events = self.get_round_events(round_num)

        if not round_events:
            logger.debug(f"No events to summarize for round {round_num}")
            return

        # Build events text
        events_text = "\n".join(f"- {e.summary}" for e in round_events)

        for agent in agents:
            current_summary = self.get_context(agent.name)

            # Build summary prompt
            if current_summary:
                prompt = f"""Update this agent's running summary with new round events.

Current summary:
{current_summary}

New events from round {round_num}:
{events_text}

Return ONLY the updated summary (2-4 sentences). Keep it concise. No markdown."""
            else:
                prompt = f"""Create an initial summary for this agent after round {round_num}.

Events:
{events_text}

Return a concise summary (2-4 sentences). No markdown."""

            try:
                # No JSON mode for summaries - plain text is fine
                new_summary = await asyncio.to_thread(llm_client.chat, [{"role": "user", "content": prompt}])

                # Clean up the response
                new_summary = new_summary.strip().strip('"\'')

                self._summaries[agent.name] = new_summary
                logger.debug(f"Updated summary for {agent.name}: {new_summary[:50]}...")

            except Exception as e:
                logger.error(f"Failed to update summary for {agent.name}: {e}")
                # Keep old summary if update fails
