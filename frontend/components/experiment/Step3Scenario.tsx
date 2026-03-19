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
        p-5 border rounded-[22px] transition-all
        ${selected
          ? 'border-[var(--sim-border-strong)] bg-[var(--sim-primary-soft)]'
          : 'border-[var(--sim-border)] bg-[rgba(255,255,255,0.45)] hover:border-[var(--sim-border-strong)] dark:bg-[rgba(255,255,255,0.02)]'
        }
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Circle
            className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
              selected ? 'text-[var(--sim-primary)] fill-[var(--sim-primary)]' : 'text-[var(--sim-text-soft)]'
            }`}
          />
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm text-[var(--sim-text-strong)]">
              {name}
            </h4>
            <p className="mt-2 text-sm text-[var(--sim-text-muted)] line-clamp-2">
              {description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isCustom && onRemove && (
            <button
              onClick={onRemove}
              className="rounded p-1.5 text-[var(--sim-text-soft)] transition-colors hover:bg-[rgba(196,107,114,0.12)] hover:text-[var(--sim-danger)]"
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
              ${selected ? 'bg-[var(--sim-primary)]' : 'bg-[rgba(111,127,144,0.28)]'}
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
      <div className="studio-field-group">
        <div className="page-hero__eyebrow w-fit">Action space</div>
        <h2 className="text-xl font-semibold text-[var(--sim-text-strong)]">
          {t('experimentBuilder.step3.title')}
        </h2>
        <p className="mt-1 text-sm leading-7 text-[var(--sim-text-muted)]">
          {t('experimentBuilder.step3.subtitle')}
        </p>
        <div className="mt-3 rounded-[18px] border border-[var(--sim-border)] bg-[rgba(255,255,255,0.42)] px-4 py-3 text-sm text-[var(--sim-text-muted)] dark:bg-[rgba(255,255,255,0.02)]">
          <div className="font-medium text-[var(--sim-text-strong)]">{t('experimentBuilder.step3.linkedTitle')}</div>
          <div className="mt-1">{t('experimentBuilder.step3.linkedDesc')}</div>
        </div>
        {selectedScenarioData?.category_actions && (
          <p className="mt-2 text-xs text-[var(--sim-text-muted)]">
            {t('experimentBuilder.step3.categoryInfo', { category: selectedScenarioData.category })}
          </p>
        )}
      </div>

      {/* Dynamic actions info */}
      {generatorParam && (
        <div className="studio-field-group !p-4">
          <p className="text-sm text-[var(--sim-text-muted)]">
            <strong>{t('experimentBuilder.dynamicActionsInfo.title')}</strong>{' '}
            {t('experimentBuilder.dynamicActionsInfo.message', { paramLabel: generatorParam.label })}
          </p>
        </div>
      )}

      {/* Validation Error */}
      {validationErrors.actions && (
        <div className="studio-field-group !p-4">
          <p className="text-sm text-[var(--sim-danger)]">{validationErrors.actions}</p>
        </div>
      )}

      {/* Action Toggle Cards */}
      <div className="grid gap-3">
        {allActions.length === 0 ? (
          <div className="studio-field-group text-center">
            <p className="text-sm text-[var(--sim-text-muted)]">
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

      {/* Add Custom Action Button (only for custom scenario) */}
      {isCustom && (
        <div>
          {!showAddAction ? (
            <button
              onClick={() => setShowAddAction(true)}
              className="flex items-center gap-2 rounded-[18px] border border-dashed border-[var(--sim-border)] px-4 py-3 text-[var(--sim-text-muted)] transition-colors hover:border-[var(--sim-border-strong)] hover:text-[var(--sim-primary)]"
              type="button"
            >
              <Plus size={16} />
              <span className="text-sm font-medium">{t('experimentBuilder.step3.addCustomAction')}</span>
            </button>
          ) : (
            <div className="studio-field-group">
              <h4 className="text-sm font-medium text-[var(--sim-text-strong)]">{t('experimentBuilder.step3.customActionTitle')}</h4>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--sim-text-strong)]">
                  {t('experimentBuilder.step3.actionName')}
                </label>
                <input
                  type="text"
                  value={newActionName}
                  onChange={(e) => setNewActionName(e.target.value)}
                  placeholder={t('experimentBuilder.step3.actionNamePlaceholder')}
                  className="input"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--sim-text-strong)]">
                  {t('experimentBuilder.step3.description')}
                </label>
                <textarea
                  value={newActionDescription}
                  onChange={(e) => setNewActionDescription(e.target.value)}
                  placeholder={t('experimentBuilder.step3.descriptionPlaceholder')}
                  rows={2}
                  className="input resize-y"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddCustomAction}
                  disabled={!newActionName.trim() || !newActionDescription.trim()}
                  className="button"
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
                  className="button-ghost"
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
        <div className="text-sm text-[var(--sim-text-muted)]">
          {t('experimentBuilder.step3.actionsSelected', { selected: selectedActionIds.length, total: allActions.length })}
        </div>
      )}
    </div>
  );
};
