"""
Experiment Kernel - central action registry for experiment platform.

The kernel provides a single place to register and retrieve action types.
Researchers select action types in the GUI, and the kernel instantiates them.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Literal, Optional
from dataclasses import dataclass


class ExperimentAction(ABC):
    """Base class for all experiment actions.

    Each action type defines:
    - How to collect parameters (json vs plain_text mode)
    - How to validate parameters
    - How to execute the action
    """

    @classmethod
    @abstractmethod
    def name(cls) -> str:
        """Return the action name."""
        pass

    @classmethod
    @abstractmethod
    def description(cls) -> str:
        """Return the action description for the prompt."""
        pass

    @classmethod
    def parameter_schema(cls) -> Dict[str, Any]:
        """Return JSON schema for parameters (empty if no parameters)."""
        return {}

    @classmethod
    def parameter_mode(cls) -> Literal["json", "plain_text"]:
        """How to collect parameters: json (structured) or plain_text (freeform)."""
        return "json"

    @abstractmethod
    def execute(self, agent_name: str, parameters: Dict[str, Any], context: Dict[str, Any]) -> str:
        """Execute the action and return a one-line summary.

        Args:
            agent_name: Name of the agent performing the action
            parameters: Validated parameters from LLM
            context: Experiment context (other agents, round, etc.)

        Returns:
            One-line human-readable summary
        """
        pass


# ============================================================================
# Built-in Action Types
# ============================================================================

class ChoiceAction(ExperimentAction):
    """Simple discrete choice with no parameters."""

    def __init__(self, choice_name: str, choice_description: str):
        self.choice_name = choice_name
        self.choice_description = choice_description

    @classmethod
    def name(cls) -> str:
        return "choice"

    @classmethod
    def description(cls) -> str:
        return "Make a discrete choice from available options"

    def execute(self, agent_name: str, parameters: Dict[str, Any], context: Dict[str, Any]) -> str:
        return f"{agent_name} chose {self.choice_name}"


class SpeakAction(ExperimentAction):
    """Speak action with freeform message content (plain_text mode)."""

    @classmethod
    def name(cls) -> str:
        return "speak"

    @classmethod
    def description(cls) -> str:
        return "Say something to the group"

    @classmethod
    def parameter_schema(cls) -> Dict[str, Any]:
        return {
            "message": {
                "type": "string",
                "description": "What you want to say"
            }
        }

    @classmethod
    def parameter_mode(cls) -> Literal["json", "plain_text"]:
        return "plain_text"

    def execute(self, agent_name: str, parameters: Dict[str, Any], context: Dict[str, Any]) -> str:
        message = parameters.get("message", "")
        return f'{agent_name}: "{message}"'


class VoteAction(ExperimentAction):
    """Vote action with target parameter (json mode)."""

    @classmethod
    def name(cls) -> str:
        return "vote"

    @classmethod
    def description(cls) -> str:
        return "Vote for an option or person"

    @classmethod
    def parameter_schema(cls) -> Dict[str, Any]:
        return {
            "target": {
                "type": "string",
                "description": "Who or what you're voting for"
            }
        }

    def execute(self, agent_name: str, parameters: Dict[str, Any], context: Dict[str, Any]) -> str:
        target = parameters.get("target", "")
        return f"{agent_name} voted for {target}"


class NumericalAction(ExperimentAction):
    """Numerical estimate/action (integer range)."""

    @classmethod
    def name(cls) -> str:
        return "numerical"

    @classmethod
    def description(cls) -> str:
        return "Provide a numerical value"

    @classmethod
    def parameter_schema(cls) -> Dict[str, Any]:
        return {
            "value": {
                "type": "integer",
                "description": "Your numerical choice"
            }
        }

    def execute(self, agent_name: str, parameters: Dict[str, Any], context: Dict[str, Any]) -> str:
        value = parameters.get("value", 0)
        return f"{agent_name} chose {value}"


# ============================================================================
# Experiment Kernel
# ============================================================================

class ExperimentKernel:
    """Central registry for experiment action types.

    The kernel allows researchers to select action types in the GUI.
    New action types are registered once and become available everywhere.
    """

    _action_registry: Dict[str, type[ExperimentAction]] = {}

    @classmethod
    def register(cls, name: str, action_class: type[ExperimentAction]) -> None:
        """Register a new action type.

        Args:
            name: Action name (used in templates/GUI)
            action_class: Action class to register
        """
        cls._action_registry[name] = action_class

    @classmethod
    def get_action(cls, name: str) -> Optional[type[ExperimentAction]]:
        """Get an action class by name."""
        return cls._action_registry.get(name)

    @classmethod
    def get_available_actions(cls, scenario_actions: List[Dict[str, Any]]) -> List[ExperimentAction]:
        """Build action list from scenario template.

        Args:
            scenario_actions: List of action dicts from template
                [{"name": "cooperate", "type": "choice", "description": "..."}]

        Returns:
            List of instantiated action objects
        """
        actions = []
        for action_def in scenario_actions:
            action_type = action_def.get("type", "choice")
            action_class = cls.get_action(action_type)
            if action_class:
                # Instantiate with action-specific config
                action = action_class(**action_def.get("config", {}))
                actions.append(action)
        return actions

    @classmethod
    def needs_parameters(cls, action_name: str) -> bool:
        """Check if an action requires parameters."""
        action_class = cls.get_action(action_name)
        if not action_class:
            return False
        return bool(action_class.parameter_schema())


# Register built-in action types at module load
ExperimentKernel.register("choice", ChoiceAction)
ExperimentKernel.register("speak", SpeakAction)
ExperimentKernel.register("vote", VoteAction)
ExperimentKernel.register("numerical", NumericalAction)
