// frontend/store/simulation.ts
//
// Core simulation state management slice.
//
// Responsibilities:
//   - Simulation CRUD operations
//   - Tree/node management
//   - Template management
//   - Time configuration
//   - Engine mode (standalone/connected)
//
// Used by: All simulation-related components, Dashboard, SimulationPage

import { StateCreator } from 'zustand';
import type {
  Simulation,
  SimNode,
  TimeConfig,
  SimulationTemplate,
  Agent,
  EngineConfig,
  EngineMode,
  SocialNetwork
} from '../types';
import { SYSTEM_TEMPLATES, generateNodes, mapGraphToNodes, DEFAULT_TIME_CONFIG } from './helpers';

export interface SimulationSlice {
  // State
  simulations: Simulation[];
  currentSimulation: Simulation | null;
  nodes: SimNode[];
  selectedNodeId: string | null;
  savedTemplates: SimulationTemplate[];
  timeConfig: TimeConfig;
  engineConfig: EngineConfig;

  // Actions
  setSimulation: (sim: Simulation) => void;
  addSimulation: (name: string, template: SimulationTemplate, customAgents?: Agent[], timeConfig?: TimeConfig) => void;
  updateTimeConfig: (config: TimeConfig) => void;
  saveTemplate: (name: string, description: string) => void;
  deleteTemplate: (id: string) => void;
  exitSimulation: () => void;
  resetSimulation: () => Promise<void>;
  deleteSimulation: () => Promise<void>;
  selectNode: (id: string) => void;
  updateSocialNetwork: (network: SocialNetwork) => Promise<void>;
  setEngineMode: (mode: EngineMode) => void;
  loadSimulations: () => Promise<void>;
}

export const createSimulationSlice: StateCreator<
  SimulationSlice,
  [],
  [],
  SimulationSlice
> = (set, get) => ({
  // Initial state
  simulations: [],
  currentSimulation: null,
  nodes: generateNodes(),
  selectedNodeId: 'root',
  savedTemplates: [...SYSTEM_TEMPLATES],
  timeConfig: DEFAULT_TIME_CONFIG,
  engineConfig: {
    mode: 'standalone',
    endpoint: import.meta.env?.VITE_API_BASE || '/api',
    status: 'disconnected',
    token: import.meta.env?.VITE_API_TOKEN || undefined
  },

  // Actions
  setSimulation: (sim) => set({ currentSimulation: sim }),

  setEngineMode: (mode) => {
    set((state) => ({
      engineConfig: { ...state.engineConfig, mode }
    }));
  },

  loadSimulations: async () => {
    try {
      const { getSimulations } = await import('../services/simulations');
      const simulations = await getSimulations();
      set({ simulations });
    } catch (e) {
      console.error('Failed to load simulations', e);
    }
  },

  addSimulation: (name, template, customAgents, timeConfig) => {
    const newSim: Simulation = {
      id: `sim-${Date.now()}`,
      name,
      templateId: template.id,
      status: 'active',
      createdAt: new Date().toISOString(),
      timeConfig: timeConfig || template.defaultTimeConfig || DEFAULT_TIME_CONFIG,
      socialNetwork: template.defaultNetwork || {},
      scene_config: template.genericConfig ? { generic_config: template.genericConfig } : undefined
    };

    set((state) => ({
      simulations: [...state.simulations, newSim],
      currentSimulation: newSim,
      nodes: generateNodes(),
      selectedNodeId: 'root',
      timeConfig: timeConfig || template.defaultTimeConfig || DEFAULT_TIME_CONFIG
    }));

    // Note: agents and logs should be set by their respective slices
    // For now, we defer this initialization to when the user actually enters the simulation
  },

  updateTimeConfig: (config) => {
    set({ timeConfig: config });
  },

  saveTemplate: async (name, description) => {
    const currentSim = get().currentSimulation;
    if (!currentSim) return;

    const agents = (get() as any).agents || [];

    const newTemplate: SimulationTemplate = {
      id: `tpl-${Date.now()}`,
      name,
      description,
      category: 'custom',
      sceneType: 'generic',
      agents: agents,
      defaultTimeConfig: get().timeConfig,
      socialNetwork: currentSim.socialNetwork
    };

    set((state) => ({
      savedTemplates: [...state.savedTemplates, newTemplate]
    }));
    get().addNotification?.('success', '模板已保存');
  },

  deleteTemplate: (id) => {
    set((state) => ({
      savedTemplates: state.savedTemplates.filter((t) => t.id !== id)
    }));
    get().addNotification?.('success', '模板已删除');
  },

  selectNode: (id) => set({ selectedNodeId: id }),

  updateSocialNetwork: async (network) => {
    const currentSim = get().currentSimulation;
    if (!currentSim) return;

    try {
      const { updateSimulation: updateSimApi } = await import('../services/simulations');
      await updateSimApi(currentSim.id, { socialNetwork: network });

      set((state) => ({
        currentSimulation: state.currentSimulation
          ? { ...state.currentSimulation, socialNetwork: network }
          : null
      }));
      get().addNotification?.('success', '社交网络已更新');
    } catch (e) {
      console.error('Failed to update social network', e);
      get().addNotification?.('error', '更新社交网络失败');
    }
  },

  exitSimulation: () => {
    set({
      currentSimulation: null,
      nodes: generateNodes(),
      selectedNodeId: 'root'
    });

    // Clear logs in the logs slice
    (get() as any).logs = [];
    (get() as any).rawEvents = [];

    const addNotification = (get() as any).addNotification;
    addNotification?.('info', '已退出当前模拟');
  },

  resetSimulation: async () => {
    const state = get();
    if (!state.currentSimulation) return;

    try {
      if (state.engineConfig.mode === 'connected') {
        const { resetSimulation: resetSimApi } = await import('../services/simulations');
        await resetSimApi(state.currentSimulation.id);

        const { getTreeGraph } = await import('../services/simulationTree');
        const graph = await getTreeGraph(
          state.engineConfig.endpoint,
          state.currentSimulation.id,
          state.engineConfig.token
        );

        if (graph) {
          const nodesMapped = mapGraphToNodes(graph);
          set({
            nodes: nodesMapped,
            selectedNodeId: graph.root != null ? String(graph.root) : null
          });
        }
      } else {
        set({
          nodes: generateNodes(),
          selectedNodeId: 'root'
        });
      }

      // Clear logs
      (get() as any).logs = [];
      (get() as any).rawEvents = [];

      const addNotification = (get() as any).addNotification;
      addNotification?.('success', '模拟已重置');
    } catch (e) {
      console.error('resetSimulation failed', e);
      const addNotification = (get() as any).addNotification;
      addNotification?.('error', '重置模拟失败');
    }
  },

  deleteSimulation: async () => {
    const state = get();
    if (!state.currentSimulation) return;

    try {
      if (state.engineConfig.mode === 'connected') {
        const { deleteSimulation: deleteSimApi } = await import('../services/simulations');
        await deleteSimApi(state.currentSimulation.id);
      }

      set({
        currentSimulation: null,
        nodes: generateNodes(),
        selectedNodeId: 'root'
      });

      // Clear logs
      (get() as any).logs = [];
      (get() as any).rawEvents = [];

      const addNotification = (get() as any).addNotification;
      addNotification?.('success', '模拟已删除');
    } catch (e) {
      console.error('deleteSimulation failed', e);
      const addNotification = (get() as any).addNotification;
      addNotification?.('error', '删除模拟失败');
    }
  }
});
