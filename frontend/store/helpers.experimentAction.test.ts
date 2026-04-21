import { describe, expect, it } from 'vitest';
import { mapBackendEventsToLogs } from './helpers';
import i18n from '../i18n';

describe('mapBackendEventsToLogs - experiment_action', () => {
  it('includes summary and payoff in mapped action logs', () => {
    const logs = mapBackendEventsToLogs(
      [
        {
          type: 'experiment_action',
          data: {
            agent: 'Alice',
            action: 'contribute',
            summary: 'Alice chose contribute (amount=7, pool=main)',
            payoff: 18.25,
            round: 1,
          },
        },
      ],
      '1',
      1,
      [{ id: 'a1', name: 'Alice' } as any],
      true,
    );

    expect(logs).toHaveLength(1);
    expect(logs[0].content).toBe('Alice chose Contribute (amount=7, pool=main) -> payoff=18.25');
  });

  it('renders localized readable action text for zh experiment actions', async () => {
    (globalThis as any).i18n.language = 'zh';
    (i18n as any).language = 'zh';

    const logs = mapBackendEventsToLogs(
      [
        {
          type: 'experiment_action',
          data: {
            agent: '夹心层白领 周晨',
            action: 'enroll_family',
            summary: '夹心层白领 周晨 chose enroll_family',
            round: 1,
          },
        },
      ],
      '1',
      1,
      [{ id: 'a1', name: '夹心层白领 周晨' } as any],
      true,
    );

    expect(logs).toHaveLength(1);
    expect(logs[0].content).toBe('夹心层白领 周晨选择了为家人投保');
    expect(logs[0].actionLabel).toBe('为家人投保');

    (globalThis as any).i18n.language = 'en';
    (i18n as any).language = 'en';
  });

  it('renders localized matrix-game actions and display agent labels in zh logs', async () => {
    (globalThis as any).i18n.language = 'zh';
    (i18n as any).language = 'zh';

    const logs = mapBackendEventsToLogs(
      [
        {
          type: 'experiment_action',
          data: {
            agent: '1',
            action: 'cooperate',
            summary: '1 chose cooperate',
            round: 1,
          },
        },
      ],
      '1',
      1,
      [{ id: 'agent-1775653807227-0', name: '1' } as any],
      true,
    );

    expect(logs).toHaveLength(1);
    expect(logs[0].content).toBe('1号参与者选择了合作');
    expect(logs[0].actionLabel).toBe('合作');

    (globalThis as any).i18n.language = 'en';
    (i18n as any).language = 'en';
  });

  it('prefers natural-language action text when experiment events include it', async () => {
    (globalThis as any).i18n.language = 'zh';
    (i18n as any).language = 'zh';

    const logs = mapBackendEventsToLogs(
      [
        {
          type: 'experiment_action',
          data: {
            agent: '夹心层白领 周晨',
            action: 'wait_and_observe',
            summary: '夹心层白领 周晨 chose wait_and_observe',
            text: '我想先看看邻里和家人的反应，再决定要不要投保。',
            round: 1,
          },
        },
      ],
      '1',
      1,
      [{ id: 'a1', name: '夹心层白领 周晨' } as any],
      true,
    );

    expect(logs).toHaveLength(1);
    expect(logs[0].content).toBe('夹心层白领 周晨：我想先看看邻里和家人的反应，再决定要不要投保。');
    expect(logs[0].actionLabel).toBe('继续观望');

    (globalThis as any).i18n.language = 'en';
    (i18n as any).language = 'en';
  });
});
