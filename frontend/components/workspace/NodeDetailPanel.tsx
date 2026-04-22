import React from "react";
import { BookOpenText, FileCode2, GitBranchPlus, ScrollText } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ComparisonView } from "../ComparisonView";
import { LogViewer } from "../LogViewer";
import { useSimulationStore } from "../../store";
<<<<<<< Updated upstream
=======
import { resolveAgentDisplayName } from "../../store/helpers";
>>>>>>> Stashed changes
import { buildWorkspacePath, getWorkspaceNodeLabel } from "./workspaceLabels";

export type NodeDetailTab = "events" | "branches" | "logs" | "raw";

interface NodeDetailPanelProps {
  activeTab: NodeDetailTab;
  onChangeTab: (tab: NodeDetailTab) => void;
  selectedAgentId: string | null;
  onClearSelectedAgent: () => void;
}

const DETAIL_TABS = [
  { id: "events", icon: ScrollText },
  { id: "branches", icon: GitBranchPlus },
  { id: "logs", icon: BookOpenText },
  { id: "raw", icon: FileCode2 },
] as const;

export const NodeDetailPanel: React.FC<NodeDetailPanelProps> = ({
  activeTab,
  onChangeTab,
  selectedAgentId,
  onClearSelectedAgent,
}) => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");
  const nodes = useSimulationStore((state) => state.nodes);
  const logs = useSimulationStore((state) => state.logs);
  const rawEvents = useSimulationStore((state) => state.rawEvents);
  const selectedNodeId = useSimulationStore((state) => state.selectedNodeId);
<<<<<<< Updated upstream
  const isCompareMode = useSimulationStore((state) => state.isCompareMode);
  const selectNode = useSimulationStore((state) => state.selectNode);
=======
  const compareTargetNodeId = useSimulationStore((state) => state.compareTargetNodeId);
  const isCompareMode = useSimulationStore((state) => state.isCompareMode);
  const isGenerating = useSimulationStore((state) => state.isGenerating);
  const selectNode = useSimulationStore((state) => state.selectNode);
  const setCompareTarget = useSimulationStore((state) => state.setCompareTarget);
  const agents = useSimulationStore((state) => state.agents);
>>>>>>> Stashed changes

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
  const selectedNodeLogs = React.useMemo(
    () => logs.filter((entry) => entry.nodeId === selectedNodeId).slice().reverse(),
    [logs, selectedNodeId],
  );

  const selectedNodeRawEvents = React.useMemo(() => {
    return rawEvents.filter((event: any) => String(event?.node_id ?? event?.nodeId ?? selectedNodeId) === selectedNodeId);
  }, [rawEvents, selectedNodeId]);

  const tabLabel = React.useCallback(
    (tab: NodeDetailTab) => {
      if (tab === "events") return isZh ? "事件内容" : "Events";
      if (tab === "branches") return isZh ? "分支说明" : "Branches";
      if (tab === "logs") return isZh ? "研究日志" : "Logs";
      return isZh ? "原始内容" : "Raw";
    },
    [isZh],
  );

<<<<<<< Updated upstream
  return (
    <section className="ss-node-detail" id="workspace-detail">
      <div className="ss-node-detail__header">
        <div>
          <div className="ss-kicker">{isZh ? "当前节点详情" : "Current node detail"}</div>
          <h2>{selectedNode ? getWorkspaceNodeLabel(selectedNode, t) : (isZh ? "未选择节点" : "No node selected")}</h2>
          <p>
            {isZh
              ? "详情区只围绕当前选中节点展开，事件、日志和分支说明在这里切换。"
              : "Keep the detail stage focused on the selected node and switch between events, logs, and branch explanations here."}
          </p>
        </div>

=======
  const handleActivateNode = (nodeId: string) => {
    if (isCompareMode && nodeId !== selectedNodeId) {
      setCompareTarget(nodeId);
      return;
    }
    selectNode(nodeId);
  };

  const runStatus = isGenerating
    ? t("simulationWorkspace.running")
    : t(`topologyExplorer.status.${selectedNode?.status || "pending"}`);
  const roundLabel = selectedNode?.depth != null && selectedNode.depth > 0
    ? `${isZh ? "第" : ""}${selectedNode.depth}${isZh ? "轮" : ""}`
    : isZh ? "初始设定" : "Start";

  return (
    <section className="ss-node-detail" id="workspace-detail">
      <div className="ss-node-detail__header">
>>>>>>> Stashed changes
        <div className="ss-node-detail__tabs">
          {DETAIL_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangeTab(tab.id)}
                className={`ss-node-detail__tab${activeTab === tab.id ? " is-active" : ""}`}
              >
                <Icon size={14} />
                <span>{tabLabel(tab.id)}</span>
              </button>
            );
          })}
        </div>
