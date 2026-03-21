import React from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpLeft, GitFork, Play } from "lucide-react";

import { useSimulationStore } from "../../store";
import type { SimNode } from "../../types";

const GENERIC_NODE_PATTERN = /^(Node \d+|节点 \d+)$/;

const getNodeLabel = (node: SimNode | null, t: (key: string, options?: any) => string) => {
  if (!node) return "—";
  if (node.depth === 0) return "Start";
  if (node.name && !GENERIC_NODE_PATTERN.test(node.name)) return node.name;
  return t("controlRoom.roundNodeLabel", { round: node.depth });
};

interface NodeWorkspacePanelProps {
  onRequestCreateBranch: () => void;
  onToggleBranchDetails: () => void;
  children: React.ReactNode;
}

export const NodeWorkspacePanel: React.FC<NodeWorkspacePanelProps> = ({
  onRequestCreateBranch,
  onToggleBranchDetails,
  children,
}) => {
  const { t } = useTranslation();
  const nodes = useSimulationStore((state) => state.nodes);
  const selectedNodeId = useSimulationStore((state) => state.selectedNodeId);
  const currentSimulation = useSimulationStore((state) => state.currentSimulation);
  const engineConfig = useSimulationStore((state) => state.engineConfig);
  const isCompareMode = useSimulationStore((state) => state.isCompareMode);
  const isGenerating = useSimulationStore((state) => state.isGenerating);
  const advanceSimulation = useSimulationStore((state) => state.advanceSimulation);
  const selectNode = useSimulationStore((state) => state.selectNode);

  const selectedNode = React.useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || nodes[0] || null,
    [nodes, selectedNodeId],
  );

  const nodeLookup = React.useMemo(
    () => new globalThis.Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );

  const parentNode = selectedNode?.parentId ? nodeLookup.get(selectedNode.parentId) || null : null;
  const childCount = React.useMemo(
    () => nodes.filter((node) => node.parentId === selectedNode?.id).length,
    [nodes, selectedNode?.id],
  );
  const siblingCount = React.useMemo(
    () =>
      selectedNode
        ? nodes.filter((node) => node.parentId === selectedNode.parentId && node.id !== selectedNode.id).length
        : 0,
    [nodes, selectedNode],
  );

  const currentPath = React.useMemo(() => {
    const ordered: SimNode[] = [];
    let current = selectedNode;
    while (current) {
      ordered.unshift(current);
      current = current.parentId ? nodeLookup.get(current.parentId) || null : null;
    }
    return ordered;
  }, [nodeLookup, selectedNode]);

  const pathLabel = currentPath.map((node) => getNodeLabel(node, t)).join(" / ");
  const selectedLabel = getNodeLabel(selectedNode, t);
  const sceneConfig = ((currentSimulation as any)?.scene_config || {}) as Record<string, any>;
  const scenarioSummary =
    sceneConfig.description ||
    sceneConfig.initial_event ||
    (currentSimulation as any)?.description ||
    t("simulationWorkspace.subtitleFallback");

  return (
    <section className="ss-node-workspace">
      <div className="ss-node-workspace__intro ss-workspace__panel">
        <div className="ss-node-workspace__intro-head">
          <div>
            <div className="ss-kicker">{t("controlRoom.workspaceKicker")}</div>
            <h2 className="ss-node-workspace__title">{selectedLabel}</h2>
            <p className="ss-node-workspace__copy">{t("controlRoom.workspaceSubtitle")}</p>
          </div>
          <div className="ss-node-workspace__badges">
            <span className="ss-pill ss-pill--active">{t("controlRoom.statusCurrent")}</span>
            <span className="ss-pill ss-pill--quiet">{t(`topologyExplorer.status.${selectedNode?.status || "pending"}`)}</span>
            {isCompareMode ? <span className="ss-pill ss-pill--quiet">{t("controlRoom.compareActive")}</span> : null}
          </div>
        </div>

        <div className="ss-node-workspace__summary-grid">
          <div className="ss-node-workspace__summary-card is-wide">
            <span>{t("controlRoom.currentPath")}</span>
            <strong>{pathLabel || "—"}</strong>
          </div>
          <div className="ss-node-workspace__summary-card">
            <span>{t("controlRoom.nodeIdLabel")}</span>
            <strong>{selectedNode?.display_id || selectedNode?.id || "—"}</strong>
          </div>
          <div className="ss-node-workspace__summary-card">
            <span>{t("simulationWorkspace.metrics.worldTime")}</span>
            <strong>{selectedNode?.worldTime || "—"}</strong>
          </div>
          <div className="ss-node-workspace__summary-card">
            <span>{t("simulationWorkspace.provider")}</span>
            <strong>{engineConfig.mode === "connected" ? t("simPage.socialSim4Engine") : t("simPage.standaloneMode")}</strong>
          </div>
        </div>

        <div className="ss-node-workspace__summary-grid">
          <div className="ss-node-workspace__summary-card">
            <span>{t("controlRoom.currentNodeConfiguration")}</span>
            <strong>{currentSimulation?.name || t("simulationWorkspace.titleFallback")}</strong>
            <p>{scenarioSummary}</p>
          </div>
          <div className="ss-node-workspace__summary-card">
            <span>{t("controlRoom.parentBranch")}</span>
            <strong>{parentNode ? getNodeLabel(parentNode, t) : t("common.none")}</strong>
            <p>{parentNode ? parentNode.display_id : t("controlRoom.noParentBranch")}</p>
          </div>
          <div className="ss-node-workspace__summary-card">
            <span>{t("controlRoom.branchRelations")}</span>
            <strong>
              {t("controlRoom.branchCountsInline", {
                parent: parentNode ? 1 : 0,
                siblings: siblingCount,
                children: childCount,
              })}
            </strong>
            <p>{t("controlRoom.branchRelationsHint")}</p>
          </div>
        </div>

        <div className="ss-node-workspace__action-row">
          <button
            onClick={() => void advanceSimulation()}
            disabled={!selectedNodeId || isGenerating || isCompareMode}
            className="ss-button"
          >
            <Play size={15} />
            {isGenerating ? t("simulationWorkspace.running") : t("controlRoom.continueSimulation")}
          </button>
          <button onClick={onRequestCreateBranch} disabled={!selectedNodeId || isGenerating || isCompareMode} className="ss-button-secondary">
            <GitFork size={15} />
            {t("controlRoom.createBranchPrimary")}
          </button>
          <button onClick={onToggleBranchDetails} className="ss-button-secondary">
            {t("controlRoom.viewDetails")}
          </button>
          <button
            onClick={() => parentNode && selectNode(parentNode.id)}
            disabled={!parentNode}
            className="ss-button-secondary"
          >
            <ArrowUpLeft size={15} />
            {t("controlRoom.returnToParentBranch")}
          </button>
        </div>

        <div className="ss-node-workspace__footnote">
          {t("controlRoom.selectedNodeHint", { name: selectedLabel })}
        </div>
      </div>

      <div className="ss-node-workspace__stage">{children}</div>
    </section>
  );
};

export default NodeWorkspacePanel;
