import React from "react";
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
import { InitialEventsModal } from "../components/InitialEventsModal";
import { GuideAssistant } from "../components/GuideAssistant";
import { ToastContainer } from "../components/Toast";
import { generateNodes, mapGraphToNodes, useSimulationStore } from "../store";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { createSimulationSnapshot, getSimulation as apiGetSimulation } from "../services/simulations";
import { getTreeGraph, getSimEvents, getSimState, getRehydrate } from "../services/simulationTree";
import { buildSerializedSnapshot, mapBackendAgents, withSimulationSocialNetwork } from "../services/simulationSnapshots";
import { useAuthStore } from "../store/auth";
import { useTranslation } from "react-i18next";
import { BranchComposerDialog } from "../components/workspace/BranchComposerDialog";
import { readBranchContext } from "../utils/branchContext";
import { TopControlBar } from "../components/workspace/TopControlBar";
import { SimTree } from "../components/SimTree";
import { NodeDetailPanel, type NodeDetailTab } from "../components/workspace/NodeDetailPanel";
import { SimulationSummaryRail } from "../components/workspace/SimulationSummaryRail";
import { TopologyStructureModal } from "../components/workspace/TopologyStructureModal";
import { SnapshotModal } from "../components/SnapshotModal";
import { AdvancedTreeOpsModal } from "../components/AdvancedTreeOpsModal";
import { AgentPanel } from "../components/AgentPanel";
import { HostPanel } from "../components/HostPanel";

// ---------------- 页面主组件：SimulationPage ----------------

