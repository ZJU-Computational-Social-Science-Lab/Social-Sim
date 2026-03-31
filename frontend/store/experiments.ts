/**
 * Experiments slice for simulation workspace.
 *
 * What/why: Manages experiment comparison, branching, reporting, and timeline control state for the simulation UI.
 * Key exports: createExperimentsSlice (Zustand slice factory).
 * Used by: SimulationPage, ExperimentDesignModal, ReportModal, ComparisonView.
 */

import { StateCreator } from 'zustand';
import type { ExperimentVariant, SimulationReport, SocialNetwork, SimNode } from '../types';
import * as experimentsApi from '../services/experiments';
import type { EnvironmentSuggestion } from '../services/environmentSuggestions';
import { addTime } from './helpers';
import i18n from '../i18n';

export interface ExperimentsSlice {
  // Comparison state
  compareTargetNodeId: string | null;
  isCompareMode: boolean;
  comparisonSummary: string | null;
  comparisonUseLLM: boolean;

  // Cross-slice state (included here for unified updates)
  nodes?: SimNode[];
  selectedNodeId?: string | null;
  logs?: any[];
  rawEvents?: any[];

  // Analysis config
  analysisConfig: {
    maxEvents: number;
    samplePerRound: number;
    focusAgents: string[];
    enableLLM: boolean;
    roundStart: number | null;
    roundEnd: number | null;
  };

  // Actions
  setComparisonUseLLM: (v: boolean) => void;
  setCompareTarget: (id: string | null) => void;
  toggleCompareMode: (isOpen: boolean) => void;
  generateComparisonAnalysis: () => Promise<void>;

  // Auto-advance
  isAutoAdvancing: boolean;
  autoAdvanceTotal: number;
  autoAdvanceCurrent: number;
  highlightedNodeId: string | null;
  startAutoAdvance: (steps: number, delayMs?: number) => Promise<void>;
  stopAutoAdvance: () => void;

  // Simulation control
  advanceSimulation: () => Promise<void>;
  branchSimulation: () => void;
  deleteNode: () => Promise<void>;

  // Experiment execution
  runExperiment: (baseNodeId: string, name: string, variants: ExperimentVariant[]) => void;

  // Report generation
  generateReport: () => Promise<void>;
  exportReport: (format: 'json' | 'md') => void;
  updateAnalysisConfig: (patch: Partial<ExperimentsSlice['analysisConfig']>) => void;
}

// Module-scope WebSocket handle to avoid duplicate connections
let _treeSocket: WebSocket | null = null;
let _treeSocketRefreshTimer: number | null = null;

const closeTreeSocket = () => {
  if (_treeSocket) {
    try { _treeSocket.close(); } catch (e) { /* ignore */ }
    _treeSocket = null;
  }
  if (_treeSocketRefreshTimer) {
    window.clearTimeout(_treeSocketRefreshTimer);
    _treeSocketRefreshTimer = null;
  }
};

export const createExperimentsSlice: StateCreator<
  ExperimentsSlice,
  [],
  [],
  ExperimentsSlice
