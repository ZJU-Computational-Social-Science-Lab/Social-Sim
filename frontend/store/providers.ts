// frontend/store/providers.ts
//
// LLM provider management slice.
//
// Responsibilities:
//   - Manages list of configured LLM providers
//   - Tracks current active and selected provider
//   - Loads providers from backend API
//
// Used by: SettingsPage, SimulationWizard, any component that needs LLM access

import { StateCreator } from 'zustand';
import { listProviders, type Provider } from '../services/providers';
import type { StoreState } from './storeState';

export interface ProvidersSlice {
  // State
  llmProviders: Provider[];
  currentProviderId: number | null;
  selectedProviderId: number | null;

  // Actions
  loadProviders: () => Promise<void>;
  setSelectedProvider: (id: number | null) => void;
}

export const createProvidersSlice: StateCreator<
  StoreState,
  [],
  [],
  ProvidersSlice
> = (set, get) => ({
  // Initial state
  llmProviders: [],
  currentProviderId: null,
  selectedProviderId: null,

  // Actions
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

  setSelectedProvider: (id) => set({ selectedProviderId: id })
});
