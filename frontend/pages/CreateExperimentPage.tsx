import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Compass, Layers3, Sparkles } from "lucide-react";

import { useThemeStore } from "../store/theme";
import { useExperimentBuilder } from "../store/experiment-builder";
import { useSimulationStore } from "../store";
import { getAllScenarios, type ScenarioData } from "../services/scenarios";
import { ExperimentBuilder } from "../components/experiment/ExperimentBuilder";
import { launchExperimentFromBuilderState } from "../components/ExperimentBuilderModal";

const CATEGORY_ORDER = [
  "game_theory",
  "social_dynamics",
  "discussion",
  "spatial",
  "social_deduction",
  "sociology",
  "custom",
] as const;

const CATEGORY_ACCENT: Record<string, string> = {
  game_theory: "badge",
  social_dynamics: "badge-purple",
  discussion: "badge-green",
  spatial: "badge-outline",
  social_deduction: "badge",
  sociology: "badge-purple",
  custom: "badge-outline",
};

export function CreateExperimentPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const applyTheme = useThemeStore((state) => state.apply);
  const addSimulation = useSimulationStore((state) => state.addSimulation);
  const addNotification = useSimulationStore((state) => state.addNotification);
  const currentSimulation = useSimulationStore((state) => state.currentSimulation);

  const {
    reset,
    selectedScenarioId,
    selectedScenarioData,
    setSelectedScenarioId,
    setSelectedScenarioData,
    markStepComplete,
    setCurrentStep,
  } = useExperimentBuilder();

  const [stage, setStage] = useState<"hall" | "studio">("hall");
  const [scenarios, setScenarios] = useState<ScenarioData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const previousSimulationIdRef = useRef<string | null>(currentSimulation?.id ?? null);

  useEffect(() => {
    applyTheme();
    reset();
  }, [applyTheme, reset]);

  useEffect(() => {
    let active = true;
    const loadScenarios = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getAllScenarios();
        if (active) {
          setScenarios(data);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load scenarios");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadScenarios();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isLaunching) return;
    if (!currentSimulation?.id) return;
    if (currentSimulation.id === previousSimulationIdRef.current) return;
    navigate(`/simulations/${currentSimulation.id}`);
  }, [currentSimulation?.id, isLaunching, navigate]);

  const groupedScenarios = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        items: scenarios.filter((scenario) => scenario.category === category),
      })).filter((group) => group.items.length > 0),
    [scenarios],
  );

  const handleSelectScenario = (scenario: ScenarioData) => {
    setSelectedScenarioId(scenario.id);
    setSelectedScenarioData(scenario);
    markStepComplete(1);
  };

  const handleEnterStudio = () => {
    if (!selectedScenarioId) return;
    setCurrentStep(2);
    setStage("studio");
  };

  const handleLaunch = () => {
    previousSimulationIdRef.current = currentSimulation?.id ?? null;
    setIsLaunching(true);
    launchExperimentFromBuilderState({ t, addSimulation, addNotification });
  };

  return (
    <div className="studio-page">
      {stage === "hall" ? (
        <div className="studio-hall">
          <section className="studio-hall__hero fade-in-up">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="max-w-3xl">
                <div className="page-hero__eyebrow">
                  <Compass className="h-3.5 w-3.5" />
                  Choose a starting world
                </div>
                <h1 className="page-hero__title mt-6">
                  Start a social experiment
                  <br />
                  with a scene worth entering.
                </h1>
                <p className="mt-6 max-w-2xl text-subtitle">
                  Pick the initial social structure, then move into the studio to shape
                  parameters, action space, agents, and the network they will inhabit.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link to="/dashboard" className="button-ghost">
                  <ArrowLeft className="h-4 w-4" />
                  Back to dashboard
                </Link>
                <button
                  type="button"
                  className="button"
                  disabled={!selectedScenarioId}
                  onClick={handleEnterStudio}
                >
                  Enter studio
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {selectedScenarioData ? (
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="studio-field-group">
                  <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--sim-text-soft)]">
                    Selected
                  </div>
                  <div className="text-lg font-bold text-[var(--sim-text-strong)]">
                    {selectedScenarioData.name}
                  </div>
                </div>
                <div className="studio-field-group">
                  <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--sim-text-soft)]">
                    Parameters
                  </div>
                  <div className="text-lg font-bold text-[var(--sim-text-strong)]">
                    {selectedScenarioData.parameters.length}
                  </div>
                </div>
                <div className="studio-field-group">
                  <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--sim-text-soft)]">
                    Action seeds
                  </div>
                  <div className="text-lg font-bold text-[var(--sim-text-strong)]">
                    {(selectedScenarioData.category_actions || selectedScenarioData.actions || []).length}
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          {loading ? (
            <section className="settings-section-card">
              <div className="flex items-center gap-3 text-[var(--sim-text-muted)]">
                <span className="spinner" />
                Loading scenario hall...
              </div>
            </section>
          ) : error ? (
            <section className="settings-section-card">
              <div className="text-sm font-semibold text-[var(--sim-danger)]">{error}</div>
            </section>
          ) : (
            groupedScenarios.map((group) => (
              <section key={group.category} className="story-section">
                <div className="story-section__header">
                  <div className={`badge ${CATEGORY_ACCENT[group.category] || "badge-outline"}`.trim()}>
                    {t(`scenario.category.${group.category}`, { defaultValue: group.category })}
                  </div>
                  <h2 className="text-title">
                    {t(`scenario.category.${group.category}`, { defaultValue: group.category })}
                  </h2>
                </div>

                <div className="studio-hall__grid">
                  {group.items.map((scenario) => (
                    <button
                      key={scenario.id}
                      type="button"
                      className={`studio-hall-card ${selectedScenarioId === scenario.id ? "selected" : ""}`.trim()}
                      onClick={() => handleSelectScenario(scenario)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className={`badge ${CATEGORY_ACCENT[scenario.category] || "badge-outline"}`.trim()}>
                          {scenario.interaction_mode || "simultaneous"}
                        </div>
                        <span className="status-pill">
                          {(scenario.category_actions || scenario.actions || []).length} actions
                        </span>
                      </div>

                      <div>
                        <div className="text-[1.12rem] font-bold text-[var(--sim-text-strong)]">
                          {scenario.name}
                        </div>
                        <div className="mt-3 text-sm leading-7 text-[var(--sim-text-muted)]">
                          {scenario.description}
                        </div>
                      </div>

                      <div className="scenario-link-preview">
                        <span className="orbit-node breathing-node" style={{ top: "20%", left: "22%" }} />
                        <span className="orbit-node breathing-node" style={{ top: "48%", left: "58%", animationDelay: "0.5s" }} />
                        <span className="orbit-node breathing-node" style={{ bottom: "18%", left: "34%", animationDelay: "0.9s" }} />
                        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100">
                          <path d="M22 26 C34 38, 46 42, 58 48" stroke="rgba(51,104,200,0.32)" strokeWidth="1" fill="none" />
                          <path d="M58 48 C48 58, 42 68, 34 82" stroke="rgba(45,143,132,0.32)" strokeWidth="1" fill="none" />
                        </svg>
                      </div>

                      <div className="mt-auto flex flex-wrap gap-2">
                        <span className="badge badge-outline">{scenario.parameters.length} parameters</span>
                        <span className="badge badge-outline">{scenario.category}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      ) : (
        <ExperimentBuilder
          onBackToHall={() => {
            setCurrentStep(1);
            setStage("hall");
          }}
          onCancel={() => navigate("/dashboard")}
          onComplete={handleLaunch}
        />
      )}
    </div>
  );
}

export default CreateExperimentPage;
