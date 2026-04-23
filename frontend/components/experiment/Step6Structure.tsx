import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useExperimentBuilder } from "../../store/experiment-builder";
import { buildAgentCollections } from "../../utils/agentCollections";
import { Button } from "../ui/button";
import { ResearchInputPanel } from "./workflow/ResearchInputPanel";
import { SecondaryGhostButton } from "./workflow/SecondaryGhostButton";
import { SummaryInfoCard } from "./workflow/SummaryInfoCard";
import {
  formatScenarioParamValue,
  getLocalizedScenarioName,
  getScenarioParamDefinition,
} from "../../utils/scenarioLocalization";

interface PromptPreviewPanelProps {
  scenarioData: ReturnType<typeof useExperimentBuilder.getState>["selectedScenarioData"];
  agentTypeLabel: string;
  agentTypeProfile: string;
  agentTypeRolePrompt: string;
  agentTypeProperties: Record<string, unknown>;
  scenarioDescription: string;
  scenarioParams: Record<string, unknown>;
  availableActions: Array<{ name: string; description: string }>;
  selectedActionIds: string[];
}

interface LaunchCheckItem {
  key: string;
  label: string;
  value: string;
  helper: string;
  complete: boolean;
  required?: boolean;
}

const getEdgeCount = (network: Record<string, string[]>) => {
  const edges = new Set<string>();
  Object.entries(network).forEach(([source, targets]) => {
    targets.forEach((target) => {
      const key = source < target ? `${source}|${target}` : `${target}|${source}`;
      edges.add(key);
    });
  });
  return edges.size;
};

const formatValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return String(value);
};

const focusLaunchReviewElement = (elementId: string) => {
  const element = document.getElementById(elementId);
  if (!element) {
    return;
  }

  element.classList.remove("is-guided");
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  window.requestAnimationFrame(() => {
    element.classList.add("is-guided");
    window.setTimeout(() => element.classList.remove("is-guided"), 1800);
  });
};

const getStructureLabel = (
  scenarioData: ReturnType<typeof useExperimentBuilder.getState>["selectedScenarioData"],
  edgeCount: number,
  nodeCount: number,
  totalAgents: number,
  isZh: boolean
) => {
  if (nodeCount === 0) {
    return isZh ? "尚未确认" : "Not confirmed";
  }

  const topology = scenarioData?.topology_type;
  if (topology === "full") {
    return isZh ? "全连接" : "Fully connected";
  }
  if (topology === "random") {
    return isZh ? "随机" : "Random";
  }
  if (topology === "ring") {
    return isZh ? "环形" : "Ring";
  }
  if (topology === "star") {
    return isZh ? "星形" : "Star";
  }
  if (topology === "newman-watts") {
    return isZh ? "小世界" : "Small world";
  }
  if (topology === "core-periphery") {
    return isZh ? "核心-边缘" : "Core-periphery";
  }
  if (topology === "sbm") {
    return isZh ? "社区" : "Community";
  }
  if (topology === "custom") {
    return isZh ? "自定义结构" : "Custom structure";
  }
  if (edgeCount > 0) {
    return isZh ? "已建立连接" : "Connections configured";
  }
  if (totalAgents <= 1) {
    return isZh ? "单智能体，无需连接" : "Single agent, no links needed";
  }
  return isZh ? "已选择结构，待补充连接" : "Structure selected, links still needed";
};

const getLaunchMissingStep = (
  scenarioReady: boolean,
  actionReady: boolean,
  participantReady: boolean,
  providerReady: boolean,
  structureReady: boolean
) => {
  if (!scenarioReady) {
    return 1 as const;
  }
  if (!actionReady) {
    return 3 as const;
  }
  if (!participantReady || !providerReady) {
    return 4 as const;
  }
  if (!structureReady) {
    return 5 as const;
  }
  return 6 as const;
};

