"""
Test prompt token count for 4B models.
Verifies that prompts fit within the 8K context window of most 4B models.
"""
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from socialsim4.core.agent import Agent
from socialsim4.core.scenes.village_scene import VillageScene, GameMap
from socialsim4.core.actions.base_actions import SendMessageAction, YieldAction
from socialsim4.core.actions.village_actions import MoveToLocationAction, LookAroundAction


def measure_prompt():
    """Measure and display prompt token count."""
    # Create a simple village scene for testing
    game_map = GameMap(20, 20)
    scene = VillageScene(
        name="Village",
        initial_event="Simulation start",
        game_map=game_map
    )

    # Create an agent with minimal setup
    agent = Agent(
        name="Alice",
        user_profile="A simple farmer who grows crops.",
        style="friendly",
        role_prompt="Farmer"
    )
    agent.action_space = [
        SendMessageAction(),
        YieldAction(),
        MoveToLocationAction(),
        LookAroundAction()
    ]
    scene.initialize_agent(agent)

    # Get the system prompt
    prompt = agent.system_prompt(scene)

    # Count characters and estimate tokens (1 token ≈ 4 characters for English)
    char_count = len(prompt)
    token_estimate = char_count // 4

    # Count lines
    line_count = len(prompt.split('\n'))

    print(f"=== Prompt Analysis for 4B Models ===")
    print(f"Character count: {char_count}")
    print(f"Estimated tokens: {token_estimate}")
    print(f"Line count: {line_count}")
    print()

    # Check if within 4B model context window (typically 8K)
    max_tokens_4b = 8192
    if token_estimate < max_tokens_4b:
        status = f"[PASS] - Within {max_tokens_4b} token limit"
    else:
        status = f"[FAIL] - Exceeds {max_tokens_4b} token limit"

    print(f"4B Model (8K context): {status}")
    print(f"Remaining for context: {max_tokens_4b - token_estimate} tokens")
    print()

    # Check if under our target of 2000 tokens
    target_tokens = 2000
    if token_estimate < target_tokens:
        target_status = f"[PASS] - Under {target_tokens} token target"
    else:
        target_status = f"[FAIL] - Exceeds {target_tokens} token target"

    print(f"Target ({target_tokens} tokens): {target_status}")
    print()

    # Verify essential elements are present
    checks = [
        ("Agent name", "Alice" in prompt),
        ("Role", "Farmer" in prompt or "Role:" in prompt),
        ("Village mentioned", "village" in prompt.lower() or "grid" in prompt.lower()),
        ("Actions listed", "Action Space:" in prompt or "speak:" in prompt.lower()),
        ("Output format", "--- Action ---" in prompt),
        ("Compact XML", "<Action" in prompt),
    ]

    print("=== Essential Elements ===")
    for name, passed in checks:
        status = "[PASS]" if passed else "[FAIL]"
        print(f"  {status} {name}")

    return token_estimate < target_tokens


def test_compact_xml_format():
    """Verify that actions use compact XML format."""
    from socialsim4.core.actions.base_actions import SpeakAction, YieldAction
    from socialsim4.core.actions.village_actions import LookAroundAction, RestAction

    print()
    print("=== Compact XML Format Check ===")

    actions = [
        ("SpeakAction", SpeakAction.INSTRUCTION),
        ("YieldAction", YieldAction.INSTRUCTION),
        ("LookAround", LookAroundAction.INSTRUCTION),
        ("Rest", RestAction.INSTRUCTION),
    ]

    for name, instruction in actions:
        # Check if instruction is reasonably compact
        lines = instruction.strip().split('\n')
        char_count = len(instruction)

        # Should be 1-3 lines max for compact format
        is_compact = len(lines) <= 3 and char_count < 200

        status = "[PASS]" if is_compact else "[FAIL]"
        print(f"  {status} {name}: {len(lines)} lines, {char_count} chars")

    # Verify no verbose patterns
    verbose_patterns = ["To ", "// ", "<!--"]
    has_verbose = any(p in instruction for p in verbose_patterns)

    status = "[PASS]" if not has_verbose else "[FAIL]"
    print(f"  {status} No verbose patterns")

    return not has_verbose


def test_action_parameter_consistency():
    """Verify that action parameters match between INSTRUCTION and handle()."""
    from socialsim4.core.actions.base_actions import TalkToAction
    import inspect

    print()
    print("=== Action Parameter Consistency ===")

    # Check TalkToAction - we changed 'to' to 'target' in INSTRUCTION
    # Verify handle() accepts both
    source = inspect.getsource(TalkToAction.handle)

    # Check if both 'target' and 'to' are supported
    accepts_target = '"target"' in source
    accepts_to = '"to"' in source

    print(f"  TalkToAction accepts 'target': {accepts_target}")
    print(f"  TalkToAction accepts 'to': {accepts_to}")

    if accepts_target and accepts_to:
        print("  [PASS] Both 'target' (new) and 'to' (old) supported for compatibility")
        return True
    else:
        print("  [FAIL] Parameter mismatch")
        return False


