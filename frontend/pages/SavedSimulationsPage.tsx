import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Archive,
  CheckSquare,
  Copy,
  FolderOpen,
  PlayCircle,
  Trash2,
  X,
} from "lucide-react";

import {
  copySimulation as apiCopySimulation,
  deleteSimulation as apiDeleteSimulation,
  listSimulations,
  resumeSimulation as apiResumeSimulation,
} from "../services/simulations";
import { useSimulationStore } from "../store";

export function SavedSimulationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const loadSimulationById = useSimulationStore((state) => state.loadSimulationById);
  const addNotification = useSimulationStore((state) => state.addNotification);

  const simulationsQuery = useQuery({
    queryKey: ["simulations"],
    queryFn: () => listSimulations(),
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState(false);

  const simulations = simulationsQuery.data ?? [];
  const selectedCount = selectedIds.length;
  const allSelected = simulations.length > 0 && selectedCount === simulations.length;

  const copySimulation = useMutation({
    mutationFn: async (simulationId: string) => apiCopySimulation(simulationId),
    onSuccess: (simulation) => {
      queryClient.invalidateQueries({ queryKey: ["simulations"] });
      navigate(`/simulations/${simulation.id}`);
    },
  });

  const resumeSimulation = useMutation({
    mutationFn: async (simulationId: string) => apiResumeSimulation(simulationId),
    onSuccess: async (_, simulationId) => {
      await loadSimulationById(simulationId);
      navigate(`/simulations/${simulationId}`);
    },
  });

  const deleteSimulation = useMutation({
    mutationFn: async (simulationId: string) => apiDeleteSimulation(simulationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["simulations"] });
    },
  });

  const bulkDeleteSimulation = useMutation({
    mutationFn: async (simulationIds: string[]) => {
      const results = await Promise.allSettled(
        simulationIds.map((simulationId) => apiDeleteSimulation(simulationId)),
      );
      const successCount = results.filter((result) => result.status === "fulfilled").length;
      return { successCount, failedCount: results.length - successCount };
    },
    onSuccess: ({ successCount, failedCount }) => {
      if (successCount > 0) {
        addNotification(
          "success",
          t("saved.bulkDeleteResult", { success: successCount, failed: failedCount }),
        );
      } else {
        addNotification(
          "error",
          t("saved.bulkDeleteResult", { success: successCount, failed: failedCount }),
        );
      }
      setSelectedIds([]);
      setBulkMode(false);
      queryClient.invalidateQueries({ queryKey: ["simulations"] });
    },
  });

  useEffect(() => {
    const ids = new Set(simulations.map((simulation) => simulation.id));
    setSelectedIds((current) => current.filter((id) => ids.has(id)));
  }, [simulations]);

  const pendingDelete = deleteSimulation.isPending || bulkDeleteSimulation.isPending;

  const toggleSelected = (simulationId: string) => {
    setSelectedIds((current) =>
      current.includes(simulationId)
        ? current.filter((id) => id !== simulationId)
        : [...current, simulationId],
    );
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : simulations.map((simulation) => simulation.id));
  };

  const handleBulkDelete = () => {
    if (!selectedCount) return;
    if (window.confirm(t("saved.confirmBulkDelete", { count: selectedCount }))) {
      bulkDeleteSimulation.mutate(selectedIds);
    }
  };

  return (
    <div className="archive-layout">
      <section className="page-hero fade-in-up">
        <div className="page-hero__header">
          <div className="flex max-w-3xl flex-col gap-4">
            <div className="page-hero__eyebrow">
              <Archive className="h-3.5 w-3.5" />
              Experiment archive
            </div>
            <div className="page-hero__title">An archive you can actually work from.</div>
            <div className="text-subtitle">
              Resume runs, duplicate what worked, and keep destructive actions quiet
              until you really mean them.
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {simulations.length > 0 ? (
              <button
                type="button"
                className={bulkMode ? "button-ghost" : "button"}
                onClick={() => {
                  setBulkMode((current) => !current);
                  setSelectedIds([]);
                }}
                disabled={pendingDelete}
              >
                {bulkMode ? <X className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
                {bulkMode
                  ? t("saved.closeBulkActions", { defaultValue: "Exit select" })
                  : t("saved.bulkActions", { defaultValue: "Select archive items" })}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {bulkMode ? (
        <section className="archive-toolbar fade-in-up">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-[var(--sim-text-strong)]">
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
              {t("saved.selectAll", { defaultValue: "Select all" })}
            </label>
            <span className="text-sm text-[var(--sim-text-muted)]">
              {t("saved.selectedCount", { count: selectedCount, defaultValue: `${selectedCount} selected` })}
            </span>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="button-ghost"
              onClick={() => {
                setBulkMode(false);
                setSelectedIds([]);
              }}
              disabled={pendingDelete}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button-danger"
              onClick={handleBulkDelete}
              disabled={!selectedCount || pendingDelete}
            >
              {bulkDeleteSimulation.isPending
                ? t("saved.deleting", { defaultValue: "Deleting..." })
                : t("saved.bulkDelete", { defaultValue: "Delete selected" })}
            </button>
          </div>
        </section>
      ) : null}

      {simulationsQuery.isLoading ? (
        <section className="settings-section-card">
          <div className="flex items-center gap-3 text-[var(--sim-text-muted)]">
            <span className="spinner" />
            {t("saved.loading", { defaultValue: "Loading..." })}
          </div>
        </section>
      ) : simulationsQuery.error ? (
        <section className="settings-section-card">
          <div className="text-sm font-semibold text-[var(--sim-danger)]">
            {t("saved.error", { defaultValue: "Error loading simulations." })}
          </div>
        </section>
      ) : simulations.length === 0 ? (
        <section className="settings-section-card text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-[var(--sim-primary-soft)] text-[var(--sim-primary)]">
            <FolderOpen className="h-7 w-7" />
          </div>
          <div className="text-lg font-bold text-[var(--sim-text-strong)]">
            No experiments archived yet.
          </div>
          <div className="text-sm leading-7 text-[var(--sim-text-muted)]">
            Create a run from the studio and it will show up here with status, time, and quick actions.
          </div>
        </section>
      ) : (
        <section className="archive-grid">
          {simulations.map((simulation) => (
            <article key={simulation.id} className="archive-card fade-in-up">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[var(--sim-primary-soft)] text-[var(--sim-primary)]">
                    <Archive className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[1.08rem] font-bold text-[var(--sim-text-strong)]">
                      {simulation.name || `Simulation ${simulation.id}`}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="badge badge-outline">{simulation.scene_type}</span>
                      <span className="status-pill">{simulation.status || "active"}</span>
                    </div>
                  </div>
                </div>

                {bulkMode ? (
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(simulation.id)}
                    onChange={() => toggleSelected(simulation.id)}
                    disabled={pendingDelete}
                  />
                ) : null}
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="studio-field-group !p-4">
                  <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--sim-text-soft)]">
                    Created
                  </div>
                  <div className="text-sm font-semibold text-[var(--sim-text-strong)]">
                    {new Date(simulation.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="studio-field-group !p-4">
                  <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--sim-text-soft)]">
                    Next action
                  </div>
                  <div className="text-sm font-semibold text-[var(--sim-text-strong)]">
                    Resume or duplicate into a new branch.
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3 border-t border-[var(--sim-border)] pt-5">
                <button
                  type="button"
                  className="button"
                  onClick={() => resumeSimulation.mutate(simulation.id)}
                  disabled={resumeSimulation.isPending || pendingDelete}
                >
                  <PlayCircle className="h-4 w-4" />
                  {t("saved.resume", { defaultValue: "Resume" })}
                </button>

                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => copySimulation.mutate(simulation.id)}
                  disabled={copySimulation.isPending || pendingDelete}
                >
                  <Copy className="h-4 w-4" />
                  {t("saved.copy", { defaultValue: "Duplicate" })}
                </button>

                <button
                  type="button"
                  className="button-danger"
                  onClick={() => {
                    if (window.confirm(t("saved.confirmDelete", { defaultValue: "Delete this simulation?" }))) {
                      deleteSimulation.mutate(simulation.id);
                    }
                  }}
                  disabled={pendingDelete}
                >
                  <Trash2 className="h-4 w-4" />
                  {t("saved.delete", { defaultValue: "Delete" })}
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
