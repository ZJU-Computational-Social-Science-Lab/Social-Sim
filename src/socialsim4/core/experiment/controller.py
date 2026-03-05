"""
Experiment Controller - validates LLM responses and executes actions (Layer 3).

The controller implements the validation layer:
1. Parse JSON (Layer 1 guarantees valid JSON)
2. Check action is in allowed set
3. Re-prompt for missing parameters if needed
4. Validate parameters
5. Execute action via Kernel
"""

import asyncio
import json
import logging
import sys
from dataclasses import dataclass
from typing import Dict, Any, Literal, Optional
from pathlib import Path
from datetime import datetime

from socialsim4.core.experiment.agent import ExperimentAgent
from socialsim4.core.experiment.game_configs import GameConfig
from socialsim4.core.experiment.kernel import ExperimentKernel, ExperimentAction
from socialsim4.core.experiment.round_context import RoundContextManager
from socialsim4.core.experiment.schema_builder import build_schema
from socialsim4.core.experiment.prompt_builder import build_reprompt
from socialsim4.core.experiment.validation import (
    strip_markdown_fences,
    strip_think_tags,
    validate_and_clamp,
    extract_json,
)
from socialsim4.core.llm.client import LLMClient


logger = logging.getLogger(__name__)

# Debug file for full prompts/responses (shared with runner)
_debug_dir = Path("test_results")
_debug_dir.mkdir(exist_ok=True)
# Find the most recent debug file from runner
_debug_files = sorted(_debug_dir.glob("experiment_debug_*.txt"), key=lambda x: x.stat().st_mtime, reverse=True)
_debug_file = _debug_files[0] if _debug_files else _debug_dir / "experiment_debug.txt"


