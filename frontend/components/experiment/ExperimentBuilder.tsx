import React from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  Layers3,
  Network,
  Save,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";

import { useExperimentBuilder, STEPS } from "../../store/experiment-builder";
import { useSimulationStore } from "../../store";
import { Button } from "../ui/button";
import { ProgressBar } from "../ui/progress-bar";
import { Step1InteractionType } from "./Step1InteractionType";
import { Step2StarterTemplate } from "./Step2StarterTemplate";
import { Step3Scenario } from "./Step3Scenario";
import { Step4Agents } from "./Step4Agents";
import { Step5Network } from "./Step5Network";
import { Step6Structure } from "./Step6Structure";

interface ExperimentBuilderProps {
  onComplete?: (config: unknown) => void;
  onCancel?: () => void;
  onBackToHall?: () => void;
}

const DRAFT_KEY = "socialsim4.experiment-draft";

const STEP_ICONS = {
  1: Sparkles,
  2: Layers3,
  3: Wand2,
  4: Users,
  5: Network,
  6: Eye,
} as const;

function countLinks(network: Record<string, string[]>): number {
  const seen = new Set<string>();
  Object.entries(network || {}).forEach(([source, targets]) => {
    targets.forEach((target) => {
      const key = source < target ? `${source}|${target}` : `${target}|${source}`;
      seen.add(key);
    });
  });
  return seen.size;
}

