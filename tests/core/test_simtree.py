"""
Tests for core.simtree navigation, subscription, and tree structure operations.

Covers tree navigation (lca, summaries, leaves, max_depth, frontier),
subscription management, delete_subtree, and attach edge-type dispatch.
Does NOT duplicate test_simtree_clone_stability.py or test_simtree_experiment_ops.py.

Contains: TestLCA, TestLeaves, TestMaxDepth, TestFrontier, TestSummaries,
          TestDeleteSubtree, TestSubscriptions, TestAttachEdgeType, TestNextId
"""

import pytest
from unittest.mock import Mock
from types import SimpleNamespace

from socialsim4.core.simtree import SimTree


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _mock_sim(turns: int = 0) -> SimpleNamespace:
    """Minimal sim-like object with a turns attribute."""
    return SimpleNamespace(turns=turns)


def _make_node(
    nid: int,
    parent: int | None = None,
    depth: int = 0,
    edge_type: str = "root",
    ops: list | None = None,
    sim: object | None = None,
) -> dict:
    """Build a minimal node dict accepted by SimTree navigation methods."""
    return {
        "id": nid,
        "parent": parent,
        "depth": depth,
        "edge_type": edge_type,
        "ops": ops or [],
        "sim": sim or _mock_sim(),
        "logs": [],
        "meta": {},
    }


@pytest.fixture
def tree() -> SimTree:
    """Tree with manually populated nodes for navigation tests.

    Structure:
        0 (root, d=0)
       / \\
      1   2 (d=1)
     / \\   \\
    3   4   5 (d=2)
    """
    t = SimTree({})
    t.root = 0
    t._seq = 6
    t.nodes = {
        0: _make_node(0, depth=0, edge_type="root"),
        1: _make_node(
            1, parent=0, depth=1, edge_type="advance",
            ops=[{"op": "advance", "turns": 1}],
        ),
        2: _make_node(
            2, parent=0, depth=1, edge_type="advance",
            ops=[{"op": "advance", "turns": 2}],
        ),
        3: _make_node(3, parent=1, depth=2, edge_type="advance"),
        4: _make_node(
            4, parent=1, depth=2, edge_type="agent_ctx",
            ops=[{"op": "agent_ctx_append", "name": "A", "role": "user", "content": "x"}],
        ),
        5: _make_node(5, parent=2, depth=2, edge_type="advance"),
    }
    t.children = {0: [1, 2], 1: [3, 4], 2: [5], 3: [], 4: [], 5: []}
    return t


# ---------------------------------------------------------------------------
# LCA
# ---------------------------------------------------------------------------


class TestLCA:
    def test_siblings_same_parent(self, tree: SimTree) -> None:
        assert tree.lca(3, 4) == 1

    def test_cousins_share_root(self, tree: SimTree) -> None:
        assert tree.lca(3, 5) == 0

    def test_ancestor_and_descendant(self, tree: SimTree) -> None:
        assert tree.lca(0, 3) == 0

    def test_same_node(self, tree: SimTree) -> None:
        assert tree.lca(1, 1) == 1

    def test_different_depths(self, tree: SimTree) -> None:
        assert tree.lca(1, 5) == 0


# ---------------------------------------------------------------------------
# Leaves / Max Depth / Frontier
# ---------------------------------------------------------------------------


class TestLeaves:
    def test_returns_leaf_nodes(self, tree: SimTree) -> None:
        assert tree.leaves() == [3, 4, 5]

    def test_single_node_tree(self) -> None:
        t = SimTree({})
        t.root = 0
        t.nodes = {0: _make_node(0, depth=0)}
        t.children = {0: []}
        assert t.leaves() == [0]


class TestMaxDepth:
    def test_multi_level(self, tree: SimTree) -> None:
        assert tree.max_depth() == 2

    def test_single_node(self) -> None:
        t = SimTree({})
        t.root = 0
        t.nodes = {0: _make_node(0, depth=0)}
        t.children = {0: []}
        assert t.max_depth() == 0


class TestFrontier:
    def test_only_max_depth_leaves(self, tree: SimTree) -> None:
        assert tree.frontier() == [3, 4, 5]

    def test_all_leaves_flag(self, tree: SimTree) -> None:
        assert tree.frontier(only_max_depth=False) == [3, 4, 5]

    def test_excludes_shallow_leaves(self) -> None:
        """If deepest leaves are at depth 2, depth-1 leaves are excluded."""
        t = SimTree({})
        t.root = 0
        t.nodes = {
            0: _make_node(0, depth=0),
            1: _make_node(1, parent=0, depth=1, edge_type="advance"),
            2: _make_node(2, parent=0, depth=1, edge_type="advance"),
            3: _make_node(3, parent=1, depth=2, edge_type="advance"),
        }
        t.children = {0: [1, 2], 1: [3], 2: [], 3: []}
        # Leaves: 2 (d=1), 3 (d=2). Frontier (max depth only) = [3]
        assert t.frontier() == [3]
        assert t.frontier(only_max_depth=False) == [2, 3]


# ---------------------------------------------------------------------------
# Summaries
# ---------------------------------------------------------------------------


class TestSummaries:
    def test_sorted_by_id(self, tree: SimTree) -> None:
        ids = [s["id"] for s in tree.summaries()]
        assert ids == sorted(ids)

    def test_root_has_child_edges(self, tree: SimTree) -> None:
        root = next(s for s in tree.summaries() if s["id"] == 0)
        targets = [e["to"] for e in root["edges"]]
        assert set(targets) == {1, 2}

    def test_turns_read_from_sim(self, tree: SimTree) -> None:
        tree.nodes[1]["sim"] = _mock_sim(turns=7)
        node1 = next(s for s in tree.summaries() if s["id"] == 1)
        assert node1["turns"] == 7

    def test_parent_preserved(self, tree: SimTree) -> None:
        node3 = next(s for s in tree.summaries() if s["id"] == 3)
        assert node3["parent"] == 1


