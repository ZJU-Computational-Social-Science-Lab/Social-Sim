// Custom DOM event names dispatched between ExperimentBuilder and step sub-components.
// Use these constants on both sides so a rename is caught at compile time.
export const SS_EVENTS = {
  STEP1_INTERACTION: "ss-step1-interaction",
  STEP2_GUIDE: "ss-step2-guide",
  STEP4_GUIDE: "ss-step4-guide",
  STEP5_GUIDE: "ss-step5-guide",
  STEP5_GUIDE_STATE: "ss-step5-guide-state",
  STEP6_GUIDE: "ss-step6-guide",
} as const;

// localStorage keys used by ExperimentBuilder.
export const DRAFT_STORAGE_KEY = "socialsim4.experiment-draft";
export const GUIDE_HINTS_STORAGE_KEY = "socialsim4.guide-hints.dismissed";

// Timing constants (milliseconds).
export const IDLE_HINT_DELAY_MS = 5_000;
export const STEP_SIX_ENTRY_WINDOW_MS = 4_000;
export const GUIDE_HIGHLIGHT_DURATION_MS = 1_800;
export const JUMP_THEN_FOCUS_DELAY_MS = 220;
