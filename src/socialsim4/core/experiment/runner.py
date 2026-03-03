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
from typing import List, Dict, Any, Literal, Optional
from dataclasses import dataclass
from pathlib import Path
from datetime import datetime

from socialsim4.core.experiment.agent import ExperimentAgent
from socialsim4.core.experiment.information_model import InformationModel
from socialsim4.core.experiment.game_configs import GameConfig
from socialsim4.core.experiment.kernel import ExperimentKernel
from socialsim4.core.experiment.controller import ExperimentController, ActionResult
from socialsim4.core.experiment.round_context import RoundContextManager
from socialsim4.core.experiment.prompt_builder import build_prompt, build_reprompt
from socialsim4.core.experiment.action_handler import ActionHandler
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
        payoffs: Per-agent payoffs earned this round (None if not applicable)
    """
    round_num: int
    actions: List[ActionResult]
    completed: bool
    payoffs: Optional[Dict[str, int]] = None


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
        round_visibility: Literal["simultaneous", "sequential", "random", "paired"] = "simultaneous",
        information_model: "InformationModel | None" = None,
    ):
        """Initialize the experiment runner.

        Args:
            agents: List of agents in the experiment
            game_config: Game configuration
            llm_client: LLM client for prompts and context updates
            kernel: Action registry (uses default if None)
            round_visibility: How agents see each other's choices
            information_model: Optional InformationModel for structured context
        """
        self.agents = agents
        self.game_config = game_config
        self.llm_client = llm_client
        self.kernel = kernel or ExperimentKernel()
        self.round_visibility = round_visibility
        self.information_model = information_model
        self.scene_state: Dict[str, Any] = {}  # shared mutable ref; update via set_scene_state()

        self.context_manager = RoundContextManager(
            information_model=information_model,
            scene_state=self.scene_state,
            all_agent_names=[a.name for a in agents],
        )
        self.controller = ExperimentController(self.kernel, self.context_manager)
        self.action_handler = ActionHandler()
        self.current_round = 0
        self.turn_order: List[str] | None = None  # Store shuffled order for random/paired mode
        self.scores: Dict[str, int] = {}  # Track cumulative scores per agent (for paired mode)

    def set_scene_state(self, state: Dict[str, Any]) -> None:
        """Merge new state into scene_state. context_manager holds the same reference."""
        self.scene_state.update(state)

    def execute_action(
        self,
        action_name: str,
        agent_name: str,
        params: dict,
        state: "ExperimentState",
    ) -> dict:
        """Execute an action using the ActionHandler.

        Args:
            action_name: Name of action to execute
            agent_name: Agent performing the action
            params: Action parameters
            state: ExperimentState to modify

        Returns:
            Result dict with success status
        """
        return self.action_handler.execute(action_name, agent_name, params, state)

    def _replay_history_to_events(self, round_history: list) -> None:
        """Replay round_history into context_manager._round_events.

        This populates _round_events from persisted history so that
        get_context_for_agent() (which reads _round_events when information_model
        is set) has data to build structured context.

        Args:
            round_history: List of round entries with "round", "actions", and optional "payoffs"
        """
        # Reset agent scores before rebuilding from history so we don't
        # double-count when this method is called on a reused runner.
        agent_objs = {a.name: a for a in self.agents}
        for agent in self.agents:
            agent.score = 0

        for entry in round_history:
            entry_round = entry.get("round", 0)
            payoffs = entry.get("payoffs", {})

            for action in entry.get("actions", []):
                agent_name = action.get("agent", "")
                action_name = action.get("action", "")
                parameters = action.get("parameters", {})
                summary = action.get("summary", f"{agent_name} chose {action_name}")
                agent_payoff = payoffs.get(agent_name)

                # Determine who observed this action using InformationModel
                if self.information_model:
                    observed_by = self.information_model.get_observers(
                        for_agent=agent_name,
                        scene_state=self.scene_state,
                        all_agent_names=[a.name for a in self.agents],
                        round_num=entry_round,
                    )
                else:
                    observed_by = [agent_name]

                self.context_manager.record_action(
                    agent_name=agent_name,
                    action_name=action_name,
                    parameters=parameters,
                    round_num=entry_round,
                    summary=summary,
                    observed_by=observed_by,
                    payoff=agent_payoff,
                )

            # Restore cumulative scores from this round's historical payoffs
            for agent_name, payoff in payoffs.items():
                if agent_name in agent_objs:
                    agent_objs[agent_name].score += payoff

        logger.debug(f"Replayed {len(round_history)} rounds of history to _round_events")

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

            # Emit round completion event (could hook into websocket)
            logger.info(f"Round {round_num} complete: {len(round_result.actions)} actions")

        return results

    def _record_action_to_agent(self, result: ActionResult) -> None:
        """Record an action result to the agent's history.

        Args:
            result: The action result to record
        """
        for agent in self.agents:
            if agent.name == result.agent_name:
                agent.action_history.append({
                    "round": result.round_num,
                    "action": result.action_name,
                    "content": f"Round {result.round_num}: chose {result.action_name}",
                    "success": result.success,
                    "skipped": result.skipped,
                    "summary": result.summary,
                })
                break

    def _calculate_scores(self, round_actions: List[ActionResult], pairs: List[tuple] = None) -> Dict[str, int]:
        """Calculate and update scores based on game outcomes.

        For Prisoner's Dilemma style games:
        - Both cooperate: both get cooperate_reward (R)
        - One cooperates, one defects: cooperator gets sucker_penalty (S), defector gets temptation_reward (T)
        - Both defect: both get defect_penalty (P)

        Args:
            round_actions: List of action results from the round
            pairs: Optional list of (agent1_name, agent2_name) tuples for paired mode.
                   If not provided, all agents play against each other (2-agent case).

        Returns:
            Dict mapping agent name to payoff earned this round (empty if not applicable)
        """
        round_payoffs: Dict[str, int] = {}

        # Only calculate if we have payoff parameters
        if self.game_config.cooperate_reward is None:
            return round_payoffs

        # Get all non-skipped actions
        valid_actions = [a for a in round_actions if not a.skipped]
        if len(valid_actions) < 2:
            return round_payoffs

        # Build action map
        action_map = {a.agent_name: a.action_name.lower() for a in valid_actions}

        # Find the agents to update their scores
        agent_objs = {a.name: a for a in self.agents}

        def calculate_pair_payoff(a1: str, a2: str) -> tuple:
            """Calculate payoff for a single pair. Returns (payoff_a1, payoff_a2)."""
            act1 = action_map.get(a1, "").lower()
            act2 = action_map.get(a2, "").lower()

            if act1 == "cooperate" and act2 == "cooperate":
                # Both cooperate: R, R
                p = self.game_config.cooperate_reward or 0
                return p, p
            elif act1 == "cooperate" and act2 == "defect":
                # a1 is sucker, a2 is tempter: S, T
                s = self.game_config.sucker_penalty or 0
                t = self.game_config.temptation_reward or 0
                return s, t
            elif act1 == "defect" and act2 == "cooperate":
                # a1 is tempter, a2 is sucker: T, S
                t = self.game_config.temptation_reward or 0
                s = self.game_config.sucker_penalty or 0
                return t, s
            else:
                # Both defect: P, P
                p = self.game_config.defect_penalty or 0
                return p, p

        # If pairs are provided (paired mode), calculate per-pair
        if pairs:
            for a1, a2 in pairs:
                if a1 in action_map and a2 in action_map:
                    p1, p2 = calculate_pair_payoff(a1, a2)
                    if a1 in agent_objs:
                        agent_objs[a1].score += p1
                    if a2 in agent_objs:
                        agent_objs[a2].score += p2
                    round_payoffs[a1] = p1
                    round_payoffs[a2] = p2
                    logger.debug(f"Pair scores: {a1}={p1}, {a2}={p2}")
        else:
            # Single pair mode (2 agents total)
            agents = list(action_map.keys())
            if len(agents) == 2:
                a1, a2 = agents[0], agents[1]
                p1, p2 = calculate_pair_payoff(a1, a2)
                if a1 in agent_objs:
                    agent_objs[a1].score += p1
                if a2 in agent_objs:
                    agent_objs[a2].score += p2
                round_payoffs = {a1: p1, a2: p2}
                logger.debug(f"Scores updated: {a1}={agent_objs[a1].score}, {a2}={agent_objs[a2].score}")

        return round_payoffs

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
            # Record action to agent's history
            self._record_action_to_agent(result)

        # Calculate scores - use InformationModel's pairing_fn if available so
        # n-agent games calculate per-pair payoffs correctly.
        pairs = None
        if (self.information_model and
                self.information_model.scope_type == "pair" and
                self.information_model.pairing_fn):
            pairs = self.information_model.pairing_fn(
                [a.name for a in self.agents], round_num
            )
        round_payoffs = self._calculate_scores(actions, pairs=pairs)

        # Record to context with observers and payoffs (done after scores are known
        # so payoff can be stored with the event; simultaneous = no mid-round visibility)
        for result in actions:
            if not result.skipped:
                self.context_manager.record_action_with_observers(
                    agent_name=result.agent_name,
                    action_name=result.action_name,
                    parameters=result.parameters,
                    round_num=round_num,
                    summary=result.summary,
                    payoff=round_payoffs.get(result.agent_name),
                )

        return RoundResult(
            round_num=round_num,
            actions=actions,
            completed=len(actions) == len(self.agents),
            payoffs=round_payoffs if round_payoffs else None
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
            # Record action to agent's history
            self._record_action_to_agent(result)
            # Record to context immediately so the next agent can observe it
            if not result.skipped:
                self.context_manager.record_action_with_observers(
                    agent_name=result.agent_name,
                    action_name=result.action_name,
                    parameters=result.parameters,
                    round_num=round_num,
                    summary=result.summary,
                    payoff=None,  # payoff unknown until round ends
                )

        # Calculate scores based on actions
        round_payoffs = self._calculate_scores(actions)

        return RoundResult(
            round_num=round_num,
            actions=actions,
            completed=len(actions) == len(self.agents),
            payoffs=round_payoffs if round_payoffs else None
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
            # Record action to agent's history
            self._record_action_to_agent(result)
            # Record to context immediately so the next agent can observe it
            if not result.skipped:
                self.context_manager.record_action_with_observers(
                    agent_name=result.agent_name,
                    action_name=result.action_name,
                    parameters=result.parameters,
                    round_num=round_num,
                    summary=result.summary,
                    payoff=None,  # payoff unknown until round ends
                )

        # Calculate scores - use InformationModel's pairing_fn if available so
        # n-agent games calculate per-pair payoffs correctly.
        pairs = None
        if (self.information_model and
                self.information_model.scope_type == "pair" and
                self.information_model.pairing_fn):
            pairs = self.information_model.pairing_fn(
                [a.name for a in self.agents], round_num
            )
        round_payoffs = self._calculate_scores(actions, pairs=pairs)

        return RoundResult(
            round_num=round_num,
            actions=actions,
            completed=len(actions) == len(self.agents),
            payoffs=round_payoffs if round_payoffs else None
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
                # Record action to agent's history
                self._record_action_to_agent(result)

        # Handle sat-out agent (they don't act this round)
        if sat_out:
            # Add a skipped action for the sat-out agent
            sat_out_agent = agent_map[sat_out]
            skipped_result = ActionResult(
                success=False,
                action_name="",
                parameters={},
                summary=f"{sat_out} sat out this round (odd number of agents)",
                agent_name=sat_out,
                round_num=round_num,
                skipped=True,
                error="Sat out due to odd number of agents"
            )
            all_actions.append(skipped_result)
            # Record skipped action to agent's history
            self._record_action_to_agent(skipped_result)

        # Calculate scores based on actions (for paired mode, scores are calculated per-pair)
        round_payoffs = self._calculate_scores(all_actions, pairs=pairs)

        # Record to context with observers and payoffs (after scores are known)
        for result in all_actions:
            if not result.skipped:
                self.context_manager.record_action_with_observers(
                    agent_name=result.agent_name,
                    action_name=result.action_name,
                    parameters=result.parameters,
                    round_num=round_num,
                    summary=result.summary,
                    payoff=round_payoffs.get(result.agent_name),
                )

        # Also update the legacy scores dict for backwards compatibility
        for action in all_actions:
            if not action.skipped and action.agent_name not in self.scores:
                self.scores[action.agent_name] = 0

        logger.debug(f"Paired round {round_num} complete: {len(all_actions)} actions across {len(pairs)} pairs")

        return RoundResult(
            round_num=round_num,
            actions=all_actions,
            completed=len([a for a in all_actions if not a.skipped]) == len(self.agents),
            payoffs=round_payoffs if round_payoffs else None
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

        # Populate _round_events from round_history so get_context_for_agent()
        # (which reads from _round_events when information_model is set) has data
        if round_history:
            self._replay_history_to_events(round_history)

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
        # Build prompt with current context (with section markers for debugging)
        context = self.context_manager.get_context_for_agent(agent.name, agent_score=agent.score)
        prompt = build_prompt(agent, self.game_config, context, include_section_markers=True, information_model=self.information_model)

        # Write to debug file (won't be truncated)
        with open(_debug_file, 'a', encoding='utf-8') as f:
            f.write(f"\n{'#'*80}\n")
            f.write(f"# LLM DEBUG LOG - {datetime.now().isoformat()}\n")
            f.write(f"{'#'*80}\n\n")
            f.write(f"## AGENT: {agent.name}\n")
            f.write(f"## ROUND: {round_num}\n")
            f.write(f"## VISIBILITY MODE: {self.round_visibility}\n\n")
            f.write(f"--- AGENT PROPERTIES ---\n")
            for k, v in agent.get_properties_dict().items():
                f.write(f"  {k}: {v}\n")
            f.write(f"\n--- GAME CONFIG ---\n")
            f.write(f"  scenario: {self.game_config.description[:100]}...\n")
            f.write(f"  actions: {self.game_config.actions}\n")
            f.write(f"  action_type: {self.game_config.action_type}\n")
            f.write(f"  output_field: {self.game_config.output_field}\n")
            if self.game_config.action_descriptions:
                f.write(f"  action_descriptions: {self.game_config.action_descriptions}\n")
            f.write(f"\n--- CONTEXT (filtered for this agent) ---\n")
            f.write(f"{context[:500]}...\n" if len(context) > 500 else f"{context}\n")
            f.write(f"\n{'='*80}\n")
            f.write(f"FULL PROMPT SENT TO LLM\n")
            f.write(f"{'='*80}\n\n")
            f.write(prompt)
            f.write(f"\n\n{'='*80}\n")
            f.write(f"END OF PROMPT\n")
            f.write(f"{'='*80}\n\n")

        # Print summary to console
        print(f"\n{'='*60}")
        print(f"[LLM INPUT] {agent.name} - Round {round_num}")
        print(f"{'='*60}")
        print(f"Prompt has 5 sections:")
        print(f"  1. Agent Description")
        print(f"  2. Scenario")
        print(f"  3. Available Actions ({len(self.game_config.actions)} actions)")
        print(f"  4. Context ({len(context)} chars)")
        print(f"  5. JSON Output Requirement")
        print(f"Total prompt length: {len(prompt)} chars")
        print(f"Debug file: {_debug_file}")
        print(f"{'='*60}")

        logger.debug(f"Prompting agent {agent.name} for round {round_num}")
        logger.debug(f"Game config: actions={self.game_config.actions}, type={self.game_config.action_type}")

        try:
            # Call LLM (wrap synchronous call for async compatibility)
            messages = [{"role": "user", "content": prompt}]
            raw_response = await asyncio.to_thread(
                self.llm_client.chat, messages, json_mode=True
            )

            # Handle empty response gracefully (e.g., Qwen3 via Ollama returns 0 chars)
            if not raw_response or not raw_response.strip():
                logger.error(f"Empty response from LLM for {agent.name}")
                with open(_debug_file, 'a', encoding='utf-8') as f:
                    f.write(f"\n{'!'*80}\n")
                    f.write(f"EMPTY RESPONSE\n")
                    f.write(f"{'!'*80}\n")
                    f.write(f"Agent {agent.name} received empty response from LLM\n\n")
                print(f"\n[ERROR] Empty LLM response for {agent.name}\n")
                return ActionResult(
                    agent_name=agent.name,
                    action_name="skip",
                    parameters={"error": "LLM returned empty response"},
                    summary="Skipped - LLM returned empty response",
                    success=False,
                    skipped=True,
                    round_num=round_num,
                    error="Empty LLM response"
                )

            # Write raw response to debug file
            with open(_debug_file, 'a', encoding='utf-8') as f:
                f.write(f"\n{'='*80}\n")
                f.write(f"LLM RAW RESPONSE\n")
                f.write(f"{'='*80}\n\n")
                f.write(raw_response)
                f.write(f"\n\n{'='*80}\n")
                f.write(f"END OF RESPONSE\n")
                f.write(f"{'='*80}\n\n")

            # Print summary to console
            print(f"\n{'='*60}")
            print(f"[LLM OUTPUT] {agent.name} - Round {round_num}")
            print(f"{'='*60}")
            print(f"Response length: {len(raw_response)} chars")
            print(f"First 300 chars:")
            print(f"{raw_response[:300]}")
            print(f"{'='*60}")

            logger.debug(f"Raw response from {agent.name}: {raw_response[:200]}...")

            # Process response through controller (Layer 3).
            # Use process_response_with_followup so actions that need extra
            # parameters (e.g., Speak → what do you want to say?) trigger a
            # second prompt automatically. Falls back gracefully for simple
            # game-theory actions that have no follow-up schema.
            action_schemas = self.kernel.get_action_schemas() if self.kernel else {}
            result = await self.controller.process_response_with_followup(
                raw_response, agent, self.game_config,
                self.llm_client, round_num,
                action_schemas=action_schemas
            )

            # Write processed result to debug file
            with open(_debug_file, 'a', encoding='utf-8') as f:
                f.write(f"\n--- PROCESSED RESULT ---\n")
                f.write(f"  action: {result.action_name}\n")
                f.write(f"  success: {result.success}\n")
                f.write(f"  skipped: {result.skipped}\n")
                f.write(f"  summary: {result.summary}\n")
                if result.error:
                    f.write(f"  error: {result.error}\n")
                f.write("\n" + "-"*80 + "\n\n")

            # Print summary to console
            print(f"\n[PROCESSED RESULT] {agent.name}")
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
                f.write(f"\n{'!'*80}\n")
                f.write(f"ERROR\n")
                f.write(f"{'!'*80}\n")
                f.write(f"Agent {agent.name} failed: {e}\n\n")
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