export const ExperimentBuilder: React.FC<ExperimentBuilderProps> = ({
  onComplete,
  onCancel,
  onBackToHall,
}) => {
  const { t } = useTranslation();
  const addNotification = useSimulationStore((state) => state.addNotification);
  const {
    currentStep,
    completedSteps,
    selectedScenarioData,
    selectedScenarioId,
    scenarioDescription,
    scenarioParams,
    availableActions,
    selectedActionIds,
    agentTypes,
    agentMode,
    socialNetwork,
    nextStep,
    prevStep,
    setCurrentStep,
    markStepComplete,
  } = useExperimentBuilder();

  const totalAgents = agentTypes.reduce((sum, agent) => sum + (agent.count || 0), 0);
  const selectedActions = availableActions.filter((action) =>
    selectedActionIds.includes(action.name),
  );
  const linkCount = countLinks(socialNetwork || {});

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return selectedScenarioId !== null;
      case 2:
        return scenarioDescription.trim() !== "";
      case 3:
        return selectedActionIds.length > 0;
      case 4:
        return totalAgents > 0;
      case 5:
      case 6:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!canProceed()) return;
    markStepComplete(currentStep);
    nextStep();
  };

  const handleBack = () => {
    if (currentStep === 1 && onBackToHall) {
      onBackToHall();
      return;
    }
    prevStep();
  };

  const handleJump = (step: 1 | 2 | 3 | 4 | 5 | 6) => {
    if (step === currentStep) return;
    if (step < currentStep || completedSteps.has((step - 1) as 1 | 2 | 3 | 4 | 5 | 6)) {
      setCurrentStep(step);
    }
  };

  const handleSaveDraft = () => {
    const state = useExperimentBuilder.getState();
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        ...state,
        completedSteps: Array.from(state.completedSteps),
      }),
    );
    addNotification?.("success", "Draft saved to this browser.");
  };

  const handleComplete = () => {
    const state = useExperimentBuilder.getState();
    onComplete?.(state);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1InteractionType />;
      case 2:
        return <Step2StarterTemplate />;
      case 3:
        return <Step3Scenario />;
      case 4:
        return <Step4Agents />;
      case 5:
        return <Step5Network />;
      case 6:
        return <Step6Structure />;
      default:
        return null;
    }
  };

  return (
    <div className="studio-shell">
      <header className="studio-header">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" className="icon-button square" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="page-hero__eyebrow w-fit">Create Experiment Studio</div>
            <div className="mt-3 flex items-center gap-3">
              <h1 className="font-[var(--sim-font-display)] text-[1.45rem] font-bold text-[var(--sim-text-strong)]">
                {STEPS[currentStep - 1]?.title}
              </h1>
              <span className="status-pill">Step {currentStep} / 6</span>
            </div>
            <p className="mt-2 text-sm text-[var(--sim-text-muted)]">
              {STEPS[currentStep - 1]?.description}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="button-ghost" onClick={handleSaveDraft}>
            <Save className="h-4 w-4" />
            Save draft
          </button>
          <button type="button" className="button-ghost" onClick={onCancel}>
            Exit
          </button>
          {currentStep < 6 ? (
            <button
              type="button"
              className="button"
              onClick={handleNext}
              disabled={!canProceed()}
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" className="button" onClick={handleComplete}>
              Launch experiment
              <Sparkles className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      <div className="studio-layout">
        <aside className="studio-side">
          <section className="studio-surface studio-side__card">
            <div className="text-sm font-bold text-[var(--sim-text-strong)]">Journey</div>
            <div className="mt-4 studio-step-list">
              {STEPS.map((step) => {
                const Icon = STEP_ICONS[step.id as keyof typeof STEP_ICONS];
                const isCurrent = step.id === currentStep;
                const isDone = completedSteps.has(step.id as 1 | 2 | 3 | 4 | 5 | 6);

                return (
                  <button
                    key={step.id}
                    type="button"
                    className={`studio-step ${isCurrent ? "active" : ""} ${isDone ? "done" : ""}`.trim()}
                    onClick={() => handleJump(step.id as 1 | 2 | 3 | 4 | 5 | 6)}
                  >
                    <span className="studio-step__index">
                      {isDone ? <CheckCircle2 className="h-4 w-4" /> : step.id}
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="flex items-center gap-2 text-sm font-bold text-[var(--sim-text-strong)]">
                        <Icon className="h-4 w-4 text-[var(--sim-text-soft)]" />
                        {step.title}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--sim-text-muted)]">
                        {step.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="studio-surface studio-side__card">
            <div className="text-sm font-bold text-[var(--sim-text-strong)]">Progress</div>
            <div className="mt-4">
              <ProgressBar
                current={currentStep}
                total={6}
                completed={Array.from(completedSteps)}
                steps={STEPS}
              />
            </div>
          </section>
        </aside>

        <main className="studio-main">
          <section className="studio-surface studio-main__card">{renderStep()}</section>
        </main>

        <aside className="studio-brief">
          <section className="studio-surface studio-brief__card">
            <div className="text-sm font-bold text-[var(--sim-text-strong)]">Current world</div>
            <div className="mt-4 studio-field-group">
              <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--sim-text-soft)]">
                Scenario
              </div>
              <div className="text-[1.02rem] font-bold text-[var(--sim-text-strong)]">
                {selectedScenarioData?.name || "Choose a starting world"}
              </div>
              <div className="text-sm leading-7 text-[var(--sim-text-muted)]">
                {selectedScenarioData?.description || "Your selected scenario will shape parameters, actions, and preview guidance here."}
              </div>
            </div>
          </section>

          <section className="studio-surface studio-brief__card">
            <div className="text-sm font-bold text-[var(--sim-text-strong)]">Live briefing</div>
            <div className="mt-4 space-y-4">
              <div className="studio-field-group">
                <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--sim-text-soft)]">
                  Parameter footprint
                </div>
                <div className="text-[1.45rem] font-bold text-[var(--sim-text-strong)]">
                  {Object.keys(scenarioParams || {}).length}
                </div>
                <div className="text-sm text-[var(--sim-text-muted)]">
                  Configured knobs and rules influencing the experiment.
                </div>
              </div>

              <div className="studio-field-group">
                <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--sim-text-soft)]">
                  Action space
                </div>
                <div className="text-[1.45rem] font-bold text-[var(--sim-text-strong)]">
                  {selectedActionIds.length}
                </div>
                <div className="text-sm text-[var(--sim-text-muted)]">
                  {selectedActions.slice(0, 3).map((action) => action.name).join(", ") || "No actions selected yet."}
                </div>
              </div>

              <div className="studio-field-group">
                <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--sim-text-soft)]">
                  Agent population
                </div>
                <div className="text-[1.45rem] font-bold text-[var(--sim-text-strong)]">
                  {totalAgents}
                </div>
                <div className="text-sm text-[var(--sim-text-muted)]">
                  Mode: {agentMode}. {agentTypes.slice(0, 2).map((agent) => agent.label).join(", ") || "No agents configured yet."}
                </div>
              </div>

              <div className="studio-field-group">
                <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--sim-text-soft)]">
                  Network shape
                </div>
                <div className="text-[1.45rem] font-bold text-[var(--sim-text-strong)]">
                  {linkCount}
                </div>
                <div className="text-sm text-[var(--sim-text-muted)]">
                  Unique edges currently defined for the social graph.
                </div>
              </div>
            </div>
          </section>

          <section className="studio-surface studio-brief__card">
            <div className="text-sm font-bold text-[var(--sim-text-strong)]">Launch check</div>
            <div className="mt-4 space-y-3 text-sm text-[var(--sim-text-muted)]">
              <div className={selectedScenarioId ? "text-[var(--sim-success)]" : ""}>
                1. Scenario selected
              </div>
              <div className={scenarioDescription.trim() ? "text-[var(--sim-success)]" : ""}>
                2. Scenario description refined
              </div>
              <div className={selectedActionIds.length > 0 ? "text-[var(--sim-success)]" : ""}>
                3. Action space enabled
              </div>
              <div className={totalAgents > 0 ? "text-[var(--sim-success)]" : ""}>
                4. Agent population configured
              </div>
              <div className={currentStep === 6 ? "text-[var(--sim-success)]" : ""}>
                5. Final prompt preview reviewed
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default ExperimentBuilder;
