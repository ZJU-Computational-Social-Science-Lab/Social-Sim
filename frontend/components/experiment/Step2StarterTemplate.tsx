import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useExperimentBuilder } from "../../store/experiment-builder";
import ParameterField from "./ParameterField";
import { ActionEditor } from "./ActionEditor";
import { ResourceConfig } from "./ResourceConfig";
import { FieldBlock } from "./workflow/FieldBlock";
import { ResearchInputPanel } from "./workflow/ResearchInputPanel";
import { SummaryInfoCard } from "./workflow/SummaryInfoCard";

const DISTORTION_ONLY_PARAM_KEYS = new Set([
  "distortion_strength",
  "conflict_sensitivity",
  "block_probability",
]);

const isCascadeScenario = (parameterKeys: string[]) =>
  parameterKeys.includes("cascade_mode");

interface PayoffInputProps {
  value: {
    cooperate_reward?: number;
    sucker_penalty?: number;
    temptation_reward?: number;
    defect_penalty?: number;
  };
  actionA?: string;
  actionB?: string;
  onChange: (value: {
    cooperate_reward: number;
    sucker_penalty: number;
    temptation_reward: number;
    defect_penalty: number;
  }) => void;
}

function PayoffInput({
  value,
  actionA = "Action 1",
  actionB = "Action 2",
  onChange,
}: PayoffInputProps) {
  const { t } = useTranslation();
  const defaults = {
    cooperate_reward: 3,
    sucker_penalty: 0,
    temptation_reward: 5,
    defect_penalty: 1,
  };

  const update = (key: keyof typeof defaults, raw: string) => {
    onChange({
      cooperate_reward: value.cooperate_reward ?? defaults.cooperate_reward,
      sucker_penalty: value.sucker_penalty ?? defaults.sucker_penalty,
      temptation_reward: value.temptation_reward ?? defaults.temptation_reward,
      defect_penalty: value.defect_penalty ?? defaults.defect_penalty,
      [key]: parseInt(raw, 10) || defaults[key],
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[22px] border border-sky-200 bg-sky-50 p-4">
        <div className="kicker">{t("experimentBuilder.step2.parametersTitle")}</div>
        <p className="mt-2 text-sm text-sky-900">
          {t("experimentBuilder.step2.payoffInput.instruction")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          ["cooperate_reward", actionA, actionA],
          ["sucker_penalty", actionA, actionB],
          ["temptation_reward", actionB, actionA],
          ["defect_penalty", actionB, actionB],
        ].map(([key, left, right]) => (
          <div key={key} className="lab-inset p-4">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              {t("experimentBuilder.step2.payoffInput.youThey", {
                actionA: left,
                actionB: right,
              })}
            </label>
            <input
              type="number"
              value={value[key as keyof typeof value] ?? defaults[key as keyof typeof defaults]}
              onChange={(event) => update(key as keyof typeof defaults, event.target.value)}
            />
          </div>
        ))}
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

  const [localRoundVisibility, setLocalRoundVisibility] = useState<
    "simultaneous" | "sequential"
  >("simultaneous");
  const [localTurnOrder, setLocalTurnOrder] = useState<"fixed" | "random">(
    "fixed"
  );

  useEffect(() => {
    if (roundVisibility) setLocalRoundVisibility(roundVisibility);
    if (turnOrder) setLocalTurnOrder(turnOrder);
  }, [roundVisibility, turnOrder]);

  useEffect(() => {
    if (selectedScenarioData && !scenarioDescription) {
      setScenarioDescription(selectedScenarioData.description);
    }
  }, [scenarioDescription, selectedScenarioData, setScenarioDescription]);

  useEffect(() => {
    if (
      selectedScenarioData &&
      selectedScenarioData.parameters &&
      Object.keys(scenarioParams).length === 0
    ) {
      const defaults: Record<string, unknown> = {};
      selectedScenarioData.parameters.forEach((param) => {
        defaults[param.key] = param.default;
      });
      setScenarioParams(defaults);
    }
  }, [scenarioParams, selectedScenarioData, setScenarioParams]);

  if (!selectedScenarioData) {
    return (
      <div className="lab-surface p-6 text-sm text-slate-500">
        {t("experimentBuilder.step2.selectScenarioFirst")}
      </div>
    );
  }

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

  const getParamValue = (param: { key: string; default: unknown }) =>
    scenarioParams[param.key] !== undefined ? scenarioParams[param.key] : param.default;

  const getParamLabel = (param: { key: string; label: string }) =>
    t(`experimentBuilder.paramLabels.${param.key}`, { defaultValue: param.label });

  const getParamDescription = (param: { key: string; description?: string }) =>
    t(`experimentBuilder.paramDescriptions.${param.key}`, {
      defaultValue: param.description || "",
    });

  const getActionEditor = () => {
    const scenarioId = selectedScenarioData.id;

    if (scenarioId === "battle_of_the_sexes" || scenarioId === "stag_hunt") {
      return (
        <ActionEditor
          actions={[
            {
              id: "action_1",
              nameParam: "action_1_name",
              descParam: "action_1_description",
              defaultName: selectedScenarioData.actions?.[0]?.name || "Action 1",
              defaultDesc: selectedScenarioData.actions?.[0]?.description || "",
            },
            {
              id: "action_2",
              nameParam: "action_2_name",
              descParam: "action_2_description",
              defaultName: selectedScenarioData.actions?.[1]?.name || "Action 2",
              defaultDesc: selectedScenarioData.actions?.[1]?.description || "",
            },
          ]}
          values={scenarioParams as Record<string, string>}
          onChange={(key, value) => setScenarioParams({ ...scenarioParams, [key]: value })}
        />
      );
    }

    if (scenarioId === "public_goods") {
      return (
        <ResourceConfig
          values={{
            resource_name: (scenarioParams.resource_name as string) || "Tokens",
            resource_name_custom: (scenarioParams.resource_name_custom as string) || "",
            initial_amount: (scenarioParams.initial_amount as number) || 20,
            multiplier: (scenarioParams.multiplier as number) || 1.5,
            action_name: (scenarioParams.action_name as string) || "Contribute",
            action_description:
              (scenarioParams.action_description as string) ||
              "Contribute {resource} to the shared pool",
          }}
          onChange={(key, value) => setScenarioParams({ ...scenarioParams, [key]: value })}
        />
      );
    }

    return null;
  };

  const hasParameters = selectedScenarioData.parameters.length > 0;
  const cascadeMode = String(
    scenarioParams.cascade_mode ??
      selectedScenarioData.parameters.find((param) => param.key === "cascade_mode")
        ?.default ??
      "strict_cascade"
  );
  const visibleParameters = selectedScenarioData.parameters.filter((param) => {
    if (!DISTORTION_ONLY_PARAM_KEYS.has(param.key)) {
      return true;
    }
    return cascadeMode === "distortion_cascade";
  });
  const showCascadeModeCard = isCascadeScenario(
    selectedScenarioData.parameters.map((param) => param.key)
  );
  const translatedName = t(
    `scenario.${selectedScenarioData.category}.${selectedScenarioData.id}.name`,
    { defaultValue: selectedScenarioData.name }
  );

  return (
    <div className="ss-variable-map">
      <ResearchInputPanel
        eyebrow={t("experimentBuilder.step2.framingTitle")}
        title={t("experimentBuilder.step2.configureTitle", { name: translatedName })}
        description={t("experimentBuilder.step2.configureSubtitle")}
      >
        <div className="ss-workflow-summary-grid">
          <SummaryInfoCard
            label={t("experimentDesk.summary.scenario")}
            value={translatedName}
            helper={t(`scenario.category.${selectedScenarioData.category}`)}
          />
          <SummaryInfoCard
            label={t("experimentDesk.summary.actions")}
            value={selectedScenarioData.actions?.length || selectedScenarioData.category_actions?.length || 0}
          />
          <SummaryInfoCard
            label={t("common.parameters")}
            value={visibleParameters.length}
          />
          <SummaryInfoCard
            label={t("experimentDesk.summary.schedule")}
            value={
              localRoundVisibility === "simultaneous"
                ? t("experimentDesk.summary.simultaneous")
                : localTurnOrder === "random"
                  ? t("experimentDesk.summary.random")
                  : t("experimentDesk.summary.fixed")
            }
          />
        </div>

        <div className="ss-variable-map__intro">
          <FieldBlock
            label={t("experimentBuilder.step2.scenarioDescriptionLabel")}
            helper={t("experimentBuilder.step2.configureSubtitle")}
          >
            <textarea
              id="scenario-description"
              value={scenarioDescription}
              onChange={(event) => setScenarioDescription(event.target.value)}
              rows={8}
              className="mt-1"
              placeholder={t("experimentBuilder.step2.scenarioDescriptionPlaceholder")}
            />
          </FieldBlock>

          <div className="ss-variable-map__context">
            <ResearchInputPanel
              eyebrow={t("experimentBuilder.step2.scheduleTitle")}
              title={translatedName}
              description={t(`scenarioLibrary.lenses.${selectedScenarioData.category}`)}
            >
              <div className="ss-variable-map__tag-row">
                <span className="lab-label">{t(`scenario.category.${selectedScenarioData.category}`)}</span>
                <span className="lab-label">
                  {selectedScenarioData.interaction_mode === "sequential"
                    ? t("experimentDesk.summary.sequential")
                    : t("experimentDesk.summary.simultaneous")}
                </span>
              </div>
            </ResearchInputPanel>

            {showCascadeModeCard ? (
              <div
                className={`rounded-[24px] border p-5 ${
                  cascadeMode === "distortion_cascade"
                    ? "border-amber-200 bg-amber-50"
                    : "border-sky-200 bg-sky-50"
                }`}
              >
                <div className="kicker">
                  {t(`experimentBuilder.step2.cascadeCards.${cascadeMode}.badge`)}
                </div>
                <div className="mt-3 text-lg font-semibold tracking-[-0.03em] text-slate-900">
                  {t(`experimentBuilder.step2.cascadeCards.${cascadeMode}.title`)}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {t(`experimentBuilder.step2.cascadeCards.${cascadeMode}.summary`)}
                </p>
                <ul className="mt-4 space-y-2 text-sm text-slate-700">
                  {["point1", "point2", "point3"].map((key) => (
                    <li key={key} className="flex gap-2">
                      <span>•</span>
                      <span>{t(`experimentBuilder.step2.cascadeCards.${cascadeMode}.${key}`)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </ResearchInputPanel>

      {getActionEditor() ? (
        <ResearchInputPanel
          eyebrow={t("experimentBuilder.step2.parametersTitle")}
          title={t("experimentBuilder.step2.actionEditorTitle", {
            defaultValue: "规则与变量补充",
          })}
          description={t("experimentBuilder.step2.actionEditorDescription", {
            defaultValue: "根据当前场景补充动作命名、资源设置或矩阵含义。",
          })}
        >
          {getActionEditor()}
        </ResearchInputPanel>
      ) : null}

      <ResearchInputPanel
        eyebrow={t("experimentBuilder.step2.parametersTitle")}
        title={t("experimentBuilder.step2.parametersTitle")}
        description={t("experimentBuilder.step2.parametersDescription", {
          defaultValue: "只保留研究真正需要的参数，避免一次性堆满所有字段。",
        })}
      >
        {selectedScenarioData.display_type === "payoff_matrix" ? (
          <div className="mt-1">
            <PayoffInput
              value={scenarioParams as { cooperate_reward?: number; defect_penalty?: number }}
              actionA={String(scenarioParams.action_1_name || selectedScenarioData.actions?.[0]?.name)}
              actionB={String(scenarioParams.action_2_name || selectedScenarioData.actions?.[1]?.name)}
              onChange={handlePayoffChange}
            />
          </div>
        ) : hasParameters ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {visibleParameters.map((param) => (
              <div key={param.key} className="lab-inset p-4">
                <label className="block text-sm font-medium text-slate-800">
                  {getParamLabel(param)}
                </label>
                {getParamDescription(param) ? (
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {getParamDescription(param)}
                  </p>
                ) : null}
                <div className="mt-3">
                  <ParameterField
                    param={{
                      type: param.type === "number" ? "integer" : "string",
                      default: param.default,
                      ui_hint: param.ui_hint || "text",
                      min: param.min,
                      max: param.max,
                      step: param.step,
                      options: param.options,
                      placeholder: param.placeholder,
                    }}
                    value={getParamValue(param)}
                    onChange={(value) =>
                      setScenarioParams({ ...scenarioParams, [param.key]: value })
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            {t("experimentBuilder.step2.noParameters")}
          </div>
        )}
      </ResearchInputPanel>

      {hasParameters ? (
        <ResearchInputPanel
          eyebrow={t("experimentBuilder.step2.scheduleTitle")}
          title={t("experimentBuilder.roundSettings.title")}
          description={t("experimentBuilder.roundSettings.subtitle", {
            defaultValue: "确定回合推进方式与观察顺序，让实验运行方式保持可解释。",
          })}
        >
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <FieldBlock label={t("experimentBuilder.roundSettings.roundVisibility.label")}>
              <select
                value={localRoundVisibility}
                onChange={(event) => {
                  const value = event.target.value as "simultaneous" | "sequential";
                  setLocalRoundVisibility(value);
                  setRoundVisibility(value);
                }}
                className="mt-1"
              >
                <option value="simultaneous">
                  {t("experimentBuilder.roundSettings.roundVisibility.simultaneous")}
                </option>
                <option value="sequential">
                  {t("experimentBuilder.roundSettings.roundVisibility.sequential")}
                </option>
              </select>
            </FieldBlock>

            <FieldBlock label={t("experimentBuilder.roundSettings.turnOrder.label")}>
              <select
                value={localTurnOrder}
                onChange={(event) => {
                  const value = event.target.value as "fixed" | "random";
                  setLocalTurnOrder(value);
                  setTurnOrder(value);
                }}
                className="mt-1"
                disabled={localRoundVisibility !== "sequential"}
              >
                <option value="fixed">
                  {t("experimentBuilder.roundSettings.turnOrder.fixed")}
                </option>
                <option value="random">
                  {t("experimentBuilder.roundSettings.turnOrder.random")}
                </option>
              </select>
            </FieldBlock>
          </div>
        </ResearchInputPanel>
      ) : null}
    </div>
  );
};

export default Step2StarterTemplate;
