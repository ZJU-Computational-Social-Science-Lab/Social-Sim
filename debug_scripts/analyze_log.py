"""
Analyze the log file to understand the node/round sequence.

Node 1 = Initial creation
Node 2 = After Round 1 runs
Node 3 = After Round 2 runs
Node 4 = After Round 3 runs
"""
import re

log_file = r"C:\Users\Justin\Documents\ZJU_Work\Social-Sim\test_results\experiment_debug_20260322_135432.txt"

with open(log_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Find all round headers and their actions
pattern = r'## ROUND: (\d+).*?filtered actions for ([^:]+): (\[.*?\])'
matches = re.findall(pattern, content, re.DOTALL)

print("="*80)
print("SEQUENCE ANALYSIS")
print("="*80)
print()

current_round = None
round_count = {}

for match in matches:
    round_num = match[0]
    agent = match[1]
    actions = match[2]

    if round_num != current_round:
        current_round = round_num
        round_count[round_num] = 0

    round_count[round_num] += 1

    # Only print once per round (first agent)
    if round_count[round_num] == 1:
        if 'vote' in actions:
            phase = "VOTING"
        else:
            phase = "DELIBERATION"
        print(f"Round {round_num}: {actions} ({phase})")

print()
print("="*80)
print("INTERPRETATION:")
print("="*80)
print()
print("With deliberation_rounds=2, expected sequence:")
print("  Round 1: DELIBERATION (Node 1 created, runs Round 1)")
print("  Round 2: DELIBERATION (Node 2 created from Node 1 after Round 1)")
print("  Round 3: VOTING       (Node 3 created from Node 2 after Round 2)")
print()
print("If Round 3 is still DELIBERATION, the bug is:")
print("  Either: _advance_round() not being called correctly")
print("  Or: State not being persisted when nodes are created")
