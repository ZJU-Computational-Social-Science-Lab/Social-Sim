import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { copySimulation as apiCopySimulation, deleteSimulation as apiDeleteSimulation, listSimulations, resumeSimulation as apiResumeSimulation, type Simulation } from "../services/simulations";
import { useTranslation } from "react-i18next";
import { TitleCard } from "../components/TitleCard";

export function SavedSimulationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const simulationsQuery = useQuery({ queryKey: ["simulations"], queryFn: () => listSimulations() });

  const copySimulation = useMutation({
    mutationFn: async (simulationSlug: string) => apiCopySimulation(simulationSlug),
    onSuccess: (simulation) => {
      queryClient.invalidateQueries({ queryKey: ["simulations"] });
      navigate(`/simulations/${simulation.id}`);
    },
  });

  const resumeSimulation = useMutation({
    mutationFn: async (simulationSlug: string) => apiResumeSimulation(simulationSlug),
    onSuccess: (_, simulationSlug) => {
      navigate(`/simulations/${simulationSlug}`);
    },
  });

  const deleteSimulation = useMutation({
    mutationFn: async (simulationSlug: string) => apiDeleteSimulation(simulationSlug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["simulations"] });
    },
  });

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <TitleCard title={t('saved.title')} />
      <div className="scroll-panel" style={{ height: '100%', overflow: 'auto' }}>
        <div className="panel" style={{ gap: '1rem' }}>
          {simulationsQuery.isLoading && <div>{t('saved.loading')}</div>}
          {simulationsQuery.error && <div style={{ color: '#f87171' }}>{t('saved.error')}</div>}
          <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {(simulationsQuery.data ?? []).map((simulation) => (
              <div key={simulation.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{simulation.name}</div>
                    <div style={{ color: 'var(--muted)' }}>{simulation.status}</div>
                    <div style={{ color: 'var(--muted)' }}>{t('saved.type')}: {simulation.scene_type}</div>
                  </div>
                  <div style={{ color: '#64748b' }}>{new Date(simulation.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="button small" style={{ flex: 1 }} onClick={() => resumeSimulation.mutate(simulation.id)} disabled={resumeSimulation.isPending}>
                    {t('saved.resume')}
                  </button>
                  <button type="button" className="button button-ghost small" style={{ flex: 1 }} onClick={() => copySimulation.mutate(simulation.id)} disabled={copySimulation.isPending}>
                    {t('saved.copy')}
                  </button>
                  <button
                    type="button"
                    className="button button-danger small"
                    style={{ flex: 1 }}
                    onClick={() => { if (window.confirm(t('saved.confirmDelete'))) deleteSimulation.mutate(simulation.id) }}
                    disabled={deleteSimulation.isPending}
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
