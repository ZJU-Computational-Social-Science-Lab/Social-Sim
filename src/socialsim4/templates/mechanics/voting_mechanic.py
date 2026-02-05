"""Voting mechanic for democratic decision-making.

Provides proposal-based voting with configurable thresholds and timeouts.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from socialsim4.core.action import Action
from socialsim4.core.actions.council_actions import VotingStatusAction
from socialsim4.templates.mechanics.base import CoreMechanic
from socialsim4.templates.mechanics import register_mechanic

if TYPE_CHECKING:
    from socialsim4.core.agent import Agent
    from socialsim4.core.scene import Scene


class VotingMechanicVoteAction(Action):
    """Vote action for VotingMechanic proposal system."""

    NAME = "vote"
    DESC = "Cast a vote on an active proposal."
    INSTRUCTION = """- vote: Cast a vote on a proposal
  <Action name="vote"><proposal>Proposal Title</proposal><vote>yes|no|abstain</vote></Action>
"""

    def handle(self, action_data, agent, simulator, scene):
        # Find the voting mechanic in the scene
        voting_mechanic = None
        if hasattr(scene, "mechanics"):
            for mechanic in scene.mechanics:
                if hasattr(mechanic, "TYPE") and mechanic.TYPE == "voting":
                    voting_mechanic = mechanic
                    break

        if voting_mechanic is None:
            return False, {"error": "No voting mechanic found"}, f"{agent.name} vote failed", {}, False

        # Get proposal and vote from action_data
        proposal_title = action_data.get("proposal")
        vote_choice = action_data.get("vote")

        if not proposal_title or not vote_choice:
            return False, {"error": "Missing proposal or vote"}, f"{agent.name} vote failed", {}, False

        # Find the proposal
        proposal = None
        for p in voting_mechanic.proposals:
            if p.title == proposal_title:
                proposal = p
                break

        if proposal is None:
            return False, {"error": f"Proposal '{proposal_title}' not found"}, f"{agent.name} vote failed", {}, False

        # Cast the vote
        success, msg = voting_mechanic.cast_vote(proposal, agent.name, vote_choice)

        if success:
            result = {"proposal": proposal_title, "vote": vote_choice}
            summary = f"{agent.name} voted {vote_choice} on '{proposal_title}'"
            return True, result, summary, {}, False
        else:
            return False, {"error": msg}, f"{agent.name} vote failed: {msg}", {}, False


@dataclass
class Proposal:
    """A voting proposal."""

    title: str
    proposer: str
    yes_votes: int = 0
    no_votes: int = 0
    abstain_votes: int = 0
    votes_by_agent: dict = field(default_factory=dict)
    turn_created: int = 0
    active: bool = True


@register_mechanic
class VotingMechanic(CoreMechanic):
    """Voting mechanic for democratic decision-making.

    Agents can cast votes on proposals, and proposals pass when reaching
    the required threshold.

    Config:
        threshold: Fraction of yes votes needed to pass (default: 0.5)
        timeout_turns: Turns before a proposal expires (default: 10)
        allow_abstain: Whether abstaining is allowed (default: True)
    """

    TYPE = "voting"

    def __init__(
        self,
        threshold: float = 0.5,
        timeout_turns: int = 10,
        allow_abstain: bool = True,
    ):
        self.threshold = threshold
        self.timeout_turns = timeout_turns
        self.allow_abstain = allow_abstain
        self.proposals: list[Proposal] = []
        self._actions = [
            VotingMechanicVoteAction(),
            VotingStatusAction(),
        ]

    @classmethod
    def from_config(cls, config: dict) -> "VotingMechanic":
        """Create VotingMechanic from config dict."""
        return cls(
            threshold=config.get("threshold", 0.5),
            timeout_turns=config.get("timeout_turns", 10),
            allow_abstain=config.get("allow_abstain", True),
        )

    def initialize_agent(self, agent: Agent, scene: Scene) -> None:
        """Initialize agent with voting properties."""
        agent.properties.setdefault("votes_cast", 0)

    def get_actions(self) -> list:
        """Return voting action classes."""
        return self._actions

    def get_scene_state(self) -> dict:
        """Return voting mechanic's contribution to scene state."""
        return {
            "voting_threshold": self.threshold,
            "voting_timeout": self.timeout_turns,
            "proposals": self.proposals,
            "allow_abstain": self.allow_abstain,
        }

    def add_proposal(self, title: str, proposer: str, turn: int = 0) -> Proposal:
        """Add a new proposal."""
        proposal = Proposal(title=title, proposer=proposer, turn_created=turn)
        self.proposals.append(proposal)
        return proposal

    def cast_vote(
        self, proposal: Proposal, agent: str, vote: str
    ) -> tuple[bool, str]:
        """Cast a vote on a proposal.

        Returns:
            (success, message)
        """
        if not proposal.active:
            return False, "This proposal is no longer active."

        if agent in proposal.votes_by_agent:
            return False, "You have already voted on this proposal."

        if vote not in ("yes", "no", "abstain"):
            return False, "Invalid vote. Must be 'yes', 'no', or 'abstain'."

        if vote == "abstain" and not self.allow_abstain:
            return False, "Abstaining is not allowed."

        # Record new vote
        proposal.votes_by_agent[agent] = vote
        if vote == "yes":
            proposal.yes_votes += 1
        elif vote == "no":
            proposal.no_votes += 1
        else:
            proposal.abstain_votes += 1

        return True, f"Vote '{vote}' recorded."

    def check_proposal_passed(self, proposal: Proposal) -> bool:
        """Check if a proposal has passed.

        Uses strict inequality (>), meaning a proposal with threshold 0.5
        needs MORE than 50% yes votes to pass (not exactly 50%).
        """
        total_votes = proposal.yes_votes + proposal.no_votes
        if total_votes == 0:
            return False
        return proposal.yes_votes / total_votes > self.threshold

    def get_active_proposals(self) -> list[Proposal]:
        """Get all active proposals."""
        return [p for p in self.proposals if p.active]
