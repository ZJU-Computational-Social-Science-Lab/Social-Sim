# Dynamic Environment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a dynamic environment feature that proposes environmental events (weather, emergencies, notifications, public opinion) based on simulation context, available every 5 turns when users request it.

**Architecture:**
1. **EnvironmentAnalyzer** - Summarizes context and calls LLM to generate suggestions
2. **EnvironmentEvent** - New event type for broadcasting to agents
3. **API Routes** - Endpoints for status, generate, and apply suggestions
4. **Frontend Component** - UI for viewing and applying suggestions
5. **Simulator Integration** - Turn tracking flag at 5-turn intervals

**Tech Stack:**
- Backend: Python, Litestar, SQLAlchemy, existing LLM client infrastructure
- Frontend: React 19, TypeScript, Zustand, TailwindCSS

---

## Task 1: Add EnvironmentEvent Class

**Files:**
- Modify: `src/socialsim4/core/event.py`

**Step 1: Write the failing test**

Create `tests/test_environment_event.py`:

```python
import pytest
from socialsim4.core.event import EnvironmentEvent


def test_environment_event_creation():
    event = EnvironmentEvent("weather", "Heavy rain begins to fall.", "moderate")
    assert event.event_type == "weather"
    assert event.description == "Heavy rain begins to fall."
    assert event.severity == "moderate"


def test_environment_event_to_string():
    event = EnvironmentEvent("emergency", "A small fire has been reported in the district.", "severe")
    result = event.to_string(time=120)  # 2:00
    assert "[2:00]" in result
    assert "EMERGENCY" in result
    assert "small fire" in result


def test_environment_event_serialization():
    event = EnvironmentEvent("notification", "Town hall meeting at 3 PM.", "mild")
    assert hasattr(event, "code")
    assert hasattr(event, "params")
    assert event.code == "environment_event"
    assert event.params["event_type"] == "notification"
```

**Step 2: Run test to verify it fails**

```bash
cd /c/Users/justi/Documents/ZJU_Work/Social-Sim
pytest tests/test_environment_event.py -v
```

Expected: FAIL with "EnvironmentEvent not defined"

**Step 3: Write minimal implementation**

Add to `src/socialsim4/core/event.py` (after line 95, before the end of file):

```python
class EnvironmentEvent(Event):
    """Environmental events like weather, emergencies, notifications, public opinion."""

    def __init__(self, event_type: str, description: str, severity: str = "mild"):
        self.event_type = event_type  # "weather", "emergency", "notification", "opinion"
        self.description = description
        self.severity = severity  # "mild", "moderate", "severe"
        self.code = "environment_event"
        self.params = {
            "event_type": event_type,
            "description": description,
            "severity": severity,
        }

    def to_string(self, time=None):
        time_str = _fmt_time_prefix(time)
        prefix_map = {
            "weather": "WEATHER",
            "emergency": "EMERGENCY",
            "notification": "NOTIFICATION",
            "opinion": "PUBLIC OPINION",
        }
        prefix = prefix_map.get(self.event_type, "ENVIRONMENT")
        return f"{time_str}[{prefix}] {self.description}"
```

**Step 4: Run test to verify it passes**

```bash
pytest tests/test_environment_event.py -v
```

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/socialsim4/core/event.py tests/test_environment_event.py
git commit -m "feat: add EnvironmentEvent class"
```

---

## Task 2: Add EnvironmentConfig Class

**Files:**
- Create: `src/socialsim4/core/environment_config.py`
- Test: `tests/test_environment_config.py`

**Step 1: Write the failing test**

Create `tests/test_environment_config.py`:

```python
import pytest
from socialsim4.core.environment_config import EnvironmentConfig


def test_default_config():
    config = EnvironmentConfig()
    assert config.enabled is True
    assert config.turn_interval == 5
    assert config.max_suggestions == 3
    assert config.require_llm_provider is True


def test_custom_config():
    config = EnvironmentConfig(
        enabled=False,
        turn_interval=10,
        max_suggestions=5,
        require_llm_provider=False,
    )
    assert config.enabled is False
    assert config.turn_interval == 10
    assert config.max_suggestions == 5


def test_config_serialize():
    config = EnvironmentConfig()
    data = config.serialize()
    assert data["enabled"] is True
    assert data["turn_interval"] == 5


def test_config_deserialize():
    data = {"enabled": False, "turn_interval": 10, "max_suggestions": 2, "require_llm_provider": True}
    config = EnvironmentConfig.deserialize(data)
    assert config.enabled is False
    assert config.turn_interval == 10
```

**Step 2: Run test to verify it fails**

```bash
pytest tests/test_environment_config.py -v
```

Expected: FAIL with "module 'socialsim4.core.environment_config' not found"

**Step 3: Write minimal implementation**

Create `src/socialsim4/core/environment_config.py`:

```python
from dataclasses import dataclass, asdict
from typing import Optional, Dict, Any


