import pytest

from socialsim4.core.simtree import SimTree
from socialsim4.services.llm_client_pool import make_clients_from_env, build_simple_chat_sim


class DummyQueue:
    """
    一个最小化的“订阅队列”模拟对象，只实现 put_nowait，
    用来挂在 SimTree._node_subs 里，避免引入真实 asyncio.Queue。
    """
    def __init__(self):
        self.items = []

    def put_nowait(self, item):
        self.items.append(item)


@pytest.fixture
def sim_tree():
    """
    构造一个最小可用的 SimTree：
    - 使用 mock LLM（来自 make_clients_from_env，默认 dialect=mock）；
    - 使用 simple_chat 场景构建一个 Simulator；
    - 通过 SimTree.new(...) 得到一棵只有 root 节点的树。

    这里完全不依赖真实 OpenAI/Gemini 网络调用。
    """
    clients = make_clients_from_env()
    sim = build_simple_chat_sim(clients)
    tree = SimTree.new(sim, clients)
    return tree


# ----------------------------------------------------------------------
# 1. 测试 detach 接口：add_node_sub / remove_node_sub
# ----------------------------------------------------------------------


def test_add_and_remove_node_sub_detach(sim_tree):
    """
    场景：在某个节点上注册两个订阅队列，然后逐个 detach。

    期望：
    - add_node_sub 后，该 node_id 存在于 _node_subs 中，且列表长度正确；
    - remove_node_sub 第一次调用时，只移除对应队列，保留另一个；
    - remove_node_sub 第二次调用时，列表变空，并自动删除该 node_id 的键。
    """
    tree = sim_tree
    node_id = tree.root
    assert node_id is not None

    q1 = DummyQueue()
    q2 = DummyQueue()

    # 注册两个订阅
    tree.add_node_sub(node_id, q1)
    tree.add_node_sub(node_id, q2)

    assert node_id in tree._node_subs
    assert len(tree._node_subs[node_id]) == 2
    assert q1 in tree._node_subs[node_id]
    assert q2 in tree._node_subs[node_id]

    # 第一次 detach：只移除 q1
    tree.remove_node_sub(node_id, q1)
    assert node_id in tree._node_subs
    assert q1 not in tree._node_subs[node_id]
    assert q2 in tree._node_subs[node_id]
    assert len(tree._node_subs[node_id]) == 1

    # 第二次 detach：移除 q2，列表为空 -> key 被删除
    tree.remove_node_sub(node_id, q2)
    assert node_id not in tree._node_subs


# ----------------------------------------------------------------------
# 2. 测试 delete_subtree 时，自动清理该子树上所有节点的订阅
# ----------------------------------------------------------------------


def test_delete_subtree_clears_subscriptions_for_subtree_only(sim_tree):
    """
    场景：
    - 从 root 节点复制出一个分支节点 child；
    - 分别在 root、child 上各注册一个订阅队列；
    - 调用 delete_subtree(child_id)。

    期望：
    - child 节点从 tree.nodes / tree.children 中删除；
    - child 对应的 _node_subs 条目也被删除；
    - root 上的订阅不受影响，仍然存在。
    """
    tree = sim_tree
    root_id = tree.root
    assert root_id is not None

    # 创建一个子节点分支：这里用 branch，ops 为空即可
    child_id = tree.branch(root_id, ops=[])
    assert child_id in tree.nodes

    q_root = DummyQueue()
    q_child = DummyQueue()

    tree.add_node_sub(root_id, q_root)
    tree.add_node_sub(child_id, q_child)

    assert root_id in tree._node_subs
    assert child_id in tree._node_subs

    # 删除子树（只删 child 这一支）
    tree.delete_subtree(child_id)

    # child 节点相关的结构都应被清理
    assert child_id not in tree.nodes
    assert child_id not in tree.children
    assert child_id not in tree._node_subs

    # root 的订阅应仍然存在
    assert root_id in tree._node_subs
    assert q_root in tree._node_subs[root_id]


# ----------------------------------------------------------------------
# 3. clear_node_subs：主动清空某个节点所有订阅
# ----------------------------------------------------------------------


def test_clear_node_subs_removes_all_subscribers_for_node(sim_tree):
    """
    场景：在某个节点上注册多个订阅队列，然后调用 clear_node_subs(node_id)。

    期望：
    - 该 node_id 在 _node_subs 中对应的条目被完全清除；
    - 之后再 remove_node_sub 不会报错（即函数要对不存在的 key 做容错）。
    """
    tree = sim_tree
    node_id = tree.root
    assert node_id is not None

    q1 = DummyQueue()
    q2 = DummyQueue()

    tree.add_node_sub(node_id, q1)
    tree.add_node_sub(node_id, q2)

    assert node_id in tree._node_subs
    assert len(tree._node_subs[node_id]) == 2

    # 主动清空该节点所有订阅
    tree.clear_node_subs(node_id)

    # 条目应被删除
    assert node_id not in tree._node_subs

    # 再调一次 remove，不应抛异常（相当于用户“晚到”的 detach）
    tree.remove_node_sub(node_id, q1)
    tree.remove_node_sub(node_id, q2)


# ----------------------------------------------------------------------
# 4. gc_node_subs：定期扫描僵尸订阅并进行垃圾回收
# ----------------------------------------------------------------------


def test_gc_node_subs_removes_empty_lists_only(sim_tree):
    """
    场景：
    - 手动构造一个“僵尸”订阅条目：node_zombie -> []；
    - 再构造一个正常条目：node_alive -> [DummyQueue()]；
    - 调用 gc_node_subs();

    期望：
    - zombie 节点因为列表为空被清除；
    - alive 节点的非空列表不会被误删。
    """
    tree = sim_tree

    node_zombie = 99901
    node_alive = 99902

    # 人为制造一个“僵尸订阅列表”：key 存在但列表为空
    tree._node_subs[node_zombie] = []

    # 另一个节点有一个正常订阅
    q_alive = DummyQueue()
    tree._node_subs[node_alive] = [q_alive]

    # 调用 GC
    tree.gc_node_subs()

    # 空列表节点应被移除
    assert node_zombie not in tree._node_subs

    # 非空节点仍然存在，且订阅队列还在
    assert node_alive in tree._node_subs
    assert tree._node_subs[node_alive] == [q_alive]


if __name__ == "__main__":
    # 方便你单独跑这个文件调试
    pytest.main([__file__])
