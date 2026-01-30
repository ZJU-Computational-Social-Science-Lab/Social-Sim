// frontend/store.ts
import { create } from 'zustand';
import {
  SimNode,
  Agent,
  LogEntry,
  Simulation,
  LLMConfig,
  ExperimentVariant,
  SimulationTemplate,
  TimeConfig,
  TimeUnit,
  Notification,
  SocialNetwork,
  SimulationReport,
  KnowledgeItem,
  GuideMessage,
  GuideActionType,
  EngineConfig,
  EngineMode
} from './types';

import { GoogleGenAI, Type } from "@google/genai";
import { createSimulation as createSimulationApi, getSimulation as getSimulationApi } from './services/simulations';
import {
  getTreeGraph,
  treeAdvanceChain,
  treeBranchPublic,
  getSimEvents,
  getSimState,
  treeDeleteSubtree,
  type Graph
} from './services/simulationTree';

import i18n from './i18n';

// ✅ 新增：使用新前端的 client（和 providers.ts 一致）
import { apiClient } from "./services/client";
// ✅ 新增：从设置里的 providers API 读取 provider 列表
import { Provider, listProviders } from "./services/providers";
import * as experimentsApi from './services/experiments';
import { useAuthStore } from './store/auth';
// Module-scope WebSocket handle to avoid duplicate connections
let _treeSocket: WebSocket | null = null;
let _treeSocketRefreshTimer: number | null = null;

interface AppState {
  // # Integration: Engine Config
  engineConfig: EngineConfig;
  setEngineMode: (mode: EngineMode) => void;

  // ✅ LLM Provider 状态（来自 设置 → LLM提供商）
  llmProviders: Provider[];
  currentProviderId: number | null;     // 当前激活 provider（如果有）
  selectedProviderId: number | null;    // 新建向导里选中的 provider
  loadProviders: () => Promise<void>;
  setSelectedProvider: (id: number | null) => void;

  simulations: Simulation[];
  currentSimulation: Simulation | null;
  nodes: SimNode[];
  selectedNodeId: string | null;

  // Templates #20
  savedTemplates: SimulationTemplate[];

  // Comparison State
  compareTargetNodeId: string | null;
  isCompareMode: boolean;
  comparisonSummary: string | null;
  comparisonUseLLM: boolean;
  setComparisonUseLLM: (v: boolean) => void;

  agents: Agent[];
  logs: LogEntry[];
  rawEvents: any[]; // 保存原始事件，用于导出时包含所有元数据

  // Notifications
  notifications: Notification[];
  addNotification: (type: 'success' | 'error' | 'info', message: string) => void;
  removeNotification: (id: string) => void;

  // #13 Guide Assistant State
  isGuideOpen: boolean;
  guideMessages: GuideMessage[];
  isGuideLoading: boolean;
  toggleGuide: (isOpen: boolean) => void;
  sendGuideMessage: (content: string) => Promise<void>;

  // UI State
  isWizardOpen: boolean;
  isHelpModalOpen: boolean;
  isAnalyticsOpen: boolean;
  isExportOpen: boolean;
  isExperimentDesignerOpen: boolean;
  isTimeSettingsOpen: boolean; // #9
  isSaveTemplateOpen: boolean; // #20
  isNetworkEditorOpen: boolean; // #22
  isReportModalOpen: boolean; // #14
  isGenerating: boolean;
  isGeneratingReport: boolean; // #14

  // Actions
  setSimulation: (sim: Simulation) => void;
  // Updated addSimulation to accept template data and time config
  addSimulation: (
    name: string,
    template: SimulationTemplate,
    customAgents?: Agent[],
    timeConfig?: TimeConfig
  ) => void;
  updateTimeConfig: (config: TimeConfig) => void; // #9
  saveTemplate: (name: string, description: string) => void; // #20
  deleteTemplate: (id: string) => void; // #20

  // #22 Social Network
  updateSocialNetwork: (network: SocialNetwork) => void;

  // #14 Report
  generateReport: () => Promise<void>;

  selectNode: (id: string) => void;
  setCompareTarget: (id: string | null) => void;
  toggleCompareMode: (isOpen: boolean) => void;

  toggleWizard: (isOpen: boolean) => void;
  toggleHelpModal: (isOpen: boolean) => void;
  toggleAnalytics: (isOpen: boolean) => void;
  toggleExport: (isOpen: boolean) => void;
  toggleExperimentDesigner: (isOpen: boolean) => void;
  toggleTimeSettings: (isOpen: boolean) => void; // #9
  toggleSaveTemplate: (isOpen: boolean) => void; // #20
  toggleNetworkEditor: (isOpen: boolean) => void; // #22
  toggleReportModal: (isOpen: boolean) => void; // #14

  // Host Actions #16
  injectLog: (type: LogEntry['type'], content: string, imageUrl?: string) => void; // #24 Updated signature
  updateAgentProperty: (agentId: string, property: string, value: any) => void;

  // #23 Knowledge Base Actions
  addKnowledgeToAgent: (agentId: string, item: KnowledgeItem) => void;
  removeKnowledgeFromAgent: (agentId: string, itemId: string) => void;

  // Simulation Control
  advanceSimulation: () => Promise<void>;
  branchSimulation: () => void;
  deleteNode: () => Promise<void>;
  runExperiment: (baseNodeId: string, name: string, variants: ExperimentVariant[]) => void;
  generateComparisonAnalysis: () => Promise<void>;
}

// --- Helpers for Time Calculation #9 ---
const isZh = () => (i18n.language || 'en').toLowerCase().startsWith('zh');
const getLocale = () => (isZh() ? 'zh-CN' : 'en-US');
const pickText = (en: string, zh: string) => (isZh() ? zh : en);

const addTime = (dateStr: string, value: number, unit: TimeUnit): string => {
  const date = new Date(dateStr);
  switch (unit) {
    case 'minute':
      date.setMinutes(date.getMinutes() + value);
      break;
    case 'hour':
      date.setHours(date.getHours() + value);
      break;
    case 'day':
      date.setDate(date.getDate() + value);
      break;
    case 'week':
      date.setDate(date.getDate() + value * 7);
      break;
    case 'month':
      date.setMonth(date.getMonth() + value);
      break;
    case 'year':
      date.setFullYear(date.getFullYear() + value);
      break;
  }
  return date.toISOString();
};

