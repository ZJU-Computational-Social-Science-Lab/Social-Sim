// frontend/store/helpers.ts
//
// Pure helper functions for store operations.
//
// Responsibilities:
//   - Time calculation and formatting
//   - Event-to-log mapping
//   - Translation helpers for i18n
//   - Agent generation utilities
//
// Used by: Multiple store slices, components

import i18n from '../i18n';
import type { Agent, LogEntry, TimeUnit, TimeConfig, SimNode, LLMConfig, SimulationTemplate } from '../types';
import type { Graph } from '../services/simulationTree';

// =============================================================================
// Time Helpers
// =============================================================================

export const isZh = () => (i18n.language || 'en').toLowerCase().startsWith('zh');
export const getLocale = () => (isZh() ? 'zh-CN' : 'en-US');
export const pickText = (en: string, zh: string) => (isZh() ? zh : en);

export const addTime = (dateStr: string, value: number, unit: TimeUnit): string => {
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

export const formatWorldTime = (isoString: string) => {
  const date = new Date(isoString);
  return date.toLocaleString(getLocale(), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const DEFAULT_TIME_CONFIG: TimeConfig = {
  baseTime: new Date().toISOString(),
  unit: 'hour',
  step: 1
};

// =============================================================================
// Graph/Node Helpers
// =============================================================================

export const generateNodes = (): SimNode[] => {
  return [
    {
      id: 'root',
      display_id: '0',
      parentId: null,
      name: 'Start',
      depth: 0,
      isLeaf: true,
      status: 'pending',
      timestamp: new Date().toISOString(),
      worldTime: new Date().toISOString()
    }
  ];
};

export const mapGraphToNodes = (graph: Graph): SimNode[] => {
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

// =============================================================================
// Translation Helpers
// =============================================================================

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

export const translateActionName = (name: string | undefined): string => {
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

const stripActionXml = (raw: string): string => {
  if (!raw) return '';
  let t = raw;
  t = t.replace(/<Action[\s\S]*?<\/Action>/gi, '');
  t = t.replace(/<Action[^>]*\/>/gi, '');
  t = t.replace(/<\/?(message|messages|youshould_send_message)[^>]*>/gi, '');
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

export const translateAgentContent = (text: string): string => {
  if (!text) return '';
  if (!isZh()) return text;
  let t = text;

  // Role-related
  t = t.replace(/My role is (the )?/gi, '我的角色是');
  t = t.replace(/I am (the )?/gi, '我是');
  t = t.replace(/I'm (the )?/gi, '我是');
  t = t.replace(/focusing on/gi, '专注于');
  t = t.replace(/as (the )?/gi, '作为');
  t = t.replace(/\bthe Speaker\b/gi, '发言人');
  t = t.replace(/\bthe Moderator\b/gi, '主持人');

  // Goals and plans
  t = t.replace(/My (immediate )?focus is (to )?/gi, '我的（当前）重点是');
  t = t.replace(/My goal is (to )?/gi, '我的目标是');
  t = t.replace(/My goals? (are|is)/gi, '我的目标是');
  t = t.replace(/I need to/gi, '我需要');
  t = t.replace(/I will/gi, '我将');
  t = t.replace(/I should/gi, '我应该');

  // Common verbs
  t = t.replace(/\bensure\b/gi, '确保');
  t = t.replace(/\bfacilitate\b/gi, '促进');
  t = t.replace(/\bmaintain\b/gi, '维持');
  t = t.replace(/\bestablish\b/gi, '建立');

  // Markers
  t = t.replace(/\[当前\]/g, '[当前]');
  t = t.replace(/\[Current\]/gi, '[当前]');
  t = t.replace(/\[CURRENT\]/g, '[当前]');

  return t;
};

export const translateEnvText = (content: string): string => {
  if (!content) return '';
  let text = content;
  text = text.replace('[0:00] Status:', '[0:00] 状态:');
  text = text.replace('--- Status ---', '--- 状态 ---');
  text = text.replace('Current position:', '当前位置:');
  text = text.replace('Hunger level:', '饥饿值:');
  text = text.replace('Energy level:', '能量值:');
  text = text.replace('Inventory:', '物品栏:');
  text = text.replace('Current time:', '当前时间:');
  text = text.replace(/You are at\s*/g, '你现在位于 ');
  text = text.replace(/You arrived at\s*/g, '你到达了 ');
  text = text.replace(/Nearby agents:/g, '附近的智能体:');
  text = text.replace(/plain\b/g, '平原');
  text = text.replace('[Message]', '[消息]');
  return text;
};

// =============================================================================
// Event Helpers
// =============================================================================

export const extractEventTimestamp = (ev: any, data: any, fallback: string): string => {
  const raw = data?.time || data?.timestamp || ev?.timestamp;
  if (!raw) return fallback;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? fallback : d.toISOString();
};

export const pickNodeId = (ev: any, fallback: string): string => {
  const nodeVal = ev?.node;
  if (nodeVal === null || nodeVal === undefined) return fallback;
  return String(nodeVal);
};

export const pickRound = (ev: any, data: any, fallback: number): number => {
  const cand = data?.turn ?? data?.round ?? ev?.round;
  const n = Number(cand);
  return Number.isFinite(n) ? n : fallback;
};

// =============================================================================
// Event to Log Mapping (simplified version - full version in logs.ts)
// =============================================================================

export const mapBackendEventsToLogs = (
  events: any[],
  nodeId: string,
  round: number,
  agents: Agent[],
  includeAllMetadata: boolean = false
): LogEntry[] => {
  const nowIso = new Date().toISOString();
  const nameToId = new Map<string, string>();
  agents.forEach(a => nameToId.set(a.name, a.id));

  return (events || []).map((ev: any, i: number): LogEntry | null => {
    const evData = (ev && typeof ev === 'object' && (ev.data || ev.event_type || ev.type)) ? ev : null;
    const payload = evData ? ev.data || {} : {};
    const ts = extractEventTimestamp(ev, payload, nowIso);
    const roundVal = pickRound(ev, payload, round);
    const nodeVal = pickNodeId(ev, nodeId);

    const base: LogEntry = {
      id: `srv-${Date.now()}-${i}`,
      nodeId: nodeVal,
      round: roundVal,
      type: 'SYSTEM',
      content: '',
      timestamp: ts
    };

    if (typeof ev === 'string') {
      return { ...base, type: 'SYSTEM', content: ev };
    }
    if (!ev || typeof ev !== 'object') {
      return { ...base, type: 'SYSTEM', content: String(ev) };
    }

    const evType = ev.type || ev.event_type;
    const data = payload;
    const labels = {
      reasoningStep: (step: number) => pickText(`Starting step ${step} reasoning`, `开始第 ${step} 步推理`),
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

    // Agent context delta
    if (evType === 'agent_ctx_delta') {
      const raw = typeof data.content === 'string' ? data.content : '';
      const role = String(data.role || '').toLowerCase();
      const agentName: string = data.agent || '';
      const agentId = agentName ? nameToId.get(agentName) : undefined;

      if (role === 'user') {
        const isBroadcastMessage = /\[(Message|消息)\]\s*[^:]+:/.test(raw);
        const isPublicEvent = /Public Event:|公共事件[:：]/.test(raw);
        if (isBroadcastMessage || isPublicEvent) {
          return null as any;
        }
        const text = translateEnvText(raw);
        return { ...base, type: 'SYSTEM', content: text || `[环境反馈] ${agentName || ''}` };
      }

      if (role === 'assistant') {
        const pretty = prettifyAssistantCtx(raw);
        return { ...base, type: 'AGENT_METADATA', agentId, content: pretty || raw || `[智能体回复] ${agentName || ''}` };
      }

      return { ...base, type: 'SYSTEM', content: raw || `[agent_ctx_delta] ${agentName || ''}` };
    }

    // Agent process start/end - metadata only
    if (evType === 'agent_process_start' || evType === 'agent_process_end') {
      if (!includeAllMetadata) return null as any;
      const agentName: string = data.agent || '';
      const agentId = agentName ? nameToId.get(agentName) : undefined;
      return { ...base, type: 'AGENT_METADATA', agentId, content: labels.reasoningDone };
    }

    // Action start (yield is special)
    if (evType === 'action_start') {
      const agentName: string = data.agent || '';
      const actionData = data.action || {};
      const rawName: string = actionData.action || actionData.name || 'unknown';
      const agentId = agentName ? nameToId.get(agentName) : undefined;

      if (rawName === 'yield') {
        return { ...base, type: 'AGENT_METADATA', agentId, content: labels.yieldTurn };
      }
      if (!includeAllMetadata) return null as any;

      const actionName: string = translateActionName(rawName);
      return { ...base, type: 'AGENT_ACTION', agentId, content: agentName ? `${agentName} ${labels.actionStart} ${actionName}` : `${labels.actionStart} ${actionName}` };
    }

    // Plan update - metadata only
    if (evType === 'plan_update') {
      if (!includeAllMetadata) return null as any;
      const agentName: string = data.agent || '';
      const agentId = agentName ? nameToId.get(agentName) : undefined;
      return { ...base, type: 'AGENT_METADATA', agentId, content: labels.planUpdate };
    }

    // Agent error
    if (evType === 'agent_error') {
      const agentName: string = data.agent || '';
      const kind: string = data.kind || '';
      const errText: string = String(data.error || data.message || '').slice(0, 400);
      const agentLabel = agentName || pickText('Unknown', '未知');
      const baseLabel = isZh() ? `智能体「${agentLabel}」发生错误` : `Agent "${agentLabel}" error`;
      const label = baseLabel + (kind ? pickText(` (${kind})`, `（${kind}）`) : '') + (errText ? pickText(`: ${errText}`, `：${errText}`) : '');
      return { ...base, type: 'SYSTEM', content: label };
    }

    // Public broadcast / environment event
    if (evType === 'system_broadcast' || evType === 'public_event') {
      const text = data.text || data.message || JSON.stringify(ev);
      const senderName: string = data.sender || '';
      const eventType: string = data.type || '';

      if (eventType === 'TalkToEvent' && senderName) {
        const agentId = senderName ? nameToId.get(senderName) : undefined;
        return { ...base, type: 'AGENT_SAY', agentId, content: text };
      }

      const talkToMatch = text.match(/^\[[^\]]+\]\s*([^t]+?)\s+to\s+([^:]+?):\s*(.+)$/);
      if (talkToMatch) {
        const talkToSender = talkToMatch[1].trim();
        const agentId = talkToSender ? nameToId.get(talkToSender) : undefined;
        if (agentId) return { ...base, type: 'AGENT_SAY', agentId, content: text };
      }

      const isMessageEvent = eventType === 'MessageEvent' || /\[(Message|消息)\]\s*[^:]+:/.test(text);
      if (isMessageEvent && senderName) {
        const agentId = senderName ? nameToId.get(senderName) : undefined;
        return { ...base, type: 'AGENT_SAY', agentId, content: text };
      }

      return { ...base, type: 'ENVIRONMENT', content: text };
    }

    // Action end
    if (evType === 'action_end') {
      const actorName: string = data.actor || data.agent || data.name || '';
      const actionData = data.action || {};
      const actionName: string = actionData.action || actionData.name || '';
      const agentId = actorName ? nameToId.get(actorName) : undefined;
      const isSpeech = actionName === 'send_message' || actionName === 'say';

      if (isSpeech) return null as any;

      const readableAction = translateActionName(actionName);
      const label = actorName ? `${actorName} ${labels.actionEnd} ${readableAction}` : `${pickText('Performed action', '执行了动作')} ${readableAction}`;
      return { ...base, type: 'AGENT_ACTION', agentId, content: label };
    }

    const text = data.text || data.message || evType || labels.systemEvent;
    return { ...base, type: 'SYSTEM', content: text };
  }).filter((entry): entry is LogEntry => entry !== null);
};

// =============================================================================
// Agent Generation Helpers
// =============================================================================

export const generateAgentsWithAI = async (
  count: number,
  description: string,
  providerId?: number | null,
  language?: string
): Promise<Agent[]> => {
  const { apiClient } = await import('../services/client');
  const body: any = { count, description };
  if (providerId != null) {
    body.provider_id = providerId;
  }
  if (language) {
    body.language = language;
  }

  const res = await apiClient.post("/llm/generate_agents", body);
  const rawAgents: any[] = Array.isArray(res.data)
    ? res.data
    : Array.isArray(res.data?.agents)
    ? res.data.agents
    : [];

  const fallbackRole = language === 'zh' ? "角色" : "Role";
  const fallbackProfile = language === 'zh' ? "暂无描述" : "No description";

  return rawAgents.map((a: any, index: number) => ({
    id: a.id || `gen_${Date.now()}_${index}`,
    name: a.name,
    role: a.role || fallbackRole,
    avatarUrl: a.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(a.name || `agent_${index}`)}`,
    profile: a.profile || fallbackProfile,
    llmConfig: { provider: a.provider || "backend", model: a.model || "default" },
    properties: a.properties || {},
    history: a.history || {},
    memory: a.memory || [],
    knowledgeBase: a.knowledgeBase || []
  }));
};

export async function generateAgentsWithDemographics(
  totalAgents: number,
  demographics: { name: string; categories: string[] }[],
  archetypeProbabilities: Record<string, number>,
  traits: { name: string; mean: number; std: number }[],
  language: string,
  providerId?: string | number
): Promise<Agent[]> {
  const { apiClient } = await import('../services/client');
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

  const fallbackRole = language === 'zh' ? "角色" : "Role";
  const fallbackProfile = language === 'zh' ? "暂无描述" : "No description";

  return rawAgents.map((a: any, index: number) => ({
    id: a.id || `gen_${Date.now()}_${index}`,
    name: a.name,
    role: a.role || fallbackRole,
    avatarUrl: a.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(a.name || `agent_${index}`)}`,
    profile: a.profile || fallbackProfile,
    llmConfig: { provider: a.provider || "backend", model: a.model || "default" },
    properties: a.properties || {},
    history: a.history || {},
    memory: a.memory || [],
    knowledgeBase: a.knowledgeBase || []
  }));
}

// =============================================================================
// Environment Suggestion Helpers
// =============================================================================

/**
 * Fetch environment suggestions using Gemini AI (legacy function for backward compatibility).
 * Note: This uses the Gemini API directly. For production, consider using the backend API instead.
 */
export const fetchEnvironmentSuggestions = async (
  logs: LogEntry[],
  agents: Agent[]
): Promise<Array<{ event: string; reason: string }>> => {
  // Check for API key from various sources
  const apiKey =
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    (window as any).GEMINI_API_KEY ||
    process.env.API_KEY ||
    '';

  if (!apiKey) {
    throw new Error("No API Key - Please set VITE_GEMINI_API_KEY environment variable");
  }

  const { GoogleGenAI, Type } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
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

    const text = response.text;
    return text ? JSON.parse(text) : [];
  } catch (error) {
    console.error("Gemini Env Suggestion Error:", error);
    throw error;
  }
};

// =============================================================================
// System Templates and Preset Agent Generators
// =============================================================================

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

export const SYSTEM_TEMPLATES: SimulationTemplate[] = [
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
  }
];

// Default export for dynamic imports (used by tests)
export default {
  SYSTEM_TEMPLATES,
  addTime,
  formatWorldTime,
  generateNodes,
  mapGraphToNodes,
  generateAgentsWithAI,
  generateAgentsWithDemographics,
  mapBackendEventsToLogs,
  fetchEnvironmentSuggestions
};
