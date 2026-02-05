"""
Council scene with system facilitation.

Based on Agent Kernel's controller pattern: the scene manages conversation flow
through explicit phases without requiring a dedicated "host" agent.
"""

from socialsim4.core.actions.council_actions import VotingStatusAction
from socialsim4.core.agent import Agent
from socialsim4.core.event import PublicEvent
from socialsim4.core.phase_controller import SystemFacilitator, CouncilPhase
from socialsim4.core.scenes.simple_chat_scene import SimpleChatScene


class CouncilScene(SimpleChatScene):
    """Council scene with phase-based facilitation."""

    TYPE = "council_scene"

    def __init__(self, name, initial_event):
        super().__init__(name, initial_event)
        self.state["votes"] = {}
        self.state["voting_started"] = False
        self.state["voting_completed_announced"] = False
        self.complete = False

        # Initialize the system facilitator
        self.facilitator = SystemFacilitator(self)

    def set_simulator(self, simulator):
        """Set simulator reference for the facilitator."""
        self.simulator = simulator
        if self.facilitator:
            self.facilitator.set_simulator(simulator)

    def get_scene_actions(self, agent: Agent):
        actions = super().get_scene_actions(agent)
        actions.append(VotingStatusAction())
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
        """Get facilitator status prompt for the agent."""
        if hasattr(self, 'facilitator') and self.facilitator:
            return "\n\n" + self.facilitator.get_status_prompt()
        return ""

    def is_complete(self):
        return self.complete

    def initialize_agent(self, agent: Agent):
        """
        Initialize an agent for the council scene.

        No role assignment needed - all agents are equal participants.
        The facilitator manages flow based on phases, not roles.
        """
        super().initialize_agent(agent)

    def post_turn(self, agent: Agent, simulator):
        """
        Hook after each agent turn.

        Records the turn with the facilitator for flow analysis.
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
