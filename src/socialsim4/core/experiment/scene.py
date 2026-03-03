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
from socialsim4.core.experiment.state import ExperimentState, AgentState
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
        self.state: ExperimentState = ExperimentState()

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
                # Accept camelCase llmConfig from frontend as well as snake_case llm_config
                llm_config=a.get("llm_config") or a.get("llmConfig") or {},
                # Accept multiple field names for compatibility (camelCase from frontend, snake_case from backend)
                role_prompt=a.get("role_prompt") or a.get("rolePrompt") or a.get("profile")
            )
            for a in self.config.agents
        ]

        logger.debug(f"Created {len(self.agents)} ExperimentAgents")

        # Initialize experiment state
        self._initialize_state()

        # Get InformationModel from registry (deferred import to avoid circular dependency)
        from socialsim4.core.registry import get_information_model, pair_agents_randomly
        from socialsim4.core.experiment.information_model import InformationModel

        information_model = get_information_model(self.config.scenario_id)

        # If the registry returned a generic "all" scope but this is a pairwise game
        # (more than 2 agents with PD-style payoffs), upgrade to pair scope so each
        # agent only sees their own game's results, not other pairs' actions.
        params = self.config.parameters or {}
        pd_keys = ["cooperate_reward", "sucker_penalty", "temptation_reward", "defect_penalty"]
        has_pd_payoffs = all(params.get(k) is not None for k in pd_keys)
        if information_model.scope_type == "all" and len(self.agents) > 2 and has_pd_payoffs:
            information_model = InformationModel(
                scope_type="pair",
                pairing_fn=pair_agents_randomly,
                recent_window=information_model.recent_window,
                payoff_template="Round {N}: I {my_action}, partner {partner_action} → {payoff} pts",
            )

        # Create the runner
        self.runner = ExperimentRunner(
            agents=self.agents,
            game_config=self._create_game_config(),
            llm_client=llm_client,
            round_visibility=self.config.round_visibility,
            information_model=information_model,
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
        history_entry: dict = {
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
        }
        if result.payoffs:
            history_entry["payoffs"] = result.payoffs
        self._history.append(history_entry)

        # Emit events for frontend
        for action in result.actions:
            event_emitter("experiment_action", {
                "agent": action.agent_name,
                "action": action.action_name,
                "round": round_num,
                "success": action.success,
                "skipped": action.skipped,
            })

        logger.info(f"Round {round_num} complete: {len(result.actions)} actions")

        return result

    def _initialize_state(self) -> None:
        """Initialize ExperimentState from config.

        Creates AgentState for each agent and applies state_schema extensions.
        Called during initialize() after agents are created.
        """
        # Create AgentState for each agent
        for agent_config in self.config.agents:
            name = agent_config.get("name", "")
            if not name:
                continue

            agent_state = AgentState(
                score=0,
                position=agent_config.get("position"),
                resources=agent_config.get("resources", {}),
                properties=agent_config.get("properties", {}),
            )
            self.state.agents[name] = agent_state

        # Apply state_schema extensions
        if self.config.state_schema:
            if "extensions" in self.config.state_schema:
                self.state.extensions.update(self.config.state_schema["extensions"])

        logger.debug(f"Initialized state for {len(self.state.agents)} agents")

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

        # Build supplementary prompt text: payoff table + sociology params
        supplementary_parts = []
        payoff_text = self._build_payoff_summary()
        if payoff_text:
            supplementary_parts.append(payoff_text)
        params_text = self._build_params_section()
        if params_text:
            supplementary_parts.append(params_text)

        return GameConfig(
            name=self.config.scenario_id,
            description=self.config.description,
            action_type="discrete",
            actions=action_names if action_names else ["cooperate", "defect"],
            action_descriptions=action_descriptions or None,
            payoff_summary="\n\n".join(supplementary_parts),
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
            # Use the PD-specific format with generic "points" terminology
            # No meta-commentary - just the raw payoffs
            return f"""Payoff Table:
- You cooperate, they cooperate: {params['cooperate_reward']} points
- You cooperate, they defect: {params['sucker_penalty']} points
- You defect, they cooperate: {params['temptation_reward']} points
- You defect, they defect: {params['defect_penalty']} points"""

        # Generic parameter display for other game types
        lines = ["Game Parameters:"]
        for key, value in params.items():
            if value is not None:
                # Format key nicely (snake_case to Title Case)
                label = key.replace("_", " ").title()
                lines.append(f"- {label}: {value}")

        return "\n".join(lines)

    def _build_params_section(self) -> str:
        """Translate non-payoff scenario parameters into natural language for the prompt.

        Provides curated, human-readable descriptions for sociology scenario
        parameters so agents understand their environment without needing to
        interpret raw parameter values.
        """
        params = self.config.parameters
        scenario_id = self.config.scenario_id
        if not params:
            return ""

        lines = []

        if scenario_id == "social_norm_disruption":
            norm_description = params.get("norm_description", "")
            norm_strength = params.get("norm_strength")
            if norm_description:
                lines.append(f"The norm or rule in effect: \"{norm_description}\"")
            if norm_strength is not None:
                strength_val = float(norm_strength)
                if strength_val <= 0.33:
                    label = "weakly"
                elif strength_val <= 0.66:
                    label = "moderately"
                else:
                    label = "strongly"
                lines.append(f"This norm is {label} enforced in the group.")

        elif scenario_id == "policy_erosion":
            policy_text = params.get("policy_text", "")
            tier_labels = params.get("tier_labels", "")
            if policy_text:
                lines.append(f"The policy being transmitted is: \"{policy_text}\"")
            if tier_labels:
                lines.append(f"The hierarchy levels (top to bottom): {tier_labels}.")

        elif scenario_id == "echo_chamber":
            topic = params.get("topic", "")
            opinion_distribution = params.get("opinion_distribution", "")
            if topic:
                lines.append(f"The discussion topic is: \"{topic}\"")
            if opinion_distribution:
                dist_map = {
                    "balanced": "The group's opinions are currently balanced.",
                    "polarized": "The group's opinions are currently polarized into opposing camps.",
                    "random": "The group's opinions are currently distributed randomly.",
                }
                lines.append(dist_map.get(opinion_distribution, f"Opinion distribution: {opinion_distribution}."))

        elif scenario_id == "resource_scarcity":
            resource_amount = params.get("resource_amount")
            initial_distribution = params.get("initial_distribution", "")
            if resource_amount is not None:
                lines.append(f"There are {resource_amount} units of shared resource available to the group.")
            if initial_distribution:
                dist_map = {
                    "equal": "Resources are currently distributed equally among all members.",
                    "random": "Resources are currently distributed randomly among members.",
                    "skewed": "Resources are currently distributed unevenly, with some members holding much more than others.",
                }
                lines.append(dist_map.get(initial_distribution, f"Initial distribution: {initial_distribution}."))

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
            line = f"Round {round_num}: {', '.join(action_strs)}"
            # Include per-round payoffs if present (game theory scenarios)
            if entry.get("payoffs"):
                payoff_strs = [f"{name} +{pts}" for name, pts in entry["payoffs"].items()]
                line += f". Payoffs: {', '.join(payoff_strs)}"
                # Show cumulative scores for this agent
                agent_scores = {a.name: a.score for a in self.agents}
                score_strs = [f"{name}: {pts}" for name, pts in agent_scores.items()]
                line += f". Running total: {', '.join(score_strs)}"
            lines.append(line)

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
