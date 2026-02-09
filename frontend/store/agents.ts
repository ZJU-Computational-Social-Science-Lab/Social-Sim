// frontend/store/agents.ts
//
// Agent management slice.
//
// Responsibilities:
//   - Manages agent list and properties
//   - Agent profile updates
//   - Knowledge base management per agent
//   - Initial events management
//
// Used by: AgentPanel, DemographicsBuilder, any component managing agents

import { StateCreator } from 'zustand';
import type { Agent, KnowledgeItem, InitialEventItem, LogEntry } from '../types';

export interface AgentsSlice {
  // State
  agents: Agent[];
  initialEvents: InitialEventItem[];

  // Agent actions
  setAgents: (agents: Agent[]) => void;
  updateAgentProperty: (agentId: string, property: string, value: any) => void;
  updateAgentProfile: (agentId: string, profile: string) => void;

  // Knowledge base actions
  addKnowledgeToAgent: (agentId: string, item: KnowledgeItem) => void;
  removeKnowledgeFromAgent: (agentId: string, itemId: string) => void;
  updateKnowledgeInAgent: (agentId: string, itemId: string, updates: Partial<KnowledgeItem>) => void;

  // Initial events actions
  addInitialEvent: (title: string, content: string, imageUrl?: string, audioUrl?: string, videoUrl?: string) => void;
}

export const createAgentsSlice: StateCreator<
  AgentsSlice,
  [],
  [],
  AgentsSlice
> = (set, get) => ({
  // Initial state
  agents: [],
  initialEvents: [],

  // Agent actions
  setAgents: (agents) => set({ agents }),

  updateAgentProperty: (agentId, property, value) => {
    set((state) => ({
      agents: state.agents.map((a) => {
        if (a.id === agentId) {
          return { ...a, properties: { ...a.properties, [property]: value } };
        }
        return a;
      })
    }));

    const agentName = get().agents.find((a) => a.id === agentId)?.name || agentId;
    // Access injectLog and addNotification via get() - they exist in other slices
    const injectLog = (get() as any).injectLog;
    const addNotification = (get() as any).addNotification;
    injectLog?.('HOST_INTERVENTION', `Host 修改了 ${agentName} 的属性 [${property}] 为 ${value}`);
    addNotification?.('success', '智能体属性已更新');
  },

  updateAgentProfile: (agentId, profile) => {
    set((state) => ({
      agents: state.agents.map((a) => (a.id === agentId ? { ...a, profile } : a))
    }));
    const agentName = get().agents.find((a) => a.id === agentId)?.name || agentId;
    const injectLog = (get() as any).injectLog;
    const addNotification = (get() as any).addNotification;
    injectLog?.('HOST_INTERVENTION', `Host 更新了 ${agentName} 的个人简介`);
    addNotification?.('success', '智能体简介已更新');
  },

  // Knowledge base actions
  addKnowledgeToAgent: (agentId, item) => {
    set((state) => ({
      agents: state.agents.map((a) => {
        if (a.id === agentId) {
          return { ...a, knowledgeBase: [...a.knowledgeBase, item] };
        }
        return a;
      })
    }));
    const agentName = get().agents.find((a) => a.id === agentId)?.name || agentId;
    const injectLog = (get() as any).injectLog;
    const addNotification = (get() as any).addNotification;
    injectLog?.('HOST_INTERVENTION', `Host 给 ${agentName} 添加了知识: ${item.title}`);
    addNotification?.('success', '知识已添加');
  },

  removeKnowledgeFromAgent: (agentId, itemId) => {
    set((state) => ({
      agents: state.agents.map((a) => {
        if (a.id === agentId) {
          return { ...a, knowledgeBase: a.knowledgeBase.filter((k) => k.id !== itemId) };
        }
        return a;
      })
    }));
    const addNotification = (get() as any).addNotification;
    addNotification?.('success', '知识已移除');
  },

  updateKnowledgeInAgent: (agentId, itemId, updates) => {
    set((state) => ({
      agents: state.agents.map((a) => {
        if (a.id === agentId) {
          return {
            ...a,
            knowledgeBase: a.knowledgeBase.map((k) =>
              k.id === itemId ? { ...k, ...updates } : k
            )
          };
        }
        return a;
      })
    }));
    const addNotification = (get() as any).addNotification;
    addNotification?.('success', '知识已更新');
  },

  // Initial events actions
  addInitialEvent: (title, content, imageUrl, audioUrl, videoUrl) => {
    const id = `init-${Date.now()}`;
    const newEvent: InitialEventItem = { id, title, content, imageUrl, audioUrl, videoUrl };
    const selectedNodeId = (get() as any).selectedNodeId;
    const logs = (get() as any).logs || [];

    set((state) => ({
      initialEvents: [...(state.initialEvents || []), newEvent]
    }));

    // Also add to logs via the logs slice
    const setLogs = (get() as any).setLogs;
    if (setLogs && selectedNodeId) {
      setLogs([
        ...logs,
        {
          id,
          nodeId: selectedNodeId,
          round: 0,
          type: 'ENVIRONMENT',
          content: `[初始事件] ${title}\n${content}` +
            (audioUrl ? `\n[audio: ${audioUrl}]` : '') +
            (videoUrl ? `\n[video: ${videoUrl}]` : ''),
          imageUrl,
          audioUrl,
          videoUrl,
          timestamp: new Date().toISOString()
        }
      ]);
    }

    const addNotification = (get() as any).addNotification;
    addNotification?.('success', '初始事件已保存');
  }
});
