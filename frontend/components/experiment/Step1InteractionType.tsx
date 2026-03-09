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

const CATEGORY_ORDER = [
  'game_theory',
  'social_dynamics',
  'discussion',
  'spatial',
  'social_deduction',
  'sociology',
  'custom',
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  game_theory: '#3b82f6',
  social_dynamics: '#8b5cf6',
  discussion: '#10b981',
  spatial: '#f59e0b',
  social_deduction: '#ef4444',
  sociology: '#ec4899',
  custom: '#6b7280',
};

const ScenarioCard: React.FC<ScenarioCardProps> = ({
  scenario,
  selected,
  onClick,
  t,
}) => {
  // Build translation key for scenario name/description
  const scenarioNameKey = `scenario.${scenario.category}.${scenario.id}.name`;
  const scenarioDescKey = `scenario.${scenario.category}.${scenario.id}.description`;

  // Use translation with fallback to original value
  const translatedName = t(scenarioNameKey, scenario.name);
  const translatedDesc = t(scenarioDescKey, scenario.description);

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
              {translatedName}
            </h3>
          </div>
          <p className="text-sm text-gray-600 line-clamp-2">
            {translatedDesc}
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
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

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

  const toggleCategory = (category: string) => {
    setOpenCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Auto-expand selected scenario's category
  useEffect(() => {
    if (selectedScenarioId) {
      const scenario = scenarios.find(s => s.id === selectedScenarioId);
      if (scenario) {
        setOpenCategories(prev => new Set(prev).add(scenario.category));
      }
    }
  }, [selectedScenarioId, scenarios]);

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
          {t('experimentBuilder.step1.chooseScenario')}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          {t('experimentBuilder.step1.selectTemplate')}
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
            {t('experimentBuilder.step1.retry')}
          </button>
        </div>
      )}

      {!loading && !error && scenarios.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-gray-600">No scenarios available</p>
        </div>
      )}

      {!loading && !error && scenarios.length > 0 && (
        <div className="space-y-4">
          {CATEGORY_ORDER.map(category => {
            const categoryScenarios = scenarios.filter(s => s.category === category);
            if (categoryScenarios.length === 0) return null;

            const isOpen = openCategories.has(category);
            const color = CATEGORY_COLORS[category] || '#6b7280';

            return (
              <div key={category} className="border rounded-lg">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="px-2 py-1 rounded text-xs font-medium text-white"
                      style={{ backgroundColor: color }}
                    >
                      {t(`scenario.category.${category}`)}
                    </span>
                    <span className="font-medium">
                      {t(`scenario.category.${category}`)}
                    </span>
                    <span className="text-sm text-gray-600">
                      {t('experimentBuilder.step1.scenariosCount', { count: categoryScenarios.length })}
                    </span>
                  </div>
                  <svg
                    className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categoryScenarios.map(scenario => (
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
          })}
        </div>
      )}
    </div>
  );
};