const formatWorldTime = (isoString: string) => {
  const date = new Date(isoString);
  return date.toLocaleString(getLocale(), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const DEFAULT_TIME_CONFIG: TimeConfig = {
  baseTime: new Date().toISOString(),
  unit: 'hour',
  step: 1
};

// Graph -> SimNode mapping helper
const mapGraphToNodes = (graph: Graph): SimNode[] => {
  const parentMap = new Map<number, number | null>();
  const childrenSet = new Set<number>();
  for (const edge of graph.edges) {
    parentMap.set(edge.to, edge.from);
    childrenSet.add(edge.from);
  }
  const root = graph.root;
  if (root != null && !parentMap.has(root)) parentMap.set(root, null);
  const running = new Set(graph.running || []);
  const nowIso = new Date().toISOString();
  const locale = getLocale();
  return graph.nodes.map((n) => {
    const pid = parentMap.has(n.id) ? parentMap.get(n.id)! : null;
    const isLeaf = !childrenSet.has(n.id);
    const meta = (n as any).meta || null;
    const displayName = isZh() ? `节点 ${n.id}` : `Node ${n.id}`;
    return {
      id: String(n.id),
      display_id: String(n.id),
      parentId: pid == null ? null : String(pid),
      name: displayName,
      depth: n.depth,
      isLeaf,
      status: running.has(n.id) ? 'running' : 'completed',
      timestamp: new Date().toLocaleTimeString(locale),
      worldTime: nowIso,
      meta
    };
  });
};

// ★ 后端事件 -> 前端 LogEntry 映射
const ACTION_LABELS: Record<'en' | 'zh', Record<string, string>> = {
  en: {
    look_around: 'Look around',
    move_to_location: 'Move to location',
    send_message: 'Send message',
    rest: 'Rest',
    yield: 'Yield'
  },
  zh: {
    look_around: '环顾四周',
    move_to_location: '移动到位置',
    send_message: '发送消息',
    gather_resource: '采集资源',
    rest: '休息',
    yield: '结束本轮发言'
  }
};

const translateActionName = (name: string | undefined): string => {
  if (!name) return pickText('Unknown action', '未知动作');
  const lang = isZh() ? 'zh' : 'en';
  return ACTION_LABELS[lang][name] || ACTION_LABELS.en[name] || name;
};

const normalizePlanMarkers = (text: string): string => {
  if (!text) return '';
  if (!isZh()) return text;
  let t = text;
  t = t.replace(/\[CURRENT\]/g, '[当前]');
  t = t.replace(/\[Done\]/gi, '[已完成]');
  t = t.replace(/\[DONE\]/g, '[已完成]');
  return t;
};

// 翻译 Agent 思考内容中的常见英文短语
const translateAgentContent = (text: string): string => {
  if (!text) return '';
  if (!isZh()) return text;
  let t = text;
  
  // 角色相关
  t = t.replace(/My role is (the )?/gi, '我的角色是');
  t = t.replace(/I am (the )?/gi, '我是');
  t = t.replace(/I'm (the )?/gi, '我是');
  t = t.replace(/focusing on/gi, '专注于');
  t = t.replace(/as (the )?/gi, '作为');
  t = t.replace(/\bthe Speaker\b/gi, '发言人');
  t = t.replace(/\bthe Moderator\b/gi, '主持人');
  t = t.replace(/\bthe Mayor\b/gi, '市长');
  t = t.replace(/\bthe Merchant\b/gi, '商人');
  t = t.replace(/\bSpeaker\b/gi, '发言人');
  t = t.replace(/\bModerator\b/gi, '主持人');
  
  // 目标和计划相关
  t = t.replace(/My (immediate )?focus is (to )?/gi, '我的（当前）重点是');
  t = t.replace(/My goal is (to )?/gi, '我的目标是');
  t = t.replace(/My goals? (are|is)/gi, '我的目标是');
  t = t.replace(/I need to/gi, '我需要');
  t = t.replace(/I will/gi, '我将');
  t = t.replace(/I should/gi, '我应该');
  t = t.replace(/I must/gi, '我必须');
  t = t.replace(/I plan to/gi, '我计划');
  t = t.replace(/I aim to/gi, '我旨在');
  t = t.replace(/This first turn is about/gi, '这第一轮是关于');
  t = t.replace(/to be ready for/gi, '为...做好准备');
  
  // 常见动词和短语
  t = t.replace(/\bensure\b/gi, '确保');
  t = t.replace(/\bfacilitate\b/gi, '促进');
  t = t.replace(/\bmaintain\b/gi, '维持');
  t = t.replace(/\bestablish\b/gi, '建立');
  t = t.replace(/\boutline\b/gi, '概述');
  t = t.replace(/\bguide\b/gi, '引导');
  t = t.replace(/\bsuccessfully\b/gi, '成功');
  t = t.replace(/\bconstructive\b/gi, '建设性的');
  t = t.replace(/\befficient\b/gi, '高效的');
  t = t.replace(/\bequitable\b/gi, '公平的');
  t = t.replace(/resource allocation/gi, '资源分配');
  t = t.replace(/decision-making/gi, '决策');
  t = t.replace(/\bdiscussions?\b/gi, '讨论');
  t = t.replace(/\bproceedings?\b/gi, '程序');
  t = t.replace(/order and decorum/gi, '秩序和礼仪');
  t = t.replace(/\bframework\b/gi, '框架');
  t = t.replace(/\bpriorities?\b/gi, '优先事项');
  t = t.replace(/\bproposals?\b/gi, '提案');
  t = t.replace(/\bdistribution\b/gi, '分配');
  t = t.replace(/\bvote\b/gi, '投票');
  t = t.replace(/city-related/gi, '城市相关的');
  t = t.replace(/city planning/gi, '城市规划');
  t = t.replace(/for the city/gi, '为城市');
  t = t.replace(/in all proceedings/gi, '在所有程序中');
  t = t.replace(/on a city-related matter/gi, '关于城市相关事务');
  
  // 描述性短语
  t = t.replace(/fair and knowledgeable/gi, '公平且知识渊博的');
  t = t.replace(/\bmoderator\b/gi, '主持人');
  t = t.replace(/towards productive outcomes/gi, '朝着富有成效的结果');
  t = t.replace(/all voices are heard/gi, '所有声音都被听到');
  t = t.replace(/upholding the integrity of/gi, '维护...的完整性');
  t = t.replace(/the integrity of/gi, '...的完整性');
  t = t.replace(/\bprocess\b/gi, '过程');
  t = t.replace(/Act as/gi, '充当');
  
  // 初始化相关
  t = t.replace(/\bInitialize\b/gi, '初始化');
  t = t.replace(/\binitial\b/gi, '初始');
  t = t.replace(/internal plan/gi, '内部计划');
  t = t.replace(/setting up/gi, '设置');
  t = t.replace(/ready for/gi, '准备好');
  t = t.replace(/\bupcoming\b/gi, '即将到来的');
  t = t.replace(/with goals, milestones, and strategy/gi, '包含目标、里程碑和策略');
  t = t.replace(/with relevant goals and milestones/gi, '包含相关目标和里程碑');
  
  // 策略相关
  t = t.replace(/\bStrategy\b/gi, '策略');
  t = t.replace(/\bMilestones?\b/gi, '里程碑');
  t = t.replace(/\bGoals?\b/gi, '目标');
  t = t.replace(/Successfully/gi, '成功');
  t = t.replace(/Guide at least one/gi, '引导至少一次');
  
  // 当前标记
  t = t.replace(/\[当前\]/g, '[当前]');
  t = t.replace(/\[Current\]/gi, '[当前]');
  t = t.replace(/\[CURRENT\]/g, '[当前]');
  
  return t;
};

// 去除 Action XML 及残留标签，防止日志里出现原始 XML 片段
const stripActionXml = (raw: string): string => {
  if (!raw) return '';
  let t = raw;
  // 删除完整的 <Action>...</Action> 块以及自闭合 Action
  t = t.replace(/<Action[\s\S]*?<\/Action>/gi, '');
  t = t.replace(/<Action[^>]*\/>/gi, '');
  // 删除常见的多余 message 标签（LLM 输出异常时可能出现）
  t = t.replace(/<\/?(message|messages|youshould_send_message)[^>]*>/gi, '');
  // 删除残余的 XML 标签（保留纯文本）
  t = t.replace(/<[^>]+>/g, '');
  return t.trim();
};

const prettifyAssistantCtx = (content: string): string => {
  if (!content) return '';
  const cleaned = stripActionXml(content);

  const thoughtsMatch = cleaned.match(/--- Thoughts ---\s*([\s\S]*?)\s*--- Plan ---/);
  const planMatch = cleaned.match(/--- Plan ---\s*([\s\S]*?)(?:\n--- Action ---|\n--- Plan Update ---|\n--- Emotion Update ---|\s*$)/);

  const rawThoughts = thoughtsMatch && thoughtsMatch[1] ? thoughtsMatch[1].trim() : '';
  const rawPlan = planMatch && planMatch[1] ? planMatch[1].trim() : '';

  // 先标准化标记，再翻译内容
  const normalizedThoughts = normalizePlanMarkers(rawThoughts);
  const normalizedPlan = normalizePlanMarkers(rawPlan);
  
  const thoughts = translateAgentContent(normalizedThoughts);
  const plan = translateAgentContent(normalizedPlan);

  if (!thoughts && !plan) {
    const normalized = normalizePlanMarkers(cleaned);
    return translateAgentContent(normalized);
  }

  let out = '';
  if (thoughts) {
    out += `【思考】\n${thoughts}`;
  }
  if (plan) {
    if (out) out += '\n\n';
    out += `【计划】\n${plan}`;
  }
  return out;
};

const translateEnvText = (content: string): string => {
  if (!content) return '';
  let text = content;
  text = text.replace('[0:00] Status:', '[0:00] 状态:');
  text = text.replace('--- Status ---', '--- 状态 ---');
  text = text.replace('Current position:', '当前位置:');
  text = text.replace('Hunger level:', '饥饿值:');
  text = text.replace('Energy level:', '能量值:');
  text = text.replace('Inventory:', '物品栏:');
  text = text.replace('Current time:', '当前时间:');
  // 通用环境句子
  text = text.replace(/You are at\s*/g, '你现在位于 ');
  text = text.replace(/You arrived at\s*/g, '你到达了 ');
  text = text.replace(/Nearby agents:/g, '附近的智能体:');
  text = text.replace(/plain\b/g, '平原');
  text = text.replace('[Message]', '[消息]');
  return text;
};

export const mapBackendEventsToLogs = (
  events: any[],
  nodeId: string,
  round: number,
  agents: Agent[],
  includeAllMetadata: boolean = false // 导出时设为 true，包含所有元数据事件
): LogEntry[] => {
  const nowIso = new Date().toISOString();
  const nameToId = new Map<string, string>();
  agents.forEach(a => nameToId.set(a.name, a.id));

  return (events || []).map((ev: any, i: number): LogEntry | null => {
    const base: LogEntry = {
      id: `srv-${Date.now()}-${i}`,
      nodeId,
      round,
      type: 'SYSTEM',
      content: '',
      timestamp: nowIso
    };

    // 字符串事件直接当系统事件
    if (typeof ev === 'string') {
      return { ...base, type: 'SYSTEM', content: ev };
    }
    if (!ev || typeof ev !== 'object') {
      return { ...base, type: 'SYSTEM', content: String(ev) };
    }

    const evType = ev.type || ev.event_type;
    const data = ev.data || {};
    const separator = isZh() ? '，' : ', ';
    const labels = {
      reasoningStep: (step: number) =>
        pickText(`Starting step ${step} reasoning`, `开始第 ${step} 步推理`),
      reasoningStart: pickText('Starting reasoning', '开始推理'),
      reasoningDone: pickText('Reasoning complete', '完成推理'),
      actionPrefix: pickText('Action', '动作'),
      yieldTurn: pickText('Yielded the floor', '结束本轮发言'),
      planUpdate: pickText('Plan updated', '更新计划'),
      agentError: pickText('Agent error', '智能体发生错误'),
      actionStart: pickText('Started action', '开始执行动作'),
      actionEnd: pickText('performed action', '执行了动作'),
      systemEvent: pickText('System event', '系统事件')
    };

    // 智能体上下文增量
    if (evType === 'agent_ctx_delta') {
      const raw =
        typeof data.content === 'string'
          ? data.content
          : '';
      const role = String(data.role || '').toLowerCase();
      const agentName: string = data.agent || '';
      const agentId = agentName ? nameToId.get(agentName) : undefined;

      // 环境/状态反馈：做简单的中文翻译（保持为 SYSTEM，因为这是环境反馈）
      if (role === 'user') {
        // 检查是否是广播消息或公共事件，如果是则跳过
        // 因为 system_broadcast 事件会统一显示消息内容，避免重复
        const isBroadcastMessage = /\[(Message|消息)\]\s*[^:]+:/.test(raw);
        const isPublicEvent = /Public Event:|公共事件[:：]/.test(raw);
        if (isBroadcastMessage || isPublicEvent) {
          // 返回 null 标记，后续会被过滤掉
            return null as any;
        }
        const text = translateEnvText(raw);
        return {
          ...base,
          type: 'SYSTEM',
          content: text || `[环境反馈] ${agentName || ''}`
        };
      }

      // LLM 回复：提取思考/计划，隐藏 Action XML（使用 AGENT_METADATA，显示 Agent 名字）
      if (role === 'assistant') {
        const pretty = prettifyAssistantCtx(raw);
        return {
          ...base,
          type: 'AGENT_METADATA',
          agentId,
          content: pretty || raw || `[智能体回复] ${agentName || ''}`
        };
      }

      return {
        ...base,
        type: 'SYSTEM',
        content: raw || `[agent_ctx_delta] ${agentName || ''}`
      };
    }

    // 智能体推理开始 / 结束 - 导出时包含，显示时过滤
    if (evType === 'agent_process_start') {
      if (!includeAllMetadata) {
        return null as any;
      }
      const agentName: string = data.agent || '';
      const agentId = agentName ? nameToId.get(agentName) : undefined;
      const step = data.step != null ? Number(data.step) : NaN;
      const label = Number.isFinite(step)
        ? labels.reasoningStep(step)
        : labels.reasoningStart;
      return { 
        ...base, 
        type: 'AGENT_METADATA', 
        agentId,
        content: label 
      };
    }

    if (evType === 'agent_process_end') {
      if (!includeAllMetadata) {
        return null as any;
      }
      const agentName: string = data.agent || '';
      const agentId = agentName ? nameToId.get(agentName) : undefined;
      const step = data.step != null ? Number(data.step) : NaN;
      const actions = Array.isArray(data.actions) ? data.actions : [];
      const rawNames = actions
        .map((a: any) => a?.action || a?.name)
        .filter(Boolean) as string[];
      const actionNames = rawNames
        .map((n) => translateActionName(n))
        .filter(Boolean)
        .join(' / ');
      const labelParts: string[] = [];
      if (Number.isFinite(step)) {
        labelParts.push(pickText(`Step ${step} finished`, `第 ${step} 步结束`));
      }

      // 如果唯一动作是 yield，则用中文说明结束发言，忽略英文 summary
      const isPureYield = rawNames.length === 1 && rawNames[0] === 'yield';
      if (!isPureYield && actionNames) {
        labelParts.push(`${labels.actionPrefix}: ${actionNames}`);
      }

      const label = labelParts.length 
        ? labelParts.join(separator)
        : labels.reasoningDone;

      if (isPureYield) {
        return {
          ...base,
          type: 'AGENT_METADATA',
          agentId,
          content: labels.yieldTurn
        };
      }

      return { 
        ...base, 
        type: 'AGENT_METADATA', 
        agentId,
        content: label 
      };
    }

    // 动作开始：导出时包含，显示时过滤（yield 除外，yield 显示为 AGENT_METADATA）
    if (evType === 'action_start') {
      const agentName: string = data.agent || '';
      const actionData = data.action || {};
      const rawName: string = actionData.action || actionData.name || 'unknown';
      const actionName: string = translateActionName(rawName);
      const agentId = agentName ? nameToId.get(agentName) : undefined;

      // 对于 yield，使用 AGENT_METADATA 类型，显示 Agent 名字
      if (rawName === 'yield') {
        return {
          ...base,
          type: 'AGENT_METADATA',
          agentId,
          content: labels.yieldTurn
        };
      }

      // 非 yield 的 action_start：显示时过滤，导出时保留
      if (!includeAllMetadata) {
        return null as any;
      }

      return {
        ...base,
        type: 'AGENT_ACTION',
        agentId,
        content: agentName
          ? `${agentName} ${labels.actionStart} ${actionName}`
          : `${labels.actionStart} ${actionName}`
      };
    }

    // 计划更新事件：导出时包含，显示时过滤
    if (evType === 'plan_update') {
      if (!includeAllMetadata) {
        return null as any;
      }
      const agentName: string = data.agent || '';
      const agentId = agentName ? nameToId.get(agentName) : undefined;
      const kind: string = data.kind || '';
      const label = labels.planUpdate + (kind ? pickText(` (${kind})`, `（${kind}）`) : '');
      return { 
        ...base, 
        type: 'AGENT_METADATA', 
        agentId,
        content: label 
      };
    }

    // 错误事件：提取错误信息
    if (evType === 'agent_error') {
      const agentName: string = data.agent || '';
      const kind: string = data.kind || '';
      const errText: string = String(
        data.error || data.message || ''
      ).slice(0, 400);
      const agentLabel = agentName || pickText('Unknown', '未知');
      const baseLabel = isZh()
        ? `智能体「${agentLabel}」发生错误`
        : `Agent "${agentLabel}" error`;
      const label =
        baseLabel +
        (kind ? pickText(` (${kind})`, `（${kind}）`) : '') +
        (errText ? pickText(`: ${errText}`, `：${errText}`) : '');
      return { ...base, type: 'SYSTEM', content: label };
    }

    // 公共广播 / 环境事件
    if (evType === 'system_broadcast' || evType === 'public_event') {
      const text = data.text || data.message || JSON.stringify(ev);
      const senderName: string = data.sender || '';
      const eventType: string = data.type || '';
      
      // 优先检查事件类型
      if (eventType === 'TalkToEvent' && senderName) {
        const agentId = senderName ? nameToId.get(senderName) : undefined;
        return { ...base, type: 'AGENT_SAY', agentId, content: text };
      }
      
      // 检查是否是 TalkToEvent（格式："[time] sender to recipient: message"）
      // 使用更宽松的正则，支持中文字符和多个单词的发送者/接收者名字
      const talkToMatch = text.match(/^\[[^\]]+\]\s*([^t]+?)\s+to\s+([^:]+?):\s*(.+)$/);
      if (talkToMatch) {
        const talkToSender = talkToMatch[1].trim();
        const agentId = talkToSender ? nameToId.get(talkToSender) : undefined;
        if (agentId) {
          return { ...base, type: 'AGENT_SAY', agentId, content: text };
        }
      }
      
      // 检查是否是消息广播（MessageEvent），显示为 AGENT_SAY 类型
      const isMessageEvent = eventType === 'MessageEvent' || /\[(Message|消息)\]\s*[^:]+:/.test(text);
      if (isMessageEvent && senderName) {
        const agentId = senderName ? nameToId.get(senderName) : undefined;
        return { ...base, type: 'AGENT_SAY', agentId, content: text };
      }
      
      return { ...base, type: 'ENVIRONMENT', content: text };
    }

    // 动作结束事件：只保留非 send_message/say 的动作，过滤掉消息类动作
    if (evType === 'action_end') {
      const actorName: string =
        data.actor || data.agent || data.name || '';
      const actionData = data.action || {};
      const actionName: string =
        actionData.action || actionData.name || '';

      const agentId = actorName ? nameToId.get(actorName) : undefined;
      const isSpeech =
        actionName === 'send_message' || actionName === 'say';

      // 过滤掉 send_message 和 say 类型的动作（这些会通过 system_broadcast 显示）
      if (isSpeech) {
        return null as any;
      }

      // 为避免英文 summary 混入，这里不使用后端提供的 summary/message，只用模板
      const readableAction = translateActionName(actionName);
      const label = actorName
        ? `${actorName} ${labels.actionEnd} ${readableAction}`
        : `${pickText('Performed action', '执行了动作')} ${readableAction}`;

      return {
        ...base,
        type: 'AGENT_ACTION',
        agentId,
        content: label
      };
    }

    // 其它类型，作为 SYSTEM 的简短描述展示
    const text = data.text || data.message || evType || labels.systemEvent;
    return { ...base, type: 'SYSTEM', content: text };
  }).filter((entry): entry is LogEntry => entry !== null);
};

const generateNodes = (): SimNode[] => {
  const now = new Date();
  const startTime = now.toISOString();

  const nodes: SimNode[] = [
    {
      id: 'root',
      display_id: '0',
      parentId: null,
      name: pickText('Initial state', '初始状态'),
      depth: 0,
      isLeaf: true,
      status: 'completed',
      timestamp: new Date().toLocaleTimeString(getLocale()),
      worldTime: startTime
    }
  ];
  return nodes;
};

const generateHistory = (rounds: number, start: number, variance: number): number[] => {
  const data = [start];
  let current = start;
  for (let i = 1; i < rounds; i++) {
    const change = (Math.random() - 0.5) * variance;
    current = Math.max(0, Math.min(100, Math.round(current + change)));
    data.push(current);
  }
  return data;
};

const generateAgents = (templateType: string, defaultModel: LLMConfig): Agent[] => {
  if (templateType === 'council') {
    return Array.from({ length: 5 }).map((_, i) => ({
      id: `c${i + 1}`,
      name: i === 0 ? '议长' : `议员 ${String.fromCharCode(65 + i - 1)}`,
      role: i === 0 ? 'Chairman' : 'Council Member',
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=council${i}`,
      profile: '议会成员，负责决策城市规划与资源分配。',
      llmConfig: defaultModel,
      properties: { 影响力: 50 + Math.floor(Math.random() * 40), 倾向: i % 2 === 0 ? '保守' : '激进', 压力值: 20 },
      history: {
        影响力: generateHistory(10, 50, 10),
        压力值: generateHistory(10, 20, 15)
      },
      memory: [],
      knowledgeBase: []
    }));
  }


    // DEV helper: expose the zustand simulation store to the browser console for debugging
    // Usage in DevTools: `window.__SIM_STORE__.getState()` or `window.__SIM_STORE__.getState().nodes`
    try {
      const isLocal = typeof window !== 'undefined' && window.location && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      if (import.meta.env.DEV || isLocal) {
        (window as any).__SIM_STORE__ = (window as any).__SIM_STORE__ || useSimulationStore;
      }
    } catch (err) {
      // ignore in constrained runtimes
    }

  if (templateType === 'werewolf') {
    const roles = ['法官', '预言家', '女巫', '猎人', '狼人', '狼人', '平民', '平民', '平民'];
    return roles.map((role, i) => ({
      id: `w${i + 1}`,
      name: i === 0 ? 'God' : `玩家 ${i}`,
      role,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=werewolf${i}`,
      profile: `本局游戏身份为${role}。`,
      llmConfig: defaultModel,
      properties: { 存活状态: 1, 嫌疑度: 10 },
      history: {
        嫌疑度: generateHistory(10, 10, 20)
      },
      memory: [],
      knowledgeBase: []
    }));
  }

  return [
    {
      id: 'a1',
      name: '村长爱丽丝',
      role: '村长',
      avatarUrl: 'https://picsum.photos/200/200',
      profile:
        '一位务实的领导者，专注于村庄的稳定。她优先考虑共识，但有时会显得优柔寡断。',
      llmConfig: defaultModel,
      properties: { 信任值: 85, 压力值: 40, 资金: 1200 },
      history: {
        信任值: [80, 82, 85, 84, 88, 85, 83, 85, 86, 85],
        压力值: [20, 25, 30, 45, 40, 38, 42, 40, 35, 40],
        资金: [1000, 1100, 1150, 1100, 1200, 1180, 1250, 1200, 1200, 1200]
      },
      memory: [],
      knowledgeBase: []
    },
    {
      id: 'a2',
      name: '商人鲍勃',
      role: '商人',
      avatarUrl: 'https://picsum.photos/201/201',
      profile: '一个雄心勃勃的商人，唯利是图。他经常推动放松管制。',
      llmConfig: { provider: 'Anthropic', model: 'claude-4-5-sonnet' },
      properties: { 信任值: 45, 压力值: 20, 资金: 5000 },
      history: {
        信任值: [50, 48, 45, 40, 42, 45, 44, 45, 46, 45],
        压力值: [10, 12, 15, 15, 18, 20, 22, 20, 18, 20],
        资金: [4000, 4200, 4500, 4800, 4700, 4900, 5000, 5100, 5000, 5000]
      },
      memory: [
        {
          id: 'm100',
          round: 1,
          type: 'dialogue',
          content: '税收太高了，爱丽丝！这样生意没法做。',
          timestamp: '10:05'
        }
      ],
      knowledgeBase: []
    }
  ];
};

// 社会学实验代理生成函数
const generateNormDisruptionAgents = (defaultModel: LLMConfig): Agent[] => {
  // 社会规范的突变：20个具有不同职业和性格的代理
  const professions = ['教师', '商人', '医生', '警察', '农民', '工人', '管理员', '艺术家', '记者', '律师'];
  const personalities = ['保守', '开放', '理性', '感性', '叛逆', '顺从', '社交', '内向', '乐观', '悲观'];
  
  return Array.from({ length: 20 }).map((_, i) => {
    const profession = professions[i % professions.length];
    const personality = personalities[i % personalities.length];
    return {
      id: `norm_${i + 1}`,
      name: `${profession}${String.fromCharCode(65 + (i % 20))}`,
      role: profession,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=norm${i}`,
      profile: `${profession}，性格${personality}。在面对新规范时倾向于${personality === '保守' ? '谨慎遵守' : personality === '叛逆' ? '主动反抗' : '观察他人'}。`,
      llmConfig: defaultModel,
      properties: { 
        规范遵守度: 50 + Math.floor(Math.random() * 40),
        社会地位: 30 + Math.floor(Math.random() * 50),
        反抗倾向: 20 + Math.floor(Math.random() * 60)
      },
      history: {},
      memory: [],
      knowledgeBase: []
    };
  });
};

const generatePolicyDiffusionAgents = (defaultModel: LLMConfig): Agent[] => {
  // 政策传播中的意义磨损：层级制组织（政府→社区→居民）
  return [
    // 顶层：政策制定者（3个）
    ...Array.from({ length: 3 }).map((_, i) => ({
      id: `policy_top_${i + 1}`,
      name: `政策官员${i + 1}`,
      role: '政策制定者',
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=policy_top${i}`,
      profile: '政府部门的高级官员，负责制定宏观政策。相信政策是科学合理的，但往往忽视基层现实。',
      llmConfig: defaultModel,
      properties: { 官级: 90, 意识形态强度: 80, 现实理解度: 30 },
      history: {},
      memory: [],
      knowledgeBase: []
    })),
    // 中层：执行官员（7个）
    ...Array.from({ length: 7 }).map((_, i) => ({
      id: `policy_mid_${i + 1}`,
      name: `社区主管${i + 1}`,
      role: '中层执行官',
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=policy_mid${i}`,
      profile: '社区管理者，处于上下级之间的压力。既要向上级交代，也要应对基层的现实困难。',
      llmConfig: defaultModel,
      properties: { 官级: 50, 灵活性: 60 + Math.floor(Math.random() * 30), 个人利益驱动: 40 },
      history: {},
      memory: [],
      knowledgeBase: []
    })),
    // 基层：居民代表（10个）
    ...Array.from({ length: 10 }).map((_, i) => ({
      id: `policy_base_${i + 1}`,
      name: `居民${i + 1}`,
      role: '基层接收者',
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=policy_base${i}`,
      profile: '普通居民，直接受政策影响。更关心实际利益而非理想主义。',
      llmConfig: defaultModel,
      properties: { 官级: 10, 实用性: 80, 对官僚的不信任度: 50 + Math.floor(Math.random() * 40) },
      history: {},
      memory: [],
      knowledgeBase: []
    }))
  ];
};

const generatePolarizationAgents = (defaultModel: LLMConfig): Agent[] => {
  // 极化与数字茧房：两个极端立场 + 中立者 + 推荐算法
  return [
    // 激进派（8个）
    ...Array.from({ length: 8 }).map((_, i) => ({
      id: `polar_radical_${i + 1}`,
      name: `激进者${i + 1}`,
      role: '激进派',
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=radical${i}`,
      profile: '信念坚定，对立场敏感。容易被同立场的内容激怒。',
      llmConfig: defaultModel,
      properties: { 
        立场强度: 85 + Math.floor(Math.random() * 15),
        情绪易激怒度: 70 + Math.floor(Math.random() * 25),
        包容度: 20 + Math.floor(Math.random() * 20),
        接收度: 0
      },
      history: {},
      memory: [],
      knowledgeBase: []
    })),
    // 保守派（8个）
    ...Array.from({ length: 8 }).map((_, i) => ({
      id: `polar_conservative_${i + 1}`,
      name: `保守者${i + 1}`,
      role: '保守派',
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=conservative${i}`,
      profile: '立场传统，对变化持谨慎态度。',
      llmConfig: defaultModel,
      properties: { 
        立场强度: 75 + Math.floor(Math.random() * 20),
        情绪易激怒度: 60 + Math.floor(Math.random() * 30),
        包容度: 30 + Math.floor(Math.random() * 20),
        接收度: 100
      },
      history: {},
      memory: [],
      knowledgeBase: []
    })),
    // 中立者（4个）
    ...Array.from({ length: 4 }).map((_, i) => ({
      id: `polar_neutral_${i + 1}`,
      name: `中立者${i + 1}`,
      role: '中立派',
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=neutral${i}`,
      profile: '倾向于平衡考虑，但容易受信息流影响。',
      llmConfig: defaultModel,
      properties: { 
        立场强度: 30 + Math.floor(Math.random() * 30),
        情绪易激怒度: 40 + Math.floor(Math.random() * 30),
        包容度: 60 + Math.floor(Math.random() * 30),
        接收度: 50
      },
      history: {},
      memory: [],
      knowledgeBase: []
    }))
  ];
};

const generateResourceScarcityAgents = (defaultModel: LLMConfig): Agent[] => {
  // 稀缺资源压力下的社会契约演化：灾后社区（20个）
  const roles = ['医生', '军人', '商贩', '教师', '工程师', '农民', '老人', '儿童监护人', '牧师', '黑市商人'];
  
  return Array.from({ length: 20 }).map((_, i) => {
    const role = roles[i % roles.length];
    const trustLevel = i % 3 === 0 ? 80 : i % 3 === 1 ? 50 : 20; // 三分之一高信用，三分之一中等，三分之一低
    return {
      id: `scarcity_${i + 1}`,
      name: `${role}${String.fromCharCode(65 + (i % 20))}`,
      role,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=scarcity${i}`,
      profile: `${role}。在灾难中${trustLevel > 70 ? '因为职业受信任' : trustLevel > 40 ? '信用中等' : '信用低下或被怀疑'}。`,
      llmConfig: defaultModel,
      properties: { 
        社会资本: trustLevel + Math.floor(Math.random() * 20 - 10),
        诚实度: 50 + Math.floor(Math.random() * 50),
        绝望指数: 50 + Math.floor(Math.random() * 40),
        资源占有: 10 + Math.floor(Math.random() * 30),
        欺诈倾向: 100 - trustLevel + Math.floor(Math.random() * 30)
      },
      history: {},
      memory: [],
      knowledgeBase: []
    };
  });
};

const getSystemTemplates = (): SimulationTemplate[] => {
  try {
    return [
      {
        id: 'norm_disruption',
        name: '社会规范的突变',
        description: '常人方法论视角：20个异质代理在突发规范变化中的意义构建与适应。观察从服从→反抗→黑市协议的演化轨迹。',
        category: 'system',
        sceneType: 'village',
        agents: generateNormDisruptionAgents({ provider: 'OpenAI', model: 'gpt-4o' }),
        defaultTimeConfig: DEFAULT_TIME_CONFIG
      },
      {
        id: 'policy_diffusion',
        name: '政策传播中的意义磨损',
        description: '街头官僚制视角：模拟三层级组织(政府→社区→居民)中政策的重构与异化。验证底层逻辑如何消解宏观规划。',
        category: 'system',
        sceneType: 'village',
        agents: generatePolicyDiffusionAgents({ provider: 'OpenAI', model: 'gpt-4o' }),
        defaultTimeConfig: DEFAULT_TIME_CONFIG
      },
      {
        id: 'polarization',
        name: '极化与数字茧房生成',
        description: '回声壁效应视角：20个代理（8激进+8保守+4中立）在推荐算法驱动下的观点极化与群体分裂。追踪情绪传染机制。',
        category: 'system',
        sceneType: 'village',
        agents: generatePolarizationAgents({ provider: 'OpenAI', model: 'gpt-4o' }),
        defaultTimeConfig: DEFAULT_TIME_CONFIG
      },
      {
        id: 'resource_scarcity',
        name: '稀缺资源下的社会契约',
        description: '霍布斯丛林视角：灾后社区中，拥有社会资本的代理能否通过信用契约度过危机，还是陷入大规模欺诈与崩溃？',
        category: 'system',
        sceneType: 'village',
        agents: generateResourceScarcityAgents({ provider: 'OpenAI', model: 'gpt-4o' }),
        defaultTimeConfig: DEFAULT_TIME_CONFIG
      },
      {
        id: 'village',
        name: '乡村治理',
        description: '适用于乡村治理的标准预设场景。',
        category: 'system',
        sceneType: 'village',
        agents: [],
        defaultTimeConfig: {
          baseTime: new Date().toISOString(),
          unit: 'day',
          step: 1
        }
      },
      {
        id: 'council',
        name: '议事会',
        description: '5人议会决策模拟。',
        category: 'system',
        sceneType: 'council',
        agents: [],
        defaultTimeConfig: {
          baseTime: new Date().toISOString(),
          unit: 'hour',
          step: 2
        }
      },
      {
        id: 'werewolf',
        name: '狼人杀',
        description: '9人标准狼人杀局。',
        category: 'system',
        sceneType: 'werewolf',
        agents: [],
        defaultTimeConfig: {
          baseTime: new Date().toISOString(),
          unit: 'minute',
          step: 30
        }
      },
      {
        id: 'village_trust',
        name: '乡村信任度测试',
        description: '带有基础信任属性的乡村治理实验模板。',
        category: 'system',
        sceneType: 'village',
        agents: generateAgents('village', { provider: 'OpenAI', model: 'gpt-4o' }),
        defaultTimeConfig: DEFAULT_TIME_CONFIG
      },
      {
        id: 'council_transparency',
        name: '议事会信息透明度',
        description: '用于比较议会中信息透明度差异的模板。',
        category: 'system',
        sceneType: 'council',
        agents: generateAgents('council', { provider: 'OpenAI', model: 'gpt-4o' }),
        defaultTimeConfig: DEFAULT_TIME_CONFIG
      },
      {
        id: 'werewolf_balance',
        name: '狼人杀阵营平衡',
        description: '标准 9 人配置，便于进行阵营平衡实验。',
        category: 'system',
        sceneType: 'werewolf',
        agents: generateAgents('werewolf', { provider: 'OpenAI', model: 'gpt-4o' }),
        defaultTimeConfig: DEFAULT_TIME_CONFIG
      }
    ];
  } catch (e) {
    console.error('[ERROR] Failed to generate system templates:', e);
    // 降级返回空模板列表
    return [];
  }
};

const generateLogs = (): LogEntry[] =>
  Array.from({ length: 20 }).map((_, i) => {
    let nodeId = 'root';
    if (i > 2) nodeId = 'n1';
    if (i > 8) nodeId = 'n2';

    return {
      id: `l${i}`,
      nodeId,
      round: nodeId === 'root' ? 0 : nodeId === 'n1' ? 1 : 2,
      type:
        i % 4 === 0
          ? 'SYSTEM'
          : i % 4 === 1
          ? 'AGENT_SAY'
          : i % 4 === 2
          ? 'AGENT_ACTION'
          : 'ENVIRONMENT',
      agentId:
        i % 4 === 1 || i % 4 === 2 ? (i % 2 === 0 ? 'a1' : 'a2') : undefined,
      content:
        i % 4 === 0
          ? pickText(
              `System advanced to round ${
                nodeId === 'root' ? 0 : nodeId === 'n1' ? 1 : 2
              }`,
              `系统推进至第 ${
                nodeId === 'root' ? 0 : nodeId === 'n1' ? 1 : 2
              } 回合`
            )
          : pickText('An interaction occurred.', '进行了一次交互。'),
      timestamp: `2025-03-10 10:${10 + i}`
    };
  });

// === 下面 Gemini 相关 Helper 保持不变（保持你原来的实现） ===

// fetchGeminiLogs / fetchReportWithGemini / 其它 helper ...

// ⚠️ 这里是关键：用后端 + provider 生成智能体，不再直接在前端调 Gemini
export const generateAgentsWithAI = async (
  count: number,
  description: string,
  providerId?: number | null
): Promise<Agent[]> => {
  const body: any = { count, description };
  if (providerId != null) {
    body.provider_id = providerId;
  }

  const res = await apiClient.post("/llm/generate_agents", body);
  const rawAgents: any[] = Array.isArray(res.data)
    ? res.data
    : Array.isArray(res.data?.agents)
    ? res.data.agents
    : [];

  return rawAgents.map((a: any, index: number) => ({
    id: a.id || `gen_${Date.now()}_${index}`,
    name: a.name,
    role: a.role || "角色",
    avatarUrl:
      a.avatarUrl ||
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
        a.name || `agent_${index}`
      )}`,
    profile: a.profile || "暂无描述",
    llmConfig: {
      provider: a.provider || "backend",
      model: a.model || "default"
    },
    properties: a.properties || {},
    history: a.history || {},
    memory: a.memory || [],
    knowledgeBase: a.knowledgeBase || []
  }));
};

// AgentTorch Integration: Demographic-based agent generation
export async function generateAgentsWithDemographics(
  totalAgents: number,
  demographics: { name: string; categories: string[] }[],
  archetypeProbabilities: Record<string, number>,
  traits: { name: string; min: number; max: number }[],
  language: string,
  providerId?: string | number
): Promise<Agent[]> {
  const body = {
    total_agents: totalAgents,
    demographics,
    archetype_probabilities: archetypeProbabilities,
    traits,
    language: language,
    provider_id: providerId != null ? Number(providerId) : undefined
  };

  const res = await apiClient.post("/llm/generate_agents_demographics", body);
  
  const rawAgents: any[] = Array.isArray(res.data)
    ? res.data
    : Array.isArray(res.data?.agents)
    ? res.data.agents
    : [];

  return rawAgents.map((a: any, index: number) => ({
    id: a.id || `gen_${Date.now()}_${index}`,
    name: a.name,
    role: a.role || "角色",
    avatarUrl:
      a.avatarUrl ||
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
        a.name || `agent_${index}`
      )}`,
    profile: a.profile || "暂无描述",
    llmConfig: {
      provider: a.provider || "backend",
      model: a.model || "default"
    },
    properties: a.properties || {},
    history: a.history || {},
    memory: a.memory || [],
    knowledgeBase: a.knowledgeBase || []
  }));
}



