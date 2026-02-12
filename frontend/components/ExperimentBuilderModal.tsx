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

  const handleComplete = (config: unknown) => {
    // Get experiment builder state
    const state = useExperimentBuilder.getState();

    // Convert interaction types to simulation name
    const interactionTypes = state.interactionTypes || [];
    const nameParts = interactionTypes.map((t_id) => (t(`experimentBuilder.interactionTypes.${t_id}`) as string || t_id).trim());
    const name = nameParts.length > 0
      ? nameParts.slice(0, 3).join(' + ') + (nameParts.length > 3 ? '...' : '')
      : t('experimentBuilder.newExperiment');

    // Convert agent types to simulation agent format
    const convertAgentToSimulationAgent = (agentType: any, index: number) => {
      const count = agentType.count || 1;
      const props = agentType.properties || {};

      // Determine profile: use userProfile for demographic agents, rolePrompt for manual agents
      let profile = '';
      let role = t('experimentBuilder.agent.defaultRole');
      let rolePrompt = agentType.rolePrompt || t('experimentBuilder.agent.defaultRolePrompt');

      // Check if this is a demographic-generated agent
      if (agentType.id && agentType.id.startsWith('demo-agent')) {
        // Demographic agents: use userProfile (contains generated description)
        profile = agentType.userProfile || '';

        // Build role from demographic properties
        if (props.gender && props.age_group) {
          role = `${props.gender} ${props.age_group}`;
        } else if (props.opinion !== undefined) {
          role = t('experimentBuilder.agent.agentWithOpinion', { opinion: props.opinion });
        }

        rolePrompt = role;
      } else {
        // Manual agents: use rolePrompt as the profile/description
        profile = agentType.rolePrompt || '';
      }

      // Use avatarUrl from properties if available, otherwise generate one
      const avatarUrl = props.avatarUrl ||
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(agentType.label || 'agent')}`;

      // LLM config - use selected provider from experiment builder state
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

      return {
        name: agentType.label,
        id: agentType.id,
        role: role,
        rolePrompt: rolePrompt,
        avatarUrl: avatarUrl,
        profile: profile,
        llmConfig: llmConfig,
        properties: props,
        history: {},
        memory: [],
        knowledgeBase: [],
      };
    };

    // Create custom agents array from agent types
    const customAgents = state.agentTypes.map(convertAgentToSimulationAgent);

    addSimulation(
      name,
      {
        id: 'experiment-template',
        name: name,
        description: state.scenario || t('experimentBuilder.customExperiment'),
        category: 'custom' as const,
        sceneType: 'generic',
        agents: customAgents,
        defaultTimeConfig: {
          baseTime: new Date().toISOString(),
          unit: 'hour' as const,
          step: 1,
        },
      },
      undefined,
      undefined
    );

    addNotification('success', t('experimentBuilder.experimentCreated'));

    if (onComplete) {
      onComplete(config);
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
