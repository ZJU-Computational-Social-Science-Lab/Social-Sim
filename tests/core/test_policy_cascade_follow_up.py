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


def _complete_single_branch_cascade(scene: PolicyCascadeScene, simulator: Simulator, agents: list[Agent]) -> None:
    simulator.broadcast(PublicEvent("「系统公告」 后续反馈测试\n目标：逐级传达"), receivers=["Top"])
    scene.parse_and_handle_action({"action": "send_message", "message": "Top version"}, agents[0], simulator)
    scene.post_turn(agents[0], simulator)
    scene.parse_and_handle_action({"action": "send_message", "message": "Mid version"}, agents[1], simulator)
    scene.post_turn(agents[1], simulator)
    scene.parse_and_handle_action({"action": "send_message", "message": "Low version"}, agents[2], simulator)
    scene.post_turn(agents[2], simulator)


def test_follow_up_mode_starts_on_next_run_after_cascade_completion():
    scene = PolicyCascadeScene("policy", "")
    scene.state["social_network"] = {
        "Top": ["Mid"],
        "Mid": ["Low"],
        "Low": [],
    }
    agents = [
        _build_agent("Top", "top"),
        _build_agent("Mid", "mid"),
        _build_agent("Low", "low"),
    ]
    simulator = _build_simulator(scene, agents)

    _complete_single_branch_cascade(scene, simulator, agents)

    assert scene.state["complete"] is True
    assert scene.state["task_mode"] == "cascade"
    assert scene.state["processed_policy_version"] == scene.state["policy_version"]

    scene.reset_for_run()

    assert scene.state["complete"] is False
    assert scene.state["task_mode"] == "follow_up"


def test_report_upward_creates_private_thread_for_superior():
    scene = PolicyCascadeScene("policy", "")
    scene.state["social_network"] = {
        "Top": ["Mid"],
        "Mid": ["Low"],
        "Low": [],
    }
    agents = [
        _build_agent("Top", "top"),
        _build_agent("Mid", "mid"),
        _build_agent("Low", "low"),
    ]
    simulator = _build_simulator(scene, agents)

    _complete_single_branch_cascade(scene, simulator, agents)
    scene.reset_for_run()

    success, result, summary, _, _ = scene.parse_and_handle_action(
        {"action": "report_upward", "target": "Mid", "message": "执行负担过高，资源不足。"},
        agents[2],
        simulator,
    )

    private_event = scene._private_event_for("Mid")

    assert success is True
    assert result["target"] == "Mid"
    assert "反馈" in summary
    assert private_event["task_mode"] == "follow_up_thread"
    assert private_event["thread_kind"] == "upward_feedback"
    assert private_event["reply_target"] == "Low"
    assert private_event["thread_sender"] == "Low"


def test_ignored_thread_notifies_original_sender():
    scene = PolicyCascadeScene("policy", "")
    scene.state["social_network"] = {
        "Top": ["Mid"],
        "Mid": ["Low"],
        "Low": [],
    }
    agents = [
        _build_agent("Top", "top"),
        _build_agent("Mid", "mid"),
        _build_agent("Low", "low"),
    ]
    simulator = _build_simulator(scene, agents)

    _complete_single_branch_cascade(scene, simulator, agents)
    scene.reset_for_run()
    scene.parse_and_handle_action(
        {"action": "report_upward", "target": "Mid", "message": "执行负担过高，资源不足。"},
        agents[2],
        simulator,
    )

    success, _, summary, _, _ = scene.parse_and_handle_action(
        {"action": "yield"},
        agents[1],
        simulator,
    )

    reply_event = scene._private_event_for("Low")
    thread_id = str(reply_event["thread_id"])
    thread = scene._thread_for_id(thread_id)

    assert success is True
    assert "暂未处理线程" in summary
    assert reply_event["task_mode"] == "follow_up_thread"
    assert "暂未处理" in reply_event["thread_notice"]
    assert thread["status"] == "ignored"