// #12 Helper for Environment Suggestions
export const fetchEnvironmentSuggestions = async (
  logs: LogEntry[], 
  agents: Agent[]
): Promise<Array<{event: string, reason: string}>> => {
  if (!process.env.API_KEY) throw new Error("No API Key");
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const recentLogs = logs.slice(-15).map(l => `[${l.type}] ${l.content}`).join('\n');
  const agentSummary = agents.map(a => `${a.name}(${a.role})`).join(', ');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Based on the recent simulation logs, suggest 3 potential environment events that could happen next to drive the narrative or challenge the agents.
      
      Recent Logs:
      ${recentLogs}
      
      Agents involved: ${agentSummary}`,
      config: {
        systemInstruction: "You are a dynamic environment simulator. Propose realistic or dramatic environmental changes.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              event: { type: Type.STRING, description: "The description of the event" },
              reason: { type: Type.STRING, description: "Why this event fits the current context" }
            },
            required: ["event", "reason"]
          }
        }
      }
    });
    
    return response.text ? JSON.parse(response.text) : [];
  } catch (error) {
    console.error("Gemini Env Suggestion Error:", error);
    throw error;
  }
};

export const useSimulationStore = create<AppState>((set, get) => ({
  // # Integration Config
  engineConfig: {
    mode: 'standalone',
    endpoint: (import.meta as any).env?.VITE_API_BASE || '/api',
    status: 'disconnected',
    token: (import.meta as any).env?.VITE_API_TOKEN || undefined
  },

  // ✅ provider 初始状态
  llmProviders: [],
  currentProviderId: null,
  selectedProviderId: null,

  loadProviders: async () => {
    try {
      const providers = await listProviders();
      const current =
        providers.find((p) => p.is_active || p.is_default) || providers[0] || null;

      set({
        llmProviders: providers,
        currentProviderId: current ? current.id : null,
        selectedProviderId: current ? current.id : null
      });
    } catch (e) {
      console.error("加载 LLM 提供商失败", e);
    }
  },

  setSelectedProvider: (id) => set({ selectedProviderId: id }),
  setComparisonUseLLM: (v: boolean) => set({ comparisonUseLLM: v }),

  simulations: [
    {
      id: 'sim1',
      name: '2024年乡村委员会模拟',
      templateId: 'village',
      status: 'active',
      createdAt: '2024-03-10',
      timeConfig: DEFAULT_TIME_CONFIG,
      socialNetwork: {}
    }
  ],
  currentSimulation: {
    id: 'sim1',
    name: '2024年乡村委员会模拟',
    templateId: 'village',
    status: 'active',
    createdAt: '2024-03-10',
    timeConfig: DEFAULT_TIME_CONFIG,
    socialNetwork: {}
  },
  nodes: generateNodes(),
  selectedNodeId: 'n2',
  savedTemplates: getSystemTemplates(),

  compareTargetNodeId: null,
  isCompareMode: false,
  comparisonSummary: null,
  comparisonUseLLM: false,

  agents: generateAgents('village', { provider: 'OpenAI', model: 'gpt-4o' }),
  logs: generateLogs(),
  rawEvents: [], // 保存原始事件，用于导出时包含所有元数据
  notifications: [],

  // #13 Guide State（保持原样）
  isGuideOpen: false,
  isGuideLoading: false,
  guideMessages: [
    {
      id: 'g-init',
      role: 'assistant',
      content:
        '你好！我是SocialSim4的智能指引助手。我可以帮你设计实验、推荐功能或解释平台操作。比如，你可以问我：\n\n- "如何模拟信息在人群中的传播？"\n- "我想做一个AB测试实验。"\n- "怎么导出分析报告？"'
    }
  ],

  isWizardOpen: false,
  isHelpModalOpen: false,
  isAnalyticsOpen: false,
  isExportOpen: false,
  isExperimentDesignerOpen: false,
  isTimeSettingsOpen: false,
  isSaveTemplateOpen: false,
  isNetworkEditorOpen: false,
  isReportModalOpen: false,
  isGenerating: false,
  isGeneratingReport: false,

  // 手动同步 UI 状态
  isSyncModalOpen: false,
  isSyncing: false,
  syncLogs: [] as string[],
  openSyncModal: () => set({ isSyncModalOpen: true }),
  closeSyncModal: () => set({ isSyncModalOpen: false }),


  setEngineMode: (mode) =>
    set((state) => {
      // 切换到 connected：清空本地演示用的仿真 / 节点 / 日志，避免继续沿用假数据
      if (mode === 'connected') {
        // pull current auth token (if user logged in) so WS connections include it
        const authToken = useAuthStore.getState().accessToken as string | null;
        // Try to auto-load a simulation if the current URL contains a simulation id
        try {
          const m = window.location.pathname.match(/\/simulations\/(.+?)(\/|$)/);
          if (m && m[1]) {
            const sid = decodeURIComponent(m[1]);
            (async () => {
              try {
                const sim = await getSimulationApi(sid);
                if (sim) {
                  set({
                    currentSimulation: sim,
                    simulations: [sim],
                    engineConfig: { ...get().engineConfig, status: 'connected', token: authToken ?? get().engineConfig.token }
                  } as any);
                }
              } catch (e) {
                // ignore load errors; UI will fallback to latest_state logic
                console.warn('auto-load simulation failed', e);
              }
            })();
          }
        } catch (e) {
          // ignore
        }
        return {
          engineConfig: {
            ...state.engineConfig,
            mode: 'connected',
            status: 'connecting',
            token: authToken ?? state.engineConfig.token
          },
          simulations: [],
          currentSimulation: null,
          nodes: [],
          selectedNodeId: null,
          agents: [],
          logs: [],
          rawEvents: [],
          compareTargetNodeId: null,
          isCompareMode: false,
          comparisonSummary: null
        };
      }

      // 切换回 standalone：恢复内置示例仿真和本地节点/日志
      const demoSim: Simulation = {
        id: 'sim1',
        name: '2024年乡村委员会模拟',
        templateId: 'village',
        status: 'active',
        createdAt: '2024-03-10',
        timeConfig: DEFAULT_TIME_CONFIG,
        socialNetwork: {}
      };

      return {
        engineConfig: {
          ...state.engineConfig,
          mode: 'standalone',
          status: 'disconnected'
        },
        simulations: [demoSim],
        currentSimulation: demoSim,
        nodes: generateNodes(),
        selectedNodeId: 'n2',
        agents: generateAgents('village', { provider: 'OpenAI', model: 'gpt-4o' }),
        logs: generateLogs(),
        rawEvents: [],
        compareTargetNodeId: null,
        isCompareMode: false,
        comparisonSummary: null
      };
    }),

  setSimulation: (sim) => set({ currentSimulation: sim }),

  addNotification: (type, message) =>
    set((state) => {
      const id = Date.now().toString();
      setTimeout(() => {
        get().removeNotification(id);
      }, 3000);
      return {
        notifications: [...state.notifications, { id, type, message }]
      };
    }),

  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id)
    })),
    
  // #13 Guide Actions
  toggleGuide: (isOpen) => set({ isGuideOpen: isOpen }),
  
  sendGuideMessage: async (content) => {
     set(state => ({
        guideMessages: [...state.guideMessages, { id: `u-${Date.now()}`, role: 'user', content }],
        isGuideLoading: true
     }));

     if (!process.env.API_KEY) {
        set(state => ({
           guideMessages: [...state.guideMessages, { id: `sys-${Date.now()}`, role: 'assistant', content: '错误：缺少 API Key。请配置环境变量。' }],
           isGuideLoading: false
        }));
        return;
     }

     const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
     
     const systemPrompt = `You are the expert guide for "SocialSim4 Next", a social simulation platform. 
     Your goal is to help users design experiments and navigate the platform features.
     
     PLATFORM CAPABILITIES MAP:
     1. **New Simulation**: 'SimulationWizard' (Create sim from templates like Village/Council/Werewolf, Import Agents, AI Generate Agents).
     2. **Social Network**: 'NetworkEditor' (Define topology like Ring/Star/Small World to control information flow).
     3. **Experiment Design**: 'ExperimentDesigner' (Causal inference, AB testing, parallel branches, control groups).
     4. **Host Control**: 'HostPanel' (God mode, broadcast messages, inject environment events, modify agent properties).
     5. **Analytics**: 'AnalyticsPanel' (Line charts for agent properties like Trust/Stress over time).
     6. **Export**: 'ExportModal' (Download logs as JSON/CSV/Excel).
     7. **Reports**: 'ReportModal' (AI-generated analysis reports).
     8. **SimTree**: The main visualization. Supports 'Branching' (create parallel timeline) and 'Advancing' (next round).
     9. **Comparison**: 'ComparisonView' (Diff two nodes/timelines).

     INSTRUCTIONS:
     - Analyze the user's intent.
     - Provide a concise, step-by-step guide mapping their goal to specific Platform Tools.
     - If the user needs to OPEN a specific tool, append a tag at the end of your response in the format: [[ACTION_NAME]].
     - Supported Tags: [[OPEN_WIZARD]], [[OPEN_NETWORK]], [[OPEN_EXPERIMENT]], [[OPEN_EXPORT]], [[OPEN_ANALYTICS]], [[OPEN_HOST]].
     - You can include multiple tags if relevant, but prioritize the most important one.
     - Use Markdown for formatting.
     `;

     const chatHistory = get().guideMessages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
     }));

     try {
        const response = await ai.models.generateContent({
           model: 'gemini-2.5-flash',
           contents: [
              ...chatHistory,
              { role: 'user', parts: [{ text: content }] }
           ],
           config: {
              systemInstruction: systemPrompt,
           }
        });

        const text = response.text || "抱歉，我无法理解您的请求。";
        
        const actions: GuideActionType[] = [];
        if (text.includes('[[OPEN_WIZARD]]')) actions.push('OPEN_WIZARD');
        if (text.includes('[[OPEN_NETWORK]]')) actions.push('OPEN_NETWORK');
        if (text.includes('[[OPEN_EXPERIMENT]]')) actions.push('OPEN_EXPERIMENT');
        if (text.includes('[[OPEN_EXPORT]]')) actions.push('OPEN_EXPORT');
        if (text.includes('[[OPEN_ANALYTICS]]')) actions.push('OPEN_ANALYTICS');
        if (text.includes('[[OPEN_HOST]]')) actions.push('OPEN_HOST');

        const cleanText = text.replace(/\[\[OPEN_.*?\]\]/g, '');

        set(state => ({
           guideMessages: [...state.guideMessages, { 
              id: `a-${Date.now()}`, 
              role: 'assistant', 
              content: cleanText,
              suggestedActions: actions.length > 0 ? actions : undefined
           }],
           isGuideLoading: false
        }));

     } catch (e) {
        set(state => ({
           guideMessages: [...state.guideMessages, { id: `err-${Date.now()}`, role: 'assistant', content: '连接 AI 服务超时，请稍后再试。' }],
           isGuideLoading: false
        }));
     }
  },

  addSimulation: (name, template, customAgents, timeConfig) => {
    const state = get();

    if (state.engineConfig.mode === 'connected') {
      (async () => {
        try {
          const base = state.engineConfig.endpoint;
          const token = (state.engineConfig as any).token as string | undefined;

          const mapSceneType: Record<string, string> = {
            village: 'village_scene',
            council: 'council_scene',
            werewolf: 'werewolf_scene'
          };
          const backendSceneType = mapSceneType[template.sceneType] || template.sceneType;

          let baseAgents = customAgents;
          if (!baseAgents) {
            if (template.agents && template.agents.length > 0) {
              baseAgents = JSON.parse(JSON.stringify(template.agents));
            } else {
              baseAgents = generateAgents(template.sceneType, {
                provider: 'OpenAI',
                model: 'gpt-4o'
              });
            }
          }

          const finalTimeConfig =
            timeConfig || template.defaultTimeConfig || DEFAULT_TIME_CONFIG;
          const selectedProviderId =
            state.selectedProviderId ?? state.currentProviderId ?? null;

          const payload: any = {
            scene_type: backendSceneType,
            scene_config: {
              time_scale: finalTimeConfig,
              social_network: template.defaultNetwork || {}
            },
            agent_config: {
              agents: (baseAgents || []).map((a) => ({
                name: a.name,
                profile: a.profile,
                role: (a as any).role,
                avatarUrl: (a as any).avatarUrl,
                llmConfig: (a as any).llmConfig,
                properties: (a as any).properties || {},
                history: (a as any).history || {},
                memory: (a as any).memory || [],
                knowledgeBase: (a as any).knowledgeBase || [],
                action_space: Array.isArray((a as any).action_space)
                  ? (a as any).action_space
                  : ['send_message']
              }))
            },
            // ✅ 把选中的 provider 传给后端
            llm_provider_id: selectedProviderId || undefined,
            name: name || undefined
          };

          const sim = await createSimulationApi(base, payload, token);
          try {
            const { startSimulation } = await import('./services/simulations');
            await startSimulation(base, sim.id, token);
          } catch {}

          const newSim: Simulation = {
            id: sim.id,
            name: name || sim.name,
            templateId: template.id,
            status: 'active',
            createdAt: new Date().toISOString().split('T')[0],
            timeConfig: finalTimeConfig,
            socialNetwork: template.defaultNetwork || {}
          };

          // ✅ 不要清空 nodes，先只更新仿真和智能体，等拿到 graph 再覆盖 nodes
          set({
            simulations: [...state.simulations, newSim],
            currentSimulation: newSim,
            agents: baseAgents || [],
            logs: [],
            rawEvents: []
          });

          const graph = await getTreeGraph(base, sim.id, token);
          if (graph) {
            const nodesMapped = mapGraphToNodes(graph);
            set({
              nodes: nodesMapped,
              selectedNodeId:
                graph.root != null ? String(graph.root) : nodesMapped[0]?.id ?? null,
              isWizardOpen: false
            });
          } else {
            set({ isWizardOpen: false });
          }
          get().addNotification('success', pickText(`Simulation "${newSim.name}" created`, `仿真 "${newSim.name}" 创建成功`));
        } catch (e) {
          console.error(e);
          get().addNotification('error', pickText('Failed to create simulation via backend', '后端创建仿真失败'));
        }
      })();
      return;
    }
    set((state) => {
      let finalAgents = customAgents;
      if (!finalAgents) {
        if (template.agents && template.agents.length > 0) {
          finalAgents = JSON.parse(JSON.stringify(template.agents));
        } else {
          finalAgents = generateAgents(template.sceneType, {
            provider: 'OpenAI',
            model: 'gpt-4o'
          });
        }
      }
      const finalTimeConfig =
        timeConfig || template.defaultTimeConfig || DEFAULT_TIME_CONFIG;
      const finalNetwork = template.defaultNetwork || {};
      const newSim: Simulation = {
        id: `sim${Date.now()}`,
        name: name || `Simulation_${Date.now()}`,
        templateId: template.id,
        status: 'active',
        createdAt: new Date().toISOString().split('T')[0],
        timeConfig: finalTimeConfig,
        socialNetwork: finalNetwork
      };
      const newRootTime = finalTimeConfig.baseTime;
      const newNodes: SimNode[] = [
        {
          id: 'root',
          display_id: '0',
          parentId: null,
          name: '初始状态',
          depth: 0,
          isLeaf: true,
          status: 'completed',
          timestamp: 'Now',
          worldTime: newRootTime
        }
      ];
      return {
        simulations: [...state.simulations, newSim],
        currentSimulation: newSim,
        agents: finalAgents || [],
        nodes: newNodes,
        selectedNodeId: 'root',
        logs: [],
        isWizardOpen: false
      };
    });
    get().addNotification('success', `仿真 "${name}" 创建成功`);

    // 异步：如果用户已登录，尝试自动将本地仿真保存到后端
    (async () => {
      try {
        const auth = useAuthStore.getState();
        if (!auth?.isAuthenticated) return;
        // 显示正在保存的 spinner
        set({ isGenerating: true });

        const endpoint = state.engineConfig.endpoint;
        const token = (state.engineConfig as any).token as string | undefined;

        // 构造后端所需的 payload，保持与 connected 分支一致
        const mapSceneType: Record<string, string> = {
          village: 'village_scene',
          council: 'council_scene',
          werewolf: 'werewolf_scene'
        };
        const backendSceneType = mapSceneType[template.sceneType] || template.sceneType;

        const payload: any = {
          scene_type: backendSceneType,
          scene_config: {
            time_scale: timeConfig || template.defaultTimeConfig || DEFAULT_TIME_CONFIG,
            social_network: template.defaultNetwork || {}
          },
          agent_config: {
            agents: (finalAgents || []).map((a) => ({
              name: a.name,
              profile: a.profile,
              role: (a as any).role,
              avatarUrl: (a as any).avatarUrl,
              llmConfig: (a as any).llmConfig,
              properties: (a as any).properties || {},
              history: (a as any).history || {},
              memory: (a as any).memory || [],
              knowledgeBase: (a as any).knowledgeBase || [],
              action_space: Array.isArray((a as any).action_space) ? (a as any).action_space : ['send_message']
            }))
          },
          llm_provider_id: state.selectedProviderId || state.currentProviderId || undefined,
          name: name || undefined
        };

        // 使用已有的 API wrapper（createSimulation），兼容旧签名
        try {
          const { createSimulation } = await import('./services/simulations');
          const saved = await createSimulation(endpoint, payload, token);
          if (saved && saved.id) {
            // 用后端 id 更新本地 simulation，确保后续 resume/list 能找到它
            set((s) => ({
              simulations: s.simulations.map(sim => sim === newSim ? { ...sim, id: saved.id } : sim),
              currentSimulation: { ...s.currentSimulation!, id: saved.id }
            } as any));
            get().addNotification('success', pickText('Auto-saved to backend', '已自动保存至后端'));
          }
        } catch (e) {
          console.warn('自动保存仿真到后端失败', e);
        }
      } finally {
        set({ isGenerating: false });
      }
    })();
  },

  updateTimeConfig: (config) => {
    set(state => {
      if (!state.currentSimulation) return {};
      return {
        currentSimulation: { ...state.currentSimulation, timeConfig: config }
      };
    });
    get().addNotification('info', pickText('Time configuration updated', '时间配置已更新'));
  },

  updateSocialNetwork: (network) => {
     set(state => {
       if (!state.currentSimulation) return {};
       return {
         currentSimulation: { ...state.currentSimulation, socialNetwork: network }
       };
     });
     get().addNotification('success', pickText('Network graph updated', '社交网络拓扑已更新'));
  },

  saveTemplate: (name, description) => {
    set(state => {
      if (!state.currentSimulation) return {};
      const newTemplate: SimulationTemplate = {
        id: `tmpl_${Date.now()}`,
        name,
        description,
        category: 'custom',
        sceneType: state.currentSimulation.templateId || 'village', 
        agents: JSON.parse(JSON.stringify(state.agents)),
        defaultTimeConfig: state.currentSimulation.timeConfig,
        defaultNetwork: state.currentSimulation.socialNetwork
      };
      return {
        savedTemplates: [...state.savedTemplates, newTemplate],
        isSaveTemplateOpen: false
      };
    });
    get().addNotification('success', '模板保存成功');
  },

  // 手动同步当前仿真到后端（将详细日志输出到 syncLogs）
  syncCurrentSimulation: async () => {
    const state = get();
    if (!state.currentSimulation) {
      set((s) => ({ syncLogs: [...s.syncLogs, '[ERROR] 未找到当前仿真'] } as any));
      return;
    }
    set({ isSyncing: true, syncLogs: [] });
    const sim = state.currentSimulation;
    try {
      set((s) => ({ syncLogs: [...s.syncLogs, `[INFO] 发起后台同步请求 ${sim.name}（id=${sim.id}）`] } as any));
      const { enqueueSync, getSyncLog } = await import('./services/simulations');

      const payload: any = {
        name: sim.name,
        scene_type: sim.templateId || 'village',
        scene_config: sim.timeConfig || {},
        social_network: sim.socialNetwork || {},
        agent_config: {
          agents: (state.agents || []).map((a) => ({
            name: a.name,
            profile: a.profile,
            role: (a as any).role,
            avatarUrl: (a as any).avatarUrl,
            llmConfig: (a as any).llmConfig,
            properties: (a as any).properties || {},
            history: (a as any).history || {},
            memory: (a as any).memory || [],
            knowledgeBase: (a as any).knowledgeBase || [],
            action_space: Array.isArray((a as any).action_space) ? (a as any).action_space : ['send_message']
          }))
        }
      };

      const res = await enqueueSync(sim.id, payload);
      const syncLogId = res?.sync_log_id;
      const taskId = res?.task_id;
      set((s) => ({ syncLogs: [...s.syncLogs, `[OK] 后端已接收同步请求 (sync_log=${syncLogId}, task=${taskId})`] } as any));

      // Poll for updates until finished/error or timeout
      const start = Date.now();
      const timeout = 1000 * 60 * 5; // 5 minutes
      let finished = false;
      while (!finished && Date.now() - start < timeout) {
        await new Promise((r) => setTimeout(r, 1000));
        try {
          const log = await getSyncLog(sim.id, Number(syncLogId));
          const details = Array.isArray(log.details) ? log.details : [];
          set((s) => ({ syncLogs: details } as any));
          if (log.status === 'finished' || log.status === 'error') {
            finished = true;
            if (log.status === 'finished') {
              get().addNotification('success', '后台同步完成');
            } else {
              get().addNotification('error', '后台同步出错，请查看日志');
            }
          }
        } catch (e) {
          // ignore and continue polling
        }
      }
      if (!finished) {
        set((s) => ({ syncLogs: [...s.syncLogs, '[WARN] 后台同步未在超时内完成，已停止等待，请稍后查看日志。'] } as any));
      }
    } catch (e: any) {
      console.error('sync error', e);
      set((s) => ({ syncLogs: [...s.syncLogs, `[ERROR] 同步失败: ${String(e?.message || e)}`] } as any));
      get().addNotification('error', '手动同步失败，请查看同步日志');
    } finally {
      set({ isSyncing: false });
    }
  },

  deleteTemplate: (id) => set(state => ({
    savedTemplates: state.savedTemplates.filter(t => t.id !== id)
  })),

  // #14 Report Generation
  generateReport: async () => {
    // 占位实现：当前暂不调用前端 Gemini 报告生成，避免未定义函数报错
    set({ isGeneratingReport: false });
    get().addNotification('error', '报告生成功能暂未启用');
  },

  selectNode: (id) => set({ selectedNodeId: id }),
  setCompareTarget: (id) => set({ compareTargetNodeId: id }),
  toggleCompareMode: (isOpen) => set({ isCompareMode: isOpen, comparisonSummary: null }),
  toggleWizard: (isOpen) => set({ isWizardOpen: isOpen }),
  toggleHelpModal: (isOpen) => set({ isHelpModalOpen: isOpen }),
  toggleAnalytics: (isOpen) => set({ isAnalyticsOpen: isOpen }),
  toggleExport: (isOpen) => set({ isExportOpen: isOpen }),
  toggleExperimentDesigner: (isOpen) => set({ isExperimentDesignerOpen: isOpen }),
  toggleTimeSettings: (isOpen) => set({ isTimeSettingsOpen: isOpen }),
  toggleSaveTemplate: (isOpen) => set({ isSaveTemplateOpen: isOpen }),
  toggleNetworkEditor: (isOpen) => set({ isNetworkEditorOpen: isOpen }),
  toggleReportModal: (isOpen) => set({ isReportModalOpen: isOpen }),

  injectLog: (type, content, imageUrl) => set(state => {
    if (!state.selectedNodeId) return {};
    const log: LogEntry = {
      id: `host-${Date.now()}`,
      nodeId: state.selectedNodeId,
      round: 0,
      type: type === 'SYSTEM' || type === 'ENVIRONMENT' ? type : 'HOST_INTERVENTION',
      content: content,
      imageUrl: imageUrl,
      timestamp: new Date().toISOString()
    };
    return { logs: [...state.logs, log] };
  }),

  updateAgentProperty: (agentId, property, value) => {
    set(state => {
      const updatedAgents = state.agents.map(a => {
        if (a.id === agentId) {
          return { ...a, properties: { ...a.properties, [property]: value } };
        }
        return a;
      });
      return { agents: updatedAgents };
    });
    const agentName = get().agents.find(a => a.id === agentId)?.name || agentId;
    get().injectLog('HOST_INTERVENTION', `Host 修改了 ${agentName} 的属性 [${property}] 为 ${value}`);
    get().addNotification('success', '智能体属性已更新');
  },

  addKnowledgeToAgent: (agentId, item) => {
    set(state => ({
      agents: state.agents.map(a => a.id === agentId ? { ...a, knowledgeBase: [...a.knowledgeBase, item] } : a)
    }));
    get().addNotification('success', '知识库条目已添加');
  },

  removeKnowledgeFromAgent: (agentId, itemId) => {
    set(state => ({
      agents: state.agents.map(a => a.id === agentId ? { ...a, knowledgeBase: a.knowledgeBase.filter(i => i.id !== itemId) } : a)
    }));
    get().addNotification('success', '知识库条目已移除');
  },

  advanceSimulation: async () => {
    const state = get();
    if (!state.selectedNodeId || state.isGenerating || !state.currentSimulation) return;

    const parentNode = state.nodes.find(n => n.id === state.selectedNodeId);
    if (!parentNode) return;

    set({ isGenerating: true });

    try {
      // ★ 连接模式：调用后端推进 + 解析后端事件
      if (state.engineConfig.mode === 'connected' && state.currentSimulation) {
        try {
          const base = state.engineConfig.endpoint;
          const token = (state.engineConfig as any).token as string | undefined;
          const simId = state.currentSimulation.id;
          const parentNumeric = Number(parentNode.id);
          if (!Number.isFinite(parentNumeric)) throw new Error('选中节点不是后端节点');

          const res = await treeAdvanceChain(base, simId, parentNumeric, 1, token);

          const graph = await getTreeGraph(base, simId, token);
          if (graph) {
            const nodesMapped = mapGraphToNodes(graph);
            set({ nodes: nodesMapped, selectedNodeId: String(res.child) });
          }

          try {
            // 并行获取事件 + 状态
            const [events, simState] = await Promise.all([
              getSimEvents(base, simId, res.child, token),
              getSimState(base, simId, res.child, token)
            ]);

            const turnVal = Number(simState?.turns ?? 0) || 0;

            const agentsMapped: Agent[] = (simState?.agents || []).map((a: any, idx: number) => ({
              id: `a-${idx}-${a.name}`,
              name: a.name,
              role: a.role || '',
              avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(a.name || String(idx))}`,
              profile: a.profile || '',
              llmConfig: { provider: 'mock', model: 'default' },
              properties: a.properties || {},
              history: {},
              memory: (a.short_memory || []).map((m: any, j: number) => ({
                id: `m-${idx}-${j}`,
                round: turnVal,
                content: String(m.content ?? ''),
                type: (String(m.role ?? '') === 'assistant' || String(m.role ?? '') === 'user') ? 'dialogue' : 'observation',
                timestamp: new Date().toISOString()
              })),
              knowledgeBase: []
            }));

            const eventsArray = Array.isArray(events) ? events : [];
            
            // 去重：只添加新的事件（通过比较事件的唯一标识）
            // 使用事件类型、数据内容和时间戳作为唯一标识
            const getEventKey = (ev: any): string => {
              if (typeof ev === 'string') return `str:${ev}`;
              if (!ev || typeof ev !== 'object') return `prim:${String(ev)}`;
              const evType = ev.type || ev.event_type || 'unknown';
              const data = ev.data || {};
              
              // 对于 system_broadcast 事件，使用 text 和 sender 作为唯一键
              if (evType === 'system_broadcast') {
                const text = data.text || data.message || '';
                const sender = data.sender || '';
                const eventType = data.type || '';
                // 使用完整的 text 作为唯一键的一部分，确保准确去重
                return `${evType}:${eventType}:${sender}:${text}`;
              }
              
              // 使用类型、agent、content、time等关键字段生成唯一键
              const agent = data.agent || '';
              const content = typeof data.content === 'string' ? data.content.substring(0, 100) : '';
              const time = data.time || '';
              const action = data.action?.action || data.action?.name || '';
              return `${evType}:${agent}:${content}:${time}:${action}`;
            };
            
            set(prev => {
              const existingKeys = new Set(prev.rawEvents.map(getEventKey));
              const batchKeys = new Set<string>();
              const newEvents = eventsArray.filter(ev => {
                const key = getEventKey(ev);
                if (existingKeys.has(key)) return false;
                if (batchKeys.has(key)) return false; // 去重同一批里的重复事件
                batchKeys.add(key);
                return true;
              });
              
              const logsMapped: LogEntry[] = mapBackendEventsToLogs(
                newEvents, // 只映射新事件
                String(res.child),
                turnVal,
                agentsMapped,
                false // 显示时不包含所有元数据
              );

              return {
                logs: [...prev.logs, ...logsMapped],
                rawEvents: [...prev.rawEvents, ...newEvents], // 只保存新事件
                agents: agentsMapped,
                isGenerating: false
              };
            });
          } catch {
            set({ isGenerating: false });
          }
          return;
        } catch (err) {
          get().addNotification('error', '后端推进失败，回退本地模拟');
        }
      }

      // ★ Standalone 模式仍保留你原来的本地/Gemini 推进逻辑
      const existingChildren = state.nodes.filter(n => n.parentId === parentNode.id);
      const nextIndex = existingChildren.length + 1;
      const newNodeId = `n-${Date.now()}`;
      const newDepth = parentNode.depth + 1;
      
      const tc = state.currentSimulation.timeConfig ?? { baseTime: new Date().toISOString(), step: 1, unit: 'hour' };
      const nextWorldTime = addTime(parentNode.worldTime, tc.step, tc.unit);
      
      const newNode: SimNode = {
        id: newNodeId,
        display_id: `${parentNode.display_id}.${nextIndex}`,
        parentId: parentNode.id,
        name: `Round ${newDepth}`,
        depth: newDepth,
        isLeaf: true,
        status: 'running',
        timestamp: new Date().toLocaleTimeString(),
        worldTime: nextWorldTime
      };

      const recentLogs = state.logs.slice(-10);

      // 本地模式：不再生成 Mock 行为日志，避免误导。仅记录时间推进。
      const newLogs: LogEntry[] = [
        {
          id: `sys-${Date.now()}`,
          nodeId: newNodeId,
          round: newDepth,
          type: 'SYSTEM',
          content: `时间推进至: ${formatWorldTime(nextWorldTime)} (Round ${newDepth})` + '（离线模式，未执行真实动作）',
          timestamp: newNode.timestamp
        }
      ];

      const updatedAgents = state.agents.map(agent => {
        const newHistory = { ...agent.history };
        Object.keys(newHistory).forEach(key => {
          const prevValues = newHistory[key] || [50];
          newHistory[key] = [...prevValues, Math.max(0, Math.min(100, prevValues[prevValues.length - 1] + (Math.floor(Math.random() * 10) - 5)))];
        });
        return { ...agent, history: newHistory };
      });

      set({
        nodes: state.nodes.map(n => n.id === parentNode.id ? { ...n, isLeaf: false } : n).concat(newNode),
        selectedNodeId: newNodeId,
        logs: [...state.logs, ...newLogs],
        agents: updatedAgents,
        isGenerating: false
      });
    } catch (e) {
      console.error(e);
      set({ isGenerating: false });
      get().addNotification('error', '仿真推进失败，请重试');
    }
  },

  branchSimulation: () => {
    const state = get();
    if (!state.selectedNodeId || !state.currentSimulation) return;
    if (state.engineConfig.mode === 'connected') {
      (async () => {
        try {
          const base = state.engineConfig.endpoint;
          const token = (state.engineConfig as any).token as string | undefined;
          const parentNumeric = Number(state.selectedNodeId);
          if (!Number.isFinite(parentNumeric)) throw new Error('选中节点不是后端节点');
          await treeBranchPublic(base, state.currentSimulation!.id, parentNumeric, '分支', token);
          const graph = await getTreeGraph(base, state.currentSimulation!.id, token);
          if (graph) {
            const nodesMapped = mapGraphToNodes(graph);
            set({ nodes: nodesMapped });
          }
        } catch (e) {
          get().addNotification('error', '后端分支失败');
        }
      })();
      return;
    }
    set((state) => {
      const currentNode = state.nodes.find(n => n.id === state.selectedNodeId);
      if (!currentNode || !currentNode.parentId) return {};
      const parentNode = state.nodes.find(n => n.id === currentNode.parentId);
      if (!parentNode) return {};
      const existingSiblings = state.nodes.filter(n => n.parentId === parentNode.id);
      const nextIndex = existingSiblings.length + 1;
      const newNodeId = `n-${Date.now()}`;
      const newNode: SimNode = {
        id: newNodeId,
        display_id: `${parentNode.display_id}.${nextIndex}`,
        parentId: parentNode.id,
        name: `分支: 平行推演`,
        depth: currentNode.depth,
        isLeaf: true,
        status: 'pending',
        timestamp: new Date().toLocaleTimeString(),
        worldTime: parentNode.worldTime 
      };
      const newLogs: LogEntry[] = [
        {
          id: `sys-${Date.now()}`,
          nodeId: newNodeId,
          round: newNode.depth,
          type: 'SYSTEM',
          content: `创建了一个新的平行分支: ${newNode.name}`,
          timestamp: newNode.timestamp
        }
      ];
      return {
        nodes: [...state.nodes, newNode],
        selectedNodeId: newNodeId,
        logs: [...state.logs, ...newLogs]
      };
    });
  },

  deleteNode: async () => {
    const state = get();
    if (!state.selectedNodeId) return;
    if (state.engineConfig.mode === 'connected' && state.currentSimulation) {
      try {
        const base = state.engineConfig.endpoint;
        const token = (state.engineConfig as any).token as string | undefined;
        const simId = state.currentSimulation.id;
        const nodeNumeric = Number(state.selectedNodeId);
        if (!Number.isFinite(nodeNumeric)) throw new Error('选中节点不是后端节点');
        await treeDeleteSubtree(base, simId, nodeNumeric, token);
        const graph = await getTreeGraph(base, simId, token);
        if (graph) {
          const nodesMapped = mapGraphToNodes(graph);
          set({ nodes: nodesMapped, selectedNodeId: graph.root != null ? String(graph.root) : null });
        }
        get().addNotification('success', '节点已删除');
      } catch (e) {
        get().addNotification('error', '删除节点失败');
      }
      return;
    }
    set((s) => {
      const targetId = s.selectedNodeId!;
      const toDelete = new Set<string>();
      const collect = (id: string) => {
        toDelete.add(id);
        s.nodes.filter(n => n.parentId === id).forEach(ch => collect(ch.id));
      };
      collect(targetId);
      const remaining = s.nodes.filter(n => !toDelete.has(n.id));
      const logs = s.logs.filter(l => !toDelete.has(l.nodeId));
      const newSelected = remaining.find(n => n.id === s.nodes.find(x => x.id === targetId)?.parentId)?.id || null;
      return { nodes: remaining, logs, selectedNodeId: newSelected };
    });
    get().addNotification('success', '节点已删除');
  },

  runExperiment: (baseNodeId, experimentName, variants) => {
    const state = get();
    const baseNode = state.nodes.find((n) => n.id === baseNodeId);
    if (!baseNode) return;

    // connected mode -> call backend create + run; standalone -> keep existing mock behavior
    if (state.engineConfig.mode === 'connected' && state.currentSimulation) {
      (async () => {
        try {
          const simId = state.currentSimulation!.id;
          const token = (state.engineConfig as any).token as string | undefined;

          // prepare variant specs for backend (ops expected by backend)
          const variantSpecs = variants.map((v) => ({ name: v.name, ops: v.ops || [] }));

          const createRes = await experimentsApi.createExperiment(simId, experimentName, Number(baseNode.display_id || 0), variantSpecs);
          const expId = createRes.experiment_id || (createRes as any).experiment_id;

          // locally add placeholder nodes so UI shows pending variants
          // initialize DEV debug container (also expose on localhost to aid local troubleshooting)
          try {
            const isLocal = typeof window !== 'undefined' && window.location && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
            if (import.meta.env.DEV || isLocal) {
              (window as any).__SIM_DEBUG__ = (window as any).__SIM_DEBUG__ || { createResponses: [], runResponses: [], getExperimentResponses: [], mappingActions: [], wsAttempts: [] };
            }
          } catch (err) {
            console.warn('init __SIM_DEBUG__ failed', err);
          }
          set((s) => {
            const tc = s.currentSimulation?.timeConfig || DEFAULT_TIME_CONFIG;
            const nextWorldTime = addTime(baseNode.worldTime, tc.step, tc.unit);
            const updatedNodes = s.nodes.map((n) => (n.id === baseNodeId ? { ...n, isLeaf: false } : n));
            const newNodes: SimNode[] = variantSpecs.map((vs, idx) => ({
              id: `exp-${Date.now()}-${idx}`,
              display_id: `${baseNode.display_id}.${idx + 1}`,
              parentId: baseNode.id,
              name: `${experimentName}: ${vs.name}`,
              depth: baseNode.depth + 1,
              isLeaf: true,
              status: 'pending',
              timestamp: new Date().toLocaleTimeString(),
              worldTime: nextWorldTime,
              // explicit metadata to allow deterministic mapping back to backend variants
              // store expId as string to avoid type mismatches when matching
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              meta: { placeholder_exp_id: String(expId), variant_index: idx } as any,
            }));
            return { nodes: [...updatedNodes, ...newNodes], selectedNodeId: newNodes[0]?.id ?? null } as any;
          });

          // start the run (background) and poll for completion
          const runRes = await experimentsApi.runExperiment(simId, String(expId), 1);
          if (import.meta.env.DEV) {
            try {
              (window as any).__SIM_DEBUG__.runResponses.push({ time: Date.now(), expId, runRes });
              console.debug('[DEV] runExperiment: runRes', { expId, runRes });
            } catch (err) {
              console.warn('push __SIM_DEBUG__ runRes failed', err);
            }
          }
          const runId = runRes?.run_id || (runRes as any)?.run_id;
          get().addNotification('success', `实验 "${experimentName}" 已提交到后端运行（run_id=${runId}）`);
          // If backend returned immediate node mapping, apply it; otherwise try to fetch experiment details
            try {
            const mapping = (runRes && (runRes as any).node_mapping) || null;
            if (import.meta.env.DEV) {
              try {
                (window as any).__SIM_DEBUG__.mappingActions.push({ type: 'immediate', time: Date.now(), expId, mapping });
              } catch (err) {
                console.warn('push __SIM_DEBUG__ mapping failed', err);
              }
              console.debug('[DEV] runExperiment: immediate mapping', { expId, mapping, variants: variants.map((v) => v.name) });
            }
            if (mapping && mapping.length) {
              // mapping entries correspond to experiment variants order; match by index
              set((s) => {
                const updated = s.nodes.map((n) => ({ ...n }));
                let newSelected: string | null = s.selectedNodeId;
                for (let mi = 0; mi < mapping.length; mi++) {
                  const m = mapping[mi];
                  if (!m || !m.node_id) continue;
                  // 1) Try exact meta match (preferred) — compare as strings to avoid type mismatch
                  let idx = updated.findIndex((nn) => String(((nn as any).meta || {}).placeholder_exp_id) === String(expId) && ((nn as any).meta || {}).variant_index === mi);
                  // 2) Fallback: match by display name and parentId
                  if (idx < 0) {
                    const expectedName = `${experimentName}: ${variants[mi]?.name || ''}`;
                    idx = updated.findIndex((nn) => nn.name === expectedName && nn.parentId === baseNodeId);
                  }
                  // 3) Final fallback: match any placeholder with same parent and pending status in the same index order
                  if (idx < 0) {
                    let count = 0;
                    for (let j = 0; j < updated.length; j++) {
                      const nn = updated[j];
                      if (nn.parentId === baseNodeId && (nn as any).id?.toString().startsWith('exp-')) {
                        if (count === mi) {
                          idx = j;
                          break;
                        }
                        count++;
                      }
                    }
                  }
                    if (idx >= 0) {
                      const oldId = updated[idx].id;
                      updated[idx].id = String(m.node_id);
                      updated[idx].display_id = String(m.node_id);
                      (updated[idx] as any).meta = { experiment_id: expId, variant_id: m.variant_id };
                      updated[idx].status = 'pending';
                      if (s.selectedNodeId === oldId) {
                        newSelected = String(m.node_id);
                      }
                      if (import.meta.env.DEV) {
                        console.debug('[DEV] runExperiment: applied mapping', { variant_index: mi, placeholder_oldId: oldId, newNodeId: m.node_id, idx });
                        try { (window as any).__SIM_DEBUG__.mappingActions.push({ type: 'applied_immediate', time: Date.now(), expId, variant_index: mi, placeholder_oldId: oldId, newNodeId: m.node_id, idx }); } catch (err) { /* ignore */ }
                      }
                    }
                }
                return { nodes: updated, selectedNodeId: newSelected } as any;
              });
            } else {
              // If no mapping returned immediately, first try an immediate graph refresh
              try {
                if (import.meta.env.DEV) console.debug('[DEV] runExperiment: no immediate mapping, attempting immediate graph refresh');
                const graph = await getTreeGraph(state.engineConfig.endpoint, simId, token);
                if (graph) {
                  const nodesFromGraph = mapGraphToNodes(graph);
                  if (import.meta.env.DEV) { try { (window as any).__SIM_DEBUG__.createResponses = (window as any).__SIM_DEBUG__.createResponses || []; (window as any).__SIM_DEBUG__.createResponses.push({ time: Date.now(), expId, graphNodes: nodesFromGraph.length }); } catch (err) {} }
                  // attempt to map by expected name + parentId
                  set((s) => {
                    const updated = s.nodes.map((n) => ({ ...n }));
                    let newSelected: string | null = s.selectedNodeId;
                    for (let mi = 0; mi < variants.length; mi++) {
                      const expectedName = `${experimentName}: ${variants[mi]?.name || ''}`;
                      // find candidate in nodesFromGraph with matching parentId and name
                      const candidate = nodesFromGraph.find((gn) => gn.parentId === baseNode.id && gn.name === expectedName && String(gn.id) !== String(baseNode.id));
                      if (candidate && candidate.id) {
                        // find index in updated placeholder nodes
                        const pIdx = updated.findIndex((nn) => String(((nn as any).meta || {}).placeholder_exp_id) === String(expId) && ((nn as any).meta || {}).variant_index === mi);
                        if (pIdx >= 0) {
                          const oldId = updated[pIdx].id;
                          updated[pIdx].id = String(candidate.id);
                          updated[pIdx].display_id = String(candidate.id);
                          (updated[pIdx] as any).meta = { experiment_id: expId, variant_id: variants[mi]?.id };
                          updated[pIdx].status = 'pending';
                          if (s.selectedNodeId === oldId) newSelected = String(candidate.id);
                          if (import.meta.env.DEV) { try { (window as any).__SIM_DEBUG__.mappingActions.push({ type: 'applied_graph', time: Date.now(), expId, variant_index: mi, placeholder_oldId: oldId, newNodeId: candidate.id }); } catch (err) {} }
                        }
                      }
                    }
                    return { nodes: updated, selectedNodeId: newSelected } as any;
                  });
                }
              } catch (e) {
                if (import.meta.env.DEV) console.warn('[DEV] runExperiment: immediate graph refresh failed', e);
              }
              // If still not mapped, poll getExperiment for a short period
              const pollInterval = 2000; // ms
              const maxAttempts = 30; // poll up to ~60s
              (async () => {
                for (let attempt = 0; attempt < maxAttempts; attempt++) {
                  try {
                    await new Promise(r => setTimeout(r, pollInterval));
                    const expDetail = await experimentsApi.getExperiment(simId, String(expId));
                    if (import.meta.env.DEV) {
                      try {
                        (window as any).__SIM_DEBUG__.getExperimentResponses.push({ time: Date.now(), expId, attempt, expDetail });
                        console.debug('[DEV] runExperiment: poll attempt', { expId, attempt, variants: (expDetail?.experiment?.variants || []).map((v:any)=>({ id: v.id, node_id: v.node_id })) });
                      } catch (err) {
                        console.warn('push __SIM_DEBUG__ getExperiment failed', err);
                      }
                    }
                    const variantsResp = expDetail?.experiment?.variants || [];
                    if (variantsResp.length) {
                      // if any variant has node_id, apply mapping and stop polling
                      const hasNode = variantsResp.some((v:any) => v && v.node_id);
                      if (hasNode) {
                        set((s) => {
                          const updated = s.nodes.map((n) => ({ ...n }));
                          let newSelected: string | null = s.selectedNodeId;
                          for (let vi = 0; vi < variantsResp.length; vi++) {
                            const v = variantsResp[vi];
                            if (!v || !v.node_id) continue;
                            // 1) Try meta match first
                            let idx = updated.findIndex((nn) => String(((nn as any).meta || {}).placeholder_exp_id) === String(expId) && ((nn as any).meta || {}).variant_index === vi);
                            // 2) Fallback: name + parentId
                            if (idx < 0) {
                              const expectedName = `${experimentName}: ${v.name}`;
                              idx = updated.findIndex((nn) => nn.name === expectedName && nn.parentId === baseNodeId);
                            }
                            // 3) Final fallback: nth placeholder under parent
                            if (idx < 0) {
                              let count = 0;
                              for (let j = 0; j < updated.length; j++) {
                                const nn = updated[j];
                                if (nn.parentId === baseNodeId && (nn as any).id?.toString().startsWith('exp-')) {
                                  if (count === vi) {
                                    idx = j;
                                    break;
                                  }
                                  count++;
                                }
                              }
                            }
                            if (idx >= 0) {
                              const oldId = updated[idx].id;
                              updated[idx].id = String(v.node_id);
                              updated[idx].display_id = String(v.node_id);
                              (updated[idx] as any).meta = { experiment_id: expId, variant_id: v.id };
                              updated[idx].status = 'pending';
                              if (s.selectedNodeId === oldId) {
                                newSelected = String(v.node_id);
                              }
                              if (import.meta.env.DEV) {
                                try { (window as any).__SIM_DEBUG__.mappingActions.push({ type: 'applied_poll', time: Date.now(), expId, variant_index: vi, placeholder_oldId: oldId, newNodeId: v.node_id, idx }); } catch (err) { /* ignore */ }
                                console.debug('[DEV] runExperiment: applied poll mapping', { expId, variant_index: vi, placeholder_oldId: oldId, newNodeId: v.node_id, idx });
                              }
                            }
                          }
                          return { nodes: updated, selectedNodeId: newSelected } as any;
                        });
                        break;
                      }
                    }
                  } catch (e) {
                    // ignore individual polling errors, continue
                  }
                }
              })();
            }
          } catch (e) {
            // ignore mapping errors; WS or polling will refresh the graph later
          }
          // Start a WebSocket subscription to get real-time tree events (fallback to polling remains)
          try {
            const endpoint = (state.engineConfig.endpoint || '').replace(/\/+$/, '');
            // compute absolute ws url
            let baseWs = '';
            if (endpoint.startsWith('http')) {
              baseWs = endpoint.replace(/^http/, 'ws');
            } else {
              baseWs = `${location.origin}${endpoint}`;
              baseWs = baseWs.replace(/^http/, 'ws');
            }
            const token = (state.engineConfig as any).token as string | undefined;
            const wsUrl = `${baseWs}/simulations/${simId}/tree/events${token ? `?token=${encodeURIComponent(token)}` : ''}`;

            if (import.meta.env.DEV) {
              try { (window as any).__SIM_DEBUG__.wsAttempts.push({ time: Date.now(), wsUrl, token }); } catch (err) { /* ignore */ }
              console.debug('[DEV] runExperiment: attempting WS connect', { wsUrl, token });
            }
            if (!_treeSocket || _treeSocket.readyState === WebSocket.CLOSED) {
              _treeSocket = new WebSocket(wsUrl);
              _treeSocket.onopen = () => {
                console.debug('Tree events WS connected', wsUrl);
              };
              _treeSocket.onmessage = async (ev) => {
                try {
                  const msg = JSON.parse(ev.data || '{}');
                  // Coalesce rapid events and refresh graph once
                  if (_treeSocketRefreshTimer) {
                    window.clearTimeout(_treeSocketRefreshTimer);
                  }
                  _treeSocketRefreshTimer = window.setTimeout(async () => {
                    try {
                      const graph = await getTreeGraph(state.engineConfig.endpoint, simId, token);
                      if (graph) {
                        const nodesMapped = mapGraphToNodes(graph);
                        set({ nodes: nodesMapped });
                      }
                    } catch (e) {
                      console.warn('实时刷新树失败', e);
                    } finally {
                      _treeSocketRefreshTimer = null;
                    }
                  }, 400);
                } catch (e) {
                  console.warn('WS onmessage parse failed', e);
                }
              };
              _treeSocket.onclose = () => {
                console.debug('Tree events WS closed');
              };
              _treeSocket.onerror = (e) => console.warn('Tree WS error', e);
            }
          } catch (e) {
            console.warn('无法建立树事件 WebSocket 订阅，保留轮询作为后备', e);
            // Keep original polling fallback
            (async () => {
              try {
                let finished = false;
                const token = (state.engineConfig as any).token as string | undefined;
                for (let attempts = 0; attempts < 120 && !finished; attempts++) {
                  await new Promise((r) => setTimeout(r, 2000));
                  try {
                    const expDetail = await experimentsApi.getExperiment(simId, String(expId));
                    const runs = expDetail?.experiment?.runs || expDetail?.runs || [];
                    const found = runs.find((r: any) => String(r.id) === String(runId) || String(r.id) === String(Number(runId)) );
                    if (found) {
                      const status = String(found.status || '').toLowerCase();
                      if (status === 'finished' || status === 'error' || status === 'cancelled') {
                        finished = true;
                        // refresh tree graph to pick up new finished nodes
                        try {
                          const graph = await getTreeGraph(state.engineConfig.endpoint, simId, token);
                          if (graph) {
                            const nodesMapped = mapGraphToNodes(graph);
                            set({ nodes: nodesMapped });
                          }
                          get().addNotification('success', `实验 ${experimentName} 已完成（run ${found.status}）`);
                        } catch (e) {
                          console.warn('刷新树失败', e);
                        }
                        break;
                      }
                    }
                  } catch (e) {
                    // ignore poll errors
                  }
                }
              } catch (e) {
                console.error('轮询实验状态时出错', e);
              }
            })();
          }
        } catch (e) {
          console.error(e);
          get().addNotification('error', '启动实验失败');
        }
      })();
      return;
    }

    // fallback: standalone/local mock behaviour (preserve original demo behavior)
    set((state) => {
      const tc = state.currentSimulation?.timeConfig || DEFAULT_TIME_CONFIG;
      const nextWorldTime = addTime(baseNode.worldTime, tc.step, tc.unit);

      const newNodes: SimNode[] = [];
      const updatedNodes = state.nodes.map(n => n.id === baseNodeId ? { ...n, isLeaf: false } : n);

      variants.forEach((variant, index) => {
         const newNodeId = `exp-${Date.now()}-${index}`;
         const newNode: SimNode = {
           id: newNodeId,
           display_id: `${baseNode.display_id}.${index + 1}`,
           parentId: baseNode.id,
           name: `${experimentName}: ${variant.name}`,
           depth: baseNode.depth + 1,
           isLeaf: true,
           status: 'pending',
           timestamp: new Date().toLocaleTimeString(),
           worldTime: nextWorldTime
         };
         newNodes.push(newNode);
      });
      // attach placeholder metadata for deterministic later matching
      newNodes.forEach((n, idx) => {
        (n as any).meta = { placeholder_exp_id: null, variant_index: idx };
      });

      return {
        nodes: [...updatedNodes, ...newNodes],
        selectedNodeId: newNodes[0].id
      };
    });
    get().addNotification('success', `批量实验 "${experimentName}" 已启动`);
  },

  generateComparisonAnalysis: async () => {
    const state = get();
    if (!state.currentSimulation || !state.selectedNodeId || !state.compareTargetNodeId) return;
    // connected: call backend compare
    if (state.engineConfig.mode === 'connected') {
      try {
        set({ isGenerating: true });
        const simId = state.currentSimulation.id;
        const nodeA = Number(state.selectedNodeId);
        const nodeB = Number(state.compareTargetNodeId);
        if (!Number.isFinite(nodeA) || !Number.isFinite(nodeB)) {
          get().addNotification('error', '选中的节点不是后端节点');
          set({ isGenerating: false });
          return;
        }

        // Use explicit store toggle for LLM summarization
        const useLLM = Boolean(state.comparisonUseLLM);

        const res = await experimentsApi.compareNodes(simId, nodeA, nodeB, useLLM);
        const summary = res?.summary || (res?.message || '') || '未能生成摘要';
        set({ comparisonSummary: summary, isGenerating: false });
      } catch (e) {
        console.error(e);
        set({ isGenerating: false });
        get().addNotification('error', '比较分析失败');
      }
      return;
    }

    // standalone/demo fallback: generate a lightweight mock summary
    set({ isGenerating: true });
    setTimeout(() => {
      set({ comparisonSummary: '本地演示：两条时间线在若干事件与若干智能体属性上存在差异（仅演示）。', isGenerating: false });
    }, 700);
  }
}));

