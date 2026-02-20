"""
Experiment Scene - bridges new experiment platform with legacy simulator.

This scene wraps the Three-Layer Architecture experiment platform and makes
it compatible with the existing SimTree runtime system. Each "advance node"
runs ONE round of the experiment, not all rounds at once.
"""

import asyncio
import logging
import sys
from typing import Any, List, Optional

from socialsim4.core.action import Action
from socialsim4.core.agent import Agent
from socialsim4.core.scene import Scene
from socialsim4.core.simulator import Simulator
from socialsim4.core.experiment.agent import ExperimentAgent
from socialsim4.core.experiment.runner import ExperimentRunner, RoundResult
from socialsim4.core.experiment.game_configs import GameConfig
from socialsim4.core.experiment.kernel import ExperimentKernel
from socialsim4.core.llm.client import LLMClient
from socialsim4.core.context_builder import build_context_summary

# Configure debug logging to stdout
logger = logging.getLogger(__name__)
_handler = logging.StreamHandler(sys.stdout)
_handler.setLevel(logging.DEBUG)
_handler.setFormatter(logging.Formatter('[EXPERIMENT SCENE] %(message)s'))
logger.addHandler(_handler)
logger.setLevel(logging.DEBUG)


class RunExperimentAction(Action):
    """Action that triggers ONE round of the experiment.

    Each time this action is called (user clicks "advance node"),
    exactly ONE round of the experiment is executed.
    """

    NAME = "run_experiment"
    DESC = "Run one round of the experiment with all agents making strategic decisions."
    INSTRUCTION = "Execute one round of the experiment."

    def handle(self, action_data: dict, agent: Agent, simulator: Simulator, scene: "ExperimentScene"):
        """Run one round of the experiment."""
        result = asyncio.run(scene.run_one_round(simulator))
        if result["success"]:
            return True, result, result["summary"], {}, True
        else:
            return False, result, result.get("error", "Experiment failed"), {}, False


