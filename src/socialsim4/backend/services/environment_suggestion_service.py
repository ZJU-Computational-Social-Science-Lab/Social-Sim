import logging
from typing import Dict, List, Any, Optional
from sqlalchemy import select
from socialsim4.core.environment_analyzer import EnvironmentAnalyzer
from socialsim4.core.environment_config import EnvironmentConfig
from socialsim4.backend.models.simulation import Simulation
from socialsim4.backend.models.user import ProviderConfig
from socialsim4.backend.services.simtree_runtime import SIM_TREE_REGISTRY

logger = logging.getLogger(__name__)


async def get_user_llm_clients(db, user_id: int) -> Optional[Dict[str, Any]]:
    """Get LLM clients for a user."""
    from socialsim4.core.llm_config import LLMConfig
    from socialsim4.core.llm import create_llm_client

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


async def get_simulation_state(simulation_id: str, db, user_id: int) -> Optional[Dict[str, Any]]:
    """Get current simulation state."""
    result = await db.execute(
        select(Simulation).where(
            Simulation.id == simulation_id.upper(),
            Simulation.owner_id == user_id,
        )
    )
    sim = result.scalar_one_or_none()

    if not sim:
        return None

    # Read environment_enabled from database scene_config (source of truth for toggle state)
    scene_config = sim.scene_config or {}
    environment_enabled = bool(scene_config.get("environment_enabled", False))

    # Get current tree record from SimTree registry
    record = SIM_TREE_REGISTRY.get(simulation_id)
    if not record:
        logger.warning(f"Simulation {simulation_id} not found in SIM_TREE_REGISTRY")
        return {
            "turns": 0,
            "config": EnvironmentConfig(enabled=environment_enabled).serialize(),
            "_suggestions_viewed_turn": None,
            "clients": None,
        }

    # Get current node simulator
    tree = record.tree

    # Try to get the leaf node (most recent state)
    leaves = tree.leaves()
    if not leaves:
        logger.warning(f"No leaf nodes found for simulation {simulation_id}")
        return {
            "turns": 0,
            "config": EnvironmentConfig(enabled=environment_enabled).serialize(),
            "_suggestions_viewed_turn": None,
            "clients": None,
        }

    current_node_id = leaves[0]
    current_node = tree.nodes.get(current_node_id)
    if not current_node:
        logger.warning(f"Current node {current_node_id} not found in tree")
        return {
            "turns": 0,
            "config": EnvironmentConfig(enabled=environment_enabled).serialize(),
            "_suggestions_viewed_turn": None,
            "clients": None,
        }

    simulator = current_node.get("sim")
    if not simulator:
        logger.warning(f"No simulator found in node {current_node_id}")
        return {
            "turns": 0,
            "config": EnvironmentConfig(enabled=environment_enabled).serialize(),
            "_suggestions_viewed_turn": None,
            "clients": None,
        }

    # Update simulator's config to match database (sync toggle state)
    simulator.environment_config.enabled = environment_enabled

    logger.info(f"Simulation {simulation_id}: turns={simulator.turns}, config_enabled={environment_enabled} (from db)")

    return {
        "turns": simulator.turns,
        "config": simulator.environment_config.serialize(),
        "_suggestions_viewed_intervals": record._suggestions_viewed_intervals,
        "clients": simulator.clients,
        "node_id": current_node_id,
        "tree": tree,
    }


async def generate_environment_suggestions(
    simulation_id: str,
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

    # Get recent events from simulation logs
    result = await db.execute(
        select(Simulation).where(
            Simulation.id == simulation_id.upper(),
            Simulation.owner_id == user_id,
        )
    )
    sim = result.scalar_one_or_none()
    if not sim:
        raise ValueError("Simulation not found")

    # For now, build minimal context from state
    context = {
        "recent_events": [],
        "agent_count": len(sim.agent_config.get("agents", [])),
        "current_turn": state["turns"],
        "scene_time": 540,  # Default, would come from actual scene state
    }

    analyzer = EnvironmentAnalyzer(clients)
    suggestions = analyzer.generate_suggestions(context, count=3)
    logger.info(f"Generated {len(suggestions)} suggestions for simulation {simulation_id}")
    return suggestions


async def broadcast_environment_event(
    simulation_id: str,
    event_data: Dict[str, Any],
    db,
    user_id: int,
) -> bool:
    """Broadcast an environment event to all agents in the simulation."""
    from socialsim4.core.event import EnvironmentEvent

    state = await get_simulation_state(simulation_id, db, user_id)
    if not state:
        raise ValueError("Simulation not found")

    simulator = state.get("tree").nodes[state["node_id"]].get("sim")
    if not simulator:
        raise ValueError("Simulator not found")

    # Create event
    event = EnvironmentEvent(
        event_type=event_data["event_type"],
        description=event_data["description"],
        severity=event_data.get("severity", "mild"),
    )

    # Broadcast to all agents
    simulator.broadcast(event)

    # Mark suggestions as viewed at the tree level
    record = SIM_TREE_REGISTRY.get(simulation_id)
    if record:
        interval = simulator.environment_config.turn_interval
        current_interval_milestone = (simulator.turns // interval) * interval
        record._suggestions_viewed_intervals.add(current_interval_milestone)
        logger.info(f"Marked interval {current_interval_milestone} as viewed for simulation {simulation_id}")

    return True


async def dismiss_suggestions(
    simulation_id: str,
    db,
    user_id: int,
) -> bool:
    """Dismiss environment suggestions for the current interval."""
    state = await get_simulation_state(simulation_id, db, user_id)
    if not state:
        raise ValueError("Simulation not found")

    # Mark suggestions as viewed at the tree level
    record = SIM_TREE_REGISTRY.get(simulation_id)
    if record:
        simulator = state.get("tree").nodes[state["node_id"]].get("sim")
        if simulator:
            interval = simulator.environment_config.turn_interval
            current_interval_milestone = (simulator.turns // interval) * interval
            record._suggestions_viewed_intervals.add(current_interval_milestone)
            logger.info(f"Dismissed interval {current_interval_milestone} for simulation {simulation_id}")
            return True

    return False
