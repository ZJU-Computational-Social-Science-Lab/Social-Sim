"""Compare agent descriptions between two runs to check diversity."""
import csv
from collections import Counter, defaultdict

new_file = r"C:\Users\Justin\Downloads\Public Goods Game - Each participant has resources..._agent_data_2026-04-23 (2).csv"
old_file = r"C:\Users\Justin\Documents\ZJU_Work\PGG_EMNP_Paper\Public Goods Game - Each participant has resources..._agent_data_2026-04-22 (1).csv"

def load_agents(path):
    agents = []
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            agents.append(row)
    return agents

new_agents = load_agents(new_file)
old_agents = load_agents(old_file)

print(f"New run: {len(new_agents)} agents")
print(f"Old run: {len(old_agents)} agents")

# Compare roles
print("\n" + "=" * 70)
print("ROLE COMPARISON")
print("=" * 70)

new_roles = [a.get("role", "").strip() for a in new_agents]
old_roles = [a.get("role", "").strip() for a in old_agents]

new_role_counts = Counter(new_roles)
old_role_counts = Counter(old_roles)

print(f"\nNew run: {len(new_role_counts)} unique roles")
print(f"Old run: {len(old_role_counts)} unique roles")

# Show top roles in each
print("\n--- NEW run top roles ---")
for role, count in new_role_counts.most_common(15):
    print(f"  {count:3d}x  {role[:80]}")

print("\n--- OLD run top roles ---")
for role, count in old_role_counts.most_common(15):
    print(f"  {count:3d}x  {role[:80]}")

# Compare profiles
print("\n" + "=" * 70)
print("PROFILE (description) COMPARISON")
print("=" * 70)

new_profiles = [a.get("profile", "").strip() for a in new_agents]
old_profiles = [a.get("profile", "").strip() for a in old_agents]

# Extract first sentence as summary
def first_sentence(text):
    idx = text.find(".")
    if idx > 0:
        return text[:idx+1]
    return text[:100]

new_profile_summaries = Counter(first_sentence(p) for p in new_profiles)
old_profile_summaries = Counter(first_sentence(p) for p in old_profiles)

print(f"\nNew run: {len(new_profile_summaries)} unique profile openings")
print(f"Old run: {len(old_profile_summaries)} unique profile openings")

print("\n--- NEW run profile openings ---")
for prof, count in new_profile_summaries.most_common(15):
    print(f"  {count:3d}x  {prof[:100]}")

print("\n--- OLD run profile openings ---")
for prof, count in old_profile_summaries.most_common(15):
    print(f"  {count:3d}x  {prof[:100]}")

# Compare model distribution
print("\n" + "=" * 70)
print("MODEL DISTRIBUTION")
print("=" * 70)

new_models = Counter(a.get("llm_model", "") for a in new_agents)
old_models = Counter(a.get("llm_model", "") for a in old_agents)

print("\nNew run:", dict(new_models))
print("Old run:", dict(old_models))

# Compare roles per model
print("\n" + "=" * 70)
print("ROLES PER MODEL (new run)")
print("=" * 70)

model_roles_new = defaultdict(Counter)
for a in new_agents:
    model_roles_new[a.get("llm_model", "")][a.get("role", "").strip()] += 1

for model in sorted(model_roles_new.keys()):
    roles = model_roles_new[model]
    print(f"\n  {model}:")
    for role, count in roles.most_common(8):
        print(f"    {count:2d}x  {role[:70]}")

print("\n" + "=" * 70)
print("ROLES PER MODEL (old run)")
print("=" * 70)

model_roles_old = defaultdict(Counter)
for a in old_agents:
    model_roles_old[a.get("llm_model", "")][a.get("role", "").strip()] += 1

for model in sorted(model_roles_old.keys()):
    roles = model_roles_old[model]
    print(f"\n  {model}:")
    for role, count in roles.most_common(8):
        print(f"    {count:2d}x  {role[:70]}")

# Role overlap analysis
print("\n" + "=" * 70)
print("ROLE OVERLAP BETWEEN RUNS")
print("=" * 70)

new_role_set = set(new_roles)
old_role_set = set(old_roles)
overlap = new_role_set & old_role_set
only_new = new_role_set - old_role_set
only_old = old_role_set - new_role_set

print(f"\nRoles in both runs:   {len(overlap)}")
print(f"Roles only in NEW:    {len(only_new)}")
print(f"Roles only in OLD:    {len(only_old)}")
print(f"Total unique roles:   NEW={len(new_role_set)}, OLD={len(old_role_set)}")

if overlap:
    print(f"\nShared roles:")
    for role in sorted(overlap)[:10]:
        print(f"  {role[:80]}")
