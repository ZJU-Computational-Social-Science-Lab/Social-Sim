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

    def get_compact_description(self):
        """Compact description for 4B models. Override in subclasses."""
        return self.get_scenario_description()

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

    def _get_recipients_by_social_network(
        self, sender: Agent, simulator: Simulator
    ) -> list[str]:
        """
        根据社交网络拓扑获取消息接收者列表。
        如果未配置社交网络，返回所有Agent（全局广播的默认行为）。
        如果配置了社交网络，只返回与发送者连接的Agent。
        """
        social_network = self.state.get("social_network")
        if not social_network or not isinstance(social_network, dict):
            # 没有配置社交网络，返回所有Agent（全局广播）
            return [a.name for a in simulator.agents.values() if a.name != sender.name]

        # 获取发送者的连接列表
        sender_connections = social_network.get(sender.name, [])
        if not isinstance(sender_connections, list):
            sender_connections = []

        # 只返回在连接列表中的Agent，且确实存在于simulator中
        recipients = []
        for agent_name in sender_connections:
            if agent_name in simulator.agents and agent_name != sender.name:
                recipients.append(agent_name)

        return recipients

    def deliver_message(self, event, sender: Agent, simulator: Simulator):
        """Deliver a chat message event. Default behavior is global broadcast
        to all agents except the sender. Scenes can override to restrict scope
        (e.g., proximity-based chat in map scenes).

        If social_network is configured in scene.state, messages will only be
        delivered to connected agents.
        """
        event.code = "scene_chat"
        event.params = {"sender": sender.name, "message": event.message}

        # Ensure the sender also retains what they said in their own context
        formatted = event.to_string(self.state.get("time"))
        sender.add_env_feedback(formatted)

        # 检查是否配置了社交网络
        social_network = self.state.get("social_network")
        if social_network and isinstance(social_network, dict) and len(social_network) > 0:
            # 使用社交网络过滤接收者
            recipients = self._get_recipients_by_social_network(sender, simulator)
            # Debug logging for network filtering
            all_recipients = [a.name for a in simulator.agents.values() if a.name != sender.name]
            print(f"[NETWORK-DEBUG] {sender.name} -> {recipients} (filtered from all: {all_recipients})")
            # 直接向接收者发送消息
            for agent_name in recipients:
                agent = simulator.agents.get(agent_name)
                if agent:
                    agent.add_env_feedback(formatted)

            # 记录事件（使用broadcast但只记录，不实际发送）
            time = self.state.get("time")
            recipients_list = recipients
            simulator.emit_event_later(
                "system_broadcast",
                {
                    "time": time,
                    "type": event.__class__.__name__,
                    "sender": sender.name,
                    "recipients": recipients_list,
                    "text": event.to_string(),
                    "code": event.code,
                    "params": {"sender": sender.name, "message": event.message, "recipients": recipients_list},
                },
            )
        else:
            # 没有配置社交网络，使用默认的全局广播
            global_recipients = [a.name for a in simulator.agents.values() if a.name != sender.name]
            print(f"[NETWORK-DEBUG] {sender.name} -> {global_recipients} (global broadcast: no social network configured)")
            event.params = {
                "sender": sender.name,
                "message": event.message,
                "recipients": global_recipients,
            }
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
