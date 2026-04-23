/**
 * Main simulation workspace page.
 *
 * Orchestrates the tab-based layout (Sim Tree, Logs, Agents) with a peek overlay
 * for cross-panel awareness. Loads simulation state from backend.
 *
 * Exports: SimulationPage (default), SimulationPage (named)
 */

import React from "react";
import { SimTree } from "../components/SimTree";
import { Sidebar } from "../components/Sidebar";
import { LogViewer } from "../components/LogViewer";
import { ComparisonView } from "../components/ComparisonView";
import { ExperimentBuilderModal } from "../components/ExperimentBuilderModal";
import SyncModal from "../components/SyncModal";
import { HelpModal } from "../components/HelpModal";
import { AnalyticsPanel } from "../components/AnalyticsPanel";
import { ExportModal } from "../components/ExportModal";
import { ExperimentDesignModal } from "../components/ExperimentDesignModal";
import { TimeSettingsModal } from "../components/TimeSettingsModal";
import { TemplateSaveModal } from "../components/TemplateSaveModal";
import { NetworkEditorModal } from "../components/NetworkEditorModal";
import { ReportModal } from "../components/ReportModal";
import { GlobalKnowledgePanel } from "../components/GlobalKnowledgePanel";
import { GuideAssistant } from "../components/GuideAssistant";
import { ToastContainer } from "../components/Toast";
import { useSimulationStore } from "../store";
import { useParams } from "react-router-dom";
import { getSimulation as apiGetSimulation } from "../services/simulations";
import { getTreeGraph, getSimEvents, getSimState, getRehydrate } from "../services/simulationTree";
import { useAuthStore } from "../store/auth";
import { useTranslation } from "react-i18next";
import { TabBar } from "../components/TabBar";
import ContextToolbar from "../components/ContextToolbar";
import { PeekOverlay } from "../components/PeekOverlay";

// ---------------- SimulationPage ----------------

