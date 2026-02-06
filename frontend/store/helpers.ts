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
import type { Agent, LogEntry, TimeUnit, TimeConfig, SimNode } from '../types';
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
  providerId?: number | null
): Promise<Agent[]> => {
  const { apiClient } = await import('../services/client');
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
    avatarUrl: a.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(a.name || `agent_${index}`)}`,
    profile: a.profile || "暂无描述",
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

  return rawAgents.map((a: any, index: number) => ({
    id: a.id || `gen_${Date.now()}_${index}`,
    name: a.name,
    role: a.role || "角色",
    avatarUrl: a.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(a.name || `agent_${index}`)}`,
    profile: a.profile || "暂无描述",
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
