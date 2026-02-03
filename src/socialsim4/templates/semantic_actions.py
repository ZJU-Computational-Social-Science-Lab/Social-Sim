"""
Semantic Action System for User-Defined Actions.

Semantic actions are custom actions defined by users in template JSON.
Unlike core actions (coded in Python), semantic actions are defined
declaratively with an instruction, parameters, and optional effect code.
"""

from socialsim4.core.action import Action


class SemanticAction(Action):
    """
    A user-defined semantic action that uses LLM-driven behavior.

    Attributes:
        name: Action identifier (e.g., "pray")
        description: Human-readable description of what the action does
        instruction: Tells the LLM when/why to use the action
        parameters: Dict mapping parameter names to their descriptions
        effect_code: Optional Python code string for side effects
    """

    def __init__(self, name, description, instruction="", parameters=None, effect_code=None):
        """
        Initialize a SemanticAction.

        Args:
            name: Action identifier
            description: Human-readable description
            instruction: When/why to use this action (default: "")
            parameters: Dict of {param_name: param_description} or None
            effect_code: Optional Python code string for side effects
        """
        self._name = name
        self._description = description
        self._instruction = instruction or ""
        self._parameters = parameters or {}
        self._effect_code = effect_code

    @property
    def NAME(self):
        """Return the action name."""
        return self._name

    @property
    def DESC(self):
        """Return the action description."""
        return self._description

    @property
    def INSTRUCTION(self):
        """
        Generate compact XML format instruction for 4B models.

        Format:
        - pray: Pray at the shrine
          Use when seeking spiritual guidance
          <Action name="pray"><deity>deity</deity></Action>
        """
        # Build XML template with parameters
        if self._parameters:
            params_xml = "".join(
                f"<{param}>{param}</{param}>" for param in self._parameters.keys()
            )
            xml_template = f'<Action name="{self._name}">{params_xml}</Action>'
        else:
            xml_template = f'<Action name="{self._name}"/>'

        # Build compact instruction format
        lines = [
            f"- {self._name}: {self._description}",
        ]
        if self._instruction:
            lines.append(f"  {self._instruction}")
        lines.append(f"  {xml_template}")

        return "\n".join(lines)

    @property
    def parameters(self):
        """Return the parameters dict."""
        return self._parameters

    @property
    def effect_code(self):
        """Return the effect code string."""
        return self._effect_code

    def handle(self, action_data, agent, simulator, scene):
        """
        Execute the semantic action.

        Extracts parameters from action_data and executes effect_code if provided.

        Args:
            action_data: Dict containing parsed XML parameters
            agent: The agent performing the action
            simulator: The simulator instance
            scene: The current scene

        Returns:
            5-tuple: (success: bool, result: dict, summary: str, meta: dict, pass_control: bool)
        """
        # Extract parameters from action_data
        extracted_params = {}
        for param_name in self._parameters.keys():
            value = action_data.get(param_name)
            if value is not None:
                extracted_params[param_name] = value

        # Execute effect_code if provided
        effect_result = None
        if self._effect_code:
            try:
                # Restricted globals for safe exec
                safe_globals = {
                    "__builtins__": {
                        "print": print,
                        "len": len,
                        "str": str,
                        "int": int,
                        "float": float,
                        "bool": bool,
                        "list": list,
                        "dict": dict,
                        "set": set,
                        "tuple": tuple,
                        "range": range,
                        "enumerate": enumerate,
                        "zip": zip,
                        "sum": sum,
                        "min": min,
                        "max": max,
                        "abs": abs,
                        "round": round,
                    }
                }
                # Local context for the effect code
                safe_locals = {
                    "agent": agent,
                    "simulator": simulator,
                    "scene": scene,
                    "params": extracted_params,
                    "action_data": action_data,
                }
                exec(self._effect_code, safe_globals, safe_locals)
                effect_result = safe_locals.get("result")
            except Exception as e:
                error_msg = f"Effect code execution failed: {e}"
                agent.add_env_feedback(error_msg)
                return False, {"error": error_msg}, f"{agent.name} failed {self._name}", {}, False

        # Build result
        result = {"params": extracted_params}
        if effect_result is not None:
            result["effect_result"] = effect_result

        # Build summary
        if extracted_params:
            params_str = ", ".join(f"{k}={v}" for k, v in extracted_params.items())
            summary = f"{agent.name} {self._name}({params_str})"
        else:
            summary = f"{agent.name} {self._name}"

        return True, result, summary, {}, False


class SemanticActionFactory:
    """
    Factory class for creating and managing semantic actions.

    Provides a registry for semantic actions and methods to create
    actions from configuration dictionaries.
    """

    _actions = {}  # Registry of action_name -> SemanticAction

    @classmethod
    def register(cls, action):
        """
        Register a semantic action in the factory.

        Args:
            action: A SemanticAction instance to register

        Returns:
            The registered action for chaining
        """
        if not isinstance(action, SemanticAction):
            raise TypeError(f"Expected SemanticAction, got {type(action)}")
        cls._actions[action.NAME] = action
        return action

    @classmethod
    def create_from_config(cls, config):
        """
        Create a SemanticAction from a configuration dictionary.

        Args:
            config: Dict with keys:
                - name (str): Action identifier
                - description (str): Human-readable description
                - instruction (str): When/why to use the action
                - parameters (dict, optional): {param_name: param_description}
                - effect (str, optional): Python code for side effects

        Returns:
            A new SemanticAction instance
        """
        if not isinstance(config, dict):
            raise TypeError(f"Config must be a dict, got {type(config)}")

        name = config.get("name")
        if not name:
            raise ValueError("Config must include 'name'")

        description = config.get("description", "")
        instruction = config.get("instruction", "")
        parameters = config.get("parameters")
        effect_code = config.get("effect")

        action = SemanticAction(
            name=name,
            description=description,
            instruction=instruction,
            parameters=parameters,
            effect_code=effect_code,
        )
        return cls.register(action)

    @classmethod
    def get_action(cls, name):
        """
        Retrieve a registered action by name.

        Args:
            name: The action identifier

        Returns:
            The SemanticAction instance or None if not found
        """
        return cls._actions.get(name)

    @classmethod
    def list_actions(cls):
        """
        List all registered action names.

        Returns:
            List of action names (strings)
        """
        return list(cls._actions.keys())

    @classmethod
    def clear(cls):
        """Clear all registered actions (useful for testing)."""
        cls._actions.clear()
