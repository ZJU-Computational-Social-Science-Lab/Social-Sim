"""
Test script for contagion module integration.

Tests that the contagion scenario can be built and run.
"""
import sys
sys.path.insert(0, "src")

from socialsim4.scenarios.basic import build_contagion_sim, SCENES

def test_contagion_scene_registered():
    """Test that contagion_scene is in SCENES dictionary."""
    assert "contagion_scene" in SCENES, "contagion_scene not registered!"
    print("[PASS] contagion_scene is registered")


def test_build_contagion_sim():
    """Test that build_contagion_sim creates a valid simulator."""
    sim = build_contagion_sim()

    # Check basic properties
    assert sim is not None, "Simulator is None"
    assert len(sim.agents) == 8, f"Expected 8 agents, got {len(sim.agents)}"
    assert sim.scene is not None, "Scene is None"
    assert sim.scene.name == "contagion_village"

    print(f"[PASS] Simulator created with {len(sim.agents)} agents")
    print(f"  Scene: {sim.scene.name}")
    print(f"  Agents: {list(sim.agents.keys())}")


def test_scene_type():
    """Test that the scene is a ContagionScene."""
    from socialsim4.core.contagion.scene import ContagionScene

    sim = build_contagion_sim()
    assert isinstance(sim.scene, ContagionScene), "Scene is not a ContagionScene"

    # Check scene has rules
    assert len(sim.scene.rules) == 3, f"Expected 3 rules, got {len(sim.scene.rules)}"
    print(f"[PASS] Scene is ContagionScene with {len(sim.scene.rules)} rules")


def test_map_positions():
    """Test that agents have valid map positions."""
    sim = build_contagion_sim()

    for agent_name, agent in sim.agents.items():
        assert "map_xy" in agent.properties, f"Agent {agent_name} has no map_xy in properties"
        pos = agent.properties["map_xy"]
        assert len(pos) == 2, f"Agent {agent_name} map_xy should have 2 elements"
        x, y = pos
        assert 1 <= x < 20, f"Agent {agent_name} x coordinate {x} out of bounds"
        assert 1 <= y < 20, f"Agent {agent_name} y coordinate {y} out of bounds"
        print(f"  {agent_name}: position {pos}")

    print("[PASS] All agents have valid map positions")


if __name__ == "__main__":
    print("\n" + "="*50)
    print("Testing Contagion Module Integration")
    print("="*50 + "\n")

    test_contagion_scene_registered()
    test_build_contagion_sim()
    test_scene_type()
    test_map_positions()

    print("\n" + "="*50)
    print("All tests passed!")
    print("="*50 + "\n")
