import React from "react";
import { BarChart2, ChevronRight, Clock3, FileText, Globe, PauseCircle, Save, Settings2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useSimulationStore } from "../../store";
import { buildWorkspacePath, getWorkspaceNodeLabel } from "./workspaceLabels";
import { CollapsibleInsightSection } from "./CollapsibleInsightSection";

interface SimulationSummaryRailProps {
  onOpenLogs: () => void;
  onHide: () => void;
}

export const SimulationSummaryRail: React.FC<SimulationSummaryRailProps> = ({ onOpenLogs, onHide }) => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");
  const navigate = useNavigate();
  const currentSimulation = useSimulationStore((state) => state.currentSimulation);
  const nodes = useSimulationStore((state) => state.nodes);
  const logs = useSimulationStore((state) => state.logs);
  const rawEvents = useSimulationStore((state) => state.rawEvents);
  const agents = useSimulationStore((state) => state.agents);
  const selectedNodeId = useSimulationStore((state) => state.selectedNodeId);
  const selectedProviderId = useSimulationStore((state) => state.selectedProviderId);
  const currentProviderId = useSimulationStore((state) => state.currentProviderId);
  const llmProviders = useSimulationStore((state) => state.llmProviders);
  const engineConfig = useSimulationStore((state) => state.engineConfig);
  const toggleTimeSettings = useSimulationStore((state) => state.toggleTimeSettings);
  const toggleReportModal = useSimulationStore((state) => state.toggleReportModal);
  const toggleExport = useSimulationStore((state) => state.toggleExport);
  const toggleSaveTemplate = useSimulationStore((state) => state.toggleSaveTemplate);

  const selectedNode = React.useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || nodes[0] || null,
    [nodes, selectedNodeId],
  );
  const nodeLookup = React.useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );
  const currentPath = React.useMemo(
    () => buildWorkspacePath(selectedNode, nodeLookup),
    [nodeLookup, selectedNode],
  );

  const providerSelection = selectedProviderId ?? currentProviderId ?? null;
  const selectedProvider =
    llmProviders.find((provider) => provider.id === providerSelection) || null;
  const sceneConfig = (currentSimulation?.scene_config ?? {}) as Record<string, any>;
  const selectedNodeLogCount = logs.filter((entry) => entry.nodeId === selectedNodeId).length;
  const xihuMaterials = Array.isArray(sceneConfig.xihu_material_refs) ? sceneConfig.xihu_material_refs : [];
  const xihuBenchmarks = (sceneConfig.xihu_benchmarks?.metrics ?? {}) as Record<
    string,
    { label: string; mean: number; count: number }
  >;
  const xihuBenchmarkEntries = Object.values(xihuBenchmarks).slice(0, 6);

  const summaryFacts = [
    {
      label: isZh ? "世界模型" : "World model",
      value: sceneConfig.name || sceneConfig.scene_type || currentSimulation?.name || "—",
    },
    {
      label: isZh ? "推理模型" : "Reasoning model",
      value: selectedProvider
        ? `${selectedProvider.name || selectedProvider.provider}${selectedProvider.model ? ` · ${selectedProvider.model}` : ""}`
        : t("simulationWorkspace.noProvider"),
    },
    {
      label: isZh ? "模式" : "Mode",
      value: engineConfig.mode === "connected" ? t("simPage.socialSim4Engine") : t("simPage.standaloneMode"),
    },
    {
      label: isZh ? "当前轮次" : "Current round",
      value: selectedNode?.depth != null ? String(selectedNode.depth) : "0",
    },
    {
      label: isZh ? "时间戳" : "Timestamp",
      value: selectedNode?.worldTime || "—",
    },
    {
      label: isZh ? "当前主分支" : "Primary branch",
      value: selectedNode?.display_id || selectedNode?.id || "—",
    },
  ];

  const worldRules = [
    {
      label: isZh ? "世界观摘要" : "World summary",
      value: sceneConfig.description || sceneConfig.initial_event || (isZh ? "当前实验尚未写入世界摘要。" : "No world summary yet."),
    },
    {
      label: isZh ? "核心约束" : "Core constraints",
      value: sceneConfig.constraints || sceneConfig.rules || (isZh ? "默认遵循当前场景设定与参与者行为空间。" : "The current scene setup and agent action space define the active constraints."),
    },
    {
      label: isZh ? "实验目标" : "Experiment goal",
      value: sceneConfig.goal || sceneConfig.objective || currentSimulation?.description || (isZh ? "围绕当前场景观察分支、节点和参与者变化。" : "Observe how branches, nodes, and agents evolve inside the current scene."),
    },
    {
      label: isZh ? "终止条件" : "Termination",
      value: sceneConfig.termination || sceneConfig.stop_condition || (isZh ? "达到最大轮次或场景完成条件后结束。" : "The run ends when the max turns or scene completion criteria are reached."),
    },
  ];

  const metrics = [
    { label: isZh ? "分支数量" : "Branches", value: Math.max(nodes.length - 1, 0) },
    { label: isZh ? "节点数量" : "Nodes", value: nodes.length },
    { label: isZh ? "参与者数" : "Agents", value: agents.length },
    { label: isZh ? "当前事件数" : "Current events", value: selectedNodeLogCount },
    { label: isZh ? "日志数" : "Logs", value: logs.length },
    { label: isZh ? "原始事件" : "Raw events", value: rawEvents.length },
  ];

  return (
    <aside className="ss-summary-rail" id="workspace-summary">
      <div className="ss-summary-rail__header">
        <div>
          <div className="ss-kicker">{isZh ? "状态摘要" : "Status summary"}</div>
          <h2>{isZh ? "右侧摘要栏" : "Summary rail"}</h2>
          <p>
            {isZh
              ? "只保留最关键配置与操作入口。"
              : "Keep only configuration, rules, metrics, and action shortcuts on the right side."}
          </p>
        </div>
        <button
          type="button"
          className="ss-icon-button"
          onClick={onHide}
          title={isZh ? "收起右侧摘要" : "Hide summary rail"}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="ss-summary-rail__body">
        <CollapsibleInsightSection
          title={isZh ? "实验配置摘要" : "Simulation configuration"}
          subtitle={currentPath.length ? currentPath.map((node) => getWorkspaceNodeLabel(node, t)).join(" / ") : "—"}
          defaultOpen={false}
          tone="details"
        >
          <div className="ss-summary-rail__fact-grid">
            {summaryFacts.map((fact) => (
              <div key={fact.label} className="ss-summary-rail__fact">
                <span>{fact.label}</span>
                <strong>{fact.value}</strong>
              </div>
            ))}
          </div>
        </CollapsibleInsightSection>

        <CollapsibleInsightSection
          title={isZh ? "世界规则 / 元配置" : "World rules"}
          subtitle={isZh ? "只在需要时展开查看。" : "Expand only when needed."}
          defaultOpen={false}
          tone="details"
        >
          <div className="ss-summary-rail__rule-list">
            {worldRules.map((rule) => (
              <div key={rule.label} className="ss-summary-rail__rule">
                <span>{rule.label}</span>
                <p>{rule.value}</p>
              </div>
            ))}
          </div>
        </CollapsibleInsightSection>

        {sceneConfig.xihu_arm_id ? (
          <CollapsibleInsightSection
            title={isZh ? "西湖实验臂" : "Xihu intervention arm"}
            subtitle={sceneConfig.xihu_arm_label || sceneConfig.xihu_arm_id}
            defaultOpen={false}
            tone="details"
          >
            <div className="ss-summary-rail__rule-list">
              <div className="ss-summary-rail__rule">
                <span>{isZh ? "材料框架" : "Arm framing"}</span>
                <p>{sceneConfig.xihu_arm_summary || "—"}</p>
              </div>
              <div className="ss-summary-rail__rule">
                <span>{isZh ? "导入包" : "Imported package"}</span>
                <p>{sceneConfig.xihu_package_title || sceneConfig.xihu_package_id || "—"}</p>
              </div>
            </div>

            {xihuMaterials.length ? (
              <div className="ss-summary-rail__rule-list">
                {xihuMaterials.map((material: any) => (
                  <div key={material.id} className="ss-summary-rail__rule">
                    <span>{material.kindLabel || material.kind}</span>
                    <p>{material.displayTitle}</p>
                    <p>{material.textSummary}</p>
                    {material.downloadUrl ? (
                      <a
                        href={material.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                      >
                        {isZh ? "打开原始材料" : "Open source file"}
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {xihuBenchmarkEntries.length ? (
              <div className="ss-summary-rail__metric-grid">
                {xihuBenchmarkEntries.map((metric) => (
                  <div key={metric.label} className="ss-summary-rail__metric">
                    <span>{metric.label}</span>
                    <strong>{metric.mean}</strong>
                  </div>
                ))}
              </div>
            ) : null}
          </CollapsibleInsightSection>
        ) : null}

        <CollapsibleInsightSection
          title={isZh ? "系统指标" : "System metrics"}
          subtitle={isZh ? "保留关键数字，其余默认收起。" : "Keep the key numbers collapsed by default."}
          defaultOpen={false}
          tone="metrics"
        >
          <div className="ss-summary-rail__metric-grid">
            {metrics.map((metric) => (
              <div key={metric.label} className="ss-summary-rail__metric">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>
        </CollapsibleInsightSection>

        <CollapsibleInsightSection
          title={isZh ? "操作区" : "Actions"}
          subtitle={isZh ? "保留必要快捷入口。" : "Keep only the most useful shortcuts."}
          defaultOpen={false}
          tone="outputs"
        >
          <div className="ss-summary-rail__action-grid">
            <button type="button" className="ss-summary-rail__action" onClick={() => toggleSaveTemplate(true)}>
              <Save size={15} />
              <span>{isZh ? "保存模板" : "Save template"}</span>
            </button>
            <button type="button" className="ss-summary-rail__action" onClick={() => toggleTimeSettings(true)}>
              <Clock3 size={15} />
              <span>{isZh ? "时间设置" : "Time settings"}</span>
            </button>
            <button type="button" className="ss-summary-rail__action" onClick={() => toggleReportModal(true)}>
              <FileText size={15} />
              <span>{isZh ? "导出报告" : "Open report"}</span>
            </button>
            <button type="button" className="ss-summary-rail__action" onClick={() => toggleExport(true)}>
              <BarChart2 size={15} />
              <span>{isZh ? "导出结果" : "Export results"}</span>
            </button>
            <button type="button" className="ss-summary-rail__action" onClick={onOpenLogs}>
              <Globe size={15} />
              <span>{isZh ? "打开研究日志" : "Open research logs"}</span>
            </button>
            <button type="button" className="ss-summary-rail__action is-danger" onClick={() => navigate("/settings")}>
              <Settings2 size={15} />
              <span>{isZh ? "系统设置" : "Settings"}</span>
            </button>
          </div>

          <div className="ss-summary-rail__pause-note">
            <PauseCircle size={15} />
            <span>
              {isZh
                ? "暂停 / 终止逻辑仍保留在系统设置与后续实验控制中，这里先保留当前稳定能力。"
                : "Pause or halt controls remain in the broader experiment controls while this rail stays focused on the stable actions available today."}
            </span>
          </div>
        </CollapsibleInsightSection>
      </div>
    </aside>
  );
};

export default SimulationSummaryRail;
