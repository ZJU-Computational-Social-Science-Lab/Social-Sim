import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/simulations', () => ({
  createSimulation: vi.fn().mockResolvedValue({ id: 'sim-connected', name: 'Connected Simulation' }),
  startSimulation: vi.fn().mockResolvedValue({}),
}));

vi.mock('../services/simulationTree', () => ({
  getTreeGraph: vi.fn().mockResolvedValue({
    root: 0,
    frontier: [0],
    nodes: [{ id: 0, depth: 0 }],
    edges: [],
  }),
}));

import { useSimulationStore } from '../store';

describe('Simulation Slice - Connected Experiment Payload', () => {
  beforeEach(() => {
    useSimulationStore.setState({
      simulations: [],
      currentSimulation: null,
      nodes: [],
      selectedNodeId: null,
      agents: [],
      logs: [],
      rawEvents: [],
      notifications: [],
      engineConfig: {
        endpoint: '/api',
        status: 'disconnected',
        token: undefined,
      },
      selectedProviderId: null,
      currentProviderId: null,
    } as any);
  });

  it('passes scenario_id and round_visibility at the top level of scene_config', async () => {
    const { createSimulation } = await import('../services/simulations');

    useSimulationStore.getState().addSimulation(
      'Public Goods Test',
      {
        id: 'experiment-template',
        name: 'Public Goods Test',
        description: 'Experiment',
        category: 'game_theory',
        sceneType: 'experiment',
        agents: [],
        defaultTimeConfig: {
          baseTime: new Date().toISOString(),
          unit: 'hour',
          step: 1,
        },
        genericConfig: {
          description: 'Public goods experiment',
          scenario_id: 'public_goods',
          round_visibility: 'simultaneous',
          parameters: {
            initial_amount: 20,
            multiplier: 1.5,
          },
          actions: [
            {
              action_type: 'choice',
              name: 'Contribute',
              description: 'Contribute some tokens to the pool',
              parameters: [
                {
                  name: 'amount',
                  type: 'integer',
                  description: 'How much to contribute',
                  required: true,
                  default: null,
                },
              ],
            },
          ],
        },
        defaultNetwork: {},
      } as any,
      undefined,
      undefined,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(createSimulation).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(createSimulation).mock.calls[0][1];
    expect(payload.scene_type).toBe('experiment_template');
    expect(payload.scene_config.scenario_id).toBe('public_goods');
    expect(payload.scene_config.round_visibility).toBe('simultaneous');
    expect(payload.scene_config.parameters).toEqual({
      initial_amount: 20,
      multiplier: 1.5,
    });
    expect(payload.scene_config.actions).toEqual([
      {
        action_type: 'choice',
        name: 'Contribute',
        description: 'Contribute some tokens to the pool',
        parameters: [
          {
            name: 'amount',
            type: 'integer',
            description: 'How much to contribute',
            required: true,
            default: null,
          },
        ],
      },
    ]);
  });
});
