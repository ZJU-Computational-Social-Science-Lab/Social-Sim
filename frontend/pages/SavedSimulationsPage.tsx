import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { copySimulation as apiCopySimulation, deleteSimulation as apiDeleteSimulation, listSimulations, resumeSimulation as apiResumeSimulation, type Simulation } from "../services/simulations";
import { useTranslation } from "react-i18next";
import { TitleCard } from "../components/TitleCard";
import { useSimulationStore } from "../store";

export function SavedSimulationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const loadSimulationById = useSimulationStore((s) => s.loadSimulationById);
  const addNotification = useSimulationStore((s) => s.addNotification);
  const simulationsQuery = useQuery({ queryKey: ["simulations"], queryFn: () => listSimulations() });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState(false);

  const simulations = simulationsQuery.data ?? [];
  const selectedCount = selectedIds.length;
  const allSelected = simulations.length > 0 && selectedCount === simulations.length;

  const copySimulation = useMutation({
    mutationFn: async (simulationSlug: string) => apiCopySimulation(simulationSlug),
    onSuccess: (simulation) => {
      queryClient.invalidateQueries({ queryKey: ["simulations"] });
      navigate(`/simulations/${simulation.id}`);
    },
  });

  const resumeSimulation = useMutation({
    mutationFn: async (simulationSlug: string) => apiResumeSimulation(simulationSlug),
    onSuccess: async (_, simulationSlug) => {
      await loadSimulationById(simulationSlug);
      navigate(`/simulations/${simulationSlug}`);
    },
  });

  const deleteSimulation = useMutation({
    mutationFn: async (simulationSlug: string) => apiDeleteSimulation(simulationSlug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["simulations"] });
    },
  });

  const bulkDeleteSimulation = useMutation({
    mutationFn: async (simulationIds: string[]) => {
      const results = await Promise.allSettled(
        simulationIds.map((simulationId) => apiDeleteSimulation(simulationId))
      );
      const successCount = results.filter((result) => result.status === "fulfilled").length;
      const failedCount = results.length - successCount;
      return { successCount, failedCount };
    },
    onSuccess: ({ successCount, failedCount }) => {
      if (successCount > 0) {
        addNotification('success', t('saved.bulkDeleteResult', { success: successCount, failed: failedCount }));
      }
      if (failedCount > 0 && successCount === 0) {
        addNotification('error', t('saved.bulkDeleteResult', { success: successCount, failed: failedCount }));
      }
      setSelectedIds([]);
      setBulkMode(false);
      queryClient.invalidateQueries({ queryKey: ["simulations"] });
    },
  });

  useEffect(() => {
    const availableIds = new Set(simulations.map((simulation) => simulation.id));
    setSelectedIds((current) => current.filter((id) => availableIds.has(id)));
  }, [simulations]);

  const pendingDelete = deleteSimulation.isPending || bulkDeleteSimulation.isPending;

  const toggleSelected = (simulationId: string) => {
    setSelectedIds((current) => (
      current.includes(simulationId)
        ? current.filter((id) => id !== simulationId)
        : [...current, simulationId]
    ));
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : simulations.map((simulation) => simulation.id));
  };

  const handleBulkDelete = () => {
    if (!selectedCount) return;
    if (window.confirm(t('saved.confirmBulkDelete', { count: selectedCount }))) {
      bulkDeleteSimulation.mutate(selectedIds);
    }
  };

  const handleCloseBulkMode = () => {
    setBulkMode(false);
    setSelectedIds([]);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <TitleCard title={t('saved.title')} />
      <div className="scroll-panel" style={{ height: '100%', overflow: 'auto' }}>
        <div className="panel" style={{ gap: '1rem' }}>
          {simulationsQuery.isLoading && <div>{t('saved.loading')}</div>}
          {simulationsQuery.error && <div style={{ color: '#f87171' }}>{t('saved.error')}</div>}
          {!simulationsQuery.isLoading && simulations.length > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="button button-ghost small"
                  onClick={() => setBulkMode((current) => !current)}
                  disabled={pendingDelete}
                >
                  {bulkMode ? t('saved.closeBulkActions') : t('saved.bulkActions')}
                </button>
              </div>
              {bulkMode && (
                <div
                  className="card"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem',
                    flexWrap: 'wrap',
                    border: '1px solid rgba(59, 130, 246, 0.18)',
                    background: 'linear-gradient(180deg, rgba(239,246,255,0.9) 0%, rgba(248,250,252,0.96) 100%)',
                    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>{t('saved.bulkActionsTitle')}</div>
                    <div style={{ color: '#64748b', fontSize: '0.9rem' }}>{t('saved.bulkActionsHint')}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
                      <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} disabled={pendingDelete} />
                      <span>{t('saved.selectAll')}</span>
                    </label>
                    <span style={{ color: 'var(--muted)' }}>{t('saved.selectedCount', { count: selectedCount })}</span>
                    <button
                      type="button"
                      className="button button-ghost small"
                      onClick={handleCloseBulkMode}
                      disabled={pendingDelete}
                    >
                      {t('saved.cancelBulkActions')}
                    </button>
                    <button
                      type="button"
                      className="button button-danger small"
                      onClick={handleBulkDelete}
                      disabled={!selectedCount || pendingDelete}
                    >
                      {bulkDeleteSimulation.isPending ? t('saved.deleting') : t('saved.bulkDelete')}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {simulations.map((simulation) => (
              <div key={simulation.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    {bulkMode && (
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(simulation.id)}
                        onChange={() => toggleSelected(simulation.id)}
                        disabled={pendingDelete}
                        style={{ marginTop: '0.2rem' }}
                      />
                    )}
                    <div>
                    <div style={{ fontWeight: 600 }}>{simulation.name}</div>
                    <div style={{ color: 'var(--muted)' }}>{simulation.status}</div>
                    <div style={{ color: 'var(--muted)' }}>{t('saved.type')}: {simulation.scene_type}</div>
                    </div>
                  </div>
                  <div style={{ color: '#64748b' }}>{new Date(simulation.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="button small" style={{ flex: 1 }} onClick={() => resumeSimulation.mutate(simulation.id)} disabled={resumeSimulation.isPending || pendingDelete}>
                    {t('saved.resume')}
                  </button>
                  <button type="button" className="button button-ghost small" style={{ flex: 1 }} onClick={() => copySimulation.mutate(simulation.id)} disabled={copySimulation.isPending || pendingDelete}>
                    {t('saved.copy')}
                  </button>
                  <button
                    type="button"
                    className="button button-danger small"
                    style={{ flex: 1 }}
                    onClick={() => { if (window.confirm(t('saved.confirmDelete'))) deleteSimulation.mutate(simulation.id) }}
                    disabled={pendingDelete}
                  >
                    {t('saved.delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
