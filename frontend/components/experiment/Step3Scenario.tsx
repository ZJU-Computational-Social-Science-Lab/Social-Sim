/**
 * Step 3: Scenario and Mechanic Configuration
 *
 * Users configure the scenario description and mechanic-specific settings.
 * Shows different configuration options based on selected interaction types.
 */

import React from 'react';
import { useExperimentBuilder } from '../../store/experiment-builder';

export const Step3Scenario: React.FC = () => {
  const {
    interactionTypes,
    scenario,
    setScenario,
    mechanicConfigs,
    updateMechanicConfig,
  } = useExperimentBuilder();

  const hasStrategic = interactionTypes.includes('strategic_decisions');
  const hasOpinion = interactionTypes.includes('opinions_influence');
  const hasNetwork = interactionTypes.includes('network_spread');
  const hasSpatial = interactionTypes.includes('spatial_movement');
  const hasMarkets = interactionTypes.includes('markets_exchange');

  return (
    <div className="space-y-6">
      {/* Shared Scenario */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Scenario Description
        </h3>
        <p className="text-sm text-gray-600 mb-2">
          Describe the scenario for all agents to see. This is the shared context.
        </p>
        <textarea
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          placeholder="e.g., 'Two suspects are arrested and held separately...'"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
          rows={3}
        />
      </div>

      {/* Strategic Decisions Config */}
      {hasStrategic && (
        <div className="p-4 border border-gray-200 rounded-lg bg-white">
          <h4 className="font-semibold text-gray-900 mb-3">
            Strategic Decision Settings
          </h4>

          {/* Strategies */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Choices available to agents
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={mechanicConfigs.strategic_choice?.strategies?.join(', ') || ''}
                onChange={(e) =>
                  updateMechanicConfig('strategic_choice', {
                    strategies: e.target.value.split(',').map((s: string) => s.trim()),
                  })
                }
                placeholder="e.g., Cooperate, Defect"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-white"
              />
            </div>
          </div>

          {/* Payoff Mode */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              How are outcomes determined?
            </label>
            <select
              value={mechanicConfigs.strategic_choice?.payoffMode || 'pairwise'}
              onChange={(e) =>
                updateMechanicConfig('strategic_choice', {
                  payoffMode: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
            >
              <option value="pairwise">Payoff Matrix (explicit pairwise payoffs)</option>
              <option value="extremum">Group Minimum (coordination games)</option>
              <option value="threshold">Threshold (all-or-nothing payoff)</option>
              <option value="pool">Common Pool (shared resources)</option>
            </select>
          </div>

          {/* Payoff Visibility */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              How should agents learn their payoffs?
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="payoff_visibility"
                  checked={mechanicConfigs.strategic_choice?.payoffVisibility !== 'public' && mechanicConfigs.strategic_choice?.payoffVisibility !== 'query'}
                  onChange={() =>
                    updateMechanicConfig('strategic_choice', { payoffVisibility: 'private' })
                  }
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700">
                  Private - Each sees only their own score
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="payoff_visibility"
                  checked={mechanicConfigs.strategic_choice?.payoffVisibility === 'public'}
                  onChange={() =>
                    updateMechanicConfig('strategic_choice', { payoffVisibility: 'public' })
                  }
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700">
                  Public - All agents see everyone's scores
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="payoff_visibility"
                  checked={mechanicConfigs.strategic_choice?.payoffVisibility === 'query'}
                  onChange={() =>
                    updateMechanicConfig('strategic_choice', { payoffVisibility: 'query' })
                  }
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700">
                  On Request - Agents must explicitly ask
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Opinions & Influence Config */}
      {hasOpinion && (
        <div className="p-4 border border-gray-200 rounded-lg bg-white">
          <h4 className="font-semibold text-gray-900 mb-3">
            Opinion & Influence Settings
          </h4>

          {/* Opinion Dimension */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              What do agents have opinions about?
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={mechanicConfigs.opinion?.opinionDimensions?.[0]?.name || ''}
                onChange={(e) =>
                  updateMechanicConfig('opinion', {
                    opinionDimensions: [{ name: e.target.value, scale: [0, 100] }],
                  })
                }
                placeholder="e.g., Policy Proposal"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-white"
              />
              <input
                type="number"
                min="0"
                max="100"
                defaultValue={100}
                disabled
                className="w-20 px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
              />
            </div>
          </div>

          {/* Influence Model */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              How do agents influence each other?
            </label>
            <select
              value={mechanicConfigs.opinion?.influenceModel || 'bounded_confidence'}
              onChange={(e) =>
                updateMechanicConfig('opinion', {
                  influenceModel: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
            >
              <option value="bounded_confidence">
                Bounded Confidence - Only influenced by similar views
              </option>
              <option value="open">Open-minded - Influenced by anyone</option>
              <option value="none">None - Opinions don't change</option>
            </select>
          </div>

          {/* Confidence Threshold - only for bounded confidence */}
          {mechanicConfigs.opinion?.influenceModel === 'bounded_confidence' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                How open-minded are agents? (0-100)
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={mechanicConfigs.opinion?.confidenceThreshold || 30}
                  onChange={(e) =>
                    updateMechanicConfig('opinion', {
                      confidenceThreshold: parseFloat(e.target.value),
                    })
                  }
                  className="flex-1"
                />
                <span className="text-sm text-gray-600 w-12 text-right">
                  {mechanicConfigs.opinion?.confidenceThreshold || 30}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Network & Spread Config */}
      {hasNetwork && (
        <div className="p-4 border border-gray-200 rounded-lg bg-white">
          <h4 className="font-semibold text-gray-900 mb-3">
            Network & Spread Settings
          </h4>

          {/* What Spreads */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              What spreads through the network?
            </label>
            <select
              value={mechanicConfigs.network_dynamics?.propagationType || 'opinion'}
              onChange={(e) =>
                updateMechanicConfig('network_dynamics', {
                  propagationType: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
            >
              <option value="opinion">Opinions</option>
              <option value="choice">Strategic Choices</option>
            </select>
          </div>

          {/* Network Evolution */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Can connections change over time?
            </label>
            <select
              value={mechanicConfigs.network_dynamics?.evolutionModel || 'none'}
              onChange={(e) =>
                updateMechanicConfig('network_dynamics', {
                  evolutionModel: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
            >
              <option value="none">No - Network stays static</option>
              <option value="homophily">Similar agents connect (echo chambers)</option>
              <option value="random">Random connections form over time</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
