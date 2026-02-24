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
from socialsim4.core.context_builder import build_context_summary

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

    The runner handles the main experiment loop, supporting:
    - Simultaneous: All agents decide without seeing each other's choices
    - Sequential: Agents decide one at a time, seeing previous choices
    - Random: Agents decide in shuffled order, seeing previous choices
    - Paired: Agents are randomly paired each round, play within pairs
    """

    def __init__(
        self,
        agents: List[ExperimentAgent],
        game_config: GameConfig,
        llm_client: LLMClient,
        kernel: ExperimentKernel | None = None,
        round_visibility: Literal["simultaneous", "sequential", "random", "paired"] = "simultaneous"
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
        self.turn_order: List[str] | None = None  # Store shuffled order for random/paired mode
        self.scores: Dict[str, int] = {}  # Track cumulative scores per agent (for paired mode)

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
            elif self.round_visibility == "random":
                round_result = await self._run_random_round(round_num)
            elif self.round_visibility == "paired":
                round_result = await self._run_paired_round(round_num)
            else:  # sequential
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

    async def _run_random_round(self, round_num: int) -> RoundResult:
        """Run a round where agents decide in random order.

        Each agent sees previous agents' choices from this round.
        The order is shuffled at the start of each round.
        """
        import random

        # Shuffle agent order for this round
        self.turn_order = [agent.name for agent in self.agents]
        random.shuffle(self.turn_order)

        logger.debug(f"Random turn order for round {round_num}: {self.turn_order}")

        # Create a mapping from name to agent
        agent_map = {agent.name: agent for agent in self.agents}

        actions = []
        for agent_name in self.turn_order:
            agent = agent_map[agent_name]
            result = await self._prompt_agent(agent, round_num)
            actions.append(result)
            # Action is recorded by controller.process_response(),
            # making it immediately visible to the next agent

        return RoundResult(
            round_num=round_num,
            actions=actions,
            completed=len(actions) == len(self.agents)
        )

    async def _run_paired_round(self, round_num: int) -> RoundResult:
        """Run a round where agents are randomly paired.

        Each round:
        1. Shuffle agents randomly
        2. Form pairs (agent[0] vs agent[1], agent[2] vs agent[3], etc.)
        3. If odd number of agents, one sits out
        4. Each pair plays simultaneously (within the pair, they don't see each other's choices)
        5. Track cumulative scores per agent

        Cumulative scores are stored in self.scores and can be used for
        payoff calculations or tournament-style scenarios.
        """
        import random

        # Shuffle agent order for this round
        self.turn_order = [agent.name for agent in self.agents]
        random.shuffle(self.turn_order)

        logger.debug(f"Paired mode - shuffled order for round {round_num}: {self.turn_order}")

        # Create a mapping from name to agent
        agent_map = {agent.name: agent for agent in self.agents}

        # Form pairs and track who sits out
        pairs = []
        sat_out = None

        for i in range(0, len(self.turn_order), 2):
            if i + 1 < len(self.turn_order):
                pairs.append((self.turn_order[i], self.turn_order[i + 1]))
            else:
                sat_out = self.turn_order[i]

        if sat_out:
            logger.debug(f"Agent {sat_out} sits out this round (odd number of agents)")

        # Execute each pair simultaneously (within the pair)
        all_actions = []

        for pair_idx, (agent1_name, agent2_name) in enumerate(pairs):
            logger.debug(f"Pair {pair_idx + 1}: {agent1_name} vs {agent2_name}")

            # Get the agents for this pair
            agent1 = agent_map[agent1_name]
            agent2 = agent_map[agent2_name]

            # Prompt both agents in parallel (simultaneous within the pair)
            tasks = [
                self._prompt_agent(agent1, round_num),
                self._prompt_agent(agent2, round_num)
            ]
            pair_results = await asyncio.gather(*tasks, return_exceptions=True)

            for result in pair_results:
                if isinstance(result, Exception):
                    logger.error(f"Agent in pair failed: {result}")
                    continue
                all_actions.append(result)

        # Handle sat-out agent (they don't act this round)
        if sat_out:
            # Add a skipped action for the sat-out agent
            sat_out_agent = agent_map[sat_out]
            all_actions.append(ActionResult(
                success=False,
                action_name="",
                parameters={},
                summary=f"{sat_out} sat out this round (odd number of agents)",
                agent_name=sat_out,
                round_num=round_num,
                skipped=True,
                error="Sat out due to odd number of agents"
            ))

        # Update cumulative scores (basic implementation - can be extended)
        # This is a simple version - actual scoring would depend on game logic
        for action in all_actions:
            if not action.skipped and action.agent_name not in self.scores:
                self.scores[action.agent_name] = 0
            # Score updates would be handled by game-specific logic
            # This is just a placeholder for tracking

        logger.debug(f"Paired round {round_num} complete: {len(all_actions)} actions across {len(pairs)} pairs")

        return RoundResult(
            round_num=round_num,
            actions=all_actions,
            completed=len([a for a in all_actions if not a.skipped]) == len(self.agents)
        )

    async def _run_single_round(
        self, round_num: int, context_summary: str, round_history: list = None
    ) -> RoundResult:
        """Run a single round with provided context summary.

        This method is called by ExperimentScene to run one round at a time.
        It builds per-agent context based on visibility settings.

        Args:
            round_num: The round number to run
            context_summary: Shared context summary from previous rounds (fallback)
            round_history: Full round history for per-agent context filtering

        Returns:
            RoundResult with all agent actions for this round
        """
        self.current_round = round_num
        logger.info(f"Starting round {round_num}")

        # Build per-agent context summaries if round_history is provided
        if round_history:
            for agent in self.agents:
                # Determine visibility mode for this agent
                # Sequential and random modes allow agents to see earlier agents' actions
                # Paired mode shows only previous rounds (agents see their pairings)
                if self.round_visibility in ("sequential", "random"):
                    visibility_mode = "sequential"
                else:
                    # simultaneous and paired modes show only previous rounds
                    visibility_mode = "previous_rounds"

                # Build per-agent context using filtered history
                agent_context = build_context_summary(
                    round_history,
                    max_rounds=5,
                    for_agent=agent.name,
                    visibility_mode=visibility_mode
                )

                # Set per-agent context in context manager
                self.context_manager._summaries[agent.name] = agent_context

        elif context_summary:
            # Fallback to shared context if no round_history provided
            self.context_manager.set_initial_context(context_summary)

        # Run the round with appropriate visibility mode
        if self.round_visibility == "simultaneous":
            round_result = await self._run_simultaneous_round(round_num)
        elif self.round_visibility == "random":
            round_result = await self._run_random_round(round_num)
        elif self.round_visibility == "paired":
            round_result = await self._run_paired_round(round_num)
        else:  # sequential
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
