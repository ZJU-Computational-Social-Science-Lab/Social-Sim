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
import sys
from typing import List, Dict, Any, Literal
from dataclasses import dataclass
from pathlib import Path
from datetime import datetime

from socialsim4.core.experiment.agent import ExperimentAgent
from socialsim4.core.experiment.game_configs import GameConfig
from socialsim4.core.experiment.kernel import ExperimentKernel
from socialsim4.core.experiment.controller import ExperimentController, ActionResult
from socialsim4.core.experiment.round_context import RoundContextManager
from socialsim4.core.experiment.prompt_builder import build_prompt
from socialsim4.core.llm.client import LLMClient

# Configure debug logging to stdout
logger = logging.getLogger(__name__)
_handler = logging.StreamHandler(sys.stdout)
_handler.setLevel(logging.DEBUG)
_handler.setFormatter(logging.Formatter('[EXPERIMENT RUNNER] %(message)s'))
logger.addHandler(_handler)
logger.setLevel(logging.DEBUG)

# Debug file for full prompts/responses (won't be truncated)
_debug_dir = Path("test_results")
_debug_dir.mkdir(exist_ok=True)
_debug_file = _debug_dir / f"experiment_debug_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"


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

    async def _run_single_round(
        self, round_num: int, context_summary: str
    ) -> RoundResult:
        """Run a single round with provided context summary.

        This method is called by ExperimentScene to run one round at a time
        (instead of running all rounds in a loop). It uses the context summary
        built from previous rounds.

        Args:
            round_num: The round number to run
            context_summary: Context summary from previous rounds

        Returns:
            RoundResult with all agent actions for this round
        """
        # Set context summary for all agents before running the round
        self.context_manager.set_initial_context(context_summary)

        self.current_round = round_num
        logger.info(f"Starting round {round_num}")

        if self.round_visibility == "simultaneous":
            round_result = await self._run_simultaneous_round(round_num)
        else:
            round_result = await self._run_sequential_round(round_num)

        # Update context summaries after the round
        await self.context_manager.update_summaries(
            self.llm_client, self.agents, round_num
        )

        logger.info(f"Round {round_num} complete: {len(round_result.actions)} actions")

        return round_result

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

        # Write to debug file (won't be truncated)
        with open(_debug_file, 'a', encoding='utf-8') as f:
            f.write(f"\n{'='*80}\n")
            f.write(f"[AGENT INPUT] {agent.name} - Round {round_num}\n")
            f.write(f"{'='*80}\n")
            f.write(f"Agent properties: {agent.get_properties_dict()}\n")
            f.write(f"Game config: actions={self.game_config.actions}, type={self.game_config.action_type}\n")
            f.write(f"\n--- PROMPT ---\n")
            f.write(prompt)
            f.write(f"\n--- END PROMPT ---\n\n")

        # Print summary to console
        print(f"\n[AGENT INPUT] {agent.name} - Round {round_num}")
        print(f"Prompt length: {len(prompt)} chars")
        print(f"See test_results/ for full prompt")

        logger.debug(f"Prompting agent {agent.name} for round {round_num}")
        logger.debug(f"Game config: actions={self.game_config.actions}, type={self.game_config.action_type}")

        try:
            # Call LLM (wrap synchronous call for async compatibility)
            messages = [{"role": "user", "content": prompt}]
            raw_response = await asyncio.to_thread(
                self.llm_client.chat, messages, json_mode=True
            )

            # Write raw response to debug file
            with open(_debug_file, 'a', encoding='utf-8') as f:
                f.write(f"\n{'='*80}\n")
                f.write(f"[AGENT OUTPUT] {agent.name} - Round {round_num}\n")
                f.write(f"{'='*80}\n")
                f.write(f"Raw LLM response:\n{raw_response}\n")
                f.write(f"{'='*80}\n\n")

            # Print summary to console
            print(f"[AGENT OUTPUT] {agent.name} - Round {round_num}")
            print(f"Response length: {len(raw_response)} chars")
            print(f"First 200 chars: {raw_response[:200]}")

            logger.debug(f"Raw response from {agent.name}: {raw_response[:200]}...")

            # Process response through controller (Layer 3)
            result = await self.controller.process_response(
                raw_response, agent, self.game_config,
                self.llm_client, round_num
            )

            # Write processed result to debug file
            with open(_debug_file, 'a', encoding='utf-8') as f:
                f.write(f"\n[PROCESSED RESULT] {agent.name}\n")
                f.write(f"  action: {result.action_name}\n")
                f.write(f"  success: {result.success}\n")
                f.write(f"  skipped: {result.skipped}\n")
                f.write(f"  summary: {result.summary}\n")
                if result.error:
                    f.write(f"  error: {result.error}\n")
                f.write("\n")

            # Print summary to console
            print(f"[PROCESSED RESULT] {agent.name}")
            print(f"  action: {result.action_name}")
            print(f"  success: {result.success}")
            print(f"  skipped: {result.skipped}")
            print()

            logger.debug(f"Processed result: action={result.action_name}, success={result.success}, skipped={result.skipped}")
            if result.error:
                logger.debug(f"Error: {result.error}")

            return result

        except Exception as e:
            with open(_debug_file, 'a', encoding='utf-8') as f:
                f.write(f"\n[ERROR] Agent {agent.name} failed: {e}\n\n")
            print(f"\n[ERROR] Agent {agent.name} failed: {e}\n")
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
