import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, FlaskConical, History, Orbit, Play, Radar, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import { listProviders } from "../services/providers";
import { listScenes } from "../services/scenes";
import { listSimulations } from "../services/simulations";

const getStatusTone = (status: string) => {
  if (status === "active") {
    return "ss-status-chip is-success";
  }
  if (status === "archived") {
    return "ss-status-chip is-neutral";
  }
  return "ss-status-chip is-warning";
};

export function DashboardPage() {
  const { t } = useTranslation();
  const simulationsQuery = useQuery({
    queryKey: ["simulations"],
    queryFn: () => listSimulations(),
  });
  const providersQuery = useQuery({
    queryKey: ["providers"],
    queryFn: () => listProviders(),
  });
  const scenesQuery = useQuery({
    queryKey: ["scenes"],
    queryFn: () => listScenes(),
  });

  const hasProvider = (providersQuery.data ?? []).length > 0;

  const recentSimulations = useMemo(() => {
    const items = [...(simulationsQuery.data ?? [])];
    return items
      .sort((left, right) => {
        const leftTime = new Date(left.created_at).getTime();
        const rightTime = new Date(right.created_at).getTime();
        return rightTime - leftTime;
      })
      .slice(0, 4);
  }, [simulationsQuery.data]);

  const activeSimulation = recentSimulations[0];
  const scenePreview = (scenesQuery.data ?? []).slice(0, 3);

  const formatDate = (value: string) => new Date(value).toLocaleString();

  const formatSceneName = (simulation: any) => {
    const matched = (scenesQuery.data ?? []).find((scene) => scene.type === simulation.scene_type);
    return matched?.name ?? simulation.scene_type;
  };

  return (
    <div className="ss-product-page ss-product-page--dashboard ss-dashboard-page scroll-panel">
      <section className="lab-surface grid gap-6 p-6 xl:grid-cols-[minmax(0,1.3fr)_360px]">
        <div className="space-y-5">
          <div className="kicker">{t("dashboardDesk.eyebrow")}</div>
          <div className="space-y-3">
            <h1 className="display-title m-0">{t("dashboardDesk.title")}</h1>
            <p className="lab-meta max-w-3xl text-[1rem]">{t("dashboardDesk.subtitle")}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to="/simulations/new" className="button inline-flex items-center gap-2">
              <FlaskConical size={16} />
              {t("dashboardDesk.launchExperiment")}
            </Link>
            <Link to="/simulations/saved" className="button button-ghost inline-flex items-center gap-2">
              <History size={16} />
              {t("dashboardDesk.openArchive")}
            </Link>
          </div>

          {!hasProvider && (
            <div className="lab-inset space-y-3 p-4">
              <div className="lab-label">
                <span className="lab-dot" />
                {t("dashboardDesk.providerMissing")}
              </div>
              <div className="section-title">{t("dashboardDesk.providerWarningTitle")}</div>
              <p className="lab-meta">{t("dashboardDesk.providerWarningBody")}</p>
              <Link to="/settings/providers" className="button inline-flex w-fit items-center gap-2">
                <Sparkles size={16} />
                {t("dashboardDesk.recommendationSetup")}
              </Link>
            </div>
          )}
        </div>

        <div className="lab-inset flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="kicker">{t("dashboardDesk.currentExperiment")}</div>
              <div className="ss-dashboard-page__title">
                {activeSimulation ? activeSimulation.name : t("dashboardDesk.noRecent")}
              </div>
            </div>
            <span
              className={`${
                activeSimulation
                  ? getStatusTone(activeSimulation.status)
                  : "ss-status-chip is-neutral"
              }`}
            >
              {activeSimulation
                ? t(`dashboardDesk.activeStatus.${activeSimulation.status}`)
                : t("dashboardDesk.activeStatus.unknown")}
            </span>
          </div>

          <p className="lab-meta">{t("dashboardDesk.currentExperimentHint")}</p>

          {activeSimulation ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="lab-inset p-4">
                <div className="kicker">{t("common.status")}</div>
                <div className="ss-dashboard-page__metric">
                  {formatSceneName(activeSimulation)}
                </div>
                <div className="ss-dashboard-page__muted">
                  {formatDate(activeSimulation.created_at)}
                </div>
              </div>
              <div className="lab-inset p-4">
                <div className="kicker">{t("common.autosave")}</div>
                <div className="ss-dashboard-page__metric">
                  {hasProvider
                    ? t("dashboardDesk.providerReady")
                    : t("dashboardDesk.providerMissing")}
                </div>
                <div className="ss-dashboard-page__muted">
                  {t("dashboardDesk.recommendationsHint")}
                </div>
              </div>
            </div>
          ) : null}

          <Link
            to={activeSimulation ? `/simulations/${activeSimulation.id}` : "/simulations/new"}
            className="button inline-flex w-fit items-center gap-2"
          >
            <Play size={16} />
            {activeSimulation
              ? t("dashboardDesk.continueLabel")
              : t("dashboardDesk.launchExperiment")}
          </Link>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="lab-surface p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="kicker">{t("dashboardDesk.recommendations")}</div>
              <div className="section-title">{t("dashboardDesk.recommendations")}</div>
              <p className="lab-meta">{t("dashboardDesk.recommendationsHint")}</p>
            </div>
            <Orbit className="ss-dashboard-page__section-icon" size={20} />
          </div>

          <div className="lab-grid-auto mt-5">
            {[
              { icon: FlaskConical, label: t("dashboardDesk.recommendationNew"), to: "/simulations/new" },
              { icon: Radar, label: t("dashboardDesk.recommendationScenes"), to: "/simulations/new" },
              { icon: Orbit, label: t("dashboardDesk.recommendationNetwork"), to: "/simulations/new" },
              { icon: Sparkles, label: t("dashboardDesk.recommendationAnalyze"), to: "/simulations/saved" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className="lab-inset flex items-center justify-between gap-4 p-4 transition-transform duration-200 hover:-translate-y-1"
                >
                  <div className="flex items-center gap-3">
                    <span className="ss-dashboard-page__icon-badge">
                      <Icon size={14} />
                    </span>
                    <span className="ss-dashboard-page__item-title">{item.label}</span>
                  </div>
                  <ArrowRight size={16} className="ss-dashboard-page__item-arrow" />
                </Link>
              );
            })}
          </div>
        </div>

        <div className="lab-surface p-6">
          <div className="space-y-2">
            <div className="kicker">{t("dashboardDesk.recentChanges")}</div>
            <div className="section-title">{t("dashboardDesk.recentChanges")}</div>
            <p className="lab-meta">{t("dashboardDesk.recentChangesHint")}</p>
          </div>

          <div className="mt-5 space-y-3">
            {simulationsQuery.isLoading ? (
              <div className="lab-meta">{t("dashboard.loading")}</div>
            ) : null}

            {simulationsQuery.error ? (
              <div className="ss-dashboard-page__error">
                {t("dashboard.error")}
              </div>
            ) : null}

            {!simulationsQuery.isLoading && recentSimulations.length === 0 ? (
              <div className="lab-inset ss-dashboard-page__empty">{t("dashboardDesk.noRecent")}</div>
            ) : null}

            {recentSimulations.map((simulation) => (
              <Link
                key={simulation.id}
                to={`/simulations/${simulation.id}`}
                className="lab-inset block p-4 transition-transform duration-200 hover:-translate-y-1"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="ss-dashboard-page__item-title">{simulation.name}</div>
                  <span className={getStatusTone(simulation.status)}>
                    {t(`dashboardDesk.activeStatus.${simulation.status}`)}
                  </span>
                </div>
                <div className="ss-dashboard-page__meta-line">{formatSceneName(simulation)}</div>
                <div className="ss-dashboard-page__meta-row">
                  <span>{t("dashboard.simulationId", { id: simulation.id })}</span>
                  <span>{formatDate(simulation.created_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="lab-surface p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="kicker">{t("dashboardDesk.scenarioEntry")}</div>
            <div className="section-title">{t("dashboardDesk.scenarioEntry")}</div>
            <p className="lab-meta">{t("dashboardDesk.scenarioEntryHint")}</p>
          </div>
          <Link to="/simulations/new" className="button button-ghost inline-flex items-center gap-2">
            {t("dashboardDesk.openScenarioLibrary")}
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className="lab-grid-auto mt-5">
          {scenePreview.map((scene) => (
            <Link
              key={scene.type}
              to="/simulations/new"
              className="lab-inset flex min-h-[180px] flex-col justify-between p-4 transition-transform duration-200 hover:-translate-y-1"
            >
              <div className="space-y-2">
                <div className="lab-label">{scene.name}</div>
                <div className="ss-dashboard-page__scene-title">{scene.name}</div>
                <p className="lab-meta">{scene.description || t("dashboardDesk.scenarioEntryHint")}</p>
              </div>
              <div className="ss-dashboard-page__meta-row">
                <span>{t("common.actions")}: {(scene.allowed_actions ?? scene.basic_actions ?? []).length}</span>
                <ArrowRight size={15} />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
