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
import { useThemeStore } from '../store/theme';
import {
  buildScenarioTitle,
  getLocalizedScenarioDescription,
  getLocalizedScenarioName,
} from '../utils/scenarioLocalization';

interface ExperimentBuilderModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onComplete?: (config: unknown) => void;
  presentation?: 'modal' | 'page';
}

export function launchExperimentFromBuilderState({
  t,
  addSimulation,
  addNotification,
}: {
  t: (key: string, options?: Record<string, unknown>) => string;
  addSimulation: (...args: any[]) => void;
  addNotification: ((type: string, message: string) => void) | undefined;
}) {
  const state = useExperimentBuilder.getState();
  const localizedScenarioName = getLocalizedScenarioName(t, state.selectedScenarioData);
  const localizedScenarioDescription = getLocalizedScenarioDescription(
    t,
    state.selectedScenarioData,
  );

  const scenarioName = localizedScenarioName || t('experimentBuilder.newExperiment');
  const scenarioDescription = state.scenarioDescription || '';

  const convertAgentToSimulationAgent = (agentType: any) => {
    const count = agentType.count || 1;
    const props = agentType.properties || {};
    const agents = [];

    for (let i = 0; i < count; i++) {
      const rolePrompt = agentType.rolePrompt?.trim() || null;
      const userProfile = agentType.userProfile?.trim() || '';
      const suffix = count > 1 ? ` ${i + 1}` : '';
      const idSuffix = count > 1 ? `-${i}` : '';
      const avatarUrl = props.avatarUrl as string ||
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(agentType.label || 'agent') + i}`;

      const providerId = agentType.providerId ?? state.selectedProviderId;
      const selectedProvider = state.llmProviders.find((provider) => provider.id === providerId);
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
        role_prompt: rolePrompt,
        profile: userProfile || rolePrompt || '',
        user_profile: userProfile || '',
        avatarUrl,
        llm_config: llmConfig,
        provider_id: providerId,
        properties: {
          ...props,
          avatarUrl,
        },
        history: {},
        memory: [],
        knowledgeBase: [],
        score: 0,
      });
    }

    return agents;
  };

  const customAgents = state.agentTypes.flatMap(convertAgentToSimulationAgent);
  const allAvailableActions = state.availableActions || [];
  const selectedActionObjects = allAvailableActions.filter(
    (action: any) => state.selectedActionIds.includes(action.name)
  );
  const scenarioData = state.selectedScenarioData;
  const resolvedDescription =
    scenarioDescription && scenarioDescription.trim().length > 0
      ? scenarioDescription
      : localizedScenarioDescription || t('experimentBuilder.customExperiment');

  const name = buildScenarioTitle(scenarioName, resolvedDescription);
  const genericConfig: any = {
    description: resolvedDescription,
    scenario_id: state.selectedScenarioId || 'custom',
    actions: selectedActionObjects.map((action: any) => ({
      name: action.name,
      description: action.description || action.name,
    })),
    parameters: state.scenarioParams || {},
    round_visibility: state.roundVisibility || 'simultaneous',
  };

  const isPolicyCascade =
    scenarioData?.id === 'policy_diffusion' ||
    scenarioData?.id === 'policyDiffusion' ||
    (scenarioData?.name || '').toLowerCase().includes('policy') ||
    (scenarioData?.name || '').includes('政策');

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
      name,
      description: resolvedDescription,
      category: (scenarioData?.category || 'custom') as const,
      sceneType: isPolicyCascade ? 'policy_cascade_scene' : isNewArchitecture ? 'experiment' : 'generic',
      agents: customAgents,
      defaultTimeConfig: {
        baseTime: new Date().toISOString(),
        unit: 'hour' as const,
        step: 1,
      },
      genericConfig,
      defaultNetwork: state.socialNetwork || {},
    },
    undefined,
    undefined,
  );

  addNotification?.('success', t('experimentBuilder.experimentCreated'));
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
  const themeMode = useThemeStore((state) => state.mode);

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
    launchExperimentFromBuilderState({ t, addSimulation, addNotification });

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
      <div className={`ss-setup-page ${themeMode === 'dark' ? 'is-dark' : 'is-light'}`}>
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
