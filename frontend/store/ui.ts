// frontend/store/ui.ts
//
// UI state management slice.
//
// Responsibilities:
//   - Manages all modal open/close states
//   - Toast notifications
//   - Guide assistant state
//
// Used by: All components with modals, Layout for notifications, GuideAssistant

import { StateCreator } from 'zustand';
import i18n from '../i18n';
import type { Notification, GuideActionType, GuideMessage } from '../types';

const SUPPORTED_GUIDE_ACTIONS: GuideActionType[] = [
  'OPEN_WIZARD',
  'OPEN_NETWORK',
  'OPEN_EXPERIMENT',
  'OPEN_EXPORT',
  'OPEN_ANALYTICS',
  'OPEN_HOST',
  'OPEN_REPORT',
  'OPEN_KNOWLEDGE',
  'OPEN_MULTIMODAL',
  'OPEN_ENVIRONMENT',
];

const GUIDE_ACTION_SET = new Set<GuideActionType>(SUPPORTED_GUIDE_ACTIONS);
const GUIDE_ACTION_TAG_PATTERN = /\[\[(OPEN_[A-Z_]+)\]\]/g;

export function parseGuideResponse(rawContent: string): Pick<GuideMessage, 'content' | 'suggestedActions'> {
  const suggestedActions = Array.from(rawContent.matchAll(GUIDE_ACTION_TAG_PATTERN))
    .map((match) => match[1] as GuideActionType)
    .filter((action, index, actions) => GUIDE_ACTION_SET.has(action) && actions.indexOf(action) === index);

  const content = rawContent
    .replace(GUIDE_ACTION_TAG_PATTERN, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    content,
    suggestedActions,
  };
}

export function buildGuidePrompt(systemPrompt: string, history: GuideMessage[]): string {
  const transcript = history
    .map((message) => `${message.role === 'assistant' ? 'Assistant' : 'User'}: ${message.content}`)
    .join('\n\n');

  return [
    systemPrompt,
    'Conversation history:',
    transcript,
    'Respond to the most recent user message as the platform guide assistant.',
    'Keep any [[OPEN_*]] action tags at the end of the response.',
  ].join('\n\n');
}

export interface UISlice {
  // Modal states
  isWizardOpen: boolean;
  isHelpModalOpen: boolean;
  isAnalyticsOpen: boolean;
  isExportOpen: boolean;
  isExperimentDesignerOpen: boolean;
  isTimeSettingsOpen: boolean;
  isSaveTemplateOpen: boolean;
  isNetworkEditorOpen: boolean;
  isReportModalOpen: boolean;
  globalKnowledgeOpen: boolean;
  isInitialEventsOpen: boolean;
  isSyncModalOpen: boolean;
  isSnapshotModalOpen: boolean;
  isTreeOpsModalOpen: boolean;

  // Loading states
  isGenerating: boolean;
  isGeneratingReport: boolean;
  isSyncing: boolean;

  // Sync logs
  syncLogs: string[];

  // Notifications
  notifications: Notification[];

  // Guide assistant
  isGuideOpen: boolean;
  guideMessages: GuideMessage[];
  isGuideLoading: boolean;

  // Modal toggle actions
  toggleWizard: (isOpen: boolean) => void;
  toggleHelpModal: (isOpen: boolean) => void;
  toggleAnalytics: (isOpen: boolean) => void;
  toggleExport: (isOpen: boolean) => void;
  toggleExperimentDesigner: (isOpen: boolean) => void;
  toggleTimeSettings: (isOpen: boolean) => void;
  toggleSaveTemplate: (isOpen: boolean) => void;
  toggleNetworkEditor: (isOpen: boolean) => void;
  toggleReportModal: (isOpen: boolean) => void;
  setGlobalKnowledgeOpen: (isOpen: boolean) => void;
  toggleInitialEvents: (isOpen: boolean) => void;
  openSyncModal: () => void;
  closeSyncModal: () => void;
  openSnapshotModal: () => void;
  closeSnapshotModal: () => void;
  openTreeOpsModal: () => void;
  closeTreeOpsModal: () => void;
  syncCurrentSimulation: () => Promise<void>;

