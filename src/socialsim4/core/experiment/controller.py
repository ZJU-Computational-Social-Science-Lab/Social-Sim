"""
Experiment Controller - validates LLM responses and executes actions (Layer 3).

The controller implements the validation layer:
1. Parse JSON (Layer 1 guarantees valid JSON)
2. Check action is in allowed set
3. Re-prompt for missing parameters if needed
4. Validate parameters
5. Execute action via Kernel
"""

import json
import logging
from dataclasses import dataclass
from typing import Dict, Any, Literal, Optional

from socialsim4.core.experiment.agent import ExperimentAgent
from socialsim4.core.experiment.game_configs import GameConfig
from socialsim4.core.experiment.kernel import ExperimentKernel, ExperimentAction
from socialsim4.core.experiment.round_context import RoundContextManager
from socialsim4.core.experiment.schema_builder import build_schema
from socialsim4.core.experiment.validation import (
    strip_markdown_fences,
    strip_think_tags,
    validate_and_clamp,
)
from socialsim4.core.llm.client import LLMClient


logger = logging.getLogger(__name__)


@dataclass
class ActionResult:
    """Result of processing an LLM action response.

    Attributes:
        success: Whether the action executed successfully
        action_name: Name of the action taken
        parameters: Action parameters (if any)
        summary: One-line human-readable summary
        agent_name: Agent who performed the action
        round_num: Round number
        skipped: True if validation failed and turn was skipped
        error: Error message if skipped
    """
    success: bool
    action_name: str
    parameters: Dict[str, Any]
    summary: str
    agent_name: str
    round_num: int
    skipped: bool = False
    error: str = ""


class ExperimentController:
    """Controller for processing LLM responses with validation.

    Implements Layer 3 of the Three-Layer Architecture:
    - Validates action is in allowed set
    - Re-prompts for missing parameters (max 1)
    - Validates parameter types and values
    - Executes actions via Kernel
    """

    def __init__(
        self,
        kernel: ExperimentKernel,
        context_manager: RoundContextManager
    ):
        """Initialize controller.

        Args:
            kernel: Action registry
            context_manager: Context tracking manager
        """
        self.kernel = kernel
        self.context_manager = context_manager

    async def process_response(
        self,
        raw_json: str,
        agent: ExperimentAgent,
        game_config: GameConfig,
        llm_client: LLMClient,
        round_num: int
    ) -> ActionResult:
        """Process an LLM response through validation and execution.

        Args:
            raw_json: Raw JSON string from LLM
            agent: Agent who generated the response
            game_config: Game configuration
            llm_client: LLM client (for re-prompting)
            round_num: Current round number

        Returns:
            ActionResult with outcome
        """
        # Step 1: Clean and parse JSON
        cleaned = strip_think_tags(strip_markdown_fences(raw_json))
        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON from {agent.name}: {e}")
            return ActionResult(
                success=False,
                action_name="",
                parameters={},
                summary="",
                agent_name=agent.name,
                round_num=round_num,
                skipped=True,
                error=f"Invalid JSON: {e}"
            )

        # Step 2: Validate against game config
        validated = validate_and_clamp(parsed, game_config)
        if validated is None:
            logger.error(f"Validation failed for {agent.name}: {parsed}")
            return ActionResult(
                success=False,
                action_name=parsed.get(game_config.output_field, ""),
                parameters={},
                summary="",
                agent_name=agent.name,
                round_num=round_num,
                skipped=True,
                error="Action not in allowed set"
            )

        # Step 3: Extract action
        action_value = validated.get(game_config.output_field)
        summary = f"{agent.name} chose {action_value}"

        # Step 4: Record in context
        self.context_manager.record_action(
            agent_name=agent.name,
            action_name=action_value,
            parameters={},
            round_num=round_num,
            summary=summary
        )

        return ActionResult(
            success=True,
            action_name=action_value,
            parameters={},
            summary=summary,
            agent_name=agent.name,
            round_num=round_num,
            skipped=False
        )
