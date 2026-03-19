"""
Council scene with system facilitation and round context tracking.

Based on Agent Kernel's controller pattern: the scene manages conversation flow
through explicit phases without requiring a dedicated "host" agent.

Provides phase-based action filtering to ensure agents only see actions
appropriate for the current phase (discussion, voting, or concluded).

Provides multi-round deliberation support by tracking context across rounds
using RoundContextManager, enabling agents to see prior-round speeches,
voting results, and system announcements.

Contains: CouncilScene class.
"""

import logging

from socialsim4.core.actions.council_actions import VotingStatusAction
from socialsim4.core.agent import Agent
from socialsim4.core.event import PublicEvent
from socialsim4.core.experiment.round_context import RoundContextManager
from socialsim4.core.experiment.information_model import InformationModel
from socialsim4.core.phase_controller import SystemFacilitator, CouncilPhase
from socialsim4.core.scenes.simple_chat_scene import SimpleChatScene


class CouncilScene(SimpleChatScene):
    """Council scene with phase-based facilitation and round context tracking.

    Provides multi-round deliberation support by maintaining a RoundContextManager
    that tracks speeches, votes, and system events across rounds. Agents receive
    prior-round context when generating follow-up responses.

    Attributes:
        facilitator: SystemFacilitator for managing council flow
        round_context_manager: RoundContextManager for tracking context across rounds
        round_num: Current round number (starts at 1)
    """

    TYPE = "council_scene"

    def __init__(self, name, initial_event):
        super().__init__(name, initial_event)
        self.state["votes"] = {}
        self.state["voting_started"] = False
        self.state["voting_completed_announced"] = False
        self.complete = False

        # Initialize the system facilitator
        self.facilitator = SystemFacilitator(self)

        # Initialize round context manager with InformationModel for full visibility
        # Using scope_type="all" so all agents see all speeches and votes
        # recent_window=3 shows last 3 rounds in detail, primacy_keep=True keeps round 1
        info_model = InformationModel(
            scope_type="all",
            recent_window=3,
            primacy_keep=True
        )
        self.round_context_manager = RoundContextManager(
            information_model=info_model,
            scene_state=self.state,
            all_agent_names=[]  # Populated in set_simulator()
        )

        # Track current round number
        self.round_num = 1

    def set_simulator(self, simulator):
        """Set simulator reference for the facilitator and context manager."""
        self.simulator = simulator
        if self.facilitator:
            self.facilitator.set_simulator(simulator)

        # Populate agent names in round context manager
        if hasattr(self, 'round_context_manager') and simulator:
            agent_names = list(simulator.agents.keys())
            self.round_context_manager.all_agent_names = agent_names

    def get_prior_round_context(self, agent: Agent) -> str:
        """Get prior-round context for an agent.

        Retrieves formatted context from the RoundContextManager containing
        speeches, votes, and system events from previous rounds.

        Args:
            agent: The agent to get context for

        Returns:
            Formatted context string, or "This is the first round." if no history
        """
        if not hasattr(self, 'round_context_manager') or not self.round_context_manager:
            return "This is the first round."

        # Get context from the round context manager
        context = self.round_context_manager.get_context_for_agent(agent.name)

        if not context or not context.strip():
            return "This is the first round."

        return context

    def get_scene_actions(self, agent: Agent):
        """Get available actions for agent, filtered by current phase.

        During voting phase, only Vote actions are visible.
        During discussion phase, most actions are visible except vote.

        Args:
            agent: The agent requesting available actions

        Returns:
            List of Action instances allowed in the current phase
        """
        logger = logging.getLogger(__name__)

        # Get all actions from parent (includes speak, etc.)
        actions = super().get_scene_actions(agent)

        # Add voting status action (allowed in all phases)
        actions.append(VotingStatusAction())

        # Filter actions based on current phase using facilitator
        if hasattr(self, 'facilitator') and self.facilitator:
            filtered_actions = []
            for action in actions:
                # Get action name from NAME attribute (uppercase convention)
                action_name = getattr(action, 'NAME', action.__class__.__name__.lower().replace('action', ''))

                # Check if action is allowed in current phase
                allowed, _ = self.facilitator.is_action_allowed(action_name)

                if allowed:
                    filtered_actions.append(action)
                else:
                    logger.debug(
                        f"Filtered action '{action_name}' for {agent.name} "
                        f"in {self.facilitator.phase.value} phase"
                    )

            return filtered_actions

        # No facilitator: return unfiltered (shouldn't happen in normal operation)
        return actions

    def get_behavior_guidelines(self):
        base = super().get_behavior_guidelines()
        return (
            base
            + """
- While you have your own views, you may occasionally shift your opinion slightly if presented with compelling arguments.
- Participate actively in discussions, vote when appropriate.
- Any participant can initiate voting when discussion has reached a natural conclusion.
- Participants should only vote after voting has been initiated.
- The meeting can be concluded by any participant when voting is not in progress.
"""
        )

    def get_agent_status_prompt(self, agent: Agent) -> str:
        """Get facilitator status prompt with prior-round context for the agent."""
        parts = []

        # Add facilitator status
        if hasattr(self, 'facilitator') and self.facilitator:
            parts.append(self.facilitator.get_status_prompt())

        # Add prior-round context
        if hasattr(self, 'round_context_manager') and self.round_context_manager:
            prior_context = self.get_prior_round_context(agent)
            if prior_context and prior_context != "This is the first round.":
                parts.append("\n--- Prior Round History ---")
                parts.append(prior_context)

        return "\n\n".join(parts) if parts else ""

    def is_complete(self):
        return self.complete

    def initialize_agent(self, agent: Agent):
        """
        Initialize an agent for the council scene.

        No role assignment needed - all agents are equal participants.
        The facilitator manages flow based on phases, not roles.
        """
        super().initialize_agent(agent)

    def _record_action_to_context(
        self,
        agent_name: str,
        action_name: str,
        parameters: dict,
        summary: str
    ):
        """Record action to round context manager.

        Args:
            agent_name: Name of the agent who acted
            action_name: Type of action taken
            parameters: Action parameters
            summary: Human-readable summary of the action
        """
        if hasattr(self, 'round_context_manager') and self.round_context_manager:
            # Use current round number
            observed_by = (
                list(self.simulator.agents.keys())
                if self.simulator
                else [agent_name]
            )
            self.round_context_manager.record_action(
                agent_name=agent_name,
                action_name=action_name,
                parameters=parameters,
                round_num=self.round_num,
                summary=summary,
                observed_by=observed_by
            )

    def post_turn(self, agent: Agent, simulator):
        """
        Hook after each agent turn.

        Records the turn with the facilitator for flow analysis and
        records actions to the round context manager.
        """
        # Call parent to advance time
        super().post_turn(agent, simulator)

        # Record turn with facilitator
        if hasattr(self, 'facilitator') and self.facilitator:
            # Record the turn (we don't have direct access to the action here,
            # but the facilitator can track via other means)
            self.facilitator.turn_count += 1

            # Check if facilitator should suggest something
            suggestion = self.facilitator.get_facilitation_message()
            if suggestion:
                simulator.broadcast(PublicEvent(suggestion))
