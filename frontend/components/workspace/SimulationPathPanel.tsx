import React from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowUpLeft,
  ChevronRight,
  GitFork,
  Layers3,
  MousePointer2,
  Rows3,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useSimulationStore } from "../../store";
import { buildBranchContextHref } from "../../utils/branchContext";
import type { SimNode } from "../../types";

const GENERIC_NODE_PATTERN = /^(Node \d+|节点 \d+)$/;

const sortNodes = (left: SimNode, right: SimNode) =>
  String(left.display_id || left.id).localeCompare(String(right.display_id || right.id), undefined, {
    numeric: true,
    sensitivity: "base",
  });

const getNodeLabel = (node: SimNode | null, t: (key: string, options?: any) => string) => {
  if (!node) return "—";
  if (node.depth === 0) return "Start";
  if (node.name && !GENERIC_NODE_PATTERN.test(node.name)) return node.name;
  return t("controlRoom.roundNodeLabel", { round: node.depth });
};

const CompactBranchItem: React.FC<{
  node: SimNode;
  isSelected: boolean;
  isCompare: boolean;
  childCount: number;
  onActivate: () => void;
}> = ({ node, isSelected, isCompare, childCount, onActivate }) => {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onActivate}
      className={[
        "ss-pathbar__detail-item",
        isSelected ? "is-selected" : "",
        isCompare ? "is-compare" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="ss-pathbar__detail-main">
        <strong>{getNodeLabel(node, t)}</strong>
        <span>{node.display_id || node.id}</span>
      </div>
      <div className="ss-pathbar__detail-meta">
        <span className="ss-pathbar__detail-status">{t(`topologyExplorer.status.${node.status}`)}</span>
        <span className="ss-pathbar__detail-count">{childCount}</span>
      </div>
    </button>
  );
};

interface SimulationPathPanelProps {
  detailsOpen: boolean;
  onToggleDetails: () => void;
  onRequestCreateBranch: () => void;
}

