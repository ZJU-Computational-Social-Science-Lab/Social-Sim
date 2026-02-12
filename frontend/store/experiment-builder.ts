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

export type InteractionType =
  | 'strategic_decisions'
  | 'opinions_influence'
  | 'markets_exchange'
  | 'network_spread'
  | 'spatial_movement'
  | 'open_conversation';

export type SuccessConditionType =
  | 'fixed_rounds'
  | 'convergence'
  | 'unanimity'
  | 'no_conflicts';

export type TurnOrderType = 'simultaneous' | 'sequential' | 'random';

export type InterRoundUpdateType = 'none' | 'imitate' | 'average' | 'reinforce';

export type NetworkType = 'complete' | 'sbm' | 'barabasi' | 'custom';

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
  style: string;
  userProfile: string;
  properties: Record<string, unknown>;
  mechanicInitialState?: Record<string, unknown>;
}

export interface MechanicConfig {
  // Strategic choice config
  strategies?: string[];
  payoffMode?: 'pairwise' | 'extremum' | 'threshold' | 'pool' | 'custom';
  payoffVisibility?: 'private' | 'public' | 'query';
  payoffTiming?: 'immediate' | 'end_of_round';
  payoffMatrix?: string[][];
  extremumConfig?: {
    function: 'min' | 'max' | 'mean';
    baseline: number;
    marginal: number;
  };
  thresholdConfig?: {
    threshold: number;
    thresholdType: 'count' | 'sum';
    successPayoff?: [number, number];
    failurePayoff?: number;
    refundRate?: number;
  };

  // Opinion config
  opinionDimensions?: Array<{
    name: string;
    scale: [number, number];
  }>;
  influenceModel?: 'bounded_confidence' | 'open' | 'none';
  confidenceThreshold?: number;
  influenceRate?: number;

  // Network config
  propagationType?: 'opinion' | 'choice';
  evolutionModel?: 'homophily' | 'random' | 'none';
  homophilyThreshold?: number;
  formationRate?: number;
}

export interface SuccessConditionConfig {
  type: SuccessConditionType;
  maxRounds: number;
  tolerance?: number;
  thresholdRatio?: number;
  requiredValue?: unknown;
}

export interface TurnOrderConfig {
  type: TurnOrderType;
  visibility?: 'all_previous' | 'aggregate_only';
  updateTiming?: 'immediate' | 'batch';
}

export interface InterRoundUpdateConfig {
  type: InterRoundUpdateType;
  sourceMechanic?: string;
  probability: number;
  mixingRate: number;
}

export interface ConditionVariation {
  id: string;
  name: string;
  overrides: Record<string, unknown>;
}

export interface ExperimentBuilderState {
  // Current step
  currentStep: 1 | 2 | 3 | 4 | 5;
  completedSteps: Set<1 | 2 | 3 | 4 | 5>;

  // Step 1: Interaction types
  interactionTypes: InteractionType[];

  // Step 2: Starter template (optional)
  starterTemplate: string | null;

  // Step 3: Scenario + mechanic configs
  scenario: string;
  mechanicConfigs: Record<string, MechanicConfig>;

  // Step 4: Agents
  agentMode: 'manual' | 'demographic' | 'import';
  agentTypes: ManualAgentType[];
  llmProviders: LLMProvider[];
  selectedProviderId: number | null;

  // Step 5: Structure
  networkType: NetworkType;
  networkParams: Record<string, unknown>;
  successCondition: SuccessConditionConfig;
  turnOrder: TurnOrderConfig;
  interRoundUpdate: InterRoundUpdateConfig;
  metrics: string[];

  // Validation
  validationErrors: string[];
  validationWarnings: string[];

  // Conditions for A/B testing
  conditions: ConditionVariation[];
}

interface ExperimentBuilderActions {
  // Navigation
  setCurrentStep: (step: 1 | 2 | 3 | 4 | 5) => void;
  nextStep: () => void;
  prevStep: () => void;
  markStepComplete: (step: 1 | 2 | 3 | 4 | 5) => void;

  // Step 1: Interaction types
  setInteractionTypes: (types: InteractionType[]) => void;
  toggleInteractionType: (type: InteractionType) => void;

  // Step 2: Starter template
  setStarterTemplate: (template: string | null) => void;

  // Step 3: Scenario
  setScenario: (scenario: string) => void;
  updateMechanicConfig: (mechanic: string, config: Partial<MechanicConfig>) => void;

