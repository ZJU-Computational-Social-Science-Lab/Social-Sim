import React from "react";
import { Check } from "lucide-react";

export interface StepInfo {
  id: number;
  title: string;
  description: string;
}

export interface ProgressBarProps {
  current: number;
  total: number;
  completed: number[];
  steps: StepInfo[];
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  current,
  total,
  completed,
  steps,
}) => {
  const progress = Math.max(0, Math.min(100, (current / total) * 100));

  return (
    <div className="flex flex-col gap-4">
      <div className="h-2 rounded-full bg-[rgba(51,104,200,0.08)]">
        <div
          className="h-full rounded-full bg-[linear-gradient(135deg,var(--sim-primary),var(--sim-primary-strong))] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCurrent = stepNumber === current;
          const isDone = completed.includes(stepNumber) || stepNumber < current;

          return (
            <div
              key={step.id}
              className={`rounded-[18px] border px-4 py-3 transition-colors ${
                isCurrent
                  ? "border-[var(--sim-border-strong)] bg-[var(--sim-primary-soft)]"
                  : isDone
                    ? "border-[rgba(47,141,99,0.18)] bg-[rgba(47,141,99,0.08)]"
                    : "border-[var(--sim-border)] bg-[rgba(255,255,255,0.35)] dark:bg-[rgba(255,255,255,0.02)]"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-[12px] border text-sm font-bold ${
                    isCurrent
                      ? "border-[rgba(51,104,200,0.22)] text-[var(--sim-primary)]"
                      : isDone
                        ? "border-transparent bg-[var(--sim-success)] text-white"
                        : "border-[var(--sim-border)] text-[var(--sim-text-soft)]"
                  }`}
                >
                  {isDone ? <Check className="h-4 w-4" /> : stepNumber}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[var(--sim-text-strong)]">
                    {step.title}
                  </div>
                  <div className="text-xs text-[var(--sim-text-muted)]">
                    {step.description}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProgressBar;
