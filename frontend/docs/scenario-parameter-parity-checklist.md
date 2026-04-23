# Scenario Parameter Parity Checklist

Baseline: origin/server scenario registry + origin/server locale text.
Columns: server key, current Step2 visibility, default consistency, copy consistency (en/zh locale + backend fallback behavior).

## prisoners_dilemma (game_theory)

- Scenario name copy match: yes
- Scenario description copy match: yes

| Param Key | Server Default | UI Shows? | Default Match? | Copy Match? |
|---|---:|---|---|---|
| cooperate_reward | 3 | yes (PayoffInput) | yes | yes (label via backend param.label fallback) |
| sucker_penalty | 0 | yes (PayoffInput) | yes | yes (label via backend param.label fallback) |
| temptation_reward | 5 | yes (PayoffInput) | yes | yes (label via backend param.label fallback) |
| defect_penalty | 1 | yes (PayoffInput) | yes | yes (label via backend param.label fallback) |
| action_1 | "Cooperate" | no | yes | yes (label via backend param.label fallback) |
| action_2 | "Defect" | no | yes | yes (label via backend param.label fallback) |

## battle_of_the_sexes (game_theory)

- Scenario name copy match: yes
- Scenario description copy match: yes

| Param Key | Server Default | UI Shows? | Default Match? | Copy Match? |
|---|---:|---|---|---|
| preferred_mispreferred | 3 | no | yes | yes (label via backend param.label fallback) |
| mispreferred_payoff | 0 | no | yes | yes (label via backend param.label fallback) |
| action_1_name | "Opera" | yes (ActionEditor) | yes | yes |
| action_1_description | "Go to the opera" | yes (ActionEditor) | yes | yes |
| action_2_name | "Football" | yes (ActionEditor) | yes | yes |
| action_2_description | "Go to the football game" | yes (ActionEditor) | yes | yes |

## stag_hunt (game_theory)

- Scenario name copy match: yes
- Scenario description copy match: yes

| Param Key | Server Default | UI Shows? | Default Match? | Copy Match? |
|---|---:|---|---|---|
| stag_reward | 5 | no | yes | yes (label via backend param.label fallback) |
| hare_reward | 1 | no | yes | yes (label via backend param.label fallback) |
| action_1_name | "Stag" | yes (ActionEditor) | yes | yes |
| action_1_description | "Hunt the stag (requires all to cooperate)" | yes (ActionEditor) | yes | yes |
| action_2_name | "Hare" | yes (ActionEditor) | yes | yes |
| action_2_description | "Hunt the hare (safe but lower reward)" | yes (ActionEditor) | yes | yes |

## social_norm_disruption (sociology)

- Scenario name copy match: yes
- Scenario description copy match: yes

| Param Key | Server Default | UI Shows? | Default Match? | Copy Match? |
|---|---:|---|---|---|
| norm_strength | 0.8 | yes (ParameterField) | yes | yes (label via backend param.label fallback) |
| agent_status_distribution | "mixed" | yes (ParameterField) | yes | yes (label via backend param.label fallback) |

## policy_erosion (sociology)

- Scenario name copy match: yes
- Scenario description copy match: yes

| Param Key | Server Default | UI Shows? | Default Match? | Copy Match? |
|---|---:|---|---|---|
| cascade_mode | "strict_cascade" | yes (ParameterField) | yes | yes |
| distortion_strength | 0.6 | conditional (only when cascade_mode=distortion_cascade) | yes | yes |
| conflict_sensitivity | 0.5 | conditional (only when cascade_mode=distortion_cascade) | yes | yes |
| block_probability | 0.25 | conditional (only when cascade_mode=distortion_cascade) | yes | yes |
| num_agents_per_tier | 5 | yes (ParameterField) | yes | yes |
| policy_text | "All employees must complete mandatory training by Friday" | yes (ParameterField) | yes | yes |

## echo_chamber (sociology)

- Scenario name copy match: yes
- Scenario description copy match: yes

| Param Key | Server Default | UI Shows? | Default Match? | Copy Match? |
|---|---:|---|---|---|
| connection_homogeneity | 0.7 | yes (ParameterField) | yes | yes (label via backend param.label fallback) |
| opinion_distribution | "balanced" | yes (ParameterField) | yes | yes (label via backend param.label fallback) |

## resource_scarcity (sociology)

- Scenario name copy match: yes
- Scenario description copy match: yes

| Param Key | Server Default | UI Shows? | Default Match? | Copy Match? |
|---|---:|---|---|---|
| resource_amount | 100 | yes (ParameterField) | yes | yes (label via backend param.label fallback) |
| initial_distribution | "equal" | yes (ParameterField) | yes | yes (label via backend param.label fallback) |

## open_discussion (discussion)

- Scenario name copy match: yes
- Scenario description copy match: yes

| Param Key | Server Default | UI Shows? | Default Match? | Copy Match? |
|---|---:|---|---|---|
| topic | "What should we have for lunch?" | yes (ParameterField) | yes | yes (label via backend param.label fallback) |

