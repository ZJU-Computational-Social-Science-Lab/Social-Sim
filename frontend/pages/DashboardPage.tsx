import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, FlaskConical, History, Play, Radar, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import { listProviders } from "../services/providers";
import { getAllScenarios } from "../services/scenarios";
import { listScenes } from "../services/scenes";
import { listSimulations } from "../services/simulations";
import {
  getLocalizedScenarioName,
  getLocalizedSimulationSceneLabel,
} from "../utils/scenarioLocalization";

const getStatusTone = (status: string) => {
  if (status === "active" || status === "running") {
    return "ss-status-chip is-success";
  }
  if (status === "archived" || status === "completed" || status === "draft") {
    return "ss-status-chip is-neutral";
  }
  return "ss-status-chip is-warning";
};

export function DashboardPage() {
  const { t } = useTranslation();
  const featuredScenarioIds = ["prisoners_dilemma", "public_goods", "council_chamber"];
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
  const scenarioDefinitionsQuery = useQuery({
    queryKey: ["scenario-definitions"],
    queryFn: () => getAllScenarios(),
  });

  const hasProvider = (providersQuery.data ?? []).length > 0;
  const scenarioDefinitions = scenarioDefinitionsQuery.data ?? [];
  const scenePreview = useMemo(() => {
    const featured = featuredScenarioIds
      .map((scenarioId) => scenarioDefinitions.find((scenario) => scenario.id === scenarioId))
      .filter((scenario): scenario is NonNullable<typeof scenario> => Boolean(scenario));

    if (featured.length > 0) {
      return featured;
    }

    return scenarioDefinitions.filter((scenario) => scenario.category !== "custom").slice(0, 3);
  }, [scenarioDefinitions]);

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
  const recentChanges = recentSimulations.slice(activeSimulation ? 1 : 0, 4);

  const quickActions = [
    {
      icon: FlaskConical,
      title: t("dashboardDesk.launchExperiment"),
      hint: t("dashboardDesk.newExperimentHint"),
      to: "/simulations/new",
    },
    {
      icon: History,
      title: t("dashboardDesk.openArchive"),
      hint: t("dashboardDesk.archiveHint"),
      to: "/simulations/saved",
    },
    {
      icon: Radar,
      title: t("dashboardDesk.openScenarioLibrary"),
      hint: t("dashboardDesk.sceneLibraryHint"),
      to: "/simulations/new",
    },
  ];

  const formatDate = (value: string) =>
    new Date(value).toLocaleString([], {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatSceneName = (simulation: any) => {
    const localizedScenarioName = getLocalizedSimulationSceneLabel(
      t,
      simulation.scene_config,
      scenarioDefinitions,
      "",
    );
    if (localizedScenarioName) {
      return localizedScenarioName;
    }
    const matched = (scenesQuery.data ?? []).find((scene) => scene.type === simulation.scene_type);
    return matched?.name ?? simulation.scene_type;
  };

  const formatSimulationTitle = (simulation: any) =>
    getLocalizedSimulationSceneLabel(
      t,
      simulation.scene_config,
      scenarioDefinitions,
      simulation.name,
    );

  const activeStatusLabel = activeSimulation
    ? t(`dashboardDesk.activeStatus.${activeSimulation.status}`, {
        defaultValue: t("dashboardDesk.activeStatus.unknown"),
      })
    : t("dashboardDesk.activeStatus.unknown");

  return (
    <div className="ss-product-page ss-product-page--dashboard ss-dashboard-page scroll-panel">
      <section className="lab-surface ss-dashboard-page__hero p-6">
        <div className="ss-dashboard-page__hero-grid">
          <div className="ss-dashboard-page__hero-main">
            <div className="ss-dashboard-page__hero-copy">
              <div className="kicker">{t("dashboardDesk.eyebrow")}</div>
              <h1 className="display-title m-0">{t("dashboardDesk.title")}</h1>
              <p className="lab-meta ss-dashboard-page__hero-subtitle">{t("dashboardDesk.subtitle")}</p>
            </div>

            <div className="ss-dashboard-page__primary-actions">
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
              <div className="ss-dashboard-page__provider-banner">
                <div className="ss-dashboard-page__provider-copy">
                  <div className="lab-label">
                    <span className="lab-dot" />
                    {t("dashboardDesk.providerMissing")}
                  </div>
                  <div className="ss-dashboard-page__item-title">{t("dashboardDesk.providerWarningTitle")}</div>
                  <p className="lab-meta">{t("dashboardDesk.providerWarningBody")}</p>
                </div>
                <Link to="/settings/providers" className="button inline-flex w-fit items-center gap-2">
                  <Sparkles size={16} />
                  {t("dashboardDesk.recommendationSetup")}
                </Link>
              </div>
            )}

          </div>

          <div className="lab-inset p-5 ss-dashboard-page__active-card">
            <div className="ss-dashboard-page__active-head">
              <div className="space-y-2">
                <div className="kicker">{t("dashboardDesk.currentExperiment")}</div>
                <div className="ss-dashboard-page__title ss-dashboard-page__title--clamp">
                  {activeSimulation ? formatSimulationTitle(activeSimulation) : t("dashboardDesk.noRecent")}
                </div>
              </div>
              <span
                className={`${
                  activeSimulation
                    ? getStatusTone(activeSimulation.status)
                    : "ss-status-chip is-neutral"
                }`}
              >
                {activeStatusLabel}
              </span>
            </div>

            <p className="lab-meta">{t("dashboardDesk.currentExperimentHint")}</p>

            {activeSimulation ? (
              <div className="ss-dashboard-page__summary-grid">
                <div className="ss-dashboard-page__summary-item">
                  <div className="kicker">{t("experimentDesk.summary.scenario")}</div>
                  <div className="ss-dashboard-page__metric">{formatSceneName(activeSimulation)}</div>
                  <div className="ss-dashboard-page__muted">{formatDate(activeSimulation.created_at)}</div>
                </div>
                <div className="ss-dashboard-page__summary-item">
                  <div className="kicker">{t("dashboardDesk.providerStatus")}</div>
                  <div className="ss-dashboard-page__metric">
                    {hasProvider
                      ? t("dashboardDesk.providerReady")
                      : t("dashboardDesk.providerMissing")}
                  </div>
                  <div className="ss-dashboard-page__muted">{t("dashboardDesk.continueHint")}</div>
                </div>
              </div>
            ) : null}

            {!simulationsQuery.isLoading && recentChanges.length > 0 ? (
              <div className="ss-dashboard-page__recent-list">
                <div className="kicker">{t("dashboardDesk.recentChanges")}</div>
                {recentChanges.map((simulation) => (
                  <Link
                    key={simulation.id}
                    to={`/simulations/${simulation.id}`}
                    className="ss-dashboard-page__recent-item"
                  >
                    <div>
                      <div className="ss-dashboard-page__item-title">
                        {formatSimulationTitle(simulation)}
                      </div>
                      <div className="ss-dashboard-page__meta-line">{formatDate(simulation.created_at)}</div>
                    </div>
                    <ArrowRight size={15} className="ss-dashboard-page__item-arrow" />
                  </Link>
                ))}
              </div>
            ) : null}

            <Link
              to={activeSimulation ? `/simulations/${activeSimulation.id}` : "/simulations/new"}
              className="button inline-flex items-center justify-between gap-2 ss-dashboard-page__continue"
            >
              <span>
                {activeSimulation
                  ? t("dashboardDesk.continueLabel")
                  : t("dashboardDesk.launchExperiment")}
              </span>
              <Play size={16} />
            </Link>
          </div>
        </div>

        <div className="lab-surface ss-dashboard-page__quick-panel p-5">
          <div className="ss-dashboard-page__panel-head">
            <div className="space-y-2">
              <div className="kicker">{t("dashboardDesk.recommendations")}</div>
              <div className="ss-dashboard-page__section-title">{t("dashboardDesk.recommendations")}</div>
              <p className="lab-meta">{t("dashboardDesk.recommendationsHint")}</p>
            </div>
          </div>

          <div className="ss-dashboard-page__quick-grid">
            {quickActions.map((item) => {
              const Icon = item.icon;

              return (
                <Link key={item.title} to={item.to} className="ss-dashboard-page__quick-card">
                  <div className="ss-dashboard-page__quick-card-copy">
                    <span className="ss-dashboard-page__icon-badge">
                      <Icon size={14} />
                    </span>
                    <div>
                      <div className="ss-dashboard-page__item-title">{item.title}</div>
                      <p className="ss-dashboard-page__muted ss-dashboard-page__quick-card-hint">
                        {item.hint}
                      </p>
                    </div>
                  </div>
                  <ArrowRight size={16} className="ss-dashboard-page__item-arrow" />
                </Link>
              );
            })}
          </div>

          {scenePreview.length > 0 ? (
            <div className="ss-dashboard-page__scene-strip">
              <div className="ss-dashboard-page__panel-head">
                <div className="space-y-2">
                  <div className="kicker">{t("dashboardDesk.scenarioEntry")}</div>
                  <div className="ss-dashboard-page__section-title">{t("dashboardDesk.scenarioEntry")}</div>
                  <p className="lab-meta">{t("dashboardDesk.scenarioEntryHint")}</p>
                </div>
                <Link to="/simulations/new" className="button button-ghost inline-flex items-center gap-2">
                  {t("dashboardDesk.openScenarioLibrary")}
                  <ArrowRight size={16} />
                </Link>
              </div>

              <div className="ss-dashboard-page__scene-grid">
                {scenePreview.map((scene) => (
                  <Link key={scene.id} to="/simulations/new" className="ss-dashboard-page__scene-card">
                    <div className="ss-dashboard-page__scene-title">
                      {getLocalizedScenarioName(t, scene)}
                    </div>
                    <div className="ss-dashboard-page__meta-row">
                      <span>
                        {t("common.actions")}: {(scene.category_actions ?? scene.actions ?? []).length}
                      </span>
                      <ArrowRight size={15} className="ss-dashboard-page__item-arrow" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
