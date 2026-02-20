/**
 * Experiment Builder Modal Component
 *
 * Modal wrapper for the 5-step Experiment Builder.
 * Replaces the existing SimulationWizard with a more structured experiment creation flow.
 */

import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useExperimentBuilder } from '../store/experiment-builder';
import { ExperimentBuilder } from './experiment/ExperimentBuilder';
import { X } from 'lucide-react';
import { useSimulationStore } from '../store';

interface ExperimentBuilderModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onComplete?: (config: unknown) => void;
}

export const ExperimentBuilderModal: React.FC<ExperimentBuilderModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const { t } = useTranslation();

  // Use the main simulation store to manage modal state
  const isWizardOpen = useSimulationStore((state) => state.isWizardOpen);
  const toggleWizard = useSimulationStore((state) => state.toggleWizard);
  const addSimulation = useSimulationStore((state) => state.addSimulation);
  const addNotification = useSimulationStore((state) => state.addNotification);

  // Use prop if explicitly provided, otherwise use store state
  const useExplicitState = isOpen !== undefined;
  const isModalOpen = useExplicitState ? isOpen : isWizardOpen;

  // Reset experiment builder state when modal opens
  useEffect(() => {
    if (isModalOpen) {
      useExperimentBuilder.getState().reset();
    }
  }, [isModalOpen]);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      toggleWizard(false);
    }
  };

  const handleComplete = () => {
    // Get experiment builder state
    const state = useExperimentBuilder.getState();

    // Create simulation name from scenario
    const scenarioName = state.selectedScenarioData?.name || t('experimentBuilder.newExperiment');
    const scenarioDescription = state.scenarioDescription || '';

    // Build a descriptive name
    let name = scenarioName;
    if (scenarioDescription) {
      // Truncate description if too long
      const maxDescLength = 30;
      const description = scenarioDescription.length > maxDescLength
        ? scenarioDescription.substring(0, maxDescLength) + '...'
        : scenarioDescription;
      name = `${scenarioName} - ${description}`;
    }

    // Convert agent types to simulation agent format
    const convertAgentToSimulationAgent = (agentType: any, index: number) => {
      const count = agentType.count || 1;
      const props = agentType.properties || {};
      const agents = [];

      for (let i = 0; i < count; i++) {
        // Use rolePrompt as the profile/description
        const profile = agentType.rolePrompt || t('experimentBuilder.agent.defaultRolePrompt');
        const role = agentType.rolePrompt || '';

        // Determine unique ID and name for each agent instance
        const suffix = count > 1 ? ` ${i + 1}` : '';
        const idSuffix = count > 1 ? `-${i}` : '';

        // Use avatarUrl from properties if available, otherwise generate one
        const avatarUrl = props.avatarUrl ||
          `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(agentType.label || 'agent') + i}`;

        // Get LLM config
        const selectedProvider = state.llmProviders.find((p) => p.id === state.selectedProviderId);
        const llmConfig = selectedProvider
          ? {
              provider: selectedProvider.provider,
              model: selectedProvider.model || 'default',
            }
          : {
              provider: 'backend',
              model: 'default',
            };

        agents.push({
          name: agentType.label + suffix,
          id: agentType.id + idSuffix,
          role: role,
          rolePrompt: profile,
          avatarUrl: avatarUrl,
          llmConfig: llmConfig,
          properties: props,
          history: {},
          memory: [],
          knowledgeBase: [],
        });
      }

      return agents;
    };

    // Create custom agents array from agent types
    const customAgents = state.agentTypes.flatMap(convertAgentToSimulationAgent);

    // Build action list from selectedActionIds
    const selectedActions = state.selectedActionIds || [];

    // Get scenario for backend
    const scenarioData = state.selectedScenarioData;

    // Build generic config based on new experiment builder state
    const genericConfig: any = {
      description: scenarioDescription || t('experimentBuilder.customExperiment'),
      scenarioId: state.selectedScenarioId || 'custom',
      actions: selectedActions,
    };

    // Determine if this uses the new Three-Layer Architecture
    // (strategic_decisions or any scenario with structured actions)
    const isNewArchitecture = scenarioData?.category === 'game_theory' ||
                             scenarioData?.category === 'discussion' ||
                             scenarioData?.category === 'grid' ||
                             scenarioData?.category === 'social_dynamics' ||
                             scenarioData?.category === 'social_deduction';

    addSimulation(
      name,
      {
        id: 'experiment-template',
        name: name,
        description: scenarioDescription || t('experimentBuilder.customExperiment'),
        category: (scenarioData?.category || 'custom') as const,
        sceneType: isNewArchitecture ? 'experiment' : 'generic',
        agents: customAgents,
        defaultTimeConfig: {
          baseTime: new Date().toISOString(),
          unit: 'hour' as const,
          step: 1,
        },
        genericConfig: genericConfig,
      },
      undefined,
      undefined
    );

    addNotification('success', t('experimentBuilder.experimentCreated'));

    if (onComplete) {
      onComplete({});
    } else {
      handleClose();
    }
  };

  // Early return if modal should not be visible
  if (!isModalOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {t('experimentBuilder.modalTitle')}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label={t('experimentBuilder.close')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <ExperimentBuilder
            onComplete={handleComplete}
            onCancel={handleClose}
          />
        </div>
      </div>
    </div>
  );
};

export default ExperimentBuilderModal;
