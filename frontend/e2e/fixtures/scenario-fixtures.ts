/**
 * Per-scenario test data for E2E health-check tests.
 *
 * Centralizes agent names, role prompts, and round counts
 * for all 13 user-visible scenarios.
 *
 * Exports: SCENARIOS, ScenarioConfig, getAllScenarios, getScenariosByCategory
 */

export interface ScenarioConfig {
  id: string;
  name: string;
  category: string;
  agentNames: string[];
  agentRolePrompts: string[];
  rounds: number;
}

export const SCENARIOS: Record<string, ScenarioConfig> = {
  // ── Game Theory ──────────────────────────────────────────────

  prisoners_dilemma: {
    id: 'prisoners_dilemma',
    name: "Prisoner's Dilemma",
    category: 'game_theory',
    agentNames: ['Alice', 'Bob'],
    agentRolePrompts: [
      'You are Alice, a cooperative person who values trust.',
      'You are Bob, a pragmatic person who considers outcomes carefully.',
    ],
    rounds: 3,
  },

  battle_of_the_sexes: {
    id: 'battle_of_the_sexes',
    name: 'Battle of the Sexes',
    category: 'game_theory',
    agentNames: ['Partner1', 'Partner2'],
    agentRolePrompts: [
      'You are Partner1, you prefer opera.',
      'You are Partner2, you prefer football.',
    ],
    rounds: 3,
  },

  stag_hunt: {
    id: 'stag_hunt',
    name: 'Stag Hunt',
    category: 'game_theory',
    agentNames: ['Hunter1', 'Hunter2', 'Hunter3'],
    agentRolePrompts: [
      'You are Hunter1, willing to cooperate for big rewards.',
      'You are Hunter2, cautious but hopeful.',
      'You are Hunter3, a risk-taker.',
    ],
    rounds: 3,
  },

  public_goods: {
    id: 'public_goods',
    name: 'Public Goods Game',
    category: 'game_theory',
    agentNames: ['Player1', 'Player2', 'Player3'],
    agentRolePrompts: [
      'You are Player1 with 20 tokens to contribute.',
      'You are Player2 with 20 tokens to contribute.',
      'You are Player3 with 20 tokens to contribute.',
    ],
    rounds: 3,
  },

  coordination_game: {
    id: 'coordination_game',
    name: 'Coordination Game',
    category: 'game_theory',
    agentNames: ['Player1', 'Player2', 'Player3'],
    agentRolePrompts: [
      'You are Player1, trying to coordinate with others.',
      'You are Player2, following the group consensus.',
      'You are Player3, a decisive leader.',
    ],
    rounds: 3,
  },

  // ── Discussion ───────────────────────────────────────────────

  open_discussion: {
    id: 'open_discussion',
    name: 'Open Discussion',
    category: 'discussion',
    agentNames: ['Speaker1', 'Speaker2', 'Speaker3', 'Speaker4'],
    agentRolePrompts: [
      'You are Speaker1, enthusiastic and vocal.',
      'You are Speaker2, thoughtful and measured.',
      'You are Speaker3, a quiet observer who speaks when it matters.',
      "You are Speaker4, a devil's advocate.",
    ],
    rounds: 2,
  },

  council_chamber: {
    id: 'council_chamber',
    name: 'Council Chamber',
    category: 'discussion',
    agentNames: ['Councilor1', 'Councilor2', 'Councilor3', 'Councilor4', 'Councilor5'],
    agentRolePrompts: [
      'You are Councilor1, leading the discussion.',
      'You are Councilor2, focused on fairness.',
      'You are Councilor3, data-driven.',
      'You are Councilor4, consensus-builder.',
      'You are Councilor5, decisive and bold.',
    ],
    rounds: 2,
  },

  // ── Spatial ──────────────────────────────────────────────────

  grid_world: {
    id: 'grid_world',
    name: 'Grid World',
    category: 'spatial',
    agentNames: ['Explorer1', 'Explorer2', 'Explorer3', 'Explorer4'],
    agentRolePrompts: [
      'You are Explorer1, navigating the grid.',
      'You are Explorer2, a strategic mover.',
      'You are Explorer3, an adventurous wanderer.',
      'You are Explorer4, a careful planner.',
    ],
    rounds: 3,
  },

  contagion: {
    id: 'contagion',
    name: 'Contagion Spread',
    category: 'spatial',
    agentNames: ['Person1', 'Person2', 'Person3', 'Person4', 'Person5'],
    agentRolePrompts: [
      'You are Person1, health-conscious and careful.',
      'You are Person2, social and outgoing.',
      'You are Person3, follows the rules.',
      'You are Person4, skeptical of warnings.',
      'You are Person5, a community leader.',
    ],
    rounds: 3,
  },

  // ── Sociology ────────────────────────────────────────────────

  social_norm_disruption: {
    id: 'social_norm_disruption',
    name: 'Social Norm Disruption',
    category: 'sociology',
    agentNames: ['Citizen1', 'Citizen2', 'Citizen3', 'Citizen4'],
    agentRolePrompts: [
      'You are Citizen1, a rule-follower.',
      'You are Citizen2, a questioner of norms.',
      'You are Citizen3, an influencer.',
      'You are Citizen4, an observer.',
    ],
    rounds: 3,
  },

  policy_erosion: {
    id: 'policy_erosion',
    name: 'Policy Meaning Erosion',
    category: 'sociology',
    agentNames: ['Official1', 'Official2', 'Official3', 'Official4'],
    agentRolePrompts: [
      'You are Official1, a strict enforcer.',
      'You are Official2, flexible in interpretation.',
      'You are Official3, a policy writer.',
      'You are Official4, a public servant.',
    ],
    rounds: 3,
  },

  echo_chamber: {
    id: 'echo_chamber',
    name: 'Echo Chamber',
    category: 'sociology',
    agentNames: ['Member1', 'Member2', 'Member3', 'Member4', 'Member5'],
    agentRolePrompts: [
      'You are Member1, strongly opinionated.',
      'You are Member2, a moderate voice.',
      'You are Member3, seeking confirmation.',
      'You are Member4, an outsider perspective.',
      'You are Member5, amplifying group views.',
    ],
    rounds: 3,
  },

  resource_scarcity: {
    id: 'resource_scarcity',
    name: 'Resource Sccarcity',
    category: 'sociology',
    agentNames: ['Survivor1', 'Survivor2', 'Survivor3', 'Survivor4'],
    agentRolePrompts: [
      'You are Survivor1, conserving resources.',
      'You are Survivor2, competing for supplies.',
      'You are Survivor3, sharing with the group.',
      'You are Survivor4, hoarding for safety.',
    ],
    rounds: 3,
  },
};

/** Get all scenario configs as an array */
export function getAllScenarios(): ScenarioConfig[] {
  return Object.values(SCENARIOS);
}

/** Get scenarios grouped by category */
export function getScenariosByCategory(category: string): ScenarioConfig[] {
  return Object.values(SCENARIOS).filter(s => s.category === category);
}
