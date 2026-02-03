# Generic Template System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hard-coded templates with a composable, user-defined template system where users can mix and match core mechanics (grid, discussion, voting, resources, hierarchy) and define custom semantic actions.

**Architecture:** Component-based template system where each template is defined by:
1. **Core Mechanics** - Modular scene features (movement, voting, chatting, resources)
2. **Semantic Actions** - User-defined actions with LLM-driven behavior
3. **Agent Profiles** - Reusable agent archetypes with traits/demographics
4. **Environment Config** - Time, space, and rules

**Tech Stack:** Python (pydantic for validation), React/TypeScript (wizard), JSON schema for templates

---

## Task 1: Create Generic Template Schema

**Files:**
- Create: `src/socialsim4/templates/schema.py`
- Create: `src/socialsim4/templates/__init__.py`

**Step 1: Define Pydantic models for template schema**

```python
# src/socialsim4/templates/schema.py
from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any, Literal

class CoreMechanic(BaseModel):
    """Core mechanic configuration."""
    type: Literal["grid", "discussion", "voting", "resources", "hierarchy", "time"]
    config: Dict[str, Any] = Field(default_factory=dict)

class SemanticAction(BaseModel):
    """User-defined semantic action with LLM-driven behavior."""
    name: str = Field(..., pattern=r"^[a-z_]+$")
    description: str
    instruction: str  # Instructions to LLM for when to use this action
    parameters: Dict[str, str] = Field(default_factory=dict)  # param -> description
    effect: Optional[str] = None  # Optional Python code for side effects

class AgentArchetype(BaseModel):
    """Reusable agent archetype."""
    name: str
    role_prompt: str
    style: str = "neutral"
    user_profile: str = ""
    properties: Dict[str, Any] = Field(default_factory=dict)
    allowed_actions: List[str] = Field(default_factory=list)

class EnvironmentConfig(BaseModel):
    """Environment configuration."""
    description: str
    time_config: Optional[Dict[str, Any]] = None
    space_config: Optional[Dict[str, Any]] = None
    rules: List[str] = Field(default_factory=list)

class GenericTemplate(BaseModel):
    """Complete user-defined template."""
    id: str
    name: str
    description: str
    version: str = "1.0"
    author: Optional[str] = None

    # Core components
    core_mechanics: List[CoreMechanic] = Field(default_factory=list)
    semantic_actions: List[SemanticAction] = Field(default_factory=list)
    agent_archetypes: List[AgentArchetype] = Field(default_factory=list)

    # Environment
    environment: EnvironmentConfig

    # Default settings
    default_time_config: Optional[Dict[str, Any]] = None
    default_network: Optional[Dict[str, List[str]]] = None
```

**Step 2: Create JSON schema export**

```python
def export_json_schema() -> dict:
    """Export JSON schema for frontend validation."""
    return GenericTemplate.model_json_schema()
```

**Step 3: Create example templates**

```json
// examples/village_template.json
{
  "id": "village",
  "name": "Village Simulation",
  "description": "Grid-based village with movement and resources",
  "version": "1.0",
  "core_mechanics": [
    {"type": "grid", "config": {"width": 20, "height": 20, "chat_range": 5}},
    {"type": "resources", "config": {"resources": ["food", "wood", "water"]}},
    {"type": "time", "config": {"minutes_per_turn": 3}}
  ],
  "semantic_actions": [],
  "agent_archetypes": [
    {
      "name": "farmer",
      "role_prompt": "Farmer",
      "user_profile": "Grows crops and gathers food",
      "allowed_actions": ["move_to_location", "look_around", "gather_resource", "rest"]
    }
  ],
  "environment": {
    "description": "A small village with farmland and forest",
    "rules": ["Manage your energy", "Speak to nearby agents only"]
  }
}
```

**Step 4: Write schema validation tests**

```python
# tests/test_template_schema.py
def test_valid_template():
    template = GenericTemplate(**{
        "id": "test",
        "name": "Test",
        "description": "Test template",
        "environment": {"description": "Test env"}
    })
    assert template.id == "test"

def test_semantic_action_name_validation():
    with pytest.raises(ValidationError):
        SemanticAction(name="Invalid-Name", description="Test", instruction="Test")
```