const SimulationPage: React.FC = () => {
  const { t } = useTranslation();
  const isCompareMode = useSimulationStore((state) => state.isCompareMode);
  const params = useParams();
  const simIdParam = params['id'] || params['simulationId'] || null;
  const engineConfig = useSimulationStore((state) => state.engineConfig);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasRestored = useAuthStore((s) => s.hasRestored);

  React.useEffect(() => {
    (async () => {
      if (!simIdParam) return;

      // Wait until auth restoration has completed
      if (!hasRestored || !isAuthenticated) return;

      await useSimulationStore.getState().loadSimulationById(String(simIdParam));
      return;
      try {
          const token = (engineConfig as any).token as string | undefined;
          let sim: any | null = null;
          try {
            sim = await apiGetSimulation(String(simIdParam));
            // Map scene_config.social_network to socialNetwork for frontend
            if (sim?.scene_config?.social_network) {
              sim.socialNetwork = sim.scene_config.social_network;
            }
          } catch (err) {
            console.warn('apiGetSimulation failed, will attempt rehydrate fallback', err);
            // try rehydrate directly using simIdParam (may succeed even if primary endpoint requires auth)
            try {
              const re = await getRehydrate(engineConfig.endpoint, String(simIdParam), token).catch(() => null);
              if (re && typeof re === 'object') {
                // construct nodes & agents from rehydrate response and set state
                const nodesRaw2 = (re.nodes || []) as any[];
                const nodes2 = nodesRaw2.map((n: any) => ({
                  id: String(n.id),
                  display_id: String(n.id),
                  parentId: n.parent == null ? null : String(n.parent),
                  name: t('simPage.nodeId', { id: n.id }),
                  depth: n.depth,
                  isLeaf: (n.depth || 0) === (Math.max(...(nodesRaw2.map((x: any) => x.depth || 0))) || 0),
                  status: 'completed',
                  timestamp: new Date().toLocaleTimeString(),
                  worldTime: new Date().toISOString(),
                  meta: n.meta || {}
                }));

                let agents2: any[] = [];
                try {
                  const firstNode = nodesRaw2.find((n: any) => Number(n.id) === Number(nodes2[0]?.id));
                  const simSnap2 = firstNode?.sim || {};
                  const latestAgents2 = simSnap2?.agents || re.agents || [];
                  if (Array.isArray(latestAgents2)) {
                    agents2 = latestAgents2.map((a: any, idx: number) => ({
                      id: `a-${idx}-${a.name}`,
                      name: a.name,
                      role: a.role || (a.properties || {}).role || '',
                      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(a.name || String(idx))}`,
                      profile: '',
                      llmConfig: { provider: 'mock', model: 'default' },
                      properties: a.properties || {},
                      history: {},
                      memory: (a.short_memory || []).map((m: any, j: number) => ({ id: `m-${idx}-${j}`, round: Number(simSnap2?.turns || 0), content: String(m.content ?? ''), type: 'dialogue', timestamp: new Date().toISOString() })),
                      knowledgeBase: a.knowledgeBase || []
                    }));
                  } else if (latestAgents2 && typeof latestAgents2 === 'object') {
                    agents2 = Object.keys(latestAgents2).map((k: string, idx: number) => {
                      const a = (latestAgents2 as any)[k] || {};
                      return {
                        id: `a-${idx}-${a.name || k}`,
                        name: a.name || k,
                        role: a.role || (a.properties || {}).role || '',
                        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(a.name || k)}`,
                        profile: '',
                        llmConfig: { provider: 'mock', model: 'default' },
                        properties: a.properties || {},
                        history: {},
                        memory: (a.short_memory || []).map((m: any, j: number) => ({ id: `m-${idx}-${j}`, round: Number(simSnap2?.turns || 0), content: String(m.content ?? ''), type: 'dialogue', timestamp: new Date().toISOString() })),
                        knowledgeBase: a.knowledgeBase || []
                      };
                    });
                  }
                } catch (e) {
                  console.warn('rehydrate parsing failed', e);
                }

                if (agents2 && agents2.length > 0) {
                  useSimulationStore.setState({
                    currentSimulation: { id: String(simIdParam) } as any,
                    nodes: nodes2,
                    selectedNodeId: nodes2[0]?.id ?? null,
                    agents: agents2,
                    rawEvents: []
                  } as any);
                  return;
                }
              }
            } catch (e) {
              console.warn('rehydrate fallback failed', e);
            }
            return; // give up after attempting rehydrate
          }
          if (!sim) return;

          // Prefer live graph/state/events whenever the backend is reachable
          try {
            const base = engineConfig.endpoint;
            const liveToken = (engineConfig as any).token;
            const graph = await getTreeGraph(base, sim.id, liveToken).catch(() => null);
            const rootId = graph?.root ?? null;
            const simState = rootId != null
              ? await getSimState(base, sim.id, rootId, liveToken).catch(() => null)
              : null;
            const events = rootId != null
              ? await getSimEvents(base, sim.id, rootId, liveToken).catch(() => [])
              : [];

            if (graph && simState) {
              const mapGraphToNodes = (graph: any) => {
                const parentMap = new Map<number, number | null>();
                const childrenSet = new Set<number>();
                for (const edge of (graph.edges || [])) {
                  parentMap.set(edge.to, edge.from);
                  childrenSet.add(edge.from);
                }
                const nowIso = new Date().toISOString();
                return (graph.nodes || []).map((n: any) => {
                  const pid = parentMap.has(n.id) ? parentMap.get(n.id)! : null;
                  const isLeaf = !childrenSet.has(n.id);
                  const running = new Set(graph.running || []);
                  const meta = (n as any).meta || null;
                  return {
                    id: String(n.id),
                    display_id: String(n.id),
                    parentId: pid == null ? null : String(pid),
                    name: t('simPage.nodeId', { id: n.id }),
                    depth: n.depth,
                    isLeaf,
                    status: running.has(n.id) ? 'running' : 'completed',
                    timestamp: new Date().toLocaleTimeString(),
                    worldTime: nowIso,
                    meta
                  };
                });
              };

              const nodes = mapGraphToNodes(graph);

              const agents = (simState.agents || []).map((a: any, idx: number) => ({
                id: `a-${idx}-${a.name}`,
                name: a.name,
                role: a.role || '',
                avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(a.name || String(idx))}`,
                profile: '',
                llmConfig: { provider: 'mock', model: 'default' },
                properties: {},
                history: {},
                memory: (a.short_memory || []).map((m: any, j: number) => ({ id: `m-${idx}-${j}`, round: Number(simState.turns || 0), content: String(m.content ?? ''), type: 'dialogue', timestamp: new Date().toISOString() })),
                knowledgeBase: a.knowledgeBase || []
              }));

              // Map scene_config.social_network to socialNetwork for frontend
              const socialNetwork = (sim as any).scene_config?.social_network || {};

              useSimulationStore.setState({
                currentSimulation: { ...sim, socialNetwork },
                nodes,
                selectedNodeId: rootId != null ? String(rootId) : nodes[0]?.id ?? null,
                agents: agents,
                rawEvents: events || []
              } as any);
              return;
            }
          } catch (e) {
            // fall through to latest_state fallback
            console.warn('Failed to fetch live graph/state/events, falling back to latest_state', e);
          }

          // Fallback 1: try server-side rehydrate snapshot (graph + sim)
          try {
            const re = await getRehydrate(engineConfig.endpoint, sim.id, token).catch(() => null);
            if (re && typeof re === 'object') {
              const nodesRaw2 = (re.nodes || []) as any[];
              const nodes2 = nodesRaw2.map((n: any) => ({
                id: String(n.id),
                display_id: String(n.id),
                parentId: n.parent == null ? null : String(n.parent),
                name: t('simPage.nodeId', { id: n.id }),
                depth: n.depth,
                isLeaf: (n.depth || 0) === (Math.max(...(nodesRaw2.map((x: any) => x.depth || 0))) || 0),
                status: 'completed',
                timestamp: new Date().toLocaleTimeString(),
                worldTime: new Date().toISOString(),
                meta: n.meta || {}
              }));

              let agents2: any[] = [];
              try {
                const firstNode = nodesRaw2.find((n: any) => Number(n.id) === Number(nodes2[0]?.id));
                const simSnap2 = firstNode?.sim || {};
                const latestAgents2 = simSnap2?.agents || re.agents || [];
                if (Array.isArray(latestAgents2)) {
                  agents2 = latestAgents2.map((a: any, idx: number) => ({
                    id: `a-${idx}-${a.name}`,
                    name: a.name,
                    role: a.role || (a.properties || {}).role || '',
                    avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(a.name || String(idx))}`,
                    profile: '',
                    llmConfig: { provider: 'mock', model: 'default' },
                    properties: a.properties || {},
                    history: {},
                    memory: (a.short_memory || []).map((m: any, j: number) => ({ id: `m-${idx}-${j}`, round: Number(simSnap2?.turns || 0), content: String(m.content ?? ''), type: 'dialogue', timestamp: new Date().toISOString() })),
                    knowledgeBase: a.knowledgeBase || []
                  }));
                } else if (latestAgents2 && typeof latestAgents2 === 'object') {
                  agents2 = Object.keys(latestAgents2).map((k: string, idx: number) => {
                    const a = (latestAgents2 as any)[k] || {};
                    return {
                      id: `a-${idx}-${a.name || k}`,
                      name: a.name || k,
                      role: a.role || (a.properties || {}).role || '',
                      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(a.name || k)}`,
                      profile: '',
                      llmConfig: { provider: 'mock', model: 'default' },
                      properties: a.properties || {},
                      history: {},
                      memory: (a.short_memory || []).map((m: any, j: number) => ({ id: `m-${idx}-${j}`, round: Number(simSnap2?.turns || 0), content: String(m.content ?? ''), type: 'dialogue', timestamp: new Date().toISOString() })),
                      knowledgeBase: a.knowledgeBase || []
                    };
                  });
                }
              } catch (e) {
                console.warn('rehydrate parsing failed', e);
              }

              if (nodes2.length > 0) {
                useSimulationStore.setState({
                  currentSimulation: sim,
                  nodes: nodes2,
                  selectedNodeId: nodes2[0]?.id ?? null,
                  agents: agents2,
                  rawEvents: []
                } as any);
                return;
              }
            }
          } catch (e) {
            console.warn('rehydrate fallback failed', e);
          }

          // Fallback: if backend not connected or live fetch failed, try to use persisted latest_state
          try {
            const latest = (sim as any).latest_state;
            if (latest && typeof latest === 'object') {
              const nodesRaw = (latest.nodes || []) as any[];
              const nodes = nodesRaw.map((n: any) => ({
                id: String(n.id),
                display_id: String(n.id),
                parentId: n.parent == null ? null : String(n.parent),
                name: t('simPage.nodeId', { id: n.id }),
                depth: n.depth,
                isLeaf: (n.depth || 0) === (Math.max(...(nodesRaw.map((x: any) => x.depth || 0))) || 0),
                status: 'completed',
                timestamp: new Date().toLocaleTimeString(),
                worldTime: new Date().toISOString(),
                meta: n.meta || {}
              }));

              // extract agents from the node sim snapshot if present
              let agents: any[] = [];
              if (Array.isArray(nodesRaw)) {
                const matched = nodesRaw.find((n: any) => Number(n.id) === Number(nodes[0]?.id));
                const simSnap = matched?.sim || {};
                const latestAgents = simSnap?.agents || latest.agents || [];
                if (latestAgents && typeof latestAgents === 'object') {
                  if (Array.isArray(latestAgents)) {
                    agents = latestAgents.map((a: any, idx: number) => ({
                      id: `a-${idx}-${a.name}`,
                      name: a.name,
                      role: a.role || (a.properties || {}).role || '',
                      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(a.name || String(idx))}`,
                      profile: '',
                      llmConfig: { provider: 'mock', model: 'default' },
                      properties: a.properties || {},
                      history: {},
                      memory: (a.short_memory || []).map((m: any, j: number) => ({ id: `m-${idx}-${j}`, round: Number(simSnap?.turns || 0), content: String(m.content ?? ''), type: 'dialogue', timestamp: new Date().toISOString() })),
                      knowledgeBase: a.knowledgeBase || []
                    }));
                  } else {
                    // dict mapping
                    agents = Object.keys(latestAgents).map((k: string, idx: number) => {
                      const a = (latestAgents as any)[k] || {};
                      return {
                        id: `a-${idx}-${a.name || k}`,
                        name: a.name || k,
                        role: a.role || (a.properties || {}).role || '',
                        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(a.name || k)}`,
                        profile: '',
                        llmConfig: { provider: 'mock', model: 'default' },
                        properties: a.properties || {},
                        history: {},
                        memory: (a.short_memory || []).map((m: any, j: number) => ({ id: `m-${idx}-${j}`, round: Number(simSnap?.turns || 0), content: String(m.content ?? ''), type: 'dialogue', timestamp: new Date().toISOString() })),
                        knowledgeBase: a.knowledgeBase || []
                      };
                    });
                  }
                }
              }

              // If we have zero agents from persisted latest_state, try server-side rehydrate
              if (!agents || agents.length === 0) {
                try {
                  const re = await getRehydrate(engineConfig.endpoint, sim.id, token).catch(() => null);
                  if (re && typeof re === 'object') {
                    const nodesRaw2 = (re.nodes || []) as any[];
                    const nodes2 = nodesRaw2.map((n: any) => ({
                      id: String(n.id),
                      display_id: String(n.id),
                      parentId: n.parent == null ? null : String(n.parent),
                      name: t('simPage.nodeId', { id: n.id }),
                      depth: n.depth,
                      isLeaf: (n.depth || 0) === (Math.max(...(nodesRaw2.map((x: any) => x.depth || 0))) || 0),
                      status: 'completed',
                      timestamp: new Date().toLocaleTimeString(),
                      worldTime: new Date().toISOString(),
                      meta: n.meta || {}
                    }));

                    let agents2: any[] = [];
                    try {
                      const firstNode = nodesRaw2.find((n: any) => Number(n.id) === Number(nodes2[0]?.id));
                      const simSnap2 = firstNode?.sim || {};
                      const latestAgents2 = simSnap2?.agents || re.agents || [];
                      if (Array.isArray(latestAgents2)) {
                        agents2 = latestAgents2.map((a: any, idx: number) => ({
                          id: `a-${idx}-${a.name}`,
                          name: a.name,
                          role: a.role || (a.properties || {}).role || '',
                          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(a.name || String(idx))}`,
                          profile: '',
                          llmConfig: { provider: 'mock', model: 'default' },
                          properties: a.properties || {},
                          history: {},
                          memory: (a.short_memory || []).map((m: any, j: number) => ({ id: `m-${idx}-${j}`, round: Number(simSnap2?.turns || 0), content: String(m.content ?? ''), type: 'dialogue', timestamp: new Date().toISOString() })),
                          knowledgeBase: a.knowledgeBase || []
                        }));
                      } else if (latestAgents2 && typeof latestAgents2 === 'object') {
                        agents2 = Object.keys(latestAgents2).map((k: string, idx: number) => {
                          const a = (latestAgents2 as any)[k] || {};
                          return {
                            id: `a-${idx}-${a.name || k}`,
                            name: a.name || k,
                            role: a.role || (a.properties || {}).role || '',
                            avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(a.name || k)}`,
                            profile: '',
                            llmConfig: { provider: 'mock', model: 'default' },
                            properties: a.properties || {},
                            history: {},
                            memory: (a.short_memory || []).map((m: any, j: number) => ({ id: `m-${idx}-${j}`, round: Number(simSnap2?.turns || 0), content: String(m.content ?? ''), type: 'dialogue', timestamp: new Date().toISOString() })),
                            knowledgeBase: a.knowledgeBase || []
                          };
                        });
                      }
                    } catch (e) {
                      console.warn('rehydrate parsing failed', e);
                    }

                    if (agents2 && agents2.length > 0) {
                      useSimulationStore.setState({
                        currentSimulation: sim,
                        nodes: nodes2,
                        selectedNodeId: nodes2[0]?.id ?? null,
                        agents: agents2,
                        rawEvents: []
                      } as any);
                      return;
                    }
                  }
                } catch (e) {
                  console.warn('rehydrate request failed', e);
                }
              }

              useSimulationStore.setState({
                currentSimulation: sim,
                nodes,
                selectedNodeId: nodes[0]?.id ?? null,
                agents: agents,
                rawEvents: []
              } as any);

              // Attempt to restore events/logs for the selected node when backend is reachable
              const base = engineConfig.endpoint;
              const selectedNodeNumeric = nodes[0]?.id ? Number(nodes[0].id) : null;
              if (selectedNodeNumeric != null && Number.isFinite(selectedNodeNumeric)) {
                try {
                  const events = await getSimEvents(base, sim.id, selectedNodeNumeric, token).catch(() => []);
                  useSimulationStore.setState({ rawEvents: events || [] } as any);
                } catch (e) {
                  console.warn('latest_state events fetch failed', e);
                }
              }

              return;
            }
          } catch (e) {
            console.warn('latest_state fallback failed', e);
          }

          // final fallback: just set simulation
          useSimulationStore.setState({ currentSimulation: sim } as any);
      } catch (e) {
        console.warn('Failed to load simulation on mount', e);
      }
    })();
  }, [simIdParam, hasRestored, isAuthenticated]);

  // Load providers when authenticated
  React.useEffect(() => {
    if (hasRestored && isAuthenticated) {
      useSimulationStore.getState().loadProviders();
    }
  }, [hasRestored, isAuthenticated]);

  // Auto-open experiment builder when creating a new simulation
  React.useEffect(() => {
    if (!simIdParam && hasRestored && isAuthenticated) {
      const { isWizardOpen, toggleWizard } = useSimulationStore.getState();
      if (!isWizardOpen) {
        toggleWizard(true);
      }
    }
  }, [simIdParam, hasRestored, isAuthenticated]);

  const activeTab = useSimulationStore((s) => s.activeTab);

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--ss-workspace-bg)' }}>
      <TabBar />
      <ContextToolbar />

      <div className="flex-1 overflow-hidden relative p-3">
        {activeTab === 'timeline' && (
          <div className="flex gap-3 h-full">
            <div className="w-[40%] flex flex-col">
              <SimTree layoutDirection="vertical" />
            </div>
            <div className="flex-1 flex flex-col">
              {isCompareMode ? <ComparisonView /> : <LogViewer />}
            </div>
          </div>
        )}
        {activeTab === 'agents' && <Sidebar />}

        <PeekOverlay />
      </div>

      {/* Modals */}
      <ExperimentBuilderModal />
      <HelpModal />
      <AnalyticsPanel />
      <ExportModal />
      <ExperimentDesignModal />
      <TimeSettingsModal />
      <TemplateSaveModal />
      <NetworkEditorModal />
      <ReportModal />
      <GlobalKnowledgePanel />
      <GuideAssistant />
      <SyncModal />
      <ToastContainer />
    </div>
  );
};

export default SimulationPage;
export { SimulationPage };