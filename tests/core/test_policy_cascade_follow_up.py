from socialsim4.core.agent import Agent
from socialsim4.core.event import PublicEvent
from socialsim4.core.llm import create_llm_client
from socialsim4.core.llm_config import LLMConfig
from socialsim4.core.ordering import SequentialOrdering
from socialsim4.core.scenes.policy_cascade_scene import PolicyCascadeScene
from socialsim4.core.simulator import Simulator


def _llm_config() -> LLMConfig:
    return LLMConfig(
        dialect="mock",
        api_key="",
        model="test",
        temperature=0.7,
    )


def _build_agent(name: str, tier: str) -> Agent:
    llm_config = _llm_config()
    llm_client = create_llm_client(llm_config)
    agent_data = {
        "name": name,
        "user_profile": f"Test profile for {name}",
        "style": "",
        "initial_instruction": "",
        "role_prompt": "",
        "action_space": [],
        "properties": {"tier": tier, "政治职位层级": tier},
    }
    agent = Agent.deserialize(agent_data)
    agent.llm_client = llm_client
    return agent


def _build_simulator(scene: PolicyCascadeScene, agents: list[Agent]) -> Simulator:
    clients = {"chat": agents[0].llm_client, "default": agents[0].llm_client}
    return Simulator(
        agents,
        scene,
        clients,
        event_handler=lambda *args, **kwargs: None,
        ordering=SequentialOrdering(),
    )


def test_policy_cascade_routes_only_along_network_branches():
    scene = PolicyCascadeScene("policy", "")
    scene.state["social_network"] = {
        "Agent 1": ["Agent 3"],
        "Agent 2": ["Agent 4"],
        "Agent 3": ["Agent 5"],
        "Agent 4": ["Agent 6"],
        "Agent 5": [],
        "Agent 6": [],
    }
    agents = [
        _build_agent("Agent 1", "top"),
        _build_agent("Agent 2", "top"),
        _build_agent("Agent 3", "mid"),
        _build_agent("Agent 4", "mid"),
        _build_agent("Agent 5", "low"),
        _build_agent("Agent 6", "low"),
    ]
    simulator = _build_simulator(scene, agents)

    policy = PublicEvent("「系统公告」 分支化传递测试\n目标：逐级传达")
    simulator.broadcast(policy, receivers=["Agent 1", "Agent 2"])

    assert set(scene._private_recipient_names()) == {"Agent 1", "Agent 2"}

    scene.parse_and_handle_action({"action": "send_message", "message": "Top route from Agent 1"}, agents[0], simulator)
    scene.post_turn(agents[0], simulator)

    assert scene._active_tier() == "top"
    upstream_3 = list((scene._private_event_for("Agent 3").get("upstream_messages") or []))
    upstream_4 = list((scene._private_event_for("Agent 4").get("upstream_messages") or []))
    assert len(upstream_3) == 1
    assert upstream_3[0].get("sender") == "Agent 1"
    assert upstream_4 == []

    scene.parse_and_handle_action({"action": "send_message", "message": "Top route from Agent 2"}, agents[1], simulator)
    scene.post_turn(agents[1], simulator)

    assert scene._active_tier() == "mid"
    upstream_3 = list((scene._private_event_for("Agent 3").get("upstream_messages") or []))
    upstream_4 = list((scene._private_event_for("Agent 4").get("upstream_messages") or []))
    assert len(upstream_3) == 1
    assert upstream_3[0].get("sender") == "Agent 1"
    assert len(upstream_4) == 1
    assert upstream_4[0].get("sender") == "Agent 2"
    assert scene.state.get("active_tier_targets", {}).get("mid") == ["Agent 3", "Agent 4"]


