/**
 * Experiment Preview Component
 *
 * Displays a human-readable summary of the experiment configuration
 * before creation, shown on Step 5.
 */

import React from 'react';
import { useExperimentBuilder } from '../../store/experiment-builder';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

const INTERACTION_LABELS: Record<string, string> = {
  strategic_decisions: 'Strategic Decisions',
  opinions_influence: 'Opinions & Influence',
  network_spread: 'Network & Spread',
  markets_exchange: 'Markets & Exchange',
  spatial_movement: 'Spatial & Movement',
  open_conversation: 'Open Conversation',
};

const NETWORK_LABELS: Record<string, string> = {
  complete: 'Everyone talks to everyone',
  sbm: 'Small clusters (SBM)',
  barabasi: 'Scale-free (hub-and-spoke)',
  custom: 'Custom network',
};

const SUCCESS_LABELS: Record<string, string> = {
  fixed_rounds: 'Fixed number of rounds',
  convergence: 'Convergence (agreement within tolerance)',
  unanimity: 'Unanimity (all agents choose the same)',
  no_conflicts: 'No conflicts',
};

const TURN_ORDER_LABELS: Record<string, string> = {
  simultaneous: 'Simultaneous (all agents act at once)',
  sequential: 'Sequential (agents take turns)',
  random: 'Random (different order each round)',
};

const UPDATE_LABELS: Record<string, string> = {
  none: 'None (no changes between rounds)',
  imitate: 'Imitation (copy successful strategies)',
  average: 'Averaging (opinions shift toward average)',
  reinforce: 'Reinforcement (successful behaviors reinforced)',
};

export const ExperimentPreview: React.FC = () => {
  const {
    interactionTypes,
    scenario,
    agentTypes,
    mechanicConfigs,
    networkType,
    successCondition,
    turnOrder,
    interRoundUpdate,
    metrics,
  } = useExperimentBuilder();

  const totalAgents = agentTypes.reduce((sum, t) => sum + t.count, 0);

  const hasStrategic = interactionTypes.includes('strategic_decisions');
  const hasOpinion = interactionTypes.includes('opinions_influence');
  const hasNetwork = interactionTypes.includes('network_spread');

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Experiment Preview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Interaction Types */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Interaction Patterns
            </h4>
            <div className="flex flex-wrap gap-2">
              {interactionTypes.map((type) => (
                <span
                  key={type}
                  className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm"
                >
                  {INTERACTION_LABELS[type] || type}
                </span>
              ))}
            </div>
          </div>

          {/* Scenario */}
          {scenario && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Scenario
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-3 rounded border border-gray-200 dark:border-gray-700">
                {scenario}
              </p>
            </div>
          )}

          {/* Agents */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Agents ({totalAgents} total)
            </h4>
            <div className="space-y-2">
              {agentTypes.map((type) => (
                <div
                  key={type.id}
                  className="flex items-center justify-between text-sm p-2 bg-gray-50 dark:bg-gray-900/50 rounded"
                >
                  <span className="font-medium text-gray-900 dark:text-white">
                    {type.label}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    {type.count} agent{type.count !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
              {agentTypes.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-500 italic">
                  No agents defined
                </p>
              )}
            </div>
          </div>

          {/* Mechanic Configs */}
          {hasStrategic && mechanicConfigs.strategic_choice && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Strategic Choices
              </h4>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <p>Options: {mechanicConfigs.strategic_choice.strategies?.join(', ') || 'Not defined'}</p>
                <p>Payoff Mode: {mechanicConfigs.strategic_choice.payoffMode || 'pairwise'}</p>
                <p>Visibility: {mechanicConfigs.strategic_choice.payoffVisibility || 'private'}</p>
              </div>
            </div>
          )}

          {hasOpinion && mechanicConfigs.opinion && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Opinions & Influence
              </h4>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <p>Dimension: {mechanicConfigs.opinion.opinionDimensions?.[0]?.name || 'Not defined'}</p>
                <p>Influence: {mechanicConfigs.opinion.influenceModel || 'bounded_confidence'}</p>
                {mechanicConfigs.opinion.influenceModel === 'bounded_confidence' && (
                  <p>Open-mindedness: {mechanicConfigs.opinion.confidenceThreshold || 30}</p>
                )}
              </div>
            </div>
          )}

          {hasNetwork && mechanicConfigs.network_dynamics && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Network Dynamics
              </h4>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <p>Spreads: {mechanicConfigs.network_dynamics.propagationType || 'opinion'}</p>
                <p>Evolution: {mechanicConfigs.network_dynamics.evolutionModel || 'none'}</p>
              </div>
            </div>
          )}

          {/* Structure Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Network Structure
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {NETWORK_LABELS[networkType] || networkType}
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Stopping Condition
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {SUCCESS_LABELS[successCondition.type] || successCondition.type}
              </p>
              {successCondition.maxRounds && (
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Max {successCondition.maxRounds} rounds
                </p>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Turn Order
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {TURN_ORDER_LABELS[turnOrder.type] || turnOrder.type}
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Inter-Round Update
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {UPDATE_LABELS[interRoundUpdate.type] || interRoundUpdate.type}
              </p>
            </div>
          </div>

          {/* Metrics */}
          {metrics.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Metrics to Collect
              </h4>
              <div className="flex flex-wrap gap-2">
                {metrics.map((metric) => (
                  <span
                    key={metric}
                    className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-sm"
                  >
                    {metric}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ExperimentPreview;
