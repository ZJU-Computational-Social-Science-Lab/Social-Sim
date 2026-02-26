"""
Experiment Scene - standalone orchestrator for experiment execution.

This is NOT a Scene subclass. It manages ExperimentAgents directly,
runs rounds, and emits events without any legacy Agent/Simulator bridge.
"""

import logging
from typing import Any, Callable

from socialsim4.core.experiment.config import ExperimentConfig
from socialsim4.core.experiment.agent import ExperimentAgent
from socialsim4.core.experiment.runner import ExperimentRunner, RoundResult
from socialsim4.core.experiment.game_configs import GameConfig
from socialsim4.core.llm.client import LLMClient

logger = logging.getLogger(__name__)


class ExperimentScene:
    """Standalone experiment orchestrator - no Scene inheritance.

    KEY BEHAVIOR:
    - Each run_round() call runs exactly ONE round
    - Creates ExperimentAgents directly from config (no legacy Agent)
    - Emits experiment_action events for frontend consumption
    - No trigger mechanism - SimTree calls run_round() directly
    """

    TYPE = "experiment_template"

    def __init__(self, config: ExperimentConfig):
        """Initialize the experiment scene.

        Args:
            config: Experiment configuration with agents, actions, parameters
        """
        self.config = config
        self.agents: list[ExperimentAgent] = []
        self.runner: ExperimentRunner | None = None
        self.llm_client: LLMClient | None = None
        self.current_round = 0
        self._history: list[dict[str, Any]] = []

        logger.debug(f"ExperimentScene initialized: {config.scenario_id}")

    def initialize(self, llm_client: LLMClient) -> None:
        """Create ExperimentAgents directly from config.

        Args:
            llm_client: LLM client for prompting agents
        """
        if self.runner is not None:
            return  # Already initialized

        self.llm_client = llm_client

        # Create ExperimentAgents directly from config
        self.agents = [
            ExperimentAgent(
                name=a["name"],
                properties=a.get("properties", {}),
                llm_config=a.get("llm_config", {}),
                # Accept multiple field names for compatibility (camelCase from frontend, snake_case from backend)
                role_prompt=a.get("role_prompt") or a.get("rolePrompt") or a.get("profile")
            )
            for a in self.config.agents
        ]

        logger.debug(f"Created {len(self.agents)} ExperimentAgents")

        # Create the runner
        self.runner = ExperimentRunner(
            agents=self.agents,
            game_config=self._create_game_config(),
            llm_client=llm_client,
            round_visibility=self.config.round_visibility
        )

        logger.debug("ExperimentRunner initialized")

    async def run_round(self, event_emitter: Callable[[str, dict], None]) -> RoundResult:
        """Run exactly ONE round of the experiment.

        Args:
            event_emitter: Callback to emit events (type, data)

        Returns:
            RoundResult with all agent actions

        Raises:
            ValueError: If scene not initialized
        """
        if self.runner is None:
            raise ValueError("ExperimentScene not initialized - call initialize() first")

        self.current_round += 1
        round_num = self.current_round

        logger.info(f"Running round {round_num}")

        # Build context from history
        context_summary = self._build_context_summary()

        # Run the round
        result = await self.runner._run_single_round(
            round_num=round_num,
            context_summary=context_summary,
            round_history=self._history
        )

        # Update history for next round's context
        self._history.append({
            "round": round_num,
            "actions": [
                {
                    "agent": a.agent_name,
                    "action": a.action_name,
                    "parameters": a.parameters,
                    "summary": a.summary
                }
                for a in result.actions
            ]
        })

        # Emit events for frontend
        for action in result.actions:
            event_emitter("experiment_action", {
                "agent": action.agent_name,
                "action": action.action_name,
                "reasoning": action.parameters.get("reasoning", ""),
                "round": round_num,
                "success": action.success,
                "skipped": action.skipped,
            })

        logger.info(f"Round {round_num} complete: {len(result.actions)} actions")

        return result

    def _create_game_config(self) -> GameConfig:
        """Create GameConfig from config data."""
        # Extract action descriptions
        action_descriptions = {}
        for a in self.config.actions:
            name = a.get("name")
            desc = a.get("description")
            if name and desc:
                action_descriptions[name] = desc

        # Get action names
        action_names = list(action_descriptions.keys())
        if not action_names:
            action_names = [a.get("name", "unknown") for a in self.config.actions if a.get("name")]

        # Get payoff parameters
        params = self.config.parameters or {}

        return GameConfig(
            name=self.config.scenario_id,
            description=self.config.description,
            action_type="discrete",
            actions=action_names if action_names else ["cooperate", "defect"],
            action_descriptions=action_descriptions or None,
            payoff_summary=self._build_payoff_summary(),
            output_field="action",
            cooperate_reward=params.get("cooperate_reward"),
            sucker_penalty=params.get("sucker_penalty"),
            temptation_reward=params.get("temptation_reward"),
            defect_penalty=params.get("defect_penalty"),
        )

    def _build_payoff_summary(self) -> str:
        """Build payoff_summary from scenario parameters - GENERIC version.

        Handles all game types:
        - Prisoner's Dilemma: Uses formatted payoff table
        - Other games: Generic parameter display
        """
        params = self.config.parameters
        logger.debug(f"[PAYOFF] parameters: {params}")

        if not params:
            logger.debug("[PAYOFF] No parameters, returning empty")
            return ""

        # Check if this is a Prisoner's Dilemma style game (has all 4 PD params)
        pd_params = ["cooperate_reward", "sucker_penalty", "temptation_reward", "defect_penalty"]
        has_all_pd = all(params.get(p) is not None for p in pd_params)

        if has_all_pd:
            # Use the PD-specific format
            return f"""Payoff Table (from your perspective):
- If you COOPERATE and they cooperate: {params['cooperate_reward']} years saved
- If you COOPERATE and they defect: {params['sucker_penalty']} years saved (sucker's payoff)
- If you DEFECT and they cooperate: {params['temptation_reward']} years saved (temptation)
- If you DEFECT and they defect: {params['defect_penalty']} years saved"""

        # Generic parameter display for other game types
        lines = ["Game Parameters:"]
        for key, value in params.items():
            if value is not None:
                # Format key nicely (snake_case to Title Case)
                label = key.replace("_", " ").title()
                lines.append(f"- {label}: {value}")

        return "\n".join(lines)

    def _build_context_summary(self) -> str:
        """Build context summary from round history."""
        if not self._history:
            return "This is the first round - no previous context."

        lines = []
        for entry in self._history[-5:]:  # Last 5 rounds max
            round_num = entry["round"]
            actions = entry["actions"]
            action_strs = [f"{a['agent']}: {a['action']}" for a in actions]
            lines.append(f"Round {round_num}: {', '.join(action_strs)}")

        return "Previous rounds:\n" + "\n".join(lines)

    def is_complete(self) -> bool:
        """Check if experiment has natural end (most don't)."""
        return False  # Run forever via SimTree control

    def serialize_config(self) -> dict:
        """Serialize for SimTree persistence."""
        return {
            "config": {
                "agents": self.config.agents,
                "actions": self.config.actions,
                "parameters": self.config.parameters,
                "description": self.config.description,
                "scenario_id": self.config.scenario_id,
                "round_visibility": self.config.round_visibility,
            },
            "current_round": self.current_round,
            "history": self._history,
        }

    @classmethod
    def deserialize_config(cls, data: dict) -> "ExperimentScene":
        """Restore from serialized state."""
        config = ExperimentConfig(**data["config"])
        scene = cls(config)
        scene.current_round = data.get("current_round", 0)
        scene._history = data.get("history", [])
        return scene
