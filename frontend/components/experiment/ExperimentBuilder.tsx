/**
 * Main Experiment Builder Component
 *
 * 5-step wizard for creating social science experiments:
 * 1. Select interaction patterns
 * 2. Choose starter template (optional)
 * 3. Configure scenario and mechanics
 * 4. Design agents
 * 5. Set structure, conditions, and review
 */

import React, { useEffect } from 'react';
import { useExperimentBuilder } from '../../store/experiment-builder';
import { ProgressBar } from '../ui/progress-bar';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { ValidationAlert } from './ValidationAlert';
import { ExperimentPreview } from './ExperimentPreview';

// Step components
import { Step1InteractionType } from './Step1InteractionType';
import { Step2StarterTemplate } from './Step2StarterTemplate';
import { Step3Scenario } from './Step3Scenario';
import { Step4Agents } from './Step4Agents';
import { Step5Structure } from './Step5Structure';

const STEPS = [
  { id: 1, title: 'Interaction Patterns', description: 'Choose interaction patterns' },
  { id: 2, title: 'Starter Template', description: 'Optional template to speed up' },
  { id: 3, title: 'Scenario & Mechanics', description: 'Configure your experiment' },
  { id: 4, title: 'Agent Design', description: 'Define your agents' },
  { id: 5, title: 'Structure & Review', description: 'Finalize and preview' },
];

interface ExperimentBuilderProps {
  onComplete?: (config: unknown) => void;
  onCancel?: () => void;
}

export const ExperimentBuilder: React.FC<ExperimentBuilderProps> = ({
  onComplete,
  onCancel,
}) => {
  const {
    currentStep,
    completedSteps,
    interactionTypes,
    nextStep,
    prevStep,
    setCurrentStep,
    validate,
    reset,
  } = useExperimentBuilder();

  // Validate on mount and when step changes
  useEffect(() => {
    validate();
  }, [currentStep]);

  const handleNext = () => {
    nextStep();
  };

  const handleBack = () => {
    prevStep();
  };

  const handleComplete = () => {
    const state = useExperimentBuilder.getState();
    onComplete?.(state);
  };

  const canProceed = () => {
    // Step-specific validation
    switch (currentStep) {
      case 1:
        return interactionTypes.length > 0;
      case 2:
        return true; // Optional step
      case 3:
        return true; // Will be validated
      case 4:
        return true; // Will be validated
      case 5:
        return true; // Final review
      default:
        return false;
    }
  };

  const canGoBack = () => currentStep > 1;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Create New Experiment
        </h1>
        <p className="text-gray-600 mt-1">
          Design your social science experiment in 5 steps
        </p>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <ProgressBar
          current={currentStep}
          total={5}
          completed={Array.from(completedSteps)}
          steps={STEPS}
        />
      </div>

      {/* Validation Alerts */}
      <ValidationAlert />

      {/* Step Content */}
      <Card className="mb-6">
        {currentStep === 1 && (
          <Step1InteractionType />
        )}
        {currentStep === 2 && (
          <Step2StarterTemplate />
        )}
        {currentStep === 3 && (
          <Step3Scenario />
        )}
        {currentStep === 4 && (
          <Step4Agents />
        )}
        {currentStep === 5 && (
          <Step5Structure />
        )}
      </Card>

      {/* Experiment Preview (on step 5) */}
      {currentStep === 5 && (
        <ExperimentPreview />
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <div>
          {canGoBack() && (
            <Button variant="outline" onClick={handleBack}>
              ← Back
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>

          {currentStep < 5 ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Next →
            </Button>
          ) : (
            <Button onClick={handleComplete} variant="default">
              Create Experiment
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExperimentBuilder;
