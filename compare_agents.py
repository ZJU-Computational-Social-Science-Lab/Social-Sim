"""Quick comparison of agent data between two runs."""
import csv
from collections import Counter, defaultdict

after_file = r"C:\Users\Justin\Downloads\Public Goods Game - Each participant has resources..._agent_data_2026-04-23 (1).csv"
before_file = r"C:\Users\Justin\Documents\ZJU_Work\PGG_EMNP_Paper\Public Goods Game - Each participant has resources..._agent_data_2026-04-22 (1).csv"

for label, path in [("AFTER (Apr 23)", after_file), ("BEFORE (Apr 22)", before_file)]:
    print(f"\n{'='*60}")
    print(f"=== {label} ===")
    print(f"{'='*60}")
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        models = Counter()
        model_roles = defaultdict(list)
        agent_count = 0
        for row in reader:
            agent_count += 1
            model = row.get("llm_model", "")
            provider = row.get("llm_provider", "")
            role = row.get("role", "")
            key = f"{provider} | {model}"
            models[key] += 1
            model_roles[key].append(role)

    print(f"Total agents: {agent_count}")
    print(f"\nModel distribution:")
    for model, count in models.most_common():
        print(f"  {model}: {count} agents")

    print(f"\nSample roles per model:")
    for model in sorted(model_roles.keys()):
        roles = model_roles[model]
        print(f"\n  --- {model} (n={len(roles)}) ---")
        for r in roles[:3]:
            print(f"    {r[:100]}...")
