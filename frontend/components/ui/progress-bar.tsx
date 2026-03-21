/**
 * Progress Bar UI Component
 *
 * Displays step progress for experiment builder wizard.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

export interface StepInfo {
  id: number;
  title: string;
  description: string;
}

// Step title translation keys mapping
const STEP_TITLE_KEYS: Record<number, string> = {
  1: 'experimentBuilder.progressBar.steps.chooseScenario',
  2: 'experimentBuilder.progressBar.steps.configureScenario',
  3: 'experimentBuilder.progressBar.steps.selectActions',
  4: 'experimentBuilder.progressBar.steps.createAgents',
  5: 'experimentBuilder.progressBar.steps.network',
  6: 'experimentBuilder.progressBar.steps.review',
};

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
  const { t } = useTranslation();

  return (
    <div className="w-full">
      {/* Step indicators */}
      <div className="flex justify-between mb-3">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = completed.includes(stepNumber);
          const isCurrent = stepNumber === current;
          const isPast = stepNumber < current;

          return (
            <div key={step.id} className="flex-1 text-center">
              <div
                className={`
                  inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm font-medium transition-all
                  ${isCompleted || isPast
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : isCurrent
                    ? 'border-slate-900 bg-slate-900 text-white shadow-[0_14px_26px_rgba(15,23,42,0.14)]'
                    : 'border-slate-200 bg-white text-slate-500'
                  }
                `}
              >
                {isCompleted || isPast ? '✓' : stepNumber}
              </div>
            </div>
          );
        })}
      </div>

      {/* Step labels */}
      <div className="flex justify-between mb-2">
        {steps.map((step) => {
          const isCurrent = steps.indexOf(step) + 1 === current;
          // Use translation key for step title, fallback to original title
          const translatedTitle = STEP_TITLE_KEYS[step.id]
            ? t(STEP_TITLE_KEYS[step.id])
            : step.title;

          return (
            <div key={step.id} className="flex-1 text-center px-1">
              <div className={`text-xs font-medium ${isCurrent ? 'text-slate-900' : 'text-slate-500'}`}>
                {translatedTitle}
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-slate-200/80">
        <div
          className="h-2 rounded-full bg-slate-900 transition-all duration-300"
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