const PromptPreviewPanel: React.FC<PromptPreviewPanelProps> = ({
  scenarioData,
  agentTypeLabel,
  agentTypeProfile,
  agentTypeRolePrompt,
  agentTypeProperties,
  scenarioDescription,
  scenarioParams,
  availableActions,
  selectedActionIds,
}) => {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");
  const selectedActions = availableActions.filter((action) =>
    selectedActionIds.includes(action.name)
  );
  const previewProperties = Object.entries(agentTypeProperties || {}).filter(
    ([key]) => !["avatarUrl", "llm_config", "provider_id"].includes(key)
  );

  return (
    <div className="ss-launch-preview__prompt">
      <div className="ss-launch-preview__prompt-head">
        <div>
          <div className="ss-workflow-kicker">
            {isZh ? "系统说明预览" : "System prompt preview"}
          </div>
          <h3>{agentTypeLabel}</h3>
          <p>
            {isZh
              ? "以下内容展示该智能体在实验启动前会收到的代表性说明。"
              : "This shows the representative instruction summary the agent will receive before launch."}
          </p>
        </div>
      </div>

      <div className="ss-launch-preview__prompt-body">
        <section>
          <h4>{isZh ? "智能体定位" : "Agent framing"}</h4>
          <p>
            {[agentTypeRolePrompt, agentTypeProfile].filter(Boolean).join(" ") ||
              (isZh ? "尚未补充具体定位。" : "No agent framing has been added yet.")}
          </p>
        </section>

        <section>
          <h4>{isZh ? "研究场景" : "Scenario"}</h4>
          <p>
            {scenarioDescription ||
              (isZh ? "尚未补充研究说明。" : "No research framing has been entered yet.")}
          </p>
        </section>

        <section>
          <h4>{isZh ? "当前参数" : "Current parameters"}</h4>
          {Object.keys(scenarioParams).length > 0 ? (
            <ul>
              {Object.entries(scenarioParams).map(([key, value]) => (
                <li key={key}>
                  <strong>{getScenarioParamDefinition(scenarioData, key)?.label || key}</strong>
                  <span>{formatScenarioParamValue(scenarioData, key, value)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>{isZh ? "当前没有额外参数。" : "No scenario parameters have been set."}</p>
          )}
        </section>

        <section>
          <h4>{isZh ? "可执行动作" : "Available actions"}</h4>
          {selectedActions.length > 0 ? (
            <ul>
              {selectedActions.map((action) => (
                <li key={action.name}>
                  <strong>{action.name}</strong>
                  <span>{action.description}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>{isZh ? "尚未添加行为规则。" : "No heuristics have been selected yet."}</p>
          )}
        </section>

        {previewProperties.length > 0 ? (
          <section>
            <h4>{isZh ? "智能体属性" : "Agent properties"}</h4>
            <ul>
              {previewProperties.map(([key, value]) => (
                <li key={key}>
                  <strong>{key}</strong>
                  <span>{formatValue(value)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
};

export const Step6Structure: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isZh = i18n.language.startsWith("zh");
  const {
    setCurrentStep,
    agentTypes,
    scenarioDescription,
    scenarioParams,
    availableActions,
    selectedActionIds,
    selectedScenarioId,
    selectedScenarioData,
    socialNetwork,
    llmProviders,
    selectedProviderId,
    roundVisibility,
    turnOrder,
  } = useExperimentBuilder();
  const [detailsDrawerOpen, setDetailsDrawerOpen] = React.useState(false);

  const totalAgents = agentTypes.reduce((sum, type) => sum + type.count, 0);
  const networkEdges = React.useMemo(() => getEdgeCount(socialNetwork), [socialNetwork]);
  const networkNodeCount = Object.keys(socialNetwork).length;
  const fallbackProviderId =
    agentTypes.find((agent) => agent.providerId !== null)?.providerId ?? null;
  const effectiveProviderId =
    selectedProviderId === null
      ? fallbackProviderId === null
        ? null
        : Number(fallbackProviderId)
      : Number(selectedProviderId);
  const effectiveProvider =
    llmProviders.find((provider) => provider.id === effectiveProviderId) ?? null;
  const providerConfigured = effectiveProviderId !== null;
  const providerLabel =
    effectiveProvider?.name ?? (isZh ? "尚未配置" : "Not configured");
  const scheduleLabel =
    roundVisibility === "simultaneous"
      ? isZh
        ? "同时推进"
        : "Simultaneous"
      : turnOrder === "random"
        ? isZh
          ? "随机顺序"
          : "Random"
        : isZh
          ? "固定顺序"
          : "Fixed order";
  const scenarioName =
    getLocalizedScenarioName(t, selectedScenarioData) ||
    (isZh ? "尚未命名实验" : "Untitled study");
  const structureLabel = getStructureLabel(selectedScenarioData, networkEdges, networkNodeCount, totalAgents, isZh);
  const actionCount = selectedActionIds.length;
  const minimumActionCount = availableActions.length <= 1 ? 1 : 2;
  const scenarioReady = Boolean(selectedScenarioId);
  const actionReady = selectedActionIds.length >= minimumActionCount;
  const participantReady = totalAgents > 0;
  const structureReady = networkNodeCount > 0 && (totalAgents <= 1 || networkEdges > 0);
  const agentCollections = React.useMemo(
    () => buildAgentCollections(agentTypes, () => ""),
    [agentTypes]
  );
  const representativeAgent = agentCollections[0]?.representative ?? null;
  const selectedActions = React.useMemo(
    () => availableActions.filter((action) => selectedActionIds.includes(action.name)),
    [availableActions, selectedActionIds]
  );
  const parameterCount = selectedScenarioData?.parameters.length ?? Object.keys(scenarioParams).length;

  const launchChecks = React.useMemo<LaunchCheckItem[]>(
    () => [
      {
        key: "scenario",
        label: isZh ? "已选择研究场景" : "Scenario selected",
        value: scenarioReady ? scenarioName : isZh ? "尚未选择" : "Not selected",
        helper: isZh
          ? "实验会从这个模板和当前配置开始运行。"
          : "The run will start from this template and the current setup.",
        complete: scenarioReady,
      },
      {
        key: "actions",
        label: isZh ? "已配置行为规则" : "Behavior rules configured",
        value: isZh ? `${actionCount} 条` : `${actionCount}`,
        helper: isZh
          ? minimumActionCount === 1
            ? "当前场景保留 1 个核心动作即可启动。"
            : `至少保留 ${minimumActionCount} 个动作才能形成基础比较。`
          : minimumActionCount === 1
            ? "This scene can launch with one core action."
            : `Keep at least ${minimumActionCount} actions to support a basic comparison.`,
        complete: actionReady,
      },
      {
        key: "participants",
        label: isZh ? "已录入智能体" : "Agents defined",
        value: isZh
          ? `${agentTypes.length} 类 / ${totalAgents} 个智能体`
          : `${agentTypes.length} types / ${totalAgents} agents`,
        helper: isZh
          ? "至少需要一个智能体。"
          : "At least one agent is required.",
        complete: participantReady,
      },
      {
        key: "schedule",
        label: isZh ? "已确认推进机制" : "Schedule confirmed",
        value: scheduleLabel,
        helper: isZh
          ? "启动后会按这里的推进方式进入首轮运行。"
          : "The first run will use this scheduling mode.",
        complete: true,
        required: false,
      },
      {
        key: "structure",
        label: isZh ? "已确认关系结构" : "Relationship structure confirmed",
        value: structureLabel,
        helper: isZh
          ? "这会决定智能体如何彼此连接。"
          : "This decides how agents connect with one another.",
        complete: structureReady,
      },
      {
        key: "provider",
        label: isZh ? "模型提供商" : "Model provider",
        value: providerLabel,
        helper: isZh
          ? "智能仿真启动前需要至少一个可用模型。"
          : "A working model provider is required before the intelligent run can start.",
        complete: providerConfigured,
      },
    ],
    [
      actionCount,
      actionReady,
      agentTypes.length,
      isZh,
      minimumActionCount,
      participantReady,
      providerConfigured,
      providerLabel,
      scenarioName,
      scenarioReady,
      scheduleLabel,
      structureLabel,
      structureReady,
      totalAgents,
    ]
  );

  const missingRequiredChecks = launchChecks.filter(
    (check) => check.required !== false && !check.complete
  );
  const launchReady = missingRequiredChecks.length === 0;
  const providerMissing = !providerConfigured;
  const launchStatusTitle = providerMissing
    ? isZh
      ? "尚未配置模型提供商，智能仿真暂不可启动"
      : "No model provider is configured yet, so the intelligent run cannot start."
    : launchReady
      ? isZh
        ? "当前实验已基本配置完成，可直接启动"
        : "The experiment is basically configured and ready to launch."
      : isZh
        ? "当前仍有缺失配置，补齐后即可启动"
        : "A few required items are still missing. Complete them before launch.";
  const launchStatusBody = providerMissing
    ? isZh
      ? "请先在智能体配置中确认一个可用的模型提供商，再启动实验。"
      : "Confirm an active model provider in agent setup before launching the run."
    : launchReady
      ? isZh
        ? "启动后将进入仿真运行页，生成首轮状态，并开始记录智能体行为结果。"
        : "Launching will open the simulation run view, generate the first state, and begin recording behavior outcomes."
      : isZh
        ? `当前还缺少 ${missingRequiredChecks.length} 项关键配置。先补齐检查单中的待补项，再启动实验。`
        : `${missingRequiredChecks.length} required items are still missing. Complete the checklist before launch.`;
  const launchStatusTone = providerMissing ? "blocked" : launchReady ? "ready" : "pending";
  const firstMissingStep = getLaunchMissingStep(
    scenarioReady,
    actionReady,
    participantReady,
    providerConfigured,
    structureReady
  );

  React.useEffect(() => {
    const onGuideTarget = (event: Event) => {
      const detail = (event as CustomEvent<{ target?: string }>).detail;
      const target = detail?.target;

      if (target === "details") {
        if (!detailsDrawerOpen) {
          setDetailsDrawerOpen(true);
        }
        window.setTimeout(() => focusLaunchReviewElement("ss-step6-launch-details"), 180);
        return;
      }

      const targetMap: Record<string, string> = {
        status: "ss-step6-launch-status",
        checklist: "ss-step6-launch-checklist",
        summary: "ss-step6-experiment-summary",
        details: "ss-step6-launch-details",
      };

      const elementId = target ? targetMap[target] : "";
      if (elementId) {
        focusLaunchReviewElement(elementId);
      }
    };

    window.addEventListener("ss-step6-guide", onGuideTarget as EventListener);
    return () =>
      window.removeEventListener("ss-step6-guide", onGuideTarget as EventListener);
  }, [detailsDrawerOpen]);

  const handleGoFixMissing = () => {
    if (!providerConfigured) {
      navigate("/settings?tab=providers_llm");
      return;
    }
    setCurrentStep(firstMissingStep);
  };

  return (
    <div className="ss-launch-review">
      <ResearchInputPanel
        eyebrow={isZh ? "启动前确认 / Launch review" : "Launch review"}
        title={isZh ? "启动前确认" : "Launch review"}
        description={
          isZh
            ? "先确认当前实验已经准备好了什么、还缺什么，以及启动后会发生什么。"
            : "Review what is ready, what is still missing, and what will happen after launch."
        }
      >
        <div
          id="ss-step6-launch-status"
          className={`ss-launch-review__status-banner is-${launchStatusTone}`}
        >
          <div className="ss-launch-review__status-copy">
            <div className="ss-workflow-kicker">
              {isZh ? "启动状态" : "Launch status"}
            </div>
            <h3>{launchStatusTitle}</h3>
            <p>{launchStatusBody}</p>
          </div>

          <div className="ss-launch-review__status-actions">
            <span className={`ss-launch-review__status-pill is-${launchStatusTone}`}>
              {launchReady
                ? isZh
                  ? "可启动"
                  : "Ready"
                : isZh
                  ? "需补充"
                  : "Needs input"}
            </span>

            {!launchReady ? (
              <SecondaryGhostButton type="button" onClick={handleGoFixMissing}>
                {isZh ? "去补充缺失项" : "Go fix missing items"}
              </SecondaryGhostButton>
            ) : null}
          </div>
        </div>

        <div className="ss-launch-review__overview-grid">
          <section
            id="ss-step6-launch-checklist"
            className="ss-launch-review__panel ss-launch-review__panel--checklist"
          >
            <div className="ss-launch-review__panel-head">
              <div>
                <div className="ss-workflow-kicker">
                  {isZh ? "启动检查单" : "Launch checklist"}
                </div>
                <h3>{isZh ? "逐项确认关键配置" : "Confirm each required item"}</h3>
              </div>
              <span className="ss-launch-review__panel-meta">
                {isZh
                  ? `${launchChecks.filter((item) => item.complete).length} / ${launchChecks.length} 已完成`
                  : `${launchChecks.filter((item) => item.complete).length} / ${launchChecks.length} complete`}
              </span>
            </div>

            <div className="ss-launch-review__checklist">
              {launchChecks.map((item) => (
                <div
                  key={item.key}
                  className={`ss-launch-review__check-row${item.complete ? " is-complete" : ""}`.trim()}
                >
                  <div className="ss-launch-review__check-copy">
                    <div className="ss-launch-review__check-title">{item.label}</div>
                    <div className="ss-launch-review__check-helper">{item.helper}</div>
                  </div>

                  <div className="ss-launch-review__check-value">
                    <strong>{item.value}</strong>
                    <span>{item.complete ? (isZh ? "已完成" : "Complete") : isZh ? "待补" : "Missing"}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section
            id="ss-step6-experiment-summary"
            className="ss-launch-review__panel ss-launch-review__panel--summary"
          >
            <div className="ss-launch-review__panel-head">
              <div>
                <div className="ss-workflow-kicker">
                  {isZh ? "实验摘要" : "Experiment summary"}
                </div>
                <h3>{isZh ? "先快速看懂当前实验" : "Review the experiment at a glance"}</h3>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setDetailsDrawerOpen(true)}
              >
                {isZh ? "查看完整配置" : "View full details"}
              </Button>
            </div>

            <div className="ss-workflow-summary-grid">
              <SummaryInfoCard label={isZh ? "场景" : "Scenario"} value={scenarioName} />
              <SummaryInfoCard label={isZh ? "行动数" : "Actions"} value={actionCount} />
              <SummaryInfoCard
                label={isZh ? "智能体数" : "Agents"}
                value={totalAgents}
              />
              <SummaryInfoCard
                label={isZh ? "推进机制" : "Schedule"}
                value={scheduleLabel}
              />
              <SummaryInfoCard
                label={isZh ? "关系结构" : "Structure"}
                value={structureLabel}
              />
              <SummaryInfoCard
                label={isZh ? "关键参数数" : "Key parameters"}
                value={parameterCount}
              />
            </div>
          </section>
        </div>
      </ResearchInputPanel>

      {detailsDrawerOpen ? (
        <div className="ss-launch-review__drawer-backdrop" onClick={() => setDetailsDrawerOpen(false)}>
          <aside
            className="ss-launch-review__drawer"
            onClick={(event) => event.stopPropagation()}
            aria-modal="true"
            role="dialog"
            aria-labelledby="ss-step6-launch-details"
          >
            <div className="ss-workflow-panel__head">
              <div>
                <div className="ss-workflow-kicker">
                  {isZh ? "完整配置说明" : "Full configuration details"}
                </div>
                <h2 className="ss-workflow-panel__title" id="ss-step6-launch-details">
                  {isZh ? "按需查看完整实验配置" : "Inspect the complete experiment setup"}
                </h2>
                <p className="ss-workflow-panel__copy">
                  {isZh
                    ? "这里集中放研究说明、参数明细、行为规则与代表性系统说明；主页面只保留启动摘要。"
                    : "Research framing, parameters, behavior rules, and the representative system prompt live here so the main page can stay focused."}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setDetailsDrawerOpen(false)}
              >
                {isZh ? "返回启动摘要" : "Back to launch review"}
              </Button>
            </div>

            <div className="ss-launch-review__drawer-body">
              <section className="ss-launch-review__detail-block">
                <div className="ss-workflow-kicker">
                  {isZh ? "研究说明" : "Research framing"}
                </div>
                <p>
                  {scenarioDescription ||
                    (isZh
                      ? "当前场景会沿用模板说明；后续也可以继续补充研究背景。"
                      : "The study will currently use the template framing. You can still enrich the research description later.")}
                </p>
              </section>

              <section className="ss-launch-review__detail-block">
                <div className="ss-workflow-kicker">
                  {isZh ? "参数明细" : "Parameter details"}
                </div>
                {Object.keys(scenarioParams).length > 0 ? (
                  <div className="ss-launch-review__detail-list">
                    {Object.entries(scenarioParams).map(([key, value]) => (
                      <div key={key} className="ss-launch-review__detail-row">
                        <span>{getScenarioParamDefinition(selectedScenarioData, key)?.label || key}</span>
                        <strong>{formatScenarioParamValue(selectedScenarioData, key, value)}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>{isZh ? "当前没有额外参数。" : "No additional parameters yet."}</p>
                )}
              </section>

              <section className="ss-launch-review__detail-block">
                <div className="ss-workflow-kicker">
                  {isZh ? "行为规则" : "Behavior rules"}
                </div>
                {selectedActions.length > 0 ? (
                  <div className="ss-launch-review__detail-list">
                    {selectedActions.map((action) => (
                      <div key={action.name} className="ss-launch-review__detail-row">
                        <span>{action.name}</span>
                        <strong>{action.description}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>{isZh ? "尚未添加行为规则。" : "No behavior rules selected yet."}</p>
                )}
              </section>

              {representativeAgent ? (
                <PromptPreviewPanel
                  scenarioData={selectedScenarioData}
                  agentTypeLabel={representativeAgent.label}
                  agentTypeProfile={representativeAgent.userProfile || ""}
                  agentTypeRolePrompt={representativeAgent.rolePrompt || ""}
                  agentTypeProperties={representativeAgent.properties || {}}
                  scenarioDescription={scenarioDescription}
                  scenarioParams={scenarioParams}
                  availableActions={availableActions}
                  selectedActionIds={selectedActionIds}
                />
              ) : (
                <div className="ss-launch-review__detail-block">
                  <div className="ss-workflow-kicker">
                    {isZh ? "系统说明预览" : "System prompt preview"}
                  </div>
                    <p>
                      {isZh
                      ? "当前还没有智能体，因此暂无可预览的系统说明。"
                      : "There are no agents yet, so no system prompt preview is available."}
                    </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
};

export default Step6Structure;
