import i18n from '../i18n';
import type { Agent, LogEntry, SimulationReport } from '../types';
import { apiClient } from './client';

export interface ExperimentAnalysisConfig {
  maxEvents: number;
  samplePerRound: number;
  focusAgents: string[];
  enableLLM: boolean;
  roundStart: number | null;
  roundEnd: number | null;
}

type BenchmarkComparison = SimulationReport['benchmarkComparison'];
type ReportKeyEvent = SimulationReport['keyEvents'][number];
type ReportAgentAnalysis = SimulationReport['agentAnalysis'][number];

interface ReportDraft {
  summary: string;
  keyEvents: ReportKeyEvent[];
  agentAnalysis: ReportAgentAnalysis[];
  suggestions: string[];
  benchmarkComparison?: BenchmarkComparison;
}

const XIHU_ACTION_PATTERNS: Record<string, RegExp> = {
  enroll_self: /enroll_self|为自己投保/i,
  enroll_family: /enroll_family|为家人投保/i,
  wait_and_observe: /wait_and_observe|继续观望/i,
  decline_for_now: /decline_for_now|暂不投保/i,
  speak: /speak|表达理由|发言/i,
};

const clampBenchmarkScale = (value: number) => Math.max(1, Math.min(5, Number(value.toFixed(2))));
const convertRateToLikert = (rate: number) => clampBenchmarkScale(1 + rate * 4);

const parseXihuAction = (content: string) => {
  const text = content || '';
  return Object.entries(XIHU_ACTION_PATTERNS).find(([, pattern]) => pattern.test(text))?.[0] ?? null;
};

const buildXihuBenchmarkComparison = (
  sceneConfig: Record<string, any>,
  logs: LogEntry[],
  agents: Agent[],
): BenchmarkComparison => {
  const benchmark = sceneConfig.xihu_benchmarks;
  if (!benchmark?.metrics) {
    return undefined;
  }

  const latestActionByAgent = new Map<string, string>();
  logs
    .filter((log) => log.type === 'AGENT_ACTION')
    .forEach((log) => {
      const action = parseXihuAction(log.content || '');
      if (!action) {
        return;
      }
      const agentKey = String(log.agentId || log.id);
      latestActionByAgent.set(agentKey, action);
    });

  const denominator = Math.max(agents.length, latestActionByAgent.size, 1);
  const actionCounts = Array.from(latestActionByAgent.values()).reduce(
    (accumulator, action) => ({
      ...accumulator,
      [action]: (accumulator[action] || 0) + 1,
    }),
    {} as Record<string, number>,
  );

  const parameters = (sceneConfig.parameters ?? {}) as Record<string, any>;
  const positiveRate =
    ((actionCounts.enroll_self || 0) + (actionCounts.enroll_family || 0)) / denominator;

  const simulatedMetricMap: Record<string, number> = {
    self_enrollment_willingness: convertRateToLikert((actionCounts.enroll_self || 0) / denominator),
    family_enrollment_willingness: convertRateToLikert((actionCounts.enroll_family || 0) / denominator),
    recommendation_willingness: convertRateToLikert(positiveRate),
    next_year_enrollment_willingness: convertRateToLikert(positiveRate),
  };

  if (parameters.government_trust !== undefined) {
    simulatedMetricMap.government_endorsement = clampBenchmarkScale(
      1 + Number(parameters.government_trust) * 4,
    );
  }

  const items = Object.entries(benchmark.metrics)
    .filter(([key]) => simulatedMetricMap[key] !== undefined)
    .map(([key, metric]: [string, any]) => {
      const simulatedValue = simulatedMetricMap[key];
      const delta = Number((simulatedValue - metric.mean).toFixed(2));
      const interpretation =
        Math.abs(delta) <= 0.35
          ? i18n.t('report.benchmark.aligned', { defaultValue: '与线下结果基本一致' })
          : delta > 0
            ? i18n.t('report.benchmark.higher', { defaultValue: '仿真结果高于线下均值' })
            : i18n.t('report.benchmark.lower', { defaultValue: '仿真结果低于线下均值' });

      return {
        key,
        label: metric.label,
        benchmarkMean: metric.mean,
        simulatedValue,
        delta,
        interpretation,
      };
    })
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));

  if (!items.length) {
    return undefined;
  }

  const possibleDrivers = [
    parameters.xihu_arm_label
      ? `当前实验臂：${parameters.xihu_arm_label}`
      : null,
    parameters.decision_focus ? `决策焦点：${parameters.decision_focus}` : null,
    parameters.household_medical_burden
      ? `家庭医疗负担显著性：${parameters.household_medical_burden}`
      : null,
    parameters.prior_insurance_attitude
      ? `既有保险态度：${parameters.prior_insurance_attitude}`
      : null,
    parameters.government_trust !== undefined
      ? `政府背书信任：${parameters.government_trust}`
      : null,
  ].filter(Boolean) as string[];

  return {
    armId: benchmark.armId,
    armLabel: benchmark.armLabel,
    sampleSize: benchmark.sampleSize,
    items,
    possibleDrivers,
  };
};