const SimulationPage: React.FC = () => {
  const isCompareMode = useSimulationStore((state) => state.isCompareMode);
  const currentSimulation = useSimulationStore((state) => state.currentSimulation);
  const nodes = useSimulationStore((state) => state.nodes);
  const selectedNodeId = useSimulationStore((state) => state.selectedNodeId);
  const compareTargetNodeId = useSimulationStore((state) => state.compareTargetNodeId);
  const isGenerating = useSimulationStore((state) => state.isGenerating);
  const selectNode = useSimulationStore((state) => state.selectNode);
  const setCompareTarget = useSimulationStore((state) => state.setCompareTarget);
  const toggleCompareMode = useSimulationStore((state) => state.toggleCompareMode);
  const advanceSimulation = useSimulationStore((state) => state.advanceSimulation);
  const resetSimulation = useSimulationStore((state) => state.resetSimulation);
  const deleteSimulation = useSimulationStore((state) => state.deleteSimulation);
  const toggleExport = useSimulationStore((state) => state.toggleExport);
  const toggleReportModal = useSimulationStore((state) => state.toggleReportModal);
  const toggleExperimentDesigner = useSimulationStore((state) => state.toggleExperimentDesigner);
  const toggleNetworkEditor = useSimulationStore((state) => state.toggleNetworkEditor);
  const setGlobalKnowledgeOpen = useSimulationStore((state) => state.setGlobalKnowledgeOpen);
  const toggleInitialEvents = useSimulationStore((state) => state.toggleInitialEvents);
  const openSnapshotModal = useSimulationStore((state) => state.openSnapshotModal);
  const openTreeOpsModal = useSimulationStore((state) => state.openTreeOpsModal);
  const addNotification = useSimulationStore((state) => state.addNotification);
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const simIdParam = params['id'] || params['simulationId'] || null;
  const isWorkspaceEntryRoute = location.pathname.startsWith('/simulations/workspace');
  const isNewExperimentRoute = location.pathname.startsWith('/simulations/new');
  const engineConfig = useSimulationStore((state) => state.engineConfig);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasRestored = useAuthStore((s) => s.hasRestored);
  const { t } = useTranslation();
  const [hasSubmittedSetup, setHasSubmittedSetup] = React.useState(false);
  const [selectedAgentId, setSelectedAgentId] = React.useState<string | null>(null);
  const [isSummaryRailVisible, setIsSummaryRailVisible] = React.useState(false);
  const [isBranchComposerOpen, setIsBranchComposerOpen] = React.useState(false);
  const [isTopologyModalOpen, setIsTopologyModalOpen] = React.useState(false);
  const [detailTab, setDetailTab] = React.useState<NodeDetailTab>("events");
  const [workspaceMode, setWorkspaceMode] = React.useState<"timeline" | "agents" | "host">("timeline");
  const flowSectionRef = React.useRef<HTMLDivElement | null>(null);
  const detailSectionRef = React.useRef<HTMLDivElement | null>(null);

  const selectedNode = React.useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || nodes[0] || null,
    [nodes, selectedNodeId],
  );
  const getNodeName = React.useCallback(
    (nodeId: number | string) => t('simPage.nodeId', { id: nodeId }),
    [t],
  );

  React.useEffect(() => {
    if (!isNewExperimentRoute) return;

    useSimulationStore.setState({
      currentSimulation: null,
      nodes: generateNodes(),
      selectedNodeId: 'root',
      agents: [],
      logs: [],
      rawEvents: []
    } as any);
    setHasSubmittedSetup(false);
    setSelectedAgentId(null);
  }, [isNewExperimentRoute]);

  React.useEffect(() => {
    if (!isNewExperimentRoute) return;
    if (!hasSubmittedSetup) return;
    if (!currentSimulation?.id) return;

    navigate(`/simulations/${currentSimulation.id}`, { replace: true });
  }, [currentSimulation?.id, hasSubmittedSetup, isNewExperimentRoute, navigate]);

  React.useEffect(() => {
    (async () => {
      if (!simIdParam) return;
      // read engineConfig from hook above so effect re-runs when mode changes
      // If we're in connected mode, wait until auth restoration has completed
      if (engineConfig.mode === 'connected' && !hasRestored) {
        return;
      }
      // If connected mode requires an authenticated user, don't attempt load when not authenticated
      if (engineConfig.mode === 'connected' && !isAuthenticated) {
        return;
      }
      try {
          const token = (engineConfig as any).token as string | undefined;
          let sim: any | null = null;
          try {
            sim = withSimulationSocialNetwork(await apiGetSimulation(String(simIdParam)));
          } catch (err) {
            console.warn('apiGetSimulation failed, will attempt rehydrate fallback', err);
            // try rehydrate directly using simIdParam (may succeed even if primary endpoint requires auth)
            try {
              const re = await getRehydrate(engineConfig.endpoint, String(simIdParam), token).catch(() => null);
              if (re && typeof re === 'object') {
                const snapshot = buildSerializedSnapshot(re, getNodeName);
                if (snapshot.agents.length > 0) {
                  useSimulationStore.setState({
                    currentSimulation: { id: String(simIdParam) } as any,
                    nodes: snapshot.nodes,
                    selectedNodeId: snapshot.selectedNodeId,
                    agents: snapshot.agents,
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
              const nodes = mapGraphToNodes(graph);
              const agents = mapBackendAgents(simState.agents || [], Number(simState.turns || 0) || 0);
              const socialNetwork = simState?.scene_config?.social_network || sim.socialNetwork || {};

              useSimulationStore.setState({
                currentSimulation: withSimulationSocialNetwork(sim, socialNetwork),
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
              const snapshot = buildSerializedSnapshot(re, getNodeName);
              if (snapshot.nodes.length > 0) {
                useSimulationStore.setState({
                  currentSimulation: sim,
                  nodes: snapshot.nodes,
                  selectedNodeId: snapshot.selectedNodeId,
                  agents: snapshot.agents,
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
              const snapshot = buildSerializedSnapshot(latest, getNodeName);

              // If we have zero agents from persisted latest_state, try server-side rehydrate
              if (!snapshot.agents.length) {
                try {
                  const re = await getRehydrate(engineConfig.endpoint, sim.id, token).catch(() => null);
                  if (re && typeof re === 'object') {
                    const rehydratedSnapshot = buildSerializedSnapshot(re, getNodeName);
                    if (rehydratedSnapshot.agents.length > 0) {
                      useSimulationStore.setState({
                        currentSimulation: sim,
                        nodes: rehydratedSnapshot.nodes,
                        selectedNodeId: rehydratedSnapshot.selectedNodeId,
                        agents: rehydratedSnapshot.agents,
                        rawEvents: []
                      } as any);
                      return;
                    }
                  }
                } catch (e) {
                  console.warn('rehydrate request failed', e);
                }
              }

              const socialNetwork = latest.social_network || sim.socialNetwork || {};
              useSimulationStore.setState({
                currentSimulation: withSimulationSocialNetwork(sim, socialNetwork),
                nodes: snapshot.nodes,
                selectedNodeId: snapshot.selectedNodeId,
                agents: snapshot.agents,
                rawEvents: []
              } as any);

              // Attempt to restore events/logs for the selected node when backend is reachable
              const base = engineConfig.endpoint;
              const selectedNodeNumeric = snapshot.selectedNodeId ? Number(snapshot.selectedNodeId) : null;
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
  }, [simIdParam, engineConfig.mode, hasRestored, isAuthenticated]);

  // Load providers for any authenticated workspace session so users can
  // choose a provider before enabling the connected / LLM-backed engine.
  React.useEffect(() => {
    if (!hasRestored || !isAuthenticated) return;
    void useSimulationStore.getState().loadProviders();
  }, [hasRestored, isAuthenticated]);

  React.useEffect(() => {
    if (!simIdParam) return;
    if (!hasRestored || !isAuthenticated) return;
    if (engineConfig.mode === "connected") return;
    useSimulationStore.getState().setEngineMode("connected");
  }, [simIdParam, hasRestored, isAuthenticated, engineConfig.mode]);

  React.useEffect(() => {
    if (!isCompareMode) return;
    setSelectedAgentId(null);
    setWorkspaceMode("timeline");
  }, [isCompareMode]);

  const scrollToSection = React.useCallback((ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  React.useEffect(() => {
    if (isNewExperimentRoute) return;
    if (!nodes.length) return;

    const currentParams = new URLSearchParams(location.search);
    const { nodeId, compareId } = readBranchContext(currentParams);
    const hasNode = nodeId && nodes.some((node) => node.id === nodeId);
    const hasCompare = compareId && nodes.some((node) => node.id === compareId) && compareId !== nodeId;

    if (hasNode && nodeId !== selectedNodeId) {
      selectNode(nodeId);
    }

    if (hasCompare && compareId !== compareTargetNodeId) {
      setCompareTarget(compareId);
    }

    if (!hasCompare && compareTargetNodeId) {
      setCompareTarget(null);
    }

    if (isCompareMode !== Boolean(hasCompare)) {
      toggleCompareMode(Boolean(hasCompare));
    }
  }, [
    isNewExperimentRoute,
    location.search,
    nodes,
    selectNode,
    setCompareTarget,
    toggleCompareMode,
  ]);

  React.useEffect(() => {
    if (isNewExperimentRoute) return;
    if (!simIdParam) return;
    if (!currentSimulation || String(currentSimulation.id) !== String(simIdParam)) return;
    if (!selectedNodeId) return;

    const currentParams = new URLSearchParams(window.location.search);
    const { nodeId, compareId } = readBranchContext(currentParams);
    const nextCompare = isCompareMode && compareTargetNodeId ? compareTargetNodeId : null;

    if (nodeId === selectedNodeId && compareId === nextCompare) {
      return;
    }

    const nextParams = new URLSearchParams(currentParams);
    nextParams.set("node", selectedNodeId);
    if (nextCompare) {
      nextParams.set("compare", nextCompare);
    } else {
      nextParams.delete("compare");
    }

    const nextQuery = nextParams.toString();
    const nextUrl = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [
    currentSimulation,
    isCompareMode,
    isNewExperimentRoute,
    selectedNodeId,
    simIdParam,
    compareTargetNodeId,
  ]);

  const showSetupStudio = isNewExperimentRoute;
  const showLoadingState = Boolean(simIdParam) && !currentSimulation;
  const showEmptyWorkspaceState = isWorkspaceEntryRoute && !currentSimulation;

  if (showSetupStudio) {
    return (
      <>
        <ExperimentBuilderModal
          isOpen
          presentation="page"
          onComplete={() => setHasSubmittedSetup(true)}
          onClose={() => navigate("/dashboard")}
        />
        <ToastContainer />
      </>
    );
  }

  if (showEmptyWorkspaceState) {
    return (
      <div className="ss-workspace ss-workspace--empty">
        <TopControlBar
          isGenerating={false}
          isCompareMode={false}
          workspaceMode={workspaceMode}
          onContinue={() => undefined}
          onCreateBranch={() => undefined}
          onShowTimeline={() => setWorkspaceMode("timeline")}
          onShowAgents={() => setWorkspaceMode("agents")}
          onShowHostIntervention={() => setWorkspaceMode("host")}
          onToggleCompare={() => undefined}
          onOpenSimulationIntervention={() => undefined}
          onOpenSnapshots={() => undefined}
          onSaveSimulation={() => undefined}
          onOpenReport={() => undefined}
          onOpenNetwork={() => undefined}
          onOpenKnowledge={() => undefined}
          onOpenMultimodal={() => undefined}
          onOpenExport={() => undefined}
          onResetSimulation={() => undefined}
          onDeleteSimulation={() => undefined}
          onOpenTreeOps={() => undefined}
        />

        <div className="ss-workspace__main ss-workspace__main--empty">
          <div className="ss-workspace-empty-modal ss-surface-strong">
            <div className="ss-kicker">
              {t("nav.workspace", { defaultValue: "实验台" })}
            </div>
            <h2 className="ss-workspace-empty-modal__title">
              {t("simulationWorkspace.noActiveExperimentTitle", {
                defaultValue: "当前没有正在进行的实验",
              })}
            </h2>
            <p className="ss-workspace-empty-modal__copy">
              {t("simulationWorkspace.noActiveExperimentBody", {
                defaultValue: "请创建新实验或继续已保存的实验。",
              })}
            </p>
            <div className="ss-workspace-empty-modal__actions">
              <button
                type="button"
                className="ss-button"
                onClick={() => navigate('/simulations/new')}
              >
                {t("nav.new", { defaultValue: "新建实验" })}
              </button>
              <button
                type="button"
                className="ss-button-secondary"
                onClick={() => navigate('/simulations/saved')}
              >
                {t("nav.saved", { defaultValue: "已保存" })}
              </button>
            </div>
          </div>
        </div>

        <ToastContainer />
      </div>
    );
  }

  const workspacePanel = workspaceMode === "timeline"
    ? (
      <NodeDetailPanel
        activeTab={detailTab}
        onChangeTab={(tab) => {
          setDetailTab(tab);
        }}
        selectedAgentId={selectedAgentId}
        onClearSelectedAgent={() => setSelectedAgentId(null)}
      />
    )
    : workspaceMode === "agents"
      ? (
        <section className="ss-workspace__panel ss-workspace__panel--observation ss-observation">
          <AgentPanel />
        </section>
      )
      : (
        <section className="ss-workspace__panel ss-workspace__panel--observation ss-observation">
          <div className="ss-workspace__panel-header">
            <div className="ss-kicker">{t("controlRoom.hostIntervention")}</div>
            <h2 className="ss-workspace__panel-title mt-2">
              {t("controlRoom.hostInterventionDesk", { defaultValue: "主持干预控制台" })}
            </h2>
            <p className="ss-workspace__panel-copy">
              {t("controlRoom.hostInterventionCopy", {
                defaultValue: "通过环境建议、系统广播和属性编辑直接干预当前仿真节点。",
              })}
            </p>
          </div>
          <div className="ss-observation__host-wrap">
            <HostPanel />
          </div>
        </section>
      );

  return (
    <div className="ss-workspace">
      <TopControlBar
        isGenerating={isGenerating}
        isCompareMode={isCompareMode}
        workspaceMode={workspaceMode}
        onContinue={() => void advanceSimulation()}
        onCreateBranch={() => setIsBranchComposerOpen(true)}
        onShowTimeline={() => {
          setWorkspaceMode("timeline");
          setDetailTab("events");
          scrollToSection(detailSectionRef);
        }}
        onShowAgents={() => {
          setWorkspaceMode("agents");
          scrollToSection(detailSectionRef);
        }}
        onShowHostIntervention={() => {
          setWorkspaceMode("host");
          scrollToSection(detailSectionRef);
        }}
        onToggleCompare={() => {
          setWorkspaceMode("timeline");
          if (isCompareMode) {
            setCompareTarget(null);
            toggleCompareMode(false);
            return;
          }
          toggleCompareMode(true);
        }}
        onOpenSimulationIntervention={() => toggleExperimentDesigner(true)}
        onOpenSnapshots={() => openSnapshotModal()}
        onSaveSimulation={() => {
          if (!currentSimulation?.id) return;
          void createSimulationSnapshot(
            currentSimulation.id,
            `${currentSimulation.name || t("simulationWorkspace.titleFallback")} · ${new Date().toLocaleString()}`,
          )
            .then(() => {
              addNotification?.(
                "success",
                t("simulationWorkspace.snapshotSaved", {
                  defaultValue: "当前模拟已保存为新快照",
                }),
              );
            })
            .catch(() => {
              addNotification?.(
                "error",
                t("simulationWorkspace.snapshotSaveFailed", {
                  defaultValue: "保存模拟失败",
                }),
              );
            });
        }}
        onOpenReport={() => toggleReportModal(true)}
        onOpenNetwork={() => toggleNetworkEditor(true)}
        onOpenKnowledge={() => setGlobalKnowledgeOpen(true)}
        onOpenMultimodal={() => toggleInitialEvents(true)}
        onOpenExport={() => toggleExport(true)}
        onOpenTreeOps={() => openTreeOpsModal()}
        onResetSimulation={() => {
          const ok = window.confirm(t("simPage.confirmReset"));
          if (!ok) return;
          void resetSimulation();
        }}
        onDeleteSimulation={() => {
          const ok = window.confirm(t("simPage.confirmDelete"));
          if (!ok) return;

          void deleteSimulation().then(() => {
            navigate("/simulations/saved", { replace: true });
          });
        }}
      />

      <div className="ss-workspace__main">
        {showLoadingState ? (
          <div className="ss-workspace__panel ss-workspace__panel--stage flex h-full items-center justify-center px-6">
            <div className="max-w-lg text-center">
              <div className="ss-kicker">{t("simulationWorkspace.deskLabel")}</div>
              <h2 className="mt-3 font-[var(--font-display)] text-3xl font-semibold tracking-[-0.05em] text-[var(--ss-workspace-heading)]">
                {t("simulationWorkspace.loadingTitle")}
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ss-workspace-muted)]">
                {t("simulationWorkspace.loadingBody")}
              </p>
            </div>
          </div>
        ) : (
          <div
            className={`ss-cockpit-grid is-left-rail-hidden${isSummaryRailVisible ? "" : " is-summary-rail-hidden"}`}
          >
            <div className="ss-cockpit-grid__main">
              <div className="ss-cockpit-grid__split">
                <div ref={flowSectionRef} className="ss-cockpit-grid__section">
                  <div className="ss-cockpit-grid__tree-stage">
                    <SimTree alwaysSelectOnClick layoutDirection="vertical" />
                  </div>
                </div>

                <div ref={detailSectionRef} className="ss-cockpit-grid__section">
                  {workspacePanel}
                </div>
              </div>
            </div>

            <div className={`ss-cockpit-grid__right${isSummaryRailVisible ? "" : " is-hidden"}`}>
              {isSummaryRailVisible ? (
                <SimulationSummaryRail
                  onOpenLogs={() => {
                    setDetailTab("logs");
                    scrollToSection(detailSectionRef);
                  }}
                  onHide={() => setIsSummaryRailVisible(false)}
                />
              ) : null}
            </div>
          </div>
        )}
      </div>

      <BranchComposerDialog
        isOpen={isBranchComposerOpen}
        onClose={() => setIsBranchComposerOpen(false)}
      />

      <TopologyStructureModal
        isOpen={isTopologyModalOpen}
        onClose={() => setIsTopologyModalOpen(false)}
        onOpenNodeDetails={() => {
          setIsTopologyModalOpen(false);
          setDetailTab("branches");
          window.setTimeout(() => {
            scrollToSection(detailSectionRef);
          }, 40);
        }}
      />

      <SnapshotModal />
      <AdvancedTreeOpsModal />

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
      <InitialEventsModal />
      <GuideAssistant />
      <SyncModal />
      <ToastContainer />
    </div>
  );
};

export default SimulationPage;
export { SimulationPage };
