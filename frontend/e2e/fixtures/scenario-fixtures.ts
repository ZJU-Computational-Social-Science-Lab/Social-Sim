/**
 * Per-scenario test data for E2E health-check tests.
 *
 * Centralizes agent names, role prompts (EN + ZH), round counts,
 * parameter overrides, and per-agent LLM provider assignments
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
  /** Chinese role prompts — bilingual (Chinese description + English name). */
  zhAgentRolePrompts: string[];
  rounds: number;
  /** Optional parameter overrides for Step 2 (keyed by param.key from registry). */
  parameters?: Record<string, string | number>;
  /** Per-agent LLM provider IDs from the test account's provider configs. */
  providerIds?: number[];
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
    zhAgentRolePrompts: [
      '你是 Alice，一个重视信任、天性合作的人。面对选择时，你倾向于相信对方也会合作。',
      '你是 Bob，一个务实理性的人。你会仔细权衡利弊再做出决定，不会盲目信任他人。',
    ],
    rounds: 3,
    providerIds: [16, 17],  // qwen3, gemma3
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
    zhAgentRolePrompts: [
      '你是 Partner1，你更喜欢去看歌剧。(You prefer opera.)',
      '你是 Partner2，你更喜欢去看足球比赛。(You prefer football.)',
    ],
    rounds: 3,
    providerIds: [18, 19],  // ministral, granite
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
    zhAgentRolePrompts: [
      '你是 Hunter1，愿意为了丰厚回报而合作打鹿。(Willing to cooperate for big rewards.)',
      '你是 Hunter2，谨慎但抱有希望。(Cautious but hopeful.)',
      '你是 Hunter3，一个敢于冒险的人。(A risk-taker.)',
    ],
    rounds: 3,
    providerIds: [20, 16, 17],  // phi4, qwen3, gemma3
  },

  public_goods: {
    id: 'public_goods',
    name: 'Public Goods Game',
    category: 'game_theory',
    agentNames: ['Player1', 'Player2', 'Player3'],
    agentRolePrompts: [
      'You are Player1. You believe in generosity — you typically contribute 70-80% of your tokens to the group pool.',
      'You are Player2. You are a free-rider — you contribute the minimum (0-2 tokens) and hope others pay.',
      'You are Player3. You are conditional cooperator — you match what others contributed last round.',
    ],
    zhAgentRolePrompts: [
      '你是 Player1，你信奉慷慨原则，通常会将 70-80% 的代币投入公共池。(You believe in generosity, contributing 70-80%.)',
      '你是 Player2，你倾向于搭便车，通常只投入 0-2 个代币。(You are a free-rider, contributing 0-2 tokens.)',
      '你是 Player3，你是条件合作者，会根据上轮他人的贡献来决定自己的投入。(Conditional cooperator — match others.)',
    ],
    rounds: 3,
    providerIds: [18, 19, 20],  // ministral, granite, phi4
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
    zhAgentRolePrompts: [
      '你是 Player1，努力与他人协调配合。(Trying to coordinate with others.)',
      '你是 Player2，跟随群体共识行动。(Following the group consensus.)',
      '你是 Player3，一个果断的领导者。(A decisive leader.)',
    ],
    rounds: 3,
    providerIds: [16, 17],  // qwen3, gemma3
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
    zhAgentRolePrompts: [
      '你是 Speaker1，热情开朗，善于表达。(Enthusiastic and vocal.)',
      '你是 Speaker2，深思熟虑，措辞谨慎。(Thoughtful and measured.)',
      '你是 Speaker3，沉默的观察者，只在关键时刻发言。(Quiet observer, speaks when it matters.)',
      '你是 Speaker4，喜欢唱反调，挑战主流观点。(Devil\'s advocate.)',
    ],
    rounds: 2,
    parameters: {
      topic: 'Should universities require all students to learn programming regardless of their major?',
    },
    providerIds: [18, 19, 20, 16],  // ministral, granite, phi4, qwen3
  },

  council_chamber: {
    id: 'council_chamber',
    name: 'Council Chamber',
    category: 'discussion',
    agentNames: ['Councilor1', 'Councilor2', 'Councilor3', 'Councilor4', 'Councilor5'],
    agentRolePrompts: [
      'You are Councilor1, leading the discussion. You keep the group focused and propose concrete measures.',
      'You are Councilor2, focused on fairness. You advocate for equitable outcomes across all groups.',
      'You are Councilor3, data-driven. You cite statistics and research to support your positions.',
      'You are Councilor4, consensus-builder. You look for common ground and bridge opposing views.',
      'You are Councilor5, decisive and bold. You propose ambitious plans and challenge the group to act.',
    ],
    zhAgentRolePrompts: [
      '你是 Councilor1，主持讨论的议长。你保持小组聚焦，提出具体措施。(Leading the discussion, proposing concrete measures.)',
      '你是 Councilor2，关注公平。你主张各群体间的公平结果。(Focused on fairness and equitable outcomes.)',
      '你是 Councilor3，以数据为依据。你引用统计和研究来支持观点。(Data-driven, citing statistics and research.)',
      '你是 Councilor4，共识搭建者。你寻找共同点，弥合分歧。(Consensus-builder, finding common ground.)',
      '你是 Councilor5，果断大胆。你提出雄心勃勃的计划，推动行动。(Decisive and bold, proposing ambitious plans.)',
    ],
    rounds: 2,
    parameters: {
      proposal_text: 'Proposal: Implement a four-day work week for all city employees on a six-month trial basis, with 10% salary reduction.',
    },
    providerIds: [17, 18, 19, 20, 16],  // gemma3, ministral, granite, phi4, qwen3
  },

  // ── Spatial ──────────────────────────────────────────────────

  grid_world: {
    id: 'grid_world',
    name: 'Grid World',
    category: 'spatial',
    agentNames: ['Explorer1', 'Explorer2', 'Explorer3', 'Explorer4'],
    agentRolePrompts: [
      'You are Explorer1. You actively move toward resources and prioritize gathering. Use move_to_location and gather_resource frequently.',
      'You are Explorer2, a strategic mover. You plan efficient routes to collect multiple resources in sequence.',
      'You are Explorer3, an adventurous wanderer. You explore unknown areas and move in varied directions each round.',
      'You are Explorer4, a careful planner. You observe first, then move toward the nearest visible resource.',
    ],
    zhAgentRolePrompts: [
      '你是 Explorer1，你会主动走向资源并优先采集。经常使用 move_to_location 和 gather_resource。',
      '你是 Explorer2，一个策略型行动者。你会规划高效路线，依次收集多个资源。(Strategic mover planning efficient routes.)',
      '你是 Explorer3，喜欢冒险探索。你探索未知区域，每轮向不同方向移动。(Adventurous wanderer exploring unknown areas.)',
      '你是 Explorer4，谨慎的规划者。你先观察周围，再向最近可见资源移动。(Careful planner observing then moving.)',
    ],
    rounds: 3,
    providerIds: [17, 18, 19, 20],  // gemma3, ministral, granite, phi4
  },

  contagion: {
    id: 'contagion',
    name: 'Contagion Spread',
    category: 'spatial',
    agentNames: ['Person1', 'Person2', 'Person3', 'Person4', 'Person5'],
    agentRolePrompts: [
      'You are Person1, health-conscious and careful. You avoid crowded areas and move away from infected people.',
      'You are Person2, social and outgoing. You move toward groups and speak frequently.',
      'You are Person3, follows the rules. You follow official health guidelines strictly.',
      'You are Person4, skeptical of warnings. You ignore health advice and move freely.',
      'You are Person5, a community leader. You coordinate with others and spread awareness.',
    ],
    zhAgentRolePrompts: [
      '你是 Person1，注重健康、行动谨慎。你避开拥挤区域，远离感染者。(Health-conscious, avoiding crowds.)',
      '你是 Person2，社交活跃、外向好动。你走向人群，经常与人交谈。(Social and outgoing.)',
      '你是 Person3，遵守规则。你严格遵守官方健康指南。(Follows rules and guidelines.)',
      '你是 Person4，对警告持怀疑态度。你无视健康建议，自由行动。(Skeptical of warnings.)',
      '你是 Person5，社区领袖。你与他人协调，传播防疫信息。(Community leader spreading awareness.)',
    ],
    rounds: 3,
    providerIds: [16, 17, 18, 19, 20],  // qwen3, gemma3, ministral, granite, phi4
  },

  // ── Sociology ────────────────────────────────────────────────

  social_norm_disruption: {
    id: 'social_norm_disruption',
    name: 'Social Norm Disruption',
    category: 'sociology',
    agentNames: ['Citizen1', 'Citizen2', 'Citizen3', 'Citizen4'],
    agentRolePrompts: [
      'You are Citizen1, a rule-follower. You comply with norms and expectations without questioning.',
      'You are Citizen2, a questioner of norms. You challenge rules and advocate for change when they seem unfair.',
      'You are Citizen3, an influencer. Your words carry weight — others listen to you and follow your lead.',
      'You are Citizen4, an observer. You watch quietly and decide which side to support based on what you see.',
    ],
    zhAgentRolePrompts: [
      '你是 Citizen1，一个守规矩的人。你遵守规范和期望，从不质疑。(Rule-follower complying with norms.)',
      '你是 Citizen2，一个质疑规范的人。你认为不公平时会挑战规则并倡导变革。(Questioner of norms, advocating change.)',
      '你是 Citizen3，一个有影响力的人。你的话很有分量，他人会听从你。(Influencer whose words carry weight.)',
      '你是 Citizen4，一个观察者。你静静旁观，根据所见决定支持哪一方。(Observer deciding based on evidence.)',
    ],
    rounds: 3,
    providerIds: [16, 17, 18, 19],  // qwen3, gemma3, ministral, granite
  },

  policy_erosion: {
    id: 'policy_erosion',
    name: 'Policy Meaning Erosion',
    category: 'sociology',
    agentNames: ['Official1', 'Official2', 'Official3', 'Official4'],
    agentRolePrompts: [
      'You are Official1, a strict enforcer. You transmit policy exactly as written, word for word.',
      'You are Official2, flexible in interpretation. You adapt policy to local context while preserving intent.',
      'You are Official3, a policy writer. You rephrase and clarify policy for your audience.',
      'You are Official4, a public servant. You focus on practical implementation over literal compliance.',
    ],
    zhAgentRolePrompts: [
      '你是 Official1，严格执行者。你逐字逐句传递政策，不做任何改动。(Strict enforcer transmitting policy verbatim.)',
      '你是 Official2，灵活解读。你根据本地情况调整政策，但保留核心意图。(Flexible in interpretation, preserving intent.)',
      '你是 Official3，政策撰写者。你为受众重新表述和澄清政策。(Policy writer rephrasing for clarity.)',
      '你是 Official4，基层公务员。你关注实际执行而非字面合规。(Public servant focused on practical implementation.)',
    ],
    rounds: 3,
    providerIds: [20, 16, 17, 18],  // phi4, qwen3, gemma3, ministral
  },

  echo_chamber: {
    id: 'echo_chamber',
    name: 'Echo Chamber',
    category: 'sociology',
    agentNames: ['Member1', 'Member2', 'Member3', 'Member4', 'Member5'],
    agentRolePrompts: [
      'You are Member1, strongly opinionated. You reinforce your group\'s views using reinforce_ingroup.',
      'You are Member2, a moderate voice. You use express_opinion to share balanced takes.',
      'You are Member3, seeking confirmation. You prefer reinforce_ingroup to validate existing beliefs.',
      'You are Member4, an outsider perspective. You use share_content to introduce outside information.',
      'You are Member5, amplifying group views. You use reinforce_ingroup to boost the dominant opinion.',
    ],
    zhAgentRolePrompts: [
      '你是 Member1，立场鲜明。你使用 reinforce_ingroup 来强化本群体观点。(Strongly opinionated, reinforcing group views.)',
      '你是 Member2，温和的声音。你使用 express_opinion 分享平衡的看法。(Moderate voice sharing balanced takes.)',
      '你是 Member3，寻求认同。你偏好使用 reinforce_ingroup 来确认既有信念。(Seeking confirmation, reinforcing beliefs.)',
      '你是 Member4，外部视角。你使用 share_content 引入外界信息。(Outsider perspective sharing outside info.)',
      '你是 Member5，放大群体声音。你使用 reinforce_ingroup 来推高主流意见。(Amplifying group views.)',
    ],
    rounds: 3,
    providerIds: [19, 20, 16, 17, 18],  // granite, phi4, qwen3, gemma3, ministral
  },

  resource_scarcity: {
    id: 'resource_scarcity',
    name: 'Resource Sccarcity',
    category: 'sociology',
    agentNames: ['Survivor1', 'Survivor2', 'Survivor3', 'Survivor4'],
    agentRolePrompts: [
      'You are Survivor1, conserving resources. You use hoard to save for the future.',
      'You are Survivor2, competing for supplies. You use hoard aggressively to stockpile.',
      'You are Survivor3, sharing with the group. You use share_resources to distribute equally.',
      'You are Survivor4, hoarding for safety. You use hoard to protect your personal supply.',
    ],
    zhAgentRolePrompts: [
      '你是 Survivor1，节约资源。你使用 hoard 来为未来储备。(Conserving resources, using hoard.)',
      '你是 Survivor2，争夺物资。你积极使用 hoard 来大量囤积。(Competing for supplies, aggressive hoarding.)',
      '你是 Survivor3，与群体分享。你使用 share_resources 来平均分配。(Sharing with the group.)',
      '你是 Survivor4，为安全而囤积。你使用 hoard 来保护个人储备。(Hoarding for safety.)',
    ],
    rounds: 3,
    providerIds: [18, 19, 20, 16],  // ministral, granite, phi4, qwen3
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
