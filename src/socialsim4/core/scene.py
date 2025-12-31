from socialsim4.core.actions.base_actions import YieldAction
from socialsim4.core.agent import Agent
from socialsim4.core.event import PublicEvent
from socialsim4.core.simulator import Simulator


class Scene:
    TYPE = "scene"

    def __init__(self, name, initial_event):
        self.name = name
        self.initial_event = PublicEvent(initial_event)
        self.state = {"time": 1080}
        # Default timekeeping: minutes since 0. Scenes can adjust per-turn minutes.
        self.minutes_per_turn = 3

    def get_scenario_description(self):
        return ""

    def get_behavior_guidelines(self):
        return ""

    def get_output_format(self):
        # Format instructions are now injected by Agent.get_output_format().
        # Scenes can override this if they need scene-specific format additions.
        return ""

    def get_examples(self):
        return ""

    def parse_and_handle_action(self, action_data, agent: Agent, simulator: Simulator):
        action_name = action_data.get("action")
        print(f"Action Space({agent.name}):", agent.action_space)
        for act in agent.action_space:
            if act.NAME == action_name:
                success, result, summary, meta, pass_control = act.handle(action_data, agent, simulator, self)
                return success, result, summary, meta, bool(pass_control)
        return False, {}, None, {}, False

    def deliver_message(self, event, sender: Agent, simulator: Simulator):
        """Deliver a chat message event. Default behavior is global broadcast
        to all agents except the sender. Scenes can override to restrict scope
        (e.g., proximity-based chat in map scenes).
        """
        # Ensure the sender also retains what they said in their own context
        formatted = event.to_string(self.state.get("time"))
        sender.add_env_feedback(formatted)
        # Broadcast to everyone else and record the event
        simulator.broadcast(event)

    def pre_run(self, simulator: Simulator):
        pass

    def post_turn(self, agent: Agent, simulator: Simulator):
        """Hook after a single agent finishes their turn.
        Default: advance scene time by minutes_per_turn.
        Scenes can override for custom timekeeping.
        """
        cur = int(self.state.get("time") or 0)
        self.state["time"] = cur + int(getattr(self, "minutes_per_turn", 0) or 0)

    def should_skip_turn(self, agent: Agent, simulator: Simulator) -> bool:
        """Whether to skip this agent's action processing for this turn. Default: False."""
        return False

    def is_complete(self):
        return False

    def log(self, message):
        time_str = f"[{self.state.get('time', 0) % 24}:00] "
        print(f"{time_str}{message}")

    def get_agent_status_prompt(self, agent: Agent) -> str:
        """Generates a status prompt for a given agent based on the scene's state."""
        return ""

    def initialize_agent(self, agent: Agent):
        """Initializes an agent with scene-specific properties."""
        pass

    def get_scene_actions(self, agent: Agent):
        """Return a list of Action instances this scene enables for the agent.
        Default: provide a basic yield action so agents can always end their turn.
        Scenes may extend by calling super().get_scene_actions(agent).
        """
        return [YieldAction()]

    # For ControlledOrdering reconstruction after deserialize
    def get_controlled_next(self, simulator: "Simulator") -> str | None:
        return None

    def serialize(self):
        # Unified serialization shape with scene-specific config under "config"
        return {
            "type": getattr(self, "TYPE", "scene"),
            "name": self.name,
            "initial_event": self.initial_event.content,
            "state": self.state,
            "config": self.serialize_config(),
        }

    @classmethod
    def deserialize(cls, data):
        # Unified deserialization using scene-specific config hook
        name = data["name"]
        initial_event = data["initial_event"]
        config = data.get("config", {})
        init_kwargs = cls.deserialize_config(config)
        scene = cls(name, initial_event, **init_kwargs)
        scene.state = data.get("state", {})
        return scene

    # ----- Serialization hooks for subclasses -----
    def serialize_config(self) -> dict:
        """Return scene-specific configuration (non-state) for serialization.
        Subclasses override to include their own immutable config.
        """
        return {}

    @classmethod
    def deserialize_config(cls, config: dict) -> dict:
        """Parse config dict and return kwargs for the class constructor.
        Subclasses override to map config -> __init__ kwargs.
        """
        return {}
