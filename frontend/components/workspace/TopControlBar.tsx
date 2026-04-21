import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowUpLeft, Beaker, Cloud, Download, Eye, GitBranchPlus, GitCompareArrows, GitFork, LogOut, Moon, MoreHorizontal, Orbit, Play, RotateCcw, Save, Settings, Sun, ToggleLeft, ToggleRight } from "lucide-react";

import { useSimulationStore } from "../../store";
import { useAuthStore } from "../../store/auth";
import { useThemeStore } from "../../store/theme";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { getWorkspaceNodeLabel } from "./workspaceLabels";

interface TopControlBarProps {
  isGenerating: boolean;
  isCompareMode: boolean;
  canReturnToParent: boolean;
  onContinue: () => void;
  onCreateBranch: () => void;
  onViewDetails: () => void;
  onToggleCompare: () => void;
  onOpenNode: () => void;
  onReturnToParent: () => void;
  onOpenSnapshots: () => void;
  onOpenExport: () => void;
  onResetSimulation: () => void;
  onOpenTreeOps: () => void;
}

const NAV_ITEMS = [
  { to: "/dashboard", labelKey: "nav.dashboard" },
  { to: "/simulations/new", labelKey: "nav.new" },
  { to: "/simulations/saved", labelKey: "nav.saved" },
  { to: "/settings", labelKey: "nav.settings" },
];

