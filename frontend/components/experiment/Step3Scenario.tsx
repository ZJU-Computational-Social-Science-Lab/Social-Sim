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
import {
  getLocalizedActionDescription,
  getLocalizedActionName,
} from '../../utils/scenarioLocalization';

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
  tag: string;
  statusLabel: string;
  selected: boolean;
  onToggle: () => void;
  isCustom?: boolean;
  onRemove?: () => void;
  removeLabel?: string;
}

const ActionToggleCard: React.FC<ActionToggleCardProps> = ({
  name,
  description,
  tag,
  statusLabel,
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
            <div className="ss-heuristic-card__meta">
              <span className="ss-heuristic-card__tag">{tag}</span>
              <span className={`ss-heuristic-card__status${selected ? ' is-selected' : ''}`}>
                {statusLabel}
              </span>
            </div>
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

const classifyActionTag = (name: string, description: string, isZh: boolean) => {
  const source = `${name} ${description}`.toLowerCase();

  if (/cooperate|协作|合作|share|contribute|help|support/.test(source)) {
    return isZh ? '合作型' : 'Cooperative';
  }
  if (/defect|背叛|betray|cheat|take|attack|compete|抢/.test(source)) {
    return isZh ? '竞争型' : 'Competitive';
  }
  if (/observe|observer|监测|观察|inspect/.test(source)) {
    return isZh ? '观察型' : 'Observational';
  }
  if (/protect|care|careful|safe|guard|守|稳/.test(source)) {
    return isZh ? '稳健型' : 'Protective';
  }

  return isZh ? '策略型' : 'Strategic';
};

export const Step3Scenario: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
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

  useEffect(() => {
    if (selectedScenarioData) {
      const generatorParam = selectedScenarioData.parameters?.find(
        (p) => p.generates_actions === true
      );

      if (generatorParam) {
        const paramValue =
          (scenarioParams[generatorParam.key] as string) ||
          (generatorParam.default as string) ||
          '';

        const generatedActions = generateActionsFromChoices(paramValue);
        setAvailableActions(generatedActions);

        const existingSelectedIds = selectedActionIds.filter((id) =>
          generatedActions.some((a) => a.name === id)
        );
        const newActionIds = generatedActions
          .filter((a) => !availableActions.some((prev) => prev.name === a.name))
          .map((a) => a.name);

        if (existingSelectedIds.length === 0 && newActionIds.length > 0) {
          setSelectedActionIds(generatedActions.map((a) => a.name));
        } else {
          setSelectedActionIds([...existingSelectedIds, ...newActionIds]);
        }
      } else {
        const isPolicyCascadeScenario = isPolicyCascadeScenarioData(selectedScenarioData);
        const rawActions =
          selectedScenarioData.category_actions || selectedScenarioData.actions || [];
        const actionsToShow = isPolicyCascadeScenario
          ? buildPolicySceneActions()
          : rawActions;
        setAvailableActions(actionsToShow);

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

  const presetActionNames = new Set(
    (selectedScenarioData?.category_actions || selectedScenarioData?.actions || []).map((action) => action.name)
  );

  const allActions = availableActions.map((action) => ({
    ...action,
    isCustom: !presetActionNames.has(action.name),
  }));

  const handleToggleAction = (actionName: string) => {
    const isCurrentlySelected = selectedActionIds.includes(actionName);
    const willBeEmpty = isCurrentlySelected && selectedActionIds.length === 1;
    if (willBeEmpty) return;
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
            label={t('experimentBuilder.step3.selectionMode', { defaultValue: isZh ? '选择方式' : 'Selection mode' })}
            value={
              generatorParam
                ? t('experimentBuilder.dynamicActionsInfo.title')
                : t('experimentBuilder.step3.manualSelection', { defaultValue: isZh ? '手动选择' : 'Manual selection' })
            }
          />
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
      <div id="ss-step3-action-library" className="ss-guide-focus-target">
        {allActions.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-slate-300 p-8 text-center">
            <p className="text-sm text-slate-600">
              {t('experimentBuilder.step3.noActions')}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {allActions.map((action) => (
              <ActionToggleCard
                key={action.name}
                name={isPolicyCascadeScenario ? getPolicyActionLabel(action.name) : getLocalizedActionName(action.name, isZh)}
                description={getLocalizedActionDescription(action.description, isZh)}
                tag={classifyActionTag(action.name, action.description, isZh)}
                statusLabel={
                  selectedActionIds.includes(action.name)
                    ? isZh ? '已启用' : 'Enabled'
                    : isZh ? '未启用' : 'Disabled'
                }
                selected={selectedActionIds.includes(action.name)}
                onToggle={() => handleToggleAction(action.name)}
                isCustom={action.isCustom}
                onRemove={action.isCustom ? () => handleRemoveCustomAction(action.name) : undefined}
                removeLabel={t('experimentBuilder.step3.removeAction')}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Custom Action Button (only for custom scenario) */}
      {isCustom && (
        <div>
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
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ borderColor: 'var(--ss-border-strong)', background: 'var(--ss-page-surface)' }}
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
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                  style={{ borderColor: 'var(--ss-border-strong)', background: 'var(--ss-page-surface)' }}
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
        </div>
      )}
    </div>
  );
};
