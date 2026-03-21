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
import { NavBar } from './NavBar';

interface ExperimentBuilderModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onComplete?: (config: unknown) => void;
  presentation?: 'modal' | 'page';
}

export const ExperimentBuilderModal: React.FC<ExperimentBuilderModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  presentation = 'modal',
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
        // Only use rolePrompt if explicitly provided - let backend handle identity from name
        const rolePrompt = agentType.rolePrompt?.trim() || null;
        const userProfile = agentType.userProfile?.trim() || '';

        // Determine unique ID and name for each agent instance
        const suffix = count > 1 ? ` ${i + 1}` : '';
        const idSuffix = count > 1 ? `-${i}` : '';

        // Use avatarUrl from properties if available, otherwise generate one
        const avatarUrl = props.avatarUrl as string ||
          `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(agentType.label || 'agent') + i}`;

        // Get LLM config - use agent type's provider if set, otherwise use global selection
        const providerId = agentType.providerId ?? state.selectedProviderId;
        const selectedProvider = state.llmProviders.find((p) => p.id === providerId);
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
          role: rolePrompt || '',
          role_prompt: rolePrompt,  // snake_case for backend
          profile: userProfile || rolePrompt || '',  // backend expects 'profile' or 'user_profile'
          user_profile: userProfile || '',  // snake_case for backend
          avatarUrl: avatarUrl,
          llm_config: llmConfig,
          provider_id: providerId,  // Track which provider this agent uses
          properties: {
            ...props,
            avatarUrl: avatarUrl,  // Ensure avatarUrl is in properties
          },
          history: {},
          memory: [],
          knowledgeBase: [],
          score: 0,  // Initialize score for agents that need it
        });
      }

      return agents;
    };

    // Create custom agents array from agent types
    const customAgents = state.agentTypes.flatMap(convertAgentToSimulationAgent);

    // Build action list with full objects (including descriptions)
    const allAvailableActions = state.availableActions || [];
    const selectedActionObjects = allAvailableActions.filter(
      (a: any) => state.selectedActionIds.includes(a.name)
    );

    // Get scenario for backend
    const scenarioData = state.selectedScenarioData;

    // Resolve description: prefer user-edited, otherwise scenario default, then generic fallback
    const resolvedDescription =
      scenarioDescription && scenarioDescription.trim().length > 0
        ? scenarioDescription
        : scenarioData?.description || t('experimentBuilder.customExperiment');

    // Build generic config with full action objects and parameters
    const genericConfig: any = {
      description: resolvedDescription,
      scenario_id: state.selectedScenarioId || 'custom',
      actions: selectedActionObjects.map((a: any) => ({
        name: a.name,
        description: a.description || a.name,
      })),
      parameters: state.scenarioParams || {},
      round_visibility: state.roundVisibility || 'simultaneous',
    };

    // Determine scene type: policy cascade uses dedicated scene, otherwise experiment/generic
    const isPolicyCascade =
      scenarioData?.id === 'policy_diffusion' ||
      scenarioData?.id === 'policyDiffusion' ||
      (scenarioData?.name || '').toLowerCase().includes('policy') ||
      (scenarioData?.name || '').includes('政策');

    // Determine if this uses the new Three-Layer Architecture
    // (strategic_decisions or any scenario with structured actions)
    const isNewArchitecture = scenarioData?.category === 'game_theory' ||
                             scenarioData?.category === 'discussion' ||
                             scenarioData?.category === 'grid' ||
                             scenarioData?.category === 'social_dynamics' ||
                             scenarioData?.category === 'social_deduction' ||
                             scenarioData?.category === 'spatial';

    addSimulation(
      name,
      {
        id: 'experiment-template',
        name: name,
        description: resolvedDescription,
        category: (scenarioData?.category || 'custom') as const,
        sceneType: isPolicyCascade ? 'policy_cascade_scene' : isNewArchitecture ? 'experiment' : 'generic',
        agents: customAgents,
        defaultTimeConfig: {
          baseTime: new Date().toISOString(),
          unit: 'hour' as const,
          step: 1,
        },
        genericConfig: genericConfig,
        defaultNetwork: state.socialNetwork || {},
      },
      undefined,
      undefined
    );

    addNotification('success', t('experimentBuilder.experimentCreated'));

    if (onComplete) {
      onComplete({});
    } else if (presentation === 'modal') {
      handleClose();
    }
  };

  // Early return if modal should not be visible
  if (!isModalOpen) {
    return null;
  }

  if (presentation === 'page') {
    return (
      <div className="ss-setup-page">
        <NavBar variant="product" />
        <div className="ss-setup-page__viewport">
          <ExperimentBuilder
            onComplete={handleComplete}
            onCancel={handleClose}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="ss-setup-modal">
      <div className="ss-setup-modal__dialog">
        <button
          onClick={handleClose}
          className="ss-setup-modal__close"
          aria-label={t('experimentBuilder.close')}
        >
          <X size={18} />
        </button>
        <div className="ss-setup-modal__body">
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
