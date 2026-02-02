import json
from pathlib import Path

from litestar import Router, get, post
from litestar.exceptions import HTTPException
from litestar.response import Response
from pydantic import ValidationError

from socialsim4.core.agent import Agent
from socialsim4.core.registry import SCENE_ACTIONS, SCENE_DESCRIPTIONS, SCENE_MAP
from socialsim4.templates.loader import TemplateLoader
from socialsim4.templates.schema import GenericTemplate, export_json_schema


PUBLIC_SCENE_KEYS = {key for key in SCENE_MAP.keys()} - {"village_scene"}

DEFAULT_SIMPLE_CHAT_NEWS = (
    "News: A new study suggests AI models now match human-level performance in creative writing benchmarks."
)

DEFAULT_COUNCIL_DRAFT = (
    "Draft Ordinance: Urban Air Quality and Congestion Management (Pilot).\n"
    "1) Establish a 12-month congestion charge pilot in the CBD with base fee 30 CNY per entry.\n"
    "2) Revenue ring-fenced for transit upgrades and air-quality programs.\n"
    "3) Monthly public dashboard on PM2.5/NOx, traffic speed, ridership.\n"
    "4) Camera enforcement with strict privacy limits.\n"
    "5) Independent evaluation at 12 months with target reductions."
)

# Template directories
USER_TEMPLATES_DIR = Path("templates")
SYSTEM_TEMPLATES_DIR = Path(__file__).parent.parent.parent.parent / "templates"


def scene_config_template(scene_key: str, scene_cls) -> dict:
    scene = scene_cls("preview", "")
    config_schema = scene.serialize_config() or {}

    if scene_key == "council_scene":
        config_schema = {
            "draft_text": config_schema.get("draft_text") or DEFAULT_COUNCIL_DRAFT,
        }
    # Generalized initial events list for all scenes (shown separately in UI)
    # Provide a friendly default for simple chat
    if scene_key == "simple_chat_scene":
        config_schema["initial_events"] = [DEFAULT_SIMPLE_CHAT_NEWS]
    elif scene_key == "emotional_conflict_scene":
        # Expose emotion toggle and suggest initial announcements
        config_schema["emotion_enabled"] = True
        config_schema["initial_events"] = [
            "Participants: Host, Lily, Alex",
            (
                "Scene start: Lily feels Alex has become emotionally distant, while Alex thinks Lily is overreacting. "
                "The host will guide them to express their emotions and seek resolution."
            ),
        ]
    else:
        config_schema.setdefault("initial_events", [])
    # Ensure toggle is present for all scenes; default off unless explicitly set
    config_schema.setdefault("emotion_enabled", False)

    # Read from registry; fallback to scene introspection if not present
    reg = SCENE_ACTIONS.get(scene_key)
    if reg:
        basic_actions = list(reg.get("basic", []))
        allowed = set(reg.get("allowed", []))
    else:
        dummy = Agent.deserialize(
            {
                "name": "Preview",
                "user_profile": "",
                "style": "",
                "initial_instruction": "",
                "role_prompt": "",
                "action_space": [],
                "properties": {},
            }
        )
        basic_actions = [a.NAME for a in (scene.get_scene_actions(dummy) or []) if getattr(a, "NAME", None)]
        allowed = set()
    allowed_list = sorted(a for a in allowed if a not in set(basic_actions) and a != "yield")
    basic_list = sorted(a for a in basic_actions if a != "yield")

    # Prefer the registry key as the public type to allow aliases
    name = scene_cls.__name__
    if scene_key == "emotional_conflict_scene":
        name = "EmotionalConflictScene"
    return {
        "type": scene_key,
        "name": name,
        "description": SCENE_DESCRIPTIONS.get(scene_key) or scene.get_scenario_description() or "",
        "config_schema": config_schema,
        "allowed_actions": allowed_list,
        "basic_actions": basic_list,
    }


def get_template_loader() -> TemplateLoader:
    """Get a TemplateLoader instance configured with user and system template directories."""
    # Create user templates directory if it doesn't exist
    USER_TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)
    return TemplateLoader(template_dir=str(USER_TEMPLATES_DIR))


