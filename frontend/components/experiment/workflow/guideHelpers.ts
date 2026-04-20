import {
  SS_EVENTS,
  GUIDE_HIGHLIGHT_DURATION_MS,
} from "./constants";

// Dispatch a focus event to a specific UI zone in Step 2.
export const focusStepTwoTarget = (target: "scenario" | "params" | "schedule") => {
  window.dispatchEvent(new CustomEvent(SS_EVENTS.STEP2_GUIDE, { detail: { target } }));
};

// Dispatch a focus event to a specific UI zone in Step 4.
export const focusStepFourTarget = (
  target: "mode" | "name" | "registry" | "editor" | "provider"
) => {
  window.dispatchEvent(new CustomEvent(SS_EVENTS.STEP4_GUIDE, { detail: { target } }));
};

// Dispatch a focus event to a specific UI zone in Step 5.
export const focusStepFiveTarget = (
  target: "templates" | "summary" | "details" | "graph" | "links" | "roster"
) => {
  window.dispatchEvent(new CustomEvent(SS_EVENTS.STEP5_GUIDE, { detail: { target } }));
};

// Dispatch a focus event to a specific UI zone in Step 6.
export const focusStepSixTarget = (target: "status" | "checklist" | "summary" | "details") => {
  window.dispatchEvent(new CustomEvent(SS_EVENTS.STEP6_GUIDE, { detail: { target } }));
};

// Scroll an element into view and briefly add the "is-guided" highlight class.
// Direct classList manipulation here is intentional: this is an imperative,
// one-shot animation on a DOM node that lives outside React's render tree.
export const focusGuideElement = (elementId: string) => {
  const element = document.getElementById(elementId);
  if (!element) {
    return;
  }

  element.classList.remove("is-guided");
  element.scrollIntoView({ behavior: "smooth", block: "center" });

  window.requestAnimationFrame(() => {
    element.classList.add("is-guided");
    window.setTimeout(() => element.classList.remove("is-guided"), GUIDE_HIGHLIGHT_DURATION_MS);
  });
};
