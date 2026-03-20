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
from typing import Any

from socialsim4.core.experiment.scene import ExperimentScene
from socialsim4.core.experiment.config import ExperimentConfig
from socialsim4.core.experiment.round_context import RoundContextManager
from socialsim4.core.experiment.information_model import InformationModel
from socialsim4.core.phase_controller import SystemFacilitator

logger = logging.getLogger(__name__)


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

        # Configure deliberation rounds from config (FEAT-COUNCIL-02)
        if hasattr(config, 'deliberation_rounds') and config.deliberation_rounds is not None:
            self.facilitator.set_deliberation_rounds(config.deliberation_rounds)
            logger.info(f"Configured {config.deliberation_rounds} deliberation rounds before voting")

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
        """Get available actions for agent based on current phase.

        Filters actions using SystemFacilitator to ensure agents only see
        actions appropriate for the current phase:
        - Discussion phase: speak, skip, start_voting
        - Voting phase: vote, conclude

        Args:
            agent_name: Name of agent requesting actions (unused, all agents see same actions)

        Returns:
            List of action names allowed in current phase
        """
        _ = agent_name  # All agents see same actions based on phase
        # Get all available actions from config
        all_actions = [a.get("name") for a in self.config.actions]

        # Filter by phase using facilitator
        filtered_actions = []
        for action_name in all_actions:
            allowed, _ = self.facilitator.is_action_allowed(action_name)
            if allowed:
                filtered_actions.append(action_name)

        return filtered_actions

    def _advance_round(self) -> None:
        """Advance to next round after all agents have acted.

        Increments round counter for multi-round deliberation tracking.
        Called by experiment runner after each round completes.
        """
        self.round_num += 1
        # Sync round number with facilitator for deliberation enforcement (FEAT-COUNCIL-02)
        self.facilitator.current_round_num = self.round_num
        logger.debug(f"Advanced to round {self.round_num}")