# ---------------------------------------------------------------------------
# Delete Subtree
# ---------------------------------------------------------------------------


class TestDeleteSubtree:
    def test_removes_subtree_nodes(self, tree: SimTree) -> None:
        tree.delete_subtree(1)
        assert 1 not in tree.nodes
        assert 3 not in tree.nodes
        assert 4 not in tree.nodes
        # Sibling branch untouched
        assert 0 in tree.nodes
        assert 2 in tree.nodes
        assert 5 in tree.nodes

    def test_removes_from_parent_children(self, tree: SimTree) -> None:
        tree.delete_subtree(1)
        assert 1 not in tree.children[0]

    def test_raises_on_root_deletion(self, tree: SimTree) -> None:
        with pytest.raises(ValueError, match="Cannot delete root"):
            tree.delete_subtree(0)

    def test_cleans_up_subscriptions(self, tree: SimTree) -> None:
        tree.add_node_sub(3, Mock())
        tree.delete_subtree(1)
        assert 3 not in tree._node_subs


# ---------------------------------------------------------------------------
# Subscription Management
# ---------------------------------------------------------------------------


class TestSubscriptions:
    def test_add_and_remove(self, tree: SimTree) -> None:
        q = Mock()
        tree.add_node_sub(0, q)
        assert q in tree._node_subs[0]
        tree.remove_node_sub(0, q)
        # Empty list cleaned up
        assert 0 not in tree._node_subs

    def test_remove_noop_missing_node(self, tree: SimTree) -> None:
        tree.remove_node_sub(99, Mock())  # Should not raise

    def test_clear_subs(self, tree: SimTree) -> None:
        tree.add_node_sub(0, Mock())
        tree.add_node_sub(0, Mock())
        tree.clear_node_subs(0)
        assert 0 not in tree._node_subs

    def test_gc_drops_empty_lists(self, tree: SimTree) -> None:
        tree._node_subs[0] = []
        tree._node_subs[1] = [Mock()]
        tree.gc_node_subs()
        assert 0 not in tree._node_subs
        assert 1 in tree._node_subs

    def test_multiple_subscribers(self, tree: SimTree) -> None:
        q1, q2 = Mock(), Mock()
        tree.add_node_sub(0, q1)
        tree.add_node_sub(0, q2)
        assert len(tree._node_subs[0]) == 2
        tree.remove_node_sub(0, q1)
        assert q2 in tree._node_subs[0]


# ---------------------------------------------------------------------------
# Attach Edge-Type Dispatch
# ---------------------------------------------------------------------------


class TestAttachEdgeType:
    @pytest.mark.parametrize(
        "op_name,expected",
        [
            ("advance", "advance"),
            ("agent_ctx_append", "agent_ctx"),
            ("agent_plan_replace", "agent_plan"),
            ("agent_props_patch", "agent_props"),
            ("scene_state_patch", "scene_state"),
            ("config_params_patch", "config_params"),
            ("config_description_patch", "config_desc"),
            ("config_settings_patch", "config_settings"),
            ("network_replace", "network"),
            ("public_broadcast", "public_event"),
            ("environment_event", "environment_event"),
        ],
    )
    def test_single_op_edge_types(
        self, tree: SimTree, op_name: str, expected: str
    ) -> None:
        cid = 10
        tree.nodes[cid] = _make_node(cid, depth=None)
        tree.children[cid] = []
        tree.attach(0, [{"op": op_name}], cid)
        assert tree.nodes[cid]["edge_type"] == expected

    def test_multi_ops_gets_multi_type(self, tree: SimTree) -> None:
        cid = 20
        tree.nodes[cid] = _make_node(cid, depth=None)
        tree.children[cid] = []
        tree.attach(0, [{"op": "advance"}, {"op": "agent_ctx_append"}], cid)
        assert tree.nodes[cid]["edge_type"] == "multi"

    def test_empty_ops_gets_multi_type(self, tree: SimTree) -> None:
        cid = 21
        tree.nodes[cid] = _make_node(cid, depth=None)
        tree.children[cid] = []
        tree.attach(0, [], cid)
        assert tree.nodes[cid]["edge_type"] == "multi"

    def test_depth_increments(self, tree: SimTree) -> None:
        cid = 22
        tree.nodes[cid] = _make_node(cid, depth=None)
        tree.children[cid] = []
        tree.attach(0, [{"op": "advance"}], cid)
        assert tree.nodes[cid]["depth"] == 1
        assert tree.nodes[cid]["parent"] == 0

    def test_missing_parent_raises(self, tree: SimTree) -> None:
        with pytest.raises(KeyError, match="Parent node"):
            tree.attach(99, [], 0)

    def test_missing_child_raises(self, tree: SimTree) -> None:
        with pytest.raises(KeyError, match="Child node"):
            tree.attach(0, [], 99)


# ---------------------------------------------------------------------------
# ID Generation
# ---------------------------------------------------------------------------


class TestNextId:
    def test_sequential(self) -> None:
        t = SimTree({})
        assert t._next_id() == 0
        assert t._next_id() == 1
        assert t._next_id() == 2

    def test_init_with_pool_flag(self) -> None:
        t = SimTree({}, use_client_pool=False)
        assert t._client_pool is None