const sampleLogsForReport = (
  logs: LogEntry[],
  analysisConfig: ExperimentAnalysisConfig,
): LogEntry[] => {
  let filteredLogs = logs;
  if (analysisConfig.roundStart !== null) {
    filteredLogs = filteredLogs.filter((log) => log.round >= analysisConfig.roundStart!);
  }
  if (analysisConfig.roundEnd !== null) {
    filteredLogs = filteredLogs.filter((log) => log.round <= analysisConfig.roundEnd!);
  }

  const maxEvents = analysisConfig.maxEvents || 800;
  const samplePerRound = analysisConfig.samplePerRound || 5;
  const roundGroups = new Map<number, LogEntry[]>();
  filteredLogs.slice(0, maxEvents).forEach((log) => {
    const round = log.round || 0;
    if (!roundGroups.has(round)) {
      roundGroups.set(round, []);
    }
    const bucket = roundGroups.get(round)!;
    if (bucket.length < samplePerRound) {
      bucket.push(log);
    }
  });

  return Array.from(roundGroups.values()).flat();
};

const buildReportDraft = (
  logs: LogEntry[],
  agents: Agent[],
  analysisConfig: ExperimentAnalysisConfig,
  sceneConfig: Record<string, any>,
): ReportDraft => {
  const sampledLogs = sampleLogsForReport(logs, analysisConfig);
  const actions = sampledLogs.filter((log) => log.type === 'AGENT_ACTION');
  const talks = sampledLogs.filter((log) => log.type === 'AGENT_SAY');
  const errors = sampledLogs.filter((log) => log.content?.includes?.('错误') || log.content?.includes?.('error'));

  const summary = `报告生成时间: ${new Date().toLocaleString()}\n` +
    `分析事件数: ${sampledLogs.length} / ${logs.length}\n` +
    `智能体: ${agents.map((agent) => agent.name).join(', ') || '无'}\n` +
    `动作数: ${actions.length}\n` +
    `对话数: ${talks.length}\n` +
    `错误数: ${errors.length}`;

  const keyEvents = sampledLogs
    .filter((log) => log.type !== 'AGENT_METADATA')
    .slice(0, 20)
    .map((log) => ({
      round: log.round,
      description: log.content?.slice(0, 100) || '',
    }));

  const agentAnalysis = agents.slice(0, 6).map((agent) => ({
    agentName: agent.name,
    analysis: `智能体 ${agent.name} 的行为分析`,
  }));

  return {
    summary,
    keyEvents,
    agentAnalysis,
    suggestions: [],
    benchmarkComparison: buildXihuBenchmarkComparison(sceneConfig, logs, agents),
  };
};

