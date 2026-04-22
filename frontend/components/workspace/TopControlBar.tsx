import React from "react";
<<<<<<< Updated upstream
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowUpLeft, Eye, GitCompareArrows, GitFork, LogOut, Moon, MoreHorizontal, Play, Settings, Sun } from "lucide-react";

import { useSimulationStore } from "../../store";
import { useAuthStore } from "../../store/auth";
import { useThemeStore } from "../../store/theme";
import { BrandLogo } from "../BrandLogo";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { getWorkspaceNodeLabel } from "./workspaceLabels";
=======
import { useTranslation } from "react-i18next";
import { Beaker, Database, Download, FileText, GitBranchPlus, GitCompareArrows, GitFork, Image, MoreHorizontal, Network, Play, RotateCcw, Save, Trash2, UserRound, Zap } from "lucide-react";

import { useSimulationStore } from "../../store";
>>>>>>> Stashed changes

interface TopControlBarProps {
  isGenerating: boolean;
  isCompareMode: boolean;
<<<<<<< Updated upstream
  canReturnToParent: boolean;
  onContinue: () => void;
  onCreateBranch: () => void;
  onViewDetails: () => void;
  onToggleCompare: () => void;
  onOpenNode: () => void;
  onReturnToParent: () => void;
}

const NAV_ITEMS = [
  { to: "/dashboard", labelKey: "nav.dashboard" },
  { to: "/simulations/create", labelKey: "nav.create" },
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

  const selectedNode = React.useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || nodes[0] || null,
    [nodes, selectedNodeId],
  );
=======
  workspaceMode: "timeline" | "agents" | "host";
  onContinue: () => void;
  onCreateBranch: () => void;
  onShowTimeline: () => void;
  onShowAgents: () => void;
  onShowHostIntervention: () => void;
  onToggleCompare: () => void;
  onOpenSimulationIntervention: () => void;
  onOpenSnapshots: () => void;
  onSaveSimulation: () => void;
  onOpenReport: () => void;
  onOpenNetwork: () => void;
  onOpenKnowledge: () => void;
  onOpenMultimodal: () => void;
  onOpenExport: () => void;
  onResetSimulation: () => void;
  onDeleteSimulation: () => void;
  onOpenTreeOps: () => void;
}

export const TopControlBar: React.FC<TopControlBarProps> = ({
  isGenerating,
  isCompareMode,
  workspaceMode,
  onContinue,
  onCreateBranch,
  onShowTimeline,
  onShowAgents,
  onShowHostIntervention,
  onToggleCompare,
  onOpenSimulationIntervention,
  onOpenSnapshots,
  onSaveSimulation,
  onOpenReport,
  onOpenNetwork,
  onOpenKnowledge,
  onOpenMultimodal,
  onOpenExport,
  onResetSimulation,
  onDeleteSimulation,
  onOpenTreeOps,
}) => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");
  const currentSimulation = useSimulationStore((state) => state.currentSimulation);
  const selectedProviderId = useSimulationStore((state) => state.selectedProviderId);
  const currentProviderId = useSimulationStore((state) => state.currentProviderId);
  const providersLoading = useSimulationStore((state) => state.providersLoading);
  const llmProviders = useSimulationStore((state) => state.llmProviders);
  const setSelectedProvider = useSimulationStore((state) => state.setSelectedProvider);
>>>>>>> Stashed changes

  const workspaceTitle = React.useMemo(() => {
    const rawTitle = currentSimulation?.name || t("simulationWorkspace.titleFallback");
    const [primaryTitle] = rawTitle.split(/\s[-–—]\s/);
    return primaryTitle?.trim() || rawTitle;
  }, [currentSimulation?.name, t]);

<<<<<<< Updated upstream
  const runStatus = isGenerating
    ? t("simulationWorkspace.running")
    : t(`topologyExplorer.status.${selectedNode?.status || "pending"}`);