@dataclass
class EnvironmentConfig:
    """Configuration for the dynamic environment feature."""

    enabled: bool = True
    turn_interval: int = 5
    max_suggestions: int = 3
    require_llm_provider: bool = True

    def serialize(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def deserialize(cls, data: Dict[str, Any]) -> "EnvironmentConfig":
        return cls(
            enabled=data.get("enabled", True),
            turn_interval=data.get("turn_interval", 5),
            max_suggestions=data.get("max_suggestions", 3),
            require_llm_provider=data.get("require_llm_provider", True),
        )
```

**Step 4: Run test to verify it passes**

```bash
pytest tests/test_environment_config.py -v
```

Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add src/socialsim4/core/environment_config.py tests/test_environment_config.py
git commit -m "feat: add EnvironmentConfig class"
```

---

## Task 3: Add EnvironmentAnalyzer Class

**Files:**
- Create: `src/socialsim4/core/environment_analyzer.py`
- Test: `tests/test_environment_analyzer.py`

**Step 1: Write the failing test**

Create `tests/test_environment_analyzer.py`:

```python
import pytest
from unittest.mock import Mock, MagicMock
from socialsim4.core.environment_analyzer import EnvironmentAnalyzer


@pytest.fixture
def mock_clients():
    """Mock LLM clients."""
    chat_client = Mock()
    chat_client.call = MagicMock(return_value="Mock LLM response")
    return {"chat": chat_client, "default": chat_client}


@pytest.fixture
def sample_context():
    """Sample context for analysis."""
    return {
        "recent_events": [
            {"type": "system_broadcast", "text": "Alice: We need more supplies."},
            {"type": "system_broadcast", "text": "Bob: I'll go to the store."},
        ],
        "agent_count": 3,
        "current_turn": 5,
        "scene_time": 540,
    }


def test_analyzer_initialization(mock_clients):
    analyzer = EnvironmentAnalyzer(mock_clients)
    assert analyzer.clients == mock_clients


def test_summarize_context(mock_clients, sample_context):
    analyzer = EnvironmentAnalyzer(mock_clients)
    summary = analyzer.summarize_context(sample_context)

    assert isinstance(summary, dict)
    assert "themes" in summary
    assert "sentiment" in summary
    assert "notable_actions" in summary


def test_generate_suggestions_returns_list(mock_clients, sample_context):
    analyzer = EnvironmentAnalyzer(mock_clients)
    # Mock the summarize to return a fixed summary
    analyzer.summarize_context = Mock(return_value={
        "themes": ["resource shortage"],
        "sentiment": "tense",
        "notable_actions": ["Bob went to store"],
    })

    suggestions = analyzer.generate_suggestions(sample_context)

    assert isinstance(suggestions, list)
    assert len(suggestions) <= 3
    for suggestion in suggestions:
        assert "event_type" in suggestion
        assert "description" in suggestion
        assert "severity" in suggestion
```

**Step 2: Run test to verify it fails**

```bash
pytest tests/test_environment_analyzer.py -v
```

Expected: FAIL with "module 'socialsim4.core.environment_analyzer' not found"

**Step 3: Write minimal implementation**

Create `src/socialsim4/core/environment_analyzer.py`:

```python
import json
import logging
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)


class EnvironmentAnalyzer:
    """Analyzes simulation context and generates environmental event suggestions."""

    def __init__(self, clients: Dict[str, Any]):
        self.clients = clients

    def summarize_context(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Summarize recent simulation context using LLM.

        Args:
            context: Dict with recent_events, agent_count, current_turn, scene_time

        Returns:
            Dict with themes, sentiment, notable_actions, suggested_event_types
        """
        chat_client = self.clients.get("chat") or self.clients.get("default")

        # Build context summary prompt
        events_text = "\n".join(
            f"- {e.get('text', str(e.get('type', 'unknown')))}"
            for e in context.get("recent_events", [])[:10]
        )

        prompt = f"""Analyze the following simulation context and provide a brief summary.

Recent events (last 5 turns):
{events_text}

Agent count: {context.get('agent_count', 0)}
Current turn: {context.get('current_turn', 0)}
Scene time: {context.get('scene_time', 0)} minutes

Respond in JSON format with these keys:
- themes: list of main themes (e.g., ["conflict", "planning"])
- sentiment: overall mood (e.g., "tense", "calm", "excited")
- notable_actions: list of key actions taken
- suggested_event_types: list of appropriate event types (weather, emergency, notification, opinion)

JSON only, no explanation."""

        try:
            response = chat_client.call(prompt, temperature=0.7)
            # Parse JSON from response (handle potential markdown code blocks)
            response = response.strip()
            if response.startswith("```"):
                response = response.split("```")[1]
                if response.startswith("json"):
                    response = response[4:]
            return json.loads(response.strip())
        except Exception as e:
            logger.exception("Failed to summarize context with LLM: %s", e)
            # Fallback to basic analysis
            return {
                "themes": ["general"],
                "sentiment": "neutral",
                "notable_actions": [],
                "suggested_event_types": ["notification"],
            }

    def generate_suggestions(
        self,
        context: Dict[str, Any],
        count: int = 3,
    ) -> List[Dict[str, Any]]:
        """
        Generate environmental event suggestions based on context.

        Args:
            context: Simulation context
            count: Maximum number of suggestions to generate

        Returns:
            List of suggestion dicts with event_type, description, severity
        """
        summary = self.summarize_context(context)
        chat_client = self.clients.get("chat") or self.clients.get("default")

        prompt = f"""Based on the following simulation summary, suggest {count} environmental events that could naturally occur.

Simulation Summary:
- Themes: {', '.join(summary.get('themes', []))}
- Sentiment: {summary.get('sentiment', 'neutral')}
- Notable actions: {', '.join(summary.get('notable_actions', []))}

Event types can be:
- weather: rain, storm, snow, temperature change
- emergency: fire, power outage, medical emergency, accident
- notification: government announcement, policy change, school closure
- opinion: rumor spreading, sentiment shift, trending topic

For each suggestion, provide:
- event_type: one of the above
- description: brief natural language description (1 sentence)
- severity: mild, moderate, or severe

Respond in JSON format as a list:
[
  {{"event_type": "...", "description": "...", "severity": "..."}},
  ...
]

JSON only, no explanation."""

        try:
            response = chat_client.call(prompt, temperature=0.8)
            response = response.strip()
            if response.startswith("```"):
                response = response.split("```")[1]
                if response.startswith("json"):
                    response = response[4:]
            suggestions = json.loads(response.strip())

            # Validate and sanitize
            valid_severities = {"mild", "moderate", "severe"}
            valid_types = {"weather", "emergency", "notification", "opinion"}

            result = []
            for s in suggestions[:count]:
                if s.get("event_type") in valid_types and s.get("description") and s.get("severity") in valid_severities:
                    result.append({
                        "event_type": s["event_type"],
                        "description": s["description"],
                        "severity": s["severity"],
                    })

            return result
        except Exception as e:
            logger.exception("Failed to generate suggestions: %s", e)
            # Fallback suggestion
            return [{
                "event_type": "notification",
                "description": "A community announcement is posted on the bulletin board.",
                "severity": "mild",
            }]
```

**Step 4: Run test to verify it passes**

```bash
pytest tests/test_environment_analyzer.py -v
```

Expected: PASS (4 tests, with mocked LLM)

**Step 5: Commit**

```bash
git add src/socialsim4/core/environment_analyzer.py tests/test_environment_analyzer.py
git commit -m "feat: add EnvironmentAnalyzer class"
```

---

## Task 4: Add Turn Tracking to Simulator

**Files:**
- Modify: `src/socialsim4/core/simulator.py`

**Step 1: Write the failing test**

Add to `tests/test_simulator.py` (create if doesn't exist):

```python
import pytest
from socialsim4.core.simulator import Simulator
from socialsim4.core.agent import Agent
from socialsim4.core.scene import Scene
from unittest.mock import Mock


@pytest.fixture
def minimal_scene():
    """Create a minimal scene for testing."""
    from socialsim4.core.event import PublicEvent
    scene = Scene.__new__(Scene)
    scene.name = "test_scene"
    scene.initial_event = PublicEvent("Test event")
    scene.state = {"time": 0}
    scene.minutes_per_turn = 3
    return scene


@pytest.fixture
def mock_clients():
    return {"chat": Mock()}


def test_simulator_turn_tracking_at_interval(minimal_scene, mock_clients):
    """Test that suggestions become available at turn intervals."""
    agent = Agent.deserialize({
        "name": "TestAgent",
        "user_profile": "Test profile",
        "style": "test",
        "initial_instruction": "",
        "role_prompt": "",
        "action_space": ["yield"],
        "properties": {},
    })

    sim = Simulator(
        agents=[agent],
        scene=minimal_scene,
        clients=mock_clients,
        broadcast_initial=False,
    )

    # Initially no suggestions available
    assert sim.are_environment_suggestions_available() is False

    # After 5 turns, suggestions should be available
    sim.turns = 5
    assert sim.are_environment_suggestions_available() is True

    # After 6 turns, still available (until user acts)
    sim.turns = 6
    assert sim.are_environment_suggestions_available() is True

    # After user dismisses, no longer available
    sim.dismiss_environment_suggestions()
    assert sim.are_environment_suggestions_available() is False

    # At turn 10, available again
    sim.turns = 10
    assert sim.are_environment_suggestions_available() is True


def test_simulator_custom_turn_interval(minimal_scene, mock_clients):
    """Test custom turn interval."""
    from socialsim4.core.environment_config import EnvironmentConfig

    agent = Agent.deserialize({
        "name": "TestAgent",
        "user_profile": "Test profile",
        "style": "test",
        "initial_instruction": "",
        "role_prompt": "",
        "action_space": ["yield"],
        "properties": {},
    })

    sim = Simulator(
        agents=[agent],
        scene=minimal_scene,
        clients=mock_clients,
        broadcast_initial=False,
        environment_config=EnvironmentConfig(turn_interval=3),
    )

    # At turn 3, suggestions available
    sim.turns = 3
    assert sim.are_environment_suggestions_available() is True
```

**Step 2: Run test to verify it fails**

```bash
pytest tests/test_simulator.py::test_simulator_turn_tracking_at_interval -v
```

Expected: FAIL with "Simulator has no attribute 'are_environment_suggestions_available'"

**Step 3: Write minimal implementation**

Modify `src/socialsim4/core/simulator.py`:

First, add import at the top (around line 9):
```python
from socialsim4.core.ordering import ORDERING_MAP, Ordering, SequentialOrdering
from socialsim4.core.environment_config import EnvironmentConfig
```

Then modify the `__init__` method (around line 14) to add environment_config parameter and tracking state:

```python
def __init__(
    self,
    agents: List[Agent],
    scene,
    clients,
    broadcast_initial=True,
    max_steps_per_turn=5,
    ordering: Optional[Ordering] = None,
    event_handler: Callable[[str, dict], None] = None,
    emotion_enabled: bool = False,
    environment_config: Optional[EnvironmentConfig] = None,
):
    self.started = False
    self.log_event = event_handler

    for agent in agents:
        agent.log_event = self.log_event

    # Environment config for dynamic suggestions
    self.environment_config = environment_config or EnvironmentConfig()
    self._suggestions_viewed_turn = None  # Track when user last viewed/dismissed suggestions

    # ... rest of __init__ remains the same ...
```

Add the new methods at the end of the class (before the `run` method, around line 270):

```python
# ----- Dynamic Environment Support -----

def are_environment_suggestions_available(self) -> bool:
    """
    Check if environment suggestions should be shown to the user.

    Returns True if:
    - Feature is enabled
    - Current turn is a multiple of turn_interval (5, 10, 15...)
    - User hasn't already dismissed/viewed suggestions for this interval
    """
    if not self.environment_config.enabled:
        return False

    if self.turns == 0:
        return False

    interval = self.environment_config.turn_interval
    if self.turns % interval != 0:
        return False

    # Check if user already viewed/dismissed at this interval
    interval_marker = (self.turns // interval) * interval
    if self._suggestions_viewed_turn == interval_marker:
        return False

    return True

def dismiss_environment_suggestions(self) -> None:
    """Mark that the user has viewed/dismissed suggestions for current interval."""
    interval = self.environment_config.turn_interval
    interval_marker = (self.turns // interval) * interval
    self._suggestions_viewed_turn = interval_marker
```

Also update the `serialize` method to include environment config (around line 175):
```python
def serialize(self):
    ord_state = self.ordering.serialize()
    snap = {
        "agents": {name: agent.serialize() for name, agent in self.agents.items()},
        "scene": self.scene.serialize(),
        "max_steps_per_turn": int(self.max_steps_per_turn),
        "ordering": getattr(self.ordering, "NAME", "sequential"),
        "ordering_state": ord_state,
        "event_queue": list(self.event_queue.queue),
        "turns": int(self.turns),
        "emotion_enabled": self.emotion_enabled,
        "environment_config": self.environment_config.serialize(),
        "_suggestions_viewed_turn": self._suggestions_viewed_turn,
    }
    return deepcopy(snap)
```

And update the `deserialize` method (around line 230):
```python
@classmethod
def deserialize(cls, data, clients, log_handler=None):
    data = deepcopy(data)
    # ... existing agent and scene deserialization ...

    environment_config_data = data.get("environment_config")
    environment_config = EnvironmentConfig.deserialize(environment_config_data) if environment_config_data else EnvironmentConfig()

    simulator = cls(
        agents=agents,
        scene=scene,
        clients=clients,
        broadcast_initial=False,
        max_steps_per_turn=data.get("max_steps_per_turn", 5),
        ordering=ordering,
        event_handler=log_handler,
        emotion_enabled=data["emotion_enabled"],
        environment_config=environment_config,
    )
    # ... existing ordering and event queue restoration ...
    simulator._suggestions_viewed_turn = data.get("_suggestions_viewed_turn")
    return simulator
```

**Step 4: Run test to verify it passes**

```bash
pytest tests/test_simulator.py::test_simulator_turn_tracking_at_interval tests/test_simulator.py::test_simulator_custom_turn_interval -v
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/socialsim4/core/simulator.py tests/test_simulator.py
git commit -m "feat: add environment suggestion tracking to simulator"
```

---

## Task 5: Create Backend API Routes

**Files:**
- Create: `src/socialsim4/backend/api/routes/environment.py`
- Create: `src/socialsim4/backend/services/environment_suggestion_service.py`
- Test: `tests/test_environment_api.py`

**Step 1: Write the failing test**

Create `tests/test_environment_api.py`:

```python
import pytest
from unittest.mock import Mock, patch, MagicMock
from socialsim4.backend.api.routes.environment import (
    get_suggestion_status,
    generate_suggestions,
    apply_environment_event,
)


@pytest.fixture
def mock_db():
    return Mock()


@pytest.fixture
def mock_user():
    user = Mock()
    user.id = 1
    return user


def test_get_suggestion_status_available(mock_db, mock_user):
    """Test status endpoint when suggestions are available."""
    with patch('socialsim4.backend.services.environment_suggestion_service.get_simulation_state') as mock_get_state:
        mock_state = Mock()
        mock_state.turns = 5
        mock_state.config = {"enabled": True, "turn_interval": 5}
        mock_state._suggestions_viewed_turn = None
        mock_get_state.return_value = mock_state

        result = get_suggestion_status(simulation_id=1, db=mock_db, user=mock_user)

        assert result["available"] is True
        assert result["turn"] == 5


def test_get_suggestion_status_not_available(mock_db, mock_user):
    """Test status endpoint when suggestions are not available."""
    with patch('socialsim4.backend.services.environment_suggestion_service.get_simulation_state') as mock_get_state:
        mock_state = Mock()
        mock_state.turns = 3
        mock_state.config = {"enabled": True, "turn_interval": 5}
        mock_get_state.return_value = mock_state

        result = get_suggestion_status(simulation_id=1, db=mock_db, user=mock_user)

        assert result["available"] is False


def test_generate_suggestions(mock_db, mock_user):
    """Test generating suggestions."""
    with patch('socialsim4.backend.services.environment_suggestion_service.get_simulation_state') as mock_get_state, \
         patch('socialsim4.backend.services.environment_suggestion_service.EnvironmentAnalyzer') as mock_analyzer:

        mock_state = Mock()
        mock_state.turns = 5
        mock_state.events = [{"type": "system_broadcast", "text": "Test"}]
        mock_state.agents = [{"name": "Alice"}]
        mock_state.scene_state = {"time": 100}
        mock_get_state.return_value = mock_state

        mock_analyzer_instance = Mock()
        mock_analyzer_instance.generate_suggestions.return_value = [
            {"event_type": "weather", "description": "Rain begins.", "severity": "mild"},
        ]
        mock_analyzer.return_value = mock_analyzer_instance

        result = generate_suggestions(simulation_id=1, db=mock_db, user=mock_user)

        assert len(result["suggestions"]) == 1
        assert result["suggestions"][0]["event_type"] == "weather"
```

**Step 2: Run test to verify it fails**

```bash
pytest tests/test_environment_api.py -v
```

Expected: FAIL with "module not found"

**Step 3: Write minimal implementation**

First, create the service at `src/socialsim4/backend/services/environment_suggestion_service.py`:

```python
import logging
from typing import Dict, List, Any, Optional
from sqlalchemy import select
from socialsim4.core.environment_analyzer import EnvironmentAnalyzer
from socialsim4.core.environment_config import EnvironmentConfig
from socialsim4.database.models import Simulation, Node, ProviderConfig

logger = logging.getLogger(__name__)


async def get_user_llm_clients(db, user_id: int) -> Optional[Dict[str, Any]]:
    """Get LLM clients for a user."""
    from socialsim4.services.llm_client_pool import LLMClientPool

    # Get user's active provider
    result = await db.execute(
        select(ProviderConfig).where(
            ProviderConfig.user_id == user_id,
        )
    )
    providers = result.scalars().all()

    if not providers:
        return None

    # Get active provider
    active = [p for p in providers if (p.config or {}).get("active")]
    provider = active[0] if active else providers[0]

    if not provider:
        return None

    # Build LLM client from provider config
    from socialsim4.core.llm_config import LLMConfig
    from socialsim4.core.llm import create_llm_client

    config_data = provider.config or {}
    llm_config = LLMConfig(
        dialect=config_data.get("dialect", "openai"),
        api_key=config_data.get("api_key", ""),
        model=config_data.get("model", "gpt-4o-mini"),
        base_url=config_data.get("base_url"),
        temperature=config_data.get("temperature", 0.7),
    )

    client = create_llm_client(llm_config)
    return {"chat": client, "default": client}


async def get_simulation_state(simulation_id: int, db, user_id: int) -> Optional[Dict[str, Any]]:
    """Get current simulation state."""
    result = await db.execute(
        select(Simulation).where(
            Simulation.id == simulation_id,
            Simulation.user_id == user_id,
        )
    )
    sim = result.scalar_one_or_none()

    if not sim:
        return None

    # Get current node state from SimTree
    from socialsim4.backend.services.simtree_service import get_current_simulator
    simulator = await get_current_simulator(simulation_id, db)

    if not simulator:
        return None

    return {
        "turns": simulator.turns,
        "config": simulator.environment_config.serialize(),
        "_suggestions_viewed_turn": simulator._suggestions_viewed_turn,
        "clients": simulator.clients,
    }


async def generate_environment_suggestions(
    simulation_id: int,
    db,
    user_id: int,
) -> List[Dict[str, Any]]:
    """Generate environmental event suggestions for a simulation."""
    state = await get_simulation_state(simulation_id, db, user_id)
    if not state:
        raise ValueError("Simulation not found")

    # Get LLM clients
    clients = state.get("clients")
    if not clients:
        # Try to get from user providers
        clients = await get_user_llm_clients(db, user_id)

    if not clients:
        raise ValueError("No LLM provider configured")

    # Get recent events from simulation
    result = await db.execute(
        select(Node).where(
            Node.simulation_id == simulation_id,
        ).order_by(Node.created_at.desc()).limit(1)
    )
    current_node = result.scalar_one_or_none()

    recent_events = []
    if current_node and current_node.logs:
        # Get last 5 turns worth of events
        recent_events = [
            {"type": log.get("type"), "text": log.get("data", {}).get("text", "")}
            for log in current_node.logs[-50:]  # Rough estimate for 5 turns
            if log.get("type") in ("system_broadcast", "action_end")
        ]

    # Build context for analyzer
    context = {
        "recent_events": recent_events,
        "agent_count": len(state.get("agents", [])),
        "current_turn": state["turns"],
        "scene_time": 540,  # Default, would come from actual scene state
    }

    analyzer = EnvironmentAnalyzer(clients)
    return analyzer.generate_suggestions(context, count=3)


async def broadcast_environment_event(
    simulation_id: int,
    event_data: Dict[str, Any],
    db,
    user_id: int,
) -> bool:
    """Broadcast an environment event to all agents in the simulation."""
    from socialsim4.core.event import EnvironmentEvent
    from socialsim4.backend.services.simtree_service import get_current_simulator, apply_event_to_node

    simulator = await get_current_simulator(simulation_id, db)
    if not simulator:
        raise ValueError("Simulation not found")

    # Create event
    event = EnvironmentEvent(
        event_type=event_data["event_type"],
        description=event_data["description"],
        severity=event_data.get("severity", "mild"),
    )

    # Broadcast to all agents
    simulator.broadcast(event)

    # Mark suggestions as viewed
    simulator.dismiss_environment_suggestions()

    return True
```

Then create the route at `src/socialsim4/backend/api/routes/environment.py`:

```python
from typing import Dict, Any
from litestar import Router, get, post
from litestar.di import Provide
from litestar.params import Dependency
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from socialsim4.database import get_db
from socialsim4.backend.services.environment_suggestion_service import (
    get_simulation_state,
    generate_environment_suggestions,
    broadcast_environment_event,
)
from socialsim4.backend.dependencies import get_current_user


class SuggestionStatusResponse(BaseModel):
    available: bool
    turn: int | None = None


class SuggestionRequest(BaseModel):
    event_type: str = Field(..., description="Type of event: weather, emergency, notification, opinion")
    description: str = Field(..., description="Event description")
    severity: str = Field(default="mild", description="Severity: mild, moderate, severe")


class SuggestionsResponse(BaseModel):
    suggestions: list[Dict[str, Any]]


@get("/simulations/{simulation_id:int}/suggestions/status")
async def get_suggestion_status(
    simulation_id: int,
    db: AsyncSession = Dependency(get_db),
    user=Dependency(get_current_user),
) -> SuggestionStatusResponse:
    """Check if environment suggestions are available for the current turn."""
    state = await get_simulation_state(simulation_id, db, user.id)

    if not state:
        return SuggestionStatusResponse(available=False, turn=None)

    # Check if suggestions should be available
    config = state["config"]
    if not config.get("enabled"):
        return SuggestionStatusResponse(available=False, turn=None)

    turns = state["turns"]
    interval = config.get("turn_interval", 5)

    available = (
        turns > 0
        and turns % interval == 0
        and state.get("_suggestions_viewed_turn") != (turns // interval) * interval
    )

    return SuggestionStatusResponse(available=available, turn=turns if available else None)


@post("/simulations/{simulation_id:int}/suggestions/generate")
async def generate_suggestions(
    simulation_id: int,
    db: AsyncSession = Dependency(get_db),
    user=Dependency(get_current_user),
) -> SuggestionsResponse:
    """Generate environment event suggestions based on current simulation context."""
    suggestions = await generate_environment_suggestions(simulation_id, db, user.id)
    return SuggestionsResponse(suggestions=suggestions)


@post("/simulations/{simulation_id:int}/events/environment")
async def apply_environment_event(
    simulation_id: int,
    data: SuggestionRequest,
    db: AsyncSession = Dependency(get_db),
    user=Dependency(get_current_user),
) -> Dict[str, Any]:
    """Apply an environment event to the simulation."""
    await broadcast_environment_event(
        simulation_id,
        data.model_dump(),
        db,
        user.id,
    )
    return {"success": True, "message": "Event broadcast to simulation"}


router = Router(path="/api", route_handlers=[
    get_suggestion_status,
    generate_suggestions,
    apply_environment_event,
])
```

**Step 4: Register the router**

Modify `src/socialsim4/backend/api/routes/__init__.py`:

```python
from . import (
    admin,
    auth,
    config,
    providers,
    scenes,
    simulations,
    search_providers,
    llm,
    experiments,
    uploads,
    environment,  # Add this import
)

router = Router(
    path="",
    route_handlers=[
        auth.router,
        config.router,
        scenes.router,
        simulations.router,
        providers.router,
        search_providers.router,
        llm.router,
        experiments.router,
        uploads.router,
        admin.router,
        environment.router,  # Add this
    ],
)
```

**Step 5: Run test to verify it passes**

```bash
pytest tests/test_environment_api.py -v
```

Expected: PASS (with mocked dependencies)

**Step 6: Commit**

```bash
git add src/socialsim4/backend/api/routes/environment.py src/socialsim4/backend/services/environment_suggestion_service.py src/socialsim4/backend/api/routes/__init__.py tests/test_environment_api.py
git commit -m "feat: add environment suggestion API routes"
```

---

## Task 6: Create Frontend Store State

**Files:**
- Modify: `frontend/store.ts`
- Create: `frontend/services/environmentSuggestions.ts`

**Step 1: Write the frontend service**

Create `frontend/services/environmentSuggestions.ts`:

```typescript
import { apiClient } from './client';

export interface EnvironmentSuggestion {
  event_type: string;
  description: string;
  severity: string;
}

export interface SuggestionStatus {
  available: boolean;
  turn: number | null;
}

export async function getSuggestionStatus(simulationId: number): Promise<SuggestionStatus> {
  const response = await apiClient.get(`/api/simulations/${simulationId}/suggestions/status`);
  return response.data;
}

export async function generateSuggestions(simulationId: number): Promise<{ suggestions: EnvironmentSuggestion[] }> {
  const response = await apiClient.post(`/api/simulations/${simulationId}/suggestions/generate`);
  return response.data;
}

export async function applyEnvironmentEvent(
  simulationId: number,
  event: EnvironmentSuggestion,
): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.post(`/api/simulations/${simulationId}/events/environment`, event);
  return response.data;
}
```

**Step 2: Add store state to store.ts**

Add to the `AppState` interface in `frontend/store.ts` (around line 100):

```typescript
interface AppState {
  // ... existing state ...

  // Environment Suggestions
  environmentSuggestionsAvailable: boolean;
  environmentSuggestions: EnvironmentSuggestion[];
  environmentSuggestionsLoading: boolean;
  checkEnvironmentSuggestions: () => Promise<void>;
  generateEnvironmentSuggestions: () => Promise<void>;
  applyEnvironmentSuggestion: (suggestion: EnvironmentSuggestion) => Promise<void>;
  dismissEnvironmentSuggestions: () => void;
}
```

Add the state initialization and actions in the store implementation (find where other state is initialized):

```typescript
const useAppStore = create<AppState>((set, get) => ({
  // ... existing initializations ...

  // Environment Suggestions
  environmentSuggestionsAvailable: false,
  environmentSuggestions: [],
  environmentSuggestionsLoading: false,

  checkEnvironmentSuggestions: async () => {
    const { currentSimulation } = get();
    if (!currentSimulation) return;

    try {
      const status = await getSuggestionStatus(currentSimulation.id);
      set({ environmentSuggestionsAvailable: status.available });
    } catch (error) {
      console.error('Failed to check environment suggestions:', error);
    }
  },

  generateEnvironmentSuggestions: async () => {
    const { currentSimulation } = get();
    if (!currentSimulation) return;

    set({ environmentSuggestionsLoading: true });
    try {
      const result = await generateSuggestions(currentSimulation.id);
      set({ environmentSuggestions: result.suggestions });
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
      get().addNotification('error', 'Failed to generate environment suggestions');
    } finally {
      set({ environmentSuggestionsLoading: false });
    }
  },

  applyEnvironmentSuggestion: async (suggestion: EnvironmentSuggestion) => {
    const { currentSimulation } = get();
    if (!currentSimulation) return;

    try {
      await applyEnvironmentEvent(currentSimulation.id, suggestion);
      set({
        environmentSuggestions: [],
        environmentSuggestionsAvailable: false,
      });
      get().addNotification('success', 'Environment event applied');
    } catch (error) {
      console.error('Failed to apply event:', error);
      get().addNotification('error', 'Failed to apply environment event');
    }
  },

  dismissEnvironmentSuggestions: () => {
    set({
      environmentSuggestions: [],
      environmentSuggestionsAvailable: false,
    });
  },
}));
```

Also add the import at the top of the file:
```typescript
import { getSuggestionStatus, generateSuggestions, applyEnvironmentEvent, type EnvironmentSuggestion } from './services/environmentSuggestions';
```

**Step 3: Commit**

```bash
git add frontend/store.ts frontend/services/environmentSuggestions.ts
git commit -m "feat: add environment suggestion state to frontend store"
```

---

## Task 7: Create Frontend Component

**Files:**
- Create: `frontend/components/EnvironmentSuggestion.tsx`
- Modify: `frontend/components/SimTree.tsx` (to integrate indicator)

**Step 1: Create the EnvironmentSuggestion component**

Create `frontend/components/EnvironmentSuggestion.tsx`:

```typescript
import React from 'react';
import { useAppStore } from '../store';
import type { EnvironmentSuggestion } from '../services/environmentSuggestions';

const severityColors = {
  mild: 'bg-blue-100 text-blue-800 border-blue-200',
  moderate: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  severe: 'bg-red-100 text-red-800 border-red-200',
};

const eventTypeLabels = {
  weather: 'Weather',
  emergency: 'Emergency',
  notification: 'Notification',
  opinion: 'Public Opinion',
};

interface EnvironmentSuggestionProps {
  onClose?: () => void;
}

export const EnvironmentSuggestionIndicator: React.FC = () => {
  const { environmentSuggestionsAvailable, checkEnvironmentSuggestions, generateEnvironmentSuggestions } = useAppStore();

  React.useEffect(() => {
    // Check status when simulation changes
    checkEnvironmentSuggestions();
  }, [checkEnvironmentSuggestions]);

  if (!environmentSuggestionsAvailable) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <button
        onClick={generateEnvironmentSuggestions}
        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
        <span>Environment Events Available</span>
      </button>
    </div>
  );
};

export const EnvironmentSuggestionDialog: React.FC<EnvironmentSuggestionProps> = ({ onClose }) => {
  const { environmentSuggestions, environmentSuggestionsLoading, applyEnvironmentSuggestion, dismissEnvironmentSuggestions } = useAppStore();

  const handleApply = async (suggestion: EnvironmentSuggestion) => {
    await applyEnvironmentSuggestion(suggestion);
    onClose?.();
  };

  const handleDismiss = () => {
    dismissEnvironmentSuggestions();
    onClose?.();
  };

  if (environmentSuggestionsLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="ml-3 text-gray-600">Generating suggestions...</span>
          </div>
        </div>
      </div>
    );
  }

  if (environmentSuggestions.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Environmental Event Suggestions</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          <p className="text-sm text-gray-600 mb-4">
            Based on recent simulation activity, here are some environmental events that could occur:
          </p>

          <div className="space-y-3">
            {environmentSuggestions.map((suggestion, index) => (
              <div
                key={index}
                className={`border rounded-lg p-4 ${severityColors[suggestion.severity as keyof typeof severityColors]}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-sm font-medium">
                    {eventTypeLabels[suggestion.event_type as keyof typeof eventTypeLabels] || suggestion.event_type}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded ${severityColors[suggestion.severity as keyof typeof severityColors]}`}>
                    {suggestion.severity}
                  </span>
                </div>
                <p className="text-gray-700">{suggestion.description}</p>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleApply(suggestion)}
                    className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 transition-colors"
                  >
                    Apply
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition-colors"
                  >
                    Skip
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50">
          <button
            onClick={handleDismiss}
            className="w-full px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
          >
            Dismiss All Suggestions
          </button>
        </div>
      </div>
    </div>
  );
};

export const EnvironmentSuggestionDialogWrapper: React.FC = () => {
  const { environmentSuggestions } = useAppStore();

  if (environmentSuggestions.length === 0) {
    return <EnvironmentSuggestionIndicator />;
  }

  return <EnvironmentSuggestionDialog />;
};
```

**Step 2: Integrate with SimTree component**

Add the indicator to the main simulation view. Modify `frontend/components/SimTree.tsx` (find the main component return):

Add this import near the top:
```typescript
import { EnvironmentSuggestionDialogWrapper } from './EnvironmentSuggestion';
```

Add the component to the JSX, likely near the end of the component's return:
```typescript
return (
  <div className="simulation-container">
    {/* ... existing components ... */}
    <EnvironmentSuggestionDialogWrapper />
  </div>
);
```

**Step 3: Commit**

```bash
git add frontend/components/EnvironmentSuggestion.tsx frontend/components/SimTree.tsx
git commit -m "feat: add environment suggestion UI components"
```

---

## Task 8: Add Environment Events to Timeline

**Files:**
- Modify: `frontend/components/SimTree.tsx` (timeline rendering)

**Step 1: Update timeline to show environment events**

Find where log entries are rendered in the timeline. Add special styling for `environment_event` type:

```typescript
// In the log rendering section
const getLogEntryStyle = (entry: LogEntry) => {
  if (entry.type === 'environment_event') {
    return 'bg-amber-50 border-amber-200';
  }
  // ... existing styles ...
};

const getLogEntryIcon = (entry: LogEntry) => {
  if (entry.type === 'environment_event') {
    return (
      <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
      </svg>
    );
  }
  // ... existing icons ...
};
```

**Step 2: Commit**

```bash
git add frontend/components/SimTree.tsx
git commit -m "feat: add environment event styling in timeline"
```

---

## Task 9: Integration Testing

**Step 1: Manual integration test**

Create a test script to verify the full flow:

```bash
cd /c/Users/justi/Documents/ZJU_Work/Social-Sim

# Start backend
export PYTHONPATH="$(pwd)/src"
uvicorn socialsim4.backend.main:app --host 0.0.0.0 --port 8000 --reload &

# Start frontend
cd frontend && npm run dev &

# Run tests
pytest tests/test_environment_*.py -v
```

**Step 2: Manual testing checklist**

1. Create a new simulation
2. Run 5 turns
3. Verify the "Environment Events Available" indicator appears
4. Click the indicator
5. Verify suggestions are generated
6. Apply a suggestion
7. Verify the event appears in the timeline
8. Verify agents reference the event in subsequent dialogue

**Step 3: Commit**

```bash
git add .
git commit -m "test: add integration tests for dynamic environment feature"
```

---

## Task 10: Documentation and Cleanup

**Step 1: Update README**

Add a section to `README.md` documenting the new feature:

```markdown
### Dynamic Environment Events

The simulation can suggest environmental events (weather changes, emergencies, notifications, public opinion shifts) based on recent activity.

- **Availability**: Suggestions are offered every 5 turns
- **On-demand**: LLM analysis only runs when you click to view suggestions
- **Application**: Accepted events are broadcast to all agents, who react naturally based on their personalities
- **Configuration**: Can be enabled/disabled per simulation

To use: Run a simulation for at least 5 turns, then click the "Environment Events Available" button when it appears.
```

**Step 2: Final commit**

```bash
git add README.md
git commit -m "docs: add dynamic environment feature documentation"
```

---

## Summary

This implementation plan breaks down the dynamic environment feature into 10 tasks, each with multiple steps following TDD practices:

| Task | Component | Files |
|------|-----------|-------|
| 1 | EnvironmentEvent | `core/event.py` |
| 2 | EnvironmentConfig | `core/environment_config.py` |
| 3 | EnvironmentAnalyzer | `core/environment_analyzer.py` |
| 4 | Simulator integration | `core/simulator.py` |
| 5 | Backend API | `backend/api/routes/environment.py`, `services/environment_suggestion_service.py` |
| 6 | Frontend store | `store.ts`, `services/environmentSuggestions.ts` |
| 7 | Frontend component | `components/EnvironmentSuggestion.tsx` |
| 8 | Timeline styling | `components/SimTree.tsx` |
| 9 | Integration tests | Various test files |
| 10 | Documentation | `README.md` |

**Total estimated commits**: ~15 commits (one per task/step)