**Step 5: Run tests**

```bash
cd .worktrees/refactoring
pytest tests/test_template_schema.py -v
```

---

## Task 2: Implement Core Mechanics Modules

**Files:**
- Create: `src/socialsim4/templates/mechanics/__init__.py`
- Create: `src/socialsim4/templates/mechanics/base.py`
- Create: `src/socialsim4/templates/mechanics/grid_mechanic.py`
- Create: `src/socialsim4/templates/mechanics/voting_mechanic.py`
- Create: `src/socialsim4/templates/mechanics/resource_mechanic.py`
- Create: `src/socialsim4/templates/mechanics/hierarchy_mechanic.py`

**Step 1: Define base mechanic interface**

```python
# src/socialsim4/templates/mechanics/base.py
from abc import ABC, abstractmethod
from typing import Any, Dict

class CoreMechanic(ABC):
    """Base class for core mechanics."""

    TYPE: str = "base"

    @classmethod
    @abstractmethod
    def from_config(cls, config: Dict[str, Any]) -> "CoreMechanic":
        """Create mechanic from configuration."""
        pass

    @abstractmethod
    def initialize_agent(self, agent, scene):
        """Initialize an agent with this mechanic's properties."""
        pass

    @abstractmethod
    def get_actions(self) -> list:
        """Return list of action classes this mechanic provides."""
        pass

    @abstractmethod
    def get_scene_state(self) -> Dict[str, Any]:
        """Return mechanic's contribution to scene state."""
        pass
```

**Step 2: Implement GridMechanic**

```python
# src/socialsim4/templates/mechanics/grid_mechanic.py
from socialsim4.core.scenes.village_scene import GameMap, Location
from .base import CoreMechanic

class GridMechanic(CoreMechanic):
    TYPE = "grid"

    def __init__(self, width=20, height=20, chat_range=5, movement_cost=1.0):
        self.width = width
        self.height = height
        self.chat_range = chat_range
        self.movement_cost = movement_cost
        self.game_map = GameMap(width, height)

    @classmethod
    def from_config(cls, config: Dict[str, Any]) -> "GridMechanic":
        return cls(
            width=config.get("width", 20),
            height=config.get("height", 20),
            chat_range=config.get("chat_range", 5),
            movement_cost=config.get("movement_cost", 1.0)
        )

    def initialize_agent(self, agent, scene):
        agent.properties.setdefault("map_xy", [0, 0])
        agent.properties.setdefault("map_position", "0,0")
        agent.properties.setdefault("energy", 100)

    def get_actions(self):
        from socialsim4.core.actions.village_actions import (
            MoveToLocationAction, LookAroundAction
        )
        return [MoveToLocationAction, LookAroundAction]

    def get_scene_state(self):
        return {"game_map": self.game_map}
```

**Step 3: Implement VotingMechanic**

```python
# src/socialsim4/templates/mechanics/voting_mechanic.py
from .base import CoreMechanic

class VotingMechanic(CoreMechanic):
    TYPE = "voting"

    def __init__(self, voting_threshold=0.5, timeout_turns=10):
        self.voting_threshold = voting_threshold
        self.timeout_turns = timeout_turns
        self.active_proposals = {}

    @classmethod
    def from_config(cls, config: Dict[str, Any]) -> "VotingMechanic":
        return cls(
            voting_threshold=config.get("threshold", 0.5),
            timeout_turns=config.get("timeout_turns", 10)
        )

    def initialize_agent(self, agent, scene):
        agent.properties.setdefault("votes_cast", [])

    def get_actions(self):
        from socialsim4.core.actions.council_actions import VoteAction, VotingStatusAction
        return [VoteAction, VotingStatusAction]

    def get_scene_state(self):
        return {"voting": self.active_proposals}
```

**Step 4: Implement ResourceMechanic**