class ExperimentScene(Scene):
    """Scene that uses the new Three-Layer Architecture experiment platform.

    KEY BEHAVIOR:
    - Each "advance node" runs exactly ONE round
    - Scene maintains state between rounds (context, history)
    - Complete when max_rounds is reached
    - Shows clear log output for each agent's action
    """

    TYPE = "experiment_template"

    def __init__(
        self,
        name: str,
        initial_event: str,
        template_config: dict[str, Any] | None = None,
    ):
        """Initialize the experiment scene.

        Args:
            name: Scene name
            initial_event: Initial event/description
            template_config: Experiment template configuration containing:
                - description: Scenario description
                - actions: List of action definitions
                - settings: Game settings (round_visibility, max_rounds)
        """
        super().__init__(name, initial_event)
        self.template_config = template_config or {}

        # Round tracking
        self._current_round = 0
        self._max_rounds = self.template_config.get("settings", {}).get("max_rounds", 10)

        # Lazy-initialized components (created on first run)
        self._runner: Optional[ExperimentRunner] = None
        self._experiment_agents: List[ExperimentAgent] = []
        self._game_config: Optional[GameConfig] = None
        self._kernel: Optional[ExperimentKernel] = None
        self._llm_client: Optional[LLMClient] = None

        # Results tracking
        self._all_results: List[RoundResult] = []

        # First agent tracking
        self._first_agent_name: Optional[str] = None

        # Store template settings
        self.description = self.template_config.get("description", initial_event)
        self.actions_config = self.template_config.get("actions", [])
        self.settings = self.template_config.get("settings", {})
        self.round_visibility = self.settings.get("round_visibility", "simultaneous")

        # Log initialization
        logger.debug(f"\n{'='*60}")
        logger.debug(f"EXPERIMENT SCENE INITIALIZED: {name}")
        logger.debug(f"Description: {self.description[:100]}...")
        logger.debug(f"Actions: {[a.get('name') for a in self.actions_config]}")
        logger.debug(f"Settings: visibility={self.round_visibility}, max_rounds={self._max_rounds}")
        logger.debug(f"{'='*60}\n")

    def initialize_agent(self, agent: Agent) -> None:
        """Initialize an agent (no-op for experiments)."""
        pass

    def get_scene_actions(self, agent: Agent) -> List[Action]:
        """Return the run_experiment action for the first agent only.

        All agents contribute to each round, but only the first agent
        needs the trigger action.
        """
        if self._first_agent_name is None:
            self._first_agent_name = agent.name
            logger.debug(f"[EXPERIMENT SCENE] First agent is {agent.name}, giving them RunExperimentAction")
            return [RunExperimentAction()]

        logger.debug(f"[EXPERIMENT SCENE] Agent {agent.name} is not first, no actions given")
        return []

    def parse_and_handle_action(self, action_data: dict, agent: Agent, simulator: Simulator):
        """Handle experiment-specific actions."""
        action_name = action_data.get("action")

        if action_name == "run_experiment":
            result = asyncio.run(self.run_one_round(simulator))
            if result["success"]:
                return True, result, result["summary"], {}, True
            else:
                return False, result, result.get("error", "Failed"), {}, False

        return False, {}, f"Unknown action: {action_name}", {}, False

    def is_complete(self) -> bool:
        """Check if the experiment has completed (max rounds reached)."""
        return self._current_round >= self._max_rounds

    def _ensure_initialized(self, simulator: Simulator) -> None:
        """Lazy-initialize the experiment components on first run.

        This creates the ExperimentRunner, converts legacy agents to ExperimentAgent,
        and sets up the game config and kernel.
        """
        if self._runner is not None:
            return  # Already initialized

        logger.debug(f"[EXPERIMENT SCENE] Initializing experiment components...")

        # Get LLM client
        self._llm_client = simulator.clients.get("chat")
        if not self._llm_client:
            raise ValueError("No LLM client configured!")

        logger.debug(f"LLM client found: {type(self._llm_client).__name__}")

        # Convert legacy agents to ExperimentAgent
        self._experiment_agents = []
        for name, legacy_agent in simulator.agents.items():
            exp_agent = ExperimentAgent(
                name=name,
                properties=getattr(legacy_agent, "properties", {}),
                llm_config=self._llm_client.config if hasattr(self._llm_client, "config") else {}
            )
            self._experiment_agents.append(exp_agent)
            logger.debug(f"Created ExperimentAgent: {name}")

        # Create GameConfig
        self._game_config = self._create_game_config()
        logger.debug(f"GameConfig created: actions={self._game_config.actions}")

        # Create and register kernel actions
        self._kernel = ExperimentKernel()
        self._register_template_actions(self._kernel)
        logger.debug(f"Kernel registered with actions: {list(self._kernel._action_registry.keys())}")

        # Create the runner
        self._runner = ExperimentRunner(
            agents=self._experiment_agents,
            game_config=self._game_config,
            llm_client=self._llm_client,
            kernel=self._kernel,
            round_visibility=self.round_visibility
        )
        logger.debug(f"ExperimentRunner created")

    async def run_one_round(self, simulator: Simulator) -> dict[str, Any]:
        """Run exactly ONE round of the experiment.

        Args:
            simulator: The legacy simulator instance

        Returns:
            Dict with success status, round results, and summary
        """
        self._current_round += 1
        round_num = self._current_round

        logger.debug(f"\n{'='*60}")
        logger.debug(f"EXPERIMENT SCENE: Running ROUND {round_num}/{self._max_rounds}")
        logger.debug(f"{'='*60}\n")

        try:
            # Ensure components are initialized
            self._ensure_initialized(simulator)

            # Build context summary from previous rounds
            # Convert RoundResult objects to dict format expected by build_context_summary
            round_history = []
            for result in self._all_results:
                actions_list = []
                for action in result.actions:
                    actions_list.append({
                        "agent": action.agent_name,
                        "action": action.action_name,
                        "parameters": action.parameters,
                        "summary": action.summary
                    })
                round_history.append({
                    "round": result.round_num,
                    "actions": actions_list
                })

            context_summary = build_context_summary(round_history, max_rounds=5)

            # Run ONE round using the runner's internal method
            round_result = await self._runner._run_single_round(
                round_num=round_num,
                context_summary=context_summary
            )

            self._all_results.append(round_result)

            # Log round results clearly
            logger.debug(f"\n{'='*60}")
            logger.debug(f"ROUND {round_num} RESULTS:")
            logger.debug(f"{'='*60}")
            for action in round_result.actions:
                if action.skipped:
                    logger.debug(f"  {action.agent_name}: [SKIPPED] - {action.error}")
                else:
                    params_str = ""
                    if action.parameters:
                        params_str = f" ({action.parameters})"
                    logger.debug(f"  {action.agent_name}: {action.action_name}{params_str}")
            logger.debug(f"{'='*60}\n")

            # Emit events for this round's actions
            for action_result in round_result.actions:
                self._emit_action_event(simulator, action_result, round_num)

            # Build summary
            summary = self._build_round_summary(round_result, round_num)

            return {
                "success": True,
                "round": round_num,
                "actions": [
                    {
                        "agent": a.agent_name,
                        "action": a.action_name,
                        "parameters": a.parameters,
                        "summary": a.summary,
                        "skipped": a.skipped,
                        "error": a.error
                    }
                    for a in round_result.actions
                ],
                "summary": summary,
                "complete": self.is_complete()
            }

        except Exception as e:
            logger.exception(f"Round {round_num} execution failed: {e}")
            return {
                "success": False,
                "round": round_num,
                "error": str(e),
                "summary": f"Round {round_num} failed: {e}",
                "complete": False
            }

    def _create_game_config(self) -> GameConfig:
        """Create a GameConfig from template settings."""
        action_names = [a.get("name") for a in self.actions_config if a.get("name")]

        return GameConfig(
            name=self.name,
            description=self.description,
            action_type="discrete",
            actions=action_names if action_names else ["cooperate", "defect"],
            output_field="action"
        )

    def _register_template_actions(self, kernel: ExperimentKernel) -> None:
        """Register actions from template configuration."""
        from socialsim4.core.experiment.kernel import ExperimentAction

        for action_def in self.actions_config:
            name = action_def.get("name")
            if not name:
                continue

            class TemplateAction(ExperimentAction):
                NAME = name
                DESCRIPTION = action_def.get("description", "")

                def __init__(self, parameters: dict[str, Any] | None = None):
                    super().__init__(parameters or {})

                def execute(self, agent: ExperimentAgent) -> dict[str, Any]:
                    return {"parameters": self.parameters}

            kernel.register(name, TemplateAction)

    def _emit_action_event(self, simulator: Simulator, action_result, round_num: int) -> None:
        """Emit a simulator event for an experiment action."""
        simulator.emit_event(
            "experiment_action",
            {
                "agent": action_result.agent_name,
                "action": action_result.action_name,
                "parameters": action_result.parameters,
                "summary": action_result.summary,
                "round": round_num,
                "skipped": action_result.skipped,
                "success": action_result.success
            }
        )

    def _build_round_summary(self, round_result: RoundResult, round_num: int) -> str:
        """Build a human-readable summary for one round."""
        lines = [f"Round {round_num}:"]
        for action in round_result.actions:
            if action.skipped:
                lines.append(f"  {action.agent_name}: [SKIPPED] {action.error}")
            else:
                params_str = ""
                if action.parameters:
                    params_str = f" {action.parameters}"
                lines.append(f"  {action.agent_name}: {action.action_name}{params_str}")
        return "\n".join(lines)

    def get_scenario_description(self) -> str:
        """Return the scenario description from the template."""
        return self.description

    def get_compact_description(self) -> str:
        """Return a compact description for the experiment."""
        parts = [self.description]

        if self.actions_config:
            action_names = [a.get("name") for a in self.actions_config if a.get("name")]
            if action_names:
                parts.append(f"\nAvailable actions: {', '.join(action_names)}")

        parts.append(f"\nRound {self._current_round}/{self._max_rounds}")

        return "\n".join(parts)

    def serialize_config(self) -> dict:
        """Return experiment-specific configuration for serialization."""
        return {
            "template_config": self.template_config,
            "current_round": self._current_round,
        }

    @classmethod
    def deserialize_config(cls, config: dict) -> dict:
        """Parse config dict and return kwargs for the constructor."""
        return {
            "template_config": config.get("template_config", {}),
        }
