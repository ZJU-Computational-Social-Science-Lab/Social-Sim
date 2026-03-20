"""
Council experiment scene for multi-round deliberation and voting.

Extends ExperimentScene to provide round-based execution with automatic
multi-round context management for council deliberations. This migration
fixes BUG-CTX-01 where agents did not receive prior-round context.

Key features:
- Round tracking via experiment runner (not manual)
- Multi-round deliberation context via RoundContextManager
- Phase-based action filtering via SystemFacilitator

Exports: CouncilExperimentScene
"""
import logging
from enum import Enum
from typing import Any

from socialsim4.core.experiment.scene import ExperimentScene
from socialsim4.core.experiment.config import ExperimentConfig
from socialsim4.core.experiment.round_context import RoundContextManager
from socialsim4.core.experiment.information_model import InformationModel
from socialsim4.core.phase_controller import SystemFacilitator

logger = logging.getLogger(__name__)


class CouncilCyclePhase(Enum):
    """Phase within the deliberation-voting cycle.

    The cycle repeats: DELIBERATION → VOTING → POST_VOTE_DISCUSSION → DELIBERATION → ...

    This is separate from SystemFacilitator.CouncilPhase which handles
    the linear DISCUSSION → VOTING → CONCLUDED flow.
    """
    DELIBERATION = "deliberation"
    VOTING = "voting"
    POST_VOTE_DISCUSSION = "post_vote_discussion"


