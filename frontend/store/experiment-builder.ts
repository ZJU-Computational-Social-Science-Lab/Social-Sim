/**
 * Experiment Builder State Management
 *
 * Manages the state for the 5-step Experiment Builder UI.
 * Provides actions for updating configuration and validation.
 */

// MODULE LOAD CHECK
console.log('[experiment-builder.ts] STORE MODULE LOADED');

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  ScenarioData,
  ScenarioParam,
  ActionDef,
  getAllScenarios,
  getScenario,
  getScenarioActions,
} from '../services/scenarios';

export interface LLMProvider {
  id: number;
  name: string;
  provider: string;
  model?: string;
  base_url?: string;
  is_active?: boolean;
  is_default?: boolean;
}

export interface ManualAgentType {
  id: string;
  label: string;
  count: number;
  rolePrompt: string;
  userProfile: string;
  properties: Record<string, unknown>;
}

export interface ExperimentBuilderState {
  // Current step
  currentStep: 1 | 2 | 3 | 4 | 5;
  completedSteps: Set<1 | 2 | 3 | 4 | 5>;

  // Step 1: Scenario selection
  selectedScenarioId: string | null;
  selectedScenarioData: ScenarioData | null;

  // Step 2: Scenario configuration
  scenarioDescription: string;
  scenarioParams: Record<string, unknown>;

  // Step 3: Actions
  availableActions: ActionDef[];
  selectedActionIds: string[];

  // Step 4: Agents
  agentMode: 'manual' | 'demographic' | 'import';
  agentTypes: ManualAgentType[];
  llmProviders: LLMProvider[];
  selectedProviderId: number | null;

  // Validation
  validationErrors: Record<string, string>;
}

interface ExperimentBuilderActions {
  // Navigation
  setCurrentStep: (step: 1 | 2 | 3 | 4 | 5) => void;
  nextStep: () => void;
  prevStep: () => void;
  markStepComplete: (step: 1 | 2 | 3 | 4 | 5) => void;

  // Step 1: Scenario selection
  setSelectedScenarioId: (id: string | null) => void;
  setSelectedScenarioData: (data: ScenarioData | null) => void;

  // Step 2: Scenario configuration
  setScenarioDescription: (description: string) => void;
  setScenarioParams: (params: Record<string, unknown>) => void;

  // Step 3: Actions
  setAvailableActions: (actions: ActionDef[]) => void;
  setSelectedActionIds: (ids: string[]) => void;
  toggleActionId: (id: string) => void;

  // Step 4: Agents
  setAgentMode: (mode: 'manual' | 'demographic' | 'import') => void;
  addAgentType: (agentType: ManualAgentType) => void;
  removeAgentType: (id: string) => void;
  updateAgentType: (id: string, updates: Partial<ManualAgentType>) => void;
  loadProviders: () => Promise<void>;
  setSelectedProviderId: (id: number | null) => void;

  // Validation
  validate: () => boolean;

  // Reset
  reset: () => void;
}

const initialState: ExperimentBuilderState = {
  currentStep: 1,
  completedSteps: new Set(),
  selectedScenarioId: null,
  selectedScenarioData: null,
  scenarioDescription: '',
  scenarioParams: {},
  availableActions: [],
  selectedActionIds: [],
  agentMode: 'manual',
  agentTypes: [],
  llmProviders: [],
  selectedProviderId: null,
  validationErrors: {},
};

export const STEPS = [
  { id: 1, title: 'Choose Scenario', description: 'Pick a preset or start blank' },
  { id: 2, title: 'Configure Scenario', description: 'Set description and parameters' },
  { id: 3, title: 'Select Actions', description: 'Choose what agents can do' },
  { id: 4, title: 'Create Agents', description: 'Define who participates' },
  { id: 5, title: 'Review', description: 'Preview what agents will see' },
];

export const useExperimentBuilder = create<ExperimentBuilderState & ExperimentBuilderActions>((set, get) => ({
  ...initialState,

  // Navigation
  setCurrentStep: (step) => set({ currentStep: step }),

  nextStep: () => {
    const current = get().currentStep;
    if (current < 5) {
      set({ currentStep: (current + 1) as 1 | 2 | 3 | 4 | 5 });
    }
  },

  prevStep: () => {
    const current = get().currentStep;
    if (current > 1) {
      set({ currentStep: (current - 1) as 1 | 2 | 3 | 4 | 5 });
    }
  },

  markStepComplete: (step) => {
    const completed = new Set(get().completedSteps);
    completed.add(step);
    set({ completedSteps: completed });
  },

  // Step 1: Scenario selection
  setSelectedScenarioId: (id) => set({ selectedScenarioId: id }),

  setSelectedScenarioData: (data) => set({ selectedScenarioData: data }),

  // Step 2: Scenario configuration
  setScenarioDescription: (description) => set({ scenarioDescription: description }),

  setScenarioParams: (params) => set({ scenarioParams: params }),

  // Step 3: Actions
  setAvailableActions: (actions) => set({ availableActions: actions }),

  setSelectedActionIds: (ids) => set({ selectedActionIds: ids }),

  toggleActionId: (id) => {
    const current = get().selectedActionIds;
    if (current.includes(id)) {
      set({ selectedActionIds: current.filter((t) => t !== id) });
    } else {
      set({ selectedActionIds: [...current, id] });
    }
  },

  // Step 4: Agents
  setAgentMode: (mode) => set({ agentMode: mode }),

  addAgentType: (agentType) => {
    const types = [...get().agentTypes];
    types.push({ ...agentType, id: agentType.id || uuidv4() });
    set({ agentTypes: types });
  },

  removeAgentType: (id) => {
    set({ agentTypes: get().agentTypes.filter((t) => t.id !== id) });
  },

  updateAgentType: (id, updates) => {
    const types = get().agentTypes.map((t) =>
      t.id === id ? { ...t, ...updates } : t
    );
    set({ agentTypes: types });
  },

  loadProviders: async () => {
    const { apiClient } = await import('../services/client');
    try {
      // apiClient.get returns { data: T } where T is the generic type
      const { data } = await apiClient.get<LLMProvider[]>('/providers');
      set({ llmProviders: data });
      // Set default provider if none selected
      if (!get().selectedProviderId) {
        const active = data.find((p: LLMProvider) => p.is_active);
        if (active) set({ selectedProviderId: active.id });
      }
    } catch (error) {
      console.error('Failed to load providers:', error);
    }
  },

  setSelectedProviderId: (id) => set({ selectedProviderId: id }),

  // Validation
  validate: () => {
    const state = get();
    const errors: Record<string, string> = {};

    // Step 1: Scenario selected
    if (!state.selectedScenarioId) {
      errors['scenario'] = 'Please select a scenario';
    }

    // Step 2: Description not empty
    if (!state.scenarioDescription?.trim()) {
      errors['description'] = 'Please provide a scenario description';
    }

    // Step 3: At least 1 action selected
    if (state.selectedActionIds.length === 0) {
      errors['actions'] = 'Please select at least one action';
    }

    // Step 4: At least 1 agent
    const totalAgents = state.agentTypes.reduce((sum, type) => sum + (type.count || 0), 0);
    if (totalAgents === 0) {
      errors['agents'] = 'Please add at least one agent';
    }

    set({ validationErrors: errors });
    return Object.keys(errors).length === 0;
  },

  // Reset
  reset: () => set(initialState),
}));
