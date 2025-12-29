# tests/backend/test_simtree_clone_stability.py
"""
测试目标：SimTree 克隆流程 & 仿真内核稳定性

覆盖点：
1）SimTree 克隆流程中的深拷贝 & 自检逻辑：
   - agents/scene/event_queue/ordering 不共享引用；
   - agent 集合 & 数量一致；
   - ordering 类型一致、serialize 状态一致；
   - clone 的 event_queue 已 reset 为空；
   - plan_state / scene.state 为深拷贝语义。

2）场景与 ordering 覆盖：
   - simple_chat_zh      -> SequentialOrdering
   - council_scene       -> SequentialOrdering
   - landlord_scene      -> ControlledOrdering
   - werewolf_scene      -> CycledOrdering
   - village_scene       -> SequentialOrdering（如果 default_map.json 存在则测试，否则跳过）

3）多级克隆链路压测：
   - 对同一个场景连续执行多次“serialize -> deserialize -> reset_event_queue -> _check_simulator_clone”，
     模拟 advance_chain 场景下的重复克隆，确保不会出现状态污染。

4）负向用例：
   - 故意破坏 clone 的不变量（event_queue 非空、agents 共享、ordering 共享），
     验证 _check_simulator_clone 会抛出 SimCloneError，证明断言“是活的”。
"""

from __future__ import annotations

import sys
from copy import deepcopy
from pathlib import Path

import pytest

# ---- 确保 src/ 在 sys.path 中，方便直接 import socialsim4.* ----
ROOT = Path(__file__).resolve().parents[2]       # /.../socialsim4
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from socialsim4.core.simtree import SimTree, SimCloneError
from socialsim4.core.simulator import Simulator
from socialsim4.scenarios.basic import (
    build_simple_chat_sim_chinese,
    build_council_sim,
    build_landlord_sim,
    build_werewolf_sim,
    build_village_sim,
)

# ----------------------------------------------------------------------
# 辅助：构造一个“不会真正调 LLM”的 dummy client
# ----------------------------------------------------------------------


class _DummyLLM:
    """极简 Dummy LLM：即使被调用也返回一个合法的 Thoughts/Plan/Action 块。"""

    def chat(self, messages):
        # 返回一个最小可解析的响应，避免 agent.process 解析时崩溃
        return (
            "--- Thoughts ---\n"
            "Dummy thoughts.\n\n"
            "--- Plan ---\n"
            "1. Do nothing. [CURRENT]\n\n"
            "--- Action ---\n"
            '<Action name="yield" />\n\n'
            "--- Plan Update ---\n"
            "no change\n"
        )


def make_dummy_clients() -> dict:
    c = _DummyLLM()
    return {"chat": c, "default": c}


# ----------------------------------------------------------------------
# 辅助：按 kind 构造真实场景的 Simulator
# ----------------------------------------------------------------------


def make_simulator(kind: str) -> Simulator:
    """返回一个真实场景的 Simulator，但 LLM client 是 dummy。"""
    clients = make_dummy_clients()

    if kind == "simple_chat_zh":
        return build_simple_chat_sim_chinese(clients=clients, event_logger=None)
    if kind == "council":
        return build_council_sim(clients=clients, event_logger=None)
    if kind == "landlord":
        return build_landlord_sim(clients=clients, event_logger=None)
    if kind == "werewolf":
        return build_werewolf_sim(clients=clients, event_logger=None)
    if kind == "village":
        # basic.py 里是 Path(__file__).resolve().parents[2] / "scripts" / "default_map.json"
        # parents[2] 对于 src/socialsim4/scenarios/basic.py 来说正好是 src/
        map_path = SRC / "scripts" / "default_map.json"
        if not map_path.exists():
            pytest.skip(f"default_map.json not found at {map_path}, skip village_scene tests")
        return build_village_sim(clients=clients, event_logger=None)

    raise ValueError(f"Unknown simulator kind for test: {kind}")


SCENARIO_KINDS = ["simple_chat_zh", "council", "landlord", "werewolf", "village"]


