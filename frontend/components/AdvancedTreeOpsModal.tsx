import React from "react";
import { useTranslation } from "react-i18next";
import { GitBranchPlus, Layers3, Loader2, Play, RefreshCcw, X } from "lucide-react";

import { useSimulationStore } from "../store";
import { treeAdvanceChain, treeAdvanceFrontier, treeAdvanceMulti } from "../services/simulationTree";

export const AdvancedTreeOpsModal: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");
  const isOpen = useSimulationStore((state) => state.isTreeOpsModalOpen);
  const close = useSimulationStore((state) => state.closeTreeOpsModal);
  const currentSimulation = useSimulationStore((state) => state.currentSimulation);
  const selectedNode = useSimulationStore((state) =>
    state.nodes.find((node) => node.id === state.selectedNodeId) || state.nodes[0] || null,
  );
  const engineConfig = useSimulationStore((state) => state.engineConfig);
  const loadSimulationById = useSimulationStore((state) => state.loadSimulationById);
  const addNotification = useSimulationStore((state) => state.addNotification);

  const [turns, setTurns] = React.useState(1);
  const [count, setCount] = React.useState(2);
  const [onlyMaxDepth, setOnlyMaxDepth] = React.useState(false);
  const [isBusy, setIsBusy] = React.useState(false);

  const simulationId = currentSimulation?.id || null;
  const parentNodeNumeric = selectedNode?.id ? Number(selectedNode.id) : null;
  const hasParent = parentNodeNumeric != null && Number.isFinite(parentNodeNumeric);

  React.useEffect(() => {
    if (!isOpen) return;
    setTurns(1);
    setCount(2);
    setOnlyMaxDepth(false);
    setIsBusy(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const refreshTree = async () => {
    if (!simulationId) return;
    await loadSimulationById(simulationId);
  };

  const getBase = () => engineConfig.endpoint;
  const getToken = () => engineConfig.token;

  const handleFrontier = async () => {
    if (!simulationId) return;
    setIsBusy(true);
    try {
      await treeAdvanceFrontier(getBase(), simulationId, turns, onlyMaxDepth, getToken());
      await refreshTree();
      addNotification?.("success", isZh ? "前沿推进完成" : "Frontier advanced");
    } catch (error: any) {
      addNotification?.("error", error?.message || (isZh ? "前沿推进失败" : "Frontier advance failed"));
    } finally {
      setIsBusy(false);
    }
  };

  const handleMulti = async () => {
    if (!simulationId || !hasParent) return;
    setIsBusy(true);
    try {
      await treeAdvanceMulti(getBase(), simulationId, parentNodeNumeric, turns, count, getToken());
      await refreshTree();
      addNotification?.("success", isZh ? "多分支推进完成" : "Multi-advance completed");
    } catch (error: any) {
      addNotification?.("error", error?.message || (isZh ? "多分支推进失败" : "Multi-advance failed"));
    } finally {
      setIsBusy(false);
    }
  };

  const handleChain = async () => {
    if (!simulationId || !hasParent) return;
    setIsBusy(true);
    try {
      await treeAdvanceChain(getBase(), simulationId, parentNodeNumeric, turns, getToken());
      await refreshTree();
      addNotification?.("success", isZh ? "链式推进完成" : "Chain advance completed");
    } catch (error: any) {
      addNotification?.("error", error?.message || (isZh ? "链式推进失败" : "Chain advance failed"));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="flex max-h-[82vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--ss-workspace-border)] bg-[var(--ss-workspace-surface)] shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--ss-workspace-border)] px-4 py-3">
          <div>
            <div className="ss-kicker">{isZh ? "高级树推进" : "Advanced tree ops"}</div>
            <h2 className="mt-1 text-lg font-semibold text-[var(--ss-workspace-heading)]">
              {currentSimulation?.name || (isZh ? "当前仿真" : "Current simulation")}
            </h2>
          </div>
          <button type="button" className="ss-icon-button" onClick={close} aria-label={isZh ? "关闭" : "Close"}>
            <X size={16} />
          </button>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <section className="rounded-2xl border border-[var(--ss-workspace-border)] bg-[var(--ss-workspace-surface-strong)] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ss-workspace-heading)]">
              <Play size={15} />
              <span>{isZh ? "推进参数" : "Advance parameters"}</span>
            </div>

            <div className="mt-4 space-y-4">
              <label className="block space-y-2 text-sm text-[var(--ss-workspace-muted)]">
                <span>{isZh ? "推进轮数" : "Turns"}</span>
                <input
                  type="number"
                  min={1}
                  value={turns}
                  onChange={(event) => setTurns(Math.max(1, Number(event.target.value) || 1))}
                  className="w-full rounded-xl border border-[var(--ss-workspace-border)] bg-transparent px-3 py-2 text-sm text-[var(--ss-workspace-heading)] outline-none"
                />
              </label>

              <label className="block space-y-2 text-sm text-[var(--ss-workspace-muted)]">
                <span>{isZh ? "分支数量" : "Count"}</span>
                <input
                  type="number"
                  min={1}
                  value={count}
                  onChange={(event) => setCount(Math.max(1, Number(event.target.value) || 1))}
                  className="w-full rounded-xl border border-[var(--ss-workspace-border)] bg-transparent px-3 py-2 text-sm text-[var(--ss-workspace-heading)] outline-none"
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-[var(--ss-workspace-muted)]">
                <input
                  type="checkbox"
                  checked={onlyMaxDepth}
                  onChange={(event) => setOnlyMaxDepth(event.target.checked)}
                />
                <span>{isZh ? "仅推进最深前沿" : "Only max depth frontier"}</span>
              </label>
            </div>

            <div className="mt-4 rounded-xl border border-dashed border-[var(--ss-workspace-border)] p-3 text-xs leading-6 text-[var(--ss-workspace-muted)]">
              {isZh
                ? "前沿推进不需要选中节点；多分支和链式推进会以当前节点作为 parent。"
                : "Frontier advance does not require a selected node; multi/chain use the current node as parent."}
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-2xl border border-[var(--ss-workspace-border)] bg-[var(--ss-workspace-surface-strong)] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ss-workspace-heading)]">
              <Layers3 size={15} />
              <span>{isZh ? "执行操作" : "Execute"}</span>
            </div>

            <button
              type="button"
              onClick={() => void handleFrontier()}
              disabled={!simulationId || isBusy}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--ss-workspace-node-selected)] px-4 py-3 text-sm font-semibold text-[#20170a] transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isBusy ? <Loader2 size={15} className="animate-spin" /> : <RefreshCcw size={15} />}
              <span>{isZh ? "推进前沿" : "Advance frontier"}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleMulti()}
              disabled={!simulationId || !hasParent || isBusy}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--ss-workspace-border)] px-4 py-3 text-sm font-semibold text-[var(--ss-workspace-heading)] transition-colors hover:bg-[var(--ss-workspace-surface)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <GitBranchPlus size={15} />
              <span>{isZh ? "多分支推进" : "Advance multi"}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleChain()}
              disabled={!simulationId || !hasParent || isBusy}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--ss-workspace-border)] px-4 py-3 text-sm font-semibold text-[var(--ss-workspace-heading)] transition-colors hover:bg-[var(--ss-workspace-surface)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Play size={15} />
              <span>{isZh ? "链式推进" : "Advance chain"}</span>
            </button>

            <div className="mt-auto text-xs leading-6 text-[var(--ss-workspace-muted)]">
              {isZh
                ? "执行后会自动刷新当前树状态。"
                : "The tree refreshes automatically after execution."}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AdvancedTreeOpsModal;