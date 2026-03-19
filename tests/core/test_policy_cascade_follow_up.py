from socialsim4.core.agent import Agent
from socialsim4.core.event import PublicEvent
from socialsim4.core.llm import create_llm_client
from socialsim4.core.llm_config import LLMConfig
from socialsim4.core.ordering import SequentialOrdering
from socialsim4.core.scenes.policy_cascade_scene import PolicyCascadeScene
from socialsim4.core.simulator import Simulator
from socialsim4.core.simtree import SimTree


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


def test_runtime_refreshes_policy_action_space_when_follow_up_mode_starts():
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
    simulator._refresh_scene_action_space(agents[0])

    action_names = [action.NAME for action in agents[0].action_space]
    assert "send_message" in action_names
    assert "yield" in action_names
    assert "report_upward" in action_names
    assert "consult_peer" in action_names


def test_relayed_policy_does_not_accumulate_tier_suffixes():
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

    simulator.broadcast(PublicEvent("「系统公告」 逐级传达测试\n目标：只传政策正文"), receivers=["Top"])
    scene.parse_and_handle_action({"action": "send_message", "message": "Top version"}, agents[0], simulator)

    mid_private = scene._private_event_for("Mid")
    assert "态度：" not in mid_private["relayed_policy"]
    assert "补充：" not in mid_private["relayed_policy"]

    scene.post_turn(agents[0], simulator)
    scene.parse_and_handle_action({"action": "send_message", "message": "Mid version"}, agents[1], simulator)

    low_private = scene._private_event_for("Low")
    assert "态度：" not in low_private["relayed_policy"]
    assert "补充：" not in low_private["relayed_policy"]


def test_new_policy_broadcast_revives_agents_and_clears_action_trace_memory():
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

    agents[1].is_offline = True
    agents[1].consecutive_llm_errors = 3
    agents[1].short_memory.append("assistant", "[Action] send_message\n旧的级联动作")

    simulator.broadcast(PublicEvent("「系统公告」 新一轮级联测试\n目标：重新启动"), receivers=["Top"])

    assert agents[1].is_offline is False
    assert agents[1].consecutive_llm_errors == 0
    assert "[Action]" not in agents[1].short_memory.get_all()[0]["content"]
    assert scene.state["task_mode"] == "cascade"


def test_new_policy_adjustment_forces_full_top_mid_low_cascade_even_past_turn_limit():
    scene = PolicyCascadeScene("policy", "", cascade_mode="distortion_cascade")
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
    scene.state["persistent_conditions"] = {
        "public_opinion_pressure": 0.9,
        "resource_shortage": 0.85,
        "inspection_pressure": 0.8,
    }

    top_actions = iter([[{"action": "announce_policy_adjustment", "message": "新的政策要求：追加资源并重新下传。"}]])
    mid_actions = iter([[{"action": "send_message", "message": "中层接收新政策并继续下传。"}]])
    low_actions = iter([[{"action": "send_message", "message": "基层接收新政策并执行。"}]])

    agents[0].process = lambda clients, initiative, scene: next(top_actions, [])
    agents[1].process = lambda clients, initiative, scene: next(mid_actions, [])
    agents[2].process = lambda clients, initiative, scene: next(low_actions, [])

    simulator.run(max_turns=1)

    assert scene.state["complete"] is True
    assert scene.state["processed_policy_version"] == scene.state["policy_version"]
    assert scene.state["force_complete_current_cascade"] is False
    assert "新的政策要求" in str(scene.state.get("source_policy") or "")


def test_top_cannot_restart_policy_too_early_without_thread_pressure():
    scene = PolicyCascadeScene("policy", "", cascade_mode="distortion_cascade")
    scene.state["social_network"] = {
        "Top": ["Mid"],
        "Mid": ["Low"],
        "Low": [],
    }
    scene.state["latest_policy"] = "既有政策"
    scene.state["source_policy"] = "既有政策"
    scene.state["relayed_policy"] = "既有政策"
    scene.state["task_mode"] = "follow_up"
    scene.state["notice_kind"] = "execution"
    scene.state["policy_version"] = 1
    scene.state["processed_policy_version"] = 1
    scene.state["persistent_conditions"] = {
        "public_opinion_pressure": 0.75,
    }
    agents = [
        _build_agent("Top", "top"),
        _build_agent("Mid", "mid"),
        _build_agent("Low", "low"),
    ]
    simulator = _build_simulator(scene, agents)

    action_names = [action.NAME for action in scene.get_scene_actions(agents[0])]

    assert "announce_policy_adjustment" not in action_names


def test_strict_cascade_yield_is_normalized_to_required_transmission():
    scene = PolicyCascadeScene("policy", "", cascade_mode="strict_cascade")
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

    simulator.broadcast(PublicEvent("「系统公告」 强制下传测试\n目标：严格模式不得截留"), receivers=["Top"])

    success, result, _, _, _ = scene.parse_and_handle_action({"action": "yield"}, agents[0], simulator)
    scene.post_turn(agents[0], simulator)

    assert success is True
    assert "强制下传测试" in result["message"]
    assert scene._private_event_for("Mid")["task_mode"] == "cascade"


def test_forced_restart_cascade_in_distortion_mode_cannot_be_truncated_by_yield():
    scene = PolicyCascadeScene("policy", "", cascade_mode="distortion_cascade", block_probability=1.0)
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

    simulator.broadcast(PublicEvent("「系统公告」 强制完整下传测试\n目标：重启后必须传完"), receivers=["Top"])

    scene.parse_and_handle_action({"action": "yield"}, agents[0], simulator)
    scene.post_turn(agents[0], simulator)
    scene.parse_and_handle_action({"action": "yield"}, agents[1], simulator)
    scene.post_turn(agents[1], simulator)
    scene.parse_and_handle_action({"action": "yield"}, agents[2], simulator)
    scene.post_turn(agents[2], simulator)

    assert scene.state["complete"] is True
    assert scene.state["processed_policy_version"] == scene.state["policy_version"]
    assert scene.state["force_complete_current_cascade"] is False


