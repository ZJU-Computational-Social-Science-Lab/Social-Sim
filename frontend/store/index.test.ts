/**
 * Comprehensive unit tests for the store functionality.
 *
 * These tests verify that all store operations work correctly after the refactoring.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useSimulationStore } from '../store';
import { SYSTEM_TEMPLATES } from '../store/helpers';

describe('Store - Simulation Slice', () => {
  beforeEach(() => {
    // Reset store state before each test
    // Note: savedTemplates should always include SYSTEM_TEMPLATES
    useSimulationStore.setState({
      simulations: [],
      currentSimulation: null,
      nodes: [],
      selectedNodeId: 'root',
      savedTemplates: [...SYSTEM_TEMPLATES],
      timeConfig: { baseTime: new Date().toISOString(), unit: 'hour' as const, step: 1 },
      engineConfig: {
        mode: 'standalone' as const,
        endpoint: '/api',
        status: 'disconnected' as const,
        token: undefined
      },
      agents: [],
      logs: [],
      rawEvents: [],
      isWizardOpen: false,
      notifications: [],
      llmProviders: [],
      currentProviderId: null,
      selectedProviderId: null,
      compareTargetNodeId: null,
      isCompareMode: false,
      comparisonSummary: null,
      comparisonUseLLM: false,
      analysisConfig: {
        maxEvents: 800,
        samplePerRound: 5,
        focusAgents: [],
        enableLLM: false,
        roundStart: null,
        roundEnd: null
      },
      isGuideOpen: false,
      guideMessages: [],
      isGuideLoading: false,
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
      environmentEnabled: false,
      environmentSuggestionsAvailable: false,
      environmentSuggestions: [],
      environmentSuggestionsLoading: false,
      initialEvents: []
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const store = useSimulationStore.getState();

      // Core simulation state
      expect(store.simulations).toEqual([]);
      expect(store.currentSimulation).toBeNull();
      expect(store.nodes).toBeDefined();
      expect(store.selectedNodeId).toBe('root');
      expect(store.savedTemplates).toBeDefined();

      // Time config
      expect(store.timeConfig).toBeDefined();
      expect(store.timeConfig.unit).toBe('hour');
      expect(store.timeConfig.step).toBe(1);

      // Engine config
      expect(store.engineConfig).toBeDefined();
      expect(store.engineConfig.mode).toBe('standalone');

      // Agents and logs
      expect(store.agents).toEqual([]);
      expect(store.logs).toEqual([]);
      expect(store.rawEvents).toEqual([]);

      // UI state
      expect(store.isWizardOpen).toBe(false);
      expect(store.notifications).toEqual([]);

      // Providers
      expect(store.llmProviders).toEqual([]);
      expect(store.currentProviderId).toBeNull();
      expect(store.selectedProviderId).toBeNull();
    });

    it('should have SYSTEM_TEMPLATES pre-loaded', () => {
      const store = useSimulationStore.getState();

      expect(store.savedTemplates.length).toBeGreaterThan(0);
      expect(store.savedTemplates.find((t: any) => t.id === 'village')).toBeDefined();
      expect(store.savedTemplates.find((t: any) => t.id === 'council')).toBeDefined();
      expect(store.savedTemplates.find((t: any) => t.id === 'werewolf')).toBeDefined();
    });
  });

  describe('selectNode', () => {
    it('should select a node by ID', () => {
      useSimulationStore.getState().selectNode('test-node-id');
      expect(useSimulationStore.getState().selectedNodeId).toBe('test-node-id');
    });
  });

  describe('updateTimeConfig', () => {
    it('should update time configuration', () => {
      const newConfig = {
        baseTime: '2024-06-01T12:00:00.000Z',
        unit: 'day' as const,
        step: 3
      };

      useSimulationStore.getState().updateTimeConfig(newConfig);
      expect(useSimulationStore.getState().timeConfig).toEqual(newConfig);
    });
  });

  describe('exitSimulation', () => {
    it('should exit current simulation', () => {
      useSimulationStore.getState().exitSimulation();
      const store = useSimulationStore.getState();

      expect(store.currentSimulation).toBeNull();
      expect(store.logs).toEqual([]);
      expect(store.rawEvents).toEqual([]);
    });
  });

  describe('saveTemplate & deleteTemplate', () => {
    it('should save a new template', () => {
      // First create a simulation so saveTemplate has something to work with
      useSimulationStore.setState({
        currentSimulation: {
          id: 'test-sim',
          name: 'Test Simulation',
          templateId: 'village',
          status: 'active',
          createdAt: new Date().toISOString(),
          timeConfig: { baseTime: new Date().toISOString(), unit: 'hour' as const, step: 1 },
          socialNetwork: {}
        }
      });

      const initialCount = useSimulationStore.getState().savedTemplates.length;

      useSimulationStore.getState().saveTemplate('My Template', 'A test template');

      const store = useSimulationStore.getState();
      expect(store.savedTemplates.length).toBe(initialCount + 1);
      const newTemplate = store.savedTemplates[store.savedTemplates.length - 1];
      expect(newTemplate.name).toBe('My Template');
      expect(newTemplate.description).toBe('A test template');
      expect(newTemplate.category).toBe('custom');
    });

    it('should delete a template', () => {
      // First create a simulation so saveTemplate has something to work with
      useSimulationStore.setState({
        currentSimulation: {
          id: 'test-sim',
          name: 'Test Simulation',
          templateId: 'village',
          status: 'active',
          createdAt: new Date().toISOString(),
          timeConfig: { baseTime: new Date().toISOString(), unit: 'hour' as const, step: 1 },
          socialNetwork: {}
        }
      });

      // Save a template first
      useSimulationStore.getState().saveTemplate('To Delete', 'Will be deleted');

      const newTemplate = useSimulationStore.getState().savedTemplates[
        useSimulationStore.getState().savedTemplates.length - 1
      ];
      const initialCount = useSimulationStore.getState().savedTemplates.length;

      useSimulationStore.getState().deleteTemplate(newTemplate.id);

      expect(useSimulationStore.getState().savedTemplates.length).toBe(initialCount - 1);
      expect(
        useSimulationStore.getState().savedTemplates.find((t: any) => t.id === newTemplate.id)
      ).toBeUndefined();
    });
  });

  describe('setEngineMode', () => {
    it('should set engine mode to connected', () => {
      useSimulationStore.getState().setEngineMode('connected' as const);
      expect(useSimulationStore.getState().engineConfig.mode).toBe('connected');
    });

    it('should set engine mode to standalone', () => {
      useSimulationStore.getState().setEngineMode('connected' as const);
      useSimulationStore.getState().setEngineMode('standalone' as const);
      expect(useSimulationStore.getState().engineConfig.mode).toBe('standalone');
    });
  });
});

describe('Store - Agents Slice', () => {
  beforeEach(() => {
    useSimulationStore.setState({
      simulations: [],
      currentSimulation: null,
      nodes: [],
      selectedNodeId: 'root',
      savedTemplates: [...SYSTEM_TEMPLATES],
      timeConfig: { baseTime: new Date().toISOString(), unit: 'hour' as const, step: 1 },
      engineConfig: { mode: 'standalone', endpoint: '/api', status: 'disconnected', token: undefined },
      agents: [],
      logs: [],
      rawEvents: [],
      isWizardOpen: false,
      notifications: [],
      llmProviders: [],
      currentProviderId: null,
      selectedProviderId: null,
      initialEvents: []
    });
  });

  describe('updateAgentProperty', () => {
    it('should update agent property', () => {
      const testAgent = {
        id: 'agent-1',
        name: 'Test Agent',
        role: 'Tester',
        avatarUrl: 'test.png',
        profile: 'Test profile',
        llmConfig: { provider: 'Test', model: 'test' },
        properties: { testProp: 'initial' },
        history: {},
        memory: [],
        knowledgeBase: []
      };

      useSimulationStore.getState().setAgents([testAgent]);
      useSimulationStore.getState().updateAgentProperty('agent-1', 'testProp', 'updated');

      expect(useSimulationStore.getState().agents[0].properties.testProp).toBe('updated');
    });
  });

  describe('updateAgentProfile', () => {
    it('should update agent profile', () => {
      const testAgent = {
        id: 'agent-1',
        name: 'Test Agent',
        role: 'Tester',
        avatarUrl: 'test.png',
        profile: 'Original profile',
        llmConfig: { provider: 'Test', model: 'test' },
        properties: {},
        history: {},
        memory: [],
        knowledgeBase: []
      };

      useSimulationStore.getState().setAgents([testAgent]);
      useSimulationStore.getState().updateAgentProfile('agent-1', 'Updated profile');

      expect(useSimulationStore.getState().agents[0].profile).toBe('Updated profile');
    });
  });

  describe('Knowledge Base Management', () => {
    it('should add knowledge to agent', () => {
      const testAgent = {
        id: 'agent-1',
        name: 'Test Agent',
        role: 'Tester',
        avatarUrl: 'test.png',
        profile: 'Test profile',
        llmConfig: { provider: 'Test', model: 'test' },
        properties: {},
        history: {},
        memory: [],
        knowledgeBase: []
      };

      useSimulationStore.getState().setAgents([testAgent]);

      const knowledgeItem = {
        id: 'kb-1',
        title: 'Test Knowledge',
        content: 'Test content'
      };

      useSimulationStore.getState().addKnowledgeToAgent('agent-1', knowledgeItem);

      expect(useSimulationStore.getState().agents[0].knowledgeBase.length).toBe(1);
      expect(useSimulationStore.getState().agents[0].knowledgeBase[0].title).toBe('Test Knowledge');
    });

    it('should remove knowledge from agent', () => {
      const testAgent = {
        id: 'agent-1',
        name: 'Test Agent',
        role: 'Tester',
        avatarUrl: 'test.png',
        profile: 'Test profile',
        llmConfig: { provider: 'Test', model: 'test' },
        properties: {},
        history: {},
        memory: [],
        knowledgeBase: [
          { id: 'kb-1', title: 'KB 1', content: 'Content 1' },
          { id: 'kb-2', title: 'KB 2', content: 'Content 2' }
        ]
      };

      useSimulationStore.getState().setAgents([testAgent]);
      useSimulationStore.getState().removeKnowledgeFromAgent('agent-1', 'kb-1');

      expect(useSimulationStore.getState().agents[0].knowledgeBase.length).toBe(1);
      expect(useSimulationStore.getState().agents[0].knowledgeBase[0].id).toBe('kb-2');
    });

    it('should update knowledge in agent', () => {
      const testAgent = {
        id: 'agent-1',
        name: 'Test Agent',
        role: 'Tester',
        avatarUrl: 'test.png',
        profile: 'Test profile',
        llmConfig: { provider: 'Test', model: 'test' },
        properties: {},
        history: {},
        memory: [],
        knowledgeBase: [
          { id: 'kb-1', title: 'Old Title', content: 'Old Content' }
        ]
      };

      useSimulationStore.getState().setAgents([testAgent]);
      useSimulationStore.getState().updateKnowledgeInAgent('agent-1', 'kb-1', { title: 'New Title' });

      expect(useSimulationStore.getState().agents[0].knowledgeBase[0].title).toBe('New Title');
      expect(useSimulationStore.getState().agents[0].knowledgeBase[0].content).toBe('Old Content');
    });
  });
});

describe('Store - UI Slice', () => {
  beforeEach(() => {
    useSimulationStore.setState({
      simulations: [],
      currentSimulation: null,
      nodes: [],
      selectedNodeId: 'root',
      savedTemplates: [...SYSTEM_TEMPLATES],
      timeConfig: { baseTime: new Date().toISOString(), unit: 'hour' as const, step: 1 },
      engineConfig: { mode: 'standalone', endpoint: '/api', status: 'disconnected', token: undefined },
      agents: [],
      logs: [],
      rawEvents: [],
      isWizardOpen: false,
      notifications: [],
      llmProviders: [],
      currentProviderId: null,
      selectedProviderId: null,
      initialEvents: []
    });
  });

  describe('Modal Toggles', () => {
    it('should toggle wizard state', () => {
      useSimulationStore.getState().toggleWizard(true);
      expect(useSimulationStore.getState().isWizardOpen).toBe(true);

      useSimulationStore.getState().toggleWizard(false);
      expect(useSimulationStore.getState().isWizardOpen).toBe(false);
    });

    it('should toggle help modal', () => {
      useSimulationStore.getState().toggleHelpModal(true);
      expect(useSimulationStore.getState().isHelpModalOpen).toBe(true);
    });

    it('should toggle analytics', () => {
      useSimulationStore.getState().toggleAnalytics(true);
      expect(useSimulationStore.getState().isAnalyticsOpen).toBe(true);
    });

    it('should toggle export modal', () => {
      useSimulationStore.getState().toggleExport(true);
      expect(useSimulationStore.getState().isExportOpen).toBe(true);
    });

    it('should toggle experiment designer', () => {
      useSimulationStore.getState().toggleExperimentDesigner(true);
      expect(useSimulationStore.getState().isExperimentDesignerOpen).toBe(true);
    });

    it('should toggle time settings', () => {
      useSimulationStore.getState().toggleTimeSettings(true);
      expect(useSimulationStore.getState().isTimeSettingsOpen).toBe(true);
    });

    it('should toggle save template', () => {
      useSimulationStore.getState().toggleSaveTemplate(true);
      expect(useSimulationStore.getState().isSaveTemplateOpen).toBe(true);
    });

    it('should toggle network editor', () => {
      useSimulationStore.getState().toggleNetworkEditor(true);
      expect(useSimulationStore.getState().isNetworkEditorOpen).toBe(true);
    });

    it('should toggle report modal', () => {
      useSimulationStore.getState().toggleReportModal(true);
      expect(useSimulationStore.getState().isReportModalOpen).toBe(true);
    });

    it('should toggle initial events', () => {
      useSimulationStore.getState().toggleInitialEvents(true);
      expect(useSimulationStore.getState().isInitialEventsOpen).toBe(true);
    });

    it('should set global knowledge open', () => {
      useSimulationStore.getState().setGlobalKnowledgeOpen(true);
      expect(useSimulationStore.getState().globalKnowledgeOpen).toBe(true);
    });
  });

  describe('Notifications', () => {
    it('should add success notification', () => {
      useSimulationStore.getState().addNotification('success', 'Success message');

      expect(useSimulationStore.getState().notifications.length).toBe(1);
      expect(useSimulationStore.getState().notifications[0].type).toBe('success');
      expect(useSimulationStore.getState().notifications[0].message).toBe('Success message');
    });

    it('should add error notification', () => {
      useSimulationStore.getState().addNotification('error', 'Error message');

      expect(useSimulationStore.getState().notifications.length).toBe(1);
      expect(useSimulationStore.getState().notifications[0].type).toBe('error');
    });

    it('should add info notification', () => {
      useSimulationStore.getState().addNotification('info', 'Info message');

      expect(useSimulationStore.getState().notifications.length).toBe(1);
      expect(useSimulationStore.getState().notifications[0].type).toBe('info');
    });

    it('should remove notification', () => {
      useSimulationStore.getState().addNotification('success', 'Test');

      const notifId = useSimulationStore.getState().notifications[0].id;

      useSimulationStore.getState().removeNotification(notifId);

      expect(useSimulationStore.getState().notifications.length).toBe(0);
    });
  });
});

describe('Store - Experiments Slice', () => {
  beforeEach(() => {
    useSimulationStore.setState({
      simulations: [],
      currentSimulation: null,
      nodes: [],
      selectedNodeId: 'root',
      savedTemplates: [...SYSTEM_TEMPLATES],
      timeConfig: { baseTime: new Date().toISOString(), unit: 'hour' as const, step: 1 },
      engineConfig: { mode: 'standalone', endpoint: '/api', status: 'disconnected', token: undefined },
      agents: [],
      logs: [],
      rawEvents: [],
      isWizardOpen: false,
      notifications: [],
      llmProviders: [],
      currentProviderId: null,
      selectedProviderId: null,
      compareTargetNodeId: null,
      isCompareMode: false,
      comparisonSummary: null,
      comparisonUseLLM: false,
      analysisConfig: {
        maxEvents: 800,
        samplePerRound: 5,
        focusAgents: [],
        enableLLM: false,
        roundStart: null,
        roundEnd: null
      }
    });
  });

  describe('Comparison', () => {
    it('should set comparison target', () => {
      useSimulationStore.getState().setCompareTarget('node-123');
      expect(useSimulationStore.getState().compareTargetNodeId).toBe('node-123');
    });

    it('should toggle compare mode', () => {
      expect(useSimulationStore.getState().isCompareMode).toBe(false);

      useSimulationStore.getState().toggleCompareMode(true);
      expect(useSimulationStore.getState().isCompareMode).toBe(true);
    });

    it('should set comparison use LLM', () => {
      useSimulationStore.getState().setComparisonUseLLM(true);
      expect(useSimulationStore.getState().comparisonUseLLM).toBe(true);
    });
  });

  describe('Analysis Config', () => {
    it('should update analysis config', () => {
      useSimulationStore.getState().updateAnalysisConfig({ maxEvents: 500 });
      expect(useSimulationStore.getState().analysisConfig.maxEvents).toBe(500);
    });
  });
});

describe('Store - Providers Slice', () => {
  beforeEach(() => {
    useSimulationStore.setState({
      simulations: [],
      currentSimulation: null,
      nodes: [],
      selectedNodeId: 'root',
      savedTemplates: [...SYSTEM_TEMPLATES],
      timeConfig: { baseTime: new Date().toISOString(), unit: 'hour' as const, step: 1 },
      engineConfig: { mode: 'standalone', endpoint: '/api', status: 'disconnected', token: undefined },
      agents: [],
      logs: [],
      rawEvents: [],
      isWizardOpen: false,
      notifications: [],
      llmProviders: [],
      currentProviderId: null,
      selectedProviderId: null
    });
  });

  describe('setSelectedProvider', () => {
    it('should set selected provider', () => {
      useSimulationStore.getState().setSelectedProvider(123);
      expect(useSimulationStore.getState().selectedProviderId).toBe(123);
    });
  });
});

describe('Store - Helper Functions', () => {
  describe('SYSTEM_TEMPLATES', () => {
    it('should export SYSTEM_TEMPLATES', async () => {
      const { default: storeHelpers } = await import('../store/helpers');

      expect(storeHelpers.SYSTEM_TEMPLATES).toBeDefined();
      expect(Array.isArray(storeHelpers.SYSTEM_TEMPLATES)).toBe(true);
    });

    it('should contain all expected system templates', async () => {
      const { default: storeHelpers } = await import('../store/helpers');
      const templates = storeHelpers.SYSTEM_TEMPLATES;
      const templateIds = templates.map((t: any) => t.id);

      expect(templateIds).toContain('norm_disruption');
      expect(templateIds).toContain('policy_diffusion');
      expect(templateIds).toContain('polarization');
      expect(templateIds).toContain('resource_scarcity');
      expect(templateIds).toContain('village');
      expect(templateIds).toContain('council');
      expect(templateIds).toContain('werewolf');
    });
  });

  describe('Time Helpers', () => {
    it('should export addTime function', async () => {
      const { default: storeHelpers } = await import('../store/helpers');

      expect(storeHelpers.addTime).toBeDefined();
    });

    it('should export formatWorldTime function', async () => {
      const { default: storeHelpers } = await import('../store/helpers');

      expect(storeHelpers.formatWorldTime).toBeDefined();
    });
  });

  describe('Graph Helpers', () => {
    it('should export generateNodes function', async () => {
      const { default: storeHelpers } = await import('../store/helpers');

      expect(storeHelpers.generateNodes).toBeDefined();
    });

    it('should export mapGraphToNodes function', async () => {
      const { default: storeHelpers } = await import('../store/helpers');

      expect(storeHelpers.mapGraphToNodes).toBeDefined();
    });
  });

  describe('Agent Generation Helpers', () => {
    it('should export generateAgentsWithAI function', async () => {
      const { default: storeHelpers } = await import('../store/helpers');

      expect(storeHelpers.generateAgentsWithAI).toBeDefined();
    });

    it('should export generateAgentsWithDemographics function', async () => {
      const { default: storeHelpers } = await import('../store/helpers');

      expect(storeHelpers.generateAgentsWithDemographics).toBeDefined();
    });

    it('should export mapBackendEventsToLogs function', async () => {
      const { default: storeHelpers } = await import('../store/helpers');

      expect(storeHelpers.mapBackendEventsToLogs).toBeDefined();
    });
  });
});

describe('Store - Simulation Control (advanceSimulation, branchSimulation, deleteNode)', () => {
  beforeEach(() => {
    useSimulationStore.setState({
      simulations: [],
      currentSimulation: null,
      nodes: [],
      selectedNodeId: 'root',
      savedTemplates: [...SYSTEM_TEMPLATES],
      timeConfig: { baseTime: new Date().toISOString(), unit: 'hour' as const, step: 1 },
      engineConfig: { mode: 'standalone', endpoint: '/api', status: 'disconnected', token: undefined },
      agents: [],
      logs: [],
      rawEvents: [],
      isWizardOpen: false,
      notifications: [],
      llmProviders: [],
      currentProviderId: null,
      selectedProviderId: null,
      isGenerating: false,
      compareTargetNodeId: null,
      isCompareMode: false,
      comparisonSummary: null,
      comparisonUseLLM: false,
      analysisConfig: {
        maxEvents: 800,
        samplePerRound: 5,
        focusAgents: [],
        enableLLM: false,
        roundStart: null,
        roundEnd: null
      },
      isGuideOpen: false,
      guideMessages: [],
      isGuideLoading: false,
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
      isGeneratingReport: false,
      environmentEnabled: false,
      environmentSuggestionsAvailable: false,
      environmentSuggestions: [],
      environmentSuggestionsLoading: false,
      initialEvents: []
    });
  });

  describe('advanceSimulation - Standalone Mode', () => {
    it('should create a new node when advancing in standalone mode', async () => {
      // Set up a root node
      useSimulationStore.setState({
        currentSimulation: {
          id: 'sim-1',
          name: 'Test Simulation',
          templateId: 'village',
          status: 'active',
          createdAt: new Date().toISOString(),
          timeConfig: { baseTime: new Date().toISOString(), unit: 'hour' as const, step: 1 },
          socialNetwork: {}
        },
        nodes: [
          {
            id: 'root',
            display_id: '0',
            parentId: null,
            name: 'Root',
            depth: 0,
            isLeaf: true,
            status: 'pending' as const,
            timestamp: new Date().toISOString(),
            worldTime: new Date().toISOString()
          }
        ],
        selectedNodeId: 'root',
        agents: [
          {
            id: 'a1',
            name: 'Test Agent',
            role: 'Tester',
            avatarUrl: 'test.png',
            profile: 'Test',
            llmConfig: { provider: 'Test', model: 'test' },
            properties: { health: 50 },
            history: { health: [50] },
            memory: [],
            knowledgeBase: []
          }
        ]
      });

      const initialNodesCount = useSimulationStore.getState().nodes.length;

      await useSimulationStore.getState().advanceSimulation();

      const state = useSimulationStore.getState();
      expect(state.nodes.length).toBe(initialNodesCount + 1);
      expect(state.selectedNodeId).not.toBe('root');
      expect(state.logs.length).toBeGreaterThan(0);
      expect(state.isGenerating).toBe(false);
    });

    it('should update agent history when advancing in standalone mode', async () => {
      useSimulationStore.setState({
        currentSimulation: {
          id: 'sim-1',
          name: 'Test Simulation',
          templateId: 'village',
          status: 'active',
          createdAt: new Date().toISOString(),
          timeConfig: { baseTime: new Date().toISOString(), unit: 'hour' as const, step: 1 },
          socialNetwork: {}
        },
        nodes: [
          {
            id: 'root',
            display_id: '0',
            parentId: null,
            name: 'Root',
            depth: 0,
            isLeaf: true,
            status: 'pending' as const,
            timestamp: new Date().toISOString(),
            worldTime: new Date().toISOString()
          }
        ],
        selectedNodeId: 'root',
        agents: [
          {
            id: 'a1',
            name: 'Test Agent',
            role: 'Tester',
            avatarUrl: 'test.png',
            profile: 'Test',
            llmConfig: { provider: 'Test', model: 'test' },
            properties: { health: 50 },
            history: { health: [50] },
            memory: [],
            knowledgeBase: []
          }
        ]
      });

      await useSimulationStore.getState().advanceSimulation();

      const agent = useSimulationStore.getState().agents[0];
      expect(agent.history.health.length).toBeGreaterThan(1);
    });

    it('should not advance when isGenerating is true', async () => {
      useSimulationStore.setState({
        currentSimulation: {
          id: 'sim-1',
          name: 'Test Simulation',
          templateId: 'village',
          status: 'active',
          createdAt: new Date().toISOString(),
          timeConfig: { baseTime: new Date().toISOString(), unit: 'hour' as const, step: 1 },
          socialNetwork: {}
        },
        nodes: [
          {
            id: 'root',
            display_id: '0',
            parentId: null,
            name: 'Root',
            depth: 0,
            isLeaf: true,
            status: 'pending' as const,
            timestamp: new Date().toISOString(),
            worldTime: new Date().toISOString()
          }
        ],
        selectedNodeId: 'root',
        isGenerating: true
      });

      const initialNodesCount = useSimulationStore.getState().nodes.length;

      await useSimulationStore.getState().advanceSimulation();

      expect(useSimulationStore.getState().nodes.length).toBe(initialNodesCount);
    });

    it('should mark parent node as non-leaf after advancing', async () => {
      useSimulationStore.setState({
        currentSimulation: {
          id: 'sim-1',
          name: 'Test Simulation',
          templateId: 'village',
          status: 'active',
          createdAt: new Date().toISOString(),
          timeConfig: { baseTime: new Date().toISOString(), unit: 'hour' as const, step: 1 },
          socialNetwork: {}
        },
        nodes: [
          {
            id: 'root',
            display_id: '0',
            parentId: null,
            name: 'Root',
            depth: 0,
            isLeaf: true,
            status: 'pending' as const,
            timestamp: new Date().toISOString(),
            worldTime: new Date().toISOString()
          }
        ],
        selectedNodeId: 'root'
      });

      await useSimulationStore.getState().advanceSimulation();

      const rootNode = useSimulationStore.getState().nodes.find((n: any) => n.id === 'root');
      expect(rootNode?.isLeaf).toBe(false);
    });
  });

  describe('branchSimulation - Standalone Mode', () => {
    it('should create a branch node in standalone mode', async () => {
      useSimulationStore.setState({
        currentSimulation: {
          id: 'sim-1',
          name: 'Test Simulation',
          templateId: 'village',
          status: 'active',
          createdAt: new Date().toISOString(),
          timeConfig: { baseTime: new Date().toISOString(), unit: 'hour' as const, step: 1 },
          socialNetwork: {}
        },
        nodes: [
          {
            id: 'root',
            display_id: '0',
            parentId: null,
            name: 'Root',
            depth: 0,
            isLeaf: false,
            status: 'completed' as const,
            timestamp: new Date().toISOString(),
            worldTime: new Date().toISOString()
          },
          {
            id: 'node-1',
            display_id: '1',
            parentId: 'root',
            name: 'Node 1',
            depth: 1,
            isLeaf: true,
            status: 'pending' as const,
            timestamp: new Date().toISOString(),
            worldTime: new Date().toISOString()
          }
        ],
        selectedNodeId: 'node-1',
        logs: []
      });

      const initialNodesCount = useSimulationStore.getState().nodes.length;

      await useSimulationStore.getState().branchSimulation();

      const state = useSimulationStore.getState();
      expect(state.nodes.length).toBe(initialNodesCount + 1);
      expect(state.selectedNodeId).toContain('branch');
    });
  });

  describe('deleteNode', () => {
    it('should delete node and its descendants in standalone mode', async () => {
      useSimulationStore.setState({
        currentSimulation: {
          id: 'sim-1',
          name: 'Test Simulation',
          templateId: 'village',
          status: 'active',
          createdAt: new Date().toISOString(),
          timeConfig: { baseTime: new Date().toISOString(), unit: 'hour' as const, step: 1 },
          socialNetwork: {}
        },
        nodes: [
          {
            id: 'root',
            display_id: '0',
            parentId: null,
            name: 'Root',
            depth: 0,
            isLeaf: false,
            status: 'completed' as const,
            timestamp: new Date().toISOString(),
            worldTime: new Date().toISOString()
          },
          {
            id: 'child-1',
            display_id: '1',
            parentId: 'root',
            name: 'Child 1',
            depth: 1,
            isLeaf: true,
            status: 'pending' as const,
            timestamp: new Date().toISOString(),
            worldTime: new Date().toISOString()
          },
          {
            id: 'grandchild-1',
            display_id: '2',
            parentId: 'child-1',
            name: 'Grandchild 1',
            depth: 2,
            isLeaf: true,
            status: 'pending' as const,
            timestamp: new Date().toISOString(),
            worldTime: new Date().toISOString()
          }
        ],
        selectedNodeId: 'child-1'
      });

      await useSimulationStore.getState().deleteNode();

      const state = useSimulationStore.getState();
      expect(state.nodes.find((n: any) => n.id === 'child-1')).toBeUndefined();
      expect(state.nodes.find((n: any) => n.id === 'grandchild-1')).toBeUndefined();
      expect(state.selectedNodeId).toBe('root');
    });

    it('should not delete root node', async () => {
      useSimulationStore.setState({
        currentSimulation: {
          id: 'sim-1',
          name: 'Test Simulation',
          templateId: 'village',
          status: 'active',
          createdAt: new Date().toISOString(),
          timeConfig: { baseTime: new Date().toISOString(), unit: 'hour' as const, step: 1 },
          socialNetwork: {}
        },
        nodes: [
          {
            id: 'root',
            display_id: '0',
            parentId: null,
            name: 'Root',
            depth: 0,
            isLeaf: true,
            status: 'pending' as const,
            timestamp: new Date().toISOString(),
            worldTime: new Date().toISOString()
          }
        ],
        selectedNodeId: 'root'
      });

      const initialNodesCount = useSimulationStore.getState().nodes.length;

      await useSimulationStore.getState().deleteNode();

      expect(useSimulationStore.getState().nodes.length).toBe(initialNodesCount);
    });
  });

  describe('Integration - Full Simulation Workflow', () => {
    it('should create simulation, advance node, create branch, and delete node', async () => {
      // Start with clean state
      const state = useSimulationStore.getState();

      // Create a simulation in standalone mode
      state.addSimulation('Workflow Test', state.savedTemplates[0]);

      expect(useSimulationStore.getState().currentSimulation).toBeDefined();
      expect(useSimulationStore.getState().agents.length).toBeGreaterThan(0);

      const initialNodesCount = useSimulationStore.getState().nodes.length;

      // Advance simulation
      await useSimulationStore.getState().advanceSimulation();
      expect(useSimulationStore.getState().nodes.length).toBe(initialNodesCount + 1);
      expect(useSimulationStore.getState().logs.length).toBeGreaterThan(0);

      // Create branch
      await useSimulationStore.getState().branchSimulation();
      expect(useSimulationStore.getState().nodes.length).toBe(initialNodesCount + 2);

      // Delete the branch node (last node created)
      const lastNodeId = useSimulationStore.getState().nodes[useSimulationStore.getState().nodes.length - 1].id;
      useSimulationStore.setState({ selectedNodeId: lastNodeId });
      await useSimulationStore.getState().deleteNode();
      expect(useSimulationStore.getState().nodes.length).toBe(initialNodesCount + 1);
    });
  });

  describe('branchSimulation - Connected Mode (tests node creation)', () => {
    it('should create a sibling node (not child) in standalone mode', async () => {
      // Set up: root node with one child (node-1)
      useSimulationStore.setState({
        currentSimulation: {
          id: 'sim-1',
          name: 'Test Simulation',
          templateId: 'village',
          status: 'active',
          createdAt: new Date().toISOString(),
          timeConfig: { baseTime: new Date().toISOString(), unit: 'hour' as const, step: 1 },
          socialNetwork: {}
        },
        engineConfig: { mode: 'standalone', endpoint: '/api', status: 'disconnected', token: undefined },
        nodes: [
          {
            id: 'root',
            display_id: '0',
            parentId: null,
            name: 'Root',
            depth: 0,
            isLeaf: false,
            status: 'completed' as const,
            timestamp: new Date().toISOString(),
            worldTime: new Date().toISOString()
          },
          {
            id: 'node-1',
            display_id: '1',
            parentId: 'root',
            name: 'Node 1',
            depth: 1,
            isLeaf: true,
            status: 'pending' as const,
            timestamp: new Date().toISOString(),
            worldTime: new Date().toISOString()
          }
        ],
        selectedNodeId: 'node-1',
        logs: []
      });

      const initialNodesCount = useSimulationStore.getState().nodes.length;

      // Branch from node-1 should create a sibling (another child of root), not a child of node-1
      await useSimulationStore.getState().branchSimulation();

      const state = useSimulationStore.getState();

      // Should have one more node
      expect(state.nodes.length).toBe(initialNodesCount + 1);

      // Find the branch node (should start with 'branch-')
      const branchNode = state.nodes.find((n: any) => n.id.includes('branch') || n.name.includes('分支'));
      expect(branchNode).toBeDefined();

      // The branch node should be a sibling of node-1 (same depth, same parent=root)
      expect(branchNode.depth).toBe(1); // Same depth as node-1
      expect(branchNode.parentId).toBe('root'); // Same parent as node-1

      // Should have a log entry
      expect(state.logs.length).toBeGreaterThan(0);
      expect(state.logs[state.logs.length - 1].content).toContain('分支');
    });

    it('should select the newly created branch node', async () => {
      useSimulationStore.setState({
        currentSimulation: {
          id: 'sim-1',
          name: 'Test Simulation',
          templateId: 'village',
          status: 'active',
          createdAt: new Date().toISOString(),
          timeConfig: { baseTime: new Date().toISOString(), unit: 'hour' as const, step: 1 },
          socialNetwork: {}
        },
        engineConfig: { mode: 'standalone', endpoint: '/api', status: 'disconnected', token: undefined },
        nodes: [
          {
            id: 'root',
            display_id: '0',
            parentId: null,
            name: 'Root',
            depth: 0,
            isLeaf: false,
            status: 'completed' as const,
            timestamp: new Date().toISOString(),
            worldTime: new Date().toISOString()
          },
          {
            id: 'node-1',
            display_id: '1',
            parentId: 'root',
            name: 'Node 1',
            depth: 1,
            isLeaf: true,
            status: 'pending' as const,
            timestamp: new Date().toISOString(),
            worldTime: new Date().toISOString()
          }
        ],
        selectedNodeId: 'node-1'
      });

      await useSimulationStore.getState().branchSimulation();

      // Should select the newly created branch node
      const newSelectedId = useSimulationStore.getState().selectedNodeId;
      expect(newSelectedId).not.toBe('node-1');

      // The new selected node should be the branch node
      const branchNode = useSimulationStore.getState().nodes.find((n: any) => n.id === newSelectedId);
      expect(branchNode).toBeDefined();
    });

    it('should not branch from root node in standalone mode', async () => {
      useSimulationStore.setState({
        currentSimulation: {
          id: 'sim-1',
          name: 'Test Simulation',
          templateId: 'village',
          status: 'active',
          createdAt: new Date().toISOString(),
          timeConfig: { baseTime: new Date().toISOString(), unit: 'hour' as const, step: 1 },
          socialNetwork: {}
        },
        engineConfig: { mode: 'standalone', endpoint: '/api', status: 'disconnected', token: undefined },
        nodes: [
          {
            id: 'root',
            display_id: '0',
            parentId: null,
            name: 'Root',
            depth: 0,
            isLeaf: true,
            status: 'pending' as const,
            timestamp: new Date().toISOString(),
            worldTime: new Date().toISOString()
          }
        ],
        selectedNodeId: 'root',
        logs: []
      });

      const initialNodesCount = useSimulationStore.getState().nodes.length;

      await useSimulationStore.getState().branchSimulation();

      // Root has no parent, so branching should not create a new node
      expect(useSimulationStore.getState().nodes.length).toBe(initialNodesCount);
    });
  });

  describe('runExperiment - Standalone Mode', () => {
    it('should create variant nodes as children of base node', async () => {
      const state = useSimulationStore.getState();

      // Set up: root node with one child
      state.addSimulation('Experiment Test', state.savedTemplates[0]);
      expect(state.currentSimulation).toBeDefined();

      // Manually set up a node at depth 1
      useSimulationStore.setState({
        nodes: [
          {
            id: 'root',
            display_id: '0',
            parentId: null,
            name: 'Root',
            depth: 0,
            isLeaf: false,
            status: 'completed' as const,
            timestamp: new Date().toISOString(),
            worldTime: new Date().toISOString()
          },
          {
            id: 'node-1',
            display_id: '1',
            parentId: 'root',
            name: 'Node 1',
            depth: 1,
            isLeaf: true,
            status: 'pending' as const,
            timestamp: new Date().toISOString(),
            worldTime: new Date().toISOString()
          }
        ],
        selectedNodeId: 'node-1'
      });

      const initialNodesCount = useSimulationStore.getState().nodes.length;

      // Run experiment with 2 variants
      const variants = [
        { name: 'Variant A', ops: [] },
        { name: 'Variant B', ops: [] }
      ];

      state.runExperiment('node-1', 'Test Experiment', variants);

      // Should create 2 new nodes as children of node-1
      expect(useSimulationStore.getState().nodes.length).toBe(initialNodesCount + 2);

      // Check that the new nodes are children of node-1
      const variantNodes = useSimulationStore.getState().nodes.filter((n: any) => n.parentId === 'node-1');
      expect(variantNodes.length).toBe(2);

      // Node-1 should no longer be a leaf
      const node1 = useSimulationStore.getState().nodes.find((n: any) => n.id === 'node-1');
      expect(node1?.isLeaf).toBe(false);
    });

    it('should select the first variant node after experiment', async () => {
      const state = useSimulationStore.getState();

      state.addSimulation('Experiment Test', state.savedTemplates[0]);

      useSimulationStore.setState({
        nodes: [
          {
            id: 'root',
            display_id: '0',
            parentId: null,
            name: 'Root',
            depth: 0,
            isLeaf: false,
            status: 'completed' as const,
            timestamp: new Date().toISOString(),
            worldTime: new Date().toISOString()
          },
          {
            id: 'node-1',
            display_id: '1',
            parentId: 'root',
            name: 'Node 1',
            depth: 1,
            isLeaf: true,
            status: 'pending' as const,
            timestamp: new Date().toISOString(),
            worldTime: new Date().toISOString()
          }
        ],
        selectedNodeId: 'node-1'
      });

      const variants = [
        { name: 'Variant A', ops: [] },
        { name: 'Variant B', ops: [] }
      ];

      state.runExperiment('node-1', 'Test Experiment', variants);

      // Should select the first variant node
      const newSelectedId = useSimulationStore.getState().selectedNodeId;
      expect(newSelectedId).not.toBe('node-1');

      const selectedNode = useSimulationStore.getState().nodes.find((n: any) => n.id === newSelectedId);
      expect(selectedNode?.parentId).toBe('node-1');
    });

    it('should add a success notification after experiment', async () => {
      const state = useSimulationStore.getState();

      state.addSimulation('Experiment Test', state.savedTemplates[0]);

      useSimulationStore.setState({
        nodes: [
          {
            id: 'root',
            display_id: '0',
            parentId: null,
            name: 'Root',
            depth: 0,
            isLeaf: false,
            status: 'completed' as const,
            timestamp: new Date().toISOString(),
            worldTime: new Date().toISOString()
          },
          {
            id: 'node-1',
            display_id: '1',
            parentId: 'root',
            name: 'Node 1',
            depth: 1,
            isLeaf: true,
            status: 'pending' as const,
            timestamp: new Date().toISOString(),
            worldTime: new Date().toISOString()
          }
        ],
        selectedNodeId: 'node-1'
      });

      state.runExperiment('node-1', 'Test Experiment', [{ name: 'Variant A', ops: [] }]);

      // Should have a success notification
      expect(useSimulationStore.getState().notifications.length).toBeGreaterThan(0);
      const successNotif = useSimulationStore.getState().notifications.find((n: any) => n.type === 'success');
      expect(successNotif).toBeDefined();
    });
  });
});
