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
import { apiClient } from '../services/client';
import type { GuideActionType, Notification, GuideMessage } from '../types';
import type { StoreState } from './storeState';

const GUIDE_ACTION_PATTERN = /\[\[(OPEN_[A-Z_]+)\]\]/g;
const SUPPORTED_GUIDE_ACTIONS = new Set<string>([
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
]);

const parseGuideActions = (content: string): GuideActionType[] =>
  Array.from(content.matchAll(GUIDE_ACTION_PATTERN))
    .map((match) => match[1] as GuideActionType)
    .filter((action) => SUPPORTED_GUIDE_ACTIONS.has(action));

const stripGuideActions = (content: string): string =>
  content.replace(GUIDE_ACTION_PATTERN, '').trim();

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
  syncCurrentSimulation: () => Promise<void>;
  openSnapshotModal: () => void;
  closeSnapshotModal: () => void;
  openTreeOpsModal: () => void;
  closeTreeOpsModal: () => void;

  // Notification actions
  addNotification: (type: 'success' | 'error' | 'info', message: string) => void;
  removeNotification: (id: string) => void;

  // Guide actions
  toggleGuide: (isOpen: boolean) => void;
  sendGuideMessage: (content: string) => Promise<void>;
}

export const createUISlice: StateCreator<
  StoreState,
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
      // Get current simulation state from store
      const state = get();
      const currentSim = state.currentSimulation;
      const agents = state.agents || [];
      const nodes = state.nodes || [];

      if (!currentSim) {
        set((prev) => ({ syncLogs: [...prev.syncLogs, 'Error: No simulation loaded'], isSyncing: false }));
        return;
      }

      // Add sync log entries
      set((prev) => ({ syncLogs: [...prev.syncLogs, `Syncing simulation: ${currentSim.name || currentSim.id}`] }));
      set((prev) => ({ syncLogs: [...prev.syncLogs, `Agents: ${agents.length}`] }));
      set((prev) => ({ syncLogs: [...prev.syncLogs, `Nodes: ${nodes.length}`] }));

      // Import API service
      // Sync simulation state to backend
      const syncPayload = {
        simulation_id: currentSim.id,
        agents: agents.map((a: any) => ({
          name: a.name,
          role: a.role,
          properties: a.properties || {},
          memory: a.memory || []
        })),
        nodes: nodes.map((n: any) => ({
          id: n.id,
          parentId: n.parentId,
          depth: n.depth,
          meta: n.meta || {}
        }))
      };

      set((prev) => ({ syncLogs: [...prev.syncLogs, 'Sending data to backend...'] }));

      await apiClient.post(`simulations/${currentSim.id}/sync`, syncPayload);

      set((prev) => ({ syncLogs: [...prev.syncLogs, 'Sync completed successfully!'], isSyncing: false }));
    } catch (error: any) {
      console.error('Sync failed:', error);
      const errorMsg = error?.response?.data?.detail || error?.message || 'Unknown error';
      set((prev) => ({ syncLogs: [...prev.syncLogs, `Sync failed: ${errorMsg}`], isSyncing: false }));
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
      // Call backend guide API
      const state = get();
      const response = await apiClient.post<{ message: string }>('llm/guide', {
        provider_id: state.selectedProviderId ?? state.currentProviderId ?? undefined,
        history: state.guideMessages.map((m) => ({
          role: m.role,
          content: m.content
        }))
      });

      const assistantMessage: GuideMessage = {
        id: `guide-${Date.now()}`,
        role: 'assistant',
        content: stripGuideActions(response.data.message || ''),
        suggestedActions: parseGuideActions(response.data.message || '')
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
        content: '抱歉，助手暂时无法回复。'
      };
      set((state) => ({
        guideMessages: [...state.guideMessages, errorMessage],
        isGuideLoading: false
      }));
    }
  }
});