def _make_clone_via_simulator(base_sim: Simulator) -> tuple[Simulator, SimTree]:
    """
    使用和 SimTree.new 完全一致的路径克隆一个 simulator：

    1）SimTree.new(base_sim, base_sim.clients) 先跑一遍，确保当前实现能通过自检；
    2）base_sim.serialize() 生成快照；
    3）Simulator.deserialize(snap, clients, log_handler=None) 生成 clone；
    4）clone.reset_event_queue() -> 模拟 _clone_simulator_from_node 里的重置行为；
    5）返回 (clone, tree) 方便后续直接用 tree._check_simulator_clone 做负向用例。
    """
    tree = SimTree.new(base_sim, base_sim.clients)
    snap = base_sim.serialize()
    cloned = Simulator.deserialize(snap, base_sim.clients, log_handler=None)
    # SimTree._clone_simulator_from_node 里会调用 reset_event_queue，这里也对齐
    cloned.reset_event_queue()
    return cloned, tree


# ----------------------------------------------------------------------
# 1) 正向：克隆后的 core 不变量（独立性 + 一致性）
# ----------------------------------------------------------------------


@pytest.mark.parametrize("kind", SCENARIO_KINDS)
def test_simtree_clone_independent_and_consistent(kind: str):
    """
    验证 _check_simulator_clone 的核心约束（在真实场景上）：
    1）clone 有 agent，且 agent 名称集合 & 数量与 base 完全一致；
    2）agents / scene / event_queue / ordering 不共享引用；
    3）每个 agent 实例不共享引用；
    4）ordering 类型一致，serialize 后的状态一致。
    """
    base_sim = make_simulator(kind)
    cloned_sim, _tree = _make_clone_via_simulator(base_sim)

    # 1）agent 集合 & 数量一致
    assert cloned_sim.agents, f"[{kind}] cloned simulator has no agents"
    base_names = set(base_sim.agents.keys())
    clone_names = set(cloned_sim.agents.keys())
    assert base_names == clone_names, f"[{kind}] agent name set mismatch"
    assert len(base_sim.agents) == len(cloned_sim.agents) > 0, f"[{kind}] agent count mismatch"

    # 2）顶层可变对象不共享引用
    assert id(base_sim.agents) != id(cloned_sim.agents), f"[{kind}] agents dict shared between base and clone"
    assert id(base_sim.scene) != id(cloned_sim.scene), f"[{kind}] scene shared between base and clone"
    assert id(base_sim.event_queue) != id(cloned_sim.event_queue), f"[{kind}] event_queue shared between base and clone"
    assert id(base_sim.ordering) != id(cloned_sim.ordering), f"[{kind}] ordering shared between base and clone"

    # 场景类型至少要一致
    assert type(base_sim.scene) is type(cloned_sim.scene), f"[{kind}] scene type mismatch"

    # 3）每个 agent 实例不共享
    for name, base_agent in base_sim.agents.items():
        clone_agent = cloned_sim.agents.get(name)
        assert clone_agent is not None, f"[{kind}] cloned simulator missing agent: {name}"
        assert id(base_agent) != id(clone_agent), f"[{kind}] agent instance shared: {name}"

    # 4）ordering 类型 + serialize 状态一致
    assert cloned_sim.ordering is not None, f"[{kind}] cloned ordering is None"
    assert base_sim.ordering is not None, f"[{kind}] base ordering is None"
    assert type(base_sim.ordering) is type(cloned_sim.ordering), f"[{kind}] ordering type mismatch"

    base_state = base_sim.ordering.serialize()
    clone_state = cloned_sim.ordering.serialize()
    assert base_state == clone_state, f"[{kind}] ordering state mismatch"


@pytest.mark.parametrize("kind", SCENARIO_KINDS)
def test_simtree_clone_event_queue_cleared_and_not_shared(kind: str):
    """
    验证克隆后（真实场景）：
    - clone 的 event_queue 已被 reset，为空；
    - event_queue 不共享引用，clone 上 emit_event_later 不会影响 base。
    """
    base_sim = make_simulator(kind)

    # 先在 base 上放一个事件，确保其 event_queue 非空
    base_sim.emit_event_later("test_base", {"kind": kind})
    assert not base_sim.event_queue.empty(), f"[{kind}] base event_queue should be non-empty before clone"

    cloned_sim, _tree = _make_clone_via_simulator(base_sim)

    # 克隆后的队列必须是新的，并且已经 reset 为空
    assert id(base_sim.event_queue) != id(cloned_sim.event_queue), f"[{kind}] event_queue shared between base and clone"
    assert cloned_sim.event_queue.empty(), f"[{kind}] cloned event_queue should be empty after clone"

    # 在 clone 上 emit 事件，不应影响 base 的队列大小
    before_qsize_base = base_sim.event_queue.qsize()
    cloned_sim.emit_event_later("test_clone", {"kind": kind})
    after_qsize_clone = cloned_sim.event_queue.qsize()
    after_qsize_base = base_sim.event_queue.qsize()

    assert after_qsize_clone == 1, f"[{kind}] cloned event_queue should have exactly one item"
    assert after_qsize_base == before_qsize_base, f"[{kind}] base event_queue size changed after clone emit"


