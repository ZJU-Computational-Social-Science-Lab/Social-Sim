/**
 * Experiments slice for simulation workspace.
 *
 * What/why: Manages experiment comparison, branching, reporting, and timeline control state for the simulation UI.
 * Key exports: createExperimentsSlice (Zustand slice factory).
 * Used by: SimulationPage, ExperimentDesignModal, ReportModal, ComparisonView.
 */

import { StateCreator } from 'zustand';
import type { ExperimentVariant, SimNode } from '../types';
import * as experimentsApi from '../services/experiments';
import { buildSimulationReportMarkdown, generateSimulationReport, type ExperimentAnalysisConfig } from '../services/experimentReports';
import {
  addTime,
  formatWorldTime,
  mapBackendEventsToLogs,
  mapGraphToNodes,
} from './helpers';
import {
  addVariantMetaToNodes,
  buildExperimentVariantLogs,
  copyLogsToChildren,
  dedupeLogsByNodeAndContent,
  filterUniqueBackendEvents,
  type VariantChildRef,
} from '../services/experimentTreeLogs';
import { mapBackendAgents, withSimulationSocialNetwork } from '../services/simulationSnapshots';
import {
  getSimEvents,
  getSimState,
  getTreeGraph,
  treeAdvanceChain,
  treeBranchPublic,
  treeDeleteSubtree,
} from '../services/simulationTree';
import i18n from '../i18n';
import type { StoreState } from './storeState';

export type BranchCreationType = 'parallel' | 'compare' | 'perturbation' | 'custom';

export interface BranchCreationInput {
  name?: string;
  branchType?: BranchCreationType;
  inheritCurrentState?: boolean;
  notes?: string;
}

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
  analysisConfig: ExperimentAnalysisConfig;

  // Actions
  setComparisonUseLLM: (v: boolean) => void;
  setCompareTarget: (id: string | null) => void;
  toggleCompareMode: (isOpen: boolean) => void;
  generateComparisonAnalysis: () => Promise<void>;

  // Simulation control
  advanceSimulation: () => Promise<void>;
  branchSimulation: (config?: BranchCreationInput) => Promise<void>;
  deleteNode: () => Promise<void>;

  // Experiment execution
  runExperiment: (baseNodeId: string, name: string, variants: ExperimentVariant[]) => void;

  // Report generation
  generateReport: () => Promise<void>;
  exportReport: (format: 'json' | 'md') => void;
  updateAnalysisConfig: (patch: Partial<ExperimentsSlice['analysisConfig']>) => void;
}