export const TopControlBar: React.FC<TopControlBarProps> = ({
  isGenerating,
  isCompareMode,
  canReturnToParent,
  onContinue,
  onCreateBranch,
  onViewDetails,
  onToggleCompare,
  onOpenNode,
  onReturnToParent,
  onOpenSnapshots,
  onOpenExport,
  onResetSimulation,
  onOpenTreeOps,
}) => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");
  const location = useLocation();
  const currentSimulation = useSimulationStore((state) => state.currentSimulation);
  const nodes = useSimulationStore((state) => state.nodes);
  const selectedNodeId = useSimulationStore((state) => state.selectedNodeId);
  const selectedProviderId = useSimulationStore((state) => state.selectedProviderId);
  const currentProviderId = useSimulationStore((state) => state.currentProviderId);
  const llmProviders = useSimulationStore((state) => state.llmProviders);
  const engineConfig = useSimulationStore((state) => state.engineConfig);
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const themeMode = useThemeStore((state) => state.mode);
  const toggleTheme = useThemeStore((state) => state.toggle);
  const environmentEnabled = useSimulationStore((state) => state.environmentEnabled);
  const environmentSuggestionsLoading = useSimulationStore((state) => state.environmentSuggestionsLoading);
  const toggleEnvironmentEnabled = useSimulationStore((state) => state.toggleEnvironmentEnabled);
  const generateEnvironmentSuggestions = useSimulationStore((state) => state.generateEnvironmentSuggestions);
  const toggleExperimentDesigner = useSimulationStore((state) => state.toggleExperimentDesigner);

  const selectedNode = React.useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || nodes[0] || null,
    [nodes, selectedNodeId],
  );

  const workspaceTitle = React.useMemo(() => {
    const rawTitle = currentSimulation?.name || t("simulationWorkspace.titleFallback");
    const [primaryTitle] = rawTitle.split(/\s[-–—]\s/);
    return primaryTitle?.trim() || rawTitle;
  }, [currentSimulation?.name, t]);

  const runStatus = isGenerating
    ? t("simulationWorkspace.running")
    : t(`topologyExplorer.status.${selectedNode?.status || "pending"}`);
  const providerSelection = selectedProviderId ?? currentProviderId ?? null;
  const selectedProvider =
    llmProviders.find((provider) => provider.id === providerSelection) || null;
  const providerLabel = selectedProvider
    ? `${selectedProvider.name || selectedProvider.provider}${selectedProvider.model ? ` · ${selectedProvider.model}` : ""}`
    : t("simulationWorkspace.noProvider");

  return (
    <header className="ss-top-control-bar">
      <div className="ss-top-control-bar__row">
        <div className="ss-top-control-bar__brand-group">
          <div className="ss-top-control-bar__brand">
            <div className="ss-top-control-bar__brand-mark">
              <Orbit size={18} />
            </div>
            <div>
              <div className="ss-top-control-bar__brand-title">FOS</div>
              <div className="ss-top-control-bar__brand-subtitle">
                {isZh ? "实验控制台" : "Simulation Control Room"}
              </div>
            </div>
          </div>

          <nav className="ss-top-control-bar__nav" aria-label={isZh ? "一级导航" : "Primary"}>
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`ss-top-control-bar__nav-link${isActive ? " is-active" : ""}`}
                >
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </nav>

        </div>

        <div className="ss-top-control-bar__system">
          <button
            type="button"
            className="ss-icon-button"
            onClick={toggleTheme}
            title={t("components.navBar.toggleTheme")}
          >
            {themeMode === "dark" ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <LanguageSwitcher />
          <Link to="/settings" className="ss-icon-button" title={t("nav.settings")}>
            <Settings size={16} />
          </Link>
          <div className="ss-top-control-bar__user">{user?.email}</div>
          <button type="button" onClick={clearSession} className="ss-icon-button" title={t("nav.signout")}>
            <LogOut size={14} />
            <span className="hidden sm:inline">{t("nav.signout")}</span>
          </button>
        </div>
      </div>

      <div className="ss-top-control-bar__row ss-top-control-bar__row--meta">
        <div className="ss-top-control-bar__headline">
          <div className="ss-top-control-bar__title-line">
            <h1 className="ss-top-control-bar__title">{workspaceTitle}</h1>
            <div className="ss-top-control-bar__quick-actions" aria-label={isZh ? "核心功能" : "Core actions"}>
              <button
                type="button"
                className={`ss-top-control-bar__quick-chip${environmentEnabled ? " is-active" : ""}`}
                onClick={() => void toggleEnvironmentEnabled()}
                title={environmentEnabled ? (isZh ? "环境变量已启用" : "Environment variables enabled") : (isZh ? "环境变量已禁用" : "Environment variables disabled")}
              >
                {environmentEnabled ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                <span>{isZh ? "环境变量" : "Environment"}</span>
              </button>

              <button
                type="button"
                className="ss-top-control-bar__quick-chip"
                onClick={() => void generateEnvironmentSuggestions()}
                disabled={!currentSimulation || environmentSuggestionsLoading}
                title={isZh ? "生成环境建议" : "Generate environment suggestions"}
              >
                <Cloud size={15} />
                <span>{environmentSuggestionsLoading ? (isZh ? "生成中" : "Generating") : (isZh ? "环境建议" : "Environment hints")}</span>
              </button>

              <button
                type="button"
                className="ss-top-control-bar__quick-chip"
                onClick={() => toggleExperimentDesigner(true)}
                disabled={!currentSimulation}
                title={isZh ? "打开仿真干预" : "Open interventions"}
              >
                <Beaker size={15} />
                <span>{isZh ? "仿真干预" : "Intervention"}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="ss-top-control-bar__workspace-tools">
          <div className="ss-top-control-bar__meta-strip">
            <div className="ss-top-control-bar__meta-item">
              <span>{isZh ? "轮次" : "Round"}</span>
              <strong>{selectedNode?.depth != null && selectedNode.depth > 0 ? `${isZh ? "第" : ""}${selectedNode.depth}${isZh ? "轮" : ""}` : isZh ? "初始设定" : "Start"}</strong>
            </div>
            <div className="ss-top-control-bar__meta-item">
              <span>{isZh ? "状态" : "Status"}</span>
              <strong>{runStatus}</strong>
            </div>
            <div className="ss-top-control-bar__meta-item">
              <span>{isZh ? "节点" : "Node"}</span>
              <strong>{getWorkspaceNodeLabel(selectedNode, t)}</strong>
            </div>
            <div className="ss-top-control-bar__meta-item">
              <span>{isZh ? "引擎" : "Engine"}</span>
              <strong>
                {engineConfig.mode === "connected"
                  ? `${isZh ? "高级控制" : "Control"} · ${providerLabel}`
                  : `${isZh ? "高级控制" : "Control"} · ${t("simPage.standaloneMode")}`}
              </strong>
            </div>
          </div>

          <div className="ss-top-control-bar__actions">
            <button type="button" className="ss-top-control-bar__primary" onClick={onContinue}>
              <Play size={15} />
              <span>{isGenerating ? t("simulationWorkspace.running") : t("controlRoom.continueSimulation")}</span>
            </button>

            <details className="ss-top-control-bar__menu">
              <summary className="ss-top-control-bar__menu-trigger" aria-label={isZh ? "更多操作" : "More actions"}>
                <MoreHorizontal size={16} />
              </summary>
              <div className="ss-top-control-bar__menu-panel">
                <button type="button" className="ss-button-secondary" onClick={onCreateBranch}>
                  <GitFork size={15} />
                  {t("controlRoom.createBranchPrimary")}
                </button>
                <button type="button" className="ss-button-secondary" onClick={onViewDetails}>
                  <Eye size={15} />
                  {t("controlRoom.viewDetails")}
                </button>
                <button type="button" className="ss-button-secondary" onClick={onToggleCompare}>
                  <GitCompareArrows size={15} />
                  {isCompareMode ? t("simulationWorkspace.compareExit") : t("simulationWorkspace.compare")}
                </button>
                <button type="button" className="ss-button-secondary" onClick={onOpenNode}>
                  <Eye size={15} />
                  {isZh ? "打开节点" : "Open node"}
                </button>
                <button type="button" className="ss-button-secondary" onClick={onOpenSnapshots}>
                  <Save size={15} />
                  {isZh ? "快照管理" : "Snapshots"}
                </button>
                <button type="button" className="ss-button-secondary" onClick={onOpenExport}>
                  <Download size={15} />
                  {isZh ? "导出结果" : "Export"}
                </button>
                <button type="button" className="ss-button-secondary" onClick={onOpenTreeOps}>
                  <GitBranchPlus size={15} />
                  {isZh ? "高级树推进" : "Tree ops"}
                </button>
                <button type="button" className="ss-button-secondary" onClick={onResetSimulation}>
                  <RotateCcw size={15} />
                  {isZh ? "重置仿真" : "Reset"}
                </button>
                <button type="button" className="ss-button-secondary" onClick={onReturnToParent} disabled={!canReturnToParent}>
                  <ArrowUpLeft size={15} />
                  {t("controlRoom.returnToParentBranch")}
                </button>
              </div>
            </details>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopControlBar;
