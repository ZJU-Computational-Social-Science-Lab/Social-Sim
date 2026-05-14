"""Extract coverage gaps from coverage.json for analysis."""
import json

d = json.load(open('coverage.json'))
bs_files = d['files']

files = [
    'src/socialsim4/core/agent/agent.py',
    'src/socialsim4/core/agent/rag.py',
    'src/socialsim4/core/agent/serialization.py',
    'src/socialsim4/core/agent/parsing.py',
    'src/socialsim4/core/agent/__init__.py',
    'src/socialsim4/core/scenes/werewolf_scene.py',
    'src/socialsim4/core/scenes/landlord_scene.py',
    'src/socialsim4/core/scenes/village_scene.py',
    'src/socialsim4/core/scenes/council_scene.py',
    'src/socialsim4/core/scenes/policy_cascade/distortion.py',
    'src/socialsim4/core/scenes/policy_cascade/messages.py',
    'src/socialsim4/core/scenes/policy_cascade/constants.py',
    'src/socialsim4/core/scenes/policy_cascade/base.py',
    'src/socialsim4/core/scenes/policy_cascade/followup.py',
    'src/socialsim4/core/scenes/policy_cascade/threads.py',
    'src/socialsim4/core/scenes/policy_cascade/runtime.py',
    'src/socialsim4/core/scenes/policy_cascade/state.py',
    'src/socialsim4/core/scenes/policy_cascade/prompts.py',
    'src/socialsim4/core/scene.py',
    'src/socialsim4/core/actions/village_actions.py',
    'src/socialsim4/core/actions/landlord_actions.py',
    'src/socialsim4/core/actions/rag_actions.py',
    'src/socialsim4/core/actions/werewolf_actions.py',
    'src/socialsim4/core/actions/web_actions.py',
    'src/socialsim4/core/actions/council_actions.py',
    'src/socialsim4/core/actions/moderation_actions.py',
    'src/socialsim4/core/actions/base_actions.py',
    'src/socialsim4/core/simulation/logs.py',
    'src/socialsim4/core/simulation/results.py',
    'src/socialsim4/core/simtree.py',
    'src/socialsim4/core/simulator.py',
    'src/socialsim4/core/action_controller.py',
    'src/socialsim4/core/phase_controller.py',
    'src/socialsim4/core/ordering.py',
    'src/socialsim4/core/context_builder.py',
    'src/socialsim4/core/memory.py',
    'src/socialsim4/core/environment_analyzer.py',
]

for f in files:
    bs_key = f.replace('/', '\\')
    found = None
    for candidate in [f, bs_key]:
        if candidate in bs_files:
            found = candidate
            break
    if not found:
        print(f'NOT FOUND: {f}')
        continue
    data = bs_files[found]
    s = data['summary']
    print(f'FILE: {f}')
    print(f'  Line Coverage: {s["percent_statements_covered_display"]}% ({s["covered_lines"]}/{s["num_statements"]})')
    print(f'  Branch Coverage: {s["percent_branches_covered_display"]}% ({s["covered_branches"]}/{s["num_branches"]})')
    print(f'  Missing Lines: {sorted(data["missing_lines"])}')
    print(f'  Missing Branches: {data.get("missing_branches", [])}')
    print()