```python
# src/socialsim4/templates/mechanics/resource_mechanic.py
from .base import CoreMechanic

class ResourceMechanic(CoreMechanic):
    TYPE = "resources"

    def __init__(self, resources=None, depletion_rate=0.1):
        self.resources = resources or ["food", "wood", "water"]
        self.depletion_rate = depletion_rate

    @classmethod
    def from_config(cls, config: Dict[str, Any]) -> "ResourceMechanic":
        return cls(
            resources=config.get("resources", ["food", "wood", "water"]),
            depletion_rate=config.get("depletion_rate", 0.1)
        )

    def initialize_agent(self, agent, scene):
        agent.properties.setdefault("inventory", {})

    def get_actions(self):
        from socialsim4.core.actions.village_actions import GatherResourceAction
        return [GatherResourceAction]

    def get_scene_state(self):
        return {"available_resources": self.resources}
```

**Step 5: Create mechanic registry**

```python
# src/socialsim4/templates/mechanics/__init__.py
from .base import CoreMechanic
from .grid_mechanic import GridMechanic
from .voting_mechanic import VotingMechanic
from .resource_mechanic import ResourceMechanic

MECHANIC_REGISTRY: dict[str, type[CoreMechanic]] = {
    "grid": GridMechanic,
    "voting": VotingMechanic,
    "resources": ResourceMechanic,
}

def create_mechanic(mechanic_type: str, config: dict) -> CoreMechanic:
    """Factory function to create mechanic from type and config."""
    if mechanic_type not in MECHANIC_REGISTRY:
        raise ValueError(f"Unknown mechanic type: {mechanic_type}")
    return MECHANIC_REGISTRY[mechanic_type].from_config(config)
```

**Step 6: Write mechanic tests**

```python
# tests/test_mechanics.py
def test_grid_mechanic_creation():
    mechanic = GridMechanic.from_config({"width": 10, "height": 10})
    assert mechanic.width == 10
    assert mechanic.height == 10

def test_mechanic_registry():
    mechanic = create_mechanic("grid", {"width": 15})
    assert isinstance(mechanic, GridMechanic)
```

**Step 7: Run tests**

```bash
pytest tests/test_mechanics.py -v
```

---

## Task 3: Implement Semantic Action System

**Files:**
- Create: `src/socialsim4/templates/semantic_actions.py`

**Step 1: Create SemanticAction base class**

```python
# src/socialsim4/templates/semantic_actions.py
from socialsim4.core.action import Action
from socialsim4.core.agent import Agent
from socialsim4.core.scene import Scene
from socialsim4.core.simulator import Simulator
from typing import Dict, Any

class SemanticAction(Action):
    """User-defined action with LLM-driven behavior.

    The action instruction tells the LLM when/why to use this action.
    Parameters are parsed from XML and validated.
    """

    def __init__(self, name: str, description: str, instruction: str,
                 parameters: Dict[str, str] = None, effect_code: str = None):
        self.NAME = name
        self.DESC = description
        self._instruction = instruction
        self._parameters = parameters or {}
        self._effect_code = effect_code

    @property
    def INSTRUCTION(self):
        return f"""- {self.NAME}: {self.DESC}
  {self._instruction}
  <Action name="{self.NAME}">
    {self._get_param_examples()}
  </Action>"""

    def _get_param_examples(self):
        if not self._parameters:
            return ""
        return "\n    ".join(
            f"<{k}>{k}</{k}>" for k in self._parameters.keys()
        )

    def handle(self, action_data, agent: Agent, simulator: Simulator, scene: Scene):
        # Extract parameters
        params = {k: action_data.get(k) for k in self._parameters.keys()}

        # Build description of what happened
        param_str = ", ".join(f"{k}={v}" for k, v in params.items() if v is not None)
        summary = f"{agent.name} {self.NAME.replace('_', ' ')}"
        if param_str:
            summary += f" ({param_str})"

        # Add feedback to agent
        agent.add_env_feedback(f"You performed: {summary}")

        # Execute custom effect code if provided
        if self._effect_code:
            try:
                exec(self._effect_code, {"agent": agent, "scene": scene, "params": params})
            except Exception as e:
                agent.add_env_feedback(f"Action error: {e}")

        return True, params, summary, {}, False
```