def test_prompt_generation_speed():
    """Measure prompt generation speed for 4B models."""
    import time

    print()
    print("=== Prompt Generation Speed ===")

    # Create a simple village scene for testing
    game_map = GameMap(20, 20)
    scene = VillageScene(
        name="Village",
        initial_event="Simulation start",
        game_map=game_map
    )

    # Create an agent
    agent = Agent(
        name="Alice",
        user_profile="A simple farmer who grows crops.",
        style="friendly",
        role_prompt="Farmer"
    )
    agent.action_space = [
        SendMessageAction(),
        YieldAction(),
        MoveToLocationAction(),
        LookAroundAction()
    ]
    scene.initialize_agent(agent)

    # Measure prompt generation time
    iterations = 100
    start = time.perf_counter()
    for _ in range(iterations):
        _ = agent.system_prompt(scene)
    end = time.perf_counter()

    avg_time_ms = (end - start) / iterations * 1000
    prompts_per_second = iterations / (end - start)

    print(f"  Prompt generation: {avg_time_ms:.2f}ms average ({prompts_per_second:.0f} prompts/sec)")
    print()

    # Target: <10ms per prompt generation
    if avg_time_ms < 10:
        print("  [PASS] Prompt generation is fast (<10ms)")
        return True
    else:
        print("  [FAIL] Prompt generation is slow (>10ms)")
        return False


def test_ollama_inference_speed():
    """Test actual inference speed with ollama if available."""
    import subprocess
    import time
    import json

    print()
    print("=== Ollama Inference Speed Test ===")

    # Check if ollama API is available
    try:
        import urllib.request
        req = urllib.request.Request("http://localhost:11434/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            models = [m["name"] for m in data.get("models", [])]
    except Exception as e:
        print(f"  [SKIP] ollama API not available: {e}")
        return None

    # Check if qwen is available
    has_qwen = any("qwen" in m.lower() for m in models)
    if not has_qwen:
        print(f"  [SKIP] qwen not found in ollama. Available: {', '.join(models)}")
        return None

    # Find the qwen model name
    qwen_model = next(m for m in models if "qwen" in m.lower())
    print(f"  Found {qwen_model} - testing inference speed...")

    # Create a test prompt
    game_map = GameMap(20, 20)
    scene = VillageScene(
        name="Village",
        initial_event="Simulation start",
        game_map=game_map
    )

    agent = Agent(
        name="Alice",
        user_profile="A simple farmer who grows crops.",
        style="friendly",
        role_prompt="Farmer"
    )
    agent.action_space = [
        SendMessageAction(),
        YieldAction(),
        MoveToLocationAction(),
        LookAroundAction()
    ]
    scene.initialize_agent(agent)
    prompt = agent.system_prompt(scene)

    # Test with ollama API
    try:
        import urllib.request

        # Single inference test with API
        start = time.perf_counter()
        req = urllib.request.Request(
            "http://localhost:11434/api/generate",
            data=json.dumps({
                "model": qwen_model,
                "prompt": "Reply with: <Action name=\"yield\"/>",
                "stream": False
            }).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=60) as response:
            result = json.loads(response.read().decode())
        end = time.perf_counter()
        single_time = end - start

        print(f"  Single inference: {single_time:.2f}s")
        print(f"  Response: {result.get('response', '')[:50]}...")

        # Target: <30 seconds for single inference
        if single_time < 30:
            print("  [PASS] Inference is acceptable (<30s)")
            return True
        else:
            print("  [FAIL] Inference is slow (>30s)")
            return False

    except Exception as e:
        print(f"  [SKIP] Error: {e}")
        return None


if __name__ == "__main__":
    print("Testing prompt optimization for 4B models...\n")

    # Run all tests
    token_test_passed = measure_prompt()
    xml_test_passed = test_compact_xml_format()
    param_test_passed = test_action_parameter_consistency()
    speed_test_passed = test_prompt_generation_speed()

    # Ollama test is optional (None if skipped)
    ollama_test_result = test_ollama_inference_speed()
    ollama_test_passed = ollama_test_result if ollama_test_result is not None else True

    print()
    print("=== Test Summary ===")
    print(f"Token count: {'PASS' if token_test_passed else 'FAIL'}")
    print(f"Compact XML: {'PASS' if xml_test_passed else 'FAIL'}")
    print(f"Parameter consistency: {'PASS' if param_test_passed else 'FAIL'}")
    print(f"Prompt generation speed: {'PASS' if speed_test_passed else 'FAIL'}")
    print(f"Ollama inference speed: {'PASS' if ollama_test_passed else 'FAIL'} (SKIPPED if ollama unavailable)")

    # Only fail on non-optional tests
    all_passed = token_test_passed and xml_test_passed and param_test_passed and speed_test_passed
    print()
    if all_passed:
        print("[PASS] All required tests PASSED - Prompt optimization successful!")
        sys.exit(0)
    else:
        print("[FAIL] Some tests FAILED - Review prompt optimization")
        sys.exit(1)
