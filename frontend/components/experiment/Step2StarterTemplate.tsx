/**
 * Step 2: Starter Template Selection
 *
 * Users can optionally select a pre-configured template to speed up
 * experiment setup. Templates are filtered by interaction types
 * selected in Step 1.
 */

import React, { useMemo } from 'react';
import { useExperimentBuilder } from '../../store/experiment-builder';

const STARTER_TEMPLATES = [
  {
    id: 'blank',
    name: 'Design Your Own',
    description: 'Start from scratch with full control over all settings',
    icon: '✨',
    category: null,
  },
  {
    id: 'prisoners_dilemma',
    name: 'Prisoner\'s Dilemma',
    description: 'Classic game theory scenario - two suspects decide whether to cooperate or defect',
    icon: '⚖️',
    category: 'strategic_decisions',
    requires: ['strategic_decisions'],
    preview: {
      strategies: ['Cooperate', 'Defect'],
      payoffMode: 'pairwise',
      scenario: 'Two suspects are arrested and held separately. Each must decide whether to betray the other or remain silent.',
    },
  },
  {
    id: 'opinion_polarization',
    name: 'Opinion Polarization',
    description: 'Study how opinions become more extreme through social interaction',
    icon: '💭',
    category: 'opinions_influence',
    requires: ['opinions_influence'],
    preview: {
      opinionDimension: 'Policy support',
      influenceModel: 'bounded_confidence',
      confidenceThreshold: 30,
      scenario: 'Agents discuss a controversial policy. Watch how opinions shift and polarize.',
    },
  },
  {
    id: 'information_cascade',
    name: 'Information Cascade',
    description: 'Study how people follow the crowd despite private information',
    icon: '📢',
    category: 'network_spread',
    requires: ['network_spread'],
    preview: {
      turnOrder: 'sequential',
      turnVisibility: 'all_previous',
      scenario: 'Participants guess the state of an urn. Previous choices are visible.',
    },
  },
  {
    id: 'minimum_effort',
    name: 'Minimum Effort Game',
    description: 'Coordination game where the minimum effort determines everyone\'s payoff',
    icon: '📉',
    category: 'strategic_decisions',
    requires: ['strategic_decisions'],
    preview: {
      strategies: ['Effort 1', 'Effort 2', 'Effort 3', 'Effort 4', 'Effort 5', 'Effort 6', 'Effort 7'],
      payoffMode: 'extremum',
      extremumFunction: 'min',
      baseline: 70,
      marginal: 10,
      scenario: 'Team members choose effort levels. Payoff depends on the minimum effort chosen.',
    },
  },
  {
    id: 'spatial_cooperation',
    name: 'Spatial Cooperation',
    description: 'Prisoner\'s dilemma on a grid - cooperation spreads through neighborhoods',
    icon: '🗺️',
    category: 'spatial_movement',
    requires: ['strategic_decisions', 'spatial_movement'],
    preview: {
      strategies: ['Cooperate', 'Defect'],
      payoffMode: 'pairwise',
      networkType: 'grid',
      updateMode: 'imitate',
      target: 'best_neighbor',
      scenario: 'Agents arranged on a grid. Cooperation can spread through imitation.',
    },
  },
  {
    id: 'stag_hunt',
    name: 'Stag Hunt',
    description: 'Coordination game where group success requires everyone to participate',
    icon: '🦌',
    category: 'strategic_decisions',
    requires: ['strategic_decisions'],
    preview: {
      strategies: ['Stag', 'Hare'],
      payoffMode: 'threshold',
      thresholdType: 'count',
      threshold: 10,
      scenario: 'Hunters must all choose stag (high reward) or hare (safe but low reward).',
    },
  },
  {
    id: 'consensus_game',
    name: 'Consensus Game',
    description: 'Agents try to reach agreement through discussion',
    icon: '🤝',
    category: 'opinions_influence',
    requires: ['opinions_influence'],
    preview: {
      opinionDimension: 'Opinion',
      influenceModel: 'open',
      updateMode: 'average',
      mixingRate: 0.5,
      scenario: 'Agents discuss and update their opinions toward the group average.',
    },
  },
];

