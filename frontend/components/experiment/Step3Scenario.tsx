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

const POLICY_SCENE_ACTION_IDS = [
  'send_message',
  'yield',
  'report_upward',
  'escalate_complaint',
  'consult_peer',
  'notify_subordinate',
  'announce_policy_adjustment',
];

const isPolicyCascadeScenarioData = (scenario: {
  id?: string;
  name?: string;
  sceneType?: string;
  parameters?: Array<{ key: string }>;
} | null | undefined): boolean => {
  if (!scenario) return false;
  const scenarioId = String(scenario.id || '').toLowerCase();

  return (
    scenario.sceneType === 'policy_cascade_scene' ||
    scenarioId === 'policy_diffusion' ||
    scenarioId === 'policydiffusion' ||
    scenarioId === 'policy_erosion' ||
    scenarioId === 'policyerosion'
  );
};

interface ActionToggleCardProps {
  name: string;
  description: string;
  selected: boolean;
  onToggle: () => void;
  isCustom?: boolean;
  onRemove?: () => void;
  removeLabel?: string;
}

const ActionToggleCard: React.FC<ActionToggleCardProps> = ({
  name,
  description,
  selected,
  onToggle,
  isCustom = false,
  onRemove,
  removeLabel,
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
              aria-label={removeLabel}
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

  const buildPolicySceneActions = (): ActionDef[] => [
    {
      name: 'send_message',
      description: t('experimentBuilder.step3.policyActions.send_message.description'),
    },
    {
      name: 'yield',
      description: t('experimentBuilder.step3.policyActions.yield.description'),
    },
    {
      name: 'report_upward',
      description: t('experimentBuilder.step3.policyActions.report_upward.description'),
    },
    {
      name: 'escalate_complaint',
      description: t('experimentBuilder.step3.policyActions.escalate_complaint.description'),
    },
    {
      name: 'consult_peer',
      description: t('experimentBuilder.step3.policyActions.consult_peer.description'),
    },
    {
      name: 'notify_subordinate',
      description: t('experimentBuilder.step3.policyActions.notify_subordinate.description'),
    },
    {
      name: 'announce_policy_adjustment',
      description: t('experimentBuilder.step3.policyActions.announce_policy_adjustment.description'),
    },
  ];

  const getPolicyActionLabel = (actionName: string): string => {
    return t(`experimentBuilder.step3.policyActions.${actionName}.label`, { defaultValue: actionName });
  };

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
        const isPolicyCascadeScenario = isPolicyCascadeScenarioData(selectedScenarioData);
        const rawActions =
          selectedScenarioData.category_actions || selectedScenarioData.actions || [];
        const actionsToShow = isPolicyCascadeScenario
          ? buildPolicySceneActions()
          : rawActions;
        setAvailableActions(actionsToShow);

        // Use default_action_ids if available, otherwise select all actions by default
        const preferredIds = isPolicyCascadeScenario
          ? POLICY_SCENE_ACTION_IDS
          : (selectedScenarioData.default_action_ids || actionsToShow.map((a) => a.name));
        const defaultIds = preferredIds.filter((id) => actionsToShow.some((action) => action.name === id));
        setSelectedActionIds(defaultIds);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedScenarioData, scenarioParams, setAvailableActions, setSelectedActionIds]);

  const isCustom = selectedScenarioData?.id === 'custom';
  const isPolicyCascadeScenario = isPolicyCascadeScenarioData(selectedScenarioData);

  // Combine preset and custom actions
  const presetActionNames = new Set(
    (selectedScenarioData?.category_actions || selectedScenarioData?.actions || []).map((action) => action.name)
  );

  const allActions = availableActions.map((action) => ({
    ...action,
    isCustom: !presetActionNames.has(action.name),
  }));

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
    setAvailableActions([...availableActions, newAction]);
    setSelectedActionIds([...selectedActionIds, newAction.name]);

    // Reset form
    setNewActionName('');
    setNewActionDescription('');
    setShowAddAction(false);
  };

  const handleRemoveCustomAction = (actionName: string) => {
    setCustomActions(customActions.filter((a) => a.name !== actionName));
    setAvailableActions(availableActions.filter((a) => a.name !== actionName));
    setSelectedActionIds(selectedActionIds.filter((id) => id !== actionName));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          {t('experimentBuilder.step3.title')}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          {t('experimentBuilder.step3.subtitle')}
        </p>
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <div className="font-medium">{t('experimentBuilder.step3.linkedTitle')}</div>
          <div className="mt-1">{t('experimentBuilder.step3.linkedDesc')}</div>
        </div>
        {selectedScenarioData?.category_actions && (
          <p className="text-xs text-gray-600 mt-2">
            {t('experimentBuilder.step3.categoryInfo', { category: selectedScenarioData.category })}
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
              {t('experimentBuilder.step3.noActions')}
            </p>
          </div>
        ) : (
          allActions.map((action) => (
            <ActionToggleCard
              key={action.name}
              name={isPolicyCascadeScenario ? getPolicyActionLabel(action.name) : action.name}
              description={action.description}
              selected={selectedActionIds.includes(action.name)}
              onToggle={() => handleToggleAction(action.name)}
              isCustom={action.isCustom}
              onRemove={action.isCustom ? () => handleRemoveCustomAction(action.name) : undefined}
              removeLabel={t('experimentBuilder.step3.removeAction')}
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
              <span className="text-sm font-medium">{t('experimentBuilder.step3.addCustomAction')}</span>
            </button>
          ) : (
            <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
              <h4 className="text-sm font-medium text-gray-900">{t('experimentBuilder.step3.customActionTitle')}</h4>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t('experimentBuilder.step3.actionName')}
                </label>
                <input
                  type="text"
                  value={newActionName}
                  onChange={(e) => setNewActionName(e.target.value)}
                  placeholder={t('experimentBuilder.step3.actionNamePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t('experimentBuilder.step3.description')}
                </label>
                <textarea
                  value={newActionDescription}
                  onChange={(e) => setNewActionDescription(e.target.value)}
                  placeholder={t('experimentBuilder.step3.descriptionPlaceholder')}
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
                  {t('experimentBuilder.step3.addAction')}
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
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Selected Count */}
      {allActions.length > 0 && (
        <div className="text-sm text-gray-600">
          {t('experimentBuilder.step3.actionsSelected', { selected: selectedActionIds.length, total: allActions.length })}
        </div>
      )}
    </div>
  );
};
