import React, { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useExperimentBuilder } from "../../store/experiment-builder";
import ParameterField from "./ParameterField";
import { ActionEditor } from "./ActionEditor";
import { ResourceConfig } from "./ResourceConfig";
import { FieldBlock } from "./workflow/FieldBlock";
import { ResearchInputPanel } from "./workflow/ResearchInputPanel";
import { SummaryInfoCard } from "./workflow/SummaryInfoCard";
import {
  getLocalizedActionName,
  getLocalizedScenarioDescription,
} from "../../utils/scenarioLocalization";

const DISTORTION_ONLY_PARAM_KEYS = new Set([
  "distortion_strength",
  "conflict_sensitivity",
  "block_probability",
]);

const isCascadeScenario = (parameterKeys: string[]) =>
  parameterKeys.includes("cascade_mode");

type StepTwoGuideTarget = "scenario" | "params" | "schedule";

interface ScenarioStructureAnalysis {
  ordering: string;
  explanation: string;
  inference: string;
}

const getNumericParam = (value: unknown, fallback: number) =>
  typeof value === "number" ? value : Number(value) || fallback;

const isNumericType = (type: string | undefined) =>
  type === "number" || type === "integer" || type === "float";

const toParameterFieldType = (type: string | undefined): "integer" | "string" | "boolean" | "array" => {
  if (type === "boolean") return "boolean";
  if (type === "array") return "array";
  if (isNumericType(type)) return "integer";
  return "string";
};

const buildOrdering = (entries: Array<{ label: string; value: number }>) => {
  const sorted = [...entries].sort((left, right) => {
    if (right.value !== left.value) {
      return right.value - left.value;
    }
    return left.label.localeCompare(right.label);
  });

  return sorted.reduce((output, entry, index) => {
    if (index === 0) {
      return entry.label;
    }
    const previous = sorted[index - 1];
    const connector = previous.value === entry.value ? " = " : " > ";
    return `${output}${connector}${entry.label}`;
  }, "");
};

