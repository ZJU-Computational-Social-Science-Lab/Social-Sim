import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, Clock3, Loader2, RefreshCw, Save, X } from "lucide-react";

import { useSimulationStore } from "../store";
import {
  createSimulationSnapshot,
  listSimulationSnapshots,
  resumeSimulationFromSnapshot,
  type SimulationSnapshotItem,
} from "../services/simulations";

export const SnapshotModal: React.FC = () => {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");
  const isOpen = useSimulationStore((state) => state.isSnapshotModalOpen);
  const close = useSimulationStore((state) => state.closeSnapshotModal);
  const currentSimulation = useSimulationStore((state) => state.currentSimulation);
  const loadSimulationById = useSimulationStore((state) => state.loadSimulationById);

  const [snapshots, setSnapshots] = React.useState<SimulationSnapshotItem[]>([]);
  const [label, setLabel] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [restoringSnapshotId, setRestoringSnapshotId] = React.useState<number | null>(null);

  const simulationId = currentSimulation?.id || null;

  const loadSnapshots = React.useCallback(async () => {
    if (!simulationId) {
      setSnapshots([]);
      return;
    }

    setIsLoading(true);
    const items = await listSimulationSnapshots(simulationId);
    setSnapshots(items);
    setIsLoading(false);
  }, [simulationId]);

  React.useEffect(() => {
    if (!isOpen) return;
    setLabel("");
    void loadSnapshots();
  }, [isOpen, loadSnapshots]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!simulationId) return;
    setIsSaving(true);
    await createSimulationSnapshot(simulationId, label.trim() || undefined);
    setLabel("");
    await loadSnapshots();
    setIsSaving(false);
  };

  const handleRestore = async (snapshotId: number) => {
    if (!simulationId) return;
    const ok = window.confirm(isZh ? "确认恢复到这个快照？" : "Restore this snapshot?");
    if (!ok) return;

    setRestoringSnapshotId(snapshotId);
    await resumeSimulationFromSnapshot(simulationId, snapshotId);
    await loadSimulationById(simulationId);
    await loadSnapshots();
    setRestoringSnapshotId(null);
    close();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="flex max-h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[var(--ss-workspace-border)] bg-[var(--ss-workspace-surface)] shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--ss-workspace-border)] px-4 py-3">
          <div>
            <div className="ss-kicker">{isZh ? "快照管理" : "Snapshot manager"}</div>
            <h2 className="mt-1 text-lg font-semibold text-[var(--ss-workspace-heading)]">
              {currentSimulation?.name || (isZh ? "当前仿真" : "Current simulation")}
            </h2>
          </div>
          <button type="button" className="ss-icon-button" onClick={close} aria-label={isZh ? "关闭" : "Close"}>
            <X size={16} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <section className="flex min-h-0 flex-col gap-3 rounded-2xl border border-[var(--ss-workspace-border)] bg-[var(--ss-workspace-surface-strong)] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ss-workspace-heading)]">
              <Save size={15} />
              <span>{isZh ? "保存当前快照" : "Save snapshot"}</span>
            </div>
            <label className="space-y-2 text-sm text-[var(--ss-workspace-muted)]">
              <span>{isZh ? "快照名称" : "Label"}</span>
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder={isZh ? "例如：第 3 轮前" : "e.g. Before round 3"}
                className="w-full rounded-xl border border-[var(--ss-workspace-border)] bg-transparent px-3 py-2 text-sm text-[var(--ss-workspace-heading)] outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!simulationId || isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--ss-workspace-node-selected)] px-4 py-2 text-sm font-semibold text-[#20170a] transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              <span>{isSaving ? (isZh ? "保存中..." : "Saving...") : (isZh ? "保存快照" : "Save snapshot")}</span>
            </button>

            <div className="rounded-xl border border-dashed border-[var(--ss-workspace-border)] p-3 text-xs leading-6 text-[var(--ss-workspace-muted)]">
              {isZh
                ? "快照会保存完整树状态。恢复后页面会自动刷新到对应树状态。"
                : "Snapshots save the full tree state. Restoring refreshes the page to that tree state."}
            </div>
          </section>

          <section className="flex min-h-0 flex-col rounded-2xl border border-[var(--ss-workspace-border)] bg-[var(--ss-workspace-surface-strong)]">
            <div className="flex items-center justify-between border-b border-[var(--ss-workspace-border)] px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ss-workspace-heading)]">
                <Clock3 size={15} />
                <span>{isZh ? "已有快照" : "Existing snapshots"}</span>
              </div>
              <button
                type="button"
                onClick={() => void loadSnapshots()}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--ss-workspace-border)] px-3 py-2 text-xs font-semibold text-[var(--ss-workspace-heading)] transition-colors hover:bg-[var(--ss-workspace-surface)]"
              >
                <RefreshCw size={14} />
                <span>{isZh ? "刷新" : "Refresh"}</span>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-16 text-sm text-[var(--ss-workspace-muted)]">
                  <Loader2 size={15} className="mr-2 animate-spin" />
                  <span>{isZh ? "加载快照中..." : "Loading snapshots..."}</span>
                </div>
              ) : snapshots.length ? (
                <div className="space-y-3">
                  {snapshots.map((snapshot) => (
                    <article key={snapshot.id} className="rounded-2xl border border-[var(--ss-workspace-border)] bg-[var(--ss-workspace-surface)] p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-[var(--ss-workspace-heading)]">{snapshot.label}</div>
                          <div className="mt-1 text-xs text-[var(--ss-workspace-muted)]">
                            {isZh ? "轮次" : "Turns"}: {snapshot.turns} · {snapshot.created_at}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleRestore(snapshot.id)}
                          disabled={restoringSnapshotId === snapshot.id}
                          className="inline-flex items-center gap-2 rounded-xl border border-[var(--ss-workspace-border)] px-3 py-2 text-xs font-semibold text-[var(--ss-workspace-heading)] transition-colors hover:bg-[var(--ss-workspace-surface-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {restoringSnapshotId === snapshot.id ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
                          <span>{restoringSnapshotId === snapshot.id ? (isZh ? "恢复中..." : "Restoring...") : (isZh ? "恢复" : "Restore")}</span>
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-[var(--ss-workspace-border)] p-8 text-center text-sm text-[var(--ss-workspace-muted)]">
                  {isZh ? "当前还没有快照。先保存一个快照。" : "No snapshots yet. Save one to get started."}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default SnapshotModal;