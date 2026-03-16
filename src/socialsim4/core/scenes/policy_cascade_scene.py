from __future__ import annotations

import re
from typing import Dict, List

from socialsim4.core.actions.base_actions import SendMessageAction, YieldAction
from socialsim4.core.agent import Agent
from socialsim4.core.scene import Scene


TIER_ORDER = ["top", "mid", "low"]


def _extract_tier(agent: Agent) -> str:
    tier = str(agent.properties.get("tier", "")).strip().lower() if hasattr(agent, "properties") else ""
    if tier in TIER_ORDER:
        return tier

    text = " ".join([
        str(getattr(agent, "role_prompt", "")),
        str(getattr(agent, "user_profile", "")),
    ]).lower()
    match = re.search(r"政治职位层级[:：]\s*(top|mid|low)", text)
    if match:
        return match.group(1)

    return "mid"


class PolicyCascadeScene(Scene):
    """Strict top→mid→low cascade, single action per tier, downstream-only delivery."""

    TYPE = "policy_cascade_scene"

    def __init__(self, name: str, initial_event: str):
        super().__init__(name, initial_event)
        self.state["current_tier_idx"] = 0
        self.state["tier_seen"] = {t: [] for t in TIER_ORDER}
        self.state["latest_policy"] = ""
        self.state["complete"] = False
        self._tier_map: Dict[str, str] = {}
        self._agents_by_tier: Dict[str, List[str]] = {t: [] for t in TIER_ORDER}

    # ----- Lifecycle -----

    def set_simulator(self, simulator):
        self.simulator = simulator
        self._rebuild_tiers()
        self._normalize_active_tier()

    def on_event(self, sim, event_type: str, data):
        if event_type in {"environment", "broadcast"}:
            self.state["current_tier_idx"] = 0
            self.state["tier_seen"] = {t: [] for t in TIER_ORDER}
            self.state["latest_policy"] = str(data.get("description", ""))
            self.state["complete"] = False
            self._rebuild_tiers()
            self._normalize_active_tier()
        return super().on_event(sim, event_type, data)

    # ----- Tier helpers -----

    def _rebuild_tiers(self) -> None:
        self._tier_map = {}
        names = list(self.simulator.agents.keys())
        for name, agent in self.simulator.agents.items():
            self._tier_map[name] = _extract_tier(agent)

        present = {t for t in self._tier_map.values() if t in TIER_ORDER}
        if len(present) < len(TIER_ORDER) and names:
            for idx, name in enumerate(names):
                tier = self._tier_map.get(name)
                if tier not in TIER_ORDER:
                    forced = TIER_ORDER[min(idx, len(TIER_ORDER) - 1)]
                    self._tier_map[name] = forced
                    present.add(forced)

        self._agents_by_tier = {t: [] for t in TIER_ORDER}
        for name, tier in self._tier_map.items():
            if tier in TIER_ORDER:
                self._agents_by_tier[tier].append(name)

    def _normalize_active_tier(self) -> None:
        idx = int(self.state.get("current_tier_idx", 0))
        while idx < len(TIER_ORDER):
            tier = TIER_ORDER[idx]
            if self._agents_by_tier.get(tier):
                break
            idx += 1
        self.state["current_tier_idx"] = min(idx, len(TIER_ORDER) - 1)

    def _active_tier(self) -> str:
        self._normalize_active_tier()
        idx = int(self.state.get("current_tier_idx", 0))
        return TIER_ORDER[min(max(idx, 0), len(TIER_ORDER) - 1)]

    def _downstream_targets(self, agent: Agent) -> List[str]:
        tier = self._tier_map.get(agent.name) or _extract_tier(agent)
        idx = TIER_ORDER.index(tier) if tier in TIER_ORDER else 0
        if idx + 1 >= len(TIER_ORDER):
            return []
        next_tier = TIER_ORDER[idx + 1]
        return self._agents_by_tier.get(next_tier, [])

    # ----- Description -----

    def get_behavior_guidelines(self):
        return (
            "When your tier is active: "
            "(1) 逐字粘贴最新政策/公告全文（不要省略或改写），"
            "(2) 写明态度/疑虑/执行计划/资源需求，"
            "(3) 只把消息传递给下一级（top→mid，mid→low），未轮到你时保持沉默。"
            "输出必须包含 send_message 或 yield，禁止空响应或 None。"
        )

    # ----- Actions -----

    def get_scene_actions(self, agent: Agent):
        return [SendMessageAction(), YieldAction()]

    def parse_and_handle_action(self, action_data, agent: Agent, simulator):
        payload = action_data
        raw_action = action_data.get("action")
        if type(raw_action) is dict:
            action_name = raw_action.get("name") or raw_action.get("action")
            merged = {k: v for k, v in raw_action.items() if k != "name"}
            for k, v in action_data.items():
                if k != "action":
                    merged[k] = v
            merged["action"] = action_name
            payload = merged
        action_name = payload.get("action")

        if action_name == "send_message" and not self.should_skip_turn(agent, simulator):
            policy = str(self.state.get("latest_policy", "") or "").strip()
            message = str(payload.get("message", "") or "").strip()
            if not policy:
                raise ValueError("latest policy missing for cascade")
            if policy not in message:
                raise ValueError("send_message must include latest policy verbatim")

        success, result, summary, meta, _ = super().parse_and_handle_action(payload, agent, simulator)
        return success, result, summary, meta, True

    # ----- Delivery -----

    def deliver_message(self, event, sender: Agent, simulator):
        event.code = "scene_chat"
        event.params = {"sender": sender.name, "message": event.message}

        formatted = event.to_string(self.state.get("time"))
        sender.add_env_feedback(formatted)

        tier = self._tier_map.get(sender.name) or _extract_tier(sender)
        recipients: List[str] = []

        if tier in {"top", "mid"}:
            recipients = self._downstream_targets(sender)
            if not recipients:
                raise ValueError("downstream targets missing for cascade")
        elif tier == "low":
            recipients = [n for n in self._agents_by_tier.get(tier, []) if n != sender.name]
        else:
            recipients = [a.name for a in simulator.agents.values() if a.name != sender.name]

        for name in recipients:
            agent = simulator.agents.get(name)
            if agent:
                agent.add_env_feedback(formatted)

        simulator.emit_event_later(
            "system_broadcast",
            {
                "time": self.state.get("time"),
                "type": event.__class__.__name__,
                "sender": sender.name,
                "recipients": recipients,
                "text": event.to_string(),
                "code": event.code,
                "params": {"sender": sender.name, "message": event.message, "recipients": recipients},
            },
        )

    # ----- Turn control -----

    def should_skip_turn(self, agent: Agent, simulator) -> bool:
        if self.state.get("complete"):
            return True
        tier = self._tier_map.get(agent.name) or _extract_tier(agent)
        return tier != self._active_tier()

    def post_turn(self, agent: Agent, simulator) -> None:
        super().post_turn(agent, simulator)

        tier = self._tier_map.get(agent.name) or _extract_tier(agent)
        active = self._active_tier()
        if tier != active:
            return

        seen = self.state.get("tier_seen", {})
        if tier not in seen:
            seen[tier] = []
        if agent.name not in seen[tier]:
            seen[tier].append(agent.name)

        tier_agents = self._agents_by_tier.get(tier, [])
        if tier_agents and all(name in seen[tier] for name in tier_agents):
            next_idx = TIER_ORDER.index(tier) + 1
            if next_idx < len(TIER_ORDER):
                self.state["current_tier_idx"] = next_idx
            else:
                self.state["current_tier_idx"] = len(TIER_ORDER)
                self.state["complete"] = True
            self.state["tier_seen"] = {t: [] for t in TIER_ORDER}
            self._normalize_active_tier()

    def is_complete(self):
        return bool(self.state.get("complete"))

    # ----- Config -----

    def serialize_config(self) -> dict:
        return {}

    @classmethod
    def deserialize_config(cls, config: dict) -> dict:
        return {}