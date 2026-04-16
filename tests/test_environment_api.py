import pytest
import os
import sys
import asyncio
from types import SimpleNamespace

from socialsim4.backend.services import environment_suggestion_service


def test_environment_service_file_exists():
    """Test that the environment service file exists and is valid Python."""
    service_path = "src/socialsim4/backend/services/environment_suggestion_service.py"
    assert os.path.exists(service_path)
    # Check file can be parsed as Python
    with open(service_path, 'r', encoding='utf-8') as f:
        content = f.read()
    assert "async def get_simulation_state" in content
    assert "async def generate_environment_suggestions" in content
    assert "async def broadcast_environment_event" in content


def test_environment_routes_file_exists():
    """Test that the environment routes file exists and is valid Python."""
    routes_path = "src/socialsim4/backend/api/routes/environment.py"
    assert os.path.exists(routes_path)
    # Check file can be parsed as Python
    with open(routes_path, 'r', encoding='utf-8') as f:
        content = f.read()
    assert "async def get_suggestion_status" in content
    assert "async def generate_suggestions" in content
    assert "async def apply_environment_event" in content
    assert "router = Router" in content


def test_environment_routes_registered():
    """Test that environment routes are registered in __init__.py."""
    init_path = "src/socialsim4/backend/api/routes/__init__.py"
    with open(init_path, 'r', encoding='utf-8') as f:
        content = f.read()
    assert "environment" in content
    assert "environment.router" in content


def test_generate_environment_suggestions_accepts_requested_node(monkeypatch):
    seen = {}

    async def fake_get_simulation_state(simulation_id, db, user_id, node_id=None):
        seen["node_id"] = node_id
        return {"clients": {"chat": object()}, "turns": 6}

    class DummyAnalyzer:
        def __init__(self, clients):
            self.clients = clients

        def generate_suggestions(self, context, count=3):
            return [{"event_type": "notification", "description": "branch notice", "severity": "mild"}]

    class DummyResult:
        def scalar_one_or_none(self):
            return SimpleNamespace(agent_config={"agents": [{}, {}]})

    class DummyDB:
        async def execute(self, *_args, **_kwargs):
            return DummyResult()

    monkeypatch.setattr(environment_suggestion_service, "get_simulation_state", fake_get_simulation_state)
    monkeypatch.setattr(environment_suggestion_service, "EnvironmentAnalyzer", DummyAnalyzer)

    suggestions = asyncio.run(
        environment_suggestion_service.generate_environment_suggestions("SIM1", DummyDB(), 1, node_id=9)
    )

    assert seen["node_id"] == 9
    assert suggestions == [{"event_type": "notification", "description": "branch notice", "severity": "mild"}]


def test_broadcast_environment_event_uses_requested_branch_node(monkeypatch):
    seen = {}

    class DummyAgent:
        def __init__(self):
            self.feedback = []

        def add_env_feedback(self, description, images=None):
            self.feedback.append((description, images or []))

    class DummyScene:
        TYPE = "policy_cascade_scene"

        def __init__(self):
            self.public_events = []
            self.private_events = []

        def on_event(self, sim, event_type, data):
            self.public_events.append((event_type, data))

        def on_private_event(self, sim, event_type, data, recipients):
            self.private_events.append((event_type, data, recipients))

    class DummyEnvironmentConfig:
        turn_interval = 5

    scene = DummyScene()
    agent = DummyAgent()
    simulator = SimpleNamespace(
        agents={"Top": agent},
        scene=scene,
        environment_config=DummyEnvironmentConfig(),
        turns=6,
        clients={},
    )

    async def fake_get_simulation_state(simulation_id, db, user_id, node_id=None):
        seen["node_id"] = node_id
        return {"tree": SimpleNamespace(nodes={42: {"sim": simulator}}), "node_id": 42}

    monkeypatch.setattr(environment_suggestion_service, "get_simulation_state", fake_get_simulation_state)
    monkeypatch.setitem(
        environment_suggestion_service.SIM_TREE_REGISTRY,
        "SIM1",
        SimpleNamespace(_suggestions_viewed_intervals=set()),
    )

    try:
        ok = asyncio.run(
            environment_suggestion_service.broadcast_environment_event(
                "SIM1",
                {"description": "分支公告", "event_type": "environment", "node_id": 42},
                None,
                1,
            )
        )
    finally:
        environment_suggestion_service.SIM_TREE_REGISTRY.pop("SIM1", None)

    assert ok is True
    assert seen["node_id"] == 42
    assert agent.feedback == [("分支公告", [])]
    assert scene.public_events == [(
        "environment",
        {"description": "分支公告", "event_type": "environment", "notice_only": True},
    )]