## council_chamber (discussion)

- Scenario name copy match: yes
- Scenario description copy match: yes

| Param Key | Server Default | UI Shows? | Default Match? | Copy Match? |
|---|---:|---|---|---|
| proposal_text | "" | yes (ParameterField) | yes | yes (label via backend param.label fallback) |
| voting_threshold | 0.5 | yes (ParameterField) | yes | yes (label via backend param.label fallback) |
| max_rounds | 5 | yes (ParameterField) | yes | yes (label via backend param.label fallback) |

## grid_world (spatial)

- Scenario name copy match: yes
- Scenario description copy match: yes

| Param Key | Server Default | UI Shows? | Default Match? | Copy Match? |
|---|---:|---|---|---|
| grid_size | 10 | yes (ParameterField) | yes | yes (label via backend param.label fallback) |
| resource_count | 5 | yes (ParameterField) | yes | yes (label via backend param.label fallback) |

## werewolf (social_deduction)

- Scenario name copy match: yes
- Scenario description copy match: yes

| Param Key | Server Default | UI Shows? | Default Match? | Copy Match? |
|---|---:|---|---|---|
| num_werewolves | 1 | yes (ParameterField) | yes | yes (label via backend param.label fallback) |
| num_villagers | 5 | yes (ParameterField) | yes | yes (label via backend param.label fallback) |

## custom (custom)

- Scenario name copy match: yes
- Scenario description copy match: yes

- No parameters in server baseline.

## public_goods (game_theory)

- Scenario name copy match: yes
- Scenario description copy match: yes

| Param Key | Server Default | UI Shows? | Default Match? | Copy Match? |
|---|---:|---|---|---|
| resource_name | "tokens" | yes (ParameterField) | no (ResourceConfig fallback="Tokens") | yes (label via backend param.label fallback; description via backend param.description fallback) |
| tokens_per_round | 10 | yes (ParameterField) | yes | yes (label via backend param.label fallback; description via backend param.description fallback) |
| multiplier | 1.3 | yes (ParameterField) | no (ResourceConfig fallback=1.5) | yes (label via backend param.label fallback; description via backend param.description fallback) |
| deduction_budget_per_phase | 0 | yes (ParameterField) | yes | yes (label via backend param.label fallback; description via backend param.description fallback) |
| deduction_cost_ratio | 3 | yes (ParameterField) | yes | yes (label via backend param.label fallback; description via backend param.description fallback) |
| deduction_anonymous | false | yes (ParameterField) | yes | yes (label via backend param.label fallback; description via backend param.description fallback) |

## coordination_game (game_theory)

- Scenario name copy match: yes
- Scenario description copy match: yes

| Param Key | Server Default | UI Shows? | Default Match? | Copy Match? |
|---|---:|---|---|---|
| choices | "red, blue, green" | yes (ParameterField) | yes | yes (label via backend param.label fallback; description via backend param.description fallback) |
| goal | "differ" | yes (ParameterField) | yes | yes (label via backend param.label fallback; description via backend param.description fallback) |

## contagion (spatial)

- Scenario name copy match: yes
- Scenario description copy match: yes

| Param Key | Server Default | UI Shows? | Default Match? | Copy Match? |
|---|---:|---|---|---|
| initial_infected | 1 | yes (ParameterField) | yes | yes (label via backend param.label fallback; description via backend param.description fallback) |
| proximity_probability | 0.3 | yes (ParameterField) | yes | yes (label via backend param.label fallback; description via backend param.description fallback) |
| action_probability | 0.5 | yes (ParameterField) | yes | yes (label via backend param.label fallback; description via backend param.description fallback) |
| recovery_turns | 5 | yes (ParameterField) | yes | yes (label via backend param.label fallback; description via backend param.description fallback) |
| grid_size | 10 | yes (ParameterField) | yes | yes (label via backend param.label fallback; description via backend param.description fallback) |

## Summary

- Rows needing review: 8
- prisoners_dilemma.action_1: show=no; default=yes; copy=yes (label via backend param.label fallback)
- prisoners_dilemma.action_2: show=no; default=yes; copy=yes (label via backend param.label fallback)
- battle_of_the_sexes.preferred_mispreferred: show=no; default=yes; copy=yes (label via backend param.label fallback)
- battle_of_the_sexes.mispreferred_payoff: show=no; default=yes; copy=yes (label via backend param.label fallback)
- stag_hunt.stag_reward: show=no; default=yes; copy=yes (label via backend param.label fallback)
- stag_hunt.hare_reward: show=no; default=yes; copy=yes (label via backend param.label fallback)
- public_goods.resource_name: show=yes (ParameterField); default=no (ResourceConfig fallback="Tokens"); copy=yes (label via backend param.label fallback; description via backend param.description fallback)
- public_goods.multiplier: show=yes (ParameterField); default=no (ResourceConfig fallback=1.5); copy=yes (label via backend param.label fallback; description via backend param.description fallback)
