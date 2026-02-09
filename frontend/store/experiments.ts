// frontend/store/experiments.ts
//
// Experiments, comparison, and reports slice.
//
// Responsibilities:
//   - Experiment execution (runExperiment with WebSocket/polling)
//   - Node comparison
//   - Report generation and export
//   - Tree branching and deletion
//
// Used by: SimulationPage, ExperimentDesignModal, ReportModal, ComparisonView

import { StateCreator } from 'zustand';
import type { ExperimentVariant, SimulationReport, SocialNetwork, SimNode } from '../types';
import * as experimentsApi from '../services/experiments';
import type { EnvironmentSuggestion } from '../services/environmentSuggestions';
import { addTime } from './helpers';

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
          state.addNotification?.('error', '选中的节点不是后端节点');
          set({ isGenerating: false } as any);
          return;
        }

        const useLLM = Boolean(state.comparisonUseLLM);
        const res = await experimentsApi.compareNodes(simId, nodeA, nodeB, useLLM);
        const summary = res?.summary || (res?.message || '') || '未能生成摘要';
        set({ comparisonSummary: summary, isGenerating: false } as any);
      } catch (e) {
        console.error(e);
        set({ isGenerating: false } as any);
        state.addNotification?.('error', '比较分析失败');
      }
      return;
    }

    // standalone/demo fallback: generate a lightweight mock summary
    set({ isGenerating: true } as any);
    setTimeout(() => {
      set({
        comparisonSummary: '本地演示：两条时间线在若干事件与若干智能体属性上存在差异（仅演示）。',
        isGenerating: false
      } as any);
    }, 700);
  },

  advanceSimulation: async () => {
    const state = get() as any;
    if (!state.currentSimulation || !state.selectedNodeId || state.isGenerating) return;

    const parentNode = state.nodes?.find((n: any) => n.id === state.selectedNodeId);
    if (!parentNode) return;

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
          state.addNotification?.('error', '选中节点不是后端节点');
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

          // For system_broadcast events, use text and sender as unique key
          if (evType === 'system_broadcast') {
            const text = data.text || data.message || '';
            const sender = data.sender || '';
            const eventType = data.type || '';
            return `${evType}:${eventType}:${sender}:${text}`;
          }

          // Use type, agent, content, time, and action to generate unique key
          const agent = data.agent || '';
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
          content: `时间推进至: ${formatWorldTime(nextWorldTime)} (Round ${newDepth})` + '（离线模式，未执行真实动作）',
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
      state.addNotification?.('error', '推进模拟失败');
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
          state.addNotification?.('error', '选中节点不是后端节点');
          return;
        }

        // treeBranchPublic expects: (base, id, parent, text, token)
        const result = await treeBranchPublic(base, state.currentSimulation.id, parentNumeric, '分支', token);

        if (result?.child !== undefined) {
          // Refresh tree
          const graph = await getTreeGraph(base, state.currentSimulation.id, token);
          if (graph) {
            const nodesMapped = mapGraphToNodes(graph);
            set({ nodes: nodesMapped } as any);
          }
          state.addNotification?.('success', '分支已创建');
        }
      } else {
        // Standalone mode - create mock branch
        // A branch creates a SIBLING node (same parent, same depth) for what-if scenarios
        const baseNode = state.nodes?.find((n: any) => n.id === state.selectedNodeId);
        if (!baseNode || !baseNode.parentId) {
          // Can't branch from root (no parent)
          state.addNotification?.('error', '无法从根节点创建分支');
          return;
        }

        // Find the parent to create a sibling relationship
        const parentNode = state.nodes?.find((n: any) => n.id === baseNode.parentId);
        if (!parentNode) {
          state.addNotification?.('error', '无法找到父节点');
          return;
        }

        // Count existing siblings to determine display_id
        const existingSiblings = (state.nodes || []).filter((n: any) => n.parentId === parentNode.id);
        const nextIndex = existingSiblings.length + 1;

        const newNode = {
          id: `branch-${Date.now()}`,
          display_id: `${parentNode.display_id}.${nextIndex}`,
          parentId: parentNode.id,  // Same parent as baseNode (sibling relationship)
          name: '分支: 平行推演',
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
            content: `创建分支: ${newNode.display_id} (平行推演场景)`,
            timestamp: newNode.timestamp
          }
        ];

        set((s: any) => ({
          nodes: [...(s.nodes || []), newNode],
          selectedNodeId: newNode.id,
          logs: [...(s.logs || []), ...newLogs]
        }));
        state.addNotification?.('success', '分支已创建（本地模式）');
      }
    } catch (e) {
      console.error('branchSimulation failed', e);
      state.addNotification?.('error', '创建分支失败');
    }
  },

  deleteNode: async () => {
    const state = get() as any;
    if (!state.currentSimulation || !state.selectedNodeId || state.selectedNodeId === 'root') {
      state.addNotification?.('error', '无法删除根节点');
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
      state.addNotification?.('success', '节点已删除');
    } catch (e) {
      console.error('deleteNode failed', e);
      state.addNotification?.('error', '删除节点失败');
    }
  },

  runExperiment: (baseNodeId, experimentName, variants) => {
    const state = get() as any;
    if (!state.currentSimulation) return;

    const baseNode = state.nodes?.find((n: any) => n.id === baseNodeId);
    if (!baseNode) return;

    // connected mode -> call backend create + run; standalone -> keep existing mock behavior
    if (state.engineConfig?.mode === 'connected') {
      (async () => {
        try {
          const simId = state.currentSimulation!.id;
          const token = (state.engineConfig as any).token as string | undefined;

          // prepare variant specs for backend (ops expected by backend)
          const variantSpecs = variants.map((v) => ({ name: v.name, ops: v.ops || [] }));

          const createRes = await experimentsApi.createExperiment(
            simId,
            experimentName,
            Number(baseNode.display_id || 0),
            variantSpecs
          );
          const expId = createRes.experiment_id || (createRes as any).experiment_id;

          // locally add placeholder nodes so UI shows pending variants
          set((s: any) => {
            const tc = s.currentSimulation?.timeConfig || { baseTime: new Date().toISOString(), unit: 'hour' as const, step: 1 };
            const nextWorldTime = addTime(baseNode.worldTime, tc.step, tc.unit);
            const updatedNodes = s.nodes.map((n: any) => (n.id === baseNodeId ? { ...n, isLeaf: false } : n));
            const newNodes: any[] = variantSpecs.map((vs, idx) => ({
              id: `exp-${Date.now()}-${idx}`,
              display_id: `${baseNode.display_id}.${idx + 1}`,
              parentId: baseNode.id,
              name: `${experimentName}: ${vs.name}`,
              depth: baseNode.depth + 1,
              isLeaf: true,
              status: 'pending',
              timestamp: new Date().toLocaleTimeString(),
              worldTime: nextWorldTime,
              meta: { placeholder_exp_id: String(expId), variant_index: idx },
            }));
            return { nodes: [...updatedNodes, ...newNodes], selectedNodeId: newNodes[0]?.id ?? null } as any;
          });

          // start the run (background) and poll for completion
          const runRes = await experimentsApi.runExperiment(simId, String(expId), 1);
          const runId = runRes?.run_id || (runRes as any)?.run_id;
          state.addNotification?.('success', `实验 ${experimentName} 已提交 (run ID: ${runId})`);

          // If backend returned immediate node mapping, apply it
          const mapping = (runRes && (runRes as any).node_mapping) || null;
          if (mapping && mapping.length) {
            set((s: any) => {
              const updated = s.nodes.map((n: any) => ({ ...n }));
              let newSelected: string | null = s.selectedNodeId;
              for (let mi = 0; mi < mapping.length; mi++) {
                const m = mapping[mi];
                if (!m || !m.node_id) continue;
                let idx = updated.findIndex((nn: any) => String((nn.meta || {}).placeholder_exp_id) === String(expId) && (nn.meta || {}).variant_index === mi);
                if (idx < 0) {
                  const expectedName = `${experimentName}: ${variants[mi]?.name || ''}`;
                  idx = updated.findIndex((nn: any) => nn.name === expectedName && nn.parentId === baseNodeId);
                }
                if (idx < 0) {
                  let count = 0;
                  for (let j = 0; j < updated.length; j++) {
                    const nn = updated[j];
                    if (nn.parentId === baseNodeId && nn.id?.toString().startsWith('exp-')) {
                      if (count === mi) {
                        idx = j;
                        break;
                      }
                      count++;
                    }
                  }
                }
                if (idx >= 0) {
                  const oldId = updated[idx].id;
                  updated[idx].id = String(m.node_id);
                  updated[idx].display_id = String(m.node_id);
                  updated[idx].meta = { experiment_id: expId, variant_id: m.variant_id };
                  updated[idx].status = 'pending';
                  if (s.selectedNodeId === oldId) {
                    newSelected = String(m.node_id);
                  }
                }
              }
              return { nodes: updated, selectedNodeId: newSelected } as any;
            });
          } else {
            // Try immediate graph refresh
            try {
              const { getTreeGraph } = await import('../services/simulationTree');
              const { mapGraphToNodes } = await import('./helpers');
              const graph = await getTreeGraph(state.engineConfig.endpoint, simId, token);
              if (graph) {
                const nodesFromGraph = mapGraphToNodes(graph);
                set((s: any) => {
                  const updated = s.nodes.map((n: any) => ({ ...n }));
                  let newSelected: string | null = s.selectedNodeId;
                  for (let mi = 0; mi < variants.length; mi++) {
                    const expectedName = `${experimentName}: ${variants[mi]?.name || ''}`;
                    const candidate = nodesFromGraph.find((gn: any) => gn.parentId === baseNode.id && gn.name === expectedName && String(gn.id) !== String(baseNode.id));
                    if (candidate && candidate.id) {
                      const pIdx = updated.findIndex((nn: any) => String((nn.meta || {}).placeholder_exp_id) === String(expId) && (nn.meta || {}).variant_index === mi);
                      if (pIdx >= 0) {
                        const oldId = updated[pIdx].id;
                        updated[pIdx].id = String(candidate.id);
                        updated[pIdx].display_id = String(candidate.id);
                        updated[pIdx].meta = { experiment_id: expId, variant_id: variants[mi]?.id };
                        updated[pIdx].status = 'pending';
                        if (s.selectedNodeId === oldId) newSelected = String(candidate.id);
                      }
                    }
                  }
                  return { nodes: updated, selectedNodeId: newSelected } as any;
                });
              }
            } catch (e) {
              console.warn('Immediate graph refresh failed', e);
            }
            // Poll for completion if not mapped
            const pollInterval = 2000;
            const maxAttempts = 30;
            (async () => {
              for (let attempt = 0; attempt < maxAttempts; attempt++) {
                try {
                  await new Promise(r => setTimeout(r, pollInterval));
                  const expDetail = await experimentsApi.getExperiment(simId, String(expId));
                  const variantsResp = expDetail?.experiment?.variants || [];
                  if (variantsResp.length) {
                    const hasNode = variantsResp.some((v: any) => v && v.node_id);
                    if (hasNode) {
                      set((s: any) => {
                        const updated = s.nodes.map((n: any) => ({ ...n }));
                        let newSelected: string | null = s.selectedNodeId;
                        for (let vi = 0; vi < variantsResp.length; vi++) {
                          const v = variantsResp[vi];
                          if (!v || !v.node_id) continue;
                          let idx = updated.findIndex((nn: any) => String((nn.meta || {}).placeholder_exp_id) === String(expId) && (nn.meta || {}).variant_index === vi);
                          if (idx < 0) {
                            const expectedName = `${experimentName}: ${v.name}`;
                            idx = updated.findIndex((nn: any) => nn.name === expectedName && nn.parentId === baseNodeId);
                          }
                          if (idx < 0) {
                            let count = 0;
                            for (let j = 0; j < updated.length; j++) {
                              const nn = updated[j];
                              if (nn.parentId === baseNodeId && nn.id?.toString().startsWith('exp-')) {
                                if (count === vi) {
                                  idx = j;
                                  break;
                                }
                                count++;
                              }
                            }
                          }
                          if (idx >= 0) {
                            const oldId = updated[idx].id;
                            updated[idx].id = String(v.node_id);
                            updated[idx].display_id = String(v.node_id);
                            updated[idx].meta = { experiment_id: expId, variant_id: v.id };
                            updated[idx].status = 'pending';
                            if (s.selectedNodeId === oldId) {
                              newSelected = String(v.node_id);
                            }
                          }
                        }
                        return { nodes: updated, selectedNodeId: newSelected } as any;
                      });
                      break;
                    }
                  }
                } catch (e) {
                  // ignore polling errors
                }
              }
            })();
          }
        } catch (e) {
          console.error('Experiment error', e);
          state.addNotification?.('error', '启动实验失败: ' + (e as any).message);
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
    state.addNotification?.('success', `批量实验 "${experimentName}" 已启动（本地模式）`);
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
      state.addNotification?.('success', '报告生成完成');
    } catch (e) {
      console.error('generateReport failed', e);
      set({ isGeneratingReport: false } as any);
      state.addNotification?.('error', '报告生成失败，请稍后重试');
    }
  },

  exportReport: (format) => {
    const state = get() as any;
    const report = state.currentSimulation?.report;
    if (!report) {
      state.addNotification?.('error', '暂无报告可导出');
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
    lines.push(`# 仿真实验分析报告`);
    lines.push(`生成时间: ${new Date(report.generatedAt).toLocaleString()}`);
    lines.push(`\n## 摘要\n${report.summary}`);
    lines.push(`\n## 关键转折`);
    report.keyEvents.forEach((ev) => {
      lines.push(`- R${ev.round}: ${ev.description}`);
    });
    lines.push(`\n## 建议`);
    report.suggestions.forEach((sug) => lines.push(`- ${sug}`));
    lines.push(`\n## 智能体分析`);
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
