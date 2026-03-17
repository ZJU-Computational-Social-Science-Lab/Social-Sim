from socialsim4.core.scenes.policy_cascade_scene import PolicyCascadeScene


class _LowTierAgent:
    def __init__(self):
        self.name = "Agent 3"
        self.role_prompt = "一名基层社区工作者，负责社区服务和日常管理"
        self.user_profile = ""
        self.properties = {"tier": "low", "政治职位层级": "low"}


def test_notice_normalization_rewrites_mid_tier_high_level_copy():
    scene = PolicyCascadeScene("policy", "")
    scene.state["latest_notice"] = "A configurable multi-level hierarchy must transmit a policy from top to bottom."
    scene.state["notice_kind"] = "execution"

    normalized = scene._normalize_notice_message(
        "mid",
        "关于系统公告，我将明确总体目标：构建跨层级协同治理机制，确保政策执行链条的连续性与有效性。同时，我将统筹资源调配与督促检查机制，强化各层级的责任落实。",
    )

    assert "任务拆解" in normalized
    assert "跨部门协调" in normalized
    assert "总体目标" not in normalized
    assert "资源调配" not in normalized


def test_low_parameter_distortion_does_not_block_low_tier_by_default():
    scene = PolicyCascadeScene(
        "policy",
        "",
        cascade_mode="distortion_cascade",
        distortion_strength=0.30,
        conflict_sensitivity=0.30,
        block_probability=0.05,
    )
    policy = """「系统公告」 关于开展高风险算法应用排查与标识工作的通知
1. 目标：在未来 4 个月内，完成全域高风险算法应用场景的排查，并实现 100% 风险场景标识到位。
2. 执行要求：各单位需对现有算法应用进行全面梳理，识别涉及招聘筛选、信贷评估、价格推荐、用户画像等高风险场景，并完成分类登记、风险标识及处置建议。
3. 不可改写条款（必须原样保留）：
“4 个月内”
“100% 风险场景标识到位”
“完成分类登记、风险标识及处置建议”
4. 资源支持：如需引入第三方评估机构、专项培训或系统改造支持，请在首次反馈中提出需求与量化依据。
5. 责任分工：各层级需明确一名负责人统筹排查、标识与处置建议的落实，并确保逐级传达。"""
    scene.state["source_policy"] = policy
    scene.state["relayed_policy"] = policy
    scene.state["latest_notice"] = policy

    agent = _LowTierAgent()

    assert scene._block_tendency(agent, "low") < 0.5
    assert scene._should_block(agent, "low") is False


def test_initial_broadcast_stays_notice_even_if_it_looks_like_policy():
    scene = PolicyCascadeScene("policy", "关于开展排查工作的通知\n目标：四个月内完成整治")

    assert scene._should_enter_cascade(scene.initial_event.content, "broadcast") is False