import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Activity,
  ArrowRight,
  Database,
  FolderOpen,
  PlayCircle,
  Sparkles,
  Wand2,
} from "lucide-react";

import { listSimulations } from "../services/simulations";
import { listScenes, type SceneOption } from "../services/scenes";
import { listProviders } from "../services/providers";

const ACTIONS = [
  {
    title: "Connect providers",
    description: "Set up the models that power agent reasoning and prompt generation.",
    href: "/settings/providers",
    icon: Database,
  },
  {
    title: "Browse templates",
    description: "Open the new creation studio and start from a ready-made scenario hall.",
    href: "/simulations/new",
    icon: Sparkles,
  },
  {
    title: "Read examples",
    description: "Study the docs before launching a new world or replaying an existing one.",
    href: "/docs",
    icon: FolderOpen,
  },
  {
    title: "Manage archive",
    description: "Return to saved experiments, duplicate them, or pick up unfinished runs.",
    href: "/simulations/saved",
    icon: Wand2,
  },
];

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

  const simulations = simulationsQuery.data ?? [];
  const recentSims = simulations.slice(0, 4);
  const hasProvider = (providersQuery.data ?? []).length > 0;

  const formatSceneName = (scenes: SceneOption[] | undefined, type: string) => {
    const scene = (scenes || []).find((item) => item.type === type);
    if (scene?.name) return scene.name;
    return type
      .split("_")
      .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
      .join(" ");
  };

  return (
    <div className="dashboard-layout">
      <section className="page-hero fade-in-up">
        <div className="page-hero__header">
          <div className="flex max-w-3xl flex-col gap-4">
            <div className="page-hero__eyebrow">Workspace overview</div>
            <div className="page-hero__title">
              Your simulation desk,
              <br />
              ready for the next branch.
            </div>
            <div className="text-subtitle">
              Pick up an existing experiment, open the new studio, or tighten
              your provider stack before the next run.
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to={hasProvider ? "/simulations/new" : "/settings/providers"} className="button">
              <Sparkles className="h-4 w-4" />
              New experiment
            </Link>
            {recentSims[0] ? (
              <Link to={`/simulations/${recentSims[0].id}`} className="button-ghost">
                <PlayCircle className="h-4 w-4" />
                Continue latest
              </Link>
            ) : null}
          </div>
        </div>

        <div className="page-hero__body">
          <div className="story-card">
            <div className="page-hero__eyebrow">Recent motion</div>
            <div className="mt-5 space-y-4">
              {recentSims.length > 0 ? (
                recentSims.slice(0, 3).map((simulation) => (
                  <div
                    key={simulation.id}
                    className="settings-list-item transition-transform duration-200 hover:-translate-y-0.5"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[var(--sim-text-strong)]">
                        {simulation.name || `Simulation ${simulation.id}`}
                      </div>
                      <div className="mt-1 text-xs text-[var(--sim-text-muted)]">
                        {formatSceneName(scenesQuery.data, simulation.scene_type)}
                      </div>
                    </div>
                    <span className="status-pill">{simulation.status || "active"}</span>
                  </div>
                ))
              ) : (
                <div className="studio-field-group">
                  <div className="text-sm font-bold text-[var(--sim-text-strong)]">
                    No experiments yet
                  </div>
                  <div className="text-sm leading-7 text-[var(--sim-text-muted)]">
                    Launch the new studio to seed your first social world.
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="story-card">
            <div className="page-hero__eyebrow">Readiness</div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="studio-field-group">
                <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--sim-text-soft)]">
                  Providers
                </div>
                <div className="text-[1.7rem] font-bold text-[var(--sim-text-strong)]">
                  {(providersQuery.data ?? []).length}
                </div>
                <div className="text-sm text-[var(--sim-text-muted)]">
                  Active model connections available for new experiments.
                </div>
              </div>
              <div className="studio-field-group">
                <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--sim-text-soft)]">
                  Scenes
                </div>
                <div className="text-[1.7rem] font-bold text-[var(--sim-text-strong)]">
                  {(scenesQuery.data ?? []).length}
                </div>
                <div className="text-sm text-[var(--sim-text-muted)]">
                  Scenario definitions ready to seed the create studio.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {!hasProvider ? (
        <section className="settings-section-card fade-in-up">
          <div className="settings-section-card__header">
            <div>
              <div className="page-hero__eyebrow">Before you run</div>
              <div className="mt-4 text-[1.2rem] font-bold text-[var(--sim-text-strong)]">
                Connect at least one LLM provider.
              </div>
              <div className="mt-2 text-sm leading-7 text-[var(--sim-text-muted)]">
                The new studio is ready, but agent reasoning still needs a provider configuration.
              </div>
            </div>
            <Link to="/settings/providers" className="button-ghost">
              Configure now
            </Link>
          </div>
        </section>
      ) : null}

      <section className="story-section">
        <div className="story-section__header">
          <div className="page-hero__eyebrow">Recent experiments</div>
          <h2 className="text-title">Resume from where the social world started bending.</h2>
        </div>

        {simulationsQuery.isLoading ? (
          <div className="settings-section-card">
            <div className="flex items-center gap-3 text-[var(--sim-text-muted)]">
              <span className="spinner" />
              {t("dashboard.loading", { defaultValue: "Loading simulations..." })}
            </div>
          </div>
        ) : simulationsQuery.error ? (
          <div className="settings-section-card">
            <div className="text-sm font-semibold text-[var(--sim-danger)]">
              {t("dashboard.error", { defaultValue: "Error loading simulations." })}
            </div>
          </div>
        ) : recentSims.length === 0 ? (
          <div className="settings-section-card">
            <div className="text-sm font-semibold text-[var(--sim-text-strong)]">
              Nothing saved yet.
            </div>
            <div className="text-sm leading-7 text-[var(--sim-text-muted)]">
              Start a new experiment from the scene hall and it will appear here with its status and context.
            </div>
          </div>
        ) : (
          <div className="dashboard-recent-grid">
            {recentSims.map((simulation) => (
              <Link
                key={simulation.id}
                to={`/simulations/${simulation.id}`}
                className="archive-card fade-in-up"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[var(--sim-primary-soft)] text-[var(--sim-primary)]">
                      <Activity className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[1.08rem] font-bold text-[var(--sim-text-strong)]">
                        {simulation.name || `Simulation ${simulation.id}`}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="badge badge-outline">
                          {formatSceneName(scenesQuery.data, simulation.scene_type)}
                        </span>
                        <span className="status-pill">{simulation.status || "active"}</span>
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-[var(--sim-text-soft)]" />
                </div>
                <div className="mt-8 flex items-center justify-between text-sm text-[var(--sim-text-muted)]">
                  <span>Updated</span>
                  <span>{new Date(simulation.created_at).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="story-section">
        <div className="story-section__header">
          <div className="page-hero__eyebrow">Recommended actions</div>
          <h2 className="text-title">Keep the workspace moving.</h2>
        </div>
        <div className="dashboard-actions-grid">
          {ACTIONS.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.title} to={item.href} className="action-card">
                <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[var(--sim-primary-soft)] text-[var(--sim-primary)]">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-5 text-[1.08rem] font-bold text-[var(--sim-text-strong)]">
                  {item.title}
                </div>
                <div className="mt-3 text-sm leading-7 text-[var(--sim-text-muted)]">
                  {item.description}
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