  // Step 4: Agents
  setAgentMode: (mode: 'manual' | 'demographic' | 'import') => void;
  addAgentType: (agentType: ManualAgentType) => void;
  removeAgentType: (id: string) => void;
  updateAgentType: (id: string, updates: Partial<ManualAgentType>) => void;
  loadProviders: () => Promise<void>;
  setSelectedProviderId: (id: number | null) => void;

  // Step 5: Structure
  setNetworkType: (type: NetworkType) => void;
  setNetworkParams: (params: Record<string, unknown>) => void;
  setSuccessCondition: (condition: SuccessConditionConfig) => void;
  setTurnOrder: (order: TurnOrderConfig) => void;
  setInterRoundUpdate: (update: InterRoundUpdateConfig) => void;
  setMetrics: (metrics: string[]) => void;

  // Validation
  validate: () => void;

  // Reset
  reset: () => void;
}

const initialState: ExperimentBuilderState = {
  currentStep: 1,
  completedSteps: new Set(),
  interactionTypes: [],
  starterTemplate: null,
  scenario: '',
  mechanicConfigs: {},
  agentMode: 'manual',
  agentTypes: [],
  llmProviders: [],
  selectedProviderId: null,
  networkType: 'complete',
  networkParams: {},
  successCondition: {
    type: 'fixed_rounds',
    maxRounds: 50,
  },
  turnOrder: {
    type: 'simultaneous',
  },
  interRoundUpdate: {
    type: 'none',
  },
  metrics: ['opinion_variance', 'cooperation_rate'],
  validationErrors: [],
  validationWarnings: [],
  conditions: [],
};

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

  // Step 1: Interaction types
  setInteractionTypes: (types) => set({ interactionTypes: types }),

  toggleInteractionType: (type) => {
    const current = get().interactionTypes;
    if (current.includes(type)) {
      set({ interactionTypes: current.filter((t) => t !== type) });
    } else {
      set({ interactionTypes: [...current, type] });
    }
  },

  // Step 2: Starter template
  setStarterTemplate: (template) => set({ starterTemplate: template }),

  // Step 3: Scenario
  setScenario: (scenario) => set({ scenario }),

  updateMechanicConfig: (mechanic, config) => {
    const configs = { ...get().mechanicConfigs };
    configs[mechanic] = { ...configs[mechanic], ...config };
    set({ mechanicConfigs: configs });
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

  // Step 5: Structure
  setNetworkType: (type) => set({ networkType: type }),

  setNetworkParams: (params) => set({ networkParams: params }),

  setSuccessCondition: (condition) => set({ successCondition: condition }),

  setTurnOrder: (order) => set({ turnOrder: order }),

  setInterRoundUpdate: (update) => set({ interRoundUpdate: update }),

  setMetrics: (metrics) => set({ metrics }),

  // Validation
  validate: () => {
    const state = get();
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check success condition compatibility
    if (state.successCondition.type === 'convergence' &&
        !state.interactionTypes.includes('opinions_influence')) {
      errors.push(
        'Convergence condition requires Opinions & Influence interaction type'
      );
    }

    if (state.successCondition.type === 'unanimity' &&
        !state.interactionTypes.includes('strategic_decisions')) {
      errors.push(
        'Unanimity condition requires Strategic Decisions interaction type'
      );
    }

    // Check inter-round update compatibility
    if (state.interRoundUpdate.type === 'imitate' &&
        !state.interactionTypes.includes('strategic_decisions') &&
        !state.interactionTypes.includes('markets_exchange')) {
      errors.push(
        'Imitation requires Strategic Decisions or Markets interaction type'
      );
    }

    if (state.interRoundUpdate.type === 'average' &&
        !state.interactionTypes.includes('opinions_influence')) {
      errors.push(
        'Averaging requires Opinions & Influence interaction type'
      );
    }

    // Check agent count warning for sequential
    const totalAgents = state.agentTypes.reduce((sum, t) => sum + t.count, 0);
    if (state.turnOrder.type === 'sequential' && totalAgents > 50) {
      warnings.push(
        `Sequential turn order with ${totalAgents} agents may be slow`
      );
    }

    // Check at least one interaction type
    if (state.interactionTypes.length === 0) {
      errors.push('Select at least one interaction pattern');
    }

    // Check scenario is set
    if (!state.scenario.trim()) {
      errors.push('Please provide a scenario description');
    }

    set({ validationErrors: errors, validationWarnings: warnings });
  },

  // Reset
  reset: () => set(initialState),
}));