@pytest.mark.parametrize("kind", SCENARIO_KINDS)
def test_simtree_clone_deepcopy_of_agent_and_scene_state(kind: str):
    """
    验证克隆是深拷贝语义，而不是浅拷贝：
    - 修改 clone.agent.plan_state 不会影响 base；
    - 修改 clone.scene.state 不会影响 base。
    这侧面证明 SimTree 克隆是通过 Simulator.serialize/deserialize（内部 deepcopy），而不是简单引用复制。
    """
    base_sim = make_simulator(kind)
    cloned_sim, _tree = _make_clone_via_simulator(base_sim)

    # 选一个 agent（任意一个即可）
    base_agent_name = next(iter(base_sim.agents.keys()))
    base_agent = base_sim.agents[base_agent_name]
    clone_agent = cloned_sim.agents[base_agent_name]

    # 记录 base 的原始状态
    base_plan_snapshot = deepcopy(base_agent.plan_state)
    base_scene_state_snapshot = deepcopy(base_sim.scene.state)

    # 修改 clone 的 plan_state 和 scene.state
    clone_agent.plan_state.setdefault("goals", []).append(
        {"id": "g_test", "desc": f"test-goal-{kind}", "priority": "normal", "status": "pending"}
    )
    cloned_sim.scene.state["__test_key__"] = f"from_clone_{kind}"

    # base 不应受到影响
    assert base_agent.plan_state == base_plan_snapshot, f"[{kind}] base agent plan_state was mutated by clone change"
    assert base_sim.scene.state == base_scene_state_snapshot, f"[{kind}] base scene.state was mutated by clone change"


@pytest.mark.parametrize("kind", SCENARIO_KINDS)
def test_simtree_new_does_not_raise_simcloneerror(kind: str):
    """
    冒烟测试：SimTree.new 在各个真实场景上调用内部克隆逻辑时，不应抛出 SimCloneError。
    这确保：
    - new() 会执行克隆 + 自检；
    - 当前实现满足自检的所有约束。
    """
    base_sim = make_simulator(kind)

    # 如果内部克隆逻辑或自检不满足约束，会抛出 SimCloneError
    try:
        tree = SimTree.new(base_sim, base_sim.clients)
    except SimCloneError as e:
        pytest.fail(f"[{kind}] SimTree.new raised SimCloneError unexpectedly: {e}")
    assert isinstance(tree, SimTree)


# ----------------------------------------------------------------------
# 2) 多级克隆链压测：连续多次 serialize/deserialize，模拟 advance_chain 场景
# ----------------------------------------------------------------------