class CouncilExperimentScene(ExperimentScene):
    """Council experiment scene with phase-based deliberation and voting.

    Integrates with experiment runner for automatic round tracking and
    provides multi-round deliberation context to agents.

    Attributes:
        TYPE: Scene type identifier ("council")
        facilitator: SystemFacilitator for phase management (discussion/voting)
        round_context_manager: RoundContextManager for multi-round context
        round_num: Current round number (1-indexed)
    """
    TYPE = "council"

    def __init__(self, config: ExperimentConfig):
        """Initialize council experiment scene.

        Sets up phase controller for discussion/voting transitions and
        round context manager for multi-round deliberation tracking.

        Args:
            config: Experiment configuration with council parameters
        """
        super().__init__(config)

        # Phase controller for discussion/voting transitions (REFACTOR-COUNCIL-05)
        self.facilitator = SystemFacilitator(self)

        # Configure deliberation rounds from config parameters (FEAT-COUNCIL-03)
        # Parameters dict contains council-specific config like deliberation_rounds
        deliberation_rounds = config.parameters.get("deliberation_rounds")
        if deliberation_rounds is not None:
            self.facilitator.set_deliberation_rounds(deliberation_rounds)
            logger.info(f"Configured {deliberation_rounds} deliberation rounds before voting")

        # Initialize facilitator round tracking (FEAT-COUNCIL-03)
        # Note: self.round_num is set to 1 at end of __init__, facilitator defaults to 1
        self.facilitator.current_round_num = 1

        # Round context manager for multi-round deliberation (REFACTOR-COUNCIL-04)
        # Use scope_type="all" so all agents see all speeches and votes
        # recent_window=3 keeps last 3 rounds of context for token efficiency
        # primacy_keep=True preserves first impressions
        info_model = InformationModel(
            scope_type="all",
            recent_window=3,
            primacy_keep=True,
            include_scores=False,  # Council games don't use scores
        )
        self.round_context_manager = RoundContextManager(
            information_model=info_model,
            scene_state=self.state.extensions,
            all_agent_names=[a.get("name") for a in config.agents],
        )

        # Round tracking (experiment runner increments this)
        self.round_num = 1

        # Cycle phase state for structured deliberation/voting flow
        # NOTE: Votes are stored in self.state.extensions["votes"] (populated by handlers)
        # to integrate with existing vote action handlers in handlers.py
        self.cycle_phase: CouncilCyclePhase = CouncilCyclePhase.DELIBERATION
        self.rounds_in_cycle_phase: int = 0

        logger.info(f"CouncilExperimentScene initialized with {len(self.agents)} agents")

    def get_prior_round_context(self, agent_name: str) -> str:
        """Get multi-round deliberation context for an agent.

        Returns prior round summaries showing what other agents said and did.
        This enables agents to reference previous discussion points, fixing
        BUG-CTX-01 where agents had no prior-round context.

        Args:
            agent_name: Name of agent requesting context

        Returns:
            Context string with prior round history, or "This is the first round - no prior context."
            if no prior actions recorded.
        """
        context = self.round_context_manager.get_context_for_agent(agent_name)

        if not context or context.strip() == "":
            return "This is the first round - no prior context."

        return context

    def get_agent_status_prompt(self, agent_name: str) -> str:
        """Get status prompt for agent including prior round context.

        Combines facilitator status (current phase: discussion/voting) with
        multi-round deliberation history to provide full context for agent
        decision-making.

        Args:
            agent_name: Name of agent

        Returns:
            Status prompt with phase info and prior round context, formatted as:
            "Current Phase: discussion/voting
             ---
             Prior Round Deliberation Context:
             [previous speeches and actions]"
        """
        # Get current phase status (discussion/voting/concluded)
        phase_status = self.facilitator.get_status_prompt()

        # Get multi-round deliberation context
        prior_context = self.get_prior_round_context(agent_name)

        # Combine for full context
        return f"{phase_status}\n\n--- Prior Round Deliberation Context ---\n{prior_context}"

    def is_complete(self) -> bool:
        """Check if council experiment is complete.

        Returns:
            True if meeting has been concluded via conclude action, False otherwise
        """
        return self.state.extensions.get("concluded", False)

    def _record_action_to_context(
        self,
        agent_name: str,
        action_name: str,
        parameters: dict[str, Any],
        summary: str
    ) -> None:
        """Record an action to the multi-round context manager.

        Called by action handlers (speak, vote) to make actions visible
        to all agents in subsequent rounds.

        Args:
            agent_name: Agent who performed the action
            action_name: Name of the action (speak, vote, etc.)
            parameters: Action parameters (message, choice, etc.)
            summary: Human-readable summary of the action
        """
        self.round_context_manager.record_action(
            agent_name=agent_name,
            action_name=action_name,
            parameters=parameters,
            round_num=self.round_num,
            summary=summary,
            observed_by=[a.name for a in self.agents],
        )

    def get_scene_actions(self, agent_name: str) -> list[str]:
        """Get available actions for agent based on current cycle phase.

        Filters actions to ensure agents only see actions appropriate
        for the current phase:
        - DELIBERATION/POST_VOTE_DISCUSSION: speak, skip
        - VOTING: vote_yes, vote_no, abstain

        Checks BOTH the new cycle_phase AND the legacy facilitator.phase
        for backwards compatibility during migration.

        Args:
            agent_name: Name of agent requesting actions (unused, all agents see same actions)

        Returns:
            List of action names allowed in current phase
        """
        _ = agent_name  # All agents see same actions based on phase

        # Check NEW cycle_phase system
        if self.cycle_phase == CouncilCyclePhase.VOTING:
            return ["vote_yes", "vote_no", "abstain"]

        # Fall back to LEGACY facilitator system for backwards compatibility
        from socialsim4.core.phase_controller import CouncilPhase
        if self.facilitator.phase == CouncilPhase.VOTING:
            return ["vote_yes", "vote_no", "abstain"]

        # Default to deliberation actions
        return ["speak", "skip"]

    def record_vote(self, agent_name: str, vote: str) -> None:
        """Record an agent's vote (only first vote counts).

        Writes to state.extensions["votes"] to integrate with existing handlers.

        Args:
            agent_name: Name of the agent voting
            vote: Vote value - "yes", "no", or "abstain"
        """
        votes = self.state.extensions.get("votes", {})
        if agent_name not in votes:
            votes[agent_name] = vote
            self.state.extensions["votes"] = votes

    def check_voting_threshold(self) -> bool:
        """Check if yes votes meet the threshold percentage.

        Reads from state.extensions["votes"] (populated by handlers and record_vote).

        Returns:
            True if (yes_votes / total_votes) >= threshold
        """
        votes = self.state.extensions.get("votes", {})
        if not votes:
            return False

        total_votes = len(votes)
        yes_votes = sum(1 for v in votes.values() if v == "yes")
        threshold = self.config.parameters.get("voting_threshold", 0.5)

        return (yes_votes / total_votes) >= threshold

    def all_agents_voted(self) -> bool:
        """Check if all agents have cast their votes.

        Reads from state.extensions["votes"] (populated by handlers and record_vote).

        Returns:
            True if every agent has a vote recorded
        """
        votes = self.state.extensions.get("votes", {})
        agent_names = {a.get("name") for a in self.config.agents}
        return agent_names.issubset(votes.keys())

    def check_cycle_phase_transition(self) -> None:
        """Check and execute cycle phase transition after round completes.

        Transition rules:
        - DELIBERATION → VOTING: After deliberation_rounds complete
        - VOTING → POST_VOTE_DISCUSSION: All agents voted AND threshold met
        - VOTING → DELIBERATION: All agents voted AND threshold NOT met
        - POST_VOTE_DISCUSSION → DELIBERATION: After deliberation_rounds complete
        """
        deliberation_rounds = self.config.parameters.get("deliberation_rounds", 3)

        if self.cycle_phase == CouncilCyclePhase.DELIBERATION:
            if self.rounds_in_cycle_phase >= deliberation_rounds:
                self.cycle_phase = CouncilCyclePhase.VOTING
                self.rounds_in_cycle_phase = 0
                # Clear votes for new voting round
                self.state.extensions["votes"] = {}
                logger.info(f"Transitioning to VOTING phase after {deliberation_rounds} deliberation rounds")

        elif self.cycle_phase == CouncilCyclePhase.VOTING:
            if self.all_agents_voted():
                if self.check_voting_threshold():
                    self.cycle_phase = CouncilCyclePhase.POST_VOTE_DISCUSSION
                    logger.info("Threshold met, transitioning to POST_VOTE_DISCUSSION")
                else:
                    self.cycle_phase = CouncilCyclePhase.DELIBERATION
                    logger.info("Threshold not met, transitioning back to DELIBERATION")
                self.rounds_in_cycle_phase = 0
                # Clear votes for next cycle
                self.state.extensions["votes"] = {}

        elif self.cycle_phase == CouncilCyclePhase.POST_VOTE_DISCUSSION:
            if self.rounds_in_cycle_phase >= deliberation_rounds:
                self.cycle_phase = CouncilCyclePhase.DELIBERATION
                self.rounds_in_cycle_phase = 0
                logger.info(f"Transitioning back to DELIBERATION after {deliberation_rounds} post-vote rounds")

    def get_speak_instruction(self) -> str | None:
        """Get brevity instruction for speak action during deliberation phases.

        Returns:
            Brevity instruction string if in DELIBERATION or POST_VOTE_DISCUSSION,
            None otherwise.
        """
        if self.cycle_phase in (CouncilCyclePhase.DELIBERATION, CouncilCyclePhase.POST_VOTE_DISCUSSION):
            return "You must respond with only 1-2 sentences."
        return None

    def _advance_round(self) -> None:
        """Advance to next round after all agents have acted.

        Increments round counter, phase counter, and checks for phase transitions.
        Called by experiment runner after each round completes.
        """
        self.round_num += 1
        self.rounds_in_cycle_phase += 1
        # Sync round number with facilitator for deliberation enforcement (FEAT-COUNCIL-02)
        self.facilitator.current_round_num = self.round_num
        logger.debug(f"Advanced to round {self.round_num}, phase round {self.rounds_in_cycle_phase}")

        # Check for cycle phase transition
        self.check_cycle_phase_transition()

    def serialize_config(self) -> dict:
        """Serialize scene state including cycle phase.

        Extends parent serialize_config to include cycle phase state.

        Returns:
            Dict with serialized scene state including cycle phase
        """
        base_config = super().serialize_config()

        # Add cycle phase state to extensions
        if "extensions" not in base_config:
            base_config["extensions"] = {}

        base_config["extensions"]["cycle_phase"] = {
            "phase": self.cycle_phase.value,
            "rounds_in_phase": self.rounds_in_cycle_phase,
        }

        return base_config

    @classmethod
    def deserialize_config(cls, data: dict) -> "CouncilExperimentScene":
        """Deserialize scene state including cycle phase.

        Extends parent deserialize_config to restore cycle phase state.

        Args:
            data: Serialized scene state

        Returns:
            New CouncilExperimentScene instance with restored state
        """
        # Call parent to get base scene (properly initialized)
        scene = super().deserialize_config(data)

        # Restore cycle phase state from extensions
        cycle_data = data.get("extensions", {}).get("cycle_phase", {})
        if cycle_data:
            scene.cycle_phase = CouncilCyclePhase(cycle_data.get("phase", "deliberation"))
            scene.rounds_in_cycle_phase = cycle_data.get("rounds_in_phase", 0)

        return scene
