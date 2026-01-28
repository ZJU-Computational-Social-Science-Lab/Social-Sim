from copy import deepcopy
from queue import Queue
from typing import Callable, List, Optional
import logging
import traceback

from socialsim4.core.agent import Agent
from socialsim4.core.event import Event, StatusEvent
from socialsim4.core.ordering import ORDERING_MAP, Ordering, SequentialOrdering

logger = logging.getLogger(__name__)


class Simulator:
    def __init__(
        self,
        agents: List[Agent],
        scene,
        clients,
        broadcast_initial=True,
        max_steps_per_turn=5,
        ordering: Optional[Ordering] = None,
        event_handler: Callable[[str, dict], None] = None,
        emotion_enabled: bool = False,
    ):
        self.started = False
        self.log_event = event_handler

        for agent in agents:
            agent.log_event = self.log_event

        # 用 dict 便于按名字查找
        self.agents = {agent.name: agent for agent in agents}
        # Dictionary of LLM clients
        self.clients = clients
        self.scene = scene
        # Track total turns processed (no round concept)
        self.turns = 0
        # max steps per turn
        self.max_steps_per_turn = max_steps_per_turn

        # Build ordering (class or instance)
        self.ordering = ordering
        self.ordering.set_simulation(self)
        self.event_queue = Queue()
        self.order_iter = self.ordering.iter()
        self.emotion_enabled = emotion_enabled

        # Initialize agents for the scene if it's a new simulation
        if broadcast_initial:
            for agent in agents:
                self.scene.initialize_agent(agent)
                # Append scene-specific actions without modifying base action spaces here
                scene_actions = self.scene.get_scene_actions(agent) or []
                existing = {getattr(a, "NAME", None) for a in agent.action_space}
                for act in scene_actions:
                    name = getattr(act, "NAME", None)
                    if name and name not in existing:
                        agent.action_space.append(act)

        if broadcast_initial:
            self.broadcast(self.scene.initial_event)

        # Only run scene.pre_run for fresh simulations; skip during clones/deserialization
        if broadcast_initial:
            self.scene.pre_run(self)
        self.started = True

    # ----- Event plumbing: forward to ordering and external handler -----

    def emit_event(self, event_type: str, data: dict):
        """
        统一事件出口：
        - 把事件交给上层 log_event（SimTree 会把它写入 node.logs 并推到 WS）
        - 把事件交给 ordering.on_event 做调度感知
        - 对某些特殊事件（如 agent_error/offline）自动派生一条 system_log，方便前端时间轴标注
        """
        # 先把原始事件抛给 log_handler
        if self.log_event:
            try:
                self.log_event(event_type, data)
            except Exception:
                # 避免 log handler 自己抛错导致整个模拟挂掉
                logger.exception("log_event handler raised")

            # 如果是 agent_error，并且 kind == "offline"，自动追加一条 system_log
            try:
                if event_type == "agent_error":
                    kind = data.get("kind")
                    if kind == "offline":
                        agent_name = data.get("agent") or "(unknown)"
                        message = f"Agent {agent_name} 已掉线，后续节点可能不再响应。"
                        # 这里直接再调用一次 log_event 即可，不需要进入 ordering
                        self.log_event(
                            "system_log",
                            {
                                "source": "simulator",
                                "level": "warning",
                                "agent": agent_name,
                                "message": message,
                            },
                        )
            except Exception:
                # 不要因为附加的 system_log 再次抛错
                logger.exception("failed to emit system_log for agent_error")

        # 再交给 ordering 做调度感知
        if self.started and self.ordering is not None:
            try:
                self.ordering.on_event(self, event_type, data)
            except Exception:
                # ordering 的 on_event 也不应该拖垮整个模拟
                logger.exception("ordering.on_event raised")

    def emit_event_later(self, event_type: str, data: dict):
        self.event_queue.put({"type": event_type, "data": data})

    def emit_remaining_events(self):
        while not self.event_queue.empty():
            item = self.event_queue.get()
            self.emit_event(item["type"], item["data"])

    def reset_event_queue(self):
        """Drop all pending events; used when cloning simulators for new nodes."""
        self.event_queue = Queue()

    def broadcast(self, event: Event, receivers: Optional[List[str]] = None):
        sender = event.get_sender()
        time = self.scene.state.get("time")
        formatted = event.to_string(time)

        images = getattr(event, "images", []) or []
        audio = getattr(event, "audio", []) or []
        video = getattr(event, "video", []) or []
        # 降级策略：为音视频添加占位文本，保证非多模态模型也能感知附件
        attachment_texts = []
        if audio:
            attachment_texts.append("[audio: " + ", ".join(audio) + "]")
        if video:
            attachment_texts.append("[video: " + ", ".join(video) + "]")
        enriched = formatted
        if attachment_texts:
            enriched = f"{formatted}\n" + "\n".join(attachment_texts)

        recipients = []
        for agent in self.agents.values():
            if agent.name != sender and (receivers is None or agent.name in receivers):
                agent.add_env_feedback(enriched, images=images, audio=audio, video=video)
                recipients.append(agent.name)

        # Timeline: keep minimal
        payload = {
            "time": time,
            "type": event.__class__.__name__,
            "sender": sender,
            "recipients": recipients,
            "text": event.to_string(),
            "images": images,
            "audio": audio,
            "video": video,
        }
        code = getattr(event, "code", None)
        if code is not None:
            payload["code"] = code
        params = getattr(event, "params", None)
        if params is not None:
            payload["params"] = params
        self.emit_event_later("system_broadcast", payload)

    # Clear serialization with deep-copy semantics
    def serialize(self):
        ord_state = self.ordering.serialize()
        snap = {
            "agents": {name: agent.serialize() for name, agent in self.agents.items()},
            "scene": self.scene.serialize(),
            "max_steps_per_turn": int(self.max_steps_per_turn),
            "ordering": getattr(self.ordering, "NAME", "sequential"),
            "ordering_state": ord_state,
            # Serialize pending event queue as a list of items
            "event_queue": list(self.event_queue.queue),
            "turns": int(self.turns),
            "emotion_enabled": self.emotion_enabled,
        }
        return deepcopy(snap)

    @classmethod
    def deserialize(cls, data, clients, log_handler=None):
        data = deepcopy(data)
        # Note: clients are not serialized and must be passed in.
        scenario_data = data["scene"]
        from socialsim4.core.registry import SCENE_MAP

        scene_type = scenario_data["type"]
        scene_class = SCENE_MAP.get(scene_type)
        if not scene_class:
            raise ValueError(f"Unknown scene type: {scene_type}")
        scene = scene_class.deserialize(scenario_data)

        agents = [
            Agent.deserialize(agent_data, event_handler=None)
            for agent_data in data["agents"].values()
        ]

        # Restore ordering if available; fall back to sequential
        ordering_name = data.get("ordering", "sequential")
        ordering_state = data.get("ordering_state")
        ordering_cls = ORDERING_MAP.get(ordering_name, SequentialOrdering)
        # Construct ordering, preserving state if available
        if ordering_name == "cycled":
            names = []
            if ordering_state and isinstance(ordering_state, dict):
                names = list(ordering_state.get("names", []))
            ordering = ordering_cls(names)
        elif ordering_name == "controlled":
            # Rebuild with a scene-aware next_fn to preserve behavior after deserialization
            def _next(sim):
                return sim.scene.get_controlled_next(sim)

            ordering = ordering_cls(next_fn=_next)
        else:
            ordering = ordering_cls()

        simulator = cls(
            agents=agents,
            scene=scene,
            clients=clients,
            broadcast_initial=False,  # Don't rebroadcast initial event
            max_steps_per_turn=data.get("max_steps_per_turn", 5),
            ordering=ordering,
            event_handler=log_handler,
            emotion_enabled=data["emotion_enabled"],
        )
        # Apply ordering state if provided
        simulator.ordering.deserialize(ordering_state)
        simulator.order_iter = simulator.ordering.iter()
        # Restore pending event queue contents
        pending = data.get("event_queue") or []
        if pending:
            q = Queue()
            for item in pending:
                q.put(item)
            simulator.event_queue = q
        return simulator

    def _emit_error_event(
        self,
        error: Exception,
        agent_name: Optional[str],
        step: Optional[int],
    ):
        """
        把异常包装成统一的 error 事件，通过 emit_event 抛给上层。

        注意：节点 ID 由 SimTree._attach_log_handler 注入：
            entry = {"type": "error", "data": data, "node": node_id}
        """
        tb = traceback.format_exc()
        # 避免日志太长
        if tb and len(tb) > 4000:
            tb = tb[:4000] + "...(truncated)"

        data = {
            "error": repr(error),
            "error_type": error.__class__.__name__,
            "traceback": tb,
            "agent": agent_name,
            "step": step,
            "turn": self.turns,
            # 额外上下文：场景类型和调度器
            "scene_type": type(self.scene).__name__,
            "ordering": getattr(self.ordering, "NAME", self.ordering.__class__.__name__),
        }
        try:
            self.emit_event("error", data)
        except Exception:
            # 不要因为上报错误又抛错导致崩溃
            logger.exception("failed to emit error event")

    def run(self, max_turns=1000):
        turns = 0
        print(f"Running for {max_turns} turns.")

        while turns < max_turns:
            if self.scene.is_complete():
                print("Scenario complete. Simulation ends.")
                break

            agent_name = next(self.order_iter)
            agent = self.agents.get(agent_name)
            print(f"Turn {turns}: {agent_name}")

            if not agent:
                continue

            print("Running turn..")
            # Optional: provide a status prompt at the start of each turn
            status_prompt = self.scene.get_agent_status_prompt(agent)
            if status_prompt:
                evt = StatusEvent(status_prompt)
                text = evt.to_string(self.scene.state.get("time"))
                agent.add_env_feedback(text)

            # Skip turn based on scene rule
            if self.scene.should_skip_turn(agent, self):
                print(f"Skipping turn for {agent.name} as per scene rules.")
                self.scene.post_turn(agent, self)
                self.ordering.post_turn(agent.name)
                turns += 1
                continue

            # Intra-turn loop (bounded by global cap)
            steps = 0
            continue_turn = True
            self.emit_remaining_events()

            print(2)

            while continue_turn and steps < self.max_steps_per_turn:
                try:
                    print(3)
                    self.emit_event(
                        "agent_process_start",
                        {"agent": agent.name, "step": steps + 1},
                    )
                    action_datas = agent.process(
                        self.clients,
                        initiative=False,
                        scene=self.scene,
                    )
                    print(4)
                    self.emit_event(
                        "agent_process_end",
                        {
                            "agent": agent.name,
                            "step": steps + 1,
                            "actions": action_datas,
                        },
                    )

                    if not action_datas:
                        break

                    yielded = False
                    for action_data in action_datas:
                        if not action_data:
                            continue
                        self.emit_event(
                            "action_start",
                            {"agent": agent.name, "action": action_data},
                        )
                        success, result, summary, meta, pass_control = (
                            self.scene.parse_and_handle_action(
                                action_data, agent, self
                            )
                        )
                        self.emit_event(
                            "action_end",
                            {
                                "agent": agent.name,
                                "action": action_data,
                                "success": success,
                                "result": result,
                                "summary": summary,
                                "pass_control": bool(pass_control),
                            },
                        )
                        self.emit_remaining_events()
                        if bool(pass_control):
                            yielded = True
                            break
                except Exception as e:
                    print(f"Exception: {e}")
                    logger.exception(
                        "Exception during agent turn",
                        extra={"agent": agent.name, "step": steps + 1},
                    )
                    # 通过事件把错误抛给 SimTree / DevUI
                    self._emit_error_event(e, agent_name=agent.name, step=steps + 1)
                    # 当前 agent 的这个回合直接结束，避免陷入死循环
                    continue_turn = False
                    break

                steps += 1
                if yielded:
                    continue_turn = False

            # Post-turn hooks
            self.scene.post_turn(agent, self)
            self.emit_remaining_events()
            self.ordering.post_turn(agent.name)
            turns += 1
            self.turns = turns
