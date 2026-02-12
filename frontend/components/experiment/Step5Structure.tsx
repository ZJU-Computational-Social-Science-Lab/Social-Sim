/**
 * Step 5: Structure, Conditions & Preview
 *
 * Users configure network structure, stopping conditions, turn order,
 * inter-round updates, and preview the final experiment before creating.
 */

import React from 'react';
import { useExperimentBuilder, SuccessConditionType, TurnOrderType, InterRoundUpdateType } from '../../store/experiment-builder';

const NETWORK_TYPES = [
  { id: 'complete', name: 'Everyone talks to everyone', description: 'Complete graph' },
  { id: 'sbm', name: 'Small clusters', description: 'Stochastic block model - communities' },
  { id: 'barabasi', name: 'Scale-free', description: 'Hub-and-spoke pattern' },
  { id: 'custom', name: 'Custom network', description: 'Manually define connections' },
];

const SUCCESS_CONDITIONS = [
  { id: 'fixed_rounds', name: 'Fixed Rounds', description: 'Run for a set number of rounds' },
  { id: 'convergence', name: 'Convergence', description: 'Stop when agents agree (within tolerance)' },
  { id: 'unanimity', name: 'Unanimity', description: 'Stop when all agents choose the same' },
  { id: 'no_conflicts', name: 'No Conflicts', description: 'For graph coloring problems' },
];

const TURN_ORDERS = [
  { id: 'simultaneous', name: 'Simultaneous', description: 'All agents act at once' },
  { id: 'sequential', name: 'Sequential', description: 'Agents take turns one at a time' },
  { id: 'random', name: 'Random', description: 'Random order each round' },
];

const INTER_ROUND_UPDATES = [
  { id: 'none', name: 'None', description: 'No changes between rounds' },
  { id: 'imitate', name: 'Imitation', description: 'Agents copy successful strategies' },
  { id: 'average', name: 'Averaging', description: 'Opinions shift toward average' },
  { id: 'reinforce', name: 'Reinforcement', description: 'Successful behaviors reinforced' },
];

const AVAILABLE_METRICS = [
  { id: 'opinion_variance', name: 'Opinion Variance', requires: ['opinion'] },
  { id: 'cooperation_rate', name: 'Cooperation Rate', requires: ['strategic_choice'] },
  { id: 'average_payoff', name: 'Average Payoff', requires: ['strategic_choice'] },
  { id: 'network_density', name: 'Network Density', requires: [] },
  { id: 'consensus_achieved', name: 'Consensus Achieved', requires: ['opinion', 'strategic_choice'] },
];

export const Step5Structure: React.FC = () => {
  const {
    networkType,
    networkParams,
    setNetworkType,
    successCondition,
    setSuccessCondition,
    turnOrder,
    setTurnOrder,
    interRoundUpdate,
    setInterRoundUpdate,
    metrics,
    setMetrics,
    interactionTypes,
    agentTypes,
    scenario,
  } = useExperimentBuilder();

  const totalAgents = agentTypes.reduce((sum, t) => sum + t.count, 0);

  // Condition-specific configs
  const showTolerance = successCondition.type === 'convergence';
  const showThresholdRatio = successCondition.type === 'unanimity';
  const showRequiredValue = successCondition.type === 'unanimity';

  // Get available metrics based on interaction types
  const availableMetrics = AVAILABLE_METRICS.filter(
    (m) => !m.requires || m.requires.some((r) => interactionTypes.includes(r as any))
  );

  return (
    <div className="space-y-6">
      {/* Social Structure */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Social Structure
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {NETWORK_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => setNetworkType(type.id as any)}
              className={`
                p-3 border-2 rounded-lg text-left transition-all bg-white
                ${networkType === type.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <h4 className="font-medium text-gray-900">{type.name}</h4>
              <p className="text-xs text-gray-600 mt-1">
                {type.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Duration & Stopping Condition */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Duration & Stopping Condition
        </h3>

        <div className="space-y-4">
          {/* Max Rounds */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Maximum number of rounds
            </label>
            <input
              type="number"
              min="1"
              max="1000"
              value={successCondition.maxRounds}
              onChange={(e) =>
                setSuccessCondition({
                  ...successCondition,
                  maxRounds: parseInt(e.target.value) || 50,
                })
              }
              className="w-32 px-3 py-2 border border-gray-300 rounded-md bg-white"
            />
          </div>

          {/* Stopping Condition */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stopping condition
            </label>
            <select
              value={successCondition.type}
              onChange={(e) =>
                setSuccessCondition({
                  ...successCondition,
                  type: e.target.value as SuccessConditionType,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
            >
              {SUCCESS_CONDITIONS.map((cond) => (
                <option key={cond.id} value={cond.id}>
                  {cond.name} - {cond.description}
                </option>
              ))}
            </select>
          </div>

          {/* Condition-specific configs */}
          {showTolerance && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Convergence tolerance (how close is agreement?)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={successCondition.tolerance || 5}
                onChange={(e) =>
                  setSuccessCondition({
                    ...successCondition,
                    tolerance: parseFloat(e.target.value) || 5,
                  })
                }
                className="w-24 px-3 py-2 border border-gray-300 rounded-md bg-white"
              />
            </div>
          )}

          {showThresholdRatio && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Required agreement ratio (0-1)
              </label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={successCondition.thresholdRatio || 1.0}
                onChange={(e) =>
                  setSuccessCondition({
                    ...successCondition,
                    thresholdRatio: parseFloat(e.target.value) || 1.0,
                  })
                }
                className="w-24 px-3 py-2 border border-gray-300 rounded-md bg-white"
              />
            </div>
          )}
        </div>
      </div>

      {/* Turn Order */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Turn Order
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {TURN_ORDERS.map((order) => (
            <button
              key={order.id}
              onClick={() =>
                setTurnOrder({
                  type: order.id as TurnOrderType,
                  visibility: order.id === 'sequential' ? 'all_previous' : undefined,
                })
              }
              className={`
                p-3 border-2 rounded-lg text-center transition-all bg-white
                ${turnOrder.type === order.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <h4 className="font-medium text-gray-900">{order.name}</h4>
              <p className="text-xs text-gray-600 mt-1">
                {order.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Inter-Round Updates */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Inter-Round Updates
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {INTER_ROUND_UPDATES.map((update) => (
            <button
              key={update.id}
              onClick={() =>
                setInterRoundUpdate({
                  type: update.id as InterRoundUpdateType,
                  probability: 1.0,
                  mixingRate: 0.5,
                })
              }
              className={`
                p-3 border-2 rounded-lg text-center transition-all bg-white
                ${interRoundUpdate.type === update.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <h4 className="font-medium text-gray-900">{update.name}</h4>
              <p className="text-xs text-gray-600 mt-1">
                {update.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Metrics to Collect */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Metrics to Collect
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {availableMetrics.map((metric) => (
            <button
              key={metric.id}
              onClick={() => {
                const newMetrics = metrics.includes(metric.id)
                  ? metrics.filter((m) => m !== metric.id)
                  : [...metrics, metric.id];
                setMetrics(newMetrics);
              }}
              className={`
                p-2 border rounded text-center transition-all text-sm bg-white
                ${metrics.includes(metric.id)
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-blue-300 text-gray-700'
                }
              `}
            >
              {metric.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
