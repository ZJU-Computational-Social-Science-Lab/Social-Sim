# tests/backend/test_error_events_and_logging.py

import queue

from socialsim4.core.simtree import SimTree
from socialsim4.services.llm_client_pool import (
    make_clients_from_env,
    build_simple_chat_sim,
)


def _make_tree_with_root():
    """
    构造一个最小可用的 SimTree：
    - 用 simple_chat_scene 创建一个 Simulator；
    - 再用 SimTree.new 包一层，拿到 root_id 和对应 node。
    """
    clients = make_clients_from_env()
    sim = build_simple_chat_sim(clients=clients, event_logger=lambda *_args, **_kwargs: None)
    tree = SimTree.new(sim, clients)
    root_id = tree.root
    assert root_id is not None
    return tree, root_id


def test_error_event_in_logs_has_node_and_error_context():
    """
    场景：
    - 在 SimTree 的根节点上，模拟一次 error 事件（通过 sim.log_event("error", data)）；
    - 观察该节点 logs 的最后一条记录。

    期望：
    - 记录的顶层结构为 {"type": ..., "data": ..., "node": ...}；
    - type == "error"；
    - node == 当前节点 ID；
    - data 中包含错误上下文字段：error / error_type / traceback / agent / step / turn；
    - data 的内容未被 SimTree 篡改（字段仍然存在）。
    """
    tree, root_id = _make_tree_with_root()
    node = tree.nodes[root_id]
    sim = node["sim"]

    # 构造一个模拟的错误事件 payload（形状对齐规划说明）
    fake_error_payload = {
        "error": "Boom",
        "error_type": "RuntimeError",
        "traceback": "Traceback (most recent call last): ...",
        "agent": "Alice",
        "step": 3,
        "turn": 5,
    }

    # 通过 sim.log_event 注入一条 error 事件
    sim.log_event("error", fake_error_payload)

    logs = node.get("logs") or []
    assert logs, "logs should not be empty after emitting an error event"

    entry = logs[-1]

    # 顶层结构检查
    assert isinstance(entry, dict)
    assert entry.get("type") == "error"
    assert entry.get("node") == int(root_id)

    data = entry.get("data")
    assert isinstance(data, dict)

    # 检查错误上下文字段都被保留了
    for key in ("error", "error_type", "traceback", "agent", "step", "turn"):
        assert key in data, f"error payload missing key: {key}"

    assert data["error"] == "Boom"
    assert data["error_type"] == "RuntimeError"
    assert data["agent"] == "Alice"
    assert data["step"] == 3
    assert data["turn"] == 5


def test_error_event_delivered_to_node_subscribers():
    """
    场景：
    - 给某个节点挂一个订阅队列（SimTree.add_node_sub）；
    - 用 sim.log_event("error", ...) 触发 error 事件；
    - 检查订阅队列里收到的 entry。

    期望：
    - 订阅队列收到一条记录；
    - 记录的 type == "error"；
    - node == 对应节点 ID；
    - data 中包含 error 字段。
    """
    tree, root_id = _make_tree_with_root()
    node = tree.nodes[root_id]
    sim = node["sim"]

    q = queue.Queue()
    tree.add_node_sub(root_id, q)

    fake_error_payload = {
        "error": "Something bad happened",
        "error_type": "ValueError",
        "traceback": "Traceback ...",
        "agent": "Bob",
        "step": 1,
        "turn": 1,
    }

    sim.log_event("error", fake_error_payload)

    # 从订阅队列里取出一条 entry
    entry = q.get_nowait()

    assert entry["type"] == "error"
    assert entry["node"] == int(root_id)
    assert isinstance(entry.get("data"), dict)
    assert entry["data"]["error"] == "Something bad happened"
    assert entry["data"]["error_type"] == "ValueError"
    assert entry["data"]["agent"] == "Bob"


def test_error_event_fanned_out_to_tree_broadcast():
    """
    场景：
    - 重写 SimTree.set_tree_broadcast，把每次广播的 entry 收集到一个列表；
    - 通过 sim.log_event("error", ...) 触发 error 事件；
    - 检查广播函数确实被调用，并且收到的 entry 中包含 node / error payload。

    期望：
    - 广播回调被调用至少一次；
    - 收到的 entry.type == "error"；
    - node == 当前节点 ID；
    - data.error / data.error_type 等字段存在。
    """
    tree, root_id = _make_tree_with_root()
    node = tree.nodes[root_id]
    sim = node["sim"]

    received: list[dict] = []

    def _capture(entry: dict) -> None:
        received.append(entry)

    tree.set_tree_broadcast(_capture)

    fake_error_payload = {
        "error": "Broadcast test",
        "error_type": "RuntimeError",
        "traceback": "Traceback ...",
        "agent": "Host",
        "step": 2,
        "turn": 7,
    }

    sim.log_event("error", fake_error_payload)

    assert received, "tree-level broadcast did not receive any event"

    # 取最后一条广播（就是刚刚发的 error）
    entry = received[-1]
    assert entry["type"] == "error"
    assert entry["node"] == int(root_id)
    data = entry.get("data") or {}
    assert data.get("error") == "Broadcast test"
    assert data.get("error_type") == "RuntimeError"
    assert data.get("agent") == "Host"