def test_top_policy_adjustment_keeps_both_branches_in_restarted_cascade():
    scene = PolicyCascadeScene("policy", "", cascade_mode="distortion_cascade")
    scene.state["social_network"] = {
        "Top A": ["Mid A"],
        "Top B": ["Mid B"],
        "Mid A": ["Low A"],
        "Mid B": ["Low B"],
        "Low A": [],
        "Low B": [],
    }
    scene.state["latest_policy"] = "旧政策"
    scene.state["source_policy"] = "旧政策"
    scene.state["relayed_policy"] = "旧政策"
    scene.state["task_mode"] = "follow_up"
    scene.state["notice_kind"] = "execution"
    scene.state["policy_version"] = 1
    scene.state["processed_policy_version"] = 1
    scene.state["persistent_conditions"] = {
        "public_opinion_pressure": 0.9,
        "resource_shortage": 0.85,
        "inspection_pressure": 0.8,
    }
    agents = [
        _build_agent("Top A", "top"),
        _build_agent("Top B", "top"),
        _build_agent("Mid A", "mid"),
        _build_agent("Mid B", "mid"),
        _build_agent("Low A", "low"),
        _build_agent("Low B", "low"),
    ]
    simulator = _build_simulator(scene, agents)
    scene.state["thread_inboxes"] = {"Top A": ["pending-thread"]}

    scene.parse_and_handle_action(
        {"action": "announce_policy_adjustment", "message": "调整方案：追加资源并重新下传。"},
        agents[0],
        simulator,
    )
    scene.post_turn(agents[0], simulator)

    assert scene._private_event_for("Mid A")["task_mode"] == "cascade"
    assert scene._private_event_for("Mid B")["task_mode"] == "cascade"

    scene.post_turn(agents[1], simulator)

    mid_targets = scene._active_targets_for_tier("mid")
    assert "Mid A" in mid_targets
    assert "Mid B" in mid_targets

    scene.parse_and_handle_action({"action": "send_message", "message": "Mid A restart"}, agents[2], simulator)
    scene.post_turn(agents[2], simulator)
    scene.parse_and_handle_action({"action": "send_message", "message": "Mid B restart"}, agents[3], simulator)
    scene.post_turn(agents[3], simulator)

    low_targets = scene._active_targets_for_tier("low")
    assert "Low A" in low_targets
    assert "Low B" in low_targets

    scene.parse_and_handle_action({"action": "send_message", "message": "Low A restart"}, agents[4], simulator)
    scene.post_turn(agents[4], simulator)
    scene.parse_and_handle_action({"action": "send_message", "message": "Low B restart"}, agents[5], simulator)
    scene.post_turn(agents[5], simulator)

    assert scene.state["complete"] is True
    assert scene.state["processed_policy_version"] == scene.state["policy_version"]


def test_private_policy_broadcast_emits_one_visibility_event_per_recipient():
    scene = PolicyCascadeScene("policy", "")
    scene.state["social_network"] = {
        "Agent 1": ["Agent 3"],
        "Agent 2": ["Agent 4"],
        "Agent 3": [],
        "Agent 4": [],
    }
    agents = [
        _build_agent("Agent 1", "top"),
        _build_agent("Agent 2", "top"),
        _build_agent("Agent 3", "mid"),
        _build_agent("Agent 4", "mid"),
    ]
    seen_events = []
    clients = {"chat": agents[0].llm_client, "default": agents[0].llm_client}
    simulator = Simulator(
        agents,
        scene,
        clients,
        event_handler=lambda event_type, data: seen_events.append((event_type, data)),
        ordering=SequentialOrdering(),
    )

    simulator.broadcast(
        PublicEvent("「系统公告」 定向下发\n目标：分别激活两个顶层节点"),
        receivers=["Agent 1", "Agent 2"],
    )

    visible_events = [
        data for event_type, data in seen_events
        if event_type == "private_cascade_input"
    ]

    assert [item["visible_to"] for item in visible_events] == ["Agent 1", "Agent 2"]
    assert all(item["recipients"] == ["Agent 1", "Agent 2"] for item in visible_events)


def test_dead_end_network_emits_explicit_debug_event():
    scene = PolicyCascadeScene("policy", "")
    scene.state["social_network"] = {
        "Top": ["Mid"],
        "Mid": ["Top"],
        "Low": [],
    }
    agents = [
        _build_agent("Top", "top"),
        _build_agent("Mid", "mid"),
        _build_agent("Low", "low"),
    ]
    seen_events = []
    clients = {"chat": agents[0].llm_client, "default": agents[0].llm_client}
    simulator = Simulator(
        agents,
        scene,
        clients,
        event_handler=lambda event_type, data: seen_events.append((event_type, data)),
        ordering=SequentialOrdering(),
    )

    simulator.broadcast(PublicEvent("「系统公告」 死路网络测试\n目标：检查网络断点"), receivers=["Top"])
    scene.parse_and_handle_action({"action": "send_message", "message": "Top version"}, agents[0], simulator)
    scene.post_turn(agents[0], simulator)
    scene.parse_and_handle_action({"action": "send_message", "message": "Mid version"}, agents[1], simulator)
    scene.post_turn(agents[1], simulator)

    dead_end_events = [data for event_type, data in seen_events if event_type == "cascade_network_dead_end"]

    assert len(dead_end_events) == 1
    assert dead_end_events[0]["agent"] == "Mid"
    assert dead_end_events[0]["tier"] == "mid"
    assert dead_end_events[0]["next_tier"] == "low"
    assert dead_end_events[0]["next_tier_candidates"] == ["Low"]
    assert dead_end_events[0]["next_tier_connections"] == []


def test_forced_cascade_normalizes_invalid_low_action_and_reaches_sibling_branch():
    scene = PolicyCascadeScene("policy", "", cascade_mode="strict_cascade")
    scene.state["social_network"] = {
        "Top A": ["Mid A"],
        "Top B": ["Mid B"],
        "Mid A": ["Low A"],
        "Mid B": ["Low B"],
        "Low A": [],
        "Low B": [],
    }
    agents = [
        _build_agent("Top A", "top"),
        _build_agent("Top B", "top"),
        _build_agent("Mid A", "mid"),
        _build_agent("Mid B", "mid"),
        _build_agent("Low A", "low"),
        _build_agent("Low B", "low"),
    ]
    simulator = _build_simulator(scene, agents)

    simulator.broadcast(PublicEvent("「系统公告」 最终新政策\n目标：必须完整下传"))

    scene.parse_and_handle_action({"action": "send_message", "message": "Top A 传达"}, agents[0], simulator)
    scene.post_turn(agents[0], simulator)
    scene.parse_and_handle_action({"action": "send_message", "message": "Top B 传达"}, agents[1], simulator)
    scene.post_turn(agents[1], simulator)
    scene.parse_and_handle_action({"action": "send_message", "message": "Mid A 传达"}, agents[2], simulator)
    scene.post_turn(agents[2], simulator)
    scene.parse_and_handle_action({"action": "send_message", "message": "Mid B 传达"}, agents[3], simulator)
    scene.post_turn(agents[3], simulator)

    low_targets = scene._active_targets_for_tier("low")
    assert "Low A" in low_targets
    assert "Low B" in low_targets

    success, result, _, _, _ = scene.parse_and_handle_action(
        {"action": "none", "response": "我已整合最新政策并补充执行细节。"},
        agents[4],
        simulator,
    )
    scene.post_turn(agents[4], simulator)

    assert success is True
    assert "最终新政策" in result["message"]
    assert scene.should_skip_turn(agents[5], simulator) is False

    scene.parse_and_handle_action({"action": "send_message", "message": "Low B 执行"}, agents[5], simulator)
    scene.post_turn(agents[5], simulator)

    assert scene.state["complete"] is True
    assert scene.state["processed_policy_version"] == scene.state["policy_version"]


