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
import type { ExperimentVariant, SimulationReport, SocialNetwork } from '../types';
import * as experimentsApi from '../services/experiments';
import type { EnvironmentSuggestion } from '../services/environmentSuggestions';
import { addTime } from './helpers';

export interface ExperimentsSlice {
  // Comparison state
  compareTargetNodeId: string | null;
  isCompareMode: boolean;
  comparisonSummary: string | null;
  comparisonUseLLM: boolean;

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
    if (!state.currentSimulation || !state.selectedNodeId) return;

    try {
      set({ isGenerating: true } as any);

      if (state.engineConfig?.mode === 'connected') {
        const { treeAdvanceChain } = await import('../services/simulationTree');
        const result = await treeAdvanceChain(
          state.engineConfig.endpoint,
          state.currentSimulation.id,
          Number(state.selectedNodeId),
          1,
          state.engineConfig.token
        );

        if (result?.node_id) {
          const selectNode = (get() as any).selectNode;
          selectNode?.(String(result.node_id));
          // Reload events
          const { getSimEvents } = await import('../services/simulationTree');
          const { mapBackendEventsToLogs } = await import('./helpers');
          const nodes = state.nodes || [];
          const selectedNode = nodes.find((n: any) => n.id === state.selectedNodeId);

          const events = await getSimEvents(
            state.engineConfig.endpoint,
            state.currentSimulation.id,
            Number(state.selectedNodeId),
            state.engineConfig.token
          );

          const round = selectedNode?.depth ?? 0;
          const agents = state.agents || [];
          const newLogs = mapBackendEventsToLogs(events, String(state.selectedNodeId), round, agents);

          set((s: any) => ({
            logs: [...(s.logs || []), ...newLogs],
            rawEvents: [...(s.rawEvents || []), ...events]
          }));
        }
      } else {
        // Standalone mode - generate mock events
        const mockLogs: any[] = [
          {
            id: `evt-${Date.now()}`,
            nodeId: state.selectedNodeId,
            round: (state.nodes?.find((n: any) => n.id === state.selectedNodeId)?.depth ?? 0) + 1,
            type: 'SYSTEM',
            content: `Simulation advanced (standalone mode)`,
            timestamp: new Date().toISOString()
          }
        ];
        set((s: any) => ({
          logs: [...(s.logs || []), ...mockLogs],
          rawEvents: [...(s.rawEvents || []), ...mockLogs]
        }));
      }

      set({ isGenerating: false } as any);
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
        const { treeBranchPublic } = await import('../services/simulationTree');
        const result = await treeBranchPublic(
          state.engineConfig.endpoint,
          state.currentSimulation.id,
          Number(state.selectedNodeId),
          state.engineConfig.token
        );

        if (result?.node_id) {
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
          state.addNotification?.('success', '分支已创建');
        }
      } else {
        // Standalone mode - create mock branch
        const baseNode = state.nodes?.find((n: any) => n.id === state.selectedNodeId);
        if (baseNode) {
          const newNode = {
            id: `branch-${Date.now()}`,
            display_id: `${baseNode.display_id}.1`,
            parentId: baseNode.id,
            name: 'Branch',
            depth: baseNode.depth + 1,
            isLeaf: true,
            status: 'pending' as const,
            timestamp: new Date().toISOString(),
            worldTime: new Date().toISOString()
          };
          set((s: any) => ({
            nodes: [...(s.nodes || []), newNode],
            selectedNodeId: newNode.id
          }));
        }
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

    const simId = state.currentSimulation.id;
    const baseNode = state.nodes?.find((n: any) => n.id === baseNodeId);
    if (!baseNode) return;

    // connected mode: use backend experiment API
    if (state.engineConfig?.mode === 'connected') {
      (async () => {
        try {
          set({ isGenerating: true } as any);
          const expResult = await experimentsApi.createExperiment(simId, {
            name: experimentName,
            base_node_id: Number(baseNodeId),
            variants: variants.map((v, i) => ({
              id: `var-${Date.now()}-${i}`,
              name: v.name,
              description: v.description,
              interventions: v.interventions || []
            }))
          });

          const expId = expResult?.experiment?.id;
          const runId = expResult?.run?.id;

          if (expId && runId) {
            // Start polling for experiment completion
            (async () => {
              try {
                let finished = false;
                const token = state.engineConfig?.token;
                for (let attempts = 0; attempts < 120 && !finished; attempts++) {
                  await new Promise((r) => setTimeout(r, 2000));
                  try {
                    const expDetail = await experimentsApi.getExperiment(simId, String(expId));
                    const runs = expDetail?.experiment?.runs || expDetail?.runs || [];
                    const found = runs.find((r: any) => String(r.id) === String(runId) || String(r.id) === String(Number(runId)));
                    if (found) {
                      const status = String(found.status || '').toLowerCase();
                      if (status === 'finished' || status === 'error' || status === 'cancelled') {
                        finished = true;
                        // Refresh tree
                        const { getTreeGraph } = await import('../services/simulationTree');
                        const { mapGraphToNodes } = await import('./helpers');
                        const graph = await getTreeGraph(
                          state.engineConfig?.endpoint || '',
                          simId,
                          token
                        );
                        if (graph) {
                          set({ nodes: mapGraphToNodes(graph) });
                        }
                        state.addNotification?.('success', `实验 ${experimentName} 已完成`);
                        break;
                      }
                    }
                  } catch (e) {
                    // ignore poll errors
                  }
                }
              } catch (e) {
                console.error('Experiment polling error', e);
              }
            })();
          }

          set({ isGenerating: false } as any);
          state.addNotification?.('success', '实验已启动');
        } catch (e) {
          console.error(e);
          set({ isGenerating: false } as any);
          state.addNotification?.('error', '启动实验失败');
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