**Step 2: Create action factory**

```python
class SemanticActionFactory:
    """Factory for creating semantic actions from template config."""

    _actions: Dict[str, SemanticAction] = {}

    @classmethod
    def register(cls, action: SemanticAction):
        """Register a semantic action."""
        cls._actions[action.NAME] = action

    @classmethod
    def create_from_config(cls, config: Dict[str, Any]) -> SemanticAction:
        """Create semantic action from template config."""
        return SemanticAction(
            name=config["name"],
            description=config["description"],
            instruction=config["instruction"],
            parameters=config.get("parameters", {}),
            effect_code=config.get("effect")
        )

    @classmethod
    def get_action(cls, name: str) -> SemanticAction:
        """Get registered action by name."""
        return cls._actions.get(name)

    @classmethod
    def list_actions(cls) -> list[str]:
        """List all registered action names."""
        return list(cls._actions.keys())
```

**Step 3: Write semantic action tests**

```python
# tests/test_semantic_actions.py
def test_semantic_action_creation():
    action = SemanticAction(
        name="pray",
        description="Pray at the shrine",
        instruction="Use when seeking spiritual guidance",
        parameters={"deity": "Name of the deity"}
    )
    assert "pray" in action.INSTRUCTION
    assert "<deity>" in action.INSTRUCTION

def test_semantic_action_factory():
    config = {
        "name": "meditate",
        "description": "Meditate to restore energy",
        "instruction": "Use when tired and at a peaceful location",
        "parameters": {"duration": "Duration in minutes"}
    }
    action = SemanticActionFactory.create_from_config(config)
    assert action.NAME == "meditate"
```

**Step 4: Run tests**

```bash
pytest tests/test_semantic_actions.py -v
```

---

## Task 4: Create Template Loader

**Files:**
- Create: `src/socialsim4/templates/loader.py`

**Step 1: Implement template loader**

```python
# src/socialsim4/templates/loader.py
import json
import yaml
from pathlib import Path
from typing import Union, Dict, Any
from .schema import GenericTemplate
from .mechanics import create_mechanic
from .semantic_actions import SemanticActionFactory

class TemplateLoader:
    """Load and validate user-defined templates."""

    def __init__(self, template_dir: Union[str, Path] = None):
        self.template_dir = Path(template_dir) if template_dir else None
        self._cache: Dict[str, GenericTemplate] = {}

    def load_from_file(self, path: Union[str, Path]) -> GenericTemplate:
        """Load template from JSON or YAML file."""
        path = Path(path)

        with open(path, 'r', encoding='utf-8') as f:
            if path.suffix in ('.yml', '.yaml'):
                data = yaml.safe_load(f)
            else:
                data = json.load(f)

        return self.load_from_dict(data)

    def load_from_dict(self, data: Dict[str, Any]) -> GenericTemplate:
        """Load template from dictionary."""
        template = GenericTemplate(**data)
        self._cache[template.id] = template
        return template

    def load_from_directory(self, directory: Union[str, Path]) -> Dict[str, GenericTemplate]:
        """Load all templates from a directory."""
        templates = {}
        for path in Path(directory).glob('**/*.{json,yaml,yml}'):
            try:
                template = self.load_from_file(path)
                templates[template.id] = template
            except Exception as e:
                print(f"Warning: Failed to load {path}: {e}")
        return templates

    def build_scene_from_template(self, template: GenericTemplate):
        """Build a Scene instance from template."""
        from socialsim4.core.scene import Scene

        # Create a generic scene that composes all mechanics
        scene = GenericScene(
            name=template.name,
            initial_event=template.environment.description,
            mechanics_config=template.core_mechanics,
            semantic_actions_config=template.semantic_actions
        )

        return scene

class GenericScene(Scene):
    """Generic scene composed of core mechanics."""

    def __init__(self, name, initial_event, mechanics_config=None, semantic_actions_config=None):
        super().__init__(name, initial_event)
        self.mechanics = []
        self.semantic_actions = []

        # Initialize mechanics
        for mechanic_cfg in mechanics_config or []:
            mechanic = create_mechanic(mechanic_cfg.type, mechanic_cfg.config)
            self.mechanics.append(mechanic)
            # Merge mechanic state into scene state
            self.state.update(mechanic.get_scene_state())

        # Initialize semantic actions
        for action_cfg in semantic_actions_config or []:
            action = SemanticActionFactory.create_from_config(action_cfg)
            SemanticActionFactory.register(action)
            self.semantic_actions.append(action)

    def initialize_agent(self, agent):
        """Initialize agent with all mechanics."""
        for mechanic in self.mechanics:
            mechanic.initialize_agent(agent, self)
        super().initialize_agent(agent)

    def get_scene_actions(self, agent):
        """Get actions from all mechanics plus semantic actions."""
        actions = super().get_scene_actions(agent)

        # Add actions from each mechanic
        for mechanic in self.mechanics:
            actions.extend(mechanic.get_actions())

        # Add semantic actions
        actions.extend(self.semantic_actions)

        return actions

    def get_compact_description(self):
        """Build compact description from mechanics."""
        parts = [self.name]
        for mechanic in self.mechanics:
            if mechanic.TYPE == "grid":
                parts.append(f"{mechanic.width}x{mechanic.height} grid")
            elif mechanic.TYPE == "voting":
                parts.append("voting enabled")
            elif mechanic.TYPE == "resources":
                parts.append(f"resources: {', '.join(mechanic.resources)}")

        env_desc = self.environment.description if hasattr(self, 'environment') else ""
        return ". ".join(parts) + ". " + env_desc
```