def test_consult_peer_uses_connected_same_tier_targets():
    scene = PolicyCascadeScene("policy", "")
    scene.state["informal_network"] = {
        "Mid A": ["Mid B"],
        "Mid B": ["Mid A"],
    }
    agents = [
        _build_agent("Top", "top"),
        _build_agent("Mid A", "mid"),
        _build_agent("Mid B", "mid"),
    ]
    simulator = _build_simulator(scene, agents)

    scene.state["latest_policy"] = "既有政策"
    scene.state["source_policy"] = "既有政策"
    scene.state["relayed_policy"] = "既有政策"
    scene.state["policy_version"] = 1
    scene.state["processed_policy_version"] = 1
    scene.reset_for_run()

    success, result, summary, _, _ = scene.parse_and_handle_action(
        {"action": "consult_peer", "target": "Mid B", "message": "我们是否统一按简化口径执行？"},
        agents[1],
        simulator,
    )

    private_event = scene._private_event_for("Mid B")

    assert success is True
    assert result["target"] == "Mid B"
    assert "同层协商" in summary
    assert private_event["task_mode"] == "follow_up_thread"
    assert private_event["thread_kind"] == "peer_consult"


def test_agent_led_distortion_preserves_agent_authored_message():
    scene = PolicyCascadeScene(
        "policy",
        "",
        cascade_mode="distortion_cascade",
        distortion_strength=0.7,
        conflict_sensitivity=0.6,
        block_probability=0.0,
    )
    agent = _build_agent("Mid", "mid")
    scene.state["source_policy"] = "目标：逐级传达\n执行要求：本周内完成排查。"
    scene.state["relayed_policy"] = scene.state["source_policy"]
    scene.state["latest_notice"] = scene.state["source_policy"]

    distorted = scene._agent_led_distortion(
        agent,
        "mid",
        scene.state["source_policy"],
        "建议先分批推进，并由各部门内部先汇总风险与资源缺口。",
    )

    assert "建议先分批推进" in distorted
    assert "内部先汇总" in distorted


def test_pending_follow_up_conditions_merge_on_next_run():
    scene = PolicyCascadeScene("policy", "")
    agents = [
        _build_agent("Top", "top"),
        _build_agent("Mid", "mid"),
    ]
    _build_simulator(scene, agents)

    scene.state["persistent_conditions"] = {"resource_shortage": 0.2}
    scene.state["pending_follow_up_conditions"] = {
        "resource_shortage": 0.8,
        "public_opinion_pressure": 0.6,
    }
    scene.state["latest_policy"] = "既有政策"
    scene.state["source_policy"] = "既有政策"
    scene.state["relayed_policy"] = "既有政策"
    scene.state["policy_version"] = 1
    scene.state["processed_policy_version"] = 1

    scene.reset_for_run()

    assert scene.state["task_mode"] == "follow_up"
    assert scene.state["persistent_conditions"]["resource_shortage"] == 0.8
    assert scene.state["persistent_conditions"]["public_opinion_pressure"] == 0.6
    assert scene.state["pending_follow_up_conditions"] == {}


def test_follow_up_thread_seed_creates_pending_private_thread():
    scene = PolicyCascadeScene("policy", "")
    agents = [
        _build_agent("Top", "top"),
        _build_agent("Mid", "mid"),
        _build_agent("Low", "low"),
    ]
    _build_simulator(scene, agents)

    scene.state["follow_up_thread_seeds"] = [
        {
            "sender": "Low",
            "recipient": "Mid",
            "kind": "upward_feedback",
            "message": "执行压力过大，请给出处理意见。",
            "notice": "进入后续互动阶段",
            "metadata": {"source": "experiment"},
        }
    ]

    scene.reset_for_run()

    private_event = scene._private_event_for("Mid")
    thread = scene._thread_for_id(str(private_event["thread_id"]))

    assert scene.state["task_mode"] == "follow_up"
    assert private_event["task_mode"] == "follow_up_thread"
    assert private_event["thread_kind"] == "upward_feedback"
    assert private_event["thread_sender"] == "Low"
    assert private_event["reply_target"] == "Low"
    assert thread["metadata"]["source"] == "experiment"
    assert scene.state["follow_up_thread_seeds"] == []
