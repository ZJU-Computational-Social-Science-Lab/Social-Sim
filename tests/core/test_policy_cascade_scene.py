from socialsim4.core.scenes.policy_cascade_scene import PolicyCascadeScene


class _DummyAgent:
    def __init__(self):
        self.name = "Agent 2"
        self.role_prompt = "一位拥有丰富政治经验的中层官员"
        self.user_profile = ""
        self.properties = {"tier": "mid", "政治职位层级": "mid"}


def test_sanitize_message_strips_inline_think_marker():
    scene = PolicyCascadeScene("policy", "")

    cleaned = scene._sanitize_message(
        "资源：可申请沟通、人力和缓冲预算支持；目标：6个月内完成成本优化与岗位稳定；标准：10%阶段性下调 /think"
    )

    assert "/think" not in cleaned
    assert "10%阶段性下调" in cleaned


def test_distort_message_strips_inline_think_marker_from_final_output():
    scene = PolicyCascadeScene(
        "policy",
        "",
        cascade_mode="distortion_cascade",
        distortion_strength=0.35,
        conflict_sensitivity=0.35,
        block_probability=0.05,
    )
    scene.state["source_policy"] = """「系统公告」 关于实施阶段性薪酬调整与稳岗安排的通知
原文：
1. 政策目标：为应对当前经营压力，保障组织整体稳定运行，经研究决定，自下月起实施阶段性薪酬调整方案，在未来 6 个月内 完成成本优化与岗位稳定双重目标。
2. 调整范围：本次调整适用于中层及以下管理岗位、职能岗位和业务支持岗位；核心关键技术岗位和经专项认定的紧缺岗位，原则上暂不纳入本轮统一调整范围。
3. 调整标准：纳入调整范围的员工，按照现行月度固定薪酬标准，实施 10% 的阶段性下调。"""
    scene.state["relayed_policy"] = scene.state["source_policy"]
    scene.state["latest_notice"] = scene.state["source_policy"]

    distorted = scene._distort_message(
        _DummyAgent(),
        "mid",
        "资源：可申请沟通、人力和缓冲预算支持；目标：6个月内完成成本优化与岗位稳定；范围：中层及以下，关键岗位原则上暂不纳入；标准：10%阶段性下调 /think",
    )

    assert "/think" not in distorted
    assert "10%阶段性下调" in distorted