**Step 2: Write loader tests**

```python
# tests/test_template_loader.py
def test_load_json_template():
    loader = TemplateLoader()
    template_data = {
        "id": "test",
        "name": "Test",
        "description": "Test template",
        "environment": {"description": "Test env"}
    }
    template = loader.load_from_dict(template_data)
    assert template.id == "test"

def test_build_scene_from_template():
    loader = TemplateLoader()
    template_data = {
        "id": "village",
        "name": "Village",
        "description": "Test village",
        "core_mechanics": [
            {"type": "grid", "config": {"width": 10, "height": 10}}
        ],
        "environment": {"description": "A test village"}
    }
    template = loader.load_from_dict(template_data)
    scene = loader.build_scene_from_template(template)
    assert len(scene.mechanics) == 1
```

**Step 3: Run tests**

```bash
pytest tests/test_template_loader.py -v
```

---

## Task 5: Update Backend API

**Files:**
- Modify: `src/socialsim4/backend/api/routes/scenes.py`
- Modify: `src/socialsim4/core/registry.py`

**Step 1: Add template endpoints**

```python
# src/socialsim4/backend/api/routes/scenes.py
from socialsim4.templates.loader import TemplateLoader

template_loader = TemplateLoader()

@router.get("/templates")
async def list_templates():
    """List all available templates (system + user-defined)."""
    templates = template_loader.load_from_directory("templates/")
    return {
        "system": [{"id": k, "name": SCENE_DESCRIPTIONS.get(k, k)} for k in SCENE_MAP.keys()],
        "custom": [{"id": t.id, "name": t.name, "description": t.description} for t in templates.values()]
    }

@router.post("/templates/validate")
async def validate_template(template: dict):
    """Validate a user-defined template."""
    try:
        from socialsim4.templates.schema import GenericTemplate
        GenericTemplate(**template)
        return {"valid": True}
    except Exception as e:
        return {"valid": False, "errors": str(e)}

@router.post("/templates/build")
async def build_scene_from_template(template: dict):
    """Build a scene from template configuration."""
    from socialsim4.templates.loader import TemplateLoader
    loader = TemplateLoader()
    generic_template = loader.load_from_dict(template)
    scene = loader.build_scene_from_template(generic_template)
    return {
        "scene_type": "generic_scene",
        "config": scene.serialize()
    }
```

