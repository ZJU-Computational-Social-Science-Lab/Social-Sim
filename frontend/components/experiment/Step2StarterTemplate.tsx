/**
 * Step 2: Scenario Configuration
 *
 * Allows users to configure the selected scenario by editing its description
 * and setting dynamic parameters. Parameter fields are rendered based on the
 * scenario's parameter definitions (number/text inputs with labels and defaults).
 */

import React, { useEffect } from 'react';
import { useExperimentBuilder } from '../../store/experiment-builder';

export const Step2StarterTemplate: React.FC = () => {
  const {
    selectedScenarioData,
    scenarioDescription,
    scenarioParams,
    setScenarioDescription,
    setScenarioParams,
  } = useExperimentBuilder();

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

      {/* Dynamic Parameter Fields */}
      {hasParameters && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-700">
            Parameters
          </h3>
          {selectedScenarioData.parameters.map((param) => {
            const value = getParamValue(param);

            return (
              <div key={param.key}>
                <label
                  htmlFor={`param-${param.key}`}
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {param.label}
                </label>
                {param.type === 'number' ? (
                  <input
                    id={`param-${param.key}`}
                    type="number"
                    value={value as number}
                    onChange={(e) =>
                      handleParamChange(param.key, parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <input
                    id={`param-${param.key}`}
                    type="text"
                    value={value as string}
                    onChange={(e) => handleParamChange(param.key, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* No Parameters Message */}
      {!hasParameters && (
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600">
            This scenario has no configurable parameters. Adjust the description above
            and proceed to the next step.
          </p>
        </div>
      )}
    </div>
  );
};
