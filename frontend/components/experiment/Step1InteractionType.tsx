import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, CheckCircle2, Network, Sparkles } from "lucide-react";

import { useExperimentBuilder } from "../../store/experiment-builder";
import { getAllScenarios, type ScenarioData } from "../../services/scenarios";

const CATEGORY_ORDER = [
  "game_theory",
  "social_dynamics",
  "discussion",
  "spatial",
  "social_deduction",
  "sociology",
  "custom",
] as const;

export const Step1InteractionType: React.FC = () => {
  const { t } = useTranslation();
  const {
    selectedScenarioId,
    setSelectedScenarioId,
    setSelectedScenarioData,
    markStepComplete,
  } = useExperimentBuilder();

  const [scenarios, setScenarios] = useState<ScenarioData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchScenarios = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getAllScenarios();
        if (active) {
          setScenarios(data);
        }
      } catch (fetchError) {
        if (active) {
          setError(fetchError instanceof Error ? fetchError.message : "Failed to fetch scenarios");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchScenarios();
    return () => {
      active = false;
    };
  }, []);

  const groupedScenarios = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        items: scenarios.filter((scenario) => scenario.category === category),
      })).filter((group) => group.items.length > 0),
    [scenarios],
  );

  const selectedScenario = scenarios.find((scenario) => scenario.id === selectedScenarioId) || null;

  const handleSelectScenario = (scenario: ScenarioData) => {
    setSelectedScenarioId(scenario.id);
    setSelectedScenarioData(scenario);
    markStepComplete(1);
  };

  if (loading) {
    return (
      <div className="settings-section-card">
        <div className="flex items-center gap-3 text-[var(--sim-text-muted)]">
          <span className="spinner" />
          {t("common.loading")}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="settings-section-card">
        <div className="text-sm font-semibold text-[var(--sim-danger)]">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="studio-pane-grid two">
        <section className="studio-field-group">
          <div className="page-hero__eyebrow w-fit">
            <Sparkles className="h-3.5 w-3.5" />
            Step 1
          </div>
          <h2 className="text-[1.4rem] font-bold text-[var(--sim-text-strong)]">
            Choose the social world you want to enter.
          </h2>
          <p className="text-sm leading-7 text-[var(--sim-text-muted)]">
            Each scenario sets the initial power dynamics, default parameters, and the action
            grammar available to the agents later in the studio.
          </p>
        </section>

        <section className="studio-field-group">
          <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--sim-text-soft)]">
            Current selection
          </div>
          <div className="text-[1.12rem] font-bold text-[var(--sim-text-strong)]">
            {selectedScenario?.name || "No scenario selected yet"}
          </div>
          <div className="text-sm leading-7 text-[var(--sim-text-muted)]">
            {selectedScenario?.description ||
              "Pick a scenario and the rest of the studio will immediately adapt: parameters, action space, agent guidance, and network hints."}
          </div>
        </section>
      </div>

      {groupedScenarios.map((group) => (
        <section key={group.category} className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="page-hero__eyebrow w-fit">
                {t(`scenario.category.${group.category}`, { defaultValue: group.category })}
              </div>
              <div className="mt-3 text-lg font-bold text-[var(--sim-text-strong)]">
                {t(`scenario.category.${group.category}`, { defaultValue: group.category })}
              </div>
            </div>
            <span className="status-pill">{group.items.length} options</span>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {group.items.map((scenario) => {
              const isSelected = selectedScenarioId === scenario.id;

              return (
                <button
                  key={scenario.id}
                  type="button"
                  className={`scenario-card text-left ${isSelected ? "ring-2 ring-[rgba(51,104,200,0.22)]" : ""}`.trim()}
                  onClick={() => handleSelectScenario(scenario)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="badge">{scenario.interaction_mode || "simultaneous"}</span>
                      <span className="badge badge-outline">
                        {(scenario.category_actions || scenario.actions || []).length} actions
                      </span>
                    </div>
                    {isSelected ? (
                      <span className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-[var(--sim-primary)] text-white">
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-5">
                    <div className="text-[1.08rem] font-bold text-[var(--sim-text-strong)]">
                      {scenario.name}
                    </div>
                    <div className="mt-3 text-sm leading-7 text-[var(--sim-text-muted)]">
                      {scenario.description}
                    </div>
                  </div>

                  <div className="scenario-link-preview mt-6">
                    <span className="orbit-node breathing-node" style={{ top: "22%", left: "24%" }} />
                    <span className="orbit-node breathing-node" style={{ top: "46%", left: "60%", animationDelay: "0.4s" }} />
                    <span className="orbit-node breathing-node" style={{ bottom: "18%", left: "40%", animationDelay: "0.8s" }} />
                    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100">
                      <path d="M25 25 C38 32, 50 38, 60 48" stroke="rgba(51,104,200,0.3)" strokeWidth="1" fill="none" />
                      <path d="M60 48 C52 58, 46 68, 40 80" stroke="rgba(45,143,132,0.3)" strokeWidth="1" fill="none" />
                    </svg>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-[var(--sim-text-muted)]">
                    <Network className="h-4 w-4 text-[var(--sim-primary)]" />
                    <span>{scenario.parameters.length} configurable parameters</span>
                    {isSelected ? <ArrowRight className="ml-auto h-4 w-4 text-[var(--sim-primary)]" /> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};
