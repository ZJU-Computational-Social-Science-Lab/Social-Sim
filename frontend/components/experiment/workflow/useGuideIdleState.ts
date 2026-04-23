import React from "react";
import { SS_EVENTS, IDLE_HINT_DELAY_MS, STEP_SIX_ENTRY_WINDOW_MS } from "./constants";

interface StepIdleState {
  // Step 1 idle hint
  stepOneIdleReady: boolean;
  // Step 5 idle hint + preset/advanced tracking
  stepFiveIdleReady: boolean;
  stepFiveSelectedPreset: string | null;
  stepFiveAdvancedTarget: string | null;
  // Step 6 entry window
  stepSixEntryWindow: boolean;
}

/**
 * Manages all the step-specific idle timers and guide-state event listeners
 * that drive the guide hint bubble in ExperimentBuilder.
 */
export const useGuideIdleState = (
  currentStep: number,
  templateReady: boolean,
  structureConfirmed: boolean
): StepIdleState => {
  const [stepOneInteractionTick, setStepOneInteractionTick] = React.useState(0);
  const [stepOneIdleReady, setStepOneIdleReady] = React.useState(false);

  const [stepFiveInteractionTick, setStepFiveInteractionTick] = React.useState(0);
  const [stepFiveIdleReady, setStepFiveIdleReady] = React.useState(false);
  const [stepFiveSelectedPreset, setStepFiveSelectedPreset] = React.useState<string | null>(null);
  const [stepFiveAdvancedTarget, setStepFiveAdvancedTarget] = React.useState<string | null>(null);

  const [stepSixEntryWindow, setStepSixEntryWindow] = React.useState(false);

  // Step 1: listen for interaction events to reset idle timer
  React.useEffect(() => {
    const handle = () => setStepOneInteractionTick((v) => v + 1);
    window.addEventListener(SS_EVENTS.STEP1_INTERACTION, handle);
    return () => window.removeEventListener(SS_EVENTS.STEP1_INTERACTION, handle);
  }, []);

  // Step 1: start idle timer; fire when user is idle and hasn't picked a template
  React.useEffect(() => {
    if (currentStep !== 1 || templateReady) {
      setStepOneIdleReady(false);
      return;
    }
    setStepOneIdleReady(false);
    const timer = window.setTimeout(() => setStepOneIdleReady(true), IDLE_HINT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [currentStep, stepOneInteractionTick, templateReady]);

  // Step 5: listen for guide-state events emitted by Step5Network
  React.useEffect(() => {
    const handle = (rawEvent: Event) => {
      const event = rawEvent as CustomEvent<{
        type?: string;
        preset?: string;
        target?: string;
      }>;
      const detail = event.detail || {};

      if (detail.type === "interaction") {
        setStepFiveInteractionTick((v) => v + 1);
        return;
      }
      if (detail.type === "template-selected") {
        setStepFiveSelectedPreset(detail.preset || null);
        setStepFiveInteractionTick((v) => v + 1);
        return;
      }
      if (detail.type === "advanced-opened") {
        setStepFiveAdvancedTarget(detail.target || null);
        setStepFiveInteractionTick((v) => v + 1);
        return;
      }
    };

    window.addEventListener(SS_EVENTS.STEP5_GUIDE_STATE, handle as EventListener);
    return () => window.removeEventListener(SS_EVENTS.STEP5_GUIDE_STATE, handle as EventListener);
  }, []);

  // Step 5: idle timer (no preset selected)
  React.useEffect(() => {
    if (currentStep !== 5 || stepFiveSelectedPreset) {
      setStepFiveIdleReady(false);
      return;
    }
    setStepFiveIdleReady(false);
    const timer = window.setTimeout(() => setStepFiveIdleReady(true), IDLE_HINT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [currentStep, stepFiveInteractionTick, stepFiveSelectedPreset]);

  // Step 5: auto-set preset when structure is confirmed externally
  React.useEffect(() => {
    if (currentStep !== 5) {
      setStepFiveAdvancedTarget(null);
      return;
    }
    if (structureConfirmed && !stepFiveSelectedPreset) {
      setStepFiveSelectedPreset("configured");
    }
    if (!structureConfirmed) {
      setStepFiveSelectedPreset(null);
      setStepFiveAdvancedTarget(null);
    }
  }, [currentStep, stepFiveSelectedPreset, structureConfirmed]);

  // Step 6: brief entry window after switching to final step
  React.useEffect(() => {
    if (currentStep !== 6) {
      setStepSixEntryWindow(false);
      return;
    }
    setStepSixEntryWindow(true);
    const timer = window.setTimeout(() => setStepSixEntryWindow(false), STEP_SIX_ENTRY_WINDOW_MS);
    return () => window.clearTimeout(timer);
  }, [currentStep]);

  return {
    stepOneIdleReady,
    stepFiveIdleReady,
    stepFiveSelectedPreset,
    stepFiveAdvancedTarget,
    stepSixEntryWindow,
  };
};
