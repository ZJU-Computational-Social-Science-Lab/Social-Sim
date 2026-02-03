

export interface SimNode {
  id: string;
  display_id: string; // #5 新增层级化 ID (如 0.1.2)
  parentId: string | null;
  name: string;
  depth: number;
  isLeaf: boolean;
  status: 'completed' | 'running' | 'failed' | 'pending';
  timestamp: string; // System timestamp of creation
  worldTime: string; // #9 Simulated world time (ISO string)
}

export interface LLMConfig {
  provider: string;
  model: string;
}

export interface UploadedAsset {
  url: string;
  filename: string;
  size: number;
  content_type: string;
  extracted_text?: string | null;
}

// # Integration: Platform Connection Status
export type EngineMode = 'standalone' | 'connected';

export interface EngineConfig {
  mode: EngineMode;
  endpoint: string; // e.g., "http://localhost:8000/api"
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  latency?: number;
  token?: string;
}

// #23 RAG Knowledge Base Item
export interface KnowledgeItem {
  id: string;
  title: string;
  type: 'text' | 'file' | 'url';
  content: string; // Text content or URL
  enabled: boolean;
  timestamp: string;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  avatarUrl: string;
  profile: string; // 静态画像描述
  llmConfig: LLMConfig; // #10 LLM 配置
  properties: Record<string, any>; // 动态属性 (如信任值, 压力值)
  // #14 新增历史数据用于趋势分析
  history: Record<string, number[]>; // key: property name, value: array of values per round
  memory: MemoryItem[];
  knowledgeBase: KnowledgeItem[]; // #23 动态知识库
}

export interface MemoryItem {
  id: string;
  round: number;
  content: string;
  type: 'dialogue' | 'observation' | 'thought';
  timestamp: string;
}

export interface LogEntry {
  id: string;
  nodeId: string;
  type: 'SYSTEM' | 'AGENT_ACTION' | 'AGENT_SAY' | 'ENVIRONMENT' | 'HOST_INTERVENTION' | 'AGENT_METADATA';
  agentId?: string;
  content: string;
  imageUrl?: string; // #24 Multimodal Content
  imageAlt?: string; // Alt text for accessibility
  audioUrl?: string;
  videoUrl?: string;
  timestamp: string;
  round: number;
}

export interface InitialEventItem {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  imageAlt?: string; // Alt text for accessibility
  audioUrl?: string;
  videoUrl?: string;
}

// #9 Time Configuration
export type TimeUnit = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';

export interface TimeConfig {
  baseTime: string; // ISO string start time
  unit: TimeUnit;
  step: number;
}

// #22 Social Network Topology
// Adjacency List: agentId -> array of agentIds they can send messages to
export type SocialNetwork = Record<string, string[]>;

// #14 Simulation Report
export interface SimulationReport {
  id: string;
  generatedAt: string;
  refinedByLLM?: boolean;
  summary: string;
  keyEvents: { round: number; description: string }[];
  agentAnalysis: { agentName: string; analysis: string }[];
  suggestions: string[];
  roundStats?: { round: number; actions: number; errors: number; broadcasts: number }[];
}

// #20 Template System
export interface SimulationTemplate {
  id: string;
  name: string;
  description: string;
  category: 'system' | 'custom';
  sceneType: string; // underlying hardcoded logic type (village, council, etc., or 'generic' for custom templates)
  agents: Agent[]; // Pre-configured agents
  defaultTimeConfig: TimeConfig;
  defaultNetwork?: SocialNetwork; // #22
  genericConfig?: GenericTemplateConfig; // For custom templates built with TemplateBuilder
}

export interface Simulation {
  id: string;
  name: string; // #7 自定义实验名称
  templateId: string;
  status: 'active' | 'archived';
  createdAt: string;
  timeConfig: TimeConfig; // #9
  socialNetwork: SocialNetwork; // #22
  report?: SimulationReport; // #14
  scene_config?: Record<string, any>; // Dynamic environment config
}

export enum ViewMode {
  LIST = 'LIST',
  CARD = 'CARD',
  TIMELINE = 'TIMELINE'
}

// #18 Parallel Experiment Types
export interface Intervention {
  id: string;
  type: 'ENVIRONMENT' | 'AGENT_PROPERTY' | 'INSTRUCTION';
  targetId?: string; // agentId if applicable
  description: string;
}

export interface ExperimentVariant {
  id: string;
  name: string;
  description?: string;
  interventions: Intervention[];
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

// #13 Guide Assistant Message
export interface GuideMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestedActions?: GuideActionType[]; // Actions parsed from content
}

export type GuideActionType =
  | 'OPEN_WIZARD'
  | 'OPEN_NETWORK'
  | 'OPEN_EXPERIMENT'
  | 'OPEN_EXPORT'
  | 'OPEN_ANALYTICS'
  | 'OPEN_HOST';

// =============================================================================
// Generic Template System Types
// =============================================================================

export type CoreMechanicType = 'grid' | 'discussion' | 'voting' | 'resources' | 'hierarchy' | 'time';

export interface CoreMechanicConfig {
  type: CoreMechanicType;
  enabled: boolean;
  config: Record<string, any>;
}

export interface SemanticActionConfig {
  name: string;
  description: string;
  instruction: string;
  parameters?: Record<string, string>;
  effect?: string;
}

export interface AgentArchetypeConfig {
  name: string;
  rolePrompt: string;
  style?: string;
  userProfile?: string;
  properties?: Record<string, any>;
  allowedActions?: string[];
}

export interface GenericTemplateConfig {
  id: string;
  name: string;
  description: string;
  version?: string;
  coreMechanics: CoreMechanicConfig[];
  availableActions: string[];  // Array of action IDs from ACTION_SPACE_MAP
  environment: {
    description: string;
    rules?: string[];
  };
  defaultTimeConfig?: TimeConfig;
}
