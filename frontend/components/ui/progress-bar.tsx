/**
 * Progress Bar UI Component
 *
 * Displays step progress for experiment builder wizard.
 */

import React from 'react';

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
  return (
    <div className="w-full">
      {/* Step indicators */}
      <div className="flex justify-between mb-2">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = completed.includes(stepNumber);
          const isCurrent = stepNumber === current;
          const isPast = stepNumber < current;

          return (
            <div key={step.id} className="flex-1 text-center">
              <div
                className={`
                  inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
                  ${isCompleted || isPast
                    ? 'bg-green-500 text-white'
                    : isCurrent
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-600'
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
          return (
            <div key={step.id} className="flex-1 text-center px-1">
              <div className={`text-xs font-medium ${isCurrent ? 'text-blue-600' : 'text-gray-600'}`}>
                {step.title}
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
