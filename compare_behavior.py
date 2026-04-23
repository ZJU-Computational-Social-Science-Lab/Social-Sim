"""Compare per-model contribution behavior between before and after runs."""
import csv
from collections import Counter, defaultdict

# Agent data files (for provider_id -> model mapping)
after_agents = r"C:\Users\Justin\Downloads\Public Goods Game - Each participant has resources..._agent_data_2026-04-23 (1).csv"
before_agents = r"C:\Users\Justin\Documents\ZJU_Work\PGG_EMNP_Paper\Public Goods Game - Each participant has resources..._agent_data_2026-04-22 (1).csv"

# Simulation CSV files
after_sim = r"C:\Users\Justin\Downloads\Scenario_public_goods_2026_04_23_19_32.csv"
before_sim = r"C:\Users\Justin\Documents\ZJU_Work\PGG_EMNP_Paper\Scenario_public_goods_2026_04_23_01_26.csv"

# Debug logs for provider_id mapping
after_debug = r"C:\Users\Justin\Documents\ZJU_Work\Social-Sim\test_results\experiment_debug_20260423_191710.txt"
before_debug = r"C:\Users\Justin\Documents\ZJU_Work\Social-Sim\test_results\experiment_debug_20260422_204944.txt"

# Build agent -> model mapping from debug logs
def extract_provider_model_map(debug_path, max_lines=50000):
    """Extract agent_id -> provider_id and provider_id -> model from debug log."""
    agent_to_provider = {}
    provider_to_model = {}

    with open(debug_path, "r", encoding="utf-8") as f:
        current_agent = None
        current_provider = None
        for i, line in enumerate(f):
            if i > max_lines:
                break
            line = line.strip()

            if line.startswith("## AGENT:"):
                current_agent = line.replace("## AGENT:", "").strip().lower().replace(" ", "_")
            elif "provider_id:" in line and current_agent:
                pid = line.split("provider_id:")[-1].strip()
                agent_to_provider[current_agent] = pid
                current_provider = pid
            # Try to find model info
            if "model" in line.lower() and ":" in line:
                pass  # model info isn't in debug log in a simple format

    return agent_to_provider

# Instead, let's analyze the simulation CSV directly by agent_id patterns
# Each agent gets assigned a provider_id, we can see this from the debug log

def analyze_per_provider(debug_path, sim_path, max_debug_lines=200000):
    """Analyze contribution behavior per provider_id."""
    # First, extract agent -> provider mapping from debug log
    agent_provider = {}
    current_agent = None

    with open(debug_path, "r", encoding="utf-8") as f:
        for i, line in enumerate(f):
            if i > max_debug_lines:
                break
            stripped = line.strip()
            if stripped.startswith("## AGENT:"):
                name = stripped.replace("## AGENT:", "").strip()
                # Convert "Agent 3" to "agent_3"
                parts = name.lower().split()
                if len(parts) == 2:
                    current_agent = f"agent_{parts[1]}"
            elif "provider_id:" in stripped and current_agent:
                pid = stripped.split("provider_id:")[-1].strip()
                agent_provider[current_agent] = pid

    print(f"  Found {len(agent_provider)} agent->provider mappings")

    # Now analyze simulation CSV by provider
    provider_actions = defaultdict(lambda: {"allocate": [], "keep": 0, "total": 0})

    with open(sim_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            agent_id = row.get("agent_id", "")
            action = row.get("action", "")
            provider = agent_provider.get(agent_id, "unknown")

            provider_actions[provider]["total"] += 1
            if action == "keep":
                provider_actions[provider]["keep"] += 1
            elif action == "allocate":
                try:
                    amount = int(row.get("follow_up", "0"))
                    provider_actions[provider]["allocate"].append(amount)
                except ValueError:
                    pass

    return provider_actions

print("=" * 70)
print("AFTER (Apr 23)")
print("=" * 70)
after_stats = analyze_per_provider(after_debug, after_sim)
for pid in sorted(after_stats.keys()):
    s = after_stats[pid]
    alloc = s["allocate"]
    avg = sum(alloc) / len(alloc) if alloc else 0
    vals = Counter(alloc)
    print(f"\n  Provider {pid}: {s['total']} actions, {s['keep']} keeps ({s['keep']/s['total']*100:.1f}%)")
    print(f"    Avg allocate: {avg:.1f}, values: {dict(vals.most_common(10))}")

print("\n" + "=" * 70)
print("BEFORE (Apr 22)")
print("=" * 70)
before_stats = analyze_per_provider(before_debug, before_sim)
for pid in sorted(before_stats.keys()):
    s = before_stats[pid]
    alloc = s["allocate"]
    avg = sum(alloc) / len(alloc) if alloc else 0
    vals = Counter(alloc)
    print(f"\n  Provider {pid}: {s['total']} actions, {s['keep']} keeps ({s['keep']/s['total']*100:.1f}%)")
    print(f"    Avg allocate: {avg:.1f}, values: {dict(vals.most_common(10))}")
