/**
 * Step 1: Select Interaction Patterns
 *
 * Users select from card-based options showing interaction patterns
 * with descriptions. This replaces open-ended questions with directive choices.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useExperimentBuilder } from '../../store/experiment-builder';

const INTERACTION_TYPES = [
  {
    id: 'strategic_decisions',
    translationKey: 'strategic_decisions',
    icon: '⚖️',
  },
  {
    id: 'opinions_influence',
    translationKey: 'opinions_influence',
    icon: '💭',
  },
  {
    id: 'network_spread',
    translationKey: 'network_spread',
    icon: '🌐',
  },
  {
    id: 'markets_exchange',
    translationKey: 'markets_exchange',
    icon: '💰',
  },
  {
    id: 'spatial_movement',
    translationKey: 'spatial_movement',
    icon: '🗺️',
  },
  {
    id: 'open_conversation',
    translationKey: 'open_conversation',
    icon: '💬',
  },
];

interface InteractionTypeCardProps {
  type: {
    id: string;
    translationKey: string;
    icon: string;
  };
  selected: boolean;
  onClick: () => void;
  t: (key: string) => string;
}

const InteractionTypeCard: React.FC<InteractionTypeCardProps> = ({
  type,
  selected,
  onClick,
  t,
}) => {
  const titleKey = `experimentBuilder.step1.${type.translationKey}.title`;
  const descKey = `experimentBuilder.step1.${type.translationKey}.description`;
  const examplesKey = `experimentBuilder.step1.${type.translationKey}.examples`;
  const examples = t(examplesKey).split(',').map((e: string) => e.trim());

  return (
    <button
      onClick={onClick}
      className={`
        p-4 text-left border-2 rounded-lg transition-all w-full bg-white
        ${selected
          ? 'border-blue-500 bg-blue-50 shadow-sm'
          : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
        }
      `}
    >
      <div className="flex items-start gap-3">
        <span className="text-3xl">{type.icon}</span>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">
            {t(titleKey)}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {t(descKey)}
          </p>
          {selected && examples.length > 0 && (
            <div className="mt-2 text-xs text-gray-500">
              Examples: {examples.join(', ')}
            </div>
          )}
        </div>
        <div className="ml-2">
          {selected ? (
            <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M16.707 5.293a1 1 0 010-1.414l-8 8a1 1 0 01-1.414 0l-8 8a1 1 0 010-1.414l8-8z" />
              </svg>
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
          )}
        </div>
      </div>
    </button>
  );
};

export const Step1InteractionType: React.FC = () => {
  const { t } = useTranslation();
  const { interactionTypes, toggleInteractionType } = useExperimentBuilder();

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          {t('experimentBuilder.step1.title')}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          {t('experimentBuilder.step1.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {INTERACTION_TYPES.map((type) => (
          <InteractionTypeCard
            key={type.id}
            type={type}
            selected={interactionTypes.includes(type.id as any)}
            onClick={() => toggleInteractionType(type.id as any)}
            t={t}
          />
        ))}
      </div>

      {/* Add-ons suggestion based on selection */}
      {interactionTypes.length > 0 && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="font-semibold text-sm text-blue-900 mb-2">
            {t('experimentBuilder.step1.optionalAddons')}
          </h3>
          <p className="text-sm text-blue-700">
            {t('experimentBuilder.step1.optionalAddonsDesc')}
          </p>
        </div>
      )}
    </div>
  );
};