export const SimulationPathPanel: React.FC<SimulationPathPanelProps> = ({
  detailsOpen,
  onToggleDetails,
  onRequestCreateBranch,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentSimulation = useSimulationStore((state) => state.currentSimulation);
  const nodes = useSimulationStore((state) => state.nodes);
  const selectedNodeId = useSimulationStore((state) => state.selectedNodeId);
  const compareTargetNodeId = useSimulationStore((state) => state.compareTargetNodeId);
  const isCompareMode = useSimulationStore((state) => state.isCompareMode);
  const isGenerating = useSimulationStore((state) => state.isGenerating);
  const selectNode = useSimulationStore((state) => state.selectNode);
  const setCompareTarget = useSimulationStore((state) => state.setCompareTarget);
  const toggleCompareMode = useSimulationStore((state) => state.toggleCompareMode);

  const nodeLookup = React.useMemo(
    () => new globalThis.Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );

  const selectedNode = React.useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || nodes[0] || null,
    [nodes, selectedNodeId],
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

  const parentNode = selectedNode?.parentId ? nodeLookup.get(selectedNode.parentId) || null : null;

  const siblingNodes = React.useMemo(() => {
    if (!selectedNode) return [];
    return nodes
      .filter((node) => node.parentId === selectedNode.parentId && node.id !== selectedNode.id)
      .sort(sortNodes);
  }, [nodes, selectedNode]);

  const childNodes = React.useMemo(() => {
    if (!selectedNode) return [];
    return nodes.filter((node) => node.parentId === selectedNode.id).sort(sortNodes);
  }, [nodes, selectedNode]);

  const countChildren = React.useCallback(
    (nodeId: string) => nodes.filter((node) => node.parentId === nodeId).length,
    [nodes],
  );

  const handleToggleCompare = () => {
    if (isCompareMode) {
      toggleCompareMode(false);
      setCompareTarget(null);
      return;
    }
    toggleCompareMode(true);
  };

  const handleActivateNode = (nodeId: string) => {
    if (isCompareMode && nodeId !== selectedNodeId) {
      setCompareTarget(nodeId);
      return;
    }
    selectNode(nodeId);
  };

  const handleOpenTopology = () => {
    if (!currentSimulation?.id) return;
    navigate(
      buildBranchContextHref(
        `/simulations/${currentSimulation.id}/topology`,
        selectedNodeId,
        isCompareMode ? compareTargetNodeId : null,
      ),
    );
  };

  return (
    <div className="ss-pathbar">
      <div className="ss-workspace__panel ss-pathbar__header">
        <div className="ss-pathbar__head">
          <div>
            <div className="ss-kicker">{t("controlRoom.pathManagerTitle")}</div>
            <h2 className="ss-pathbar__title">{t("controlRoom.pathManagerHeading")}</h2>
            <p className="ss-pathbar__copy">{t("controlRoom.pathManagerSubtitle")}</p>
          </div>

          <div className="ss-pathbar__toolbar">
            <button
              type="button"
              onClick={() => parentNode && selectNode(parentNode.id)}
              disabled={!parentNode}
              className="ss-button-secondary"
            >
              <ArrowUpLeft size={15} />
              {t("controlRoom.returnToParentBranch")}
            </button>
            <button
              type="button"
              onClick={onToggleDetails}
              className={`ss-button-secondary ${detailsOpen ? "is-active" : ""}`}
            >
              <Rows3 size={15} />
              {detailsOpen ? t("controlRoom.hideBranchDetails") : t("controlRoom.showSiblingBranches")}
            </button>
            <button type="button" onClick={handleOpenTopology} className="ss-button-secondary">
              <Layers3 size={15} />
              {t("controlRoom.openFullBranchMap")}
            </button>
            <button
              type="button"
              onClick={handleToggleCompare}
              disabled={!selectedNode}
              className={`ss-button-secondary ${isCompareMode ? "is-active" : ""}`}
            >
              <MousePointer2 size={15} />
              {isCompareMode ? t("simulationWorkspace.compareExit") : t("simulationWorkspace.compare")}
            </button>
          </div>
        </div>

        <div className="ss-pathbar__rail" role="navigation" aria-label={t("controlRoom.currentPath")}>
          {currentPath.map((node, index) => {
            const childCount = countChildren(node.id);
            const isSelected = node.id === selectedNodeId;

            return (
              <React.Fragment key={node.id}>
                <button
                  type="button"
                  onClick={() => handleActivateNode(node.id)}
                  className={`ss-pathbar__node ${isSelected ? "is-selected" : ""}`}
                >
                  <div className="ss-pathbar__node-main">
                    <strong>{getNodeLabel(node, t)}</strong>
                    <span>{node.display_id || node.id}</span>
                  </div>
                  <div className="ss-pathbar__node-meta">
                    <span className="ss-pathbar__status">{t(`topologyExplorer.status.${node.status}`)}</span>
                    <span className="ss-pathbar__count">{childCount}</span>
                  </div>
                </button>
                {index < currentPath.length - 1 ? (
                  <ChevronRight size={14} className="ss-pathbar__separator" aria-hidden />
                ) : null}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {detailsOpen ? (
        <div className="ss-workspace__panel ss-pathbar__details">
          <div className="ss-pathbar__details-grid">
            <section className="ss-pathbar__details-section">
              <div className="ss-pathbar__details-head">
                <div className="ss-pathbar__details-title">{t("controlRoom.parentBranch")}</div>
                <span>{parentNode ? 1 : 0}</span>
              </div>

              {parentNode ? (
                <CompactBranchItem
                  node={parentNode}
                  isSelected={parentNode.id === selectedNodeId}
                  isCompare={parentNode.id === compareTargetNodeId}
                  childCount={countChildren(parentNode.id)}
                  onActivate={() => handleActivateNode(parentNode.id)}
                />
              ) : (
                <div className="ss-pathbar__empty">{t("controlRoom.noParentBranch")}</div>
              )}
            </section>

            <section className="ss-pathbar__details-section">
              <div className="ss-pathbar__details-head">
                <div className="ss-pathbar__details-title">{t("controlRoom.siblingBranches")}</div>
                <span>{siblingNodes.length}</span>
              </div>

              {siblingNodes.length > 0 ? (
                <div className="ss-pathbar__detail-list">
                  {siblingNodes.map((node) => (
                    <CompactBranchItem
                      key={node.id}
                      node={node}
                      isSelected={node.id === selectedNodeId}
                      isCompare={node.id === compareTargetNodeId}
                      childCount={countChildren(node.id)}
                      onActivate={() => handleActivateNode(node.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="ss-pathbar__empty">{t("controlRoom.noSiblingBranches")}</div>
              )}
            </section>

            <section className="ss-pathbar__details-section">
              <div className="ss-pathbar__details-head">
                <div className="ss-pathbar__details-title">{t("controlRoom.childBranches")}</div>
                <span>{childNodes.length}</span>
              </div>

              {childNodes.length > 0 ? (
                <div className="ss-pathbar__detail-list">
                  {childNodes.map((node) => (
                    <CompactBranchItem
                      key={node.id}
                      node={node}
                      isSelected={node.id === selectedNodeId}
                      isCompare={node.id === compareTargetNodeId}
                      childCount={countChildren(node.id)}
                      onActivate={() => handleActivateNode(node.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="ss-pathbar__empty ss-pathbar__empty--action">
                  <div>
                    <strong>{t("controlRoom.noChildBranchesTitle")}</strong>
                    <p>{t("controlRoom.noChildBranchesCopy")}</p>
                  </div>
                  <button
                    type="button"
                    onClick={onRequestCreateBranch}
                    disabled={!selectedNode || isGenerating || isCompareMode}
                    className="ss-button"
                  >
                    <GitFork size={15} />
                    {t("controlRoom.createChildBranch")}
                  </button>
                  <div className="ss-pathbar__empty-note">{t("controlRoom.branchSafeHint")}</div>
                </div>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SimulationPathPanel;
