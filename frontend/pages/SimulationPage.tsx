// frontend/pages/SimulationPage.tsx
// frontend/pages/SimulationPage.tsx
import React from "react";
import { Link } from "react-router-dom";
import { SimTree } from "../components/SimTree";
import { Sidebar } from "../components/Sidebar";
import { LogViewer } from "../components/LogViewer";
import { ComparisonView } from "../components/ComparisonView";
import { SimulationWizard } from "../components/SimulationWizard";
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
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useTranslation } from "react-i18next";
import {
  Play,
  SkipForward,
  Plus,
  Settings,
  GitFork,
  BarChart2,
  Download,
  Loader2,
  Split,
  Beaker,
  Clock,
  Save,
  Network,
  FileText,
  Plug,
  Zap,
  LogOut,
  Globe,
} from "lucide-react";

// ---------------- Header ----------------

const Header: React.FC = () => {
  const currentSim = useSimulationStore((state) => state.currentSimulation);
  const toggleWizard = useSimulationStore((state) => state.toggleWizard);
  const engineConfig = useSimulationStore((state) => state.engineConfig);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasRestored = useAuthStore((s) => s.hasRestored);
  const loadProviders = useSimulationStore((state) => state.loadProviders);
  const setEngineMode = useSimulationStore((state) => state.setEngineMode);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.clearSession);
  const { t } = useTranslation();

  const toggleEngine = () => {
    setEngineMode(
      engineConfig.mode === "standalone" ? "connected" : "standalone"
    );
  };

  return (
    <header className="h-14 bg-white border-b flex items-center justify-between px-4 shrink-0 z-20">
      <div className="flex items-center gap-4">
        <Link to="/dashboard" className="flex items-center gap-2 text-brand-600 font-bold text-lg tracking-tight hover:opacity-80">
          <div className="w-8 h-8 bg-brand-600 text-white rounded-lg flex items-center justify-center">
            S4
          </div>
          <span>
            SocialSim
            <span className="text-slate-400 font-light">Next</span>
          </span>
        </Link>
        
        {/* 导航链接 */}
        <nav className="flex items-center gap-1 ml-4">
          <Link to="/dashboard" className="px-3 py-1.5 text-sm text-slate-600 hover:text-brand-600 hover:bg-slate-100 rounded">
            {t('nav.dashboard')}
          </Link>
          <Link to="/simulations/saved" className="px-3 py-1.5 text-sm text-slate-600 hover:text-brand-600 hover:bg-slate-100 rounded">
            {t('nav.saved')}
          </Link>
          <Link to="/settings" className="px-3 py-1.5 text-sm text-slate-600 hover:text-brand-600 hover:bg-slate-100 rounded">
            {t('nav.settings')}
          </Link>
        </nav>
        
        <div className="h-6 w-px bg-slate-200 mx-2"></div>
        <div>
          <h1 className="text-sm font-bold text-slate-800">
            {currentSim?.name || t('simPage.noSimulation')}
          </h1>
          <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
            {currentSim?.id}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Integration Mode Switcher */}
        <button
          onClick={toggleEngine}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-full transition-all border ${
            engineConfig.mode === "connected"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
          }`}
          title={
            engineConfig.mode === "connected"
              ? t('simPage.connectedTo', { endpoint: engineConfig.endpoint })
              : t('simPage.runningBrowserStandalone')
          }
        >
          {engineConfig.mode === "connected" ? (
            <Zap size={14} className="fill-emerald-500 text-emerald-500" />
          ) : (
            <Plug size={14} />
          )}
          {engineConfig.mode === "connected"
            ? t('simPage.socialSim4Engine')
            : t('simPage.standaloneMode')}
        </button>

        <div className="h-4 w-px bg-slate-200 mx-2"></div>

        <button
          onClick={() => toggleWizard(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
        >
          <Plus size={14} /> {t('simPage.newSimulation')}
        </button>
        <Link to="/settings" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md">
          <Settings size={18} />
        </Link>
        
        <div className="h-4 w-px bg-slate-200 mx-2"></div>
        <LanguageSwitcher />
        <div className="h-4 w-px bg-slate-200 mx-2"></div>
        
        {/* 用户信息 */}
        <span className="text-sm text-slate-600">{user?.email}</span>
        <button
          onClick={logout}
          className="flex items-center gap-1 px-2 py-1.5 text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          title={t('nav.signout')}
        >
          <LogOut size={14} />
        </button>
      </div>
    </header>
  );
};

// ---------------- Toolbar ----------------

const Toolbar: React.FC = () => {
  const { t } = useTranslation();
  const toggleAnalytics = useSimulationStore((state) => state.toggleAnalytics);
  const toggleExport = useSimulationStore((state) => state.toggleExport);
  const toggleExperimentDesigner = useSimulationStore(
    (state) => state.toggleExperimentDesigner
  );
  const toggleTimeSettings = useSimulationStore(
    (state) => state.toggleTimeSettings
  );
  const toggleSaveTemplate = useSimulationStore(
    (state) => state.toggleSaveTemplate
  );
  const toggleNetworkEditor = useSimulationStore(
    (state) => state.toggleNetworkEditor
  );
  const toggleReportModal = useSimulationStore(
    (state) => state.toggleReportModal
  );
  const setGlobalKnowledgeOpen = useSimulationStore(
    (state) => state.setGlobalKnowledgeOpen
  );

  const llmProviders = useSimulationStore((s) => s.llmProviders);
  const selectedProviderId = useSimulationStore((s) => s.selectedProviderId);
  const currentProviderId = useSimulationStore((s) => s.currentProviderId);
  const setSelectedProvider = useSimulationStore((s) => s.setSelectedProvider);

  const advanceSimulation = useSimulationStore(
    (state) => state.advanceSimulation
  );
  const branchSimulation = useSimulationStore((state) => state.branchSimulation);
  const isGenerating = useSimulationStore((state) => state.isGenerating);

  const isCompareMode = useSimulationStore((state) => state.isCompareMode);
  const toggleCompareMode = useSimulationStore(
    (state) => state.toggleCompareMode
  );
  const setCompareTarget = useSimulationStore(
    (state) => state.setCompareTarget
  );

  const currentSim = useSimulationStore((state) => state.currentSimulation);
  const providerSelection = selectedProviderId ?? currentProviderId ?? null;

  const handleToggleCompare = () => {
    if (isCompareMode) {
      toggleCompareMode(false);
      setCompareTarget(null);
    } else {
      toggleCompareMode(true);
    }
  };

  return (
    <div className="h-12 bg-white border-b flex items-center px-4 gap-4 shrink-0 justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 border-r pr-4">
          <button
            onClick={() => advanceSimulation()}
            disabled={isGenerating || isCompareMode}
            className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded shadow-sm transition-all active:scale-95 ${
              isGenerating
                ? "bg-slate-300 text-white cursor-wait"
                : isCompareMode
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-brand-600 hover:bg-brand-700 text-white"
            }`}
          >
            {isGenerating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} fill="currentColor" />
            )}
            {isGenerating ? t('simPage.advancing') : t('simPage.advance')}
          </button>
          <button
            onClick={branchSimulation}
            disabled={isGenerating || isCompareMode}
            className={`flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 hover:border-brand-300 text-slate-700 text-xs font-medium rounded shadow-sm hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <GitFork size={14} />
            {t('simPage.branch')}
          </button>
        </div>

        {/* Experiment Designer */}
        <button
          onClick={() => toggleExperimentDesigner(true)}
          disabled={isCompareMode}
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-bold rounded shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Beaker size={14} />
          {t('simPage.designExperiment')}
        </button>

        {/* Comparison Toggle */}
        <button
          onClick={handleToggleCompare}
          className={`flex items-center gap-2 px-3 py-1.5 border rounded text-xs font-medium transition-all ${
            isCompareMode
              ? "bg-amber-50 text-amber-700 border-amber-300 shadow-sm ring-1 ring-amber-200"
              : "bg-white text-slate-600 border-slate-200 hover:text-brand-600 hover:border-brand-300"
          }`}
        >
          <Split
            size={14}
            className={isCompareMode ? "text-amber-600" : ""}
          />
          {isCompareMode ? t('simPage.exitCompare') : t('simPage.compareMode')}
        </button>
      </div>

      {/* Right Tools */}
      <div className="flex items-center gap-2">
        {/* Network Editor */}
        <button
          onClick={() => toggleNetworkEditor(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-brand-600 hover:border-brand-300 text-xs font-medium rounded shadow-sm transition-all"
          title={t('simPage.networkTopology')}
        >
          <Network size={14} />
        </button>

        {/* Global Knowledge */}
        <button
          onClick={() => setGlobalKnowledgeOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-brand-600 hover:border-brand-300 text-xs font-medium rounded shadow-sm transition-all"
          title={t('simPage.globalKnowledge')}
        >
          <Globe size={14} />
        </button>

        {/* Time Settings */}
        <button
          onClick={() => toggleTimeSettings(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-brand-600 hover:border-brand-300 text-xs font-medium rounded shadow-sm transition-all"
          title={t('simPage.timeSettings')}
        >
          <Clock size={14} />
          {currentSim && currentSim.timeConfig
            ? t('simPage.timeLabel', { step: currentSim.timeConfig.step ?? '-', unit: currentSim.timeConfig.unit ?? '' })
            : t('simPage.time')}
        </button>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs rounded shadow-sm transition-all">
          <span className="text-slate-500">{t('simPage.provider')}</span>
          <select
            value={providerSelection ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedProvider(val ? Number(val) : null);
            }}
            className="border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">
              {t('simPage.selectProvider')}
            </option>
            {llmProviders.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || p.provider} {p.model ? `(${p.model})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Save Template */}
        <button
          onClick={() => toggleSaveTemplate(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-brand-600 hover:border-brand-300 text-xs font-medium rounded shadow-sm transition-all"
          title={t('simPage.saveAsTemplate')}
        >
          <Save size={14} />
        </button>
        <button
          onClick={() => useSimulationStore.getState().openSyncModal()}
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-brand-600 hover:border-brand-300 text-xs font-medium rounded shadow-sm transition-all"
          title={t('simPage.syncBackend')}
        >
          {t('simPage.syncBackend')}
        </button>

        <div className="h-4 w-px bg-slate-300 mx-1"></div>

        {/* Automated Report */}
        <button
          onClick={() => toggleReportModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white border border-indigo-700 hover:bg-indigo-700 text-xs font-bold rounded shadow-sm transition-all"
        >
          <FileText size={14} />
          {t('simPage.report')}
        </button>

        <button
          onClick={() => toggleExport(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-brand-600 hover:border-brand-300 text-xs font-medium rounded shadow-sm transition-all"
        >
          <Download size={14} />
          {t('simPage.export')}
        </button>
        <button
          onClick={() => toggleAnalytics(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-brand-600 hover:border-brand-300 text-xs font-medium rounded shadow-sm transition-all"
        >
          <BarChart2 size={14} />
          {t('simPage.analytics')}
        </button>
      </div>

      {/* Modals */}
      <SimulationWizard />
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
      <ToastContainer />
    </div>
  );
};

// ---------------- 页面主组件：SimulationPage ----------------

const SimulationPage: React.FC = () => {
  const isCompareMode = useSimulationStore((state) => state.isCompareMode);
  const params = useParams();
  const simIdParam = params['id'] || params['simulationId'] || null;
  const engineConfig = useSimulationStore((state) => state.engineConfig);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasRestored = useAuthStore((s) => s.hasRestored);

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

  React.useEffect(() => {
    if (engineConfig.mode === 'connected' && hasRestored && isAuthenticated) {
      loadProviders();
    }
  }, [engineConfig.mode, hasRestored, isAuthenticated, loadProviders]);
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

          // If backend connected mode is available, prefer live graph/state/events
          if (engineConfig.mode === 'connected') {
            try {
              const graph = await getTreeGraph(engineConfig.endpoint, sim.id, token).catch(() => null);
              const simState = await getSimState(engineConfig.endpoint, sim.id, token).catch(() => null);
              const events = await getSimEvents(engineConfig.endpoint, sim.id, graph?.root ?? null, token).catch(() => []);

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

              const nodes = graph ? mapGraphToNodes(graph) : [];

              const agents = (simState?.agents || []).map((a: any, idx: number) => ({
                id: `a-${idx}-${a.name}`,
                name: a.name,
                role: a.role || '',
                avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(a.name || String(idx))}`,
                profile: '',
                llmConfig: { provider: 'mock', model: 'default' },
                properties: {},
                history: {},
                memory: (a.short_memory || []).map((m: any, j: number) => ({ id: `m-${idx}-${j}`, round: Number(simState?.turns || 0), content: String(m.content ?? ''), type: 'dialogue', timestamp: new Date().toISOString() })),
                knowledgeBase: a.knowledgeBase || []
              }));

              // Map scene_config.social_network to socialNetwork for frontend
              const socialNetwork = (sim as any).scene_config?.social_network || {};

              useSimulationStore.setState({
                currentSimulation: { ...sim, socialNetwork },
                nodes,
                selectedNodeId: graph && graph.root != null ? String(graph.root) : nodes[0]?.id ?? null,
                agents: agents,
                rawEvents: events || []
              } as any);
              return;
            } catch (e) {
              // fall through to latest_state fallback
              console.warn('Failed to fetch live graph/state/events, falling back to latest_state', e);
            }
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

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Header />
      <Toolbar />

      <div className="flex-1 flex overflow-hidden p-3 gap-3">
        {/* Left: SimTree */}
        <div className="w-1/4 min-w-[300px] flex flex-col transition-all duration-300">
          <SimTree />
        </div>

        {/* Center: Main Content Switcher */}
        <div className="flex-1 min-w-[400px] flex flex-col transition-all duration-300">
          {isCompareMode ? <ComparisonView /> : <LogViewer />}
        </div>

        {/* Right: Agents / Host */}
        {!isCompareMode && (
          <div className="w-80 shrink-0 flex flex-col">
            <Sidebar />
          </div>
        )}
      </div>
    </div>
  );
};

export default SimulationPage;
export { SimulationPage };