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
import type { Notification, GuideMessage } from '../types';

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

  // Loading states
  isGenerating: boolean;
  isGeneratingReport: boolean;

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

  // Notification actions
  addNotification: (type: 'success' | 'error' | 'info', message: string) => void;
  removeNotification: (id: string) => void;

  // Guide actions
  toggleGuide: (isOpen: boolean) => void;
  sendGuideMessage: (content: string) => Promise<void>;
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
  isGenerating: false,
  isGeneratingReport: false,
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
      const { apiClient } = await import('../services/client');
      const response = await apiClient.post<{ message: string }>('llm/guide', {
        history: get().guideMessages.map((m) => ({
          role: m.role,
          content: m.content
        }))
      });

      const assistantMessage: GuideMessage = {
        id: `guide-${Date.now()}`,
        role: 'assistant',
        content: response.data.message || ''
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
