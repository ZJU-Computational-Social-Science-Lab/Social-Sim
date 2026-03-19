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
import { ActionEditor } from './ActionEditor';
import { ResourceConfig } from './ResourceConfig';

const DISTORTION_ONLY_PARAM_KEYS = new Set([
  'distortion_strength',
  'conflict_sensitivity',
  'block_probability',
]);

const isCascadeScenario = (parameterKeys: string[]) => parameterKeys.includes('cascade_mode');

// Payoff Input Component - 4 explicit inputs with dynamic action labels
interface PayoffInputProps {
  value: {
    cooperate_reward?: number;
    sucker_penalty?: number;
    temptation_reward?: number;
    defect_penalty?: number;
  };
  actionA?: string;  // label for first action (e.g., "Cooperate", "Stag", "Study")
  actionB?: string;  // label for second action (e.g., "Defect", "Hare", "Cheat")
  onChange: (value: {
    cooperate_reward: number;
    sucker_penalty: number;
    temptation_reward: number;
    defect_penalty: number;
  }) => void;
}

function PayoffInput({ value, actionA = 'Action 1', actionB = 'Action 2', onChange }: PayoffInputProps) {
  const { t } = useTranslation();
  const defaults = { cooperate_reward: 3, sucker_penalty: 0, temptation_reward: 5, defect_penalty: 1 };

  const update = (key: keyof typeof defaults, raw: string) => {
    onChange({
      cooperate_reward: value.cooperate_reward ?? defaults.cooperate_reward,
      sucker_penalty: value.sucker_penalty ?? defaults.sucker_penalty,
      temptation_reward: value.temptation_reward ?? defaults.temptation_reward,
      defect_penalty: value.defect_penalty ?? defaults.defect_penalty,
      [key]: parseInt(raw) || defaults[key],
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 p-3 rounded-md text-sm mb-4">
        <p className="font-medium text-blue-800 mb-2">{t('experimentBuilder.step2.payoffInput.yourPayoffs')}</p>
        <p className="text-blue-700 text-xs">{t('experimentBuilder.step2.payoffInput.instruction')}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('experimentBuilder.step2.payoffInput.youThey', { actionA, actionB: actionA })}
          </label>
          <input
            type="number"
            value={value.cooperate_reward ?? defaults.cooperate_reward}
            onChange={(e) => update('cooperate_reward', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('experimentBuilder.step2.payoffInput.youThey', { actionA, actionB })}
          </label>
          <input
            type="number"
            value={value.sucker_penalty ?? defaults.sucker_penalty}
            onChange={(e) => update('sucker_penalty', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('experimentBuilder.step2.payoffInput.youThey', { actionA: actionB, actionB: actionA })}
          </label>
          <input
            type="number"
            value={value.temptation_reward ?? defaults.temptation_reward}
            onChange={(e) => update('temptation_reward', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('experimentBuilder.step2.payoffInput.youThey', { actionA: actionB, actionB: actionB })}
          </label>
          <input
            type="number"
            value={value.defect_penalty ?? defaults.defect_penalty}
            onChange={(e) => update('defect_penalty', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
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

  const handlePayoffChange = (value: {
    cooperate_reward: number;
    sucker_penalty: number;
    temptation_reward: number;
    defect_penalty: number;
  }) => {
    setScenarioParams({
      ...scenarioParams,
      cooperate_reward: value.cooperate_reward,
      sucker_penalty: value.sucker_penalty,
      temptation_reward: value.temptation_reward,
      defect_penalty: value.defect_penalty,
    });
  };

  const getParamValue = (param: { key: string; default: unknown }) => {
    return scenarioParams[param.key] !== undefined
      ? scenarioParams[param.key]
      : param.default;
  };

  const getParamLabel = (param: { key: string; label: string }) => {
    return t(`experimentBuilder.paramLabels.${param.key}`, { defaultValue: param.label });
  };

  const getParamDescription = (param: { key: string; description?: string }) => {
    return t(`experimentBuilder.paramDescriptions.${param.key}`, { defaultValue: param.description || '' });
  };

  // Determine which editor to show based on scenario
  const getActionEditor = () => {
    const scenarioId = selectedScenarioData.id;

    if (scenarioId === 'battle_of_the_sexes' || scenarioId === 'stag_hunt') {
      return (
        <ActionEditor
          actions={[
            {
              id: 'action_1',
              nameParam: 'action_1_name',
              descParam: 'action_1_description',
              defaultName: selectedScenarioData.actions?.[0]?.name || 'Action 1',
              defaultDesc: selectedScenarioData.actions?.[0]?.description || '',
            },
            {
              id: 'action_2',
              nameParam: 'action_2_name',
              descParam: 'action_2_description',
              defaultName: selectedScenarioData.actions?.[1]?.name || 'Action 2',
              defaultDesc: selectedScenarioData.actions?.[1]?.description || '',
            },
          ]}
          values={scenarioParams as Record<string, string>}
          onChange={handleParamChange}
        />
      );
    }

    if (scenarioId === 'public_goods') {
      return (
        <ResourceConfig
          values={{
            resource_name: (scenarioParams.resource_name as string) || 'Tokens',
            resource_name_custom: (scenarioParams.resource_name_custom as string) || '',
            initial_amount: (scenarioParams.initial_amount as number) || 20,
            multiplier: (scenarioParams.multiplier as number) || 1.5,
            action_name: (scenarioParams.action_name as string) || 'Contribute',
            action_description: (scenarioParams.action_description as string) || 'Contribute {resource} to the shared pool',
          }}
          onChange={handleParamChange}
        />
      );
    }

    return null;
  };

  if (!selectedScenarioData) {
    return (
      <div className="p-4 text-center text-gray-500">
        {t('experimentBuilder.step2.selectScenarioFirst')}
      </div>
    );
  }

  const hasParameters = selectedScenarioData.parameters.length > 0;
  const cascadeMode = String(
    scenarioParams.cascade_mode
      ?? selectedScenarioData.parameters.find((param) => param.key === 'cascade_mode')?.default
      ?? 'strict_cascade'
  );
  const visibleParameters = selectedScenarioData.parameters.filter((param) => {
    if (!DISTORTION_ONLY_PARAM_KEYS.has(param.key)) {
      return true;
    }
    return cascadeMode === 'distortion_cascade';
  });
  const showCascadeModeCard = isCascadeScenario(selectedScenarioData.parameters.map((param) => param.key));
  const cascadeCardTone = cascadeMode === 'distortion_cascade'
    ? 'border-amber-200 bg-amber-50'
    : 'border-blue-200 bg-blue-50';
  const cascadeBulletKeys = cascadeMode === 'distortion_cascade'
    ? ['point1', 'point2', 'point3']
    : ['point1', 'point2', 'point3'];

  return (
    <div className="space-y-6">
      <section className="studio-field-group">
        <div className="page-hero__eyebrow w-fit">Scenario framing</div>
        <h2 className="text-[1.32rem] font-bold text-[var(--sim-text-strong)]">
          {t('experimentBuilder.step2.configureTitle', { name: selectedScenarioData.name })}
        </h2>
        <p className="text-sm leading-7 text-[var(--sim-text-muted)]">
          {t('experimentBuilder.step2.configureSubtitle')}
        </p>
        <div>
          <label
            htmlFor="scenario-description"
            className="mb-2 block text-sm font-semibold text-[var(--sim-text-strong)]"
          >
            {t('experimentBuilder.step2.scenarioDescriptionLabel')}
          </label>
          <textarea
            id="scenario-description"
            value={scenarioDescription}
            onChange={handleDescriptionChange}
            rows={5}
            className="input resize-y"
            placeholder={t('experimentBuilder.step2.scenarioDescriptionPlaceholder')}
          />
        </div>
      </section>

      {showCascadeModeCard && (
        <section className={`studio-field-group ${cascadeCardTone}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[var(--sim-text-strong)]">
                {t(`experimentBuilder.step2.cascadeCards.${cascadeMode}.title`)}
              </h3>
              <p className="mt-2 text-sm leading-7 text-[var(--sim-text-muted)]">
                {t(`experimentBuilder.step2.cascadeCards.${cascadeMode}.summary`)}
              </p>
            </div>
            <span className="badge badge-outline">
              {t(`experimentBuilder.step2.cascadeCards.${cascadeMode}.badge`)}
            </span>
          </div>
          <ul className="space-y-2 text-sm text-[var(--sim-text-muted)]">
            {cascadeBulletKeys.map((key) => (
              <li key={key} className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>{t(`experimentBuilder.step2.cascadeCards.${cascadeMode}.${key}`)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {getActionEditor() ? (
        <section className="studio-field-group">
          <div className="page-hero__eyebrow w-fit">Additional rules</div>
          {getActionEditor()}
        </section>
      ) : null}

      {selectedScenarioData.display_type === 'payoff_matrix' ? (
        <section className="studio-field-group">
          <div className="page-hero__eyebrow w-fit">Core parameters</div>
          <PayoffInput
            value={scenarioParams as { cooperate_reward?: number; defect_penalty?: number }}
            actionA={scenarioParams.action_1_name || selectedScenarioData.actions?.[0]?.name}
            actionB={scenarioParams.action_2_name || selectedScenarioData.actions?.[1]?.name}
            onChange={handlePayoffChange}
          />
        </section>
      ) : hasParameters ? (
        <section className="studio-field-group">
          <div className="page-hero__eyebrow w-fit">Core parameters</div>
          <div className="grid gap-4">
            {visibleParameters.map((param) => {
              const value = getParamValue(param);
              const description = getParamDescription(param);

              return (
                <div key={param.key} className="studio-field-group !p-4">
                  <label className="block text-sm font-semibold text-[var(--sim-text-strong)]">
                    {getParamLabel(param)}
                  </label>
                  {description ? (
                    <p className="text-xs leading-6 text-[var(--sim-text-muted)]">{description}</p>
                  ) : null}
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
        </section>
      ) : (
        <section className="studio-field-group">
          <div className="text-sm text-[var(--sim-text-muted)]">
            {t('experimentBuilder.step2.noParameters')}
          </div>
        </section>
      )}

      {hasParameters && (
        <section className="studio-field-group">
          <div className="page-hero__eyebrow w-fit">Round mechanics</div>
          <div className="studio-pane-grid two">
            <div>
              <label className="mb-2 block text-sm font-semibold text-[var(--sim-text-strong)]">
                {t('experimentBuilder.roundSettings.roundVisibility.label')}
              </label>
              <select
                value={localRoundVisibility}
                onChange={(e) => {
                  const val = e.target.value as 'simultaneous' | 'sequential';
                  setLocalRoundVisibility(val);
                  setRoundVisibility(val);
                }}
                className="input"
              >
                <option value="simultaneous">
                  {t('experimentBuilder.roundSettings.roundVisibility.simultaneous')}
                </option>
                <option value="sequential">
                  {t('experimentBuilder.roundSettings.roundVisibility.sequential')}
                </option>
              </select>
            </div>

            {localRoundVisibility === 'sequential' ? (
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--sim-text-strong)]">
                  {t('experimentBuilder.roundSettings.turnOrder.label')}
                </label>
                <select
                  value={localTurnOrder}
                  onChange={(e) => {
                    const val = e.target.value as 'fixed' | 'random';
                    setLocalTurnOrder(val);
                    setTurnOrder(val);
                  }}
                  className="input"
                >
                  <option value="fixed">
                    {t('experimentBuilder.roundSettings.turnOrder.fixed')}
                  </option>
                  <option value="random">
                    {t('experimentBuilder.roundSettings.turnOrder.random')}
                  </option>
                </select>
              </div>
            ) : (
              <div className="studio-field-group !p-4">
                <div className="text-sm font-semibold text-[var(--sim-text-strong)]">
                  Simultaneous turns
                </div>
                <div className="text-sm leading-7 text-[var(--sim-text-muted)]">
                  All agents act within the same round window before the state advances.
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