**Step 2: Update registry**

```python
# src/socialsim4/core/registry.py
# Add GenericScene to SCENE_MAP
from socialsim4.templates.loader import GenericScene

SCENE_MAP["generic_scene"] = GenericScene
SCENE_ACTIONS["generic_scene"] = {
    "basic": ["yield"],
    "allowed": []  # Dynamically populated by mechanics
}
```

---

## Task 6: Update Frontend Wizard

**Files:**
- Modify: `frontend/types.ts`
- Modify: `frontend/store.ts`
- Modify: `frontend/pages/SimulationWizardPage.tsx`
- Create: `frontend/components/TemplateBuilder.tsx`

**Step 1: Add generic template types**

```typescript
// frontend/types.ts

export interface CoreMechanicConfig {
  type: 'grid' | 'discussion' | 'voting' | 'resources' | 'hierarchy' | 'time';
  config: Record<string, any>;
}

export interface SemanticActionConfig {
  name: string;
  description: string;
  instruction: string;
  parameters?: Record<string, string>;
}

export interface GenericTemplateConfig {
  id: string;
  name: string;
  description: string;
  coreMechanics: CoreMechanicConfig[];
  semanticActions: SemanticActionConfig[];
  agentArchetypes: AgentArchetypeConfig[];
  environment: {
    description: string;
    rules?: string[];
  };
  defaultTimeConfig?: TimeConfig;
}

export interface AgentArchetypeConfig {
  name: string;
  rolePrompt: string;
  style?: string;
  userProfile?: string;
  allowedActions?: string[];
}
```

**Step 2: Create TemplateBuilder component**

```typescript
// frontend/components/TemplateBuilder.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface TemplateBuilderProps {
  onTemplateChange: (template: GenericTemplateConfig) => void;
}

export function TemplateBuilder({ onTemplateChange }: TemplateBuilderProps) {
  const { t } = useTranslation();
  const [template, setTemplate] = useState<GenericTemplateConfig>({
    id: '',
    name: '',
    description: '',
    coreMechanics: [],
    semanticActions: [],
    agentArchetypes: [],
    environment: { description: '', rules: [] }
  });

  const mechanicTypes: CoreMechanicConfig['type'][] = ['grid', 'discussion', 'voting', 'resources', 'hierarchy', 'time'];

  const addMechanic = (type: CoreMechanicConfig['type']) => {
    const newTemplate = {
      ...template,
      coreMechanics: [...template.coreMechanics, { type, config: {} }]
    };
    setTemplate(newTemplate);
    onTemplateChange(newTemplate);
  };

  const removeMechanic = (index: number) => {
    const newTemplate = {
      ...template,
      coreMechanics: template.coreMechanics.filter((_, i) => i !== index)
    };
    setTemplate(newTemplate);
    onTemplateChange(newTemplate);
  };

  // ... similar handlers for semantic actions and archetypes

  return (
    <div className="template-builder">
      <h2>{t('wizard.templateBuilder.title')}</h2>

      {/* Basic Info */}
      <div className="form-group">
        <label>{t('wizard.templateBuilder.name')}</label>
        <input
          value={template.name}
          onChange={(e) => setTemplate({...template, name: e.target.value})}
        />
      </div>

      {/* Core Mechanics */}
      <div className="mechanics-section">
        <h3>{t('wizard.templateBuilder.coreMechanics')}</h3>
        <div className="mechanic-buttons">
          {mechanicTypes.map(type => (
            <button key={type} onClick={() => addMechanic(type)}>
              {t(`wizard.templateBuilder.mechanics.${type}`)}
            </button>
          ))}
        </div>
        {template.coreMechanics.map((mechanic, index) => (
          <div key={index} className="mechanic-item">
            <span>{mechanic.type}</span>
            <button onClick={() => removeMechanic(index)}>×</button>
          </div>
        ))}
      </div>

      {/* Semantic Actions */}
      <div className="semantic-actions-section">
        <h3>{t('wizard.templateBuilder.semanticActions')}</h3>
        <button onClick={() => {/* add action modal */}}>
          {t('wizard.templateBuilder.addAction')}
        </button>
      </div>
    </div>
  );
}
```