def _get_current_debug_file() -> Path:
    """Get the most recent debug file, creating a new one if needed."""
    global _debug_file
    files = sorted(_debug_dir.glob("experiment_debug_*.txt"), key=lambda x: x.stat().st_mtime, reverse=True)
    if files:
        _debug_file = files[0]
    else:
        _debug_file = _debug_dir / f"experiment_debug_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    return _debug_file


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
        debug_file = _get_current_debug_file()

        # Write to debug file
        with open(debug_file, 'a', encoding='utf-8') as f:
            f.write(f"\n--- CONTROLLER: Processing Response ---\n")
            f.write(f"  agent: {agent.name}\n")
            f.write(f"  output_field: {game_config.output_field}\n")
            f.write(f"  allowed actions: {game_config.actions}\n")

        print(f"\n[CONTROLLER] Processing response from {agent.name}")

        # Step 1: Extract and parse JSON (handles trailing content from some models)
        cleaned = extract_json(raw_json)

        # If the model prepends junk before the first JSON object, trim to the
        # outermost braces to keep parsing strict while tolerating prefixes.
        if "{" in cleaned and "}" in cleaned:
            start = cleaned.find("{")
            end = cleaned.rfind("}")
            if start != -1 and end != -1 and end > start:
                cleaned = cleaned[start:end + 1]

        with open(debug_file, 'a', encoding='utf-8') as f:
            f.write(f"  cleaned JSON: {cleaned[:200]}...\n" if len(cleaned) > 200 else f"  cleaned JSON: {cleaned}\n")

        try:
            parsed = json.loads(cleaned)

            with open(debug_file, 'a', encoding='utf-8') as f:
                f.write(f"  parsed OK: {parsed}\n")

            print(f"[CONTROLLER] Parsed OK, action={parsed.get(game_config.output_field)}")
        except json.JSONDecodeError as e:
            # Try to salvage the first JSON-looking object in the text.
            import re
            match = re.search(r'\{[^{}]*\}', cleaned, re.DOTALL)
            if match:
                candidate = match.group(0)
                try:
                    parsed = json.loads(candidate)
                    with open(debug_file, 'a', encoding='utf-8') as f:
                        f.write(f"  parsed via salvage: {parsed}\n")
                    print(f"[CONTROLLER] Parsed via salvage, action={parsed.get(game_config.output_field)}")
                except json.JSONDecodeError as e2:
                    with open(debug_file, 'a', encoding='utf-8') as f:
                        f.write(f"  ERROR: Failed to parse JSON after salvage: {e2}\n")
                    print(f"[CONTROLLER] ERROR: Failed to parse JSON after salvage")
                    logger.error(f"Failed to parse JSON from {agent.name}: {e2}")
                    return ActionResult(
                        success=False,
                        action_name="",
                        parameters={},
                        summary="",
                        agent_name=agent.name,
                        round_num=round_num,
                        skipped=True,
                        error=f"Invalid JSON: {e2}"
                    )
            else:
                with open(debug_file, 'a', encoding='utf-8') as f:
                    f.write(f"  ERROR: Failed to parse JSON: {e}\n")
                print(f"[CONTROLLER] ERROR: Failed to parse JSON")
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
            with open(debug_file, 'a', encoding='utf-8') as f:
                f.write(f"  ERROR: Validation failed - action not in allowed set\n")
                f.write(f"  parsed action field: {parsed.get(game_config.output_field, '')}\n")
            print(f"[CONTROLLER] ERROR: Validation failed")
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

        with open(debug_file, 'a', encoding='utf-8') as f:
            f.write(f"  extracted action: {action_value}\n")

        print(f"[CONTROLLER] Extracted action: {action_value}")
        summary = f"{agent.name} chose {action_value}"

        return ActionResult(
            success=True,
            action_name=action_value,
            parameters={},
            summary=summary,
            agent_name=agent.name,
            round_num=round_num,
            skipped=False
        )

    async def process_response_with_followup(
        self,
        raw_json: str,
        agent: ExperimentAgent,
        game_config: GameConfig,
        llm_client: LLMClient,
        round_num: int,
        action_schemas: Optional[Dict[str, Dict[str, Any]]] = None
    ) -> ActionResult:
        """Process an LLM response with potential follow-up prompt for parameters.

        This method extends process_response to handle actions that require
        additional parameters (like 'talk' which needs a message).

        Args:
            raw_json: Raw JSON string from LLM
            agent: Agent who generated the response
            game_config: Game configuration
            llm_client: LLM client (for re-prompting)
            round_num: Current round number
            action_schemas: Dict mapping action names to their parameter schemas

        Returns:
            ActionResult with outcome
        """
        # First, process normally
        initial_result = await self.process_response(
            raw_json, agent, game_config, llm_client, round_num
        )

        # If initial processing failed, return the error
        if not initial_result.success:
            return initial_result

        action_name = initial_result.action_name
        debug_file = _get_current_debug_file()

        # Check if this action requires a follow-up prompt.
        # action_schemas format: {action_name: {"schema": param_schema, "mode": "json"|"plain_text"}}
        if action_schemas and action_name in action_schemas:
            schema_info = action_schemas[action_name]
            # Support both flat {param: schema} and wrapped {"schema": ..., "mode": ...} formats
            if "schema" in schema_info:
                param_schema = schema_info["schema"]
                followup_mode = schema_info.get("mode", "json")
            else:
                param_schema = schema_info
                followup_mode = "json"

            with open(debug_file, 'a', encoding='utf-8') as f:
                f.write(f"\n{'='*80}\n")
                f.write(f"FOLLOW-UP PROMPT REQUIRED\n")
                f.write(f"{'='*80}\n")
                f.write(f"  action: {action_name}\n")
                f.write(f"  mode: {followup_mode}\n")
                f.write(f"  required params: {list(param_schema.keys())}\n")

            print(f"\n[CONTROLLER] Action '{action_name}' requires follow-up prompt (mode={followup_mode})")

            # Get context for follow-up
            context = self.context_manager.get_context(agent.name)

            # Build follow-up prompt using the action's parameter mode
            followup_prompt = build_reprompt(
                agent=agent,
                game_config=game_config,
                context_summary=context,
                chosen_action=action_name,
                parameter_schema=param_schema,
                mode=followup_mode,
                include_section_markers=True
            )

            # Log the follow-up prompt
            with open(debug_file, 'a', encoding='utf-8') as f:
                f.write(f"\n--- FOLLOW-UP PROMPT ---\n")
                f.write(followup_prompt)
                f.write(f"\n--- END FOLLOW-UP PROMPT ---\n\n")

            print(f"[CONTROLLER] Sending follow-up prompt to {agent.name}")

            try:
                # Send follow-up prompt; use json_mode only for json-type follow-ups
                messages = [{"role": "user", "content": followup_prompt}]
                followup_response = await asyncio.to_thread(
                    llm_client.chat, messages, json_mode=(followup_mode == "json")
                )

                # Log the follow-up response
                with open(debug_file, 'a', encoding='utf-8') as f:
                    f.write(f"\n{'='*80}\n")
                    f.write(f"FOLLOW-UP RESPONSE\n")
                    f.write(f"{'='*80}\n\n")
                    f.write(followup_response)
                    f.write(f"\n\n{'='*80}\n\n")

                print(f"[CONTROLLER] Received follow-up response from {agent.name}")

                # Parse the follow-up response based on mode
                if followup_mode == "plain_text":
                    # Plain text response (e.g., Speak action): store the whole string as "message"
                    parameters = {"message": followup_response.strip()}
                else:
                    # JSON response: parse and extract expected parameters
                    cleaned = extract_json(followup_response)
                    parsed_followup = json.loads(cleaned)
                    parameters = {k: parsed_followup.get(k) for k in param_schema.keys() if k in parsed_followup}

                # Update summary with parameters
                param_str = ", ".join(f"{k}={v}" for k, v in parameters.items())
                summary = f"{agent.name} chose {action_name} ({param_str})"

                return ActionResult(
                    success=True,
                    action_name=action_name,
                    parameters=parameters,
                    summary=summary,
                    agent_name=agent.name,
                    round_num=round_num,
                    skipped=False
                )

            except Exception as e:
                with open(debug_file, 'a', encoding='utf-8') as f:
                    f.write(f"\n  ERROR in follow-up: {e}\n")
                print(f"[CONTROLLER] ERROR in follow-up: {e}")
                logger.error(f"Follow-up prompt failed for {agent.name}: {e}")
                # Return the initial result without parameters
                return initial_result

        # No follow-up needed
        return initial_result
