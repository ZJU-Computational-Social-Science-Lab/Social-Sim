/**
 * Step 3: Action Selector
 *
 * Displays available actions as toggle cards.
 * Shows all category actions when scenario has category_actions.
 * Users can enable/disable actions and add custom actions for custom scenarios.
 * At least one action must be selected.
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useExperimentBuilder } from '../../store/experiment-builder';
import { Circle, Plus, X } from 'lucide-react';
import { ActionDef } from '../../services/scenarios';

interface ActionToggleCardProps {
  name: string;
  description: string;
  selected: boolean;
  onToggle: () => void;
  isCustom?: boolean;
  onRemove?: () => void;
}

const ActionToggleCard: React.FC<ActionToggleCardProps> = ({
  name,
  description,
  selected,
  onToggle,
  isCustom = false,
  onRemove,
}) => {
  return (
    <div
      className={`
        p-4 border-2 rounded-lg transition-all
        ${selected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
        }
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Circle
            className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
              selected ? 'text-blue-500 fill-blue-500' : 'text-gray-400'
            }`}
          />
          <div className="flex-1 min-w-0">
            <h4 className={`font-semibold text-sm ${selected ? 'text-blue-900' : 'text-gray-900'}`}>
              {name}
            </h4>
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
              {description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isCustom && onRemove && (
            <button
              onClick={onRemove}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
              type="button"
              aria-label="Remove action"
            >
              <X size={16} />
            </button>
          )}
          <button
            onClick={onToggle}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full transition-colors
              ${selected ? 'bg-blue-500' : 'bg-gray-300'}
            `}
            type="button"
            aria-pressed={selected}
          >
            <span
              className={`
                inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                ${selected ? 'translate-x-6' : 'translate-x-1'}
              `}
            />
          </button>
        </div>
      </div>
    </div>
  );
};

interface CustomAction {
  name: string;
  description: string;
}

export const Step3Scenario: React.FC = () => {
  const { t } = useTranslation();
  const {
    selectedScenarioData,
    scenarioParams,
    availableActions,
    selectedActionIds,
    setAvailableActions,
    setSelectedActionIds,
    toggleActionId,
    validationErrors,
  } = useExperimentBuilder();

  const [customActions, setCustomActions] = useState<CustomAction[]>([]);
  const [showAddAction, setShowAddAction] = useState(false);
  const [newActionName, setNewActionName] = useState('');
  const [newActionDescription, setNewActionDescription] = useState('');

  // Check if actions are dynamically generated
  const generatorParam = selectedScenarioData?.parameters?.find(
    (p) => p.generates_actions === true
  );

  /**
   * Generate actions from a choices parameter value.
   * Parses comma-separated choices and creates action definitions.
   */
  const generateActionsFromChoices = (choicesValue: string): ActionDef[] => {
    const choices = choicesValue
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    return choices.map((choice) => ({
      name: choice,
      description: t('experimentBuilder.actions.chooseAction', { action: choice }),
    }));
  };

  // Initialize available actions from scenario data
  // Use category_actions if available, otherwise fall back to scenario.actions
  // If a parameter has generates_actions=true, generate actions from that parameter
  useEffect(() => {
    if (selectedScenarioData) {
      // Check if any parameter generates actions
      const generatorParam = selectedScenarioData.parameters?.find(
        (p) => p.generates_actions === true
      );

      if (generatorParam) {
        // Get the current value of the generating parameter
        const paramValue =
          (scenarioParams[generatorParam.key] as string) ||
          (generatorParam.default as string) ||
          '';

        // Generate actions from the parameter value
        const generatedActions = generateActionsFromChoices(paramValue);
        setAvailableActions(generatedActions);

        // Preserve existing selections for actions that still exist
        const existingSelectedIds = selectedActionIds.filter((id) =>
          generatedActions.some((a) => a.name === id)
        );
        // Find new actions that weren't in the previous list
        const newActionIds = generatedActions
          .filter((a) => !availableActions.some((prev) => prev.name === a.name))
          .map((a) => a.name);

        if (existingSelectedIds.length === 0 && newActionIds.length > 0) {
          // First time or no existing selections - select all
          setSelectedActionIds(generatedActions.map((a) => a.name));
        } else {
          // Preserve existing + add new
          setSelectedActionIds([...existingSelectedIds, ...newActionIds]);
        }
      } else {
        // Use category_actions if available, otherwise use scenario.actions
        const actionsToShow =
          selectedScenarioData.category_actions || selectedScenarioData.actions || [];
        setAvailableActions(actionsToShow);

        // Use default_action_ids if available, otherwise select all actions by default
        const defaultIds =
          selectedScenarioData.default_action_ids || actionsToShow.map((a) => a.name);
        setSelectedActionIds(defaultIds);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedScenarioData, scenarioParams, setAvailableActions, setSelectedActionIds]);

  const isCustom = selectedScenarioData?.id === 'custom';

  // Combine preset and custom actions
  const allActions = [
    ...availableActions.map((action) => ({ ...action, isCustom: false })),
    ...customActions.map((action) => ({ ...action, isCustom: true })),
  ];

  const handleToggleAction = (actionName: string) => {
    // Prevent deselecting if it's the last action
    const isCurrentlySelected = selectedActionIds.includes(actionName);
    const willBeEmpty = isCurrentlySelected && selectedActionIds.length === 1;

    if (willBeEmpty) {
      // Don't allow deselecting the last action
      return;
    }

    toggleActionId(actionName);
  };

  const handleAddCustomAction = () => {
    if (!newActionName.trim() || !newActionDescription.trim()) {
      return;
    }

    const newAction: CustomAction = {
      name: newActionName.trim(),
      description: newActionDescription.trim(),
    };

    setCustomActions([...customActions, newAction]);
    setSelectedActionIds([...selectedActionIds, newAction.name]);

    // Reset form
    setNewActionName('');
    setNewActionDescription('');
    setShowAddAction(false);
  };

  const handleRemoveCustomAction = (actionName: string) => {
    setCustomActions(customActions.filter((a) => a.name !== actionName));
    setSelectedActionIds(selectedActionIds.filter((id) => id !== actionName));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          Select Actions
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Choose what actions agents can take. At least one action must be selected.
        </p>
        {selectedScenarioData?.category_actions && (
          <p className="text-xs text-gray-600 mt-2">
            Showing all available actions for the {selectedScenarioData.category} category.
            This scenario starts with a pre-selected set of actions.
          </p>
        )}
      </div>

      {/* Dynamic actions info */}
      {generatorParam && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>{t('experimentBuilder.dynamicActionsInfo.title')}</strong>{' '}
            {t('experimentBuilder.dynamicActionsInfo.message', { paramLabel: generatorParam.label })}
          </p>
        </div>
      )}

      {/* Validation Error */}
      {validationErrors.actions && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{validationErrors.actions}</p>
        </div>
      )}

      {/* Action Toggle Cards */}
      <div className="space-y-3">
        {allActions.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-gray-300 rounded-lg">
            <p className="text-sm text-gray-600">
              No actions available. Please select a scenario first or add custom actions.
            </p>
          </div>
        ) : (
          allActions.map((action) => (
            <ActionToggleCard
              key={action.name}
              name={action.name}
              description={action.description}
              selected={selectedActionIds.includes(action.name)}
              onToggle={() => handleToggleAction(action.name)}
              isCustom={action.isCustom}
              onRemove={action.isCustom ? () => handleRemoveCustomAction(action.name) : undefined}
            />
          ))
        )}
      </div>

      {/* Add Custom Action Button (only for custom scenario) */}
      {isCustom && (
        <div>
          {!showAddAction ? (
            <button
              onClick={() => setShowAddAction(true)}
              className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
              type="button"
            >
              <Plus size={16} />
              <span className="text-sm font-medium">Add custom action</span>
            </button>
          ) : (
            <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
              <h4 className="text-sm font-medium text-gray-900">Add Custom Action</h4>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Action name
                </label>
                <input
                  type="text"
                  value={newActionName}
                  onChange={(e) => setNewActionName(e.target.value)}
                  placeholder="e.g., Negotiate"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newActionDescription}
                  onChange={(e) => setNewActionDescription(e.target.value)}
                  placeholder="Describe what this action does..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddCustomAction}
                  disabled={!newActionName.trim() || !newActionDescription.trim()}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  type="button"
                >
                  Add Action
                </button>
                <button
                  onClick={() => {
                    setShowAddAction(false);
                    setNewActionName('');
                    setNewActionDescription('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors"
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Selected Count */}
      {allActions.length > 0 && (
        <div className="text-sm text-gray-600">
          {selectedActionIds.length} of {allActions.length} actions selected
        </div>
      )}
    </div>
  );
};