const refineReportDraft = async (
  draft: ReportDraft,
  providerId: number,
): Promise<Partial<ReportDraft>> => {
  const prompt = `你是分析员，请用中文简洁总结。\n已有摘要:\n${draft.summary.slice(0, 800)}\n` +
    `\n关键事件:\n${draft.keyEvents.slice(-12).map((event) => `- R${event.round}: ${event.description}`).join('\n')}\n` +
    `\n智能体分析:\n${draft.agentAnalysis.slice(0, 6).map((agent) => `- ${agent.agentName}: ${agent.analysis}`).join('\n')}\n` +
    `\n请输出 JSON，字段: summary(string), keyEvents([{round,description} 至多8条]), suggestions(string[] 至多6条), agentAnalysis([{agentName,analysis} 至多6条]).`;

  const response = await apiClient.post<{ text: string }>('llm/refine_report', {
    prompt,
    provider_id: providerId,
  });
  const parsed = JSON.parse(response.data.text || '{}');
  return {
    summary: parsed.summary,
    keyEvents: parsed.keyEvents,
    suggestions: parsed.suggestions,
    agentAnalysis: parsed.agentAnalysis,
  };
};

export const generateSimulationReport = async ({
  logs,
  agents,
  analysisConfig,
  sceneConfig,
  providerId,
}: {
  logs: LogEntry[];
  agents: Agent[];
  analysisConfig: ExperimentAnalysisConfig;
  sceneConfig: Record<string, any>;
  providerId?: number | null;
}): Promise<SimulationReport> => {
  const draft = buildReportDraft(logs, agents, analysisConfig, sceneConfig);

  if (analysisConfig.enableLLM && providerId) {
    try {
      const refined = await refineReportDraft(draft, providerId);
      if (refined.summary) {
        draft.summary = refined.summary;
        draft.keyEvents = refined.keyEvents || draft.keyEvents;
        draft.suggestions = refined.suggestions || draft.suggestions;
        draft.agentAnalysis = refined.agentAnalysis || draft.agentAnalysis;
      }
    } catch (error) {
      console.warn('LLM refinement failed, using template', error);
    }
  }

  return {
    id: `rep-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    summary: draft.summary,
    keyEvents: draft.keyEvents,
    suggestions: draft.suggestions,
    agentAnalysis: draft.agentAnalysis,
    refinedByLLM: analysisConfig.enableLLM,
    benchmarkComparison: draft.benchmarkComparison,
  };
};

export const buildSimulationReportMarkdown = (report: SimulationReport): string => {
  const lines: string[] = [];
  lines.push(`# ${i18n.t('store.simulationReport') || 'Simulation Experiment Analysis Report'}`);
  lines.push(`${i18n.t('store.generatedAt') || 'Generated at'}: ${new Date(report.generatedAt).toLocaleString()}`);
  lines.push(`\n## ${i18n.t('store.summary') || 'Summary'}\n${report.summary}`);
  lines.push(`\n## ${i18n.t('store.keyEvents') || 'Key Events'}`);
  report.keyEvents.forEach((event) => {
    lines.push(`- R${event.round}: ${event.description}`);
  });
  lines.push(`\n## ${i18n.t('store.suggestions') || 'Suggestions'}`);
  report.suggestions.forEach((suggestion) => lines.push(`- ${suggestion}`));
  lines.push(`\n## ${i18n.t('store.agentAnalysis') || 'Agent Analysis'}`);
  report.agentAnalysis.forEach((agent) => {
    lines.push(`- **${agent.agentName}**: ${agent.analysis}`);
  });

  if (report.benchmarkComparison) {
    lines.push(`\n## 西湖益联保基准对照`);
    lines.push(`- 实验臂: ${report.benchmarkComparison.armLabel}`);
    lines.push(`- 线下样本量: ${report.benchmarkComparison.sampleSize}`);
    report.benchmarkComparison.items.forEach((item) => {
      lines.push(
        `- ${item.label}: 仿真 ${item.simulatedValue} / 线下 ${item.benchmarkMean} / 差值 ${item.delta} (${item.interpretation})`,
      );
    });
    if (report.benchmarkComparison.possibleDrivers.length) {
      lines.push(`- 可能驱动因素: ${report.benchmarkComparison.possibleDrivers.join('；')}`);
    }
  }

  return lines.join('\n');
};
