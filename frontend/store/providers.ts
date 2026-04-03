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
  providersLoading: boolean;

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
  providersLoading: false,
  currentProviderId: null,
  selectedProviderId: null,

  // Actions
  loadProviders: async () => {
    console.log('[loadProviders] Starting to load providers...');
    const { listProviders } = await import('../services/providers');
    set({ providersLoading: true });
    try {
      const providers = await listProviders();
      console.log('[loadProviders] Loaded providers:', providers);
      console.log('[loadProviders] Providers count:', providers?.length);
      const current =
        providers.find((p) => p.is_active || p.is_default) || providers[0] || null;

      set({
        llmProviders: providers,
        providersLoading: false,
        currentProviderId: current ? current.id : null,
        selectedProviderId: current ? current.id : null
      });
      console.log('[loadProviders] State updated successfully');
    } catch (e) {
      console.error("[loadProviders] Failed to load providers:", e);
      set({ providersLoading: false });
    }
  },

  setSelectedProvider: (id) => set({ selectedProviderId: id })
});