=======
>>>>>>> Stashed changes
  const providerSelection = selectedProviderId ?? currentProviderId ?? null;
  const selectedProvider =
    llmProviders.find((provider) => provider.id === providerSelection) || null;
  const providerLabel = selectedProvider
    ? `${selectedProvider.name || selectedProvider.provider}${selectedProvider.model ? ` · ${selectedProvider.model}` : ""}`
    : t("simulationWorkspace.noProvider");
<<<<<<< Updated upstream
  const workbenchPath = currentSimulation?.id ? `/simulations/${currentSimulation.id}` : "/simulations/new";
  const navItems = React.useMemo(
    () => [
      NAV_ITEMS[0],
      NAV_ITEMS[1],
      { to: workbenchPath, labelKey: "nav.workbench" },
      NAV_ITEMS[2],
      NAV_ITEMS[3],
    ],
    [workbenchPath],
  );

  return (
    <header className="ss-top-control-bar">
      <div className="ss-top-control-bar__row">
        <div className="ss-top-control-bar__brand-group">
          <div className="ss-top-control-bar__brand">
            <BrandLogo subtitle={isZh ? "实验控制台" : "Simulation Control Room"} />
          </div>

          <nav className="ss-top-control-bar__nav" aria-label={isZh ? "一级导航" : "Primary"}>
            {navItems.map((item) => {
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
=======

  const hasSimulation = Boolean(currentSimulation);

  return (
    <header className="ss-top-control-bar">
      <div className="ss-top-control-bar__row ss-top-control-bar__row--meta">
        <div className="ss-top-control-bar__headline">
          <div className="ss-top-control-bar__title-block">
            <h1 className="ss-top-control-bar__title">{workspaceTitle}</h1>
          </div>

          <div className="ss-top-control-bar__quick-actions" aria-label={isZh ? "核心功能" : "Core actions"}>
            <button
              type="button"
              className={`ss-top-control-bar__quick-chip${workspaceMode === "timeline" ? " is-active" : ""}`}
              onClick={onShowTimeline}
              disabled={!hasSimulation}
              title={isZh ? "查看时间轴与节点详情" : "Open timeline and node details"}
            >
              <Play size={15} />
              <span>{isZh ? "时间轴" : "Timeline"}</span>
            </button>

            <button
              type="button"
              className={`ss-top-control-bar__quick-chip${workspaceMode === "agents" ? " is-active" : ""}`}
              onClick={onShowAgents}
              disabled={!hasSimulation}
              title={isZh ? "查看角色观察面板" : "Open role observation"}
            >
              <UserRound size={15} />
              <span>{isZh ? "智能体" : "Agents"}</span>
            </button>

            <button
              type="button"
              className={`ss-top-control-bar__quick-chip${workspaceMode === "host" ? " is-active" : ""}`}
              onClick={onShowHostIntervention}
              disabled={!hasSimulation}
              title={isZh ? "打开主持干预面板" : "Open host intervention"}
            >
              <Zap size={15} />
              <span>{isZh ? "主持干预" : "Host"}</span>
            </button>

            <button
              type="button"
              className="ss-top-control-bar__quick-chip"
              onClick={onOpenSimulationIntervention}
              disabled={!hasSimulation}
              title={isZh ? "打开仿真干预" : "Open interventions"}
            >
              <Beaker size={15} />
              <span>{isZh ? "仿真干预" : "Intervention"}</span>
            </button>

            <button
              type="button"
              className="ss-top-control-bar__quick-chip"
              onClick={onOpenReport}
              disabled={!hasSimulation}
              title={isZh ? "生成实验分析报告" : "Generate experiment analysis report"}
            >
              <FileText size={15} />
              <span>{isZh ? "分析报告" : "Report"}</span>
            </button>
          </div>
        </div>

        <div className="ss-top-control-bar__workspace-tools">
          <div className="ss-top-control-bar__actions">
            <label className="ss-top-control-bar__provider-shell">
              <span>{isZh ? "提供商" : "Provider"}</span>
              <select
                className="ss-top-control-bar__provider-select"
                value={providerSelection ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedProvider(value ? Number(value) : null);
                }}
                disabled={providersLoading || llmProviders.length === 0}
                title={providerLabel}
              >
                <option value="">{t("simulationWorkspace.noProvider")}</option>
                {llmProviders.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name || provider.provider}
                    {provider.model ? ` · ${provider.model}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="ss-top-control-bar__primary" onClick={onContinue} disabled={!hasSimulation}>
>>>>>>> Stashed changes
              <Play size={15} />
              <span>{isGenerating ? t("simulationWorkspace.running") : t("controlRoom.continueSimulation")}</span>
            </button>

            <details className="ss-top-control-bar__menu">
              <summary className="ss-top-control-bar__menu-trigger" aria-label={isZh ? "更多操作" : "More actions"}>
                <MoreHorizontal size={16} />
              </summary>
              <div className="ss-top-control-bar__menu-panel">
<<<<<<< Updated upstream
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
                <button type="button" className="ss-button-secondary" onClick={onReturnToParent} disabled={!canReturnToParent}>
                  <ArrowUpLeft size={15} />
                  {t("controlRoom.returnToParentBranch")}
=======
                <button type="button" className="ss-button-secondary" onClick={onCreateBranch} disabled={!hasSimulation}>
                  <GitFork size={15} />
                  {t("controlRoom.createBranchPrimary")}
                </button>
                <button type="button" className="ss-button-secondary" onClick={onToggleCompare} disabled={!hasSimulation}>
                  <GitCompareArrows size={15} />
                  {isCompareMode ? t("simulationWorkspace.compareExit") : t("simulationWorkspace.compare")}
                </button>
                <button type="button" className="ss-button-secondary" onClick={onSaveSimulation} disabled={!hasSimulation}>
                  <Save size={15} />
                  {isZh ? "保存模拟" : "Save simulation"}
                </button>
                <button type="button" className="ss-button-secondary" onClick={onOpenSnapshots} disabled={!hasSimulation}>
                  <Save size={15} />
                  {isZh ? "快照管理" : "Snapshots"}
                </button>
                <button type="button" className="ss-button-secondary" onClick={onOpenReport} disabled={!hasSimulation}>
                  <FileText size={15} />
                  {isZh ? "生成分析报告" : "Analysis report"}
                </button>
                <button type="button" className="ss-button-secondary" onClick={onOpenNetwork} disabled={!hasSimulation}>
                  <Network size={15} />
                  {isZh ? "社交网络拓扑" : "Social topology"}
                </button>
                <button type="button" className="ss-button-secondary" onClick={onOpenKnowledge} disabled={!hasSimulation}>
                  <Database size={15} />
                  {isZh ? "全局知识库" : "Global knowledge"}
                </button>
                <button type="button" className="ss-button-secondary" onClick={onOpenMultimodal} disabled={!hasSimulation}>
                  <Image size={15} />
                  {isZh ? "多模态导入" : "Multimodal input"}
                </button>
                <button type="button" className="ss-button-secondary" onClick={onOpenExport} disabled={!hasSimulation}>
                  <Download size={15} />
                  {isZh ? "导出结果" : "Export"}
                </button>
                <button type="button" className="ss-button-secondary" onClick={onOpenTreeOps} disabled={!hasSimulation}>
                  <GitBranchPlus size={15} />
                  {isZh ? "高级树推进" : "Tree ops"}
                </button>
                <button type="button" className="ss-button-secondary" onClick={onResetSimulation} disabled={!hasSimulation}>
                  <RotateCcw size={15} />
                  {isZh ? "重置仿真" : "Reset"}
                </button>
                <button type="button" className="ss-button-secondary is-danger" onClick={onDeleteSimulation} disabled={!hasSimulation}>
                  <Trash2 size={15} />
                  {isZh ? "删除模拟" : "Delete simulation"}
>>>>>>> Stashed changes
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