def test_follow_up_thread_send_message_uses_content_field_when_message_missing():
    scene = PolicyCascadeScene("policy", "")
    scene.state["social_network"] = {
        "Top": ["Mid"],
        "Mid": ["Low"],
        "Low": [],
    }
    scene.state["latest_policy"] = "执行要求：继续推进落实"
    scene.state["source_policy"] = "执行要求：继续推进落实"
    scene.state["relayed_policy"] = "执行要求：继续推进落实"
    scene.state["task_mode"] = "follow_up"
    scene.state["notice_kind"] = "execution"
    scene.state["policy_version"] = 1
    scene.state["processed_policy_version"] = 1
    agents = [
        _build_agent("Top", "top"),
        _build_agent("Mid", "mid"),
        _build_agent("Low", "low"),
    ]
    simulator = _build_simulator(scene, agents)

    scene.parse_and_handle_action(
        {"action": "report_upward", "target": "Mid", "message": "执行负担过高，资源不足。"},
        agents[2],
        simulator,
    )

    success, result, _, _, _ = scene.parse_and_handle_action(
        {"action": {"name": "send_message", "target": "Low", "content": "请先补充岗位缺口数据。"}},
        agents[1],
        simulator,
    )

    assert success is True
    assert result["message"] == "请先补充岗位缺口数据。"


def test_new_cascade_overrides_stale_follow_up_thread_prompt_and_actions():
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

    scene.state["task_mode"] = "cascade"
    scene.state["notice_kind"] = "execution"
    scene.state["latest_notice"] = "「系统公告」 新政策\n目标：逐级传达"
    scene.state["latest_policy"] = "「系统公告」 新政策\n目标：逐级传达"
    scene.state["source_policy"] = "「系统公告」 新政策\n目标：逐级传达"
    scene.state["relayed_policy"] = "「系统公告」 新政策\n目标：逐级传达"
    scene.state["private_events"] = {
        "Mid": {
            "task_mode": "follow_up_thread",
            "thread_kind": "peer_consult",
            "thread_sender": "Top",
            "reply_target": "Top",
            "thread_message": "旧线程消息",
        }
    }

    prompt = scene.get_agent_status_prompt(agents[1])
    actions = [action.NAME for action in scene.get_scene_actions(agents[1])]
    guidelines = scene.get_behavior_guidelines()

    assert "当前任务：按层级传递最新政策" in prompt
    assert "处理一条私有反馈/协商线程" not in prompt
    assert actions == ["send_message", "yield"]
    assert "你正在处理一条私有会话或反馈线程" not in guidelines


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


def test_thread_reply_preserves_history_for_next_round():
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

    scene.parse_and_handle_action(
        {"action": "send_message", "message": "请先补充具体岗位缺口和预算规模。"},
        agents[1],
        simulator,
    )

    reply_event = scene._private_event_for("Low")

    assert reply_event["thread_round_count"] == 2
    assert len(reply_event["conversation_history"]) == 2
    assert "执行负担过高" in reply_event["thread_history_excerpt"]
    assert "请先补充具体岗位缺口" in reply_event["thread_history_excerpt"]


def test_status_prompt_for_returning_thread_requires_continuation_not_restart():
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
    scene.parse_and_handle_action(
        {"action": "send_message", "message": "请先补充具体岗位缺口和预算规模。"},
        agents[1],
        simulator,
    )

    prompt = scene.get_agent_status_prompt(agents[2])

    assert "此前往复记录" in prompt
    assert "这不是新议题" in prompt
    assert "执行负担过高" in prompt
    assert "请先补充具体岗位缺口和预算规模" in prompt


def test_follow_up_thread_prompt_lists_explicit_targets_for_special_actions():
    scene = PolicyCascadeScene("policy", "")
    scene.state["social_network"] = {
        "Top": ["Mid A", "Mid B"],
        "Mid A": ["Low"],
        "Mid B": ["Low"],
        "Low": [],
    }
    scene.state["informal_network"] = {
        "Mid A": ["Mid B"],
        "Mid B": ["Mid A"],
    }
    agents = [
        _build_agent("Top", "top"),
        _build_agent("Mid A", "mid"),
        _build_agent("Mid B", "mid"),
        _build_agent("Low", "low"),
    ]
    simulator = _build_simulator(scene, agents)

    scene.state["latest_policy"] = "执行要求：继续推进落实"
    scene.state["source_policy"] = "执行要求：继续推进落实"
    scene.state["relayed_policy"] = "执行要求：继续推进落实"
    scene.state["task_mode"] = "follow_up"
    scene.state["policy_version"] = 1
    scene.state["processed_policy_version"] = 1

    scene.parse_and_handle_action(
        {"action": "consult_peer", "target": "Mid B", "message": "我们先对齐执行口径。"},
        agents[1],
        simulator,
    )

    prompt = scene.get_agent_status_prompt(agents[2])

    assert "如果你只是回应当前线程，请优先使用 send_message" in prompt
    assert "若要 report_upward，target 只能写：Top" in prompt
    assert "若要 consult_peer，target 必须明确写出：Mid A" in prompt


def test_follow_up_thread_prompt_requires_reacting_to_new_protest_shock():
    scene = PolicyCascadeScene("policy", "")
    scene.state["social_network"] = {
        "Top": ["Mid A", "Mid B"],
        "Mid A": ["Low"],
        "Mid B": ["Low"],
        "Low": [],
    }
    scene.state["informal_network"] = {
        "Mid A": ["Mid B"],
        "Mid B": ["Mid A"],
    }
    agents = [
        _build_agent("Top", "top"),
        _build_agent("Mid A", "mid"),
        _build_agent("Mid B", "mid"),
        _build_agent("Low", "low"),
    ]
    simulator = _build_simulator(scene, agents)

    scene.state["latest_policy"] = "执行要求：继续推进落实"
    scene.state["source_policy"] = "执行要求：继续推进落实"
    scene.state["relayed_policy"] = "执行要求：继续推进落实"
    scene.state["task_mode"] = "follow_up"
    scene.state["policy_version"] = 1
    scene.state["processed_policy_version"] = 1
    scene.parse_and_handle_action(
        {"action": "consult_peer", "target": "Mid B", "message": "我们先讨论执行成本和时限冲突。"},
        agents[1],
        simulator,
    )
    scene.on_event(simulator, "environment", {"description": "公民在接收到此政策后发生抗议游行事件。"})

    prompt = scene.get_agent_status_prompt(agents[2])

    assert "最新外部冲击是公众抗议/舆情升级" in prompt
    assert "不能继续原样复述" in prompt


def test_cascade_prompt_does_not_leak_peer_interpretations():
    scene = PolicyCascadeScene("policy", "")
    scene.state["social_network"] = {
        "Top A": ["Mid A"],
        "Top B": ["Mid B"],
        "Mid A": ["Low A"],
        "Mid B": ["Low B"],
        "Low A": [],
        "Low B": [],
    }
    agents = [
        _build_agent("Top A", "top"),
        _build_agent("Top B", "top"),
        _build_agent("Mid A", "mid"),
        _build_agent("Mid B", "mid"),
        _build_agent("Low A", "low"),
        _build_agent("Low B", "low"),
    ]
    simulator = _build_simulator(scene, agents)

    simulator.broadcast(PublicEvent("「系统公告」 级联隔离测试\n目标：各支路独立下传"), receivers=["Top A", "Top B"])
    scene.parse_and_handle_action({"action": "send_message", "message": "Top A version"}, agents[0], simulator)
    scene.post_turn(agents[0], simulator)
    scene.parse_and_handle_action({"action": "send_message", "message": "Top B version"}, agents[1], simulator)
    scene.post_turn(agents[1], simulator)
    scene.parse_and_handle_action({"action": "send_message", "message": "Mid A version"}, agents[2], simulator)
    scene.post_turn(agents[2], simulator)
    scene.parse_and_handle_action({"action": "send_message", "message": "Mid B version"}, agents[3], simulator)
    scene.post_turn(agents[3], simulator)

    prompt = scene.get_agent_status_prompt(agents[5])

    assert "当前存在可竞争的解释口径" not in prompt
    assert "Low A" not in prompt
    assert "Mid A version" not in prompt