export const createExperimentsSlice: StateCreator<
  StoreState,
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

  // Actions
  updateAnalysisConfig: (patch) => {
    set((state) => ({
      analysisConfig: { ...state.analysisConfig, ...patch }
    }));
  },

  setComparisonUseLLM: (v) => set({ comparisonUseLLM: v }),
  setCompareTarget: (id) => set({ compareTargetNodeId: id }),
  toggleCompareMode: (isOpen) => set({ isCompareMode: isOpen, comparisonSummary: null }),

  generateComparisonAnalysis: async () => {
    const state = get();
    if (!state.currentSimulation || !state.selectedNodeId || !state.compareTargetNodeId) return;

    // connected: call backend compare
    if (state.engineConfig?.mode === 'connected') {
      try {
        set({ isGenerating: true });
        const simId = state.currentSimulation.id;
        const nodeA = Number(state.selectedNodeId);
        const nodeB = Number(state.compareTargetNodeId);
        if (!Number.isFinite(nodeA) || !Number.isFinite(nodeB)) {
          state.addNotification?.('error', i18n.t('store.selectedNodeNotBackend') || 'Selected node is not a backend node');
          set({ isGenerating: false });
          return;
        }

        const useLLM = Boolean(state.comparisonUseLLM);
        const res = await experimentsApi.compareNodes(simId, nodeA, nodeB, useLLM);
        const summary = res?.summary || (res?.message || '') || i18n.t('store.failedToGenerateSummary') || 'Failed to generate summary';
        set({ comparisonSummary: summary, isGenerating: false });
      } catch (e) {
        console.error(e);
        set({ isGenerating: false });
        state.addNotification?.('error', i18n.t('store.comparisonAnalysisFailed') || 'Comparison analysis failed');
      }
      return;
    }

    // standalone/demo fallback: generate a lightweight mock summary
    set({ isGenerating: true });
    setTimeout(() => {
      set({
        comparisonSummary: i18n.t('store.localDemoComparison') || 'Local demo: two timelines differ in events and agent attributes (demo only).',
        isGenerating: false
      });
    }, 700);
  },

  advanceSimulation: async () => {
    const state = get();
    if (!state.currentSimulation || !state.selectedNodeId || state.isGenerating) return;

    const parentNode = state.nodes?.find((node) => node.id === state.selectedNodeId);
    if (!parentNode) {
      console.error('[advanceSimulation] Selected node not found in nodes:', state.selectedNodeId);
      state.addNotification?.('error', i18n.t('store.selectedNodeNotFound') || 'Selected node not found');
      return;
    }

    set({ isGenerating: true });

    try {
      // Connected mode: call backend advance and parse events
      if (state.engineConfig?.mode === 'connected') {
        const base = state.engineConfig.endpoint;
        const token = state.engineConfig.token;
        const simId = state.currentSimulation.id;
        const parentNumeric = Number(state.selectedNodeId);

        if (!Number.isFinite(parentNumeric)) {
          console.error('[advanceSimulation] Invalid node ID:', state.selectedNodeId, 'Type:', typeof state.selectedNodeId);
          state.addNotification?.('error', i18n.t('store.selectedNodeNotBackend') || 'Selected node is not a backend node');
          set({ isGenerating: false });
          return;
        }

        const res = await treeAdvanceChain(base, simId, parentNumeric, 1, token);

        const graph = await getTreeGraph(base, simId, token);
        if (graph) {
          const nodesMapped = mapGraphToNodes(graph);
          const newSelectedId = String(res.child);
          set({ nodes: nodesMapped, selectedNodeId: newSelectedId });
        }

        const [events, simState] = await Promise.all([
          getSimEvents(base, simId, res.child, token),
          getSimState(base, simId, res.child, token)
        ]);

        const currentSimulation = withSimulationSocialNetwork(
          simState ? { ...state.currentSimulation, scene_config: simState.scene_config } : state.currentSimulation,
          simState?.scene_config?.social_network,
        );
        if (Object.keys(currentSimulation.socialNetwork || {}).length > 0) {
          set((storeState) => ({
            currentSimulation: { ...storeState.currentSimulation!, ...currentSimulation }
          }));
        }

        const turnVal = Number(simState?.turns ?? 0) || 0;
        const agentsMapped = mapBackendAgents(simState?.agents || [], turnVal, state.agents || []);
        const eventsArray = Array.isArray(events) ? events : [];

        set((storeState) => {
          const newEvents = filterUniqueBackendEvents(storeState.rawEvents || [], eventsArray);

          const newSelectedId = String(res.child);
          const selectedNode = (storeState.nodes || []).find((node) => node.id === newSelectedId);
          const round = selectedNode?.depth ?? 0;

          const logsMapped = mapBackendEventsToLogs(
            newEvents,
            newSelectedId,
            round,
            agentsMapped,
            false
          );

          return {
            logs: [...(storeState.logs || []), ...logsMapped],
            rawEvents: [...(storeState.rawEvents || []), ...newEvents],
            agents: agentsMapped,
            isGenerating: false
          };
        });
        return;
      }

      // Standalone mode - local time advancement
      const existingChildren = (state.nodes || []).filter((node) => node.parentId === parentNode.id);
      const nextIndex = existingChildren.length + 1;
      const newNodeId = `n-${Date.now()}`;
      const newDepth = parentNode.depth + 1;

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

      const updatedAgents = (state.agents || []).map((agent) => {
        const newHistory = { ...agent.history };
        Object.keys(newHistory).forEach((key) => {
          const prevValues = newHistory[key] || [50];
          newHistory[key] = [...prevValues, Math.max(0, Math.min(100, prevValues[prevValues.length - 1] + (Math.floor(Math.random() * 10) - 5)))];
        });
        return { ...agent, history: newHistory };
      });

      set((storeState) => ({
        nodes: [...(storeState.nodes || []).map((node) => node.id === parentNode.id ? { ...node, isLeaf: false } : node), newNode],
        selectedNodeId: newNodeId,
        logs: [...(storeState.logs || []), ...newLogs],
        agents: updatedAgents,
        isGenerating: false
      }));
    } catch (e) {
      console.error('advanceSimulation failed', e);
      set({ isGenerating: false });
      state.addNotification?.('error', i18n.t('store.simulationAdvanceFailed') || 'Simulation advance failed');
    }
  },

  branchSimulation: async (config) => {
    const state = get();
    if (!state.currentSimulation || !state.selectedNodeId) return;

    const branchName = config?.name?.trim() || i18n.t('store.branch') || 'Branch';
    const branchType = config?.branchType || 'parallel';
    const isZh = (i18n.language || 'en').toLowerCase().startsWith('zh');
    const branchTypeLabel = (
      branchType === 'compare'
        ? (isZh ? '策略对照' : 'Strategy comparison')
        : branchType === 'perturbation'
          ? (isZh ? '参数扰动' : 'Parameter perturbation')
          : branchType === 'custom'
            ? (isZh ? '自定义' : 'Custom')
            : (isZh ? '平行推演' : 'Parallel run')
    );
    const branchNotes = config?.notes?.trim() || '';
    const branchText = [
      branchName,
      `${isZh ? '分支类型' : 'Branch type'}: ${branchTypeLabel}`,
      config?.inheritCurrentState === false
        ? `${isZh ? '状态继承' : 'State inheritance'}: ${isZh ? '关闭' : 'Off'}`
        : `${isZh ? '状态继承' : 'State inheritance'}: ${isZh ? '继承当前状态' : 'Inherit current state'}`,
      branchNotes ? `${isZh ? '备注' : 'Notes'}: ${branchNotes}` : ''
    ]
      .filter(Boolean)
      .join('\n');

    try {
      if (state.engineConfig?.mode === 'connected') {
        const base = state.engineConfig.endpoint;
        const token = state.engineConfig.token;
        const parentNumeric = Number(state.selectedNodeId);

        if (!Number.isFinite(parentNumeric)) {
          console.error('[branchSimulation] Invalid node ID:', state.selectedNodeId, 'Type:', typeof state.selectedNodeId);
          state.addNotification?.('error', i18n.t('store.selectedNodeNotBackend') || 'Selected node is not a backend node');
          return;
        }

        // treeBranchPublic expects: (base, id, parent, text, token)
        const result = await treeBranchPublic(base, state.currentSimulation.id, parentNumeric, branchText, token);

        if (result?.child !== undefined) {
          // Refresh tree
          const graph = await getTreeGraph(base, state.currentSimulation.id, token);
          if (graph) {
            const nodesMapped = mapGraphToNodes(graph);
            set({ nodes: nodesMapped, selectedNodeId: String(result.child) });
          }
          state.addNotification?.('success', `${i18n.t('store.branchCreated') || 'Branch created'}: ${branchName}`);
        }
      } else {
        // Standalone mode - create a child branch from the currently selected node.
        const baseNode = state.nodes?.find((n) => n.id === state.selectedNodeId);
        if (!baseNode) return;

        const existingChildren = (state.nodes || []).filter((n) => n.parentId === baseNode.id);
        const nextIndex = existingChildren.length + 1;

        const newNode = {
          id: `branch-${Date.now()}`,
          display_id: `${baseNode.display_id}.${nextIndex}`,
          parentId: baseNode.id,
          name: branchName,
          depth: baseNode.depth + 1,
          isLeaf: true,
          status: 'pending' as const,
          timestamp: new Date().toLocaleTimeString(),
          worldTime: baseNode.worldTime
        };

        // Add a log entry for the branch
        const newLogs: any[] = [
          {
            id: `sys-${Date.now()}`,
            nodeId: newNode.id,
            round: newNode.depth,
            type: 'SYSTEM',
            content: `${i18n.t('store.createdBranch') || 'Created branch'}: ${branchName} (${branchTypeLabel})`,
            timestamp: newNode.timestamp
          }
        ];

        set((s) => ({
          nodes: [
            ...(s.nodes || []).map((node) => (
              node.id === baseNode.id
                ? { ...node, isLeaf: false }
                : node
            )),
            newNode
          ],
          selectedNodeId: newNode.id,
          logs: [...(s.logs || []), ...newLogs]
        }));
        state.addNotification?.('success', `${i18n.t('store.branchCreatedLocalMode') || 'Branch created (local mode)'}: ${branchName}`);
      }
    } catch (e) {
      console.error('branchSimulation failed', e);
      state.addNotification?.('error', i18n.t('store.backendBranchFailed') || 'Branch creation failed');
    }
  },

  deleteNode: async () => {
    const state = get();
    if (!state.currentSimulation || !state.selectedNodeId || state.selectedNodeId === 'root') {
      state.addNotification?.('error', i18n.t('store.cannotDeleteRoot') || 'Cannot delete root node');
      return;
    }

    try {
      if (state.engineConfig?.mode === 'connected') {
        await treeDeleteSubtree(
          state.engineConfig.endpoint,
          state.currentSimulation.id,
          Number(state.selectedNodeId),
          state.engineConfig.token
        );

        // Refresh tree
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
          nodes.filter((n) => n.parentId === nodeId).forEach((child) => collectDescendants(child.id));
        };
        collectDescendants(state.selectedNodeId);
        set((s) => ({
          nodes: (s.nodes || []).filter((n) => !nodeIdsToDelete.has(n.id)),
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
    const state = get();
    if (!state.currentSimulation) return;

    const baseNode = state.nodes?.find((n) => n.id === baseNodeId);
    if (!baseNode) return;

    const parentNumeric = Number(baseNode.id);
    if (!Number.isFinite(parentNumeric)) {
      state.addNotification?.('error', i18n.t('store.selectedNodeNotBackend') || 'Selected node is not a backend node');
      return;
    }
    const parentOfVariants = baseNode.parentId == null ? null : String(baseNode.parentId);
    const existingSiblingIds = (state.nodes || [])
      .filter((n) => {
        if (parentOfVariants === null) return n.parentId === null;
        return String(n.parentId) === parentOfVariants;
      })
      .map((n) => String(n.id));

    // connected mode -> call backend create + run; standalone -> keep existing mock behavior
    if (state.engineConfig?.mode === 'connected') {
      (async () => {
        try {
          const simId = state.currentSimulation!.id;
          const token = state.engineConfig.token;

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
          set((s) => ({ nodes: (s.nodes || []).map((n) => (n.id === baseNodeId ? { ...n, isLeaf: false } : n)) }));

          const variantLogs = buildExperimentVariantLogs(
            experimentName,
            String(parentNumeric),
            variants,
          );

          // Step 2: run experiment
          const runRes = await experimentsApi.runExperiment(simId, expIdStr, 1);
          const runId = runRes?.run_id || (runRes as any)?.run_id;
          state.addNotification?.('success', i18n.t('store.experimentSubmitted', { name: experimentName, runId }) || `Experiment "${experimentName}" submitted (run ID: ${runId})`);

          const applyChildrenWithLogs = async (mapped: any[], childrenIds: VariantChildRef[]) => {
            const parentLogsSnapshot = get().logs || [];
            // 复制的是“被选中的基准节点”的现有日志（即 baseNode），而不是它的父节点
            const parentLogsForCopy = parentLogsSnapshot.filter((l: any) => String(l.nodeId) === String(baseNode.id));
            set((s) => {
              const firstChildId = childrenIds[0]?.node_id ? String(childrenIds[0].node_id) : s.selectedNodeId;
              return {
                nodes: addVariantMetaToNodes(mapped, childrenIds, expIdStr),
                selectedNodeId: firstChildId,
                logs: copyLogsToChildren(s.logs || [], parentLogsForCopy, variantLogs, childrenIds),
              };
            });

            // Fetch backend events/state for each child and append mapped logs so child view is not empty
            const agents = get().agents || [];
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
                  set((s) => ({
                    logs: dedupeLogsByNodeAndContent([...(s.logs || []), ...logsFromEvents.filter((l: any) => l && l.id)])
                  }));
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
            set((s) => ({ logs: dedupeLogsByNodeAndContent(s.logs || []) }));
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
              const parentLogsSnapshot = get().logs || [];
              const parentLogsForCopy = parentLogsSnapshot.filter((l: any) => String(l.nodeId) === String(baseNode.id));

              set((s) => {
                const resolvedChildren = children
                  .slice(0, variants.length)
                  .map((child: any) => ({ node_id: child.id }));

                return {
                  nodes: addVariantMetaToNodes(mapped, resolvedChildren, expIdStr),
                  selectedNodeId: String(children[0].id),
                  logs: copyLogsToChildren(s.logs || [], parentLogsForCopy, variantLogs, resolvedChildren),
                };
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
                  const agents = get().agents || [];
                  const logsFromEvents = mapBackendEventsToLogs(events || [], String(child.id), roundVal, agents, true);
                  if (logsFromEvents && logsFromEvents.length) {
                    set((s) => ({ logs: dedupeLogsByNodeAndContent([...(s.logs || []), ...logsFromEvents.filter((l: any) => l && l.id)]) }));
                  }
                } catch (e) {
                  // ignore
                }
              }));
              return true;
            }

            // Update nodes anyway to reflect latest graph
            set({ nodes: mapped });
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
    const state = get();
    if (!state.currentSimulation || !state.logs) return;

    set({ isGeneratingReport: true });

    try {
      const report = await generateSimulationReport({
        logs: state.logs || [],
        agents: state.agents || [],
        analysisConfig: state.analysisConfig,
        sceneConfig: (state.currentSimulation?.scene_config ?? {}) as Record<string, any>,
        providerId: state.currentProviderId,
      });

      set((s) => ({
        currentSimulation: s.currentSimulation ? { ...s.currentSimulation, report } : s.currentSimulation,
        isGeneratingReport: false
      }));
      state.addNotification?.('success', i18n.t('store.reportGenerationComplete') || 'Report generation complete');
    } catch (e) {
      console.error('generateReport failed', e);
      set({ isGeneratingReport: false });
      state.addNotification?.('error', i18n.t('store.reportGenerationFailed') || 'Report generation failed, please try again later');
    }
  },

  exportReport: (format) => {
    const state = get();
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
    const blob = new Blob([buildSimulationReportMarkdown(report)], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${state.currentSimulation?.name || 'simulation'}_report.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
});
