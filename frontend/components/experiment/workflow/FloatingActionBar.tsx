import React from "react";

interface FloatingActionBarProps {
  prevLabel: string;
  onPrev: () => void;
  prevDisabled?: boolean;
  saveLabel: string;
  onSave: () => void;
  saveState?: string | null;
  hint?: string | null;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
}

export const FloatingActionBar: React.FC<FloatingActionBarProps> = ({
  prevLabel,
  onPrev,
  prevDisabled,
  saveLabel,
  onSave,
  saveState,
  hint,
  primaryLabel,
  onPrimary,
  primaryDisabled,
}) => (
  <div className="ss-floating-bar">
    <button
      type="button"
      onClick={onPrev}
      disabled={prevDisabled}
      className="ss-workflow-button ss-workflow-button--ghost"
    >
      {prevLabel}
    </button>

    <div className="ss-floating-bar__center">
      <button
        type="button"
        onClick={onSave}
        className="ss-workflow-button ss-workflow-button--secondary"
      >
        {saveLabel}
      </button>
      {saveState || hint ? (
        <span className={`ss-floating-bar__state${hint && !saveState ? " is-hint" : ""}`.trim()}>
          {saveState || hint}
        </span>
      ) : null}
    </div>

    <button
      type="button"
      onClick={onPrimary}
      disabled={primaryDisabled}
      className="ss-workflow-button ss-workflow-button--primary"
    >
      {primaryLabel}
    </button>
  </div>
);

export default FloatingActionBar;
