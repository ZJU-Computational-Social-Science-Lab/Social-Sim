/**
 * Context-sensitive toolbar for the simulation page.
 *
 * Renders different toolbar buttons depending on the active tab:
 *   - simTree: Advance, Branch, Auto-advance, Design Experiment,
 *              Compare toggle, Time Settings, Provider dropdown
 *   - logs: Report, Export, Analytics
 *   - agents: Network Topology, Global Knowledge
 *
 * Button logic is copied from the former Toolbar component in SimulationPage.tsx.
 *
 * Exports: ContextToolbar
 */

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Play,
  SkipForward,
  GitFork,
  BarChart2,
  Download,
  Loader2,
  Split,
  Beaker,
  Clock,
  Network,
  FileText,
  Globe,
  Square,
} from "lucide-react";
import { useSimulationStore } from "../store";

const ContextToolbar: React.FC = () => {
  const { t } = useTranslation();

  // Tab selection
  const activeTab = useSimulationStore((s) => s.activeTab);

  // Advance / Branch / Auto-advance
  const advanceSimulation = useSimulationStore((s) => s.advanceSimulation);
  const branchSimulation = useSimulationStore((s) => s.branchSimulation);
  const isGenerating = useSimulationStore((s) => s.isGenerating);
  const isAutoAdvancing = useSimulationStore((s) => s.isAutoAdvancing);
  const autoAdvanceCurrent = useSimulationStore((s) => s.autoAdvanceCurrent);
  const autoAdvanceTotal = useSimulationStore((s) => s.autoAdvanceTotal);
  const startAutoAdvance = useSimulationStore((s) => s.startAutoAdvance);
  const stopAutoAdvance = useSimulationStore((s) => s.stopAutoAdvance);

  // Compare mode
  const isCompareMode = useSimulationStore((s) => s.isCompareMode);
  const toggleCompareMode = useSimulationStore((s) => s.toggleCompareMode);
  const setCompareTarget = useSimulationStore((s) => s.setCompareTarget);

  // Panel toggles
  const toggleExperimentDesigner = useSimulationStore((s) => s.toggleExperimentDesigner);
  const toggleTimeSettings = useSimulationStore((s) => s.toggleTimeSettings);
  const toggleAnalytics = useSimulationStore((s) => s.toggleAnalytics);
  const toggleExport = useSimulationStore((s) => s.toggleExport);
  const toggleReportModal = useSimulationStore((s) => s.toggleReportModal);
  const toggleNetworkEditor = useSimulationStore((s) => s.toggleNetworkEditor);
  const setGlobalKnowledgeOpen = useSimulationStore((s) => s.setGlobalKnowledgeOpen);

  // Provider
  const llmProviders = useSimulationStore((s) => s.llmProviders);
  const selectedProviderId = useSimulationStore((s) => s.selectedProviderId);
  const currentProviderId = useSimulationStore((s) => s.currentProviderId);
  const setSelectedProvider = useSimulationStore((s) => s.setSelectedProvider);

  // Current simulation (for time display)
  const currentSim = useSimulationStore((s) => s.currentSimulation);

  const [advanceSteps, setAdvanceSteps] = React.useState(1);

  const providerSelection = selectedProviderId ?? currentProviderId ?? null;

  const handleToggleCompare = () => {
    if (isCompareMode) {
      toggleCompareMode(false);
      setCompareTarget(null);
    } else {
      toggleCompareMode(true);
    }
  };

  // ---- simTree tab toolbar ----
  const simTreeToolbar = (
    <>
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
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 hover:border-brand-300 text-slate-700 text-xs font-medium rounded shadow-sm hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <GitFork size={14} />
          {t('simPage.branch')}
        </button>

        {/* Auto-advance controls */}
        <div className="h-4 w-px bg-slate-200 mx-1"></div>

        <input
          type="number"
          min={1}
          max={100}
          value={advanceSteps}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v)) setAdvanceSteps(Math.min(100, Math.max(1, v)));
          }}
          disabled={isAutoAdvancing || isGenerating || isCompareMode}
          className="w-16 px-2 py-1.5 text-xs text-center border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
          title={t('simPage.enterSteps')}
        />

        {isAutoAdvancing ? (
          <button
            onClick={() => stopAutoAdvance()}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-500 text-white hover:bg-red-600 text-xs font-bold rounded shadow-sm transition-all active:scale-95"
          >
            <Square size={14} />
            {t('simPage.stop')}
          </button>
        ) : (
          <button
            onClick={() => startAutoAdvance(advanceSteps)}
            disabled={isGenerating || isCompareMode}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded shadow-sm transition-all active:scale-95 ${
              isGenerating || isCompareMode
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            <SkipForward size={14} />
            {t('simPage.autoAdvance')}
          </button>
        )}

        {isAutoAdvancing && (
          <span className="text-xs text-slate-500">
            {t('simPage.advancingProgress', {
              current: autoAdvanceCurrent,
              total: autoAdvanceTotal,
            })}
          </span>
        )}
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

      {/* Provider Dropdown */}
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
    </>
  );

  // ---- logs tab toolbar ----
  const logsToolbar = (
    <>
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
    </>
  );

  // ---- agents tab toolbar ----
  const agentsToolbar = (
    <>
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
    </>
  );

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b bg-white min-h-[44px]">
      {activeTab === 'simTree' && simTreeToolbar}
      {activeTab === 'logs' && logsToolbar}
      {activeTab === 'agents' && agentsToolbar}
    </div>
  );
};

export default ContextToolbar;