export const analyzeScenarioStructure = (
  scenarioId: string,
  params: Record<string, unknown>,
  isZh: boolean
): ScenarioStructureAnalysis => {
  if (scenarioId === "battle_of_the_sexes") {
    return {
      ordering: isZh ? "协调型博弈" : "Coordination game",
      explanation: isZh
        ? "该场景属于协调型博弈。双方都希望达成一致，但偏好的协调结果不同。"
        : "This scenario is a coordination game. Both sides want to align, but they prefer different coordinated outcomes.",
      inference: isZh
        ? "当前实验重点在于观察个体如何在达成一致与坚持偏好之间做选择。"
        : "The key question is how agents trade off reaching agreement against holding onto their preferred option.",
    };
  }

  if (scenarioId === "stag_hunt") {
    return {
      ordering: isZh ? "高回报协作结构" : "High-trust coordination structure",
      explanation: isZh
        ? "该场景更接近鹿猎型协作。共同合作时回报最高，但一旦对彼此缺乏信任，就会退回更保守的选择。"
        : "This scenario is closer to a stag hunt. Joint cooperation pays most, but low trust pushes agents toward the safer option.",
      inference: isZh
        ? "实验重点在于观察信任是否足以支撑群体从保守策略转向高收益合作。"
        : "Focus on whether trust is strong enough to move the group from cautious play toward higher-yield cooperation.",
    };
  }

  if (scenarioId === "public_goods") {
    return {
      ordering: isZh ? "公共物品贡献结构" : "Public-goods contribution structure",
      explanation: isZh
        ? "该场景围绕公共资源贡献展开。个体贡献越多，集体收益越高，但搭便车也始终存在诱因。"
        : "This scenario revolves around contributing to a shared pool. Higher contribution benefits the group, but free-riding always remains tempting.",
      inference: isZh
        ? "实验重点在于观察贡献意愿如何随奖励分配、资源数量和群体规模而变化。"
        : "Focus on how willingness to contribute changes with reward distribution, available resources, and group size.",
    };
  }

  if (
    scenarioId === "policy_erosion" ||
    scenarioId === "policy_diffusion" ||
    scenarioId === "policyDiffusion"
  ) {
    return {
      ordering: isZh ? "层级政策传递结构" : "Hierarchical policy-transmission structure",
      explanation: isZh
        ? "该场景不是收益矩阵博弈，而是观察政策在多层级组织中被传达、改写、弱化或截留的过程。"
        : "This scenario is not a payoff-matrix game. It tracks how a policy is relayed, rewritten, weakened, or blocked across organizational tiers.",
      inference: isZh
        ? "实验重点在于观察传递模式、层级压力和执行语境如何共同造成政策意义磨损。"
        : "Focus on how transmission mode, tier pressure, and implementation context combine to erode policy meaning.",
    };
  }

  if (scenarioId === "xihu_yilianbao") {
    return {
      ordering: isZh ? "信息干预扩散结构" : "Insurance-information diffusion structure",
      explanation: isZh
        ? "该场景把西湖益联保的 A0-A8 信息干预转成社会网络中的投保扩散过程。个体会在官方背书、框架表达、家庭负担和邻里讨论之间反复权衡。"
        : "This scenario turns the Xihu Yilianbao A0-A8 information treatments into an enrollment diffusion process on a social network. Agents weigh official endorsement, framing, household burden, and peer discussion at the same time.",
      inference: isZh
        ? "实验重点在于观察哪类信息更容易把观望者推向投保，哪些家庭角色会把决策继续传递给家人或邻居。"
        : "Focus on which messages move hesitant agents toward enrollment, and which household roles carry that decision onward to family members or neighbors.",
    };
  }

  if (scenarioId === "echo_chamber" || scenarioId === "opinion_dynamics") {
    return {
      ordering: isZh ? "观点扩散结构" : "Opinion-dynamics structure",
      explanation: isZh
        ? "该场景关注观点扩散与回声室形成。个体会根据周围关系与信息环境不断调整表达。"
        : "This scenario focuses on opinion diffusion and echo-chamber formation. Agents adapt what they express based on local ties and information exposure.",
      inference: isZh
        ? "实验重点在于观察网络结构和接触范围如何影响观点收敛、分化或极化。"
        : "Focus on how network structure and exposure shape convergence, fragmentation, or polarization.",
    };
  }

  const R = getNumericParam(params.cooperate_reward, 3);
  const S = getNumericParam(params.sucker_penalty, 0);
  const T = getNumericParam(params.temptation_reward, 5);
  const P = getNumericParam(params.defect_penalty, 1);
  const ordering = buildOrdering([
    { label: "T", value: T },
    { label: "R", value: R },
    { label: "P", value: P },
    { label: "S", value: S },
  ]);

  if (T > R && R > P && P > S) {
    return {
      ordering,
      explanation: isZh ? "当前结构为典型囚徒困境，背叛拥有更强的即时激励。" : "This is a classic prisoner's dilemma with stronger short-term incentives to defect.",
      inference: isZh ? "在该参数结构下，群体更可能滑向背叛均衡，合作较难稳定。" : "Under this payoff structure, the group is more likely to drift toward defection, and cooperation is harder to sustain.",
    };
  }

  if (R > T && T >= P && P > S) {
    return {
      ordering,
      explanation: isZh ? "当前结构更接近鹿猎型协作，合作回报最高，但需要彼此信任。" : "This structure is closer to a stag-hunt: cooperation pays most, but only when trust holds.",
      inference: isZh ? "群体可能在稳定合作和保守回避之间摇摆，关键在于能否形成共同预期。" : "The group may oscillate between stable cooperation and safer retreat, depending on whether shared expectations can form.",
    };
  }

  if (T > R && R > S && S > P) {
    return {
      ordering,
      explanation: isZh ? "当前结构更接近胆小鬼博弈，搭便车很诱人，但双方都强硬时结果最差。" : "This looks more like chicken: free-riding is tempting, but mutual hardline choices are worst for both.",
      inference: isZh ? "你更可能看到轮流让步或混合策略，而不是稳定的单一均衡。" : "You are more likely to see alternating concessions or mixed strategies instead of one stable equilibrium.",
    };
  }

  return {
    ordering,
    explanation: isZh ? "当前收益结构不是常见模板，需要结合研究问题来判断合作与背叛的动力。" : "This payoff pattern does not match the common templates exactly, so it should be interpreted in the context of your research question.",
    inference: isZh ? "建议先观察最高收益与最低风险分别落在哪个行动组合上，再决定是否继续微调参数。" : "Check which action pair maximizes reward and which combination minimizes risk before tuning the parameters further.",
  };
};