def test_broadcast_environment_event_rehydrates_registry_and_injects_experiment_host_message(monkeypatch):
    class DummyScene:
        def __init__(self):
            self.messages = []
            self.current_round = 3

        def inject_host_message(self, message):
            self.messages.append(message)

    class DummySimulator:
        def __init__(self):
            self.scene = DummyScene()
            self.events = []
            self.turns = 0
            self.environment_config = None

        def _emit_event(self, event_type, data):
            self.events.append((event_type, data))

    simulator = DummySimulator()
    tree = SimpleNamespace(nodes={7: {"sim": simulator}}, serialize=lambda: {"ok": True})
    record = SimpleNamespace(tree=tree, _suggestions_viewed_intervals=set())
    sim_record = SimpleNamespace(latest_state=None)

    class DummyResult:
        def __init__(self, value):
            self.value = value

        def scalar_one_or_none(self):
            return self.value

    class DummyDB:
        def __init__(self):
            self.committed = False

        async def execute(self, *_args, **_kwargs):
            return DummyResult(sim_record)

        async def commit(self):
            self.committed = True

    async def fake_get_or_create_from_sim(sim):
        assert sim is sim_record
        return record

    monkeypatch.setattr(environment_suggestion_service.SIM_TREE_REGISTRY, "get_or_create_from_sim", fake_get_or_create_from_sim)
    monkeypatch.setattr(environment_suggestion_service.SIM_TREE_REGISTRY, "get", lambda _sid: None)

    db = DummyDB()
    ok = asyncio.run(
        environment_suggestion_service.broadcast_environment_event(
            "SIM2",
            {"description": "实验环境事件", "event_type": "environment", "node_id": 7},
            db,
            1,
        )
    )

    assert ok is True
    assert simulator.scene.messages == ["实验环境事件"]
    assert simulator.events == [("public_event", {"message": "实验环境事件", "scoped": False, "recipients": []})]
    assert db.committed is True


def test_get_simulation_state_falls_back_to_leaf_when_requested_node_missing(monkeypatch):
    class DummyConfig:
        def serialize(self):
            return {"enabled": False}

    simulator = SimpleNamespace(environment_config=DummyConfig(), clients={}, turns=2)
    tree = SimpleNamespace(nodes={1: {"sim": simulator}}, leaves=lambda: [1])
    record = SimpleNamespace(tree=tree, _suggestions_viewed_intervals=set())
    sim = SimpleNamespace(id="SIM3", owner_id=1, scene_config={}, latest_state=None)

    class DummyResult:
        def scalar_one_or_none(self):
            return sim

    class DummyDB:
        async def execute(self, *_args, **_kwargs):
            return DummyResult()

    async def fake_get_or_create_from_sim(sim_record):
        assert sim_record is sim
        return record

    monkeypatch.setattr(environment_suggestion_service.SIM_TREE_REGISTRY, "get", lambda _sid: None)
    monkeypatch.setattr(environment_suggestion_service.SIM_TREE_REGISTRY, "get_or_create_from_sim", fake_get_or_create_from_sim)

    state = asyncio.run(environment_suggestion_service.get_simulation_state("SIM3", DummyDB(), 1, node_id=99))

    assert state["node_id"] == 1
    assert state["tree"] is tree
