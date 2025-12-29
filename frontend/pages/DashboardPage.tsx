import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { listSimulations, type Simulation } from "../services/simulations";
import { listScenes, type SceneOption } from "../services/scenes";
import { listProviders } from "../services/providers";
import { useTranslation } from "react-i18next";
import { TitleCard } from "../components/TitleCard";

// Use Simulation type from API (includes scene_type)

export function DashboardPage() {
  const { t } = useTranslation();
  const simulationsQuery = useQuery({ queryKey: ["simulations"], queryFn: () => listSimulations() });
  const providersQuery = useQuery({ queryKey: ["providers"], queryFn: () => listProviders() });
  const scenesQuery = useQuery({ queryKey: ["scenes"], queryFn: () => listScenes() });
  const hasProvider = (providersQuery.data ?? []).length > 0;

  const formatSceneName = (scenes: SceneOption[] | undefined, type: string): string => {
    const opt = (scenes || []).find((s) => s.type === type);
    if (opt?.name) return String(opt.name).replace(/([a-z])([A-Z])/g, '$1 $2');
    return type.split('_').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
  };

  return (
    <div style={{ height: '100%', overflow: 'auto' }} className="scroll-panel">
      <TitleCard
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
        actions={(
          <>
            <Link
              to={hasProvider ? '/simulations/new' : '/settings/providers'}
              className={`button ${!hasProvider ? 'button-ghost' : ''}`}
              aria-disabled={!hasProvider}
              onClick={(e) => { if (!hasProvider) e.preventDefault(); }}
            >
              {t('dashboard.new')}
            </Link>
            <Link to="/simulations/saved" className="button button-ghost">{t('dashboard.resume')}</Link>
          </>
        )}
      />

      {!hasProvider && (
        <div className="card" style={{ marginBottom: '0.75rem' }}>
          <div className="panel-title"><span className="badge-warning" aria-hidden>!</span>{t('settings.providers.title')}</div>
          <div style={{ color: 'var(--muted)' }}>{t('dashboard.providerRequired')}</div>
          <div style={{ color: 'var(--muted)' }}>{t('dashboard.providersHint')}</div>
          <Link to="/settings/providers" className="button button-danger" style={{ marginTop: '0.5rem', width: 'fit-content' }}>
            {t('dashboard.manageProviders')}
          </Link>
        </div>
      )}

      <section className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <div className="card">
          <div className="panel-title">{t('dashboard.quick')}</div>
          <p style={{ color: 'var(--muted)' }}>{t('dashboard.subtitle')}</p>
          <Link
            to={hasProvider ? '/simulations/new' : '/settings/providers'}
            className={`button ${!hasProvider ? 'button-ghost' : ''}`}
            aria-disabled={!hasProvider}
            onClick={(e) => { if (!hasProvider) e.preventDefault(); }}
          >
            {t('dashboard.launchWizard')}
          </Link>
        </div>
        <div className="card">
          <div className="panel-title">{t('dashboard.providers')}</div>
          <p style={{ color: 'var(--muted)' }}>{t('dashboard.providersHint')}</p>
          <Link to="/settings/providers" className="button button-ghost" style={{ alignSelf: 'flex-start' }}>{t('dashboard.manageProviders')}</Link>
        </div>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">{t('dashboard.recent')}</div>
            <Link to="/simulations/saved" className="link">{t('dashboard.viewAll')}</Link>
          </div>
          {simulationsQuery.isLoading && <div>{t('dashboard.loading')}</div>}
          {simulationsQuery.error && <div style={{ color: '#f87171' }}>{t('dashboard.error')}</div>}
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {(simulationsQuery.data ?? []).slice(0, 5).map((simulation) => (
              <Link key={simulation.id} to={`/simulations/${simulation.id}`} className="card" style={{ margin: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                    <div style={{ fontWeight: 600 }}>Simulation #{simulation.id}</div>
                    <div style={{ color: 'var(--muted)' }}>{formatSceneName(scenesQuery.data, simulation.scene_type)}</div>
                  </div>
                </div>
                <div style={{ color: 'var(--muted)' }}>{t('dashboard.status')}: {simulation.status}</div>
                <div style={{ color: '#64748b' }}>{t('dashboard.created')}: {new Date(simulation.created_at).toLocaleString()}</div>
              </Link>
            ))}
            {simulationsQuery.data && simulationsQuery.data.length === 0 && (
              <div style={{ color: 'var(--muted)' }}>{t('dashboard.empty')}</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
