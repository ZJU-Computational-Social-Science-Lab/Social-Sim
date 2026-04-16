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


async def get_simulation_state(simulation_id: str, db, user_id: int, node_id: int | None = None) -> Optional[Dict[str, Any]]:
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
    registry_key = simulation_id.upper()
    record = SIM_TREE_REGISTRY.get(registry_key)
    if not record:
        logger.warning(f"Simulation {simulation_id} not found in SIM_TREE_REGISTRY")
        record = await SIM_TREE_REGISTRY.get_or_create_from_sim(sim)

    # Get current node simulator
    tree = record.tree

    # If a specific node is requested, use it directly.
    if node_id is not None:
        current_node_id = int(node_id)
        current_node = tree.nodes.get(current_node_id)
        if not current_node:
            logger.warning(f"Requested node {current_node_id} not found for simulation {simulation_id}")
            leaves = tree.leaves()
            if not leaves:
                return {
                    "turns": 0,
                    "config": EnvironmentConfig(enabled=environment_enabled).serialize(),
                    "_suggestions_viewed_intervals": set(),
                    "clients": None,
                }
            current_node_id = leaves[0]
            current_node = tree.nodes.get(current_node_id)
            if not current_node:
                return {
                    "turns": 0,
                    "config": EnvironmentConfig(enabled=environment_enabled).serialize(),
                    "_suggestions_viewed_intervals": set(),
                    "clients": None,
                }
        simulator = current_node.get("sim")
        if not simulator:
            logger.warning(f"No simulator found in requested node {current_node_id}")
            return {
                "turns": 0,
                "config": EnvironmentConfig(enabled=environment_enabled).serialize(),
                "_suggestions_viewed_intervals": set(),
                "clients": None,
            }
    else:
        # Try to get the leaf node (most recent state)
        leaves = tree.leaves()
        if not leaves:
            logger.warning(f"No leaf nodes found for simulation {simulation_id}")
            return {
                "turns": 0,
                "config": EnvironmentConfig(enabled=environment_enabled).serialize(),
                "_suggestions_viewed_intervals": set(),
                "clients": None,
            }

        current_node_id = leaves[0]
        current_node = tree.nodes.get(current_node_id)
        if not current_node:
            logger.warning(f"Current node {current_node_id} not found in tree")
            return {
                "turns": 0,
                "config": EnvironmentConfig(enabled=environment_enabled).serialize(),
                "_suggestions_viewed_intervals": set(),
                "clients": None,
            }

        simulator = current_node.get("sim")
        if not simulator:
            logger.warning(f"No simulator found in node {current_node_id}")
            return {
                "turns": 0,
                "config": EnvironmentConfig(enabled=environment_enabled).serialize(),
                "_suggestions_viewed_intervals": set(),
                "clients": None,
            }

    # Update simulator's config to match database (sync toggle state)
    # Only update environment_config if it exists (not all simulators have it)
    if hasattr(simulator, 'environment_config') and simulator.environment_config is not None:
        simulator.environment_config.enabled = environment_enabled

    # Get turns from simulator or scene (ExperimentRunnerAdapter uses scene.current_round)
    turns = getattr(simulator, 'turns', None)
    if turns is None and hasattr(simulator, 'scene'):
        turns = getattr(simulator.scene, 'current_round', 0)
    turns = turns or 0

    logger.info(f"Simulation {simulation_id}: turns={turns}, config_enabled={environment_enabled} (from db)")

    return {
        "turns": turns,
        "config": simulator.environment_config.serialize() if hasattr(simulator, 'environment_config') and simulator.environment_config else EnvironmentConfig(enabled=environment_enabled).serialize(),
        "_suggestions_viewed_intervals": record._suggestions_viewed_intervals,
        "clients": simulator.clients,
        "node_id": current_node_id,
        "tree": tree,
    }