def test_invalid_special_action_does_not_consume_active_thread():
    scene = PolicyCascadeScene("policy", "")
    scene.state["social_network"] = {
        "Top": ["Mid A", "Mid B"],
        "Mid A": ["Low"],
        "Mid B": ["Low"],
        "Low": [],
    }
    scene.state["informal_network"] = {
        "Mid A": ["Mid B"],
        "Mid B": ["Mid A"],
    }
    agents = [
        _build_agent("Top", "top"),
        _build_agent("Mid A", "mid"),
        _build_agent("Mid B", "mid"),
        _build_agent("Low", "low"),
    ]
    simulator = _build_simulator(scene, agents)

    scene.state["latest_policy"] = "执行要求：继续推进落实"
    scene.state["source_policy"] = "执行要求：继续推进落实"
    scene.state["relayed_policy"] = "执行要求：继续推进落实"
    scene.state["task_mode"] = "follow_up"
    scene.state["policy_version"] = 1
    scene.state["processed_policy_version"] = 1
    scene.parse_and_handle_action(
        {"action": "consult_peer", "target": "Mid B", "message": "我们先对齐执行口径。"},
        agents[1],
        simulator,
    )

    success, result, summary, _, _ = scene.parse_and_handle_action(
        {"action": "consult_peer", "message": "继续协商。"},
        agents[2],
        simulator,
    )

    assert success is False
    assert "Provide 'target'" in result["error"]
    assert scene._private_event_for("Mid B")["task_mode"] == "follow_up_thread"


def test_peer_consult_thread_hides_redundant_consult_peer_action():
    scene = PolicyCascadeScene("policy", "")
    scene.state["social_network"] = {
        "Top": ["Mid A", "Mid B"],
        "Mid A": ["Low"],
        "Mid B": ["Low"],
        "Low": [],
    }
    scene.state["informal_network"] = {
        "Mid A": ["Mid B"],
        "Mid B": ["Mid A"],
    }
    agents = [
        _build_agent("Top", "top"),
        _build_agent("Mid A", "mid"),
        _build_agent("Mid B", "mid"),
        _build_agent("Low", "low"),
    ]
    simulator = _build_simulator(scene, agents)

    scene.state["latest_policy"] = "执行要求：继续推进落实"
    scene.state["source_policy"] = "执行要求：继续推进落实"
    scene.state["relayed_policy"] = "执行要求：继续推进落实"
    scene.state["task_mode"] = "follow_up"
    scene.state["policy_version"] = 1
    scene.state["processed_policy_version"] = 1
    scene.parse_and_handle_action(
        {"action": "consult_peer", "target": "Mid B", "message": "我们先对齐执行口径。"},
        agents[1],
        simulator,
    )

    action_names = [action.NAME for action in scene.get_scene_actions(agents[2])]

    assert "consult_peer" not in action_names
    assert "send_message" in action_names


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


def test_follow_up_consult_peer_without_target_uses_single_available_peer():
    scene = PolicyCascadeScene("policy", "")
    scene.state["informal_network"] = {
        "Top A": ["Top B"],
        "Top B": ["Top A"],
    }
    agents = [
        _build_agent("Top A", "top"),
        _build_agent("Top B", "top"),
        _build_agent("Mid", "mid"),
    ]
    simulator = _build_simulator(scene, agents)

    scene.state["latest_policy"] = "既有政策"
    scene.state["source_policy"] = "既有政策"
    scene.state["relayed_policy"] = "既有政策"
    scene.state["policy_version"] = 1
    scene.state["processed_policy_version"] = 1
    scene.reset_for_run()

    success, result, _, _, _ = scene.parse_and_handle_action(
        {"action": "consult_peer", "message": "我们先对齐执行口径。"},
        agents[0],
        simulator,
    )

    assert success is True
    assert result["target"] == "Top B"
    assert scene._private_event_for("Top B")["thread_kind"] == "peer_consult"


