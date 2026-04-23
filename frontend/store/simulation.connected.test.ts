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
    vi.clearAllMocks();
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

  await new Promise((resolve) => setTimeout(resolve, 50));

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

  it('preserves provider distribution when agents carry per-agent llmConfig and provider_id', async () => {
    const { createSimulation } = await import('../services/simulations');

    useSimulationStore.getState().addSimulation(
      'Provider Distribution Test',
      {
        id: 'experiment-template',
        name: 'Provider Distribution Test',
        description: 'Experiment',
        category: 'game_theory',
        sceneType: 'experiment',
        agents: [
          {
            id: 'a1',
            name: 'Agent A',
            role: 'Role A',
            rolePrompt: 'Role prompt A',
            profile: 'Profile A',
            avatarUrl: 'https://example.com/a.png',
            llmConfig: { provider: 'openai', model: 'gpt-4o-mini' },
            provider_id: 11,
            properties: { provider_id: 11 },
          },
          {
            id: 'a2',
            name: 'Agent B',
            role: 'Role B',
            rolePrompt: 'Role prompt B',
            profile: 'Profile B',
            avatarUrl: 'https://example.com/b.png',
            llmConfig: { provider: 'gemini', model: 'gemini-2.0-flash' },
            provider_id: 12,
            properties: { provider_id: 12 },
          },
        ],
        defaultTimeConfig: {
          baseTime: new Date().toISOString(),
          unit: 'hour',
          step: 1,
        },
        genericConfig: {
          description: 'Provider and network payload preservation',
          scenario_id: 'public_goods',
          round_visibility: 'simultaneous',
          parameters: {},
          actions: [],
        },
        defaultNetwork: {
          'Agent A': ['Agent B'],
          'Agent B': ['Agent A'],
        },
      } as any,
      undefined,
      undefined,
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    const payload = vi.mocked(createSimulation).mock.calls.at(-1)?.[1] as any;
    expect(payload.agent_config.agents).toHaveLength(2);
    expect(payload.agent_config.agents.map((a: any) => a.provider_id)).toEqual([11, 12]);
    expect(payload.agent_config.agents[0].llmConfig).toEqual({ provider: 'openai', model: 'gpt-4o-mini' });
    expect(payload.agent_config.agents[1].llmConfig).toEqual({ provider: 'gemini', model: 'gemini-2.0-flash' });
    expect(payload.scene_config.social_network).toEqual({
      'Agent A': ['Agent B'],
      'Agent B': ['Agent A'],
    });
  });
});
