import React from "react";
import {
  BarChart2,
  Clock3,
  FileCog,
  GitFork,
  Globe,
  Network,
  Rows3,
  Sparkles,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useSimulationStore } from "../../store";
import { buildWorkspacePath, getWorkspaceNodeLabel } from "./workspaceLabels";
import { CollapsibleInsightSection } from "./CollapsibleInsightSection";
import { OutputActionsPanel } from "./OutputActionsPanel";

interface AnalysisContextPanelProps {
  branchDetailsOpen: boolean;
  onToggleBranchDetails: () => void;
  onOpenRoleObservation: () => void;
}

export const AnalysisContextPanel: React.FC<AnalysisContextPanelProps> = ({
  branchDetailsOpen,
  onToggleBranchDetails,
  onOpenRoleObservation,
}) => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");
  const navigate = useNavigate();
  const currentSimulation = useSimulationStore((state) => state.currentSimulation);
  const nodes = useSimulationStore((state) => state.nodes);
  const selectedNodeId = useSimulationStore((state) => state.selectedNodeId);
  const compareTargetNodeId = useSimulationStore((state) => state.compareTargetNodeId);
  const isCompareMode = useSimulationStore((state) => state.isCompareMode);
  const selectNode = useSimulationStore((state) => state.selectNode);
  const setCompareTarget = useSimulationStore((state) => state.setCompareTarget);
  const toggleCompareMode = useSimulationStore((state) => state.toggleCompareMode);
  const engineConfig = useSimulationStore((state) => state.engineConfig);
  const llmProviders = useSimulationStore((state) => state.llmProviders);
  const selectedProviderId = useSimulationStore((state) => state.selectedProviderId);
  const currentProviderId = useSimulationStore((state) => state.currentProviderId);
  const setSelectedProvider = useSimulationStore((state) => state.setSelectedProvider);
  const toggleNetworkEditor = useSimulationStore((state) => state.toggleNetworkEditor);
  const toggleTimeSettings = useSimulationStore((state) => state.toggleTimeSettings);
  const setGlobalKnowledgeOpen = useSimulationStore((state) => state.setGlobalKnowledgeOpen);
  const toggleAnalytics = useSimulationStore((state) => state.toggleAnalytics);
  const toggleExperimentDesigner = useSimulationStore((state) => state.toggleExperimentDesigner);
  const logs = useSimulationStore((state) => state.logs);
  const rawEvents = useSimulationStore((state) => state.rawEvents);
  const agents = useSimulationStore((state) => state.agents);

  const selectedNode = React.useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || nodes[0] || null,
    [nodes, selectedNodeId],
  );
  const nodeLookup = React.useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );
  const parentNode = selectedNode?.parentId ? nodeLookup.get(selectedNode.parentId) || null : null;
  const siblingNodes = React.useMemo(
    () =>
      selectedNode
        ? nodes.filter((node) => node.parentId === selectedNode.parentId && node.id !== selectedNode.id)
        : [],
    [nodes, selectedNode],
  );
  const childNodes = React.useMemo(
    () => (selectedNode ? nodes.filter((node) => node.parentId === selectedNode.id) : []),
    [nodes, selectedNode],
  );
  const currentPath = React.useMemo(
    () => buildWorkspacePath(selectedNode, nodeLookup),
    [nodeLookup, selectedNode],
  );

  const providerSelection = selectedProviderId ?? currentProviderId ?? null;
  const selectedProvider =
    llmProviders.find((provider) => provider.id === providerSelection) || null;
  const recentLogs = React.useMemo(() => [...logs].slice(-4).reverse(), [logs]);
  const sceneConfig = ((currentSimulation as any)?.scene_config || {}) as Record<string, any>;
  const actionSpace =
    sceneConfig.actions?.length ||
    sceneConfig.action_space?.length ||
    sceneConfig.heuristics?.length ||
    0;

  const handleActivateNode = (nodeId: string) => {
    if (isCompareMode && nodeId !== selectedNodeId) {
      setCompareTarget(nodeId);
      return;
    }
    selectNode(nodeId);
  };

  const handleToggleEngine = () => {
    navigate("/settings?tab=providers_llm");
  };

  const metaRows = [
    {
      label: isZh ? "当前实验" : "Experiment",
      value: currentSimulation?.name || t("simulationWorkspace.titleFallback"),
    },
    {
      label: isZh ? "当前路径" : "Path",
      value: currentPath.length
        ? currentPath.map((node) => getWorkspaceNodeLabel(node, t)).join(" / ")
        : "—",
    },
    {
      label: isZh ? "世界时间" : "World time",
      value: selectedNode?.worldTime || "—",
    },
    {
      label: isZh ? "行动空间" : "Action space",
      value: String(actionSpace || "—"),
    },
  ];

  return (
    <aside className="ss-analysis-panel" id="workspace-analysis">
      <div className="ss-analysis-panel__header">
        <div className="ss-kicker">{isZh ? "分析上下文" : "Analysis context"}</div>
        <h2>{isZh ? "分析面板" : "Analysis panel"}</h2>
        <p>
          {isZh
            ? "把分支、配置、日志与输出收进右侧。"
            : "Keep branch details, configuration, logs, and outputs in a focused side context."}
        </p>
      </div>

      <div className="ss-analysis-panel__body">
        <CollapsibleInsightSection
          title={isZh ? "分支详情" : "Branch details"}
          subtitle={isZh ? "默认关注当前节点与近邻分支" : "Keep the current node and nearby branches visible first."}
          badge={
            <span>
              {isZh ? "父" : "P"} {parentNode ? 1 : 0} / {isZh ? "兄" : "S"} {siblingNodes.length} / {isZh ? "子" : "C"}{" "}
              {childNodes.length}
            </span>
          }
          open={branchDetailsOpen}
          onToggle={onToggleBranchDetails}
          tone="details"
        >
          <div className="ss-analysis-panel__meta-grid">
            <div className="ss-analysis-panel__meta-chip">
              <span>{isZh ? "当前节点" : "Current"}</span>
              <strong>{getWorkspaceNodeLabel(selectedNode, t)}</strong>
            </div>
            <div className="ss-analysis-panel__meta-chip">
              <span>{isZh ? "对比分支" : "Compare"}</span>
              <strong>
                {compareTargetNodeId
                  ? getWorkspaceNodeLabel(nodes.find((node) => node.id === compareTargetNodeId) || null, t)
                  : isZh
                    ? "未选择"
                    : "None"}
              </strong>
            </div>
          </div>

          <div className="ss-analysis-panel__branch-group">
            <div className="ss-analysis-panel__branch-block">
              <div className="ss-analysis-panel__branch-label">{t("controlRoom.parentBranch")}</div>
              {parentNode ? (
                <button
                  type="button"
                  onClick={() => handleActivateNode(parentNode.id)}
                  className="ss-analysis-panel__branch-item"
                >
                  <strong>{getWorkspaceNodeLabel(parentNode, t)}</strong>
                  <span>{parentNode.display_id || parentNode.id}</span>
                </button>
              ) : (
                <div className="ss-analysis-panel__empty">{t("controlRoom.noParentBranch")}</div>
              )}
            </div>

            <div className="ss-analysis-panel__branch-block">
              <div className="ss-analysis-panel__branch-label">{t("controlRoom.siblingBranches")}</div>
              {siblingNodes.length ? (
                siblingNodes.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => handleActivateNode(node.id)}
                    className={`ss-analysis-panel__branch-item${node.id === compareTargetNodeId ? " is-compare" : ""}`}
                  >
                    <strong>{getWorkspaceNodeLabel(node, t)}</strong>
                    <span>{node.display_id || node.id}</span>
                  </button>
                ))
              ) : (
                <div className="ss-analysis-panel__empty">{t("controlRoom.noSiblingBranches")}</div>
              )}
            </div>

            <div className="ss-analysis-panel__branch-block">
              <div className="ss-analysis-panel__branch-label">{t("controlRoom.childBranches")}</div>
              {childNodes.length ? (
                childNodes.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => handleActivateNode(node.id)}
                    className="ss-analysis-panel__branch-item"
                  >
                    <strong>{getWorkspaceNodeLabel(node, t)}</strong>
                    <span>{node.display_id || node.id}</span>
                  </button>
                ))
              ) : (
                <div className="ss-analysis-panel__empty">{t("controlRoom.noChildBranches")}</div>
              )}
            </div>
          </div>
        </CollapsibleInsightSection>

        <CollapsibleInsightSection
          title={isZh ? "配置详情" : "Configuration"}
          subtitle={isZh ? "高频配置直接可达，深度配置仍走原有弹窗。" : "Keep frequent configuration one click away while preserving the existing modals."}
          defaultOpen
          tone="details"
        >
          <div className="ss-analysis-panel__provider">
            {llmProviders.length === 0 ? (
              <div className="ss-analysis-panel__empty">
                <div>
                  {isZh ? "当前还没有可用的 LLM 提供商，请先到设置里完成 provider 配置。" : "There is no available LLM provider yet. Configure a provider in Settings first."}
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/settings?tab=providers_llm")}
                  className="ss-button-secondary mt-3"
                >
                  {isZh ? "前往设置" : "Open settings"}
                </button>
              </div>
            ) : null}

            <label>
              <span>{t("simulationWorkspace.provider")}</span>
              <select
                value={providerSelection ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedProvider(value ? Number(value) : null);
                }}
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

            <button type="button" onClick={handleToggleEngine} className="ss-button-secondary">
              <Zap size={14} />
              {engineConfig.mode === "connected"
                ? t("simPage.socialSim4Engine")
                : t("simPage.standaloneMode")}
            </button>
          </div>

          <div className="ss-analysis-panel__tool-grid">
            <button type="button" onClick={() => toggleExperimentDesigner(true)} className="ss-analysis-panel__tool">
              <FileCog size={15} />
              <span>{t("simulationWorkspace.experiment")}</span>
            </button>
            <button type="button" onClick={() => toggleNetworkEditor(true)} className="ss-analysis-panel__tool">
              <Network size={15} />
              <span>{t("simulationWorkspace.network")}</span>
            </button>
            <button type="button" onClick={() => toggleTimeSettings(true)} className="ss-analysis-panel__tool">
              <Clock3 size={15} />
              <span>{t("simulationWorkspace.time")}</span>
            </button>
            <button type="button" onClick={() => setGlobalKnowledgeOpen(true)} className="ss-analysis-panel__tool">
              <Globe size={15} />
              <span>{t("simulationWorkspace.knowledge")}</span>
            </button>
            <button type="button" onClick={() => toggleAnalytics(true)} className="ss-analysis-panel__tool">
              <BarChart2 size={15} />
              <span>{t("simulationWorkspace.analytics")}</span>
            </button>
            <button type="button" onClick={onOpenRoleObservation} className="ss-analysis-panel__tool">
              <Rows3 size={15} />
              <span>{t("controlRoom.roleObservation")}</span>
            </button>
          </div>
        </CollapsibleInsightSection>

        <CollapsibleInsightSection
          title={isZh ? "世界规则与元数据" : "World rules and metadata"}
          subtitle={isZh ? "保留真实字段，只把它们收成更轻的摘要。" : "Keep the real fields and condense them into a lighter summary."}
          defaultOpen
          tone="metrics"
        >
          <div className="ss-analysis-panel__facts">
            {metaRows.map((row) => (
              <div key={row.label} className="ss-analysis-panel__fact">
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>

          <div className="ss-analysis-panel__metrics">
            <div className="ss-analysis-panel__metric">
              <span>{isZh ? "角色" : "Agents"}</span>
              <strong>{agents.length}</strong>
            </div>
            <div className="ss-analysis-panel__metric">
              <span>{isZh ? "日志" : "Logs"}</span>
              <strong>{logs.length}</strong>
            </div>
            <div className="ss-analysis-panel__metric">
              <span>{isZh ? "事件" : "Events"}</span>
              <strong>{rawEvents.length}</strong>
            </div>
            <div className="ss-analysis-panel__metric">
              <span>{isZh ? "模式" : "Mode"}</span>
              <strong>{isCompareMode ? t("simulationWorkspace.compare") : isZh ? "高级控制" : "Control"}</strong>
            </div>
          </div>
        </CollapsibleInsightSection>

        <CollapsibleInsightSection
          title={isZh ? "研究日志" : "Research logs"}
          subtitle={isZh ? "默认只看最近几条，避免日志直接吞掉右侧。" : "Show only the latest few entries so logs stop taking over the side panel."}
          tone="logs"
        >
          {recentLogs.length ? (
            <div className="ss-analysis-panel__log-list">
              {recentLogs.map((entry) => (
                <div key={entry.id} className="ss-analysis-panel__log-item">
                  <div className="ss-analysis-panel__log-meta">
                    <span>{entry.agentId || (isZh ? "系统" : "System")}</span>
                    <strong>{entry.round ? `R${entry.round}` : "—"}</strong>
                  </div>
                  <p>{entry.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="ss-analysis-panel__empty">
              {isZh ? "当前还没有研究日志，继续推演后这里会出现最近事件摘要。" : "No research logs yet. Continue the simulation to populate recent event summaries here."}
            </div>
          )}
        </CollapsibleInsightSection>

        <CollapsibleInsightSection
          title={isZh ? "导出与报告" : "Exports and reports"}
          subtitle={isZh ? "输出能力保留，但不再占据左侧主列。" : "Keep export capabilities without letting them occupy the main navigation column."}
          tone="outputs"
        >
          <OutputActionsPanel />

          <div className="ss-analysis-panel__tool-grid">
            <button type="button" onClick={() => onToggleBranchDetails()} className="ss-analysis-panel__tool">
              <GitFork size={15} />
              <span>{branchDetailsOpen ? t("controlRoom.hideBranchDetails") : t("controlRoom.showBranchDetails")}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (isCompareMode) {
                  toggleCompareMode(false);
                  setCompareTarget(null);
                  return;
                }
                toggleCompareMode(true);
              }}
              className="ss-analysis-panel__tool"
            >
              <Sparkles size={15} />
              <span>{isCompareMode ? t("simulationWorkspace.compareExit") : t("simulationWorkspace.compare")}</span>
            </button>
          </div>
        </CollapsibleInsightSection>
      </div>
    </aside>
  );
};

export default AnalysisContextPanel;
