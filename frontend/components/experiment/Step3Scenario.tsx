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
import { ResearchInputPanel } from './workflow/ResearchInputPanel';
import { SummaryInfoCard } from './workflow/SummaryInfoCard';

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
    <div className={`ss-heuristic-card ${selected ? 'is-selected' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Circle
            className={`w-5 h-5 flex-shrink-0 mt-0.5 ${selected ? 'text-current fill-current' : 'text-slate-300'}`}
          />
          <div className="flex-1 min-w-0">
            <h4 className="ss-heuristic-card__title">{name}</h4>
            <p className="ss-heuristic-card__copy">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isCustom && onRemove && (
            <button
              onClick={onRemove}
              className="ss-heuristic-card__remove"
              type="button"
              aria-label={removeLabel}
            >
              <X size={16} />
            </button>
          )}
          <button
            onClick={onToggle}
            className={`ss-heuristic-card__switch ${selected ? 'is-on' : ''}`}
            type="button"
            aria-pressed={selected}
          >
            <span
              className={`ss-heuristic-card__switch-thumb ${selected ? 'is-on' : ''}`}
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
    <div className="ss-heuristic-workflow">
      <ResearchInputPanel
        eyebrow={t('common.actions')}
        title={t('experimentBuilder.step3.title')}
        description={t('experimentBuilder.step3.subtitle')}
      >
        <div className="ss-workflow-summary-grid">
          <SummaryInfoCard
            label={t('experimentDesk.summary.actions')}
            value={selectedActionIds.length}
            helper={t('experimentBuilder.step3.actionsSelected', {
              selected: selectedActionIds.length,
              total: allActions.length,
            })}
          />
          <SummaryInfoCard
            label={t('experimentBuilder.step3.selectionMode', { defaultValue: 'Selection mode' })}
            value={generatorParam ? t('experimentBuilder.dynamicActionsInfo.title') : t('experimentBuilder.step3.manualSelection', { defaultValue: 'Manual selection' })}
          />
        </div>

        <div className="mt-4 rounded-[22px] border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-900">
          <div className="font-medium">{t('experimentBuilder.step3.linkedTitle')}</div>
          <div className="mt-2 leading-6">{t('experimentBuilder.step3.linkedDesc')}</div>
        </div>
        {selectedScenarioData?.category_actions && (
          <p className="mt-3 text-xs text-slate-500">
            {t('experimentBuilder.step3.categoryInfo', { category: selectedScenarioData.category })}
          </p>
        )}
      </ResearchInputPanel>

      {/* Dynamic actions info */}
      {generatorParam && (
        <div className="rounded-[22px] border border-sky-200 bg-sky-50 p-4">
          <p className="text-sm text-sky-800">
            <strong>{t('experimentBuilder.dynamicActionsInfo.title')}</strong>{' '}
            {t('experimentBuilder.dynamicActionsInfo.message', { paramLabel: generatorParam.label })}
          </p>
        </div>
      )}

      {/* Validation Error */}
      {validationErrors.actions && (
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm text-rose-700">{validationErrors.actions}</p>
        </div>
      )}

      {/* Action Toggle Cards */}
      <ResearchInputPanel
        eyebrow={t('experimentBuilder.step3.ruleLibrary', { defaultValue: 'Heuristic set' })}
        title={t('experimentBuilder.step3.ruleLibraryTitle', { defaultValue: '行为规则' })}
        description={t('experimentBuilder.step3.ruleLibraryDescription', {
          defaultValue: '保留研究者真正要比较的动作，不必一次性打开所有选项。',
        })}
      >
      <div className="grid gap-4 md:grid-cols-2">
        {allActions.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-slate-300 p-8 text-center">
            <p className="text-sm text-slate-600">
              {t('experimentBuilder.step3.noActions')}
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
              removeLabel={t('experimentBuilder.step3.removeAction')}
            />
          ))
        )}
      </div>
      </ResearchInputPanel>

      {/* Add Custom Action Button (only for custom scenario) */}
      {isCustom && (
        <ResearchInputPanel
          eyebrow={t('experimentBuilder.step3.customActionTitle')}
          title={t('experimentBuilder.step3.customActionTitle')}
          description={t('experimentBuilder.step3.customActionDescription', {
            defaultValue: '仅在自定义场景中补充新的动作规则。',
          })}
        >
          {!showAddAction ? (
            <button
              onClick={() => setShowAddAction(true)}
              className="ss-heuristic-card__add"
              type="button"
            >
              <Plus size={16} />
              <span className="text-sm font-medium">{t('experimentBuilder.step3.addCustomAction')}</span>
            </button>
          ) : (
            <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-sm font-medium text-slate-900">{t('experimentBuilder.step3.customActionTitle')}</h4>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  {t('experimentBuilder.step3.actionName')}
                </label>
                <input
                  type="text"
                  value={newActionName}
                  onChange={(e) => setNewActionName(e.target.value)}
                  placeholder={t('experimentBuilder.step3.actionNamePlaceholder')}
                  className="w-full bg-white text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  {t('experimentBuilder.step3.description')}
                </label>
                <textarea
                  value={newActionDescription}
                  onChange={(e) => setNewActionDescription(e.target.value)}
                  placeholder={t('experimentBuilder.step3.descriptionPlaceholder')}
                  rows={2}
                  className="w-full resize-y bg-white text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddCustomAction}
                  disabled={!newActionName.trim() || !newActionDescription.trim()}
                  className="ss-workflow-button ss-workflow-button--primary"
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
                  className="ss-workflow-button ss-workflow-button--secondary"
                  type="button"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}
        </ResearchInputPanel>
      )}

      {/* Selected Count */}
      {allActions.length > 0 && (
        <div className="text-sm text-slate-500">
          {t('experimentBuilder.step3.actionsSelected', { selected: selectedActionIds.length, total: allActions.length })}
        </div>
      )}
    </div>
  );
};
