/**
 * Step 2: Scenario Configuration
 *
 * Allows users to configure the selected scenario by editing its description
 * and setting dynamic parameters. Parameter fields are rendered based on the
 * scenario's parameter definitions using appropriate UI widgets.
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useExperimentBuilder } from '../../store/experiment-builder';
import ParameterField from './ParameterField';

// Simplified Payoff Input Component
interface PayoffInputProps {
  value: { cooperate_reward?: number; defect_penalty?: number };
  onChange: (value: { cooperate_reward: number; defect_penalty: number }) => void;
}

function PayoffInput({ value, onChange }: PayoffInputProps) {
  const cooperateReward = value.cooperate_reward ?? 3;
  const defectPenalty = value.defect_penalty ?? 1;

  // Auto-derive temptation and sucker values
  const temptation = cooperateReward + 2;
  const sucker = Math.max(0, cooperateReward - 3);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Reward for mutual cooperation
        </label>
        <input
          type="number"
          value={cooperateReward}
          onChange={(e) => onChange({
            cooperate_reward: parseInt(e.target.value) || 3,
            defect_penalty: defectPenalty,
          })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
        <p className="text-xs text-gray-500 mt-1">
          Years saved when both players choose cooperate
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Penalty for mutual defection
        </label>
        <input
          type="number"
          value={defectPenalty}
          onChange={(e) => onChange({
            cooperate_reward: cooperateReward,
            defect_penalty: parseInt(e.target.value) || 1,
          })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
        <p className="text-xs text-gray-500 mt-1">
          Years saved when both players choose defect
        </p>
      </div>

      <div className="bg-gray-50 p-3 rounded-md text-sm">
        <p className="font-medium text-gray-700 mb-2">Auto-calculated:</p>
        <p>• Temptation (defect vs cooperate): <strong>{temptation}</strong></p>
        <p>• Sucker (cooperate vs defect): <strong>{sucker}</strong></p>
        <p className="text-xs text-gray-500 mt-2">
          Standard PD constraint: T &gt; R &gt; P &gt; S
        </p>
      </div>
    </div>
  );
}

export const Step2StarterTemplate: React.FC = () => {
  const { t } = useTranslation();
  const {
    selectedScenarioData,
    scenarioDescription,
    scenarioParams,
    roundVisibility,
    turnOrder,
    setScenarioDescription,
    setScenarioParams,
    setRoundVisibility,
    setTurnOrder,
  } = useExperimentBuilder();

  const [localRoundVisibility, setLocalRoundVisibility] = useState<'simultaneous' | 'sequential'>('simultaneous');
  const [localTurnOrder, setLocalTurnOrder] = useState<'fixed' | 'random'>('fixed');

  // Update local state when store changes
  useEffect(() => {
    if (roundVisibility) setLocalRoundVisibility(roundVisibility);
    if (turnOrder) setLocalTurnOrder(turnOrder);
  }, [roundVisibility, turnOrder]);

  // Initialize scenario description from selected scenario
  useEffect(() => {
    if (selectedScenarioData && !scenarioDescription) {
      setScenarioDescription(selectedScenarioData.description);
    }
  }, [selectedScenarioData, scenarioDescription, setScenarioDescription]);

  // Initialize scenario params from defaults
  useEffect(() => {
    if (selectedScenarioData && selectedScenarioData.parameters && Object.keys(scenarioParams).length === 0) {
      const defaults: Record<string, unknown> = {};
      selectedScenarioData.parameters.forEach((param) => {
        defaults[param.key] = param.default;
      });
      setScenarioParams(defaults);
    }
  }, [selectedScenarioData, scenarioParams, setScenarioParams]);

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setScenarioDescription(e.target.value);
  };

  const handleParamChange = (key: string, value: string | number) => {
    setScenarioParams({ ...scenarioParams, [key]: value });
  };

  const handlePayoffChange = (value: { cooperate_reward: number; defect_penalty: number }) => {
    setScenarioParams({
      ...scenarioParams,
      cooperate_reward: value.cooperate_reward,
      defect_penalty: value.defect_penalty,
    });
  };

  const getParamValue = (param: { key: string; default: unknown }) => {
    return scenarioParams[param.key] !== undefined
      ? scenarioParams[param.key]
      : param.default;
  };

  if (!selectedScenarioData) {
    return (
      <div className="p-4 text-center text-gray-500">
        Please select a scenario in Step 1 first.
      </div>
    );
  }

  const hasParameters = selectedScenarioData.parameters.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          Configure {selectedScenarioData.name}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Customize the scenario description and parameters
        </p>
      </div>

      {/* Scenario Description */}
      <div>
        <label
          htmlFor="scenario-description"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Scenario description (agents will see this)
        </label>
        <textarea
          id="scenario-description"
          value={scenarioDescription}
          onChange={handleDescriptionChange}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
          placeholder="Enter a description of the scenario that agents will understand..."
        />
      </div>

      {/* Dynamic Parameter Fields or Payoff Input */}
      {selectedScenarioData.display_type === 'payoff_matrix' ? (
        <PayoffInput
          value={scenarioParams as { cooperate_reward?: number; defect_penalty?: number }}
          onChange={handlePayoffChange}
        />
      ) : hasParameters ? (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-700">
            Parameters
          </h3>
          {selectedScenarioData.parameters.map((param) => {
            const value = getParamValue(param);

            return (
              <div key={param.key} className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  {param.label}
                </label>
                <ParameterField
                  param={{
                    type: param.type === 'number' ? 'integer' : 'string',
                    default: param.default,
                    ui_hint: param.ui_hint || 'text',
                    min: param.min,
                    max: param.max,
                    step: param.step,
                    options: param.options,
                    placeholder: param.placeholder,
                  }}
                  value={value}
                  onChange={(val) => handleParamChange(param.key, val)}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600">
            This scenario has no configurable parameters. Adjust the description above
            and proceed to the next step.
          </p>
        </div>
      )}

      {/* Round Settings */}
      {hasParameters && (
        <div className="border-t pt-4 mt-4">
          <h3 className="font-medium mb-3">
            {t('experimentBuilder.roundSettings.title')}
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('experimentBuilder.roundSettings.roundVisibility.label')}
              </label>
              <select
                value={localRoundVisibility}
                onChange={(e) => {
                  const val = e.target.value as 'simultaneous' | 'sequential';
                  setLocalRoundVisibility(val);
                  setRoundVisibility(val);
                }}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="simultaneous">
                  {t('experimentBuilder.roundSettings.roundVisibility.simultaneous')}
                </option>
                <option value="sequential">
                  {t('experimentBuilder.roundSettings.roundVisibility.sequential')}
                </option>
              </select>
            </div>

            {localRoundVisibility === 'sequential' && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('experimentBuilder.roundSettings.turnOrder.label')}
                </label>
                <select
                  value={localTurnOrder}
                  onChange={(e) => {
                    const val = e.target.value as 'fixed' | 'random';
                    setLocalTurnOrder(val);
                    setTurnOrder(val);
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="fixed">
                    {t('experimentBuilder.roundSettings.turnOrder.fixed')}
                  </option>
                  <option value="random">
                    {t('experimentBuilder.roundSettings.turnOrder.random')}
                  </option>
                </select>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
