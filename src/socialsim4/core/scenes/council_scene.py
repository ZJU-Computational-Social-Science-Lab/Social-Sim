from socialsim4.core.actions.council_actions import VotingStatusAction
from socialsim4.core.agent import Agent
from socialsim4.core.event import PublicEvent
from socialsim4.core.scenes.simple_chat_scene import SimpleChatScene


class CouncilScene(SimpleChatScene):
    TYPE = "council_scene"

    def __init__(self, name, initial_event):
        super().__init__(name, initial_event)
        self.state["votes"] = {}
        self.state["voting_started"] = False
        self.state["voting_completed_announced"] = False
        self.complete = False

    def get_scene_actions(self, agent: Agent):
        actions = super().get_scene_actions(agent)
        actions.append(VotingStatusAction())
        return actions

    def get_behavior_guidelines(self):
        base = super().get_behavior_guidelines()
        return (
            base
            + """
- While you have your own views, you may occasionally shift your opinion slightly if presented with compelling arguments, though it's not necessary. Once voting starts, cast your vote.
- Participate actively in discussions, vote when appropriate, and follow the host's lead.
- Participants should only start voting after the host explicitly initiates the voting round.
"""
        )

    def is_complete(self):
        return self.complete

    # No round-based completion; result announcement happens in VoteAction