<<<<<<< Updated upstream
=======

        <div className="ss-node-detail__meta-strip">
          <div className="ss-node-detail__meta-item">
            <span>{isZh ? "轮次" : "Round"}</span>
            <strong>{roundLabel}</strong>
          </div>
          <div className="ss-node-detail__meta-item">
            <span>{isZh ? "状态" : "Status"}</span>
            <strong>{runStatus}</strong>
          </div>
          <div className="ss-node-detail__meta-item">
            <span>{isZh ? "节点" : "Node"}</span>
            <strong>{getWorkspaceNodeLabel(selectedNode, t)}</strong>
          </div>
        </div>
>>>>>>> Stashed changes
      </div>

      <div className="ss-node-detail__body">
        {activeTab === "events" ? (
          isCompareMode ? (
            <ComparisonView />
          ) : (
            <LogViewer selectedAgentId={selectedAgentId} onClearSelectedAgent={onClearSelectedAgent} />
          )
        ) : null}

        {activeTab === "branches" ? (
          <div className="ss-node-detail__grid">
            <div className="ss-node-detail__card">
              <span>{isZh ? "当前路径" : "Current path"}</span>
              <strong>
                {currentPath.length
                  ? currentPath.map((node) => getWorkspaceNodeLabel(node, t)).join(" / ")
                  : "—"}
              </strong>
            </div>
            <div className="ss-node-detail__card">
              <span>{isZh ? "父分支" : "Parent branch"}</span>
              <strong>{parentNode ? getWorkspaceNodeLabel(parentNode, t) : (isZh ? "无父分支" : "No parent branch")}</strong>
            </div>
            <div className="ss-node-detail__card">
              <span>{isZh ? "并行分支" : "Sibling branches"}</span>
              <strong>{String(siblingNodes.length)}</strong>
            </div>
            <div className="ss-node-detail__card">
              <span>{isZh ? "后续节点" : "Child nodes"}</span>
              <strong>{String(childNodes.length)}</strong>
            </div>

            <div className="ss-node-detail__list-card">
              <span>{isZh ? "可切换的并行分支" : "Switchable sibling branches"}</span>
              {siblingNodes.length ? (
                siblingNodes.map((node) => (
<<<<<<< Updated upstream
                  <button key={node.id} type="button" onClick={() => selectNode(node.id)} className="ss-node-detail__list-item">
=======
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => handleActivateNode(node.id)}
                    className={`ss-node-detail__list-item${compareTargetNodeId === node.id ? " is-compare" : ""}`}
                  >
>>>>>>> Stashed changes
                    <strong>{getWorkspaceNodeLabel(node, t)}</strong>
                    <span>{node.display_id || node.id}</span>
                  </button>
                ))
              ) : (
                <div className="ss-node-detail__empty">{isZh ? "当前没有并行分支。" : "There are no sibling branches for this node."}</div>
              )}
            </div>

            <div className="ss-node-detail__list-card">
              <span>{isZh ? "当前节点展开出的后续路径" : "Child paths from this node"}</span>
              {childNodes.length ? (
                childNodes.map((node) => (
<<<<<<< Updated upstream
                  <button key={node.id} type="button" onClick={() => selectNode(node.id)} className="ss-node-detail__list-item">
=======
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => handleActivateNode(node.id)}
                    className={`ss-node-detail__list-item${compareTargetNodeId === node.id ? " is-compare" : ""}`}
                  >
>>>>>>> Stashed changes
                    <strong>{getWorkspaceNodeLabel(node, t)}</strong>
                    <span>{node.display_id || node.id}</span>
                  </button>
                ))
              ) : (
                <div className="ss-node-detail__empty">{isZh ? "当前节点还没有新的子分支。" : "No child paths have been generated from this node yet."}</div>
              )}
            </div>
          </div>
        ) : null}

        {activeTab === "logs" ? (
          <div className="ss-node-detail__list-card is-tall">
            <span>{isZh ? "当前节点研究日志" : "Research logs for this node"}</span>
            {selectedNodeLogs.length ? (
              selectedNodeLogs.map((entry) => (
                <div key={entry.id} className="ss-node-detail__log-item">
                  <div className="ss-node-detail__log-top">
<<<<<<< Updated upstream
                    <strong>{entry.agentId || (isZh ? "系统" : "System")}</strong>
=======
                    <strong>{entry.agentId ? resolveAgentDisplayName(entry.agentId, agents) : (isZh ? "系统" : "System")}</strong>
>>>>>>> Stashed changes
                    <span>{entry.timestamp}</span>
                  </div>
                  <p>{entry.content}</p>
                </div>
              ))
            ) : (
              <div className="ss-node-detail__empty">
                {isZh ? "当前节点还没有日志记录，继续推演后这里会更新。" : "There are no logs for this node yet. Continue the simulation to populate this area."}
              </div>
            )}
          </div>
        ) : null}

        {activeTab === "raw" ? (
          <div className="ss-node-detail__raw-card">
            <span>{isZh ? "原始事件数据" : "Raw event data"}</span>
            {selectedNodeRawEvents.length ? (
              <pre>{JSON.stringify(selectedNodeRawEvents, null, 2)}</pre>
            ) : (
              <div className="ss-node-detail__empty">
                {isZh ? "当前节点还没有原始事件数据。" : "There is no raw event data for this node yet."}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default NodeDetailPanel;
