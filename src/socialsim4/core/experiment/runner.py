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
from socialsim4.core.experiment.payoff.engine import PayoffEngine
from socialsim4.core.experiment.feedback.builder import CoordinationFeedbackBuilder
from socialsim4.core.llm.client import LLMClient
from socialsim4.core.context_builder import build_context_summary

logger = logging.getLogger(__name__)
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
        self._debug_lock = asyncio.Lock()  # Lock for atomic debug file writes

        self.context_manager = RoundContextManager(
            information_model=information_model,
            scene_state=self.scene_state,
            all_agent_names=[a.name for a in agents],
        )
        self.controller = ExperimentController(self.kernel, self.context_manager)
        self.action_handler = ActionHandler()
        self.payoff_engine = PayoffEngine()
        self.feedback_builder = CoordinationFeedbackBuilder()
        self.current_round = 0
        self.turn_order: List[str] | None = None  # Store shuffled order for random/paired mode
        self.scores: Dict[str, int] = {}  # Track cumulative scores per agent (for paired mode)
        self.pending_host_messages: list[str] = []  # Injected by host before each round

    def set_scene_state(self, state: Dict[str, Any]) -> None:
        """Merge new state into scene_state. context_manager holds the same reference."""
        self.scene_state.update(state)

    async def _write_debug_atomically(self, buffer: list) -> None:
        """Write debug buffer to file atomically using lock."""
        async with self._debug_lock:
            with open(_debug_file, 'a', encoding='utf-8') as f:
                f.write(''.join(buffer))

    def execute_action(self, action_name, agent_name, params, state):
        """Delegate action execution to ActionHandler."""
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

    def _calculate_scores(self, round_actions: List[ActionResult], pairs: List[tuple] = None) -> Dict[str, int | float]:
        """Calculate and update scores based on game outcomes using PayoffEngine.

        Args:
            round_actions: List of action results from the round
            pairs: Optional list of (agent1_name, agent2_name) tuples for paired mode.
                   If not provided, all agents play against each other (2-agent case).

        Returns:
            Dict mapping agent name to payoff earned this round (empty if not applicable)
        """
        # Get payoff_type from game_config
        payoff_type = getattr(self.game_config, 'payoff_type', 'none')

        # Build graph from pairs if available
        graph = None
        if pairs:
            graph = {"edges": pairs}

        # Get payoff_config from game_config
        payoff_config = getattr(self.game_config, 'payoff_config', {})

        # Fallback: Build config from legacy fields if payoff_config is empty
        if not payoff_config and self.game_config.cooperate_reward is not None:
            payoff_config = {
                "matrix": {
                    "cooperate_cooperate": {"value": self.game_config.cooperate_reward or 0},
                    "cooperate_defect": {"row": self.game_config.sucker_penalty or 0, "col": self.game_config.temptation_reward or 0},
                    "defect_cooperate": {"row": self.game_config.temptation_reward or 0, "col": self.game_config.sucker_penalty or 0},
                    "defect_defect": {"value": self.game_config.defect_penalty or 0},
                }
            }

        # Get grouping_mode from game_config
        grouping_mode = getattr(self.game_config, 'grouping_mode', 'pairwise')

        # Calculate payoffs using PayoffEngine
        round_payoffs = self.payoff_engine.calculate_round_payoffs(
            payoff_type=payoff_type,
            actions=round_actions,
            config=payoff_config,
            grouping_mode=grouping_mode,
            graph=graph,
        )

        # Update agent scores
        agent_objs = {a.name: a for a in self.agents}
        for agent_name, payoff in round_payoffs.items():
            if agent_name in agent_objs:
                agent_objs[agent_name].score += round(payoff, 2)
                logger.debug(f"Score updated: {agent_name}={agent_objs[agent_name].score}")

        return round_payoffs

    def _apply_coordination_feedback(self, actions: List[ActionResult], round_num: int) -> None:
        """Apply coordination feedback for feedback-type games to all round modes.

        Generates neighbor-based feedback for each agent and stores it on the
        corresponding round event so the next prompt includes it.
        """
        if self.game_config.payoff_type != "feedback":
            return
        for result in actions:
            if not result.skipped:
                feedback = self._generate_coordination_feedback(
                    result.agent_name,
                    result.action_name,
                    actions,
                )
                for event in self.context_manager._round_events:
                    if event.agent_name == result.agent_name and event.round_num == round_num:
                        event.feedback = feedback

    def _generate_coordination_feedback(
        self,
        agent_name: str,
        agent_choice: str,
        round_actions: List[ActionResult],
    ) -> str:
        """Generate coordination feedback for an agent based on neighbor choices.

        Args:
            agent_name: The agent to generate feedback for
            agent_choice: What the agent chose
            round_actions: All actions from this round

        Returns:
            Human-readable feedback string
        """
        # Get neighbors from graph
        graph = self.scene_state.get("graph", {})
        edges = graph.get("edges", [])

        # Find this agent's neighbors
        neighbors = []
        for a, b in edges:
            if a == agent_name:
                neighbors.append(b)
            elif b == agent_name:
                neighbors.append(a)

        # Build choices dict from round actions
        all_choices = {a.agent_name: a.action_name for a in round_actions if not a.skipped}

        return self.feedback_builder.build_feedback(
            agent_name=agent_name,
            agent_choice=agent_choice,
            neighbors=neighbors,
            all_choices=all_choices,
        )

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
        # Fallback: Create default pairs for pairwise grouping_mode
        elif self.game_config.grouping_mode == "pairwise":
            agent_names = [a.name for a in self.agents]
            if len(agent_names) >= 2:
                # For 2 agents: single pair
                # For 4+ agents: pair sequentially (A-B, C-D, etc.)
                pairs = []
                for i in range(0, len(agent_names) - 1, 2):
                    pairs.append((agent_names[i], agent_names[i + 1]))
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

        self._apply_coordination_feedback(actions, round_num)

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

        self._apply_coordination_feedback(actions, round_num)

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

        self._apply_coordination_feedback(actions, round_num)

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

        self._apply_coordination_feedback(all_actions, round_num)

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
        # Capture host messages for this round then clear so they don't repeat
        self._round_host_messages: list[str] = list(self.pending_host_messages)
        self.pending_host_messages = []
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

        # Prepend host messages to context
        round_host_msgs = getattr(self, '_round_host_messages', [])
        if round_host_msgs:
            host_block = "\n".join(f"[HOST MESSAGE]: {m}" for m in round_host_msgs)
            context = f"{host_block}\n\n{context}" if context else host_block

        # Build KB context from agent's knowledge base (keyword match against context)
        kb_context = agent.get_knowledge_context(query=context[:200] if context else "", max_items=3)

        # Build neighbor context from social graph
        neighbor_context = ""
        graph = self.scene_state.get("graph", {})
        edges = graph.get("edges", [])
        if edges:
            neighbors = [b for a, b in edges if a == agent.name] + [a for a, b in edges if b == agent.name]
            if neighbors:
                neighbor_context = f"Your social network neighbors: {', '.join(neighbors)}."
        prompt = build_prompt(agent, self.game_config, context, include_section_markers=True, information_model=self.information_model, kb_context=kb_context, neighbor_context=neighbor_context)

        # Build debug output buffer (will be written atomically after LLM call)
        debug_buffer = []
        debug_buffer.append(f"\n{'#'*80}\n")
        debug_buffer.append(f"# LLM DEBUG LOG - {datetime.now().isoformat()}\n")
        debug_buffer.append(f"{'#'*80}\n\n")
        debug_buffer.append(f"## AGENT: {agent.name}\n")
        debug_buffer.append(f"## ROUND: {round_num}\n")
        debug_buffer.append(f"## VISIBILITY MODE: {self.round_visibility}\n")

        # --- NETWORK VISIBILITY DEBUG ---
        if self.information_model and self.information_model.scope_type in ("neighborhood", "neighbor"):
            debug_buffer.append(f"\n--- NETWORK VISIBILITY ---\n")
            graph = self.scene_state.get("graph", {})
            edges = graph.get("edges", [])
            if edges:
                # Build a map of agent -> neighbors
                neighbor_map = {}
                for a, b in edges:
                    if a not in neighbor_map:
                        neighbor_map[a] = []
                    if b not in neighbor_map:
                        neighbor_map[b] = []
                    neighbor_map[a].append(b)
                    neighbor_map[b].append(a)
                # Show each agent's connections
                for agent_obj in sorted(self.agents, key=lambda x: neighbor_map.get(agent_obj.name, [])):
                    neighbor_names = sorted(neighbor_map[agent_obj.name])
                    debug_buffer.append(f"  {agent_obj.name}: connected to {neighbor_names}\n")
            else:
                debug_buffer.append(f"  (No network edges configured)\n")

        # --- PAIRINGS (for paired games) ---
        if self.information_model and self.information_model.scope_type == "pair" and self.information_model.pairing_fn:
            debug_buffer.append(f"\n--- ROUND {round_num} PAIRINGS ---\n")
            pairs = self.information_model.pairing_fn([a.name for a in self.agents], round_num)
            for a, b in pairs:
                debug_buffer.append(f"  {a} paired with {b}\n")

        debug_buffer.append(f"--- AGENT PROPERTIES ---\n")
        for k, v in agent.get_properties_dict().items():
            debug_buffer.append(f"  {k}: {v}\n")
        debug_buffer.append(f"\n--- GAME CONFIG ---\n")
        debug_buffer.append(f"  scenario: {self.game_config.description[:100]}...\n")
        debug_buffer.append(f"  actions: {self.game_config.actions}\n")
        debug_buffer.append(f"  action_type: {self.game_config.action_type}\n")
        debug_buffer.append(f"  output_field: {self.game_config.output_field}\n")
        if self.game_config.action_descriptions:
            debug_buffer.append(f"  action_descriptions: {self.game_config.action_descriptions}\n")
        debug_buffer.append(f"\n--- CONTEXT (filtered for this agent) ---\n")
        debug_buffer.append(f"{context[:500]}...\n" if len(context) > 500 else f"{context}\n")
        debug_buffer.append(f"\n{'='*80}\n")
        debug_buffer.append(f"FULL PROMPT SENT TO LLM\n")
        debug_buffer.append(f"{'='*80}\n\n")
        debug_buffer.append(prompt)
        debug_buffer.append(f"\n\n{'='*80}\n")
        debug_buffer.append(f"END OF PROMPT\n")
        debug_buffer.append(f"{'='*80}\n\n")

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
                debug_buffer.append(f"\n{'!'*80}\n")
                debug_buffer.append(f"EMPTY RESPONSE\n")
                debug_buffer.append(f"{'!'*80}\n")
                debug_buffer.append(f"Agent {agent.name} received empty response from LLM\n\n")
                # Write debug output atomically
                await self._write_debug_atomically(debug_buffer)
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

            # Add response to debug buffer
            debug_buffer.append(f"\n{'='*80}\n")
            debug_buffer.append(f"LLM RAW RESPONSE\n")
            debug_buffer.append(f"{'='*80}\n\n")
            debug_buffer.append(raw_response)
            debug_buffer.append(f"\n\n{'='*80}\n")
            debug_buffer.append(f"END OF RESPONSE\n")
            debug_buffer.append(f"{'='*80}\n\n")

            logger.debug(f"LLM response for {agent.name}: {len(raw_response)} chars")

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

            # Add processed result to debug buffer
            debug_buffer.append(f"\n--- PROCESSED RESULT ---\n")
            debug_buffer.append(f"  action: {result.action_name}\n")
            debug_buffer.append(f"  success: {result.success}\n")
            debug_buffer.append(f"  skipped: {result.skipped}\n")
            debug_buffer.append(f"  summary: {result.summary}\n")
            if result.error:
                debug_buffer.append(f"  error: {result.error}\n")
            debug_buffer.append("\n" + "-"*80 + "\n\n")

            # Write debug output atomically
            await self._write_debug_atomically(debug_buffer)

            logger.debug(f"Processed result: action={result.action_name}, success={result.success}, skipped={result.skipped}")
            if result.error:
                logger.debug(f"Error: {result.error}")

            return result

        except Exception as e:
            debug_buffer.append(f"\n{'!'*80}\n")
            debug_buffer.append(f"ERROR\n")
            debug_buffer.append(f"{'!'*80}\n")
            debug_buffer.append(f"Agent {agent.name} failed: {e}\n\n")
            # Write debug output atomically
            await self._write_debug_atomically(debug_buffer)
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
