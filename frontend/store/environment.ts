// frontend/store/environment.ts
//
// Environment suggestions and host actions slice.
//
// Responsibilities:
//   - Manages dynamic environment event suggestions
//   - Environment suggestion generation and application
//   - Host intervention actions (inject logs)
//
// Used by: EnvironmentSuggestion, SimulationPage, host controls

import { StateCreator } from 'zustand';
import {
  apiClient,
} from '../services/client';
import {
  applyEnvironmentEvent,
  dismissSuggestions,
  generateSuggestions,
  getSuggestionStatus,
  type EnvironmentSuggestion,
} from '../services/environmentSuggestions';
import type { StoreState } from './storeState';

export interface EnvironmentSlice {
  // State
  environmentEnabled: boolean;
  environmentSuggestionsAvailable: boolean;
  environmentSuggestions: EnvironmentSuggestion[];
  environmentSuggestionsLoading: boolean;

  // Actions
  checkEnvironmentSuggestions: () => Promise<void>;
  generateEnvironmentSuggestions: () => Promise<void>;
  applyEnvironmentSuggestion: (suggestion: EnvironmentSuggestion) => Promise<void>;
  dismissEnvironmentSuggestions: () => Promise<void>;
  toggleEnvironmentEnabled: () => Promise<void>;
}

export const createEnvironmentSlice: StateCreator<
  StoreState,
  [],
  [],
  EnvironmentSlice
> = (set, get) => ({
  // Initial state
  environmentEnabled: false,
  environmentSuggestionsAvailable: false,
  environmentSuggestions: [],
  environmentSuggestionsLoading: false,

  // Actions
  checkEnvironmentSuggestions: async () => {
    const { currentSimulation } = get();
    if (!currentSimulation?.id) return;

    try {
      const status = await getSuggestionStatus(currentSimulation.id);

      set({
        environmentSuggestionsAvailable: status.available || false,
        environmentEnabled: status.enabled || false
      });
    } catch (e) {
      console.warn('Failed to check environment suggestions', e);
    }
  },

  generateEnvironmentSuggestions: async () => {
    const { currentSimulation } = get();
    if (!currentSimulation?.id) return;

    set({ environmentSuggestionsLoading: true });

    try {
      const suggestions = await generateSuggestions(currentSimulation.id);

      set({
        environmentSuggestions: suggestions,
        environmentSuggestionsAvailable: false,
        environmentSuggestionsLoading: false
      });
    } catch (e) {
      console.error('Failed to generate environment suggestions', e);
      set({ environmentSuggestionsLoading: false });
      const { addNotification } = get();
      addNotification?.('error', '生成环境事件建议失败');
    }
  },

  applyEnvironmentSuggestion: async (suggestion) => {
    const { currentSimulation } = get();
    if (!currentSimulation?.id) return;

    try {
      await applyEnvironmentEvent(currentSimulation.id, suggestion);

      // Inject as a log entry
      const { selectedNodeId, injectLog } = get();
      if (selectedNodeId && injectLog) {
        injectLog(
          'ENVIRONMENT',
          `[环境事件] ${suggestion.description}`
        );
      }

      set({ environmentSuggestions: [] });
      const { addNotification } = get();
      addNotification?.('success', '环境事件已应用');
    } catch (e) {
      console.error('Failed to apply environment suggestion', e);
      const { addNotification } = get();
      addNotification?.('error', '应用环境事件失败');
    }
  },

  dismissEnvironmentSuggestions: async () => {
    const { currentSimulation } = get();
    set({ environmentSuggestions: [] });

    if (!currentSimulation?.id) return;

    await dismissSuggestions(currentSimulation.id);
  },

  toggleEnvironmentEnabled: async () => {
    const { currentSimulation, environmentEnabled } = get();
    if (!currentSimulation?.id) return;

    const newState = !environmentEnabled;

    try {
      await apiClient.patch(`simulations/${currentSimulation.id}`, {
        scene_config: { environment_enabled: newState }
      });

      set({ environmentEnabled: newState });
      const { addNotification } = get();
      addNotification?.('success', newState ? '环境事件已启用' : '环境事件已禁用');
    } catch (e) {
      console.error('Failed to toggle environment', e);
      const { addNotification } = get();
      addNotification?.('error', '切换环境事件状态失败');
    }
  }
});
