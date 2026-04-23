import { beforeEach, describe, expect, it, vi } from 'vitest';

const { patchMock, postMock } = vi.hoisted(() => ({
  patchMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock('../services/client', () => ({
  apiClient: {
    patch: patchMock,
    post: postMock,
  },
}));

import { useSimulationStore } from '../store';
import { buildGuidePrompt, parseGuideResponse } from './ui';

describe('UI Slice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    patchMock.mockResolvedValue({});
    postMock.mockImplementation(async (path: string) => {
      if (path === 'llm/refine_report') {
        return {
          data: {
            text: 'Open the network editor first.\n\n[[OPEN_NETWORK]] [[OPEN_REPORT]]',
          },
        };
      }

      return { data: { id: 'snapshot-1' } };
    });

    useSimulationStore.setState({
      currentSimulation: null,
      agents: [],
      nodes: [],
      syncLogs: [],
      isSyncing: false,
      guideMessages: [],
      isGuideLoading: false,
      notifications: [],
      socialNetwork: {},
    } as any);
  });

  it('parses guide action tags into suggested actions', () => {
    expect(parseGuideResponse('Use reports. [[OPEN_REPORT]] [[OPEN_NETWORK]] [[OPEN_REPORT]]')).toEqual({
      content: 'Use reports.',
      suggestedActions: ['OPEN_REPORT', 'OPEN_NETWORK'],
    });
  });

  it('builds a history-based guide prompt', () => {
    const prompt = buildGuidePrompt('System prompt', [
      { id: '1', role: 'user', content: 'How do I branch?' },
      { id: '2', role: 'assistant', content: 'Use the branch action.' },
    ]);

    expect(prompt).toContain('System prompt');
    expect(prompt).toContain('User: How do I branch?');
    expect(prompt).toContain('Assistant: Use the branch action.');
    expect(prompt).toContain('[[OPEN_*]]');
  });

  it('maps guide responses to cleaned content and suggested actions', async () => {
    await useSimulationStore.getState().sendGuideMessage('How do I inspect topology?');

    expect(postMock).toHaveBeenCalledWith('llm/refine_report', expect.objectContaining({
      prompt: expect.stringContaining('How do I inspect topology?'),
    }));

    const messages = useSimulationStore.getState().guideMessages;
    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({
      role: 'assistant',
      content: 'Open the network editor first.',
      suggestedActions: ['OPEN_NETWORK', 'OPEN_REPORT'],
    });
  });

  it('preserves the 5ceb sync log sequence while using current backend endpoints', async () => {
    useSimulationStore.setState({
      currentSimulation: {
        id: 'sim-1',
        name: 'Test Simulation',
        scene_config: {},
        socialNetwork: { Alice: ['Bob'] },
        agent_config: { agents: [] },
      },
      agents: [
        { id: 'a1', name: 'Alice', role: 'Leader', properties: { trust: 10 }, memory: [] },
      ],
      nodes: [
        { id: '0', parentId: null, depth: 0, meta: { root: true } },
        { id: '1', parentId: '0', depth: 1, meta: {} },
      ],
    } as any);

    await useSimulationStore.getState().syncCurrentSimulation();

    expect(useSimulationStore.getState().syncLogs).toEqual([
      'Starting sync...',
      'Syncing simulation: Test Simulation',
      'Agents: 1',
      'Nodes: 2',
      'Sending data to backend...',
      'Sync completed successfully!',
    ]);
    expect(patchMock).toHaveBeenCalledWith('simulations/sim-1', expect.objectContaining({
      agent_config: expect.objectContaining({
        agents: expect.any(Array),
      }),
      scene_config: expect.objectContaining({
        social_network: { Alice: ['Bob'] },
      }),
    }));
    expect(postMock).toHaveBeenCalledWith('simulations/sim-1/save', expect.objectContaining({
      label: expect.stringContaining('Manual sync sim-1'),
    }));
  });
});