def test_follow_up_notify_subordinate_without_target_uses_mentioned_name():
    scene = PolicyCascadeScene("policy", "")
    scene.state["social_network"] = {
        "Top": ["Mid A", "Mid B"],
        "Mid A": [],
        "Mid B": [],
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

    success, result, _, _, _ = scene.parse_and_handle_action(
        {"action": "notify_subordinate", "message": "请 Mid B 在24小时内补充排查清单。"},
        agents[0],
        simulator,
    )

    assert success is True
    assert result["target"] == "Mid B"
    assert scene._private_event_for("Mid B")["thread_kind"] == "subordinate_notice"


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


def test_private_broadcast_always_starts_cascade_even_without_policy_markers():
    scene = PolicyCascadeScene("policy", "", cascade_mode="strict_cascade")
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

    simulator.broadcast(PublicEvent("只发给一个人的私有广播"), receivers=["Top"])

    assert scene._private_event_for("Top")["task_mode"] == "cascade"
    assert scene.should_skip_turn(agents[0], simulator) is False
    assert scene.should_skip_turn(agents[1], simulator) is True

    scene.parse_and_handle_action({"action": "send_message", "message": "向下继续传递"}, agents[0], simulator)
    scene.post_turn(agents[0], simulator)

    assert scene._private_event_for("Mid")["task_mode"] == "cascade"
    assert scene._private_event_for("Low") == {}


def test_environment_event_never_restarts_policy_cascade():
    scene = PolicyCascadeScene("policy", "", cascade_mode="strict_cascade")
    agents = [
        _build_agent("Top", "top"),
        _build_agent("Mid", "mid"),
    ]
    simulator = _build_simulator(scene, agents)

    scene.state["latest_policy"] = "既有政策"
    scene.state["source_policy"] = "既有政策"
    scene.state["relayed_policy"] = "既有政策"
    scene.state["task_mode"] = "follow_up"
    scene.state["policy_version"] = 3
    scene.state["processed_policy_version"] = 3

    scene.on_event(simulator, "environment", {"description": "原文：这是一条看起来像政策的环境事件"})

    assert scene.state["task_mode"] == "follow_up"
    assert scene.state["latest_policy"] == "既有政策"
    assert scene.state["latest_notice"] == "原文：这是一条看起来像政策的环境事件"


def test_blank_broadcast_does_not_restart_or_override_notice():
    scene = PolicyCascadeScene("policy", "", cascade_mode="strict_cascade")
    agents = [
        _build_agent("Top", "top"),
        _build_agent("Mid", "mid"),
    ]
    simulator = _build_simulator(scene, agents)

    scene.state["latest_policy"] = "既有政策"
    scene.state["source_policy"] = "既有政策"
    scene.state["relayed_policy"] = "既有政策"
    scene.state["latest_notice"] = "既有公告"
    scene.state["task_mode"] = "follow_up"
    scene.state["policy_version"] = 3
    scene.state["processed_policy_version"] = 3

    scene.on_event(simulator, "broadcast", {"description": "「"})

    assert scene.state["task_mode"] == "follow_up"
    assert scene.state["latest_policy"] == "既有政策"
    assert scene.state["latest_notice"] == "既有公告"


def test_simtree_environment_branch_preserves_follow_up_mode():
    scene = PolicyCascadeScene("policy", "", cascade_mode="strict_cascade")
    agents = [
        _build_agent("Top", "top"),
        _build_agent("Mid", "mid"),
    ]
    simulator = _build_simulator(scene, agents)

    scene.state["latest_policy"] = "既有政策"
    scene.state["source_policy"] = "既有政策"
    scene.state["relayed_policy"] = "既有政策"
    scene.state["task_mode"] = "follow_up"
    scene.state["policy_version"] = 3
    scene.state["processed_policy_version"] = 3

    tree = SimTree.new(simulator, simulator.clients)
    child = tree.branch(tree.root, [{"op": "environment_event", "text": "公民在接收到此政策后发生抗议游行事件。", "event_type": "environment"}])
    branch_scene = tree.nodes[child]["sim"].scene

    assert tree.nodes[child]["edge_type"] == "environment_event"
    assert branch_scene.state["task_mode"] == "follow_up"
    assert branch_scene.state["latest_policy"] == "既有政策"
    assert branch_scene.state["latest_notice"] == "公民在接收到此政策后发生抗议游行事件。"


def test_follow_up_status_prompt_prioritizes_latest_notice_over_old_policy():
    scene = PolicyCascadeScene("policy", "", cascade_mode="strict_cascade")
    agents = [
        _build_agent("Top", "top"),
        _build_agent("Mid", "mid"),
    ]
    simulator = _build_simulator(scene, agents)
    scene.simulator = simulator

    scene.state["latest_policy"] = "旧政策：继续按既有方案执行。"
    scene.state["source_policy"] = "旧政策：继续按既有方案执行。"
    scene.state["relayed_policy"] = "旧政策：继续按既有方案执行。"
    scene.state["latest_notice"] = "新的环境事件：群众抗议升级，要求重新解释执行口径。"
    scene.state["task_mode"] = "follow_up"

    prompt = scene.get_agent_status_prompt(agents[1])

    assert "最新系统公告优先级高于既有政策传达版本" in prompt
    assert "旧政策只作为背景" in prompt
    assert "最新系统公告：新的环境事件：群众抗议升级，要求重新解释执行口径。" in prompt
    assert "仅作背景，不是最新系统公告" in prompt


def test_ordinary_environment_event_raises_public_opinion_pressure():
    scene = PolicyCascadeScene("policy", "", cascade_mode="strict_cascade")
    agents = [
        _build_agent("Top", "top"),
        _build_agent("Mid", "mid"),
    ]
    simulator = _build_simulator(scene, agents)

    scene.state["latest_policy"] = "既有政策"
    scene.state["source_policy"] = "既有政策"
    scene.state["relayed_policy"] = "既有政策"
    scene.state["task_mode"] = "follow_up"
    scene.state["policy_version"] = 2
    scene.state["processed_policy_version"] = 2

    scene.on_event(simulator, "environment", {"description": "公民在接收到此政策后发生抗议游行事件。"})

    assert scene.state["task_mode"] == "follow_up"
    assert scene.state["persistent_conditions"]["public_opinion_pressure"] >= 0.75


def test_protest_environment_event_triggers_follow_up_threads_on_next_run():
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

    scene.state["latest_policy"] = "执行要求：继续推进落实"
    scene.state["source_policy"] = "执行要求：继续推进落实"
    scene.state["relayed_policy"] = "执行要求：继续推进落实"
    scene.state["task_mode"] = "follow_up"
    scene.state["policy_version"] = 1
    scene.state["processed_policy_version"] = 1

    scene.on_event(simulator, "environment", {"description": "公民在接收到此政策后发生抗议游行事件。"})
    scene.reset_for_run()

    upward_threads = [
        thread for thread in scene._thread_store().values()
        if thread.get("kind") == "upward_feedback" and thread.get("root_sender") == "Low"
    ]
    assert upward_threads


def test_positive_environment_event_reduces_public_opinion_pressure_and_suppresses_auto_feedback():
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

    scene.state["latest_policy"] = "继续推进落实"
    scene.state["source_policy"] = "继续推进落实"
    scene.state["relayed_policy"] = "继续推进落实"
    scene.state["task_mode"] = "follow_up"
    scene.state["policy_version"] = 1
    scene.state["processed_policy_version"] = 1
    scene.state["persistent_conditions"] = {"public_opinion_pressure": 0.85}

    scene.on_event(simulator, "environment", {"description": "群众表示对这项政策很满意，普遍支持，整体反响良好。"})

    assert scene.state["persistent_conditions"]["public_opinion_pressure"] <= 0.15

    scene.reset_for_run()

    upward_threads = [
        thread for thread in scene._thread_store().values()
        if thread.get("kind") == "upward_feedback" and thread.get("root_sender") == "Low"
    ]
    assert not upward_threads


def test_strict_cascade_low_tier_does_not_leak_to_same_tier_peers():
    scene = PolicyCascadeScene("policy", "", cascade_mode="strict_cascade")
    scene.state["social_network"] = {
        "Top": ["Mid"],
        "Mid": ["Low A", "Low B"],
        "Low A": ["Low B"],
        "Low B": [],
    }
    agents = [
        _build_agent("Top", "top"),
        _build_agent("Mid", "mid"),
        _build_agent("Low A", "low"),
        _build_agent("Low B", "low"),
    ]
    simulator = _build_simulator(scene, agents)

    simulator.broadcast(PublicEvent("原文：严格模式下逐级传递"), receivers=["Top"])
    scene.parse_and_handle_action({"action": "send_message", "message": "原文：严格模式下逐级传递\n补充：高层说明"}, agents[0], simulator)
    scene.post_turn(agents[0], simulator)
    scene.parse_and_handle_action({"action": "send_message", "message": "原文：严格模式下逐级传递\n补充：中层说明"}, agents[1], simulator)
    scene.post_turn(agents[1], simulator)

    low_b_before = list(getattr(agents[3], "env_feedback", []) or [])
    scene.parse_and_handle_action({"action": "send_message", "message": "原文：严格模式下逐级传递\n补充：基层说明"}, agents[2], simulator)
    scene.post_turn(agents[2], simulator)
    low_b_after = list(getattr(agents[3], "env_feedback", []) or [])

    assert low_b_after == low_b_before


def test_follow_up_actions_are_hidden_during_cascade_but_available_in_follow_up():
    scene = PolicyCascadeScene("policy", "")
    agents = [
        _build_agent("Top", "top"),
        _build_agent("Mid", "mid"),
    ]
    _build_simulator(scene, agents)

    scene.state["task_mode"] = "cascade"
    cascade_actions = [action.NAME for action in scene.get_scene_actions(agents[0])]

    scene.state["task_mode"] = "follow_up"
    follow_up_actions = [action.NAME for action in scene.get_scene_actions(agents[0])]

    assert cascade_actions == ["send_message", "yield"]
    assert "report_upward" in follow_up_actions
    assert "consult_peer" in follow_up_actions


def test_follow_up_mode_auto_seeds_upward_feedback():
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
    _build_simulator(scene, agents)

    scene.state["latest_policy"] = "执行要求：本周内完成排查\n报告要求：5个工作日内报送\n资源支持：现有资源不足"
    scene.state["source_policy"] = scene.state["latest_policy"]
    scene.state["relayed_policy"] = scene.state["latest_policy"]
    scene.state["policy_version"] = 1
    scene.state["processed_policy_version"] = 1
    scene.state["persistent_conditions"] = {"resource_shortage": 0.8}

    scene.reset_for_run()

    upward_threads = [
        thread for thread in scene._thread_store().values()
        if thread.get("kind") == "upward_feedback" and thread.get("root_sender") == "Low" and thread.get("root_recipient") == "Mid"
    ]
    assert upward_threads


def test_strict_follow_up_does_not_auto_escalate_after_single_ignored_feedback():
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

    scene.state["latest_policy"] = "执行要求：本周内完成排查"
    scene.state["source_policy"] = scene.state["latest_policy"]
    scene.state["relayed_policy"] = scene.state["latest_policy"]
    scene.state["policy_version"] = 1
    scene.state["processed_policy_version"] = 1
    thread = scene._open_thread("upward_feedback", agents[2], "Mid", "此前已反馈执行困难。", simulator, {"policy_version": 1})
    scene._ignore_thread(thread, agents[1], simulator)
    scene.state["private_events"] = {}
    scene.state["thread_inboxes"] = {}

    scene.reset_for_run()

    escalation_threads = [
        item for item in scene._thread_store().values()
        if item.get("kind") == "escalation" and item.get("root_sender") == "Low" and item.get("root_recipient") == "Top"
    ]
    assert not escalation_threads


def test_strict_follow_up_auto_escalates_only_after_multiple_failed_rounds():
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

    scene.state["latest_policy"] = "执行要求：本周内完成排查"
    scene.state["source_policy"] = scene.state["latest_policy"]
    scene.state["relayed_policy"] = scene.state["latest_policy"]
    scene.state["policy_version"] = 1
    scene.state["processed_policy_version"] = 1
    scene.state["persistent_conditions"] = {"resource_shortage": 0.85, "assessment_cycle": 0.6}

    first = scene._open_thread("upward_feedback", agents[2], "Mid", "第一次反馈执行困难。", simulator, {"policy_version": 1})
    scene._ignore_thread(first, agents[1], simulator)
    second = scene._open_thread("upward_feedback", agents[2], "Mid", "第二次反馈执行困难。", simulator, {"policy_version": 1})
    scene._ignore_thread(second, agents[1], simulator)
    scene.state["private_events"] = {}
    scene.state["thread_inboxes"] = {}

    scene.reset_for_run()

    escalation_threads = [
        item for item in scene._thread_store().values()
        if item.get("kind") == "escalation" and item.get("root_sender") == "Low" and item.get("root_recipient") == "Top"
    ]
    assert escalation_threads


def test_strict_follow_up_does_not_create_skip_level_complaint_on_first_severe_risk_round():
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
    _build_simulator(scene, agents)

    scene.state["latest_policy"] = '不可改写条款：\n“6 个月内”\n“10% 的阶段性下调”\n执行要求：立即完成'
    scene.state["source_policy"] = scene.state["latest_policy"]
    scene.state["relayed_policy"] = scene.state["latest_policy"]
    scene.state["policy_version"] = 1
    scene.state["processed_policy_version"] = 1
    scene.state["persistent_conditions"] = {"resource_shortage": 0.85}
    scene.state["branch_interpretations"] = {
        "Mid": {
            "agent": "Mid",
            "tier": "mid",
            "message": "当前只保留一般执行要求，暂不强调具体硬约束。",
            "policy_version": 1,
        }
    }

    scene.reset_for_run()

    complaint_threads = [
        item for item in scene._thread_store().values()
        if item.get("kind") == "skip_level_complaint" and item.get("root_sender") == "Low" and item.get("root_recipient") == "Top"
    ]
    assert not complaint_threads


def test_strict_follow_up_creates_skip_level_complaint_only_after_extreme_failed_rounds():
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

    scene.state["latest_policy"] = '不可改写条款：\n“6 个月内”\n“10% 的阶段性下调”\n执行要求：立即完成'
    scene.state["source_policy"] = scene.state["latest_policy"]
    scene.state["relayed_policy"] = scene.state["latest_policy"]
    scene.state["policy_version"] = 1
    scene.state["processed_policy_version"] = 1
    scene.state["persistent_conditions"] = {"resource_shortage": 0.9, "assessment_cycle": 0.9}
    scene.state["branch_interpretations"] = {
        "Mid": {
            "agent": "Mid",
            "tier": "mid",
            "message": "当前只保留一般执行要求，暂不强调具体硬约束。",
            "policy_version": 1,
        }
    }

    first = scene._open_thread("upward_feedback", agents[2], "Mid", "第一次反馈重大执行风险。", simulator, {"policy_version": 1})
    scene._ignore_thread(first, agents[1], simulator)
    second = scene._open_thread("upward_feedback", agents[2], "Mid", "第二次反馈重大执行风险。", simulator, {"policy_version": 1})
    scene._ignore_thread(second, agents[1], simulator)
    third = scene._open_thread("upward_feedback", agents[2], "Mid", "第三次反馈重大执行风险。", simulator, {"policy_version": 1})
    scene._ignore_thread(third, agents[1], simulator)
    scene.state["private_events"] = {}
    scene.state["thread_inboxes"] = {}

    scene.reset_for_run()

    complaint_threads = [
        item for item in scene._thread_store().values()
        if item.get("kind") == "skip_level_complaint" and item.get("root_sender") == "Low" and item.get("root_recipient") == "Top"
    ]
    assert complaint_threads


def test_follow_up_mode_auto_creates_peer_consultation():
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
    _build_simulator(scene, agents)

    scene.state["latest_policy"] = "既有政策"
    scene.state["source_policy"] = "既有政策"
    scene.state["relayed_policy"] = "既有政策"
    scene.state["policy_version"] = 1
    scene.state["processed_policy_version"] = 1
    scene.state["branch_interpretations"] = {
        "Mid B": {
            "agent": "Mid B",
            "tier": "mid",
            "message": "我主张先内部消化再执行。",
            "policy_version": 1,
        }
    }

    scene.reset_for_run()

    consult_threads = [
        item for item in scene._thread_store().values()
        if item.get("kind") == "peer_consult" and item.get("root_sender") == "Mid A" and item.get("root_recipient") == "Mid B"
    ]
    assert consult_threads


def test_strict_follow_up_prioritizes_peer_consultation_before_upward_feedback_for_mid_tier():
    scene = PolicyCascadeScene("policy", "")
    scene.state["social_network"] = {
        "Top": ["Mid A", "Mid B"],
        "Mid A": ["Low"],
        "Mid B": ["Low"],
        "Low": [],
    }
    scene.state["informal_network"] = {
        "Mid A": ["Mid B"],
        "Mid B": ["Mid A"],
    }
    agents = [
        _build_agent("Top", "top"),
        _build_agent("Mid A", "mid"),
        _build_agent("Mid B", "mid"),
        _build_agent("Low", "low"),
    ]
    _build_simulator(scene, agents)

    scene.state["latest_policy"] = "执行要求：本周内完成排查\n资源支持：现有资源不足"
    scene.state["source_policy"] = scene.state["latest_policy"]
    scene.state["relayed_policy"] = scene.state["latest_policy"]
    scene.state["policy_version"] = 1
    scene.state["processed_policy_version"] = 1
    scene.state["persistent_conditions"] = {"resource_shortage": 0.8}
    scene.state["branch_interpretations"] = {
        "Mid B": {
            "agent": "Mid B",
            "tier": "mid",
            "message": "我主张先压缩执行范围。",
            "policy_version": 1,
        }
    }

    scene.reset_for_run()

    consult_threads = [
        item for item in scene._thread_store().values()
        if item.get("kind") == "peer_consult" and item.get("root_sender") == "Mid A" and item.get("root_recipient") == "Mid B"
    ]
    upward_threads = [
        item for item in scene._thread_store().values()
        if item.get("kind") == "upward_feedback" and item.get("root_sender") == "Mid A"
    ]
    assert consult_threads
    assert not upward_threads


def test_strict_mode_hides_policy_adjustment_before_extreme_risk():
    scene = PolicyCascadeScene("policy", "", cascade_mode="strict_cascade")
    agents = [
        _build_agent("Top", "top"),
        _build_agent("Mid", "mid"),
        _build_agent("Low", "low"),
    ]
    _build_simulator(scene, agents)

    scene.state["latest_policy"] = "执行要求：继续推进落实"
    scene.state["source_policy"] = "执行要求：继续推进落实"
    scene.state["relayed_policy"] = "执行要求：继续推进落实"
    scene.state["task_mode"] = "follow_up"
    scene.state["policy_version"] = 1
    scene.state["processed_policy_version"] = 1
    scene.state["persistent_conditions"] = {
        "resource_shortage": 0.5,
        "assessment_cycle": 0.55,
        "public_opinion_pressure": 0.3,
    }

    action_names = [action.NAME for action in scene.get_scene_actions(agents[0])]

    assert "announce_policy_adjustment" not in action_names


def test_distortion_mode_hides_policy_adjustment_without_meaningful_pressure():
    scene = PolicyCascadeScene("policy", "", cascade_mode="distortion_cascade")
    agents = [
        _build_agent("Top", "top"),
        _build_agent("Mid", "mid"),
        _build_agent("Low", "low"),
    ]

    scene.state["latest_policy"] = "执行要求：继续推进落实"
    scene.state["source_policy"] = "执行要求：继续推进落实"
    scene.state["relayed_policy"] = "执行要求：继续推进落实"
    scene.state["task_mode"] = "follow_up"
    scene.state["policy_version"] = 1
    scene.state["processed_policy_version"] = 1
    scene.state["persistent_conditions"] = {
        "resource_shortage": 0.2,
        "assessment_cycle": 0.2,
        "public_opinion_pressure": 0.2,
    }

    action_names = [action.NAME for action in scene.get_scene_actions(agents[0])]

    assert "announce_policy_adjustment" not in action_names


def test_strict_mode_allows_policy_adjustment_only_under_extreme_pressure():
    scene = PolicyCascadeScene("policy", "", cascade_mode="strict_cascade")
    agents = [
        _build_agent("Top", "top"),
        _build_agent("Mid", "mid"),
        _build_agent("Low", "low"),
    ]
    simulator = _build_simulator(scene, agents)

    scene.state["latest_policy"] = "执行要求：继续推进落实"
    scene.state["source_policy"] = "执行要求：继续推进落实"
    scene.state["relayed_policy"] = "执行要求：继续推进落实"
    scene.state["task_mode"] = "follow_up"
    scene.state["policy_version"] = 1
    scene.state["processed_policy_version"] = 1
    scene.state["persistent_conditions"] = {
        "public_opinion_pressure": 0.95,
        "inspection_pressure": 0.82,
    }

    action_names = [action.NAME for action in scene.get_scene_actions(agents[0])]
    assert "announce_policy_adjustment" in action_names

    success, result, summary, _, _ = scene.parse_and_handle_action(
        {"action": "announce_policy_adjustment", "message": "请将执行期限延长并追加资源。"},
        agents[0],
        simulator,
    )

    assert success is True
    assert "政策调整" in result["message"]
    assert "发布了新的政策调整" in summary


def test_follow_up_thread_prompt_bans_generic_filler_reply():
    scene = PolicyCascadeScene("policy", "", cascade_mode="strict_cascade")
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

    scene.state["latest_policy"] = "执行要求：继续推进落实"
    scene.state["source_policy"] = "执行要求：继续推进落实"
    scene.state["relayed_policy"] = "执行要求：继续推进落实"
    scene.state["private_events"] = {
        "Mid": {
            "task_mode": "follow_up_thread",
            "thread_id": "thread-1",
            "thread_kind": "peer_consult",
            "thread_sender": "Low",
            "reply_target": "Low",
            "thread_message": "请明确新增资源或时限。",
            "thread_round_count": 2,
            "thread_history_excerpt": "第1轮 Low → Mid：请明确新增资源或时限。",
        }
    }

    prompt = scene.get_agent_status_prompt(agents[1])

    assert "禁止只写“已确认”" in prompt
    assert "若你提不出新的具体点，就直接使用固定的无动作句" in prompt


def test_follow_up_yield_with_no_action_signal_becomes_fixed_message():
    scene = PolicyCascadeScene("policy", "", cascade_mode="strict_cascade")
    agents = [
        _build_agent("Top", "top"),
        _build_agent("Mid", "mid"),
        _build_agent("Low", "low"),
    ]
    simulator = _build_simulator(scene, agents)

    scene.state["latest_policy"] = "执行要求：继续推进落实"
    scene.state["source_policy"] = "执行要求：继续推进落实"
    scene.state["relayed_policy"] = "执行要求：继续推进落实"
    scene.state["task_mode"] = "follow_up"
    scene.state["policy_version"] = 1
    scene.state["processed_policy_version"] = 1

    success, result, summary, _, _ = scene.parse_and_handle_action(
        {
            "action": "yield",
            "response": "当前已没有任何动作倾向，建议注入新的环境事件或发布新的政策。",
        },
        agents[0],
        simulator,
    )

    assert success is True
    assert result["message"] == "当前已没有任何动作倾向，建议注入新的环境事件或发布新的政策。"
    assert "Top" in scene.state["follow_up_no_action_agents"]


def test_follow_up_with_private_thread_still_allows_other_agents_to_react():
    scene = PolicyCascadeScene("policy", "", cascade_mode="strict_cascade")
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
    clients = {"chat": agents[0].llm_client, "default": agents[0].llm_client}
    seen_events = []
    simulator = Simulator(
        agents,
        scene,
        clients,
        event_handler=lambda event_type, data: seen_events.append((event_type, data)),
        ordering=SequentialOrdering(),
    )

    scene.state["latest_policy"] = "执行要求：继续推进落实"
    scene.state["source_policy"] = "执行要求：继续推进落实"
    scene.state["relayed_policy"] = "执行要求：继续推进落实"
    scene.state["task_mode"] = "follow_up"
    scene.state["policy_version"] = 1
    scene.state["processed_policy_version"] = 1
    scene.state["private_events"] = {
        "Mid": {
            "task_mode": "follow_up_thread",
            "thread_id": "thread-1",
            "thread_kind": "upward_feedback",
            "thread_sender": "Low",
            "reply_target": "Low",
            "thread_message": "请评估资源缺口。",
            "thread_status": "open",
        }
    }

    assert scene.should_skip_turn(agents[0], simulator) is False

    simulator.run(max_turns=3)

    top_process_starts = [
        data for event_type, data in seen_events
        if event_type == "agent_process_start" and data.get("agent") == "Top"
    ]
    top_idle = [
        data for event_type, data in seen_events
        if event_type == "agent_idle" and data.get("agent") == "Top"
    ]
    assert top_process_starts
    assert not top_idle


def test_invalid_cascade_action_with_message_falls_back_to_send_message():
    scene = PolicyCascadeScene("policy", "", cascade_mode="strict_cascade")
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

    simulator.broadcast(PublicEvent("「系统公告」 新政策\n目标：继续下传"), receivers=["Top"])

    success, result, _, _, _ = scene.parse_and_handle_action(
        {"action": "continue", "response": "我批准专项资源并启动逐级下传。"},
        agents[0],
        simulator,
    )

    assert success is True
    assert result["message"]
    assert scene._private_event_for("Mid")["task_mode"] == "cascade"


def test_follow_up_thread_with_legacy_thread_record_without_id_still_redirects():
    scene = PolicyCascadeScene("policy", "", cascade_mode="strict_cascade")
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

    scene.state["latest_policy"] = "执行要求：继续推进落实"
    scene.state["source_policy"] = "执行要求：继续推进落实"
    scene.state["relayed_policy"] = "执行要求：继续推进落实"
    scene.state["task_mode"] = "follow_up"
    scene.state["policy_version"] = 1
    scene.state["processed_policy_version"] = 1
    scene.state["conversation_threads"] = {
        "thread-1": {
            "kind": "peer_consult",
            "sender": "Top",
            "root_sender": "Top",
            "root_recipient": "Mid",
            "last_sender": "Top",
            "last_recipient": "Mid",
            "last_message": "请给出新的执行细节。",
            "status": "open",
            "history": [{"sender": "Top", "recipient": "Mid", "message": "请给出新的执行细节。", "kind": "peer_consult", "turn": 0}],
            "metadata": {},
        }
    }
    scene.state["private_events"] = {
        "Mid": {
            "task_mode": "follow_up_thread",
            "thread_id": "thread-1",
            "thread_kind": "peer_consult",
            "thread_sender": "Top",
            "reply_target": "Top",
            "thread_message": "请给出新的执行细节。",
            "thread_status": "open",
        }
    }

    success, result, _, _, _ = scene.parse_and_handle_action(
        {"action": "notify_subordinate", "target": "Low", "message": "请在24小时内补充排查清单。"},
        agents[1],
        simulator,
    )

    assert success is True
    assert result["thread_id"]
    assert scene._thread_for_id("thread-1")["id"] == "thread-1"
    assert scene._thread_for_id("thread-1")["status"] == "redirected"


def test_follow_up_no_action_agent_waits_for_next_broadcast():
    scene = PolicyCascadeScene("policy", "", cascade_mode="strict_cascade")
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
    seen_events = []
    simulator = Simulator(
        agents,
        scene,
        {"chat": agents[0].llm_client, "default": agents[0].llm_client},
        event_handler=lambda event_type, data: seen_events.append((event_type, data)),
        ordering=SequentialOrdering(),
    )

    scene.state["latest_policy"] = "执行要求：继续推进落实"
    scene.state["source_policy"] = "执行要求：继续推进落实"
    scene.state["relayed_policy"] = "执行要求：继续推进落实"
    scene.state["task_mode"] = "follow_up"
    scene.state["policy_version"] = 1
    scene.state["processed_policy_version"] = 1

    scene.parse_and_handle_action(
        {"action": "send_message", "message": "当前已没有任何动作倾向，建议注入新的环境事件或发布新的政策。"},
        agents[0],
        simulator,
    )

    assert scene.should_skip_turn(agents[0], simulator) is True
    assert "等待新的环境事件或下一轮政策广播" in scene.get_skip_reason(agents[0], simulator)

    simulator.run(max_turns=1)

    top_idle = [
        data for event_type, data in seen_events
        if event_type == "agent_idle" and data.get("agent") == "Top"
    ]
    assert top_idle


def test_follow_up_prompt_requires_reacting_to_new_environment_notice_even_without_private_thread():
    scene = PolicyCascadeScene("policy", "", cascade_mode="strict_cascade")
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

    scene.state["latest_policy"] = "执行要求：继续推进落实"
    scene.state["source_policy"] = "执行要求：继续推进落实"
    scene.state["relayed_policy"] = "执行要求：继续推进落实"
    scene.state["task_mode"] = "follow_up"
    scene.state["policy_version"] = 1
    scene.state["processed_policy_version"] = 1

    scene.on_event(simulator, "environment", {"description": "公民在接收到此政策后发生抗议游行事件。"})

    prompt = scene.get_agent_status_prompt(agents[0])

    assert "最新外部冲击是公众抗议/舆情升级" in prompt
    assert "不能继续原样复述" in prompt


def test_follow_up_prompt_includes_explicit_no_action_sentence():
    scene = PolicyCascadeScene("policy", "", cascade_mode="strict_cascade")
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

    scene.state["latest_policy"] = "执行要求：继续推进落实"
    scene.state["source_policy"] = "执行要求：继续推进落实"
    scene.state["relayed_policy"] = "执行要求：继续推进落实"
    scene.state["task_mode"] = "follow_up"
    scene.state["policy_version"] = 1
    scene.state["processed_policy_version"] = 1

    prompt = scene.get_agent_status_prompt(agents[0])

    assert "只要你仍有新的反馈、讨论、协商、上报、转办或调整动作倾向，就必须继续产生动作或回应" in prompt
    assert "当前已没有任何动作倾向，建议注入新的环境事件或发布新的政策。" in prompt


def test_new_environment_notice_clears_no_action_declarations():
    scene = PolicyCascadeScene("policy", "", cascade_mode="strict_cascade")
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

    scene.state["latest_policy"] = "执行要求：继续推进落实"
    scene.state["source_policy"] = "执行要求：继续推进落实"
    scene.state["relayed_policy"] = "执行要求：继续推进落实"
    scene.state["task_mode"] = "follow_up"
    scene.state["policy_version"] = 1
    scene.state["processed_policy_version"] = 1

    scene.parse_and_handle_action(
        {"action": "send_message", "message": "当前已没有任何动作倾向，建议注入新的环境事件或发布新的政策。"},
        agents[0],
        simulator,
    )

    assert scene.state["follow_up_no_action_agents"] == ["Top"]

    scene.on_event(simulator, "environment", {"description": "群众突然发起抗议游行。"})

    assert scene.state["follow_up_no_action_agents"] == []
