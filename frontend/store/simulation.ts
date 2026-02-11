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
import i18n from '../i18n';

export interface SimulationSlice {
  // State
  simulations: Simulation[];
  currentSimulation: Simulation | null;
  nodes: SimNode[];
  selectedNodeId: string | null;
  savedTemplates: SimulationTemplate[];
  timeConfig: TimeConfig;
  engineConfig: EngineConfig;

  // Cross-slice state (included here for unified updates)
  agents?: Agent[];
  logs?: any[];
  rawEvents?: any[];
  isWizardOpen?: boolean;

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
    const state = get();

    // Translation helper using i18n instance
    const t = (key: string, params?: Record<string, any>) => i18n.t(key, params);

    // Helper function to generate default agents
    const generateDefaultAgents = (templateType: string): Agent[] => {
      if (templateType === 'council') {
        return Array.from({ length: 5 }).map((_, i) => ({
          id: `c${i + 1}`,
          name: i === 0 ? t('store.agents.chairman') : `${t('store.agents.councilor')} ${String.fromCharCode(65 + i - 1)}`,
          role: i === 0 ? 'Chairman' : 'Council Member',
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=council${i}`,
          profile: t('store.agents.councilProfile'),
          llmConfig: { provider: 'OpenAI', model: 'gpt-4o' },
          properties: {
            [t('store.properties.influence')]: 50 + Math.floor(Math.random() * 40),
            [t('store.properties.tendency')]: i % 2 === 0 ? t('store.properties.conservative') : t('store.properties.radical'),
            [t('store.properties.pressure')]: 20
          },
          history: {},
          memory: [],
          knowledgeBase: []
        }));
      }

      if (templateType === 'werewolf') {
        const roles = [
          t('store.agents.judge'),
          t('store.agents.seer'),
          t('store.agents.witch'),
          t('store.agents.hunter'),
          t('store.agents.werewolf'),
          t('store.agents.werewolf'),
          t('store.agents.villager'),
          t('store.agents.villager'),
          t('store.agents.villager')
        ];
        return roles.map((role, i) => ({
          id: `w${i + 1}`,
          name: i === 0 ? 'God' : `${t('store.agents.player')} ${i}`,
          role,
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=werewolf${i}`,
          profile: `${t('store.agents.roleIs')} ${role}`,
          llmConfig: { provider: 'OpenAI', model: 'gpt-4o' },
          properties: { [t('store.properties.alive')]: 1, [t('store.properties.suspicion')]: 10 },
          history: {},
          memory: [],
          knowledgeBase: []
        }));
      }

      // Default village agents
      return [
        {
          id: 'a1',
          name: t('store.agents.alice'),
          role: t('store.agents.mayor'),
          avatarUrl: 'https://picsum.photos/200/200',
          profile: t('store.agents.aliceProfile'),
          llmConfig: { provider: 'OpenAI', model: 'gpt-4o' },
          properties: {
            [t('store.properties.trust')]: 85,
            [t('store.properties.stress')]: 40,
            [t('store.properties.money')]: 1200
          },
          history: {},
          memory: [],
          knowledgeBase: []
        },
        {
          id: 'a2',
          name: t('store.agents.bob'),
          role: t('store.agents.merchant'),
          avatarUrl: 'https://picsum.photos/201/201',
          profile: t('store.agents.bobProfile'),
          llmConfig: { provider: 'Anthropic', model: 'claude-4-5-sonnet' },
          properties: {
            [t('store.properties.trust')]: 45,
            [t('store.properties.stress')]: 20,
            [t('store.properties.money')]: 5000
          },
          history: {},
          memory: [],
          knowledgeBase: []
        }
      ];
    };

    // Prepare agents
    let finalAgents = customAgents;
    if (!finalAgents) {
      if (template.agents && template.agents.length > 0) {
        finalAgents = JSON.parse(JSON.stringify(template.agents));
      } else {
        finalAgents = generateDefaultAgents(template.sceneType);
      }
    }

