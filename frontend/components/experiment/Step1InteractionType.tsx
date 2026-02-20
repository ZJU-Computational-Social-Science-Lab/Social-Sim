/**
 * Step 1: Scenario Picker
 *
 * Displays a grid of scenario cards fetched from the backend.
 * Users select one scenario to proceed with experiment configuration.
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useExperimentBuilder } from '../../store/experiment-builder';
import { getAllScenarios, ScenarioData } from '../../services/scenarios';

interface ScenarioCardProps {
  scenario: ScenarioData;
  selected: boolean;
  onClick: () => void;
  t: (key: string) => string;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  game_theory: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  discussion: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  grid: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  social_dynamics: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  social_deduction: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  custom: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
};

const CATEGORY_LABELS: Record<string, string> = {
  game_theory: 'Game Theory',
  discussion: 'Discussion',
  grid: 'Grid World',
  social_dynamics: 'Social Dynamics',
  social_deduction: 'Social Deduction',
  custom: 'Custom',
};

const ScenarioCard: React.FC<ScenarioCardProps> = ({
  scenario,
  selected,
  onClick,
  t,
}) => {
  const colors = CATEGORY_COLORS[scenario.category] || CATEGORY_COLORS.custom;
  const categoryLabel = CATEGORY_LABELS[scenario.category] || scenario.category;

  return (
    <button
      onClick={onClick}
      className={`
        p-4 text-left border-2 rounded-lg transition-all w-full bg-white
        ${selected
          ? 'border-blue-500 bg-blue-50 shadow-sm ring-2 ring-blue-100'
          : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
        }
      `}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 truncate">
              {scenario.name}
            </h3>
            <span
              className={`
                text-xs px-2 py-0.5 rounded-full border whitespace-nowrap
                ${colors.bg} ${colors.text} ${colors.border}
              `}
            >
              {categoryLabel}
            </span>
          </div>
          <p className="text-sm text-gray-600 line-clamp-2">
            {scenario.description}
          </p>
        </div>
        <div className="ml-2 flex-shrink-0">
          {selected ? (
            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
          )}
        </div>
      </div>
    </button>
  );
};

export const Step1InteractionType: React.FC = () => {
  const { t } = useTranslation();
  const {
    selectedScenarioId,
    setSelectedScenarioId,
    setSelectedScenarioData,
    markStepComplete,
  } = useExperimentBuilder();

  const [scenarios, setScenarios] = useState<ScenarioData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchScenarios = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getAllScenarios();
        setScenarios(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch scenarios');
      } finally {
        setLoading(false);
      }
    };

    fetchScenarios();
  }, []);

  const handleSelectScenario = (scenario: ScenarioData) => {
    setSelectedScenarioId(scenario.id);
    setSelectedScenarioData(scenario);
    markStepComplete(1);
  };

  const handleRetry = () => {
    const fetchScenarios = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getAllScenarios();
        setScenarios(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch scenarios');
      } finally {
        setLoading(false);
      }
    };

    fetchScenarios();
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Choose a Scenario
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Select a scenario template to start building your experiment
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2" />
            <p className="text-sm text-gray-600">{t('common.loading')}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-center mb-4">
            <svg className="w-12 h-12 text-red-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-gray-600">{error}</p>
          </div>
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && scenarios.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-gray-500">No scenarios available</p>
        </div>
      )}

      {!loading && !error && scenarios.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scenarios.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              selected={selectedScenarioId === scenario.id}
              onClick={() => handleSelectScenario(scenario)}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
};
