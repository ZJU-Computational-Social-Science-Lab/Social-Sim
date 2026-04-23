import React from "react";
import { useNavigate } from "react-router-dom";
import { GUIDE_HINTS_STORAGE_KEY, JUMP_THEN_FOCUS_DELAY_MS } from "./constants";
import { focusGuideElement, focusStepFourTarget, focusStepFiveTarget } from "./guideHelpers";

type StepId = 1 | 2 | 3 | 4 | 5 | 6;
type LaunchGap = "scenario" | "actions" | "participants" | "structure" | null;

interface UseBuilderNavigationParams {
  setCurrentStep: (step: StepId) => void;
  firstLaunchGap: LaunchGap;
  launchProviderReady: boolean;
  launchParticipantsReady: boolean;
}

interface UseBuilderNavigationReturn {
  guideOpen: boolean;
  setGuideOpen: (open: boolean) => void;
  jumpToWorkflowStep: (step: StepId, after?: () => void) => void;
  jumpToLaunchGap: () => void;
}

export const useBuilderNavigation = ({
  setCurrentStep,
  firstLaunchGap,
  launchProviderReady,
  launchParticipantsReady,
}: UseBuilderNavigationParams): UseBuilderNavigationReturn => {
  const navigate = useNavigate();
  const [guideOpen, setGuideOpen] = React.useState(false);

  const jumpToWorkflowStep = React.useCallback(
    (step: StepId, after?: () => void) => {
      setGuideOpen(false);
      setCurrentStep(step);
      if (after) {
        window.setTimeout(after, JUMP_THEN_FOCUS_DELAY_MS);
      }
    },
    [setCurrentStep]
  );

  const jumpToLaunchGap = React.useCallback(() => {
    if (!launchProviderReady) {
      setGuideOpen(false);
      navigate("/settings?tab=providers_llm");
      return;
    }
    if (firstLaunchGap === "scenario") {
      jumpToWorkflowStep(1, () => focusGuideElement("ss-step1-template-library"));
      return;
    }
    if (firstLaunchGap === "actions") {
      jumpToWorkflowStep(3, () => focusGuideElement("ss-step3-action-library"));
      return;
    }
    if (firstLaunchGap === "participants") {
      jumpToWorkflowStep(
        4,
        () => focusStepFourTarget(!launchParticipantsReady ? "name" : "provider")
      );
      return;
    }
    if (firstLaunchGap === "structure") {
      jumpToWorkflowStep(5, () => focusStepFiveTarget("templates"));
      return;
    }
  }, [firstLaunchGap, jumpToWorkflowStep, launchParticipantsReady, launchProviderReady, navigate]);

  return { guideOpen, setGuideOpen, jumpToWorkflowStep, jumpToLaunchGap };
};

// ---------------------------------------------------------------------------
// Dismissed guide-hint persistence
// ---------------------------------------------------------------------------

interface UseDismissedHintsReturn {
  dismissedGuideHints: string[];
  dismissGuideHint: (hintId: string) => void;
}

export const useDismissedHints = (): UseDismissedHintsReturn => {
  const [dismissedGuideHints, setDismissedGuideHints] = React.useState<string[]>([]);

  React.useEffect(() => {
    const raw = localStorage.getItem(GUIDE_HINTS_STORAGE_KEY);
    setDismissedGuideHints(raw ? JSON.parse(raw) : []);
  }, []);

  const dismissGuideHint = React.useCallback((hintId: string) => {
    setDismissedGuideHints((current) => {
      if (current.includes(hintId)) return current;
      const next = [...current, hintId];
      localStorage.setItem(GUIDE_HINTS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { dismissedGuideHints, dismissGuideHint };
};