interface StarterTemplateCardProps {
  template: {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: string | null;
    requires: string[];
    preview?: Record<string, unknown>;
  };
  available: boolean;
  selected: boolean;
  onClick: () => void;
}

const StarterTemplateCard: React.FC<StarterTemplateCardProps> = ({
  template,
  available,
  selected,
  onClick,
}) => {
  return (
    <button
      onClick={available ? onClick : undefined}
      disabled={!available}
      className={`
        p-4 text-left border-2 rounded-lg transition-all w-full bg-white
        ${!available
          ? 'opacity-50 cursor-not-allowed border-gray-100'
          : selected
          ? 'border-blue-500 bg-blue-50 shadow-sm'
          : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
        }
      `}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{template.icon}</span>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">
            {template.name}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {template.description}
          </p>
          {template.category && (
            <span className="inline-block mt-2 text-xs px-2 py-1 bg-gray-100 rounded">
              {template.category}
            </span>
          )}
        </div>
        <div className="ml-2">
          {selected ? (
            <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M16.707 5.293a1 1 0 010-1.414l-8 8a1 1 0 01-1.414 0l-8 8a1 1 0 010-1.414l8-8z" />
              </svg>
            </div>
          ) : available ? (
            <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
          ) : null}
        </div>
      </div>
    </button>
  );
};

export const Step2StarterTemplate: React.FC = () => {
  const { interactionTypes, starterTemplate, setStarterTemplate, setScenario, updateMechanicConfig } =
    useExperimentBuilder();

  // Filter available templates based on selected interaction types
  const availableTemplates = useMemo(() => {
    return STARTER_TEMPLATES.filter((template) => {
      if (template.id === 'blank') return true;
      if (!template.requires) return true;
      // Template is available if at least one of its required types is selected
      return template.requires.some((req) => interactionTypes.includes(req as any));
    });
  }, [interactionTypes]);

  const handleSelectTemplate = (templateId: string) => {
    const template = STARTER_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    setStarterTemplate(templateId);

    // Apply preview if available
    if (template.preview) {
      // Set scenario
      if (template.preview.scenario) {
        setScenario(template.preview.scenario as string);
      }

      // Apply mechanic configs
      if (template.category === 'strategic_decisions') {
        updateMechanicConfig('strategic_choice', {
          strategies: template.preview.strategies,
          payoffMode: template.preview.payoffMode,
          ...(template.preview.extremumFunction && {
            extremumConfig: {
              function: template.preview.extremumFunction,
              baseline: template.preview.baseline,
              marginal: template.preview.marginal,
            },
          }),
          ...(template.preview.thresholdType && {
            thresholdConfig: {
              thresholdType: template.preview.thresholdType,
              threshold: template.preview.threshold,
              ...(template.preview.threshold !== undefined && {
                threshold: template.preview.threshold,
              }),
            },
          }),
        });
      }

      if (template.category === 'opinions_influence') {
        updateMechanicConfig('opinion', {
          opinionDimensions: template.preview.opinionDimension
            ? [{ name: template.preview.opinionDimension, scale: [0, 100] }]
            : [{ name: 'Opinion', scale: [0, 100] }],
          influenceModel: template.preview.influenceModel,
          confidenceThreshold: template.preview.confidenceThreshold,
        });
      }
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Start from scratch or use a starter template
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Templates pre-configure common settings - you can customize everything in later steps
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {availableTemplates.map((template) => (
          <StarterTemplateCard
            key={template.id}
            template={template}
            available={true}
            selected={starterTemplate === template.id}
            onClick={() => handleSelectTemplate(template.id)}
          />
        ))}
      </div>

      {starterTemplate && (
        <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="text-sm text-green-800">
            ✓ Template selected. You'll be able to customize all settings in the next steps.
          </p>
        </div>
      )}
    </div>
  );
};