**Step 3: Update wizard to include custom template option**

```typescript
// frontend/pages/SimulationWizardPage.tsx

// Add to wizard steps
const [templateMode, setTemplateMode] = useState<'system' | 'custom'>('system');
const [customTemplate, setCustomTemplate] = useState<GenericTemplateConfig | null>(null);

// In template selection step
<div className="template-mode-selection">
  <button onClick={() => setTemplateMode('system')}>
    {t('wizard.templateMode.system')}
  </button>
  <button onClick={() => setTemplateMode('custom')}>
    {t('wizard.templateMode.custom')}
  </button>
</div>

{templateMode === 'custom' && (
  <TemplateBuilder onTemplateChange={setCustomTemplate} />
)}
```

---

## Task 7: Create Example Templates

**Files:**
- Create: `templates/village.json`
- Create: `templates/council.json`
- Create: `templates/custom_trading.json`

**Step 1: Create village template**

```json
{
  "id": "village",
  "name": "Village Simulation",
  "description": "Grid-based village with movement, resources, and local chat",
  "version": "1.0",
  "core_mechanics": [
    {
      "type": "grid",
      "config": {
        "width": 20,
        "height": 20,
        "chat_range": 5,
        "movement_cost": 1.0
      }
    },
    {
      "type": "resources",
      "config": {
        "resources": ["food", "wood", "water"]
      }
    },
    {
      "type": "time",
      "config": {
        "minutes_per_turn": 3
      }
    }
  ],
  "semantic_actions": [],
  "agent_archetypes": [
    {
      "name": "farmer",
      "role_prompt": "Farmer",
      "user_profile": "Grows crops and gathers food from the fields.",
      "allowed_actions": ["move_to_location", "look_around", "gather_resource", "rest", "talk_to"]
    },
    {
      "name": "merchant",
      "role_prompt": "Merchant",
      "user_profile": "Trades goods and travels between locations.",
      "allowed_actions": ["move_to_location", "look_around", "talk_to"]
    }
  ],
  "environment": {
    "description": "A small village surrounded by farmland and forest. There is a market square in the center.",
    "rules": [
      "Manage your energy - moving and gathering costs energy",
      "Speak to nearby agents only (within chat range)",
      "Gather resources to survive and trade"
    ]
  }
}
```

**Step 2: Create council template**

```json
{
  "id": "council",
  "name": "Council Meeting",
  "description": "Formal discussion with voting mechanics",
  "version": "1.0",
  "core_mechanics": [
    {
      "type": "discussion",
      "config": {
        "moderated": true,
        "speaking_time_limit": 3
      }
    },
    {
      "type": "voting",
      "config": {
        "threshold": 0.5,
        "timeout_turns": 10
      }
    }
  ],
  "semantic_actions": [],
  "agent_archetypes": [
    {
      "name": "councilor",
      "role_prompt": "Council Member",
      "user_profile": "Elected representative debating policy.",
      "allowed_actions": ["send_message", "vote", "voting_status", "yield"]
    }
  ],
  "environment": {
    "description": "A council chamber where representatives debate and vote on proposals.",
    "rules": [
      "Wait to be recognized before speaking",
      "Vote on proposals when voting is opened",
      "Maintain formal decorum"
    ]
  }
}
```

**Step 3: Create custom trading template with semantic actions**

