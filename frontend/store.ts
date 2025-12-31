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
import { createSimulation as createSimulationApi } from './services/simulations';
import {
  getTreeGraph,
  treeAdvanceChain,
  treeBranchPublic,
  getSimEvents,
  getSimState,
  treeDeleteSubtree,
  type Graph
} from './services/simulationTree';

// ✅ 新增：使用新前端的 client（和 providers.ts 一致）
import { apiClient } from "./services/client";
// ✅ 新增：从设置里的 providers API 读取 provider 列表
import { Provider, listProviders } from "./services/providers";

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

  agents: Agent[];
  logs: LogEntry[];

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
  return date.toLocaleString('zh-CN', {
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
  return graph.nodes.map((n) => {
    const pid = parentMap.has(n.id) ? parentMap.get(n.id)! : null;
    const isLeaf = !childrenSet.has(n.id);
    return {
      id: String(n.id),
      display_id: String(n.id),
      parentId: pid == null ? null : String(pid),
      name: `节点 ${n.id}`,
      depth: n.depth,
      isLeaf,
      status: running.has(n.id) ? 'running' : 'completed',
      timestamp: new Date().toLocaleTimeString(),
      worldTime: nowIso
    };
  });
};

// ★ 后端事件 -> 前端 LogEntry 映射
const mapBackendEventsToLogs = (
  events: any[],
  nodeId: string,
  round: number,
  agents: Agent[]
): LogEntry[] => {
  const nowIso = new Date().toISOString();
  const nameToId = new Map<string, string>();
  agents.forEach(a => nameToId.set(a.name, a.id));

  return (events || []).map((ev: any, i: number): LogEntry => {
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

    // 公共广播 / 环境事件
    if (evType === 'system_broadcast' || evType === 'public_event') {
      const text = data.text || data.message || JSON.stringify(ev);
      return { ...base, type: 'ENVIRONMENT', content: text };
    }

    // 动作结束事件：带 actor + action + summary
    if (evType === 'action_end') {
      const actorName: string =
        data.actor || data.agent || data.name || '';
      const actionData = data.action || {};
      const actionName: string =
        actionData.action || actionData.name || '';
      const summary: string =
        data.summary || data.message || '';

      const agentId = actorName ? nameToId.get(actorName) : undefined;
      const isSpeech =
        actionName === 'send_message' || actionName === 'say';

      return {
        ...base,
        type: isSpeech ? 'AGENT_SAY' : 'AGENT_ACTION',
        agentId,
        content:
          summary ||
          (actorName
            ? `${actorName} 执行了动作 ${actionName || 'unknown'}`
            : `执行了动作 ${actionName || 'unknown'}`)
      };
    }

    // 其它类型，先作为 SYSTEM 展示
    const text = data.text || data.message || JSON.stringify(ev);
    return { ...base, type: 'SYSTEM', content: text };
  });
};

const generateNodes = (): SimNode[] => {
  const now = new Date();
  const startTime = now.toISOString();

  const nodes: SimNode[] = [
    {
      id: 'root',
      display_id: '0',
      parentId: null,
      name: '初始状态',
      depth: 0,
      isLeaf: true,
      status: 'completed',
      timestamp: '10:00',
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
      llmConfig: { provider: 'Anthropic', model: 'claude-3-5-sonnet' },
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

const SYSTEM_TEMPLATES: SimulationTemplate[] = [
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
          ? `系统推进至第 ${
              nodeId === 'root' ? 0 : nodeId === 'n1' ? 1 : 2
            } 回合`
          : '进行了一次交互。',
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
        providers.find((p) => p.is_active || p.is_default) || providers[0];

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
  savedTemplates: [...SYSTEM_TEMPLATES],

  compareTargetNodeId: null,
  isCompareMode: false,
  comparisonSummary: null,

  agents: generateAgents('village', { provider: 'OpenAI', model: 'gpt-4o' }),
  logs: generateLogs(),
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

  setEngineMode: (mode) =>
    set((state) => ({
      engineConfig: {
        ...state.engineConfig,
        mode,
        status: mode === 'connected' ? 'connecting' : 'disconnected'
      }
    })),

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
            logs: []
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
          get().addNotification('success', `仿真 "${newSim.name}" 创建成功`);
        } catch (e) {
          console.error(e);
          get().addNotification('error', '后端创建仿真失败');
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
  },

  updateTimeConfig: (config) => {
    set(state => {
      if (!state.currentSimulation) return {};
      return {
        currentSimulation: { ...state.currentSimulation, timeConfig: config }
      };
    });
    get().addNotification('info', '时间配置已更新');
  },

  updateSocialNetwork: (network) => {
     set(state => {
       if (!state.currentSimulation) return {};
       return {
         currentSimulation: { ...state.currentSimulation, socialNetwork: network }
       };
     });
     get().addNotification('success', '社交网络拓扑已更新');
  },

  saveTemplate: (name, description) => {
    set(state => {
      if (!state.currentSimulation) return {};
      const newTemplate: SimulationTemplate = {
        id: `tmpl_${Date.now()}`,
        name,
        description,
        category: 'custom',
        sceneType: 'village', 
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

  deleteTemplate: (id) => set(state => ({
    savedTemplates: state.savedTemplates.filter(t => t.id !== id)
  })),

  // #14 Report Generation
  generateReport: async () => {
    set({ isGeneratingReport: true });
    try {
       const state = get();
       if (!state.currentSimulation) return;
       const report = await fetchReportWithGemini(state.logs, state.agents);
       
       set(state => ({
          currentSimulation: state.currentSimulation ? { ...state.currentSimulation, report: report } : null,
          isGeneratingReport: false
       }));
       get().addNotification('success', '分析报告生成成功');
    } catch (e) {
       console.error(e);
       set({ isGeneratingReport: false });
       get().addNotification('error', '报告生成失败');
    }
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
              profile: '',
              llmConfig: { provider: 'mock', model: 'default' },
              properties: {},
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

            const logsMapped: LogEntry[] = mapBackendEventsToLogs(
              Array.isArray(events) ? events : [],
              String(res.child),
              turnVal,
              agentsMapped
            );

            set(prev => ({
              logs: [...prev.logs, ...logsMapped],
              agents: agentsMapped,
              isGenerating: false
            }));
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
      
      const tc = state.currentSimulation.timeConfig;
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
      let generatedEvents: any[] = [];
      let isMock = false;

      try {
        generatedEvents = await fetchGeminiLogs(
          'Village Scenario',
          state.agents,
          recentLogs,
          newDepth
        );
      } catch (err) {
        console.warn("Falling back to mock data");
        isMock = true;
      }

      if (generatedEvents.length === 0) {
        generatedEvents = state.agents.map((agent) => ({
          type: Math.random() > 0.5 ? 'AGENT_SAY' : 'AGENT_ACTION',
          agentName: agent.name,
          content: `Mock action in ${formatWorldTime(nextWorldTime)}...`
        }));
      }

      const newLogs: LogEntry[] = [
        {
          id: `sys-${Date.now()}`,
          nodeId: newNodeId,
          round: newDepth,
          type: 'SYSTEM',
          content: `时间推进至: ${formatWorldTime(nextWorldTime)} (Round ${newDepth})`,
          timestamp: newNode.timestamp
        },
        ...generatedEvents.map((evt, i) => {
          const agent = state.agents.find(a => a.name === evt.agentName);
          return {
            id: `gen-${Date.now()}-${i}`,
            nodeId: newNodeId,
            round: newDepth,
            type: evt.type as any,
            agentId: agent ? agent.id : undefined,
            content: evt.content,
            timestamp: newNode.timestamp
          };
        })
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
    set((state) => {
      const baseNode = state.nodes.find(n => n.id === baseNodeId);
      if (!baseNode) return {};
      
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
  
      return {
        nodes: [...updatedNodes, ...newNodes],
        selectedNodeId: newNodes[0].id
      };
    });
    get().addNotification('success', `批量实验 "${experimentName}" 已启动`);
  },

  generateComparisonAnalysis: async () => { /* 保持你原来的实现 */ }
}));