def test_policy_cascade_merges_multiple_upstream_inputs_for_one_recipient():
    scene = PolicyCascadeScene("policy", "")
    scene.state["social_network"] = {
        "Agent 1": ["Agent 3"],
        "Agent 2": ["Agent 3"],
        "Agent 3": [],
    }
    agents = [
        _build_agent("Agent 1", "top"),
        _build_agent("Agent 2", "top"),
        _build_agent("Agent 3", "mid"),
    ]
    simulator = _build_simulator(scene, agents)

    policy = PublicEvent("「系统公告」 多上游融合测试\n目标：逐级传达")
    simulator.broadcast(policy, receivers=["Agent 1", "Agent 2"])

    scene.parse_and_handle_action({"action": "send_message", "message": "Version A from Agent 1"}, agents[0], simulator)
    scene.post_turn(agents[0], simulator)
    scene.parse_and_handle_action({"action": "send_message", "message": "Version B from Agent 2"}, agents[1], simulator)
    scene.post_turn(agents[1], simulator)

    private_event = scene._private_event_for("Agent 3")
    upstream_messages = list(private_event.get("upstream_messages") or [])

    assert len(upstream_messages) == 2
    assert any(item.get("sender") == "Agent 1" for item in upstream_messages)
    assert any(item.get("sender") == "Agent 2" for item in upstream_messages)
    assert "多个上层版本" in str(private_event.get("relayed_policy") or "")

    status_prompt = scene.get_agent_status_prompt(agents[2])
    assert "多个上层版本" in status_prompt
    assert "Agent 1" in status_prompt
    assert "Agent 2" in status_prompt


def test_run_extends_until_current_cascade_tier_finishes():
    scene = PolicyCascadeScene("policy", "")
    scene.state["social_network"] = {
        "Agent 1": ["Agent 3"],
        "Agent 2": ["Agent 4"],
        "Agent 3": ["Agent 5"],
        "Agent 4": ["Agent 6"],
        "Agent 5": [],
        "Agent 6": [],
    }
    agents = [
        _build_agent("Agent 1", "top"),
        _build_agent("Agent 2", "top"),
        _build_agent("Agent 3", "mid"),
        _build_agent("Agent 4", "mid"),
        _build_agent("Agent 5", "low"),
        _build_agent("Agent 6", "low"),
    ]
    seen_events = []
    simulator = Simulator(
        agents,
        scene,
        {"chat": agents[0].llm_client, "default": agents[0].llm_client},
        event_handler=lambda event_type, data: seen_events.append((event_type, data)),
        ordering=SequentialOrdering(),
    )

    scene.state["latest_notice"] = "「系统公告」 关于开展高风险算法应用排查与标识工作的通知"
    scene.state["latest_policy"] = "「系统公告」 关于开展高风险算法应用排查与标识工作的通知\n1. 目标：在未来 4 个月内，完成全域高风险算法应用场景的排查，并实现 100% 风险场景标识到位。"
    scene.state["source_policy"] = scene.state["latest_policy"]
    scene.state["relayed_policy"] = scene.state["latest_policy"]
    scene.state["task_mode"] = "cascade"
    scene.state["notice_kind"] = "execution"
    scene.state["current_tier_idx"] = 2
    scene.state["tier_seen"] = {"top": [], "mid": [], "low": []}
    scene.state["tier_transmitted"] = {"top": True, "mid": True, "low": False}
    scene.state["active_tier_targets"] = {"low": ["Agent 5", "Agent 6"]}
    scene.state["private_events"] = {
        "Agent 5": {
            "latest_notice": scene.state["latest_notice"],
            "latest_policy": scene.state["latest_policy"],
            "source_policy": scene.state["source_policy"],
            "relayed_policy": scene.state["relayed_policy"],
            "task_mode": "cascade",
            "notice_kind": "execution",
        },
        "Agent 6": {
            "latest_notice": scene.state["latest_notice"],
            "latest_policy": scene.state["latest_policy"],
            "source_policy": scene.state["source_policy"],
            "relayed_policy": scene.state["relayed_policy"],
            "task_mode": "cascade",
            "notice_kind": "execution",
        },
    }
    scene._rebuild_tiers()

    simulator.run(max_turns=1)

    processed_agents = [
        data.get("agent")
        for event_type, data in seen_events
        if event_type == "agent_process_start"
    ]

    assert "Agent 5" in processed_agents
    assert "Agent 6" in processed_agents
    assert scene.state["complete"] is True