```json
{
  "id": "trading_post",
  "name": "Trading Post",
  "description": "Market simulation with custom trading actions",
  "version": "1.0",
  "core_mechanics": [
    {
      "type": "grid",
      "config": {
        "width": 15,
        "height": 15,
        "chat_range": 3
      }
    },
    {
      "type": "resources",
      "config": {
        "resources": ["gold", "food", "tools", "cloth"]
      }
    }
  ],
  "semantic_actions": [
    {
      "name": "trade",
      "description": "Trade items with another agent",
      "instruction": "Use when you want to exchange goods with someone nearby",
      "parameters": {
        "target": "Name of the agent to trade with",
        "offer": "What you're offering",
        "request": "What you want in return"
      }
    },
    {
      "name": "set_price",
      "description": "Set prices for your goods",
      "instruction": "Use when you want to establish or change prices",
      "parameters": {
        "item": "Name of the item",
        "price": "Price in gold"
      }
    }
  ],
  "agent_archetypes": [
    {
      "name": "trader",
      "role_prompt": "Trader",
      "user_profile": "Merchant who buys and sells goods at the market.",
      "allowed_actions": ["move_to_location", "talk_to", "trade", "set_price"]
    }
  ],
  "environment": {
    "description": "A bustling trading post where merchants exchange goods.",
    "rules": [
      "Negotiate trades with other agents",
      "Set competitive prices",
      "Build trust through fair trading"
    ]
  }
}
```

---

## Task 8: Integration Testing

**Files:**
- Create: `tests/test_template_integration.py`

**Step 1: Write integration test**

```python
# tests/test_template_integration.py
import pytest
from socialsim4.templates.loader import TemplateLoader

def test_village_template_end_to_end():
    """Test loading village template and building scene."""
    loader = TemplateLoader("templates")

    # Load template
    template = loader.load_from_file("templates/village.json")
    assert template.id == "village"
    assert len(template.core_mechanics) == 3

    # Build scene
    scene = loader.build_scene_from_template(template)
    assert len(scene.mechanics) == 3
    assert scene.name == "Village Simulation"

    # Create agent and initialize
    from socialsim4.core.agent import Agent
    agent = Agent(
        name="TestFarmer",
        user_profile="A test farmer",
        style="neutral"
    )
    scene.initialize_agent(agent)

    # Check agent has grid properties
    assert "map_xy" in agent.properties
    assert "energy" in agent.properties
    assert agent.properties["energy"] == 100

    # Check agent has grid actions
    action_names = [a.NAME for a in scene.get_scene_actions(agent)]
    assert "move_to_location" in action_names
    assert "look_around" in action_names

def test_custom_semantic_actions():
    """Test template with custom semantic actions."""
    loader = TemplateLoader()
    template_data = {
        "id": "custom",
        "name": "Custom",
        "description": "Test",
        "core_mechanics": [],
        "semantic_actions": [
            {
                "name": "custom_action",
                "description": "A custom action",
                "instruction": "Use this for testing"
            }
        ],
        "environment": {"description": "Test"}
    }
    template = loader.load_from_dict(template_data)
    scene = loader.build_scene_from_template(template)

    # Check semantic action is available
    action_names = [a.NAME for a in scene.semantic_actions]
    assert "custom_action" in action_names

def test_prompt_with_generic_template():
    """Test that prompt is generated correctly with generic template."""
    loader = TemplateLoader()
    template_data = {
        "id": "test",
        "name": "Test",
        "description": "Test template",
        "core_mechanics": [{"type": "voting", "config": {}}],
        "semantic_actions": [],
        "environment": {"description": "A test environment"}
    }
    template = loader.load_from_dict(template_data)
    scene = loader.build_scene_from_template(template)

    from socialsim4.core.agent import Agent
    agent = Agent(
        name="TestAgent",
        user_profile="Test profile",
        style="friendly",
        action_space=scene.get_scene_actions(None)
    )

    prompt = agent.system_prompt(scene)
    assert "TestAgent" in prompt
    assert "voting" in prompt.lower() or "vote" in prompt.lower()
```

**Step 2: Run integration tests**

```bash
pytest tests/test_template_integration.py -v
```

---

## Summary

After completing all tasks, the generic template system will:

1. **Allow users to define templates as JSON/YAML files**
2. **Compose core mechanics** (grid, voting, resources, etc.)
3. **Define custom semantic actions** with LLM-driven behavior
4. **Validate templates** before use
5. **Build scenes dynamically** from template configuration

**Execution options:**
1. **Subagent-Driven** - Execute task-by-task with review between each
2. **Parallel Session** - Use executing-plans in separate session

Which approach?