interface PayoffInputProps {
  value: {
    cooperate_reward?: number;
    sucker_penalty?: number;
    temptation_reward?: number;
    defect_penalty?: number;
  };
  actionA?: string;
  actionB?: string;
  highlightFirstCard?: boolean;
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
  highlightFirstCard = false,
  onChange,
}: PayoffInputProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");
  const defaults = {
    cooperate_reward: 3,
    sucker_penalty: 0,
    temptation_reward: 5,
    defect_penalty: 1,
  };

  const localizedActionA = getLocalizedActionName(actionA, isZh);
  const localizedActionB = getLocalizedActionName(actionB, isZh);

  const cards = [
    {
      key: "cooperate_reward" as const,
      left: localizedActionA,
      right: localizedActionA,
    },
    {
      key: "sucker_penalty" as const,
      left: localizedActionA,
      right: localizedActionB,
    },
    {
      key: "temptation_reward" as const,
      left: localizedActionB,
      right: localizedActionA,
    },
    {
      key: "defect_penalty" as const,
      left: localizedActionB,
      right: localizedActionB,
    },
  ];

  const update = (key: keyof typeof defaults, raw: string) => {
    onChange({
      cooperate_reward: value.cooperate_reward ?? defaults.cooperate_reward,
      sucker_penalty: value.sucker_penalty ?? defaults.sucker_penalty,
      temptation_reward: value.temptation_reward ?? defaults.temptation_reward,
      defect_penalty: value.defect_penalty ?? defaults.defect_penalty,
      [key]: Number(raw) || defaults[key],
    });
  };

  return (
    <div className="ss-variable-map__core-grid">
      {cards.map((card) => {
        const currentValue = value[card.key] ?? defaults[card.key];
        return (
          <article
            key={card.key}
            className={`ss-variable-map__param-card${
              highlightFirstCard && card.key === "cooperate_reward" ? " is-guided" : ""
            }`.trim()}
          >
            <div className="ss-variable-map__param-head">
              <div className="ss-variable-map__param-copy">
                <h3 className="ss-variable-map__param-name">
                  {isZh
                    ? `当你选择${card.left}，对方选择${card.right}时`
                    : `When you choose ${card.left} and the other side chooses ${card.right}`}
                </h3>
              </div>
              <div className="ss-variable-map__param-current">{currentValue}</div>
            </div>

            <div className="ss-variable-map__range-row">
              <input
                type="range"
                min={-5}
                max={10}
                step={1}
                value={currentValue}
                onChange={(event) => update(card.key, event.target.value)}
                className="ss-variable-map__range-input"
              />
              <input
                type="number"
                min={-5}
                max={10}
                step={1}
                value={currentValue}
                onChange={(event) => update(card.key, event.target.value)}
                className="ss-variable-map__value-input"
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}

export const Step2StarterTemplate: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");
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
  const [guidedTarget, setGuidedTarget] = useState<StepTwoGuideTarget | null>(null);

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

  useEffect(() => {
    const handleGuideEvent = (rawEvent: Event) => {
      const event = rawEvent as CustomEvent<{ target: StepTwoGuideTarget }>;
      const target = event.detail.target;
      setGuidedTarget(target);

      window.setTimeout(() => {
        const elementId =
          target === "scenario"
            ? "ss-step2-scenario-summary"
            : target === "params"
              ? "ss-step2-core-params"
              : "ss-step2-schedule-settings";
        document
          .getElementById(elementId)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 0);
    };

    window.addEventListener("ss-step2-guide", handleGuideEvent as EventListener);
    return () =>
      window.removeEventListener("ss-step2-guide", handleGuideEvent as EventListener);
  }, []);

  useEffect(() => {
    if (!guidedTarget) {
      return;
    }

    const timer = window.setTimeout(() => setGuidedTarget(null), 1800);
    return () => window.clearTimeout(timer);
  }, [guidedTarget]);

  if (!selectedScenarioData) {
    return (
      <div className="lab-surface p-6 text-sm text-slate-500">
        {t("experimentBuilder.step2.selectScenarioFirst")}
      </div>
    );
  }

  const handleParamChange = (key: string, value: unknown) => {
    setScenarioParams({ ...scenarioParams, [key]: value });
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setScenarioDescription(e.target.value);
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

  const getParamValue = (param: { key: string; default: unknown }) =>
    scenarioParams[param.key] !== undefined ? scenarioParams[param.key] : param.default;

  const getParamDescription = (param: { key: string; description?: string }) =>
    t(`experimentBuilder.paramDescriptions.${param.key}`, {
      defaultValue: param.description || "",
    });

  const rawActionA = String(
    scenarioParams.action_1_name || selectedScenarioData.actions?.[0]?.name || "Action 1"
  );
  const rawActionB = String(
    scenarioParams.action_2_name || selectedScenarioData.actions?.[1]?.name || "Action 2"
  );
  const localizedActionA = getLocalizedActionName(rawActionA, isZh);
  const localizedActionB = getLocalizedActionName(rawActionB, isZh);

  const getParamLabel = (param: { key: string; label: string }) =>
    t(`experimentBuilder.paramLabels.${param.key}`, { defaultValue: param.label });

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
          onChange={(key, value) => handleParamChange(key, value)}
        />
      );
    }

    if (scenarioId === "public_goods") {
      const defaultResourceName = t('experimentBuilder.resourceConfig.resourceOptions.tokens', { defaultValue: 'tokens' });
      return (
        <ResourceConfig
          values={{
            resource_name: (scenarioParams.resource_name as string) || defaultResourceName,
            tokens_per_round: (scenarioParams.tokens_per_round as number) ?? 10,
            multiplier: (scenarioParams.multiplier as number) ?? 1.3,
            deduction_budget_per_phase: (scenarioParams.deduction_budget_per_phase as number) ?? 0,
            deduction_cost_ratio: (scenarioParams.deduction_cost_ratio as number) ?? 3,
            deduction_anonymous: (scenarioParams.deduction_anonymous as boolean) ?? false,
            show_average_contribution: (scenarioParams.show_average_contribution as boolean) ?? false,
          }}
          onChange={handleParamChange}
        />
      );
    }

    return null;
  };

  const hasParameters = selectedScenarioData.parameters.length > 0;
  const scenarioCategoryLabel = t(`scenario.category.${selectedScenarioData.category}`);
  const translatedName = t(
    `scenario.${selectedScenarioData.category}.${selectedScenarioData.id}.name`,
    { defaultValue: selectedScenarioData.name }
  );
  const translatedDescription = getLocalizedScenarioDescription(t, selectedScenarioData);
  const scheduleLabel =
    localRoundVisibility === "simultaneous"
      ? t("experimentDesk.summary.simultaneous")
      : localTurnOrder === "random"
        ? t("experimentDesk.summary.random")
        : t("experimentDesk.summary.fixed");

  const cascadeMode = String(
    scenarioParams.cascade_mode ??
      selectedScenarioData.parameters.find((param) => param.key === "cascade_mode")
        ?.default ??
      "strict_cascade"
  );
  const visibleParameters = selectedScenarioData.parameters.filter((param) => {
    // Exclude deduction category parameters - they're handled by ResourceConfig
    if (param.category === 'deduction') {
      return false;
    }
    // Exclude resource category parameters - they're handled by ResourceConfig
    if (param.category === 'resource') {
      return false;
    }
    if (!DISTORTION_ONLY_PARAM_KEYS.has(param.key)) {
      return true;
    }
    return cascadeMode === "distortion_cascade";
  });

  const currentTags = [
    scenarioCategoryLabel,
    selectedScenarioData.interaction_mode === "sequential"
      ? t("experimentDesk.summary.sequential")
      : t("experimentDesk.summary.simultaneous"),
    selectedScenarioData.display_type === "payoff_matrix"
      ? isZh
        ? "矩阵对照"
        : "Matrix setup"
      : isZh
        ? "参数配置"
        : "Parameter-driven",
  ].filter(Boolean);

  const actionEditor = getActionEditor();
  const tuningCount = visibleParameters.reduce((count, param) => {
    const currentValue = getParamValue(param);
    return count + (JSON.stringify(currentValue) === JSON.stringify(param.default) ? 0 : 1);
  }, 0);

  return (
    <div className="ss-variable-map">
      <ResearchInputPanel
        eyebrow={isZh ? "当前场景" : "Current scenario"}
        title={translatedName}
      >
        <div
          id="ss-step2-scenario-summary"
          className={`ss-variable-map__scenario-summary${
            guidedTarget === "scenario" ? " is-guided" : ""
          }`.trim()}
        >
          <div className="ss-variable-map__scenario-copy">
            <div className="ss-variable-map__tag-row">
              {currentTags.map((tag) => (
                <span key={tag} className="ss-variable-map__tag">
                  {tag}
                </span>
              ))}
            </div>
              <label
                htmlFor="scenario-description"
                className="block text-sm font-medium mt-1"
                style={{ color: 'var(--ss-heading)' }}
              >
                {t('experimentBuilder.step2.scenarioDescriptionLabel')}
              </label>
              <textarea
                id="scenario-description"
                value={scenarioDescription}
                onChange={handleDescriptionChange}
                rows={4}
                className="w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 resize-y mt-1"
                style={{ borderColor: 'var(--ss-border-strong)' }}
                placeholder={t('experimentBuilder.step2.scenarioDescriptionPlaceholder')}
              />
          </div>

          <div className="ss-variable-map__summary-cards">
            <SummaryInfoCard
              label={isZh ? "动作空间" : "Action space"}
              value={
                selectedScenarioData.actions?.length ||
                selectedScenarioData.category_actions?.length ||
                0
              }
            />
            <SummaryInfoCard
              label={isZh ? "参数数量" : "Parameters"}
              value={visibleParameters.length}
            />
            <SummaryInfoCard
              label={isZh ? "推进机制" : "Schedule"}
              value={scheduleLabel}
            />
          </div>
        </div>
      </ResearchInputPanel>

      <ResearchInputPanel
        eyebrow={isZh ? "核心参数" : "Key variables"}
        title={isZh ? "先调整这几个关键参数" : "Start with these key parameters"}
        actions={
          <div className="ss-variable-map__focus-chip">
            <SlidersHorizontal size={16} />
            <span>
              {isZh
                ? `已调整 ${tuningCount} 项`
                : `${tuningCount} tuned`}
            </span>
          </div>
        }
      >
        <div id="ss-step2-core-params">
          {actionEditor}
          {selectedScenarioData.display_type === "payoff_matrix" ? (
            <PayoffInput
              value={scenarioParams as { cooperate_reward?: number; defect_penalty?: number }}
              actionA={rawActionA}
              actionB={rawActionB}
              highlightFirstCard={guidedTarget === "params"}
              onChange={handlePayoffChange}
            />
          ) : hasParameters ? (
            <div className="ss-variable-map__core-grid">
              {visibleParameters.map((param, index) => {
                const value = getParamValue(param);
                const description = getParamDescription(param);
                return (
                  <article
                    key={param.key}
                    className={`ss-variable-map__param-card${
                      guidedTarget === "params" && index === 0 ? " is-guided" : ""
                    }`.trim()}
                  >
                    <div className="ss-variable-map__param-head">
                      <div className="ss-variable-map__param-copy">
                        <h3 className="ss-variable-map__param-name">{getParamLabel(param)}</h3>
                        {description ? (
                          <p className="text-xs leading-5 text-[var(--ss-workspace-muted)]">{description}</p>
                        ) : null}
                      </div>
                      <div className="ss-variable-map__param-current">
                        {String(value)}
                      </div>
                    </div>

                    <div className="ss-variable-map__field-wrap">
                      <ParameterField
                        param={{
                          type: toParameterFieldType(param.type),
                          default: param.default,
                          ui_hint:
                            param.ui_hint ||
                            (isNumericType(param.type)
                              ? "number"
                              : param.type === "boolean"
                                ? "toggle"
                                : "text"),
                          min: param.min,
                          max: param.max,
                          step: param.step,
                          options: param.options,
                          placeholder: param.placeholder,
                        }}
                        value={value}
                        onChange={(nextValue) => handleParamChange(param.key, nextValue)}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              {t("experimentBuilder.step2.noParameters")}
            </div>
          )}
        </div>
      </ResearchInputPanel>

      {hasParameters ? (
        <ResearchInputPanel
          eyebrow={isZh ? "轮次设置" : "Round settings"}
          title={t("experimentBuilder.roundSettings.title")}
        >
          <section
            id="ss-step2-schedule-settings"
            className={`ss-variable-map__advanced-section${
              guidedTarget === "schedule" ? " is-guided" : ""
            }`.trim()}
          >
            <div className="ss-variable-map__advanced-grid">
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
          </section>
        </ResearchInputPanel>
      ) : null}
    </div>
  );
};

export default Step2StarterTemplate;