    // Apply custom template actions to agents if present
    const templateActions = (template as any).genericConfig?.availableActions || [];
    if (templateActions.length > 0 && finalAgents) {
      finalAgents = finalAgents.map(agent => ({
        ...agent,
        action_space: templateActions
      }));
    }

    const finalTimeConfig = timeConfig || template.defaultTimeConfig || DEFAULT_TIME_CONFIG;

    // Check if connected mode
    if (state.engineConfig.mode === 'connected') {
      (async () => {
        try {
          const { createSimulation, startSimulation } = await import('../services/simulations');
          const { getTreeGraph } = await import('../services/simulationTree');

          const base = state.engineConfig.endpoint;
          const token = (state.engineConfig as any).token;

          const mapSceneType: Record<string, string> = {
            village: 'village_scene',
            council: 'council_scene',
            werewolf: 'werewolf_scene',
            generic: 'generic_scene'
          };
          const backendSceneType = mapSceneType[template.sceneType] || template.sceneType;

          const payload: any = {
            scene_type: backendSceneType,
            scene_config: {
              time_scale: finalTimeConfig,
              social_network: template.defaultNetwork || {},
              ...(templateActions.length > 0 && { available_actions: templateActions }),
              language: i18n.language || 'en',
            },
            agent_config: {
              language: i18n.language || 'en',
              agents: (finalAgents || []).map((a: any) => ({
                name: a.name,
                profile: a.profile,
                role: a.role,
                avatarUrl: a.avatarUrl,
                llmConfig: a.llmConfig,
                properties: { ...a.properties, role: a.role },
                history: a.history || {},
                memory: a.memory || [],
                knowledgeBase: a.knowledgeBase || [],
                action_space: Array.isArray(a.action_space) ? a.action_space : ['send_message']
              }))
            },
            llm_provider_id: state.selectedProviderId ?? state.currentProviderId ?? undefined,
            name: name || undefined
          };

          const sim = await createSimulation(base, payload, token);

          try {
            await startSimulation(base, sim.id, token);
          } catch {}

          const newSim: Simulation = {
            id: sim.id,
            name: name || sim.name,
            templateId: template.id,
            status: 'active',
            createdAt: new Date().toISOString().split('T')[0],
            timeConfig: finalTimeConfig,
            socialNetwork: template.defaultNetwork || {}
          };

          set({
            simulations: [...(get().simulations || []), newSim],
            currentSimulation: newSim,
            agents: finalAgents || [],
            logs: [],
            rawEvents: [],
            timeConfig: finalTimeConfig
          });

          const graph = await getTreeGraph(base, sim.id, token);
          if (graph) {
            const { mapGraphToNodes } = await import('./helpers');
            const nodesMapped = mapGraphToNodes(graph);
            set({
              nodes: nodesMapped,
              selectedNodeId: graph.root != null ? String(graph.root) : nodesMapped[0]?.id ?? null
            });
          }

          // Close the wizard
          (get() as any).toggleWizard?.(false);
          (get() as any).addNotification?.('success', t('store.simulationCreated', { name: newSim.name }));
        } catch (e) {
          console.error(e);
          (get() as any).addNotification?.('error', t('store.failedToCreateSimulation'));
        }
      })();
      return;
    }

    // Standalone mode
    const newSim: Simulation = {
      id: `sim${Date.now()}`,
      name: name || `Simulation_${Date.now()}`,
      templateId: template.id,
      status: 'active',
      createdAt: new Date().toISOString(),
      timeConfig: finalTimeConfig,
      socialNetwork: template.defaultNetwork || {},
      scene_config: template.genericConfig ? { generic_config: template.genericConfig } : undefined
    };

    set({
      simulations: [...state.simulations, newSim],
      currentSimulation: newSim,
      agents: finalAgents || [],
      logs: [],
      rawEvents: [],
      nodes: generateNodes(),
      selectedNodeId: 'root',
      timeConfig: finalTimeConfig,
      isWizardOpen: false
    });
  },

  updateTimeConfig: (config) => {
    set({ timeConfig: config });
  },

  saveTemplate: (name, description) => {
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