> = (set, get) => ({
  // Initial state
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
  isAutoAdvancing: false,
  autoAdvanceTotal: 0,
  autoAdvanceCurrent: 0,
  highlightedNodeId: null,

  // Actions
  updateAnalysisConfig: (patch) => {
    set((state) => ({
      analysisConfig: { ...state.analysisConfig, ...patch }
    }));
  },

  stopAutoAdvance: () => {
    set({
      isAutoAdvancing: false,
      autoAdvanceTotal: 0,
      autoAdvanceCurrent: 0,
      highlightedNodeId: null,
    } as any);
  },

  startAutoAdvance: async (steps: number, delayMs: number = 500) => {
    const state = get() as any;

    // Guards
    if (!state.currentSimulation || !state.selectedNodeId) {
      console.error('[startAutoAdvance] No simulation or node selected');
      return;
    }
    if (state.isAutoAdvancing || state.isGenerating) {
      console.warn('[startAutoAdvance] Already in progress');
      return;
    }

    // Validate and clamp inputs
    const totalSteps = Math.min(100, Math.max(1, Math.floor(steps)));
    const delay = Math.min(5000, Math.max(100, delayMs));

    set({
      isAutoAdvancing: true,
      autoAdvanceTotal: totalSteps,
      autoAdvanceCurrent: 0,
    } as any);

    for (let i = 0; i < totalSteps; i++) {
      // CRITICAL: Read fresh state on every iteration so that
      // stopAutoAdvance() is detected between steps.
      const current = get() as any;
      if (!current.isAutoAdvancing) {
        current.addNotification?.(
          'info',
          i18n.t('simPage.autoAdvanceStopped', { current: i, total: totalSteps })
        );
        return;
      }

      set({ autoAdvanceCurrent: i + 1 } as any);

      try {
        await current.advanceSimulation();

        // Highlight newly selected node
        const afterAdvance = get() as any;
        if (afterAdvance.selectedNodeId) {
          const nodeId = afterAdvance.selectedNodeId;
          set({ highlightedNodeId: nodeId } as any);

          // Clear highlight after 2 seconds
          setTimeout(() => {
            const s = get() as any;
            if (s.highlightedNodeId === nodeId) {
              set({ highlightedNodeId: null } as any);
            }
          }, 2000);
        }
      } catch (error) {
        console.error('[startAutoAdvance] Step failed:', error);
        (get() as any).addNotification?.(
          'error',
          i18n.t('simPage.autoAdvanceError', { error: String(error) })
        );
        set({
          isAutoAdvancing: false,
          autoAdvanceTotal: 0,
          autoAdvanceCurrent: 0,
        } as any);
        return;
      }

      // Delay between steps (skip after last step)
      if (i < totalSteps - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // All steps complete
    const final = get() as any;
    if (final.isAutoAdvancing) {
      set({
        isAutoAdvancing: false,
        autoAdvanceTotal: 0,
        autoAdvanceCurrent: 0,
      } as any);
      final.addNotification?.(
        'success',
        i18n.t('simPage.autoAdvanceComplete', { count: totalSteps })
      );
    }
  },

  setComparisonUseLLM: (v) => set({ comparisonUseLLM: v }),
  setCompareTarget: (id) => set({ compareTargetNodeId: id }),
  toggleCompareMode: (isOpen) => set({ isCompareMode: isOpen, comparisonSummary: null }),

  generateComparisonAnalysis: async () => {
    const state = get() as any;
    if (!state.currentSimulation || !state.selectedNodeId || !state.compareTargetNodeId) return;

    // connected: call backend compare
    if (state.engineConfig?.mode === 'connected') {
      try {
        set({ isGenerating: true } as any);
        const simId = state.currentSimulation.id;
        const nodeA = Number(state.selectedNodeId);
        const nodeB = Number(state.compareTargetNodeId);
        if (!Number.isFinite(nodeA) || !Number.isFinite(nodeB)) {
          state.addNotification?.('error', i18n.t('store.selectedNodeNotBackend') || 'Selected node is not a backend node');
          set({ isGenerating: false } as any);
          return;
        }

        const useLLM = Boolean(state.comparisonUseLLM);
        const res = await experimentsApi.compareNodes(simId, nodeA, nodeB, useLLM);
        const summary = res?.summary || (res?.message || '') || i18n.t('store.failedToGenerateSummary') || 'Failed to generate summary';
        set({ comparisonSummary: summary, isGenerating: false } as any);
      } catch (e) {
        console.error(e);
        set({ isGenerating: false } as any);
        state.addNotification?.('error', i18n.t('store.comparisonAnalysisFailed') || 'Comparison analysis failed');
      }
      return;
    }

    // standalone/demo fallback: generate a lightweight mock summary
    set({ isGenerating: true } as any);
    setTimeout(() => {
      set({
        comparisonSummary: i18n.t('store.localDemoComparison') || 'Local demo: two timelines differ in events and agent attributes (demo only).',
        isGenerating: false
      } as any);
    }, 700);
  },

  advanceSimulation: async () => {
    const state = get() as any;
    if (!state.currentSimulation || !state.selectedNodeId || state.isGenerating) return;

    const parentNode = state.nodes?.find((n: any) => n.id === state.selectedNodeId);
    if (!parentNode) {
      console.error('[advanceSimulation] Selected node not found in nodes:', state.selectedNodeId);
      state.addNotification?.('error', i18n.t('store.selectedNodeNotFound') || 'Selected node not found');
      return;
    }

    set({ isGenerating: true } as any);

    try {
      // Connected mode: call backend advance and parse events
      if (state.engineConfig?.mode === 'connected') {
        const { treeAdvanceChain, getTreeGraph, getSimEvents, getSimState } = await import('../services/simulationTree');
        const { mapBackendEventsToLogs, mapGraphToNodes, addTime, formatWorldTime } = await import('./helpers');

        const base = state.engineConfig.endpoint;
        const token = state.engineConfig.token;
        const simId = state.currentSimulation.id;
        const parentNumeric = Number(state.selectedNodeId);

        if (!Number.isFinite(parentNumeric)) {
          console.error('[advanceSimulation] Invalid node ID:', state.selectedNodeId, 'Type:', typeof state.selectedNodeId);
          state.addNotification?.('error', i18n.t('store.selectedNodeNotBackend') || 'Selected node is not a backend node');
          set({ isGenerating: false } as any);
          return;
        }

        const res = await treeAdvanceChain(base, simId, parentNumeric, 1, token);

        // Refresh tree graph
        const graph = await getTreeGraph(base, simId, token);
        if (graph) {
          const nodesMapped = mapGraphToNodes(graph);
          // Use res.child (not res.node_id) as returned by the API
          const newSelectedId = String(res.child);
          set({ nodes: nodesMapped, selectedNodeId: newSelectedId } as any);
        }

        // Fetch events and state in parallel for the NEW node
        const [events, simState] = await Promise.all([
          getSimEvents(base, simId, res.child, token),
          getSimState(base, simId, res.child, token)
        ]);

        console.log('[advanceSimulation] Received simState from backend');
        console.log('[advanceSimulation] simState.agents:', JSON.stringify(simState?.agents?.map((a: any) => ({ name: a.name, knowledgeBase: a.knowledgeBase })), null, 2));

        // Extract social_network from scene_config and update currentSimulation
        const socialNetwork = simState?.scene_config?.social_network || {};
        if (Object.keys(socialNetwork).length > 0) {
          console.log('[advanceSimulation] Found social_network in scene_config:', socialNetwork);
          set((s: any) => ({
            currentSimulation: { ...s.currentSimulation!, socialNetwork }
          }));
        }

        const turnVal = Number(simState?.turns ?? 0) || 0;

        // Map agents from simState, including knowledgeBase updates
        const agentsMapped: any[] = (simState?.agents || []).map((a: any, idx: number) => {
          const existing = state.agents?.find((ex: any) => ex.name === a.name);
          const fallbackRole = a.properties && (a.properties.role || a.properties.title || a.properties.position);
          const fallbackProfile = a.profile || a.user_profile || a.userProfile || (a.properties && (a.properties.profile || a.properties.description)) || existing?.profile || '';
          return {
            id: existing?.id || `a-${idx}-${a.name}`,
            name: a.name,
            role: a.role || fallbackRole || '',
            avatarUrl: existing?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(a.name || String(idx))}`,
            profile: fallbackProfile,
            llmConfig: existing?.llmConfig || { provider: 'mock', model: 'default' },
            properties: a.properties || existing?.properties || {},
            history: existing?.history || {},
            memory: (a.short_memory || []).map((m: any, j: number) => ({
              id: `m-${idx}-${j}`,
              round: turnVal,
              content: String(m.content ?? ''),
              type: (String(m.role ?? '') === 'assistant' || String(m.role ?? '') === 'user') ? 'dialogue' : 'observation',
              timestamp: new Date().toISOString()
            })),
            knowledgeBase: a.knowledgeBase || existing?.knowledgeBase || []
          };
        });

        console.log('[advanceSimulation] Mapped agents:', agentsMapped.map((a: any) => ({ name: a.name, kbCount: a.knowledgeBase?.length || 0 })));

        const eventsArray = Array.isArray(events) ? events : [];

        // Deduplicate events before adding
        const getEventKey = (ev: any): string => {
          if (typeof ev === 'string') return `str:${ev}`;
          if (!ev || typeof ev !== 'object') return `prim:${String(ev)}`;
          const evType = ev.type || ev.event_type || 'unknown';
          const data = ev.data || {};
          const agent = data.agent || '';

          // For system_broadcast events, use text and sender as unique key
          if (evType === 'system_broadcast') {
            const text = data.text || data.message || '';
            const sender = data.sender || '';
            const eventType = data.type || '';
            return `${evType}:${eventType}:${sender}:${text}`;
          }

          // For experiment_action events, include round number to distinguish actions across rounds
          // (data.action is a plain string like "cooperate", not an object)
          if (evType === 'experiment_action') {
            const round = data.round !== undefined ? String(data.round) : '';
            const agentAction = typeof data.action === 'string' ? data.action : '';
            return `${evType}:${agent}:${agentAction}:round${round}`;
          }

          // Use type, agent, content, time, and action to generate unique key
          const content = typeof data.content === 'string' ? data.content.substring(0, 100) : '';
          const time = data.time || '';
          const action = data.action?.action || data.action?.name || '';
          return `${evType}:${agent}:${content}:${time}:${action}`;
        };

        set((prev: any) => {
          const existingKeys = new Set((prev.rawEvents || []).map(getEventKey));
          const batchKeys = new Set<string>();
          const newEvents = eventsArray.filter((ev: any) => {
            const key = getEventKey(ev);
            if (existingKeys.has(key)) return false;
            if (batchKeys.has(key)) return false; // Dedupe within same batch
            batchKeys.add(key);
            return true;
          });

          const newSelectedId = String(res.child);
          const selectedNode = (prev.nodes || []).find((n: any) => n.id === newSelectedId);
          const round = selectedNode?.depth ?? 0;

          const logsMapped = mapBackendEventsToLogs(
            newEvents, // Only map new events
            newSelectedId,
            round,
            agentsMapped,
            false // Don't include all metadata when displaying
          );

          return {
            logs: [...(prev.logs || []), ...logsMapped],
            rawEvents: [...(prev.rawEvents || []), ...newEvents],
            agents: agentsMapped,
            isGenerating: false
          };
        });
        return;
      }

      // Standalone mode - local time advancement
      const existingChildren = (state.nodes || []).filter((n: any) => n.parentId === parentNode.id);
      const nextIndex = existingChildren.length + 1;
      const newNodeId = `n-${Date.now()}`;
      const newDepth = parentNode.depth + 1;

      const { generateNodes, addTime, formatWorldTime } = await import('./helpers');

      const tc = state.currentSimulation.timeConfig || { baseTime: new Date().toISOString(), step: 1, unit: 'hour' as const };
      const nextWorldTime = addTime(parentNode.worldTime, tc.step, tc.unit);

      const newNode: any = {
        id: newNodeId,
        display_id: `${parentNode.display_id}.${nextIndex}`,
        parentId: parentNode.id,
        name: `Round ${newDepth}`,
        depth: newDepth,
        isLeaf: true,
        status: 'running',
        timestamp: new Date().toLocaleTimeString(),
        worldTime: nextWorldTime
      };

      // Standalone mode: only record time advancement
      const newLogs: any[] = [
        {
          id: `sys-${Date.now()}`,
          nodeId: newNodeId,
          round: newDepth,
          type: 'SYSTEM',
          content: `${i18n.t('store.timeAdvancedTo') || 'Time advanced to'}: ${formatWorldTime(nextWorldTime)} (Round ${newDepth})` + ` (${i18n.t('store.offlineModeNoAction') || 'offline mode, no actual action performed'})`,
          timestamp: newNode.timestamp
        }
      ];

      const updatedAgents = (state.agents || []).map((agent: any) => {
        const newHistory = { ...agent.history };
        Object.keys(newHistory).forEach(key => {
          const prevValues = newHistory[key] || [50];
          newHistory[key] = [...prevValues, Math.max(0, Math.min(100, prevValues[prevValues.length - 1] + (Math.floor(Math.random() * 10) - 5)))];
        });
        return { ...agent, history: newHistory };
      });

      set((s: any) => ({
        nodes: [...(s.nodes || []).map((n: any) => n.id === parentNode.id ? { ...n, isLeaf: false } : n), newNode],
        selectedNodeId: newNodeId,
        logs: [...(s.logs || []), ...newLogs],
        agents: updatedAgents,
        isGenerating: false
      }));
    } catch (e) {
      console.error('advanceSimulation failed', e);
      set({ isGenerating: false } as any);
      state.addNotification?.('error', i18n.t('store.simulationAdvanceFailed') || 'Simulation advance failed');
    }
  },

  branchSimulation: async () => {
    const state = get() as any;
    if (!state.currentSimulation || !state.selectedNodeId) return;

    try {
      if (state.engineConfig?.mode === 'connected') {
        const { treeBranchPublic, getTreeGraph } = await import('../services/simulationTree');
        const { mapGraphToNodes } = await import('./helpers');

        const base = state.engineConfig.endpoint;
        const token = state.engineConfig.token;
        const parentNumeric = Number(state.selectedNodeId);

        if (!Number.isFinite(parentNumeric)) {
          console.error('[branchSimulation] Invalid node ID:', state.selectedNodeId, 'Type:', typeof state.selectedNodeId);
          state.addNotification?.('error', i18n.t('store.selectedNodeNotBackend') || 'Selected node is not a backend node');
          return;
        }

        // treeBranchPublic expects: (base, id, parent, text, token)
        const result = await treeBranchPublic(base, state.currentSimulation.id, parentNumeric, i18n.t('store.branch') || 'Branch', token);

        if (result?.child !== undefined) {
          // Refresh tree
          const graph = await getTreeGraph(base, state.currentSimulation.id, token);
          if (graph) {
            const nodesMapped = mapGraphToNodes(graph);
            set({ nodes: nodesMapped } as any);
          }
          state.addNotification?.('success', i18n.t('store.branchCreated') || 'Branch created');
        }
      } else {
        // Standalone mode - create mock branch
        // A branch creates a SIBLING node (same parent, same depth) for what-if scenarios
        const baseNode = state.nodes?.find((n: any) => n.id === state.selectedNodeId);
        if (!baseNode || !baseNode.parentId) {
          // Can't branch from root (no parent)
          state.addNotification?.('error', i18n.t('store.cannotBranchFromRoot') || 'Cannot create branch from root node');
          return;
        }

        // Find the parent to create a sibling relationship
        const parentNode = state.nodes?.find((n: any) => n.id === baseNode.parentId);
        if (!parentNode) {
          state.addNotification?.('error', i18n.t('store.cannotFindParentNode') || 'Cannot find parent node');
          return;
        }

        // Count existing siblings to determine display_id
        const existingSiblings = (state.nodes || []).filter((n: any) => n.parentId === parentNode.id);
        const nextIndex = existingSiblings.length + 1;

        const newNode = {
          id: `branch-${Date.now()}`,
          display_id: `${parentNode.display_id}.${nextIndex}`,
          parentId: parentNode.id,  // Same parent as baseNode (sibling relationship)
          name: `${i18n.t('store.branch') || 'Branch'}: ${i18n.t('store.parallelRun') || 'Parallel Run'}`,
          depth: baseNode.depth,  // Same depth as baseNode (sibling relationship)
          isLeaf: true,
          status: 'pending' as const,
          timestamp: new Date().toLocaleTimeString(),
          worldTime: parentNode.worldTime || baseNode.worldTime
        };

        // Add a log entry for the branch
        const newLogs: any[] = [
          {
            id: `sys-${Date.now()}`,
            nodeId: newNode.id,
            round: newNode.depth,
            type: 'SYSTEM',
            content: `${i18n.t('store.createdBranch') || 'Created branch'}: ${newNode.display_id} (${i18n.t('store.parallelScenario') || 'parallel scenario'})`,
            timestamp: newNode.timestamp
          }
        ];

        set((s: any) => ({
          nodes: [...(s.nodes || []), newNode],
          selectedNodeId: newNode.id,
          logs: [...(s.logs || []), ...newLogs]
        }));
        state.addNotification?.('success', i18n.t('store.branchCreatedLocalMode') || 'Branch created (local mode)');
      }
    } catch (e) {
      console.error('branchSimulation failed', e);
      state.addNotification?.('error', i18n.t('store.backendBranchFailed') || 'Branch creation failed');
    }
  },

  deleteNode: async () => {
    const state = get() as any;
    if (!state.currentSimulation || !state.selectedNodeId || state.selectedNodeId === 'root') {
      state.addNotification?.('error', i18n.t('store.cannotDeleteRoot') || 'Cannot delete root node');
      return;
    }

    try {
      if (state.engineConfig?.mode === 'connected') {
        const { treeDeleteSubtree } = await import('../services/simulationTree');
        await treeDeleteSubtree(
          state.engineConfig.endpoint,
          state.currentSimulation.id,
          Number(state.selectedNodeId),
          state.engineConfig.token
        );

        // Refresh tree
        const { getTreeGraph } = await import('../services/simulationTree');
        const { mapGraphToNodes } = await import('./helpers');
        const graph = await getTreeGraph(
          state.engineConfig.endpoint,
          state.currentSimulation.id,
          state.engineConfig.token
        );
        if (graph) {
          set({ nodes: mapGraphToNodes(graph) });
        }
      } else {
        // Standalone mode - remove node and children
        const nodeIdsToDelete = new Set<string>();
        const nodes = state.nodes || [];
        const collectDescendants = (nodeId: string) => {
          nodeIdsToDelete.add(nodeId);
          nodes.filter((n: any) => n.parentId === nodeId).forEach((child: any) => collectDescendants(child.id));
        };
        collectDescendants(state.selectedNodeId);
        set((s: any) => ({
          nodes: (s.nodes || []).filter((n: any) => !nodeIdsToDelete.has(n.id)),
          selectedNodeId: 'root'
        }));
      }
      state.addNotification?.('success', i18n.t('store.nodeDeleted') || 'Node deleted');
    } catch (e) {
      console.error('deleteNode failed', e);
      state.addNotification?.('error', i18n.t('store.failedToDeleteNode') || 'Failed to delete node');
    }
  },

  runExperiment: (baseNodeId, experimentName, variants) => {
    const state = get() as any;
    if (!state.currentSimulation) return;

    const baseNode = state.nodes?.find((n: any) => n.id === baseNodeId);
    if (!baseNode) return;

    const parentNumeric = Number(baseNode.id);
    if (!Number.isFinite(parentNumeric)) {
      state.addNotification?.('error', i18n.t('store.selectedNodeNotBackend') || 'Selected node is not a backend node');
      return;
    }
    const parentOfVariants = baseNode.parentId == null ? null : String(baseNode.parentId);
    const existingSiblingIds = (state.nodes || [])
      .filter((n: any) => {
        if (parentOfVariants === null) return n.parentId === null;
        return String(n.parentId) === parentOfVariants;
      })
      .map((n: any) => String(n.id));

    // connected mode -> call backend create + run; standalone -> keep existing mock behavior
    if (state.engineConfig?.mode === 'connected') {
      (async () => {
        try {
          const simId = state.currentSimulation!.id;
          const token = (state.engineConfig as any).token as string | undefined;

          // prepare variant specs for backend (ops expected by backend)
          const variantSpecs = variants.map((v) => ({ name: v.name, ops: v.ops || [] }));

          // Step 1: create experiment
          const createRes = await experimentsApi.createExperiment(simId, experimentName, parentNumeric, variantSpecs);
          const expId = (createRes as any).experiment_id || (createRes as any).id || (createRes as any).experiment?.id;
          if (!expId) {
            state.addNotification?.('error', i18n.t('store.failedToStartExperiment') || 'Failed to start experiment');
            return;
          }
          const expIdStr = String(expId);

          // Make parent non-leaf immediately so UI shows branching intent
          set((s: any) => ({ nodes: (s.nodes || []).map((n: any) => (n.id === baseNodeId ? { ...n, isLeaf: false } : n)) }));

          // Emit a local system log describing variant ops so the user can see what changed
          const summarizeOps = (ops: any[]) => {
            if (!ops || !ops.length) return '无操作更改';
            const detailed = ops
              .map((o: any, idx: number) => {
                const label = o?.op || o?.name || `op${idx + 1}`;
                const body = JSON.stringify(o, null, 2) || '';
                return `[#${idx + 1}] ${label}\n${body}`;
              })
              .join('\n');
            return detailed.length > 1200 ? detailed.slice(0, 1200) + '…' : detailed;
          };
          const nowIso = new Date().toISOString();
          const variantLogs = variants.map((v, idx) => ({
            id: `exp-log-${Date.now()}-${idx}`,
            nodeId: String(parentNumeric),
            round: 0,
            type: 'SYSTEM',
            content: `${experimentName} / ${v.name}: ${summarizeOps(v.ops || [])}`,
            timestamp: nowIso
          }));

          const dedupLogs = (logsArr: any[]) => {
            const seen = new Set<string>();
            const out: any[] = [];
            for (const l of logsArr || []) {
              if (!l) continue;
              const key = `${l.nodeId || ''}|${l.type || ''}|${l.content || ''}`;
              if (seen.has(key)) continue;
              seen.add(key);
              out.push(l);
            }
            return out;
          };

          // Step 2: run experiment
          const runRes = await experimentsApi.runExperiment(simId, expIdStr, 1);
          const runId = runRes?.run_id || (runRes as any)?.run_id;
          state.addNotification?.('success', i18n.t('store.experimentSubmitted', { name: experimentName, runId }) || `Experiment "${experimentName}" submitted (run ID: ${runId})`);

          const { getTreeGraph, getSimEvents, getSimState } = await import('../services/simulationTree');
          const { mapGraphToNodes, mapBackendEventsToLogs } = await import('./helpers');

          const applyChildrenWithLogs = async (mapped: any[], childrenIds: { node_id: number | string; variant_id?: any }[]) => {
            const parentLogsSnapshot = (get() as any).logs || [];
            // 复制的是“被选中的基准节点”的现有日志（即 baseNode），而不是它的父节点
            const parentLogsForCopy = parentLogsSnapshot.filter((l: any) => String(l.nodeId) === String(baseNode.id));
            set((s: any) => {
              const variantIdMap = new Map<string, any>();
              childrenIds.forEach((c) => variantIdMap.set(String(c.node_id), c.variant_id));

              const augmented = mapped.map((n: any) => {
                if (variantIdMap.has(String(n.id))) {
                  return { ...n, meta: { experiment_id: expIdStr, variant_id: variantIdMap.get(String(n.id)) } };
                }
                return n;
              });

              const existingLogIds = new Set((s.logs || []).map((l: any) => l.id));
              const copyVariantLogs = childrenIds.flatMap((c, idx) => {
                const baseLog = variantLogs[idx];
                if (!baseLog) return [] as any[];
                const newId = `${baseLog.id}-child-${c.node_id}`;
                if (existingLogIds.has(newId)) return [] as any[];
                return [{ ...baseLog, id: newId, nodeId: String(c.node_id) }];
              });

              const copyParentLogs = childrenIds.flatMap((c) => {
                const childId = String(c.node_id);
                return parentLogsForCopy.map((pl: any, idx: number) => {
                  const newId = `${pl.id}-copy-${childId}-${idx}`;
                  if (existingLogIds.has(newId)) return null;
                  return { ...pl, id: newId, nodeId: childId };
                }).filter(Boolean) as any[];
              });

              const firstChildId = childrenIds[0]?.node_id ? String(childrenIds[0].node_id) : s.selectedNodeId;
              return {
                nodes: augmented,
                selectedNodeId: firstChildId,
                logs: copyVariantLogs.length || copyParentLogs.length
                  ? dedupLogs([...(s.logs || []), ...copyVariantLogs, ...copyParentLogs])
                  : s.logs
              } as any;
            });

            // Fetch backend events/state for each child and append mapped logs so child view is not empty
            const agents = (get() as any).agents || [];
            await Promise.all(childrenIds.map(async (c) => {
              const cidNum = Number(c.node_id);
              if (!Number.isFinite(cidNum)) return;
              try {
                const [eventsRaw, simState] = await Promise.all([
                  getSimEvents(state.engineConfig.endpoint, simId, cidNum, token),
                  getSimState(state.engineConfig.endpoint, simId, cidNum, token)
                ]);
                const events = (eventsRaw || []).map((ev: any) => ({ ...ev, node: cidNum }));
                const roundVal = Number(simState?.turns ?? 0) || 0;
                const logsFromEvents = mapBackendEventsToLogs(events || [], String(c.node_id), roundVal, agents, true);
                if (logsFromEvents && logsFromEvents.length) {
                  set((s: any) => ({
                    logs: dedupLogs([...(s.logs || []), ...logsFromEvents.filter((l: any) => l && l.id)])
                  } as any));
                }
              } catch (e) {
                // ignore
              }
            }));
          };

          // Fast path: if runRes returns node_mapping, apply immediately
          const runMapping = (runRes as any)?.node_mapping;
          if (Array.isArray(runMapping) && runMapping.length) {
            const graph = await getTreeGraph(state.engineConfig.endpoint, simId, token);
            if (graph) {
              const mapped = mapGraphToNodes(graph);
              const childrenIds = runMapping.map((m: any) => ({ node_id: m.node_id, variant_id: m.variant_id }));
              await applyChildrenWithLogs(mapped, childrenIds);
              return;
            }
          }

          // Helper: refresh graph and attempt to locate variant nodes
          const tryResolve = async (): Promise<boolean> => {
            const [graph, expDetail] = await Promise.all([
              getTreeGraph(state.engineConfig.endpoint, simId, token),
              experimentsApi.getExperiment(simId, expIdStr)
            ]);

            if (!graph) return false;
            // Reset logs once at first resolve attempt to avoid duplicates from repeated polling
            set((s: any) => ({ logs: dedupLogs(s.logs || []) } as any));
            const mapped = mapGraphToNodes(graph);
            const variantNodesFromExp = (expDetail?.experiment?.variants || []).filter((v: any) => v && v.node_id);

            // If experiment detail already has node_ids, prefer those
            if (variantNodesFromExp.length) {
              const variantIds = variantNodesFromExp.map((v: any) => String(v.node_id));
              const children = mapped.filter((n: any) => {
                  const isVariant = variantIds.includes(String(n.id));
                  if (!isVariant) return false;
                  if (parentOfVariants === null) return n.parentId === null;
                  return String(n.parentId) === parentOfVariants;
                });
              if (children.length === variantIds.length) {
                // attach meta and select first child; also copy variant logs onto child nodes
                await applyChildrenWithLogs(mapped, variantNodesFromExp.map((v: any) => ({ node_id: v.node_id, variant_id: v.id })));
                return true;
              }
            }

            // Otherwise, rely on graph children order under parent
            const children = mapped
              .filter((n: any) => {
                const isUnderParent = parentOfVariants === null ? n.parentId === null : String(n.parentId) === parentOfVariants;
                if (!isUnderParent) return false;
                // Only consider new siblings (exclude the baseline node and pre-existing siblings)
                const isExisting = existingSiblingIds.includes(String(n.id)) || String(n.id) === String(baseNode.id);
                return !isExisting;
              })
              .sort((a: any, b: any) => Number(a.id) - Number(b.id));
            if (children.length >= variants.length) {
              // Attach variant logs to ordered children
              const parentLogsSnapshot = (get() as any).logs || [];
              const parentLogsForCopy = parentLogsSnapshot.filter((l: any) => String(l.nodeId) === String(baseNode.id));

              set((s: any) => {
                const existingLogIds = new Set((s.logs || []).map((l: any) => l.id));
                const copyVariantLogs = children.slice(0, variants.length).flatMap((child: any, idx: number) => {
                  const baseLog = variantLogs[idx];
                  if (!baseLog) return [] as any[];
                  const newId = `${baseLog.id}-child-${child.id}`;
                  if (existingLogIds.has(newId)) return [] as any[];
                  return [{ ...baseLog, id: newId, nodeId: String(child.id) }];
                });

                const copyParentLogs = children.slice(0, variants.length).flatMap((child: any) => {
                  const childId = String(child.id);
                  return parentLogsForCopy.map((pl: any, idx: number) => {
                    const newId = `${pl.id}-copy-${childId}-${idx}`;
                    if (existingLogIds.has(newId)) return null;
                    return { ...pl, id: newId, nodeId: childId };
                  }).filter(Boolean) as any[];
                });

                return {
                  nodes: mapped,
                  selectedNodeId: String(children[0].id),
                  logs: copyVariantLogs.length || copyParentLogs.length
                    ? dedupLogs([...(s.logs || []), ...copyVariantLogs, ...copyParentLogs])
                    : s.logs
                } as any;
              });
              // Fetch backend events for ordered children (fallback path)
              await Promise.all(children.slice(0, variants.length).map(async (child: any) => {
                const cidNum = Number(child.id);
                if (!Number.isFinite(cidNum)) return;
                try {
                  const [eventsRaw, simState] = await Promise.all([
                    getSimEvents(state.engineConfig.endpoint, simId, cidNum, token),
                    getSimState(state.engineConfig.endpoint, simId, cidNum, token)
                  ]);
                  const events = (eventsRaw || []).map((ev: any) => ({ ...ev, node: cidNum }));
                  const roundVal = Number(simState?.turns ?? 0) || 0;
                  const agents = (get() as any).agents || [];
                  const logsFromEvents = mapBackendEventsToLogs(events || [], String(child.id), roundVal, agents, true);
                  if (logsFromEvents && logsFromEvents.length) {
                    set((s: any) => ({ logs: dedupLogs([...(s.logs || []), ...logsFromEvents.filter((l: any) => l && l.id)]) } as any));
                  }
                } catch (e) {
                  // ignore
                }
              }));
              return true;
            }

            // Update nodes anyway to reflect latest graph
            set({ nodes: mapped } as any);
            return false;
          };

          // Try immediate resolve once
          let resolved = await tryResolve();
          if (resolved) return;

          // Poll until resolved or timeout
          const pollInterval = 2000;
          const maxAttempts = 30;
          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await new Promise((r) => setTimeout(r, pollInterval));
            resolved = await tryResolve();
            if (resolved) return;
          }

          state.addNotification?.('warning', i18n.t('store.experimentNodesTimeout') || 'Experiment nodes not available yet; please refresh or retry.');
        } catch (e) {
          console.error('Experiment error', e);
          state.addNotification?.('error', (i18n.t('store.failedToStartExperiment') || 'Failed to start experiment') + ': ' + (e as any).message);
        }
      })();
      return;
    }

    // fallback: standalone/local mock behaviour
    const timeConfig = state.timeConfig || { baseTime: new Date().toISOString(), unit: 'hour' as const, step: 1 };
    const nextWorldTime = addTime(baseNode.worldTime || timeConfig.baseTime, timeConfig.step, timeConfig.unit);

    const newNodes: any[] = [];
    const updatedNodes = (state.nodes || []).map((n: any) => n.id === baseNodeId ? { ...n, isLeaf: false } : n);

    variants.forEach((variant, index) => {
      const newNodeId = `exp-${Date.now()}-${index}`;
      const newNode = {
        id: newNodeId,
        display_id: `${baseNode.display_id}.${index + 1}`,
        parentId: baseNode.id,
        name: `${experimentName}: ${variant.name}`,
        depth: baseNode.depth + 1,
        isLeaf: true,
        status: 'pending' as const,
        timestamp: new Date().toLocaleTimeString(),
        worldTime: nextWorldTime
      };
      newNodes.push(newNode);
    });

    set({
      nodes: [...updatedNodes, ...newNodes],
      selectedNodeId: newNodes[0].id
    });
    state.addNotification?.('success', i18n.t('store.batchExperimentStarted', { name: experimentName }) || `Batch experiment "${experimentName}" started (local mode)`);
  },

  generateReport: async () => {
    const state = get() as any;
    if (!state.currentSimulation || !state.logs) return;

    set({ isGeneratingReport: true } as any);

    try {
      const logs = state.logs || [];
      const agents = state.agents || [];
      const analysisConfig = state.analysisConfig;

      // Filter events by round range if specified
      let filteredLogs = logs;
      if (analysisConfig.roundStart !== null) {
        filteredLogs = filteredLogs.filter((l: any) => l.round >= analysisConfig.roundStart!);
      }
      if (analysisConfig.roundEnd !== null) {
        filteredLogs = filteredLogs.filter((l: any) => l.round <= analysisConfig.roundEnd!);
      }

      // Sample events
      const maxEvents = analysisConfig.maxEvents || 800;
      const samplePerRound = analysisConfig.samplePerRound || 5;
      const roundGroups = new Map<number, any[]>();
      filteredLogs.forEach((log: any) => {
        const round = log.round || 0;
        if (!roundGroups.has(round)) roundGroups.set(round, []);
        const bucket = roundGroups.get(round)!;
        if (bucket.length < samplePerRound) {
          bucket.push(log);
        }
      });

      const sampledLogs: any[] = [];
      roundGroups.forEach((bucket) => sampledLogs.push(...bucket));

      // Build report parts
      const agentNames = agents.map((a: any) => a.name);
      const actions = sampledLogs.filter((l: any) => l.type === 'AGENT_ACTION');
      const talks = sampledLogs.filter((l: any) => l.type === 'AGENT_SAY');
      const errors = sampledLogs.filter((l: any) => l.content?.includes?.('错误') || l.content?.includes?.('error'));

      const summary = `报告生成时间: ${new Date().toLocaleString()}\n` +
        `分析事件数: ${sampledLogs.length} / ${logs.length}\n` +
        `智能体: ${agentNames.join(', ') || '无'}\n` +
        `动作数: ${actions.length}\n` +
        `对话数: ${talks.length}\n` +
        `错误数: ${errors.length}`;

      const keyEvents = sampledLogs
        .filter((l: any) => l.type !== 'AGENT_METADATA')
        .slice(0, 20)
        .map((l: any) => ({
          round: l.round,
          description: l.content?.slice(0, 100) || ''
        }));

      const agentAnalysis = agents.slice(0, 6).map((a: any) => ({
        agentName: a.name,
        analysis: `智能体 ${a.name} 的行为分析`
      }));

      let reportParts = { summary, keyEvents, agentAnalysis, suggestions: [] as string[] };

      // Try LLM refinement if enabled
      if (analysisConfig.enableLLM && state.currentProviderId) {
        try {
          const { apiClient } = await import('../services/client');
          const prompt = `你是分析员，请用中文简洁总结。\n已有摘要:\n${summary.slice(0, 800)}\n` +
            `\n关键事件:\n${keyEvents.slice(-12).map((e) => `- R${e.round}: ${e.description}`).join('\n')}\n` +
            `\n智能体分析:\n${agentAnalysis.slice(0, 6).map((a) => `- ${a.agentName}: ${a.analysis}`).join('\n')}\n` +
            `\n请输出 JSON，字段: summary(string), keyEvents([{round,description} 至多8条]), suggestions(string[] 至多6条), agentAnalysis([{agentName,analysis} 至多6条]).`;

          const res = await apiClient.post<{ text: string }>("llm/refine_report", {
            prompt,
            provider_id: state.currentProviderId
          });
          const parsed = JSON.parse(res.data.text || "{}");
          if (parsed.summary) {
            reportParts = {
              summary: parsed.summary,
              keyEvents: parsed.keyEvents || keyEvents,
              agentAnalysis: parsed.agentAnalysis || agentAnalysis,
              suggestions: parsed.suggestions || []
            };
          }
        } catch (e) {
          console.warn('LLM refinement failed, using template', e);
        }
      }

      const report: SimulationReport = {
        id: `rep-${Date.now()}`,
        generatedAt: new Date().toISOString(),
        summary: reportParts.summary,
        keyEvents: reportParts.keyEvents,
        suggestions: reportParts.suggestions,
        agentAnalysis: reportParts.agentAnalysis,
        refinedByLLM: analysisConfig.enableLLM
      };

      set((s: any) => ({
        currentSimulation: s.currentSimulation ? { ...s.currentSimulation, report } : s.currentSimulation,
        isGeneratingReport: false
      }));
      state.addNotification?.('success', i18n.t('store.reportGenerationComplete') || 'Report generation complete');
    } catch (e) {
      console.error('generateReport failed', e);
      set({ isGeneratingReport: false } as any);
      state.addNotification?.('error', i18n.t('store.reportGenerationFailed') || 'Report generation failed, please try again later');
    }
  },

  exportReport: (format) => {
    const state = get() as any;
    const report = state.currentSimulation?.report;
    if (!report) {
      state.addNotification?.('error', i18n.t('store.noReportToExport') || 'No report to export');
      return;
    }

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${state.currentSimulation?.name || 'simulation'}_report.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // markdown export
    const lines: string[] = [];
    lines.push(`# ${i18n.t('store.simulationReport') || 'Simulation Experiment Analysis Report'}`);
    lines.push(`${i18n.t('store.generatedAt') || 'Generated at'}: ${new Date(report.generatedAt).toLocaleString()}`);
    lines.push(`\n## ${i18n.t('store.summary') || 'Summary'}\n${report.summary}`);
    lines.push(`\n## ${i18n.t('store.keyEvents') || 'Key Events'}`);
    report.keyEvents.forEach((ev) => {
      lines.push(`- R${ev.round}: ${ev.description}`);
    });
    lines.push(`\n## ${i18n.t('store.suggestions') || 'Suggestions'}`);
    report.suggestions.forEach((sug) => lines.push(`- ${sug}`));
    lines.push(`\n## ${i18n.t('store.agentAnalysis') || 'Agent Analysis'}`);
    report.agentAnalysis.forEach((a) => {
      lines.push(`- **${a.agentName}**: ${a.analysis}`);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${state.currentSimulation?.name || 'simulation'}_report.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
});
