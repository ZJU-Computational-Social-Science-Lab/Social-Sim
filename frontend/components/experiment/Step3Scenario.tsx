/**
 * Step 3: Action Selector
 *
 * Displays available actions as toggle cards.
 * Shows all category actions when scenario has category_actions.
 * Users can enable/disable actions and add custom actions for custom scenarios.
 * At least one action must be selected.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useExperimentBuilder } from '../../store/experiment-builder';
import { Circle, Plus, X } from 'lucide-react';
import { ActionDef } from '../../services/scenarios';
import { ResearchInputPanel } from './workflow/ResearchInputPanel';
import { SummaryInfoCard } from './workflow/SummaryInfoCard';

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

const summarizeBehaviorSpace = (
  selectedActions: Array<{ name: string; description: string }>,
  totalActions: number,
  minimumActionCount: number,
  isZh: boolean
) => {
  if (selectedActions.length < minimumActionCount) {
    return {
      title: isZh ? '当前动作不足' : 'Action space still too narrow',
      description: isZh
        ? `建议至少保留 ${minimumActionCount} 个动作，才能继续当前场景。`
        : `Keep at least ${minimumActionCount} action${minimumActionCount > 1 ? "s" : ""} so the simulation can continue.`,
      helper: isZh
        ? minimumActionCount === 1
          ? '先保留这个核心动作，再进入下一步。'
          : '当前还不足以形成清晰的策略对照。'
        : minimumActionCount === 1
          ? 'Keep the core action first and continue.'
          : 'There is not enough contrast yet to support a useful strategy comparison.',
    };
  }

  if (minimumActionCount === 1) {
    return {
      title: isZh ? `已选择 ${selectedActions.length} 个动作` : `${selectedActions.length} actions selected`,
      description: isZh
        ? '当前场景允许以单动作运行，先保留核心动作即可继续。'
        : 'This scene can run with a single core action.',
      helper: isZh
        ? totalActions > selectedActions.length
          ? '如需扩展比较，再按需补充更多动作。'
          : '当前单动作场景已经可以进入下一步。'
        : totalActions > selectedActions.length
          ? 'Add more actions later only if you need more contrast.'
          : 'The current single-action scene is ready for the next step.',
    };
  }

  if (selectedActions.length > 4) {
    return {
      title: isZh ? `已选择 ${selectedActions.length} 个动作` : `${selectedActions.length} actions selected`,
      description: isZh
        ? '当前动作较多，建议先保留最核心的 2 到 4 个动作。'
        : 'You currently have many actions enabled. Start with the most important 2 to 4 actions first.',
      helper: isZh
        ? '动作太多会削弱比较焦点。'
        : 'Too many actions can dilute the main comparison.',
    };
  }

  const source = selectedActions.map((action) => `${action.name} ${action.description}`).join(' ').toLowerCase();
  if (/cooperate|协作|合作/.test(source) && /defect|背叛|betray|竞争/.test(source)) {
    return {
      title: isZh ? `已选择 ${selectedActions.length} 个动作` : `${selectedActions.length} actions selected`,
      description: isZh
        ? '当前形成：合作 vs 背叛 的经典对抗结构。'
        : 'This currently forms a classic cooperation-vs-defection contrast.',
      helper: isZh
        ? '满足当前场景的基础策略比较需求。'
        : 'This is enough to support a baseline strategy comparison.',
    };
  }

  return {
    title: isZh ? `已选择 ${selectedActions.length} 个动作` : `${selectedActions.length} actions selected`,
    description: isZh
      ? '当前行为空间已经具备比较基础，可以继续绑定参与者策略。'
      : 'The action space already supports a useful comparison and can move on to participant strategy mapping.',
    helper: isZh
      ? totalActions > selectedActions.length
        ? '如需扩展，可以稍后再启用更多动作。'
        : '当前动作组合已经足够进入下一步。'
      : totalActions > selectedActions.length
        ? 'You can enable more actions later if needed.'
        : 'The current action set is already enough to continue.',
  };
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
  const [showAllActions, setShowAllActions] = useState(false);
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
  const minimumActionCount = allActions.length <= 1 ? 1 : 2;

  const selectedActions = useMemo(
    () => allActions.filter((action) => selectedActionIds.includes(action.name)),
    [allActions, selectedActionIds]
  );
  const behaviorSpaceSummary = useMemo(
    () => summarizeBehaviorSpace(selectedActions, allActions.length, minimumActionCount, isZh),
    [allActions.length, isZh, minimumActionCount, selectedActions]
  );
  const recommendedActions = useMemo(() => {
    const selectedFirst = allActions.filter((action) => selectedActionIds.includes(action.name));
    const remaining = allActions.filter((action) => !selectedActionIds.includes(action.name));
    return [...selectedFirst, ...remaining].slice(0, Math.min(4, allActions.length));
  }, [allActions, selectedActionIds]);
  const recommendedActionNames = useMemo(
    () => new Set(recommendedActions.map((action) => action.name)),
    [recommendedActions]
  );
  const commonActions = useMemo(
    () => allActions.filter((action) => !recommendedActionNames.has(action.name)).slice(0, 4),
    [allActions, recommendedActionNames]
  );
  const commonActionNames = useMemo(
    () => new Set(commonActions.map((action) => action.name)),
    [commonActions]
  );
  const expandedActions = useMemo(
    () =>
      allActions.filter(
        (action) =>
          !recommendedActionNames.has(action.name) && !commonActionNames.has(action.name)
      ),
    [allActions, commonActionNames, recommendedActionNames]
  );

  const renderActionGrid = (actions: typeof allActions) => {
    if (actions.length === 0) {
      return null;
    }

    return (
      <div className="grid gap-4 md:grid-cols-2">
        {actions.map((action) => (
          <ActionToggleCard
            key={action.name}
            name={action.name}
            description={action.description}
            tag={classifyActionTag(action.name, action.description, isZh)}
            statusLabel={
              selectedActionIds.includes(action.name)
                ? isZh
                  ? '已启用'
                  : 'Enabled'
                : isZh
                  ? '未启用'
                  : 'Disabled'
            }
            selected={selectedActionIds.includes(action.name)}
            onToggle={() => handleToggleAction(action.name)}
            isCustom={action.isCustom}
            onRemove={action.isCustom ? () => handleRemoveCustomAction(action.name) : undefined}
            removeLabel={t('experimentBuilder.step3.removeAction')}
          />
        ))}
      </div>
    );
  };

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
        description={
          isZh
            ? '先确定参与者在这个场景里到底可以做什么，再决定保留哪些动作进入实验。'
            : 'Define what participants can actually do in this scenario before deciding which actions belong in the experiment.'
        }
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
      <ResearchInputPanel
        eyebrow={t('experimentBuilder.step3.ruleLibrary', { defaultValue: 'Heuristic set' })}
        title={t('experimentBuilder.step3.ruleLibraryTitle', { defaultValue: '行为规则' })}
        description={t('experimentBuilder.step3.ruleLibraryDescription', {
          defaultValue: '先保留一组最基础、最可比较的动作，高级动作可以稍后再展开。',
        })}
      >
      <div id="ss-step3-action-library" className="ss-guide-focus-target">
          {allActions.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-slate-300 p-8 text-center">
            <p className="text-sm text-slate-600">
              {t('experimentBuilder.step3.noActions')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <section className="ss-heuristic-section">
              <div className="ss-heuristic-section__head">
                <strong>{isZh ? '推荐基础动作' : 'Recommended essentials'}</strong>
                <span>{isZh ? '先保留核心对比动作' : 'Start with the core comparison set'}</span>
              </div>
              {renderActionGrid(recommendedActions)}
            </section>

            {commonActions.length > 0 ? (
              <section className="ss-heuristic-section">
                <div className="ss-heuristic-section__head">
                  <strong>{isZh ? '常用动作' : 'Common actions'}</strong>
                  <span>{isZh ? '需要时再补充' : 'Add these only when needed'}</span>
                </div>
                {renderActionGrid(commonActions)}
              </section>
            ) : null}

            {expandedActions.length > 0 ? (
              <section className="ss-heuristic-section">
                <div className="ss-heuristic-section__head">
                  <strong>{isZh ? '全部动作' : 'All actions'}</strong>
                  <span>{isZh ? '高级项默认折叠' : 'Advanced options stay collapsed by default'}</span>
                </div>
                {!showAllActions ? (
                  <button
                    type="button"
                    onClick={() => setShowAllActions(true)}
                    className="ss-heuristic-card__add"
                  >
                    <Plus size={16} />
                    <span className="text-sm font-medium">
                      {isZh ? `展开全部动作（${expandedActions.length}）` : `Show all actions (${expandedActions.length})`}
                    </span>
                  </button>
                ) : (
                  <div className="space-y-4">
                    {renderActionGrid(expandedActions)}
                    <button
                      type="button"
                      onClick={() => setShowAllActions(false)}
                      className="ss-workflow-button ss-workflow-button--ghost w-fit"
                    >
                      {isZh ? '收起全部动作' : 'Hide all actions'}
                    </button>
                  </div>
                )}
              </section>
            ) : null}
          </div>
        )}
      </div>
      </ResearchInputPanel>

      <ResearchInputPanel
        eyebrow={isZh ? '当前已选动作' : 'Selected actions'}
        title={isZh ? '当前已选动作与行为空间' : 'Selected actions and behavior space'}
        description={
          isZh
            ? '已选动作会直接决定后续模拟中的策略比较。先形成一组基础对比，再决定是否扩展。'
            : 'The selected actions define the later strategic comparison. Build the core contrast first, then expand only if needed.'
        }
      >
        <div id="ss-step3-behavior-space" className="ss-behavior-space ss-guide-focus-target">
          <div className="ss-behavior-space__summary">
            <strong>{behaviorSpaceSummary.title}</strong>
            <p>{behaviorSpaceSummary.description}</p>
          </div>
          <div className="ss-behavior-space__chips">
            {selectedActions.map((action) => (
              <span key={action.name} className="ss-behavior-space__chip">
                {action.name}
              </span>
            ))}
          </div>
          <div className="ss-behavior-space__note">{behaviorSpaceSummary.helper}</div>
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

    </div>
  );
};