async def generate_environment_suggestions(
    simulation_id: str,
    db,
    user_id: int,
    node_id: int | None = None,
) -> List[Dict[str, Any]]:
    """Generate environmental event suggestions for a simulation."""
    state = await get_simulation_state(simulation_id, db, user_id, node_id)
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
    requested_node_id = event_data.get("node_id")
    state = await get_simulation_state(
        simulation_id,
        db,
        user_id,
        int(requested_node_id) if requested_node_id is not None else None,
    )
    if not state:
        raise ValueError("Simulation not found")

    result = await db.execute(
        select(Simulation).where(
            Simulation.id == simulation_id.upper(),
            Simulation.owner_id == user_id,
        )
    )
    sim_record = result.scalar_one_or_none()
    if sim_record is None:
        raise ValueError("Simulation not found")

    simulator = state.get("tree").nodes[state["node_id"]].get("sim")
    if not simulator:
        raise ValueError("Simulator not found")

    # Decide mode: honor explicit `notice_only` if present; otherwise
    # explicit "broadcast" causes a system broadcast. All other
    # invocations are treated as notice-only environment interventions.
    # Determine whether the simulator's scene is the policy cascade scene.
    is_policy_scene = False
    try:
        is_policy_scene = getattr(simulator.scene, "TYPE", "") == "policy_cascade_scene"
    except Exception:
        is_policy_scene = False

    # Only honor an explicit `notice_only` flag for the policy cascade scene.
    notice_only_flag = bool(event_data.get("notice_only")) if is_policy_scene else False
    mode = str(event_data.get("event_type") or "").strip().lower()
    description = str(event_data.get("description") or "")

    receivers = None
    if "receivers" in event_data:
        raw = event_data.get("receivers")
        if not raw:
            raise ValueError("receivers cannot be empty when provided")
        receivers = [str(r).strip() for r in raw if str(r).strip()]
        if not receivers:
            raise ValueError("receivers cannot be empty when provided")

    if not notice_only_flag and mode == "broadcast":
        # Explicit system broadcast: create a PublicEvent and broadcast
        from socialsim4.core.event import PublicEvent

        event = PublicEvent(content=description, prefix="SYSTEM BROADCAST")
        simulator.broadcast(event, receivers=receivers)
    else:
        # Notice-only environment injection: directly deliver feedback to
        # target agents (or all agents) and call scene handlers with
        # a 'notice_only' flag for the policy cascade scene so scenes do not treat this as a cascade.
        images = []
        # deliver to scoped recipients or all agents
        if receivers is not None:
            for name in receivers:
                agent = simulator.agents.get(name)
                if agent:
                    agent.add_env_feedback(description, images=images)
            # inform scene about private notice (no cascade)
            if hasattr(simulator.scene, "inject_host_message"):
                scoped_prefix = f"[Private notice to {', '.join(receivers)}]\n" if receivers else ""
                simulator.scene.inject_host_message(f"{scoped_prefix}{description}")
                if hasattr(simulator, "_emit_event"):
                    simulator._emit_event("public_event", {"message": description, "scoped": True, "recipients": receivers})
            elif is_policy_scene:
                simulator.scene.on_private_event(simulator, "environment", {"description": description, "event_type": mode, "notice_only": True}, receivers)
            else:
                simulator.scene.on_private_event(simulator, "environment", {"description": description, "event_type": mode}, receivers)
        else:
            if hasattr(simulator.scene, "inject_host_message"):
                simulator.scene.inject_host_message(description)
                if hasattr(simulator, "_emit_event"):
                    simulator._emit_event("public_event", {"message": description, "scoped": False, "recipients": []})
            else:
                for agent in simulator.agents.values():
                    agent.add_env_feedback(description, images=images)
            # inform scene about global notice (no cascade)
            if hasattr(simulator.scene, "inject_host_message"):
                pass
            elif is_policy_scene:
                simulator.scene.on_event(simulator, "environment", {"description": description, "event_type": mode, "notice_only": True})
            else:
                simulator.scene.on_event(simulator, "environment", {"description": description, "event_type": mode})

    sim_record.latest_state = state.get("tree").serialize()
    await db.commit()

    # Mark suggestions as viewed at the tree level
    record = SIM_TREE_REGISTRY.get(simulation_id)
    if record:
        config = getattr(simulator, "environment_config", None)
        interval = getattr(config, "turn_interval", 5)
        turns = getattr(simulator, "turns", None)
        if turns is None and hasattr(simulator, "scene"):
            turns = getattr(simulator.scene, "current_round", 0)
        turns = turns or 0
        current_interval_milestone = (turns // interval) * interval
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
