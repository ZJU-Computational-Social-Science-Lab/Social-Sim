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
import { useExperimentBuilder, STEPS } from '../../store/experiment-builder';
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
    selectedScenarioId,
    scenarioDescription,
    selectedActionIds,
    agentTypes,
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
        return selectedScenarioId !== null;
      case 2:
        return scenarioDescription.trim() !== '';
      case 3:
        return selectedActionIds.length >= 1;
      case 4:
        // Total agent count >= 1
        const totalAgents = agentTypes.reduce((sum, type) => sum + (type.count || 0), 0);
        return totalAgents >= 1;
      case 5:
        return true; // Review page - always allowed
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