  // Notification actions
  addNotification: (type: 'success' | 'error' | 'info', message: string) => void;
  removeNotification: (id: string) => void;

  // Guide actions
  toggleGuide: (isOpen: boolean) => void;
  sendGuideMessage: (content: string) => Promise<void>;

  // Tab navigation
  activeTab: 'timeline' | 'agents';
  peekTab: 'timeline' | 'agents' | null;
  peekOverlayActive: boolean;
  setActiveTab: (tab: 'timeline' | 'agents') => void;
  setPeekTab: (tab: 'timeline' | 'agents' | null) => void;
  setPeekOverlayActive: (active: boolean) => void;
}

export const createUISlice: StateCreator<
  UISlice,
  [],
  [],
  UISlice
> = (set, get) => ({
  // Initial state
  isWizardOpen: false,
  isHelpModalOpen: false,
  isAnalyticsOpen: false,
  isExportOpen: false,
  isExperimentDesignerOpen: false,
  isTimeSettingsOpen: false,
  isSaveTemplateOpen: false,
  isNetworkEditorOpen: false,
  isReportModalOpen: false,
  globalKnowledgeOpen: false,
  isInitialEventsOpen: false,
  isSyncModalOpen: false,
  isSnapshotModalOpen: false,
  isTreeOpsModalOpen: false,
  isGenerating: false,
  isGeneratingReport: false,
  isSyncing: false,
  syncLogs: [],
  notifications: [],
  isGuideOpen: false,
  guideMessages: [],
  isGuideLoading: false,
  activeTab: 'timeline',
  peekTab: null,
  peekOverlayActive: false,

  // Modal toggle actions
  toggleWizard: (isOpen) => set({ isWizardOpen: isOpen }),
  toggleHelpModal: (isOpen) => set({ isHelpModalOpen: isOpen }),
  toggleAnalytics: (isOpen) => set({ isAnalyticsOpen: isOpen }),
  toggleExport: (isOpen) => set({ isExportOpen: isOpen }),
  toggleExperimentDesigner: (isOpen) => set({ isExperimentDesignerOpen: isOpen }),
  toggleTimeSettings: (isOpen) => set({ isTimeSettingsOpen: isOpen }),
  toggleSaveTemplate: (isOpen) => set({ isSaveTemplateOpen: isOpen }),
  toggleNetworkEditor: (isOpen) => set({ isNetworkEditorOpen: isOpen }),
  toggleReportModal: (isOpen) => set({ isReportModalOpen: isOpen }),
  setGlobalKnowledgeOpen: (isOpen) => set({ globalKnowledgeOpen: isOpen }),
  toggleInitialEvents: (isOpen) => set({ isInitialEventsOpen: isOpen }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setPeekTab: (tab) => set({ peekTab: tab }),
  setPeekOverlayActive: (active) => set({ peekOverlayActive: active }),

  // Notification actions
  addNotification: (type, message) => {
    const id = `notif-${Date.now()}-${Math.random()}`;
    const notification: Notification = { id, type, message };
    set((state) => ({ notifications: [...state.notifications, notification] }));

    // Auto-remove after 4 seconds
    setTimeout(() => {
      get().removeNotification(id);
    }, 4000);
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id)
    }));
  },

  // Guide actions
  toggleGuide: (isOpen) => set({ isGuideOpen: isOpen }),

  openSyncModal: () => set({ isSyncModalOpen: true, syncLogs: [] }),

  closeSyncModal: () => set({ isSyncModalOpen: false, isSyncing: false }),

  openSnapshotModal: () => set({ isSnapshotModalOpen: true }),

  closeSnapshotModal: () => set({ isSnapshotModalOpen: false }),

  openTreeOpsModal: () => set({ isTreeOpsModalOpen: true }),

  closeTreeOpsModal: () => set({ isTreeOpsModalOpen: false }),

  syncCurrentSimulation: async () => {
    set({ isSyncing: true, syncLogs: ['Starting sync...'] });

    try {
      const state = get() as any;
      const currentSim = state.currentSimulation;
      const agents = state.agents || [];
      const nodes = state.nodes || [];

      if (!currentSim) {
        set((prev: any) => ({ syncLogs: [...prev.syncLogs, 'Error: No simulation loaded'], isSyncing: false }));
        return;
      }

      set((prev: any) => ({ syncLogs: [...prev.syncLogs, `Syncing simulation: ${currentSim.name || currentSim.id}`] }));
      set((prev: any) => ({ syncLogs: [...prev.syncLogs, `Agents: ${agents.length}`] }));
      set((prev: any) => ({ syncLogs: [...prev.syncLogs, `Nodes: ${nodes.length}`] }));

      const { apiClient } = await import('../services/client');
      const syncPayload = {
        simulation_id: currentSim.id,
        agents: agents.map((agent: any) => ({
          name: agent.name,
          role: agent.role,
          properties: agent.properties || {},
          memory: agent.memory || [],
        })),
        nodes: nodes.map((node: any) => ({
          id: node.id,
          parentId: node.parentId,
          depth: node.depth,
          meta: node.meta || {},
        })),
      };
      const nextAgentConfig = {
        ...(currentSim.agent_config || {}),
        agents: agents,
      };

      const socialNetwork = currentSim.socialNetwork || currentSim.scene_config?.social_network || {};
      const nextSceneConfig = Object.keys(socialNetwork).length > 0
        ? {
            ...(currentSim.scene_config || {}),
            social_network: socialNetwork,
          }
        : currentSim.scene_config;

      set((prev: any) => ({ syncLogs: [...prev.syncLogs, 'Sending data to backend...'] }));

      await apiClient.patch(`simulations/${currentSim.id}`, {
        agent_config: nextAgentConfig,
        ...(nextSceneConfig ? { scene_config: nextSceneConfig } : {}),
      });

      await apiClient.post(`simulations/${currentSim.id}/save`, {
        label: `Manual sync ${syncPayload.simulation_id} ${new Date().toISOString()}`,
      });

      set((prev: any) => ({
        currentSimulation: {
          ...prev.currentSimulation,
          agent_config: nextAgentConfig,
          ...(nextSceneConfig ? { scene_config: nextSceneConfig, socialNetwork } : {}),
        },
      }));

      set((prev: any) => ({ syncLogs: [...prev.syncLogs, 'Sync completed successfully!'], isSyncing: false }));
    } catch (error: any) {
      console.error('Sync failed:', error);
      const errorMsg = error?.response?.data?.detail || error?.message || 'Unknown error';
      set((prev: any) => ({ syncLogs: [...prev.syncLogs, `Sync failed: ${errorMsg}`], isSyncing: false }));
    }
  },

  sendGuideMessage: async (content) => {
    set({ isGuideLoading: true });
    const userMessage: GuideMessage = {
      id: `guide-${Date.now()}`,
      role: 'user',
      content
    };
    set((state) => ({
      guideMessages: [...state.guideMessages, userMessage]
    }));

    try {
      const { apiClient } = await import('../services/client');
      const history = get().guideMessages;
      const prompt = buildGuidePrompt(i18n.t('guidePrompt.systemPrompt'), history);
      const response = await apiClient.post<{ text: string }>('llm/refine_report', {
        prompt,
      });
      const responseText = (response.data.text || i18n.t('guidePrompt.defaultResponse')).trim();
      const parsedResponse = parseGuideResponse(responseText);

      const assistantMessage: GuideMessage = {
        id: `guide-${Date.now()}`,
        role: 'assistant',
        content: parsedResponse.content || i18n.t('guidePrompt.defaultResponse'),
        suggestedActions: parsedResponse.suggestedActions.length > 0 ? parsedResponse.suggestedActions : undefined,
      };
      set((state) => ({
        guideMessages: [...state.guideMessages, assistantMessage],
        isGuideLoading: false
      }));
    } catch (e) {
      console.error('Guide message failed', e);
      const errorMessage: GuideMessage = {
        id: `guide-${Date.now()}`,
        role: 'assistant',
        content: i18n.t('guidePrompt.connectionTimeout')
      };
      set((state) => ({
        guideMessages: [...state.guideMessages, errorMessage],
        isGuideLoading: false
      }));
    }
  }
});
