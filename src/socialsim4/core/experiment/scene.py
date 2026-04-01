"""
Experiment Scene - standalone orchestrator for experiment execution.

This is NOT a Scene subclass. It manages ExperimentAgents directly,
runs rounds, and emits events without any legacy Agent/Simulator bridge.
"""

import logging
from copy import deepcopy
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
        self._pending_host_messages: list[str] = []
        self.state: ExperimentState = ExperimentState()
        # PGG phase tracking: "allocate" or "deduct"
        self._pgg_phase: str = "allocate"

        logger.debug(f"ExperimentScene initialized: scenario_id='{config.scenario_id}' (type: {type(config.scenario_id).__name__})")

    def initialize(self, llm_client: LLMClient, provider_clients: dict | None = None) -> None:
        """Create ExperimentAgents directly from config.

        Args:
            llm_client: LLM client for prompting agents (default for agents without llm_config)
            provider_clients: Optional mapping of provider_id -> LLMClient for per-agent distribution
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
                role_prompt=a.get("role_prompt") or a.get("rolePrompt") or a.get("profile"),
                knowledge_base=list(a.get("knowledgeBase") or a.get("knowledge_base") or []),
                provider_id=a.get("provider_id") or a.get("providerId"),
            )
            for a in self.config.agents
        ]

        # Create per-agent LLM clients based on llm_config.dialect
        # This enables LLM distribution - different agents can use different providers
        self._agent_llm_clients = {}
        for agent in self.agents:
            # Handle both dict (from config) and LLMConfig object
            if agent.llm_config:
                # Extract config values - handle both dict and LLMConfig object
                if isinstance(agent.llm_config, dict):
                    # Accept "dialect" or "provider" as the dialect key (frontend sends "provider")
                    dialect = agent.llm_config.get("dialect") or agent.llm_config.get("provider")
                    if not dialect:
                        # No dialect: try direct provider_id lookup, else fall back to default
                        if agent.provider_id and provider_clients and agent.provider_id in provider_clients:
                            self._agent_llm_clients[agent.name] = provider_clients[agent.provider_id]
                        else:
                            self._agent_llm_clients[agent.name] = llm_client
                        continue
                    model = agent.llm_config.get("model", "")
                    api_key = agent.llm_config.get("api_key", "")
                    base_url = agent.llm_config.get("base_url")
                    temperature = agent.llm_config.get("temperature", 0.7)
                    # If api_key missing, resolve from provider_clients or fall back to default client creds
                    if not api_key:
                        if agent.provider_id and provider_clients and agent.provider_id in provider_clients:
                            p = provider_clients[agent.provider_id].provider
                            api_key = p.api_key
                            base_url = base_url or p.base_url
                        elif hasattr(llm_client, 'provider'):
                            api_key = llm_client.provider.api_key
                            base_url = base_url or llm_client.provider.base_url
                else:
                    # It's an LLMConfig object
                    dialect = getattr(agent.llm_config, 'dialect', None)
                    if not dialect:
                        self._agent_llm_clients[agent.name] = llm_client
                        continue
                    model = getattr(agent.llm_config, 'model', "")
                    api_key = getattr(agent.llm_config, 'api_key', "")
                    base_url = getattr(agent.llm_config, 'base_url', None)
                    temperature = getattr(agent.llm_config, 'temperature', 0.7)

                # Create LLM client for this agent based on their dialect
                from socialsim4.core.llm_config import LLMConfig
                from socialsim4.core.llm.client import LLMClient as AgentLLMClient

                config = LLMConfig(
                    dialect=dialect,
                    model=model,
                    api_key=api_key,
                    base_url=base_url,
                    temperature=temperature,
                )
                self._agent_llm_clients[agent.name] = AgentLLMClient(config)
                logger.debug(f"Created LLM client for {agent.name}: dialect={config.dialect}, model={config.model}")
            else:
                # Use default client for agents without explicit llm_config
                self._agent_llm_clients[agent.name] = llm_client

        logger.debug(f"Created {len(self.agents)} ExperimentAgents with LLM distribution")

        logger.debug(f"Created {len(self.agents)} ExperimentAgents")

        # Initialize experiment state only for fresh scenes.
        if not self.state.agents and not self.state.extensions and not self.state.history and self.state.round == 0:
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
            # Get show_average_contribution from parameters
            show_average = bool(params.get("show_average_contribution", False))
            information_model = InformationModel(
                scope_type="pair",
                pairing_fn=pair_agents_randomly,
                recent_window=information_model.recent_window,
                payoff_template="Round {N}: I {my_action}, partner {partner_action} → {payoff} pts",
                show_average_contribution=show_average,
            )

        # For games without score-based payoffs, ensure include_scores=False
        # This handles cases where scenario_id doesn't match registry exactly
        payoff_type = params.get("payoff_type", "matrix")
        show_average = bool(params.get("show_average_contribution", False))

        # CRITICAL: Always apply show_average_contribution if parameter is True
        if payoff_type in ("feedback", "none", "") and information_model.include_scores:
            information_model = InformationModel(
                scope_type=information_model.scope_type,
                scope_fn=information_model.scope_fn,
                pairing_fn=information_model.pairing_fn,
                recent_window=information_model.recent_window,
                primacy_keep=information_model.primacy_keep,
                context_budget_chars=information_model.context_budget_chars,
                payoff_template=information_model.payoff_template,
                include_scores=False,
                show_average_contribution=show_average,
            )
        elif show_average:
            # CRITICAL: Apply show_average_contribution even for normal payoff types
            # Recreate information_model with the parameter
            information_model = InformationModel(
                scope_type=information_model.scope_type,
                scope_fn=information_model.scope_fn,
                pairing_fn=information_model.pairing_fn,
                recent_window=information_model.recent_window,
                primacy_keep=information_model.primacy_keep,
                context_budget_chars=information_model.context_budget_chars,
                payoff_template=information_model.payoff_template,
                include_scores=information_model.include_scores,
                show_average_contribution=show_average,
            )

        # Create the runner
        self.runner = ExperimentRunner(
            agents=self.agents,
            game_config=self._create_game_config(),
            llm_client=llm_client,
            round_visibility=self.config.round_visibility,
            information_model=information_model,
            scene=self,  # GAP-CLOSURE-01: pass scene for action filtering
            agent_llm_clients=self._agent_llm_clients,  # Pass per-agent LLM clients
        )

        # Wire social network graph AND state to runner's scene_state
        # CRITICAL: Both graph and state are needed for show_average_contribution feature
        # - graph: defines network neighbors for visibility calculation
        # - state: contains agent properties including last_contribution
        scene_state_dict = {"state": self.state}
        if self.config.social_network:
            scene_state_dict["graph"] = self.config.social_network
            logger.debug(f"Social network set: {len(self.config.social_network.get('edges', []))} edges")
        else:
            logger.warning("No social network configured for this experiment")
        self.runner.set_scene_state(scene_state_dict)

        logger.debug(f"ExperimentRunner initialized:")
        logger.debug(f"  scenario_id={self.config.scenario_id}")
        logger.debug(f"  scope_type={information_model.scope_type}")
        logger.debug(f"  include_scores={information_model.include_scores}")
        logger.debug(f"  round_visibility={self.config.round_visibility}")
        logger.debug(f"  agents={len(self.agents)}")

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

        # Flush pending host messages into runner for this round
        if self._pending_host_messages:
            self.runner.pending_host_messages = list(self._pending_host_messages)
            self._pending_host_messages.clear()

        logger.info(f"Running round {round_num}")

        # Build context from history
        context_summary = self._build_context_summary()

        # Run the round
        result = await self.runner._run_single_round(
            round_num=round_num,
            context_summary=context_summary,
            round_history=self._history
        )

        round_events = {
            event.agent_name: event
            for event in self.runner.context_manager.get_round_events(round_num)
        }

        # Apply action effects to durable experiment state.
        for action in result.actions:
            if action.skipped:
                continue
            self.runner.execute_action(
                action.action_name,
                action.agent_name,
                action.parameters,
                self.state,
                self,  # Pass scene for council action handlers
            )

        # Update history for next round's context
        completed_actions = [action for action in result.actions if not action.skipped]

        history_entry: dict = {
            "round": round_num,
            "actions": [
                {
                    "agent": a.agent_name,
                    "action": a.action_name,
                    "parameters": a.parameters,
                    "summary": a.summary,
                    "feedback": round_events.get(a.agent_name).feedback if round_events.get(a.agent_name) else None,
                }
                for a in completed_actions
            ]
        }
        if result.payoffs:
            history_entry["payoffs"] = result.payoffs
        self._history.append(history_entry)
        self.state.round = round_num
        self.state.history.append(history_entry)
        for agent in self.agents:
            if agent.name not in self.state.agents:
                self.state.agents[agent.name] = AgentState()
            self.state.agents[agent.name].score = agent.score

        # Emit events for frontend
        for action in result.actions:
            payoff = result.payoffs.get(action.agent_name) if result.payoffs else None
            event_emitter("experiment_action", {
                "agent": action.agent_name,
                "action": action.action_name,
                "parameters": action.parameters,
                "summary": action.summary,
                "payoff": payoff,
                "round": round_num,
                "success": action.success,
                "skipped": action.skipped,
            })

        logger.info(f"Round {round_num} complete: {len(result.actions)} actions")

        # Phase transition hook for council scenes (FEAT-COUNCIL-02)
        # Check if scene has facilitator with check_and_transition_phase method
        if hasattr(self, 'facilitator') and hasattr(self.facilitator, 'check_and_transition_phase'):
            transitioned = self.facilitator.check_and_transition_phase(round_num)
            if transitioned:
                logger.info(f"Phase transitioned to VOTING after round {round_num}")

        return result

    def _initialize_state(self) -> None:
        """Initialize ExperimentState from config.

        Creates AgentState for each agent and applies state_schema extensions.
        Also initializes deduction budget if configured.

        Called during initialize() after agents are created.
        """
        params = self.config.parameters or {}

        # Get configurable resource name (default "tokens")
        resource_name = params.get("resource_name", "tokens")
        tokens_per_round = int(params.get("tokens_per_round", 20) or 20)
        deduction_budget = int(params.get("deduction_budget_per_phase", 0) or 0)

        # Create AgentState for each agent
        for agent_config in self.config.agents:
            name = agent_config.get("name", "")
            if not name:
                continue

            resources = deepcopy(agent_config.get("resources", {}))

            # Set initial resources using dynamic resource_name key
            if resource_name not in resources:
                resources[resource_name] = tokens_per_round

            # Add deduction budget if configured
            if deduction_budget > 0:
                resources["deduction_budget"] = deduction_budget

            agent_state = AgentState(
                score=0,
                position=agent_config.get("position"),
                resources=resources,
                properties=deepcopy(agent_config.get("properties", {})),
            )
            self.state.agents[name] = agent_state

        # Apply state_schema extensions
        if self.config.state_schema:
            if "extensions" in self.config.state_schema:
                self.state.extensions.update(deepcopy(self.config.state_schema["extensions"]))

        # Initialize reductions tracking in extensions (renamed from punishments)
        if "reductions" not in self.state.extensions:
            self.state.extensions["reductions"] = {}

        logger.debug(
            f"Initialized state for {len(self.state.agents)} agents "
            f"(resource_name={resource_name}, deduction_budget={deduction_budget})"
        )

    def _create_game_config(self) -> GameConfig:
        """Create GameConfig from config data."""
        params = self.config.parameters or {}
        scenario = None
        try:
            from socialsim4.core.scenarios.registry import get_scenario as _get_scenario
            scenario = _get_scenario(self.config.scenario_id)
        except Exception:
            scenario = None

        scenario_actions = scenario.get("actions", []) if scenario else []
        if not scenario_actions and scenario and scenario.get("category_actions"):
            category_actions = scenario.get("category_actions", [])
            default_action_ids = scenario.get("default_action_ids", [])
            if default_action_ids:
                scenario_actions = [
                    action for action in category_actions
                    if action.get("id") in default_action_ids
                ]
            else:
                scenario_actions = category_actions
        action_lookup = {}
        for action in scenario_actions:
            action_id = action.get("id")
            action_name = action.get("name")
            if action_id:
                action_lookup[str(action_id).lower()] = action
            if action_name:
                action_lookup[str(action_name).lower()] = action

        # Normalize selected actions back to canonical scenario action ids so runtime
        # semantics use stable machine names instead of frontend display labels.
        normalized_actions = []
        for action in self.config.actions:
            raw_name = str(action.get("name") or "").strip()
            if not raw_name:
                continue
            matched = action_lookup.get(raw_name.lower())
            if matched:
                normalized_actions.append(
                    {
                        "name": matched.get("id", raw_name),
                        "description": action.get("description") or matched.get("description") or raw_name,
                        # Use registry parameters if frontend doesn't provide them
                        "parameters": action.get("parameters") or matched.get("parameters", []),
                    }
                )
            else:
                normalized_actions.append(
                    {
                        "name": raw_name,
                        "description": action.get("description") or raw_name,
                        "parameters": action.get("parameters", []),
                    }
                )

        if not normalized_actions and scenario_actions:
            normalized_actions = [
                {
                    "name": action.get("id"),
                    "description": action.get("description") or action.get("name") or action.get("id"),
                    "parameters": action.get("parameters", []),
                }
                for action in scenario_actions
                if action.get("id")
            ]

        action_descriptions = {
            action["name"]: action["description"]
            for action in normalized_actions
            if action.get("name") and action.get("description")
        }
        action_names = [action["name"] for action in normalized_actions if action.get("name")]
        action_schemas = {}
        type_map = {
            "string": "string",
            "text": "string",
            "integer": "integer",
            "float": "number",
            "number": "number",
            "boolean": "boolean",
        }
        for action in normalized_actions:
            parameter_specs = action.get("parameters", [])
            if not parameter_specs:
                continue
            action_schemas[action["name"]] = {
                "schema": {
                    param["name"]: {
                        "type": type_map.get(param.get("type", "string"), "string"),
                        "description": param.get("description", param["name"]),
                    }
                    for param in parameter_specs
                },
                "mode": "json",
            }

        # Handle configurable choices for coordination games (e.g., coordination_game)
        if self.config.scenario_id in ("coordination_game", "graph_coloring"):
            choices_str = params.get("choices") or params.get("Choices") or "red, blue, green"
            action_names = [c.strip() for c in choices_str.split(",")]
            action_descriptions = {c: f"Choose {c}" for c in action_names}

        # Override action names/descriptions from parameterized action_1/action_2 if provided
        if params.get("action_1") and params.get("action_2"):
            a1 = params["action_1"]
            a2 = params["action_2"]
            action_names = [a1.lower(), a2.lower()]
            action_descriptions = {
                a1.lower(): a1,  # Use action name as description
                a2.lower(): a2,
            }

        # Build description: use description_template if present on the scenario
        # For PUBLIC_GOODS, we handle description in _build_payoff_summary instead
        description = self.config.description
        if self.config.scenario_id == "public_goods":
            # For PUBLIC_GOODS, description is handled entirely by _build_payoff_summary
            description = ""
        try:
            _scenario = scenario
            if _scenario and "description_template" in _scenario and params.get("action_1") and params.get("action_2"):
                description = _scenario["description_template"].format(
                    action_1=params["action_1"],
                    action_2=params["action_2"],
                )
        except Exception:
            pass

        # Build supplementary prompt text: payoff table + sociology params
        supplementary_parts = []
        payoff_text = self._build_payoff_summary()
        if payoff_text:
            supplementary_parts.append(payoff_text)
        params_text = self._build_params_section()
        if params_text:
            supplementary_parts.append(params_text)

        # Build payoff_config from scenario registry metadata
        payoff_config = {}
        scenario_id = self.config.scenario_id
        try:
            _scenario_for_payoff = scenario
            if _scenario_for_payoff and "matrix_meta" in _scenario_for_payoff:
                cells = _scenario_for_payoff["matrix_meta"].get("cells", {})
                # Remap matrix keys if action names were customized
                if params.get("action_1") and params.get("action_2"):
                    a1_key = params["action_1"].lower()
                    a2_key = params["action_2"].lower()
                    # Get the original action ids from registry actions
                    orig_actions = [a["id"] for a in _scenario_for_payoff.get("actions", [])]
                    if len(orig_actions) >= 2:
                        orig_a1, orig_a2 = orig_actions[0], orig_actions[1]
                        remapped = {}
                        for cell_key, cell_val in cells.items():
                            new_key = cell_key.replace(orig_a1, a1_key).replace(orig_a2, a2_key)
                            remapped[new_key] = cell_val
                        cells = remapped
                payoff_config = {"matrix": cells}
            if _scenario_for_payoff and _scenario_for_payoff.get("grouping_mode") == "group" and _scenario_for_payoff.get("payoff_type") == "matrix":
                _defaults = {p["id"]: p["default"] for p in _scenario_for_payoff.get("parameters", [])}
                if "stag_reward" in _defaults:
                    a1_key = params.get("action_1", "stag").lower()
                    payoff_config = {
                        "group_payoff_mode": "threshold",
                        "threshold_action": a1_key,
                        "threshold_reward": params.get("stag_reward", _defaults["stag_reward"]),
                        "threshold_failure": 0,
                        "safe_reward": params.get("hare_reward", _defaults["hare_reward"]),
                    }
            if _scenario_for_payoff and _scenario_for_payoff.get("payoff_type") == "pool":
                defaults = {p["id"]: p.get("default") for p in _scenario_for_payoff.get("parameters", [])}
                payoff_config = {
                    "multiplier": params.get("multiplier", defaults.get("multiplier", 1.6)),
                    "initial_tokens": params.get("tokens_per_round", defaults.get("tokens_per_round", 20)),
                }
            if _scenario_for_payoff and _scenario_for_payoff.get("payoff_type") == "feedback":
                defaults = {p["id"]: p.get("default") for p in _scenario_for_payoff.get("parameters", [])}
                payoff_config = {
                    "goal": params.get("goal", defaults.get("goal", "match")),
                }
        except Exception:
            pass

        followup_modes = self._get_action_followup_modes(action_names)

        # FEAT-PGG: Handle reduce action based on deduction_budget_per_phase
        # When budget > 0: ensure reduce action is available
        # When budget <= 0: remove reduce action
        deduction_budget = int(params.get("deduction_budget_per_phase", 0) or 0)
        if deduction_budget > 0:
            # Add reduce action when deduction is enabled
            if "reduce" not in action_names:
                action_names = action_names + ["reduce"]
                action_descriptions["reduce"] = "Reduce another agent's resources"
                if "reduce" not in followup_modes:
                    followup_modes["reduce"] = "json"
            logger.debug(f"[GAME_CONFIG] Added 'reduce' action (deduction_budget={deduction_budget})")
        else:
            # Remove reduce action when deduction is disabled
            if "reduce" in action_names:
                action_names = [a for a in action_names if a != "reduce"]
                action_descriptions.pop("reduce", None)
                action_schemas.pop("reduce", None)
                followup_modes.pop("reduce", None)
                logger.debug(f"[GAME_CONFIG] Filtered 'reduce' action (deduction_budget={deduction_budget})")

        logger.info(f"[GAME_CONFIG] scenario_id='{self.config.scenario_id}', action_names={action_names}, followup_modes={followup_modes}")

        return GameConfig(
            name=self.config.scenario_id,
            description=description,
            action_type="discrete",
            actions=action_names if action_names else ["cooperate", "defect"],
            action_descriptions=action_descriptions or None,
            payoff_summary="\n\n".join(supplementary_parts),
            output_field="action",
            payoff_type=params.get("payoff_type", (scenario or {}).get("payoff_type", "matrix")),
            grouping_mode=params.get("grouping_mode", (scenario or {}).get("grouping_mode", "pairwise")),
            cooperate_reward=params.get("cooperate_reward"),
            sucker_penalty=params.get("sucker_penalty"),
            temptation_reward=params.get("temptation_reward"),
            defect_penalty=params.get("defect_penalty"),
            payoff_config=payoff_config,
            action_schemas=action_schemas,
            # Actions that require follow-up reprompt for free-text input
            action_followup_modes=followup_modes,
        )

    def _get_action_followup_modes(self, action_names: list[str]) -> dict[str, str]:
        """Determine which actions require follow-up prompts.

        Discussion scenarios (council_chamber, open_discussion, werewolf, contagion)
        need plain_text follow-up for Speak actions.

        Fallback: Auto-detect speak-like actions for any scenario, including "custom".

        Args:
            action_names: List of action names in this scenario

        Returns:
            Dict mapping action names to follow-up modes ("plain_text" or "json")
        """
        followup_modes = {}

        # Scenarios where "Speak" action needs free-text message input
        discussion_scenarios = {
            "council_chamber",
            "open_discussion",
            "werewolf",
            "contagion",
        }

        logger.debug(f"[FOLLOWUP] scenario_id={self.config.scenario_id}, action_names={action_names}")
        logger.debug(f"[FOLLOWUP] is_discussion={self.config.scenario_id in discussion_scenarios}")

        if self.config.scenario_id in discussion_scenarios:
            # Map any speak-like action to plain_text mode
            for action_name in action_names:
                if action_name.lower() in ("speak", "say", "talk"):
                    followup_modes[action_name] = "plain_text"
                    logger.debug(f"[FOLLOWUP] Added followup mode for '{action_name}': plain_text")

        # Fallback: Auto-detect speak-like actions for any scenario
        # This handles "custom" scenarios that have speak actions
        for action_name in action_names:
            if action_name.lower() in ("speak", "say", "talk") and action_name not in followup_modes:
                followup_modes[action_name] = "plain_text"
                logger.info(f"[FOLLOWUP] Auto-detected speak action '{action_name}' (scenario_id={self.config.scenario_id})")

        logger.debug(f"[FOLLOWUP] Final followup_modes={followup_modes}")
        return followup_modes

    def _build_payoff_summary(self) -> str:
        """Build payoff_summary from scenario parameters - GENERIC version.

        Handles all game types:
        - PUBLIC_GOODS: Intertwined format with "person" language
        - Prisoner's Dilemma: Uses formatted payoff table
        - Other games: Generic parameter display
        """
        params = self.config.parameters
        logger.debug(f"[PAYOFF] parameters: {params}")

        if not params:
            logger.debug("[PAYOFF] No parameters, returning empty")
            return ""

        # PUBLIC_GOODS: Use intertwined format with "person" language
        if self.config.scenario_id == "public_goods":
            tokens_per_round = params.get("tokens_per_round", 10)
            resource_name = params.get("resource_name", "tokens")
            multiplier = params.get("multiplier", 1.3)
            num_members = len(self.agents) if self.agents else 4
            deduction_budget = params.get("deduction_budget_per_phase", 0)
            deduction_cost_ratio = params.get("deduction_cost_ratio", 3)
            deduction_anonymous = params.get("deduction_anonymous", False)

            # Build intertwined scenario description
            lines = [
                f"In this experiment, you receive {tokens_per_round} {resource_name} each round.",
                "Each person has resources and decides how much to contribute to a shared pool.",
                "The pool is multiplied and distributed equally among all members, regardless of contribution.",
                "",
                f"The total group contribution is multiplied by {multiplier} and distributed equally among all {num_members} members.",
                f"You keep any {resource_name} you do not allocate.",
            ]

            # Add deduction mechanics if enabled
            if deduction_budget and deduction_budget > 0:
                lines.append("")
                anonymity_text = (
                    "Your reductions are anonymous - targets will not know who reduced their resources."
                    if deduction_anonymous
                    else "Your reductions are visible - targets will see who reduced their resources."
                )
                lines.append(
                    f"After the contribution phase, you have the opportunity to reduce other members' {resource_name}. "
                    f"You have a deduction budget of {deduction_budget} points. "
                    f"For each 1 point from your budget, the target loses {deduction_cost_ratio} {resource_name}. "
                    f"{anonymity_text}"
                )

            return "\n".join(lines)

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

        elif scenario_id == "council":
            # GAP-CLOSURE-01: Include deliberation rounds info for council scenarios
            deliberation_rounds = params.get("deliberation_rounds")
            proposal_text = params.get("proposal_text", "")
            if proposal_text:
                lines.append(f"The proposal under discussion is: \"{proposal_text}\"")
            if deliberation_rounds is not None and deliberation_rounds > 0:
                lines.append(f"There will be {deliberation_rounds} round(s) of deliberation before voting begins.")
                lines.append("You cannot vote until the deliberation period is complete.")

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

    def get_pgg_phase(self) -> str:
        """Get current PGG phase.

        Returns:
            "allocate" or "deduct"
        """
        return self._pgg_phase

    def advance_pgg_phase(self) -> None:
        """Advance to next PGG phase.

        Cycles: allocate -> deduct -> allocate (next round) -> ...
        BUT: Skip deduct phase entirely if deduction_budget_per_phase is 0.

        This ensures every "advance" click runs a valid allocation round
        with proper actions, never an empty/null round.

        Note: Does NOT reset deduction budget here. Budget reset happens
        via _reset_deduction_budgets() when entering deduct phase to avoid
        spurious resets from initialization or state replay.
        """
        params = self.config.parameters or {}
        deduction_budget = params.get("deduction_budget_per_phase", 0)

        if self._pgg_phase == "allocate":
            # Only go to deduct phase if deduction is enabled
            if deduction_budget and deduction_budget > 0:
                self._pgg_phase = "deduct"
            else:
                # Skip deduct phase entirely - stay in allocate for next round
                pass  # Phase stays "allocate", round advances in run_round()
        else:
            self._pgg_phase = "allocate"

    def _reset_deduction_budgets(self) -> None:
        """Reset deduction budgets at start of deduct phase.

        Reads deduction_budget_per_phase from current config, so mid-run
        config changes will affect subsequent phases. Setting budget to 0
        clears any leftover budget from when it was enabled.

        Called by runner when entering deduct phase, NOT in advance_pgg_phase
        to avoid spurious resets during initialization or state replay.
        """
        params = self.config.parameters or {}
        budget = int(params.get("deduction_budget_per_phase", 0) or 0)

        for agent_state in self.state.agents.values():
            agent_state.resources["deduction_budget"] = budget

        logger.debug(f"Reset deduction budgets to {budget} for {len(self.state.agents)} agents")

    def get_scene_actions(self, agent_name: str) -> list[str] | None:
        """Filter available actions by current PGG phase.

        For PUBLIC_GOODS scenario, returns phase-appropriate actions.
        For other scenarios, returns None (caller should use all configured actions).

        Args:
            agent_name: Name of agent (for future per-agent filtering)

        Returns:
            List of action names available in current phase, or None if
            no filtering should be applied (use all configured actions).
        """
        if self.config.scenario_id != "public_goods":
            return None  # None = no filtering, use all configured actions

        current_phase = self._pgg_phase
        params = self.config.parameters or {}
        deduction_budget = params.get("deduction_budget_per_phase", 0)

        logger.info(f"[PGG] get_scene_actions called: phase={current_phase}, deduction_budget={deduction_budget}")

        if current_phase == "allocate":
            return ["allocate", "keep"]
        else:  # deduct phase
            # Only show reduce/skip if deduction is enabled
            if deduction_budget and deduction_budget > 0:
                return ["reduce", "skip"]
            # SAFETY: If we somehow reach deduct phase with no budget,
            # return None to use all configured actions (shouldn't happen with advance_pgg_phase fix)
            logger.warning(f"[PGG] Deduct phase reached but deduction_budget={deduction_budget} <= 0, returning None as fallback")
            return None  # None = use all configured actions (safety fallback)

    def inject_host_message(self, message: str) -> None:
        """Queue a host message to be injected into all agents' context on the next round."""
        self._pending_host_messages.append(message)

    def serialize_config(self) -> dict:
        """Serialize for SimTree persistence."""
        return {
            "config": {
                "agents": self.config.agents,
                "actions": self.config.actions,
                "parameters": self.config.parameters,
                "state_schema": self.config.state_schema,
                "description": self.config.description,
                "scenario_id": self.config.scenario_id,
                "round_visibility": self.config.round_visibility,
                "social_network": self.config.social_network,
            },
            "current_round": self.current_round,
            "history": self._history,
            "state": self.state.to_dict(),
            "pending_host_messages": self._pending_host_messages,
            "pgg_phase": self._pgg_phase,
        }

    @classmethod
    def deserialize_config(cls, data: dict) -> "ExperimentScene":
        """Restore from serialized state."""
        config = ExperimentConfig(**data["config"])
        scene = cls(config)
        scene.current_round = data.get("current_round", 0)
        scene._history = data.get("history", [])
        if data.get("state") is not None:
            scene.state = ExperimentState.from_dict(data["state"])
        scene._pending_host_messages = data.get("pending_host_messages", [])
        # Restore PGG phase state (defaults to "allocate" for backwards compatibility)
        scene._pgg_phase = data.get("pgg_phase", "allocate")
        return scene
