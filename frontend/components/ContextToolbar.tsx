/**
 * Context-sensitive toolbar for the simulation page.
 *
 * Renders different toolbar buttons depending on the active tab:
 *   - timeline: Advance, Branch, Auto-advance, Design Experiment,
 *               Compare toggle, Provider dropdown,
 *               Report, Export, Analytics
 *   - agents: Network Topology, Global Knowledge
 *
 * Uses the design-system Button component for consistent styling.
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
  Network,
  FileText,
  Globe,
  Square,
} from "lucide-react";
import { useSimulationStore } from "../store";
import { Button } from "./ui/button";

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
      <div className="flex items-center gap-2 border-r pr-4" style={{ borderColor: 'var(--ss-border)' }}>
        {/* Advance Node */}
        <Button
          onClick={() => advanceSimulation()}
          disabled={isGenerating || isCompareMode}
          size="sm"
          className={isGenerating ? "!bg-[var(--ss-text-muted)] !text-[var(--ss-neutral-0)] !shadow-none" : ""}
        >
          {isGenerating ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Play size={14} fill="currentColor" />
          )}
          {isGenerating ? t('simPage.advancing') : t('simPage.advance')}
        </Button>

        {/* Create Branch */}
        <Button
          variant="outline"
          size="sm"
          onClick={branchSimulation}
          disabled={isGenerating || isCompareMode}
        >
          <GitFork size={14} />
          {t('simPage.branch')}
        </Button>

        {/* Auto-advance controls */}
        <div className="h-4 w-px mx-1" style={{ background: 'var(--ss-border)' }}></div>

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
          className="w-14 px-2 py-1.5 text-xs text-center border rounded-full focus:outline-none focus:ring-1 focus:ring-[var(--ss-brand-primary)] disabled:opacity-50"
          style={{ borderColor: 'var(--ss-border)', background: 'var(--ss-surface)' }}
          title={t('simPage.enterSteps')}
        />

        {isAutoAdvancing ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => stopAutoAdvance()}
          >
            <Square size={14} />
            {t('simPage.stop')}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => startAutoAdvance(advanceSteps)}
            disabled={isGenerating || isCompareMode}
            className="!bg-[var(--ss-success-600)] hover:!bg-emerald-700 !text-white !shadow-[0_14px_32px_rgba(16,185,129,0.18)]"
          >
            <SkipForward size={14} />
            {t('simPage.autoAdvance')}
          </Button>
        )}

        {isAutoAdvancing && (
          <span className="text-xs" style={{ color: 'var(--ss-text-muted)' }}>
            {t('simPage.advancingProgress', {
              current: autoAdvanceCurrent,
              total: autoAdvanceTotal,
            })}
          </span>
        )}
      </div>

      {/* Design Experiment */}
      <Button
        size="sm"
        onClick={() => toggleExperimentDesigner(true)}
        disabled={isCompareMode}
        className="!bg-indigo-50 !text-indigo-700 !border-indigo-200 hover:!bg-indigo-100 !shadow-none"
      >
        <Beaker size={14} />
        {t('simPage.designExperiment')}
      </Button>

      {/* Comparison Toggle */}
      <Button
        variant={isCompareMode ? undefined : "outline"}
        size="sm"
        onClick={handleToggleCompare}
        className={isCompareMode ? "!bg-amber-50 !text-amber-700 !border-amber-300 !ring-1 !ring-amber-200 !shadow-sm" : ""}
      >
        <Split
          size={14}
          className={isCompareMode ? "text-amber-600" : ""}
        />
        {isCompareMode ? t('simPage.exitCompare') : t('simPage.compareMode')}
      </Button>

      {/* Spacer pushes right-side tools over the logs area */}
      <div className="flex-1" />

      {/* Provider Dropdown */}
      <div className="flex items-center gap-2 px-3 py-1.5 border rounded-full text-xs" style={{ background: 'var(--ss-surface)', borderColor: 'var(--ss-border)', color: 'var(--ss-text)' }}>
        <span style={{ color: 'var(--ss-text-muted)' }}>{t('simPage.provider')}</span>
        <select
          value={providerSelection ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            setSelectedProvider(val ? Number(val) : null);
          }}
          className="border rounded-full px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--ss-brand-primary)]"
          style={{ background: 'var(--ss-surface)', borderColor: 'var(--ss-border)' }}
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
      <Button
        size="sm"
        onClick={() => toggleReportModal(true)}
        className="!bg-indigo-600 !text-white hover:!bg-indigo-700 !shadow-[0_14px_32px_rgba(79,70,229,0.18)]"
      >
        <FileText size={14} />
        {t('simPage.report')}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => toggleExport(true)}
      >
        <Download size={14} />
        {t('simPage.export')}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => toggleAnalytics(true)}
      >
        <BarChart2 size={14} />
        {t('simPage.analytics')}
      </Button>
    </>
  );

  // ---- agents tab toolbar ----
  const agentsToolbar = (
    <>
      {/* Network Editor */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => toggleNetworkEditor(true)}
        title={t('simPage.networkTopology')}
      >
        <Network size={14} />
      </Button>

      {/* Global Knowledge */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setGlobalKnowledgeOpen(true)}
        title={t('simPage.globalKnowledge')}
      >
        <Globe size={14} />
      </Button>
    </>
  );

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b min-h-[44px]" style={{ background: 'var(--ss-workspace-toolbar)', borderColor: 'var(--ss-border)' }}>
      {activeTab === 'timeline' && <>{simTreeToolbar}{logsToolbar}</>}
      {activeTab === 'agents' && agentsToolbar}
    </div>
  );
};

export default ContextToolbar;
