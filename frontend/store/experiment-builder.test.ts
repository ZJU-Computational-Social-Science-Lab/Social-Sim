import { beforeEach, describe, expect, it } from 'vitest';

import { useExperimentBuilder } from './experiment-builder';


describe('Experiment Builder Store', () => {
  beforeEach(() => {
    useExperimentBuilder.getState().reset();
  });

  it('inherits sequential round visibility from scenario defaults', () => {
    useExperimentBuilder.getState().setSelectedScenarioData({
      id: 'policy_erosion',
      name: 'Policy Meaning Erosion',
      category: 'sociology',
      description: 'A hierarchy transmits a policy.',
      interaction_mode: 'sequential',
      parameters: [],
      actions: [],
    });

    expect(useExperimentBuilder.getState().roundVisibility).toBe('sequential');
  });

  it('keeps simultaneous round visibility for simultaneous scenarios', () => {
    useExperimentBuilder.getState().setSelectedScenarioData({
      id: 'social_norm_disruption',
      name: 'Social Norm Disruption',
      category: 'sociology',
      description: 'A new rule is imposed.',
      interaction_mode: 'simultaneous',
      parameters: [],
      actions: [],
    });

    expect(useExperimentBuilder.getState().roundVisibility).toBe('simultaneous');
  });

  it('starts custom scenario with sequential ordering for v1', () => {
    useExperimentBuilder.getState().setSelectedScenarioData({
      id: 'custom',
      name: 'Custom Scenario',
      category: 'custom',
      description: 'Open ended conversation.',
      interaction_mode: 'simultaneous',
      parameters: [],
      actions: [],
    });

    expect(useExperimentBuilder.getState().roundVisibility).toBe('sequential');
  });
});
