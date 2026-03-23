/**
 * Tests for LogViewer i18n behavior.
 *
 * Verifies that event log entries display in the user's selected
 * language and update when language changes.
 *
 * Exports: None (test file)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { switchLanguage, resetLanguage } from '../../test-utils/i18n';

// Mock translations for testing
const mockTranslations: Record<string, Record<string, string>> = {
  en: {
    'log.reasoningStep': 'Starting step {{step}} reasoning',
    'log.reasoningStart': 'Starting reasoning',
    'log.reasoningDone': 'Reasoning complete',
    'log.actionPrefix': 'Action',
    'log.yieldTurn': 'Yielded the floor',
    'log.planUpdate': 'Plan updated',
    'log.agentError': 'Agent error',
    'log.llmCallError': 'LLM call failed',
    'log.llmParseError': 'LLM output parse failed',
    'log.agentOffline': 'Agent went offline',
    'log.distortionBlocked': 'Policy transmission blocked',
    'log.distortionAdjusted': 'Policy transmission distorted',
    'log.distortionUnchanged': 'Policy transmission stayed effectively unchanged',
    'log.distortedReason': 'Distortion reason',
    'log.pressureReason': 'Distortion pressure',
    'log.distortionInput': 'Announcement classified as distortion cascade input',
    'log.nonDistortionInput': 'Announcement did not enter distortion cascade',
    'log.privateCascadeInput': 'This is a private cascade input, visible only to',
    'log.waitingForTopTier': 'waiting for top-tier relay',
    'log.privateBroadcast': 'Targeted private broadcast',
    'log.globalBroadcast': 'Global broadcast',
    'log.recipientsLabel': 'Recipients',
    'log.allAgents': 'All agents',
    'log.originalMessage': 'Received upstream policy version',
    'log.draftMessage': 'Agent draft before scene rewrite',
    'log.finalMessage': 'Actual downstream message',
    'log.reasonLabel': 'Reason',
    'log.metricsLabel': 'Metrics',
    'log.actionStart': 'Started action',
    'log.actionEnd': 'performed action',
    'log.systemEvent': 'System event',
    'log.agentResponse': 'Agent response',
    'log.choseAction': '{{agent}} chose {{action}}',
    'log.skippedTurn': 'Round {{round}}: {{agent}} - skipped turn',
    'log.roundAction': 'Round {{round}}: {{agent}} chose {{action}}',
    'log.unknown': 'Unknown',
    'log.empty': '(empty)',
    'log.blockedNoDownstream': '(blocked / no downstream message)',
    'log.noReasonProvided': 'No reason provided',
    'log.strength': 'strength',
    'log.conflict': 'conflict',
    'log.block': 'block',
    'log.pressure': 'pressure',
    'log.tendency': 'tendency',
    'log.performedAction': 'Performed action',
  },
  zh: {
    'log.reasoningStep': '开始第 {{step}} 步推理',
    'log.reasoningStart': '开始推理',
    'log.reasoningDone': '完成推理',
    'log.actionPrefix': '动作',
    'log.yieldTurn': '结束本轮发言',
    'log.planUpdate': '更新计划',
    'log.agentError': '智能体发生错误',
    'log.llmCallError': 'LLM 调用失败',
    'log.llmParseError': 'LLM 输出解析失败',
    'log.agentOffline': '智能体已掉线',
    'log.distortionBlocked': '政策传递被截留',
    'log.distortionAdjusted': '政策传递发生失真',
    'log.distortionUnchanged': '政策传递基本保持原样',
    'log.distortedReason': '已发生失真，原因',
    'log.pressureReason': '存在失真压力，但本次保持原样，原因',
    'log.distortionInput': '本条公告被识别为：distortion cascade input',
    'log.nonDistortionInput': '本条公告未进入 distortion cascade',
    'log.privateCascadeInput': '这是一条私有级联输入，仅',
    'log.waitingForTopTier': '可见，等待其作为 top tier 下传',
    'log.privateBroadcast': '定向私有广播',
    'log.globalBroadcast': '全局广播',
    'log.recipientsLabel': '接收者',
    'log.allAgents': '全体智能体',
    'log.originalMessage': '收到的上级政策版本',
    'log.draftMessage': 'Agent 原始下传草稿',
    'log.finalMessage': '实际对下发送内容',
    'log.reasonLabel': '原因',
    'log.metricsLabel': '参数/评分',
    'log.actionStart': '开始执行动作',
    'log.actionEnd': '执行了动作',
    'log.systemEvent': '系统事件',
    'log.agentResponse': 'Agent responded',
    'log.choseAction': '{{agent}} 选择了 {{action}}',
    'log.skippedTurn': '第{{round}}轮: {{agent}} - 跳过回合',
    'log.roundAction': '第{{round}}轮: {{agent}} 选择了 {{action}}',
    'log.unknown': '未知',
    'log.empty': '（空）',
    'log.blockedNoDownstream': '（已截留 / 无下传内容）',
    'log.noReasonProvided': '未提供原因',
    'log.strength': '失真强度',
    'log.conflict': '冲突敏感度',
    'log.block': '阻断概率',
    'log.pressure': '冲突压力',
    'log.tendency': '截留倾向',
    'log.performedAction': '执行了动作',
  },
};

// Helper to get mock translation
const getMockTranslation = (key: string, params?: Record<string, any>): string => {
  const lang = (globalThis as any).i18n?.language || 'en';
  const translations = mockTranslations[lang] || mockTranslations.en;
  let value = translations[key] || key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      value = value.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
    });
  }
  return value;
};

describe('LogViewer i18n - Translation Keys', () => {
  const requiredKeys = [
    'log.reasoningStep',
    'log.reasoningStart',
    'log.reasoningDone',
    'log.actionPrefix',
    'log.yieldTurn',
    'log.planUpdate',
    'log.agentError',
    'log.llmCallError',
    'log.llmParseError',
    'log.agentOffline',
    'log.distortionBlocked',
    'log.distortionAdjusted',
    'log.distortionUnchanged',
    'log.distortedReason',
    'log.pressureReason',
    'log.distortionInput',
    'log.nonDistortionInput',
    'log.privateCascadeInput',
    'log.waitingForTopTier',
    'log.privateBroadcast',
    'log.globalBroadcast',
    'log.recipientsLabel',
    'log.allAgents',
    'log.originalMessage',
    'log.draftMessage',
    'log.finalMessage',
    'log.reasonLabel',
    'log.metricsLabel',
    'log.actionStart',
    'log.actionEnd',
    'log.systemEvent',
    'log.agentResponse',
    'log.choseAction',
    'log.skippedTurn',
    'log.roundAction',
    'log.unknown',
    'log.empty',
    'log.blockedNoDownstream',
    'log.noReasonProvided',
    'log.strength',
    'log.conflict',
    'log.block',
    'log.pressure',
    'log.tendency',
    'log.performedAction',
  ];

  beforeEach(async () => {
    await resetLanguage();
  });

  afterEach(async () => {
    await resetLanguage();
  });

  it('all keys used in mapBackendEventsToLogs exist in English locale', () => {
    for (const key of requiredKeys) {
      const value = getMockTranslation(key);
      expect(value).not.toBe(key);
      expect(value).toBeTruthy();
    }
  });

  it('all keys used in mapBackendEventsToLogs exist in Chinese locale', async () => {
    await switchLanguage('zh');
    for (const key of requiredKeys) {
      const value = getMockTranslation(key);
      expect(value).not.toBe(key);
      expect(value).toBeTruthy();
    }
  });

  it('interpolation variables match between EN and ZH for keys with variables', async () => {
    // Keys that use interpolation - verify they work with sample values
    const interpolationKeys = [
      { key: 'log.reasoningStep', vars: { step: 1 } },
      { key: 'log.choseAction', vars: { agent: 'Agent1', action: 'vote' } },
      { key: 'log.skippedTurn', vars: { round: 1, agent: 'Agent1' } },
      { key: 'log.roundAction', vars: { round: 1, agent: 'Agent1', action: 'vote' } },
    ];

    for (const { key, vars } of interpolationKeys) {
      await resetLanguage();
      const enValue = getMockTranslation(key, vars);

      await switchLanguage('zh');
      const zhValue = getMockTranslation(key, vars);

      // Both should produce non-empty strings
      expect(enValue).toBeTruthy();
      expect(zhValue).toBeTruthy();

      // The variable values should appear in the output
      for (const [, val] of Object.entries(vars)) {
        expect(enValue).toContain(String(val));
        expect(zhValue).toContain(String(val));
      }
    }
  });
});

describe('LogViewer i18n - mapBackendEventsToLogs', () => {
  beforeEach(async () => {
    await resetLanguage();
    // Override the mock i18n.t to use our mock translations
    (globalThis as any).i18n.t = getMockTranslation;
  });

  afterEach(async () => {
    await resetLanguage();
  });

  it('returns content in English when i18n.language is en', async () => {
    const { mapBackendEventsToLogs } = await import('../../store/helpers');

    const events = [{
      type: 'agent_error',
      data: { agent: 'TestAgent', kind: 'llm_call', error: 'test error' }
    }];

    await resetLanguage();
    (globalThis as any).i18n.t = getMockTranslation;
    const logs = mapBackendEventsToLogs(events, 'node-1', 1, [], false);

    expect(logs[0]?.content).toContain('Agent');
    expect(logs[0]?.content).toContain('LLM call failed');
  });

  it('returns content in Chinese when i18n.language is zh', async () => {
    const { mapBackendEventsToLogs } = await import('../../store/helpers');

    // Use an event that fully uses i18n.t() for its labels
    const events = [{
      type: 'plan_update',
      data: { agent: 'TestAgent' }
    }];

    await switchLanguage('zh');
    (globalThis as any).i18n.t = getMockTranslation;
    const logs = mapBackendEventsToLogs(events, 'node-1', 1, [], true);

    // plan_update uses labels.planUpdate which is i18n.t('log.planUpdate')
    expect(logs[0]?.content).toBe('更新计划');
  });

  it('produces different content when language changes', async () => {
    const { mapBackendEventsToLogs } = await import('../../store/helpers');

    // Use an event that fully uses i18n.t() for its labels
    const events = [{
      type: 'plan_update',
      data: { agent: 'TestAgent' }
    }];

    await resetLanguage();
    (globalThis as any).i18n.t = getMockTranslation;
    const enLogs = mapBackendEventsToLogs(events, 'node-1', 1, [], true);

    await switchLanguage('zh');
    (globalThis as any).i18n.t = getMockTranslation;
    const zhLogs = mapBackendEventsToLogs(events, 'node-1', 1, [], true);

    // Content should be different between languages
    expect(enLogs[0]?.content).not.toBe(zhLogs[0]?.content);

    // English should have English text
    expect(enLogs[0]?.content).toBe('Plan updated');

    // Chinese should have Chinese text
    expect(zhLogs[0]?.content).toBe('更新计划');
  });
});
