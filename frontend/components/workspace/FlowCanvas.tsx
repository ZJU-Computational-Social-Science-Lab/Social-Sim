import React from "react";
import { GitBranchPlus, Lock, Radio, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useSimulationStore } from "../../store";
import type { SimNode } from "../../types";
import { buildWorkspacePath, getWorkspaceNodeLabel } from "./workspaceLabels";

interface FlowCanvasProps {
  onOpenDetails: () => void;
  onOpenTopology: () => void;
}

const compareNodes = (left: SimNode, right: SimNode) =>
  String(left.display_id || left.id).localeCompare(String(right.display_id || right.id), undefined, {
    numeric: true,
    sensitivity: "base",
  });

const summarizeNode = (
  node: SimNode,
  latestContent: string | null,
  isZh: boolean,
) => {
  if (latestContent) {
    return latestContent.replace(/\s+/g, " ").trim().slice(0, 120);
  }
  if (node.depth === 0) {
    return isZh ? "仿真从这里启动，建立基础状态与参与者初始上下文。" : "The simulation starts here with the base state and initial participant context.";
  }
  if (node.status === "pending") {
    return isZh ? "该节点等待当前路径推进后解锁。" : "This node remains locked until the current path advances.";
  }
  if (node.status === "running") {
    return isZh ? "当前节点正在推演中，新的事件与分支即将写入。" : "This node is currently simulating and new events are about to be written.";
  }
  if (node.status === "failed") {
    return isZh ? "该节点已中断，需要回到父分支查看约束。" : "This node was interrupted and may require revisiting the parent branch.";
  }
  return isZh ? "该节点已完成，可在下方查看输出、日志与分支结果。" : "This node has completed. Review its outputs, logs, and branch results below.";
};

const getNodeTypeLabel = (
  node: SimNode,
  childCount: number,
  isZh: boolean,
) => {
  if (node.depth === 0) return isZh ? "起始" : "Start";
  if (childCount > 1) return isZh ? "分支" : "Branch";
  if (node.isLeaf && node.status === "completed") return isZh ? "结果" : "Outcome";
  return isZh ? "决策" : "Decision";
};

export const FlowCanvas: React.FC<FlowCanvasProps> = ({ onOpenDetails, onOpenTopology }) => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");
  const nodes = useSimulationStore((state) => state.nodes);
  const logs = useSimulationStore((state) => state.logs);
  const selectedNodeId = useSimulationStore((state) => state.selectedNodeId);
  const compareTargetNodeId = useSimulationStore((state) => state.compareTargetNodeId);
  const isCompareMode = useSimulationStore((state) => state.isCompareMode);
  const selectNode = useSimulationStore((state) => state.selectNode);
  const setCompareTarget = useSimulationStore((state) => state.setCompareTarget);

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

  const childMap = React.useMemo(() => {
    const map = new Map<string | null, SimNode[]>();
    nodes.forEach((node) => {
      const key = node.parentId;
      const current = map.get(key) || [];
      current.push(node);
      current.sort(compareNodes);
      map.set(key, current);
    });
    return map;
  }, [nodes]);

  const latestByNode = React.useMemo(() => {
    const map = new Map<string, string>();
    for (let index = logs.length - 1; index >= 0; index -= 1) {
      const entry = logs[index];
      if (!map.has(entry.nodeId)) {
        map.set(entry.nodeId, entry.content);
      }
    }
    return map;
  }, [logs]);

  const selectedSiblings = React.useMemo(() => {
    if (!selectedNode) return [];
    return (childMap.get(selectedNode.parentId) || [])
      .filter((node) => node.id !== selectedNode.id)
      .sort(compareNodes);
  }, [childMap, selectedNode]);

  const selectedChildren = React.useMemo(
    () => (selectedNode ? (childMap.get(selectedNode.id) || []).sort(compareNodes) : []),
    [childMap, selectedNode],
  );

<<<<<<< Updated upstream
=======
  const handleActivateNode = (nodeId: string) => {
    if (isCompareMode && nodeId !== selectedNodeId) {
      setCompareTarget(nodeId);
      return;
    }
    selectNode(nodeId);
  };

