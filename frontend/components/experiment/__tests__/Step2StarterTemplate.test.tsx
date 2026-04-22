import { describe, expect, it } from 'vitest';

import { analyzeScenarioStructure } from '../Step2StarterTemplate';

describe('analyzeScenarioStructure', () => {
  it('uses policy-transmission analysis for policy meaning erosion', () => {
    const analysis = analyzeScenarioStructure('policy_erosion', {}, true);

    expect(analysis.ordering).toBe('层级政策传递结构');
    expect(analysis.explanation).not.toContain('囚徒困境');
    expect(analysis.ordering).not.toContain('T');
  });

  it('keeps payoff analysis for prisoners dilemma parameters', () => {
    const analysis = analyzeScenarioStructure(
      'prisoners_dilemma',
      {
        cooperate_reward: 3,
        sucker_penalty: 0,
        temptation_reward: 5,
        defect_penalty: 1,
      },
      true
    );

    expect(analysis.ordering).toBe('T > R > P > S');
    expect(analysis.explanation).toContain('囚徒困境');
  });
});