def load_all_templates() -> list[dict]:
    """Load all templates from user and system directories."""
    loader = get_template_loader()
    templates = []

    # Load user templates
    if USER_TEMPLATES_DIR.exists():
        try:
            user_templates = loader.load_from_directory(USER_TEMPLATES_DIR)
            for template in user_templates:
                templates.append({
                    "id": template.id,
                    "name": template.name,
                    "description": template.description,
                    "version": template.version,
                    "author": template.author,
                    "source": "user",
                    "core_mechanics": [m.type for m in template.core_mechanics],
                    "semantic_actions": [a.name for a in template.semantic_actions],
                })
        except FileNotFoundError:
            pass

    # Load system templates
    if SYSTEM_TEMPLATES_DIR.exists():
        try:
            system_templates = loader.load_from_directory(SYSTEM_TEMPLATES_DIR)
            for template in system_templates:
                # Check if this template ID already exists from user templates
                existing_ids = {t["id"] for t in templates}
                if template.id not in existing_ids:
                    templates.append({
                        "id": template.id,
                        "name": template.name,
                        "description": template.description,
                        "version": template.version,
                        "author": template.author,
                        "source": "system",
                        "core_mechanics": [m.type for m in template.core_mechanics],
                        "semantic_actions": [a.name for a in template.semantic_actions],
                    })
        except FileNotFoundError:
            pass

    return templates


@get("/")
async def list_scenes() -> list[dict]:
    """List all available scene types including generic_scene."""
    scenes: list[dict] = []
    for key, cls in SCENE_MAP.items():
        if key not in PUBLIC_SCENE_KEYS:
            continue
        scenes.append(scene_config_template(key, cls))
    return scenes


@get("/templates")
async def list_templates() -> dict[str, list[dict]]:
    """List all templates (system + user-defined).

    Returns a dictionary with separate lists for system and user templates.
    """
    templates = load_all_templates()
    return {
        "system": [t for t in templates if t["source"] == "system"],
        "user": [t for t in templates if t["source"] == "user"],
    }


@post("/templates/validate")
async def validate_template(data: dict) -> dict:
    """Validate a template configuration.

    Accepts a template dictionary and validates it against the GenericTemplate schema.
    Returns validation result with any errors found.

    Args:
        data: Template configuration as a dictionary.

    Returns:
        Dictionary with 'valid' boolean and optional 'errors' list.
    """
    try:
        template = GenericTemplate.model_validate(data)
        return {
            "valid": True,
            "template": {
                "id": template.id,
                "name": template.name,
                "description": template.description,
                "version": template.version,
                "author": template.author,
            },
        }
    except ValidationError as e:
        return {
            "valid": False,
            "errors": json.loads(e.json()),
        }
    except Exception as e:
        return {
            "valid": False,
            "errors": [{"message": str(e)}],
        }


@post("/templates/build")
async def build_scene_from_template(data: dict) -> dict:
    """Build a scene from a template configuration.

    Accepts a template dictionary and returns the scene configuration
    that can be used to create a simulation.

    Args:
        data: Template configuration as a dictionary.

    Returns:
        Dictionary with scene configuration ready for simulation creation.

    Raises:
        HTTPException: If template validation fails.
    """
    try:
        loader = get_template_loader()
        scene = loader.build_scene_from_template(data)

        return {
            "scene_type": "generic_scene",
            "scene_name": scene.name,
            "description": scene.get_scenario_description(),
            "mechanics_config": scene.serialize_config().get("mechanics_config", []),
            "semantic_actions_config": scene.serialize_config().get("semantic_actions_config", []),
            "environment": scene.serialize_config().get("environment", {}),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValidationError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Template validation failed: {json.loads(e.json())}",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to build scene: {str(e)}")


@get("/templates/schema")
async def get_template_schema() -> dict:
    """Get the JSON schema for template validation.

    Returns the JSON schema that can be used for client-side validation
    of template configurations.

    Returns:
        JSON Schema dictionary for GenericTemplate.
    """
    return export_json_schema()


router = Router(
    path="/scenes",
    route_handlers=[
        list_scenes,
        list_templates,
        validate_template,
        build_scene_from_template,
        get_template_schema,
    ],
)