>>>>>>> Stashed changes
  return (
    <section className="ss-flow-canvas" id="workspace-flow">
      <div className="ss-flow-canvas__header">
        <div>
          <div className="ss-kicker">{isZh ? "仿真流程" : "Simulation flow"}</div>
          <h2>{isZh ? "决策链与分支路径主舞台" : "Decision chain and branch pathway"}</h2>
          <p>
            {isZh
              ? "中央主舞台只负责流程、节点与分支，不再被长文本和配置卡抢走焦点。"
              : "Keep the central stage focused on flow, nodes, and branches rather than long text or dense configuration blocks."}
          </p>
        </div>

        <div className="ss-flow-canvas__stats">
          <span className="ss-flow-canvas__stat">
            <Radio size={14} />
            {isZh ? `节点 ${nodes.length}` : `${nodes.length} nodes`}
          </span>
          <span className="ss-flow-canvas__stat">
            <GitBranchPlus size={14} />
            {isZh ? `分支 ${Math.max(nodes.length - 1, 0)}` : `${Math.max(nodes.length - 1, 0)} branches`}
          </span>
          <button type="button" className="ss-flow-canvas__stat is-action" onClick={onOpenDetails}>
            <Sparkles size={14} />
            {isZh ? "查看当前节点详情" : "Open node details"}
          </button>
          <button type="button" className="ss-flow-canvas__stat is-action" onClick={onOpenTopology}>
            <GitBranchPlus size={14} />
            {isZh ? "打开完整拓扑结构" : "Open full topology"}
          </button>
        </div>
      </div>

      <div className="ss-flow-canvas__track">
        {currentPath.map((node, index) => {
          const nextPathNode = currentPath[index + 1] || null;
          const alternatives = (childMap.get(node.id) || []).filter((child) => child.id !== nextPathNode?.id);
          const childCount = (childMap.get(node.id) || []).length;
          const nodeType = getNodeTypeLabel(node, childCount, isZh);
          const summary = summarizeNode(node, latestByNode.get(node.id) || null, isZh);
          const isCurrent = node.id === selectedNodeId;
          const isCompare = compareTargetNodeId === node.id;

          return (
            <div key={node.id} className="ss-flow-canvas__step">
              <div className="ss-flow-canvas__rail">
                <span className={`ss-flow-canvas__dot${isCurrent ? " is-current" : ""}${isCompare ? " is-compare" : ""}`}>
                  {node.status === "pending" ? <Lock size={14} /> : <span />}
                </span>
                {index < currentPath.length - 1 ? <span className="ss-flow-canvas__line" /> : null}
              </div>

              <div className="ss-flow-canvas__step-main">
                <button
                  type="button"
<<<<<<< Updated upstream
                  onClick={() => selectNode(node.id)}
=======
                  onClick={() => handleActivateNode(node.id)}
>>>>>>> Stashed changes
                  className={`ss-flow-node${isCurrent ? " is-current" : ""}${node.status === "pending" ? " is-locked" : ""}${isCompare ? " is-compare" : ""}`}
                >
                  <div className="ss-flow-node__top">
                    <div>
                      <span className="ss-flow-node__type">{nodeType}</span>
                      <h3>{getWorkspaceNodeLabel(node, t)}</h3>
                    </div>
                    <div className="ss-flow-node__badges">
                      <span className={`ss-flow-node__status is-${node.status}`}>
                        {isCurrent ? (isZh ? "当前" : "Current") : t(`topologyExplorer.status.${node.status}`)}
                      </span>
                      <span className="ss-flow-node__display-id">{node.display_id || node.id}</span>
                    </div>
                  </div>
                  <p>{summary}</p>
                </button>

                {alternatives.length ? (
                  <div className="ss-flow-canvas__branch-strip">
                    <span className="ss-flow-canvas__branch-label">{isZh ? "已产生分支" : "Available branches"}</span>
                    <div className="ss-flow-canvas__branch-grid">
                      {alternatives.map((branch) => (
                        <button
                          key={branch.id}
                          type="button"
<<<<<<< Updated upstream
                          onClick={() => {
                            if (isCompareMode && branch.id !== selectedNodeId) {
                              setCompareTarget(branch.id);
                              return;
                            }
                            selectNode(branch.id);
                          }}
=======
                          onClick={() => handleActivateNode(branch.id)}
>>>>>>> Stashed changes
                          className={`ss-flow-branch${compareTargetNodeId === branch.id ? " is-compare" : ""}${branch.status === "pending" ? " is-pending" : ""}`}
                        >
                          <strong>{getWorkspaceNodeLabel(branch, t)}</strong>
                          <span>{summarizeNode(branch, latestByNode.get(branch.id) || null, isZh)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {selectedSiblings.length || selectedChildren.length ? (
        <div className="ss-flow-canvas__nearby">
          {selectedSiblings.length ? (
            <div className="ss-flow-canvas__nearby-block">
              <span>{isZh ? "当前节点的并行分支" : "Sibling branches"}</span>
              <div className="ss-flow-canvas__branch-grid">
                {selectedSiblings.map((node) => (
<<<<<<< Updated upstream
                  <button key={node.id} type="button" onClick={() => selectNode(node.id)} className="ss-flow-branch">
=======
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => handleActivateNode(node.id)}
                    className={`ss-flow-branch${compareTargetNodeId === node.id ? " is-compare" : ""}${node.status === "pending" ? " is-pending" : ""}`}
                  >
>>>>>>> Stashed changes
                    <strong>{getWorkspaceNodeLabel(node, t)}</strong>
                    <span>{summarizeNode(node, latestByNode.get(node.id) || null, isZh)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {selectedChildren.length ? (
            <div className="ss-flow-canvas__nearby-block">
              <span>{isZh ? "当前节点展开后的下一层" : "Next layer after this node"}</span>
              <div className="ss-flow-canvas__branch-grid">
                {selectedChildren.map((node) => (
<<<<<<< Updated upstream
                  <button key={node.id} type="button" onClick={() => selectNode(node.id)} className="ss-flow-branch">
=======
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => handleActivateNode(node.id)}
                    className={`ss-flow-branch${compareTargetNodeId === node.id ? " is-compare" : ""}${node.status === "pending" ? " is-pending" : ""}`}
                  >
>>>>>>> Stashed changes
                    <strong>{getWorkspaceNodeLabel(node, t)}</strong>
                    <span>{summarizeNode(node, latestByNode.get(node.id) || null, isZh)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};

export default FlowCanvas;
