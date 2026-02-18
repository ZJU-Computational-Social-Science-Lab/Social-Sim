"""
Experiment Runner - orchestrates round-based experiment execution.

The runner manages the main experiment loop:
- Executes rounds according to visibility settings
- Handles simultaneous vs sequential decision-making
- Updates context summaries after each round
- Emits round completion events
"""

import asyncio
import logging
from typing import List, Dict, Any, Literal
from dataclasses import dataclass

from socialsim4.core.experiment.agent import ExperimentAgent
from socialsim4.core.experiment.game_configs import GameConfig
from socialsim4.core.experiment.kernel import ExperimentKernel
from socialsim4.core.experiment.controller import ExperimentController, ActionResult
from socialsim4.core.experiment.round_context import RoundContextManager
from socialsim4.core.experiment.prompt_builder import build_prompt
from socialsim4.core.llm.client import LLMClient


logger = logging.getLogger(__name__)


@dataclass
class RoundResult:
    """Results from a single round.

    Attributes:
        round_num: Round number
        actions: List of action results from all agents
        completed: Whether all agents completed the round
    """
    round_num: int
    actions: List[ActionResult]
    completed: bool


class ExperimentRunner:
    """Orchestrates round-based experiment execution.

    The runner handles the main experiment loop, supporting both:
    - Simultaneous: All agents decide without seeing each other's choices
    - Sequential: Agents decide one at a time, seeing previous choices
    """

    def __init__(
        self,
        agents: List[ExperimentAgent],
        game_config: GameConfig,
        llm_client: LLMClient,
        kernel: ExperimentKernel | None = None,
        round_visibility: Literal["simultaneous", "sequential"] = "simultaneous"
    ):
        """Initialize the experiment runner.

        Args:
            agents: List of agents in the experiment
            game_config: Game configuration
            llm_client: LLM client for prompts and context updates
            kernel: Action registry (uses default if None)
            round_visibility: How agents see each other's choices
        """
        self.agents = agents
        self.game_config = game_config
        self.llm_client = llm_client
        self.kernel = kernel or ExperimentKernel()
        self.round_visibility = round_visibility

        self.context_manager = RoundContextManager()
        self.controller = ExperimentController(self.kernel, self.context_manager)
        self.current_round = 0

    async def run(self, max_rounds: int) -> List[RoundResult]:
        """Run the experiment for a specified number of rounds.

        Args:
            max_rounds: Maximum number of rounds to run

        Returns:
            List of round results
        """
        results = []

        for round_num in range(1, max_rounds + 1):
            self.current_round = round_num
            logger.info(f"Starting round {round_num}/{max_rounds}")

            if self.round_visibility == "simultaneous":
                round_result = await self._run_simultaneous_round(round_num)
            else:
                round_result = await self._run_sequential_round(round_num)

            results.append(round_result)

            # Update context summaries after the round
            await self.context_manager.update_summaries(
                self.llm_client, self.agents, round_num
            )

            # Emit round completion event (could hook into websocket)
            logger.info(f"Round {round_num} complete: {len(round_result.actions)} actions")

        return results

    async def _run_simultaneous_round(self, round_num: int) -> RoundResult:
        """Run a round where all agents decide simultaneously.

        Agents cannot see each other's choices for this round.
        """
        actions = []

        # Collect all decisions (parallel for efficiency)
        tasks = [
            self._prompt_agent(agent, round_num)
            for agent in self.agents
        ]
        action_results = await asyncio.gather(*tasks, return_exceptions=True)

        for result in action_results:
            if isinstance(result, Exception):
                logger.error(f"Agent failed: {result}")
                continue
            actions.append(result)

        return RoundResult(
            round_num=round_num,
            actions=actions,
            completed=len(actions) == len(self.agents)
        )

    async def _run_sequential_round(self, round_num: int) -> RoundResult:
        """Run a round where agents decide sequentially.

        Each agent sees previous agents' choices from this round.
        The controller records each action immediately, making it visible
        to subsequent agents via the context_manager.
        """
        actions = []

        for agent in self.agents:
            result = await self._prompt_agent(agent, round_num)
            actions.append(result)
            # Action is already recorded by controller.process_response(),
            # making it immediately visible to the next agent

        return RoundResult(
            round_num=round_num,
            actions=actions,
            completed=len(actions) == len(self.agents)
        )

    async def _prompt_agent(self, agent: ExperimentAgent, round_num: int) -> ActionResult:
        """Prompt a single agent and process their response.

        Args:
            agent: Agent to prompt
            round_num: Current round number

        Returns:
            ActionResult from processing the response
        """
        # Build prompt with current context
        context = self.context_manager.get_context(agent.name)
        prompt = build_prompt(agent, self.game_config, context)

        try:
            # Call LLM (wrap synchronous call for async compatibility)
            messages = [{"role": "user", "content": prompt}]
            raw_response = await asyncio.to_thread(
                self.llm_client.chat, messages, json_mode=True
            )

            # Process response through controller (Layer 3)
            result = await self.controller.process_response(
                raw_response, agent, self.game_config,
                self.llm_client, round_num
            )

            return result

        except Exception as e:
            logger.error(f"Error prompting agent {agent.name}: {e}")
            return ActionResult(
                success=False,
                action_name="",
                parameters={},
                summary="",
                agent_name=agent.name,
                round_num=round_num,
                skipped=True,
                error=str(e)
            )
