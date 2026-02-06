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
import type { Provider } from '../services/providers';

export interface Provider {
  id: number;
  name: string;
  provider: string;
  model: string;
  base_url: string | null;
  last_test_status?: string | null;
  last_tested_at?: string | null;
  has_api_key: boolean;
  config?: Record<string, unknown> | null;
  is_active?: boolean;
  is_default?: boolean;
}

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
  ProvidersSlice,
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
    const { listProviders } = await import('../services/providers');
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