@pytest.mark.parametrize("kind", ["village"])
def test_simtree_multi_level_clone_chain_no_state_leak(kind: str):
    """
    使用一个状态较复杂的场景（village），做多级克隆链压测：

    sim0 --clone--> sim1 --clone--> sim2 --clone--> ... --clone--> simN

    在每一层：
    - 修改当层 clone 的 agent.plan_state 和 scene.state；
    - 断言最初的 sim0 没有被污染。

    目的：
    - 模拟 advance_chain 场景下“连续 N 次克隆”的模式；
    - 验证 serialize/deserialize + reset_event_queue + _check_simulator_clone 不会引入跨层状态污染。
    """
    sim0 = make_simulator(kind)

    # 记录最初 base 的快照
    base_scene_snapshot = deepcopy(sim0.scene.state)
    base_plan_snapshots = {name: deepcopy(agent.plan_state) for name, agent in sim0.agents.items()}

    current_sim = sim0
    chain_depth = 5

    for depth in range(chain_depth):
        # 每一层都真实跑一下 SimTree.new，确保当前实现对 current_sim 是“健康”的
        _tree = SimTree.new(current_sim, current_sim.clients)

        # 然后按同样路径克隆一次，作为下一层的 current_sim
        snap = current_sim.serialize()
        cloned = Simulator.deserialize(snap, current_sim.clients, log_handler=None)
        cloned.reset_event_queue()

        # 在 clone 上做一些可见的修改
        agent_name = next(iter(cloned.agents.keys()))
        clone_agent = cloned.agents[agent_name]
        clone_agent.plan_state.setdefault("goals", []).append(
            {
                "id": f"g_chain_{depth}",
                "desc": f"goal-depth-{depth}",
                "priority": "normal",
                "status": "pending",
            }
        )
        cloned.scene.state[f"clone_depth_{depth}"] = depth

        current_sim = cloned

        # 每一层都检查：最初 sim0 仍保持原始快照
        assert sim0.scene.state == base_scene_snapshot, f"[{kind}] sim0.scene.state mutated at depth={depth}"
        for name, base_plan in base_plan_snapshots.items():
            assert sim0.agents[name].plan_state == base_plan, (
                f"[{kind}] sim0.agent[{name}].plan_state mutated at depth={depth}"
            )


# ----------------------------------------------------------------------
# 3) 负向用例：故意破坏 clone，不变量必须触发 SimCloneError
# ----------------------------------------------------------------------


def test_clone_check_raises_on_non_empty_event_queue():
    """
    负向用例：模拟“旧版忘记 reset_event_queue()” 的 bug。

    做法：
    - 在 base_sim 上先放入一个 pending event，再 serialize；
    - 直接用 Simulator.deserialize(...) 生成一个 clone（不调用 reset_event_queue）；
    - 手工调用 _check_simulator_clone(base, clone)，预期因 clone.event_queue 非空而抛 SimCloneError。

    这对应的就是：
    - 旧实现里 SimTree 克隆只做 serialize/deserialize，不做 reset_event_queue；
    - 从而导致新分支带着上一轮的 pending 事件一起跑。
    """
    base_sim = make_simulator("simple_chat_zh")

    # 在 base 上放入一个挂起事件，确保 serialize 时队列里有内容
    base_sim.emit_event_later("test_event", {"foo": "bar"})
    assert not base_sim.event_queue.empty()

    # 模拟旧版 clone：serialize + deserialize，但**不调用 reset_event_queue**
    snap = base_sim.serialize()
    cloned = Simulator.deserialize(snap, base_sim.clients, log_handler=None)
    assert not cloned.event_queue.empty()

    # 需要一个 SimTree 实例来调用 _check_simulator_clone，本身内部 clone 不参与本用例
    tree = SimTree.new(base_sim, base_sim.clients)

    # 这里手动把“有脏队列的 clone”丢给 _check_simulator_clone，
    # 预期因为 cloned.event_queue 非空而抛出 SimCloneError
    with pytest.raises(SimCloneError, match="event_queue"):
        tree._check_simulator_clone(base_sim, cloned)




def test_clone_check_raises_on_shared_agents_dict():
    """
    负向用例：强行让 clone.agents 引用 base.agents，
    再调用 _check_simulator_clone，预期抛出 “agents dict shared between base and clone”。
    """
    base_sim = make_simulator("simple_chat_zh")
    cloned, tree = _make_clone_via_simulator(base_sim)

    # 正常情况下 agents dict 不应共享
    assert id(base_sim.agents) != id(cloned.agents)

    # 人为破坏：让 clone.agents 指向 base.agents
    cloned.agents = base_sim.agents

    with pytest.raises(SimCloneError, match="agents dict shared"):
        tree._check_simulator_clone(base_sim, cloned)


def test_clone_check_raises_on_shared_ordering_object():
    """
    负向用例：强行让 clone.ordering 引用 base.ordering，
    再调用 _check_simulator_clone，预期抛出 “ordering object shared between base and clone”。
    """
    base_sim = make_simulator("council")
    cloned, tree = _make_clone_via_simulator(base_sim)

    # 正常情况下 ordering 不应共享
    assert id(base_sim.ordering) != id(cloned.ordering)

    # 人为破坏：让 clone.ordering 指向 base.ordering
    cloned.ordering = base_sim.ordering

    with pytest.raises(SimCloneError, match="ordering object shared"):
        tree._check_simulator_clone(base_sim, cloned)