// 当用户从未登录切换到登录状态时，尝试把本地临时仿真同步到后端
(() => {
  let lastAuthState = useAuthStore.getState().isAuthenticated;
  useAuthStore.subscribe((s) => {
    const nowAuth = s.isAuthenticated;
    if (!lastAuthState && nowAuth) {
      // user just logged in: attempt to sync local sims
      (async () => {
        try {
          const state = useSimulationStore.getState();
          const localSims = state.simulations.filter((sim) => typeof sim.id === 'string' && /^sim\d+/.test(sim.id));
          if (!localSims.length) return;
          setTimeout(async () => {
            try {
              const endpoint = state.engineConfig.endpoint;
              const token = (state.engineConfig as any).token as string | undefined;
              const { createSimulation } = await import('./services/simulations');
              for (const sim of localSims) {
                // build minimal payload from sim (we don't have full template here)
                const payload: any = {
                  scene_type: sim.templateId || 'village',
                  scene_config: sim.timeConfig || {},
                  social_network: sim.socialNetwork || {},
                  agent_config: { agents: state.agents.map(a => ({
                    name: a.name,
                    profile: a.profile,
                    role: (a as any).role,
                    avatarUrl: (a as any).avatarUrl,
                    llmConfig: (a as any).llmConfig,
                    properties: (a as any).properties || {},
                    history: (a as any).history || {},
                    memory: (a as any).memory || [],
                    knowledgeBase: (a as any).knowledgeBase || [],
                    action_space: Array.isArray((a as any).action_space) ? (a as any).action_space : ['send_message']
                  }) )},
                  name: sim.name
                };
                try {
                  const saved = await createSimulation(endpoint, payload, token);
                  if (saved && saved.id) {
                    useSimulationStore.setState((s) => ({
                      simulations: s.simulations.map(x => x === sim ? { ...x, id: saved.id } : x),
                      currentSimulation: s.currentSimulation && s.currentSimulation.id === sim.id ? { ...s.currentSimulation, id: saved.id } : s.currentSimulation
                    } as any));
                    useSimulationStore.getState().addNotification('success', `本地仿真 "${sim.name}" 已同步到后端`);
                  }
                } catch (err) {
                  console.warn('同步本地仿真到后端失败', err);
                }
              }
            } catch (e) {
              console.warn('同步本地仿真过程失败', e);
            }
          }, 400);
        } catch (e) {
          console.warn('同步本地仿真失败', e);
        }
      })();
    }
    lastAuthState = nowAuth;
  });
})();