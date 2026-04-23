import { describe, expect, it, vi, beforeEach } from 'vitest';

const { postMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
}));

vi.mock('../../services/client', () => ({
  apiClient: {
    post: postMock,
  },
}));

import { generateAgentsWithDemographics } from './agentGeneration';

describe('agentGeneration mappings', () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  it('preserves provider_id and llm config from demographics API response', async () => {
    postMock.mockResolvedValue({
      data: {
        agents: [
          {
            id: 'a1',
            name: 'Agent 1',
            role: 'Tester',
            profile: 'Profile',
            provider: 'openai',
            model: 'gpt-4o-mini',
            provider_id: 7,
            properties: { demographic_attributes: { age: '18-30' } },
          },
        ],
      },
    });

    const agents = await generateAgentsWithDemographics(
      1,
      [{ name: 'Age', categories: ['18-30'] }],
      { base: 100 },
      [{ name: 'Trust', mean: 50, std: 10 }],
      'en',
      7,
    );

    expect(postMock).toHaveBeenCalledWith('/llm/generate_agents_demographics', expect.objectContaining({ provider_id: 7 }));
    expect(agents).toHaveLength(1);
    expect(agents[0].provider_id).toBe(7);
    expect(agents[0].llmConfig).toEqual({ provider: 'openai', model: 'gpt-4o-mini' });
    expect(agents[0].properties).toEqual({ demographic_attributes: { age: '18-30' } });
  });
});
