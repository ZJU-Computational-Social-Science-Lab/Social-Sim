import React from "react";
import { useTranslation } from "react-i18next";

import { useExperimentBuilder } from "../../store/experiment-builder";
import { Step1InteractionType } from "./Step1InteractionType";
import { Step2StarterTemplate } from "./Step2StarterTemplate";
import { Step3Scenario } from "./Step3Scenario";
import { Step4Agents } from "./Step4Agents";
import { Step5Network } from "./Step5Network";
import { Step6Structure } from "./Step6Structure";
import {
  WorkflowSidebar,
  type WorkflowSidebarStep,
} from "./workflow/WorkflowSidebar";
import { ResearchNotebookPanel } from "./workflow/ResearchNotebookPanel";
import { FloatingActionBar } from "./workflow/FloatingActionBar";
import { GuideMascotTrigger } from "./workflow/GuideMascotTrigger";
import { GuidePopover } from "./workflow/GuidePopover";
import { GuideHintBubble } from "./workflow/GuideHintBubble";
import { SummaryInfoCard } from "./workflow/SummaryInfoCard";
import {
  SS_EVENTS,
  DRAFT_STORAGE_KEY,
  GUIDE_HINTS_STORAGE_KEY,
  IDLE_HINT_DELAY_MS,
  STEP_SIX_ENTRY_WINDOW_MS,
  JUMP_THEN_FOCUS_DELAY_MS,
} from "./workflow/constants";
import {
  focusStepTwoTarget,
  focusStepFourTarget,
  focusStepFiveTarget,
  focusStepSixTarget,
  focusGuideElement,
} from "./workflow/guideHelpers";
import { getEdgeCount } from "./workflow/networkUtils";
import { summarizeActionStructure } from "./workflow/summarizeActionStructure";
import { useBuilderNavigation, useDismissedHints } from "./workflow/useBuilderNavigation";
import { useGuideIdleState } from "./workflow/useGuideIdleState";

type StepId = 1 | 2 | 3 | 4 | 5 | 6;

interface ExperimentBuilderProps {
  onComplete: () => void;
  onCancel: () => void;
}

interface GuideTask {
  label: string;
  done: boolean;
}

interface GuideAction {
  label: string;
  onClick: () => void;
  tone?: "primary" | "secondary";
}

interface GuideHintState {
  id: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
}

export const ExperimentBuilder: React.FC<ExperimentBuilderProps> = ({
  onComplete,
  onCancel,
}) => {
  const { t, i18n } = useTranslation();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _reactRouterNavigate = () => { /* navigate is provided via useBuilderNavigation hook */ };
  const isZh = i18n.language.startsWith("zh");
  const {
    currentStep,
    setCurrentStep,
    nextStep,
    prevStep,
    validate,
    selectedScenarioId,
    selectedScenarioData,
    scenarioDescription,
    scenarioParams,
    availableActions,
    selectedActionIds,
    agentTypes,
    llmProviders,
    selectedProviderId,
    socialNetwork,
    roundVisibility,
    turnOrder,
  } = useExperimentBuilder();

  const labels = React.useMemo(
    () => ({
      workflowTitle: isZh ? "研究流程" : "Research workflow",
      workflowSubtitle: isZh
        ? "沿着 6 个步骤逐步完成实验设计。"
        : "Move through six steps to set up the study.",
      notebookTitle: isZh ? "实验摘要" : "Research notebook",
      notebookSubtitle: isZh
        ? "这里不做伪智能评分，只保留当前草稿、已完成项、待补充项和一条真正有用的建议。"
        : "Track the draft, completed items, missing inputs, and one useful next suggestion.",
      notebookStatus: isZh
        ? `当前草稿 · 第 ${currentStep} 步 / 共 6 步`
        : `Current draft · Step ${currentStep} of 6`,
      completedTitle: isZh ? "已完成项" : "Completed",
      pendingTitle: isZh ? "待补充项" : "Needs input",
      suggestionTitle: isZh ? "下一步建议" : "Suggestion",
      summaryScenario: isZh ? "研究场景" : "Scenario",
      summaryParticipants: isZh ? "参与者" : "Participants",
      summaryActions: isZh ? "行为规则" : "Heuristics",
      summaryStructure: isZh ? "关系结构" : "Structure",
      actionPrev: isZh ? "上一步" : "Previous",
      actionSave: isZh ? "保存草稿" : "Save draft",
      actionNextQuestion: isZh ? "继续下一步" : "Continue",
      actionNext: isZh ? "保存并继续" : "Save and continue",
      actionLaunch: isZh ? "启动实验" : "Launch experiment",
      actionNeedCurrent: isZh ? "先补全当前步骤" : "Complete this step first",
      saveStatePrefix: isZh ? "草稿已保存" : "Draft saved",
    }),
    [currentStep, isZh]
  );

  const workflowSteps = React.useMemo<WorkflowSidebarStep[]>(
    () => [
      {
        id: 1,
        title: isZh ? "研究问题" : "Contextualization",
        subtitle: isZh ? "选择一个起始情境" : "Choose a starting scenario",
        state: currentStep === 1 ? "current" : currentStep > 1 ? "complete" : "upcoming",
      },
      {
        id: 2,
        title: isZh ? "核心变量" : "Variable Map",
        subtitle: isZh ? "整理变量与条件" : "Shape variables and conditions",
        state: currentStep === 2 ? "current" : currentStep > 2 ? "complete" : "upcoming",
      },
      {
        id: 3,
        title: isZh ? "行为规则" : "Heuristic Set",
        subtitle: isZh ? "明确规则与动作" : "Define rules and actions",
        state: currentStep === 3 ? "current" : currentStep > 3 ? "complete" : "upcoming",
      },
      {
        id: 4,
        title: isZh ? "参与者" : "Social Dynamics",
        subtitle: isZh ? "定义群体与角色" : "Define groups and roles",
        state: currentStep === 4 ? "current" : currentStep > 4 ? "complete" : "upcoming",
      },
      {
        id: 5,
        title: isZh ? "关系结构" : "Structure",
        subtitle: isZh ? "设置连接结构" : "Set up the structure",
        state: currentStep === 5 ? "current" : currentStep > 5 ? "complete" : "upcoming",
      },
      {
        id: 6,
        title: isZh ? "运行预览" : "Launch Preview",
        subtitle: isZh ? "检查摘要并准备启动" : "Review and launch",
        state: currentStep === 6 ? "current" : currentStep > 6 ? "complete" : "upcoming",
      },
    ],
    [currentStep, isZh]
  );

  const totalAgents = agentTypes.reduce((sum, type) => sum + (type.count || 0), 0);
  const namedParticipantTypes = agentTypes.filter((agent) => agent.label.trim().length > 0).length;
  const hasParticipantType = agentTypes.length > 0;
  const hasNamedParticipantType = namedParticipantTypes > 0;
  const networkEdges = React.useMemo(() => getEdgeCount(socialNetwork), [socialNetwork]);
  const structureConfirmed = Object.keys(socialNetwork).length > 0;
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
  const providerLabel =
    effectiveProvider?.name ?? t("experimentDesk.summary.none");
  const scheduleLabel =
    roundVisibility === "simultaneous"
      ? t("experimentDesk.summary.simultaneous")
      : turnOrder === "random"
        ? t("experimentDesk.summary.random")
        : t("experimentDesk.summary.fixed");
  const scenarioName = selectedScenarioData?.name ?? t("experimentDesk.summary.none");
  const templateReady = selectedScenarioId !== null;
  const selectedCustomScenario = selectedScenarioData?.category === "custom";
  const defaultRoundVisibility =
    selectedScenarioData?.interaction_mode === "sequential" ? "sequential" : "simultaneous";
  const scenarioKeyParamChangeCount = React.useMemo(() => {
    if (!selectedScenarioData) {
      return 0;
    }

    return selectedScenarioData.parameters.reduce((count, param) => {
      const currentValue =
        scenarioParams[param.key] !== undefined ? scenarioParams[param.key] : param.default;
      return count + (JSON.stringify(currentValue) === JSON.stringify(param.default) ? 0 : 1);
    }, 0);
  }, [scenarioParams, selectedScenarioData]);

  const scenarioConfigChangeCount = React.useMemo(() => {
    const scheduleChanges =
      (roundVisibility !== defaultRoundVisibility ? 1 : 0) +
      (roundVisibility === "sequential" && turnOrder !== "fixed" ? 1 : 0);

    return scenarioKeyParamChangeCount + scheduleChanges;
  }, [defaultRoundVisibility, roundVisibility, scenarioKeyParamChangeCount, turnOrder]);
  const [saveState, setSaveState] = React.useState<string | null>(null);
  const [stepOneActionHint, setStepOneActionHint] = React.useState<string | null>(null);
  const [guideOpen, setGuideOpen] = React.useState(false);
  const [dismissedGuideHints, setDismissedGuideHints] = React.useState<string[]>([]);
  const [stepOneInteractionTick, setStepOneInteractionTick] = React.useState(0);
  const [stepOneIdleReady, setStepOneIdleReady] = React.useState(false);
  const [stepFiveInteractionTick, setStepFiveInteractionTick] = React.useState(0);
  const [stepFiveIdleReady, setStepFiveIdleReady] = React.useState(false);
  const [stepFiveSelectedPreset, setStepFiveSelectedPreset] = React.useState<string | null>(null);
  const [stepFiveAdvancedTarget, setStepFiveAdvancedTarget] = React.useState<string | null>(null);
  const [stepSixEntryWindow, setStepSixEntryWindow] = React.useState(false);
  const minimumActionCount = availableActions.length <= 1 ? 1 : 2;
  const actionsReady = selectedActionIds.length >= minimumActionCount;

  const launchScenarioReady = templateReady;
  const launchActionsReady = actionsReady;
  const launchParticipantsReady = totalAgents > 0;
  const launchStructureReady = structureConfirmed;
  const launchProviderReady = effectiveProviderId !== null;
  const launchReady =
    launchScenarioReady &&
    launchActionsReady &&
    launchParticipantsReady &&
    launchStructureReady &&
    launchProviderReady;
  const firstLaunchGap =
    !launchScenarioReady
      ? ("scenario" as const)
      : !launchActionsReady
        ? ("actions" as const)
        : !launchParticipantsReady || !launchProviderReady
          ? ("participants" as const)
          : !launchStructureReady
            ? ("structure" as const)
            : null;

  const stepReady =
    currentStep === 1
      ? templateReady
      : currentStep === 2
        ? templateReady
        : currentStep === 3
          ? actionsReady
          : currentStep === 4
            ? totalAgents > 0
            : currentStep === 5
              ? structureConfirmed
              : launchReady;

  const completedItems = React.useMemo(() => {
    const items: string[] = [];
    if (selectedScenarioId) {
      items.push(isZh ? "已确定研究场景与模板" : "Scenario template selected");
    }
    if (scenarioDescription.trim()) {
      items.push(isZh ? "研究说明已有草稿" : "Research framing drafted");
    }
    if (selectedActionIds.length > 0) {
      items.push(
        isZh
          ? `已定义 ${selectedActionIds.length} 条行为规则`
          : `${selectedActionIds.length} heuristics selected`
      );
    }
    if (totalAgents > 0) {
      items.push(
        isZh ? `已录入 ${totalAgents} 位参与者` : `${totalAgents} participants defined`
      );
    }
    if (networkEdges > 0) {
      items.push(
        isZh ? `关系结构已包含 ${networkEdges} 条连接` : `${networkEdges} structural links configured`
      );
    }
    return items;
  }, [isZh, networkEdges, scenarioDescription, selectedActionIds.length, selectedScenarioId, totalAgents]);

  const pendingItems = React.useMemo(() => {
    const items: string[] = [];
    if (!selectedScenarioId) {
      items.push(isZh ? "选择一个研究场景或模板" : "Choose a scenario template");
    }
    if (!scenarioDescription.trim()) {
      items.push(isZh ? "补充研究问题与背景说明" : "Write the research framing");
    }
    if (selectedActionIds.length === 0) {
      items.push(isZh ? "补充至少一条行为规则" : "Select at least one heuristic");
    }
    if (totalAgents === 0) {
      items.push(isZh ? "至少定义一个参与者群体" : "Define at least one participant group");
    }
    if (networkEdges === 0) {
      items.push(isZh ? "设置关系结构或至少一条连接" : "Configure the structure or add a tie");
    }
    return items;
  }, [isZh, networkEdges, scenarioDescription, selectedActionIds.length, selectedScenarioId, totalAgents]);

  const suggestion = React.useMemo(() => {
    switch (currentStep) {
      case 1:
        if (!templateReady) {
          return isZh
            ? "先选择一个起始情境；如果需要从空白开始，可以切到“自定义”分类。"
            : "Choose a starting scenario first. Switch to the custom category if you want to start from scratch.";
        }
        return isZh
          ? "起始情境已选定，可以继续进入下一步。"
          : "The starting scenario is ready. Continue to the next step.";
      case 2:
        return isZh
          ? "优先补齐关键变量，不必一开始就把所有参数都写满。"
          : "Start with the key variables before filling every parameter.";
      case 3:
        return isZh
          ? "确保行为规则足够清楚，让研究者能判断每种行动意味着什么。"
          : "Make the heuristic set explicit enough for researchers to read.";
      case 4:
        return isZh
          ? "先定义群体，再逐个补充代表性成员，不要一开始就铺满所有个体。"
          : "Define groups first, then refine representative participants.";
      case 5:
        return isZh
          ? "先建立结构摘要，再做必要的局部手动连接。"
          : "Start with structural summaries, then refine local ties.";
      default:
        return isZh
          ? "逐项确认研究设置是否完整，再启动实验。"
          : "Confirm the study is complete before launching the run.";
    }
  }, [currentStep, isZh, templateReady]);

  const notebookSections = React.useMemo(
    () => [
      {
        title: labels.completedTitle,
        items:
          completedItems.length > 0
            ? completedItems
            : [isZh ? "当前还没有已完成项。" : "No completed items yet."],
      },
      {
        title: labels.pendingTitle,
        items:
          pendingItems.length > 0
            ? pendingItems
            : [isZh ? "当前步骤已齐备，可以继续。" : "This step is ready to continue."],
      },
      {
        title: labels.suggestionTitle,
        items: [suggestion],
      },
    ],
    [
      completedItems,
      isZh,
      labels.completedTitle,
      labels.pendingTitle,
      labels.suggestionTitle,
      pendingItems,
      suggestion,
    ]
  );

  const notebookSummary = (
    <div className="ss-workflow-summary-grid">
      <SummaryInfoCard label={labels.summaryScenario} value={scenarioName} />
      <SummaryInfoCard label={labels.summaryParticipants} value={totalAgents} />
      <SummaryInfoCard label={labels.summaryActions} value={selectedActionIds.length} />
      <SummaryInfoCard label={labels.summaryStructure} value={networkEdges} helper={scheduleLabel} />
      <SummaryInfoCard label={t("simulationWorkspace.provider")} value={providerLabel} />
      <SummaryInfoCard label={t("experimentDesk.summary.schedule")} value={scheduleLabel} />
    </div>
  );

  const stepTwoTasks = React.useMemo(
    () => [
      {
        id: "scenario",
        label: isZh ? "选择或确认场景" : "Choose or confirm the scenario",
        helper: templateReady ? scenarioName : isZh ? "当前还未确认场景" : "No scenario confirmed yet",
        done: templateReady,
        onClick: () => focusStepTwoTarget("scenario"),
      },
      {
        id: "params",
        label: isZh ? "至少调整 1 个关键参数" : "Adjust at least one key parameter",
        helper:
          scenarioKeyParamChangeCount > 0
            ? isZh
              ? `已调整 ${scenarioKeyParamChangeCount} 项`
              : `${scenarioKeyParamChangeCount} settings tuned`
            : isZh
              ? "保持默认也可以，建议至少调一项"
              : "Defaults are okay, but one adjustment helps",
        done: scenarioKeyParamChangeCount > 0,
        onClick: () => focusStepTwoTarget("params"),
      },
      {
        id: "schedule",
        label: isZh ? "确认推进机制" : "Confirm the schedule",
        helper: scheduleLabel,
        done: templateReady,
        onClick: () => focusStepTwoTarget("schedule"),
      },
    ],
    [isZh, scenarioKeyParamChangeCount, scenarioName, scheduleLabel, templateReady]
  );

  const stepTwoSummaryCards = React.useMemo(
    () => (
      <div className="ss-workflow-summary-grid">
        <SummaryInfoCard label={isZh ? "当前场景" : "Scenario"} value={scenarioName} />
        <SummaryInfoCard
          label={isZh ? "参数数量" : "Parameters"}
          value={selectedScenarioData?.parameters.length ?? 0}
        />
        <SummaryInfoCard label={isZh ? "推进机制" : "Schedule"} value={scheduleLabel} />
      </div>
    ),
    [isZh, scenarioName, scheduleLabel, selectedScenarioData]
  );

  const stepTwoSections = React.useMemo(
    () => [
      {
        title: isZh ? "当前关键状态" : "Current state",
        items: [
          isZh
            ? `已调整关键参数：${scenarioKeyParamChangeCount} 项`
            : `Adjusted key parameters: ${scenarioKeyParamChangeCount}`,
          isZh ? `当前推进机制：${scheduleLabel}` : `Current schedule: ${scheduleLabel}`,
        ],
      },
      {
        title: isZh ? "下一步预告" : "Next",
        items: [
          isZh
            ? "下一步进入“行为规则”页，确定参与者在这个场景中可以采取哪些行动。"
            : "Next, move to Heuristic Set and define which actions participants can take in this scenario.",
        ],
      },
    ],
    [isZh, scenarioKeyParamChangeCount, scheduleLabel]
  );

  const stepThreeTasks = React.useMemo(
    () => [
      {
        id: "min-actions",
        label: isZh
          ? `至少启用 ${minimumActionCount} 个动作`
          : `Enable at least ${minimumActionCount} action${minimumActionCount > 1 ? "s" : ""}`,
        helper:
          actionsReady
            ? isZh
              ? `当前已启用 ${selectedActionIds.length} 个动作`
              : `${selectedActionIds.length} actions enabled`
            : isZh
              ? `至少需要 ${minimumActionCount} 个动作才能继续当前场景`
              : `You need at least ${minimumActionCount} action${minimumActionCount > 1 ? "s" : ""} to continue this scene`,
        done: actionsReady,
        onClick: () => focusGuideElement("ss-step3-action-library"),
      },
      {
        id: "action-contrast",
        label:
          minimumActionCount === 1
            ? isZh
              ? "保留当前核心动作"
              : "Keep the core action"
            : isZh
              ? "保证动作之间有清晰差异"
              : "Keep the actions meaningfully distinct",
        helper:
          actionsReady
            ? summarizeActionStructure(selectedActionIds, isZh, minimumActionCount)
            : isZh
              ? minimumActionCount === 1
                ? "先保留当前场景的核心动作"
                : "先保留两种不同倾向的动作"
              : minimumActionCount === 1
                ? "Keep the core action for this scene first"
                : "Start with two actions that lead to different tendencies",
        done: actionsReady,
        onClick: () =>
          focusGuideElement(
            actionsReady ? "ss-step3-behavior-space" : "ss-step3-action-library"
          ),
      },
    ],
    [actionsReady, isZh, minimumActionCount, selectedActionIds]
  );

  const stepThreeSections = React.useMemo(
    () => [
      {
        title: isZh ? "当前关键状态" : "Current state",
        items: [
          isZh
            ? `已启用动作数：${selectedActionIds.length}`
            : `Enabled actions: ${selectedActionIds.length}`,
          isZh
            ? `当前行为结构：${summarizeActionStructure(selectedActionIds, isZh, minimumActionCount)}`
            : `Current behavior structure: ${summarizeActionStructure(selectedActionIds, isZh, minimumActionCount)}`,
        ],
      },
      {
        title: isZh ? "下一步预告" : "Next",
        items: [
          isZh
            ? "进入“参与者”页，为不同群体绑定行为逻辑。"
            : "Move to Social Dynamics and attach these behaviors to participant groups.",
        ],
      },
    ],
    [isZh, minimumActionCount, selectedActionIds]
  );

  const stepFourSections = React.useMemo(
    () => [
      {
        title: isZh ? "当前关键状态" : "Current state",
        items: [
          hasParticipantType
            ? isZh
              ? `已创建参与者类型：${agentTypes.length}`
              : `Participant types created: ${agentTypes.length}`
            : isZh
              ? "尚未创建参与者类型"
              : "No participant type created yet",
          hasNamedParticipantType
            ? isZh
              ? `已命名基础群体：${namedParticipantTypes}`
              : `Named participant types: ${namedParticipantTypes}`
            : isZh
              ? "尚未填写群体名称"
              : "Participant names are still empty",
          effectiveProviderId !== null
            ? isZh
              ? `模型提供商：${providerLabel}`
              : `Model provider: ${providerLabel}`
            : isZh
              ? "模型提供商：尚未配置"
              : "Model provider: not configured",
        ],
      },
      {
        title: isZh ? "下一步预告" : "Next",
        items: [
          isZh
            ? "下一步进入“关系结构”页，为不同群体决定如何连接。"
            : "Next, move to Structure and decide how participant groups connect.",
        ],
      },
    ],
    [
      agentTypes.length,
      hasNamedParticipantType,
      hasParticipantType,
      isZh,
      namedParticipantTypes,
      providerLabel,
      effectiveProviderId,
    ]
  );

  const stepFourSummaryCards = React.useMemo(
    () => (
      <div className="ss-workflow-summary-grid">
        <SummaryInfoCard
          label={isZh ? "参与者类型" : "Participant types"}
          value={agentTypes.length}
        />
        <SummaryInfoCard label={isZh ? "参与者数量" : "Participants"} value={totalAgents} />
        <SummaryInfoCard label={isZh ? "模型提供商" : "Provider"} value={providerLabel} />
      </div>
    ),
    [agentTypes.length, isZh, providerLabel, totalAgents]
  );

  const stepFiveStatusItems = React.useMemo(
    () => [
      templateReady
        ? isZh
          ? `已选择研究场景：${scenarioName}`
          : `Scenario selected: ${scenarioName}`
        : isZh
          ? "尚未确认研究场景"
          : "Scenario not confirmed yet",
      totalAgents > 0
        ? isZh
          ? `已定义参与者：${totalAgents}`
          : `Participants defined: ${totalAgents}`
        : isZh
          ? "尚未定义参与者"
          : "Participants not defined yet",
      structureConfirmed
        ? isZh
          ? "关系结构已确认"
          : "Structure confirmed"
        : isZh
          ? "当前尚未确认关系结构"
          : "Structure not confirmed yet",
    ],
    [isZh, scenarioName, structureConfirmed, templateReady, totalAgents]
  );

  const stepFiveSections = React.useMemo(
    () => [
      {
        title: isZh ? "当前状态" : "Current status",
        items: stepFiveStatusItems,
      },
      {
        title: isZh ? "下一步预告" : "Next",
        items: [
          isZh
            ? "进入“运行预览”页，检查实验结构并准备启动。"
            : "Move to Launch Preview, review the experiment structure, and prepare to launch.",
        ],
      },
    ],
    [isZh, stepFiveStatusItems]
  );

  const launchCompletedCount = [
    launchScenarioReady,
    launchActionsReady,
    launchParticipantsReady,
    launchStructureReady,
    launchProviderReady,
  ].filter(Boolean).length;
  const launchMissingItems = React.useMemo(
    () =>
      [
        !launchScenarioReady
          ? isZh
            ? "尚未选择研究场景"
            : "Scenario not selected yet"
          : null,
        !launchActionsReady
          ? isZh
            ? "行为规则不足 2 条"
            : "Fewer than 2 behavior rules selected"
          : null,
        !launchParticipantsReady
          ? isZh
            ? "尚未定义参与者群体"
            : "Participants are not defined yet"
          : null,
        !launchStructureReady
          ? isZh
            ? "关系结构尚未确认"
            : "Relationship structure is not confirmed yet"
          : null,
        !launchProviderReady
          ? isZh
            ? "模型提供商尚未配置"
            : "Model provider is not configured"
          : null,
      ].filter(Boolean) as string[],
    [
      isZh,
      launchActionsReady,
      launchParticipantsReady,
      launchProviderReady,
      launchScenarioReady,
      launchStructureReady,
    ]
  );
  const stepSixSections = React.useMemo(
    () => [
      {
        title: isZh ? "当前关键状态" : "Current state",
        items: launchReady
          ? [
              isZh
                ? "当前实验已满足基础运行条件，可以直接启动。"
                : "The experiment meets the basic launch requirements and can be started now.",
            ]
          : launchMissingItems,
      },
      {
        title: isZh ? "下一步预告" : "What happens next",
        items: [
          isZh
            ? "启动后将进入仿真运行页。"
            : "Launch opens the simulation run page.",
          isZh
            ? "系统会生成首轮状态并开始推进。"
            : "The system will generate the first state and begin the run.",
          isZh
            ? "行为结果会被持续记录，供后续观察与对比。"
            : "Behavior results will be recorded for later observation and comparison.",
        ],
      },
    ],
    [isZh, launchMissingItems, launchReady]
  );
  const stepSixSummaryCards = React.useMemo(
    () => (
      <div className="ss-workflow-summary-grid">
        <SummaryInfoCard label={isZh ? "当前场景" : "Current scenario"} value={scenarioName} />
      </div>
    ),
    [isZh, scenarioName]
  );

  const stepOneTasks = React.useMemo<GuideTask[]>(
    () => [
      {
        label: isZh ? "选择一个场景模板" : "Choose a scenario template",
        done: templateReady,
      },
      {
        label: isZh ? "或创建自定义场景" : "Or create a custom scenario",
        done: selectedCustomScenario,
      },
    ],
    [isZh, selectedCustomScenario, templateReady]
  );

  React.useEffect(() => {
    const raw = localStorage.getItem(GUIDE_HINTS_STORAGE_KEY);
    setDismissedGuideHints(raw ? JSON.parse(raw) : []);
  }, []);

  React.useEffect(() => {
    const handleStepOneInteraction = () => {
      setStepOneInteractionTick((value) => value + 1);
    };

    window.addEventListener(SS_EVENTS.STEP1_INTERACTION, handleStepOneInteraction);
    return () => window.removeEventListener(SS_EVENTS.STEP1_INTERACTION, handleStepOneInteraction);
  }, []);

  React.useEffect(() => {
    if (currentStep !== 1 || templateReady) {
      setStepOneIdleReady(false);
      return;
    }

    setStepOneIdleReady(false);
    const timer = window.setTimeout(() => setStepOneIdleReady(true), IDLE_HINT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [currentStep, stepOneInteractionTick, templateReady]);

  React.useEffect(() => {
    const handleStepFiveState = (rawEvent: Event) => {
      const event = rawEvent as CustomEvent<{
        type?: string;
        preset?: string;
        target?: string;
      }>;
      const detail = event.detail || {};

      if (detail.type === "interaction") {
        setStepFiveInteractionTick((value) => value + 1);
        return;
      }

      if (detail.type === "template-selected") {
        setStepFiveSelectedPreset(detail.preset || null);
        setStepFiveInteractionTick((value) => value + 1);
        return;
      }

      if (detail.type === "advanced-opened") {
        setStepFiveAdvancedTarget(detail.target || null);
        setStepFiveInteractionTick((value) => value + 1);
        return;
      }
    };

    window.addEventListener(SS_EVENTS.STEP5_GUIDE_STATE, handleStepFiveState as EventListener);
    return () =>
      window.removeEventListener(SS_EVENTS.STEP5_GUIDE_STATE, handleStepFiveState as EventListener);
  }, []);

  React.useEffect(() => {
    if (currentStep !== 5 || stepFiveSelectedPreset) {
      setStepFiveIdleReady(false);
      return;
    }

    setStepFiveIdleReady(false);
    const timer = window.setTimeout(() => setStepFiveIdleReady(true), IDLE_HINT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [currentStep, stepFiveInteractionTick, stepFiveSelectedPreset]);

  React.useEffect(() => {
    if (currentStep !== 5) {
      setStepFiveAdvancedTarget(null);
      return;
    }

    if (structureConfirmed && !stepFiveSelectedPreset) {
      setStepFiveSelectedPreset("configured");
    }

    if (!structureConfirmed) {
      setStepFiveSelectedPreset(null);
      setStepFiveAdvancedTarget(null);
    }
  }, [currentStep, stepFiveSelectedPreset, structureConfirmed]);

  React.useEffect(() => {
    if (currentStep !== 6) {
      setStepSixEntryWindow(false);
      return;
    }

    setStepSixEntryWindow(true);
    const timer = window.setTimeout(() => setStepSixEntryWindow(false), STEP_SIX_ENTRY_WINDOW_MS);
    return () => window.clearTimeout(timer);
  }, [currentStep]);

  React.useEffect(() => {
    if (currentStep <= 3) {
      setGuideOpen(false);
    }
  }, [currentStep]);

  const dismissGuideHint = React.useCallback((hintId: string) => {
    setDismissedGuideHints((current) => {
      if (current.includes(hintId)) {
        return current;
      }

      const next = [...current, hintId];
      localStorage.setItem(GUIDE_HINTS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const jumpToWorkflowStep = React.useCallback(
    (step: StepId, after?: () => void) => {
      setGuideOpen(false);
      setCurrentStep(step);
      if (after) {
        window.setTimeout(after, JUMP_THEN_FOCUS_DELAY_MS);
      }
    },
    [setCurrentStep]
  );

  const jumpToLaunchGap = React.useCallback(() => {
    if (!launchProviderReady) {
      setGuideOpen(false);
      window.location.href = "/settings?tab=providers_llm";
      return;
    }
    if (firstLaunchGap === "scenario") {
      jumpToWorkflowStep(1, () => focusGuideElement("ss-step1-template-library"));
      return;
    }
    if (firstLaunchGap === "actions") {
      jumpToWorkflowStep(3, () => focusGuideElement("ss-step3-action-library"));
      return;
    }
    if (firstLaunchGap === "participants") {
      jumpToWorkflowStep(
        4,
        () => focusStepFourTarget(!launchParticipantsReady ? "name" : "provider")
      );
      return;
    }
    if (firstLaunchGap === "structure") {
      jumpToWorkflowStep(5, () => focusStepFiveTarget("templates"));
      return;
    }
    focusStepSixTarget("status");
  }, [firstLaunchGap, jumpToWorkflowStep, launchParticipantsReady, launchProviderReady, navigate]);

  const activeGuideHint = React.useMemo<GuideHintState | null>(() => {
    const stepOneHint: GuideHintState = {
      id: "step1-select-template",
      message: isZh
        ? "先从一个场景模板开始，模板只是起点，后续仍可调整。"
        : "Start with a scenario template first. It is only a starting point and you can still adjust it later.",
      actionLabel: isZh ? "带我去模板区" : "Take me to templates",
      onAction: () => focusGuideElement("ss-step1-template-library"),
    };

    const stepOneReadyHint: GuideHintState = {
      id: "step1-template-selected",
      message: isZh
        ? "已选中起始场景，现在可以继续进入核心变量。"
        : "The starting scenario is selected. You can continue to key variables now.",
      actionLabel: isZh ? "查看当前模板" : "Review current template",
      onAction: () => focusGuideElement("ss-step1-template-library"),
    };

    const stepTwoHint: GuideHintState =
      scenarioConfigChangeCount > 0
        ? {
            id: "step2-params-updated",
            message: isZh
              ? "当前规则已变化，可继续查看结果。"
              : "The rules have changed. You can continue and inspect the result.",
            actionLabel: isZh ? "查看推进机制" : "Review the schedule",
            onAction: () => focusStepTwoTarget("schedule"),
          }
        : {
            id: "step2-tune-core-params",
            message: isZh
              ? "先调 1~2 个关键参数，复杂规则可以稍后展开。"
              : "Adjust one or two key parameters first. The more complex rules can wait.",
            actionLabel: isZh ? "带我去参数区" : "Take me to the key parameters",
            onAction: () => focusStepTwoTarget("params"),
          };

    const stepThreeHint: GuideHintState =
      actionsReady
        ? {
            id: "step3-action-space-ready",
            message: isZh
              ? minimumActionCount === 1
                ? "当前单动作场景已经可以继续。"
                : "当前行为空间已满足基础比较需求。"
              : minimumActionCount === 1
                ? "This single-action scene is ready to continue."
                : "The current action space already supports a basic comparison.",
            actionLabel: isZh ? "查看行为空间" : "Review the behavior space",
            onAction: () => focusGuideElement("ss-step3-behavior-space"),
          }
        : {
            id: "step3-keep-required-actions",
            message: isZh
              ? `至少保留 ${minimumActionCount} 个动作，才能继续当前场景。`
              : `Keep at least ${minimumActionCount} action${minimumActionCount > 1 ? "s" : ""} so the scene can continue.`,
            actionLabel: isZh ? "带我去动作区" : "Take me to the action library",
            onAction: () => focusGuideElement("ss-step3-action-library"),
          };

    const stepFourEntryHint: GuideHintState = {
      id: "step4-create-base-type",
      message: isZh
        ? "先创建一个基础参与者类型，不需要一次定义所有群体。"
        : "Start with one basic participant type. You do not need to define every group at once.",
      actionLabel: isZh ? "去填写名称" : "Go to the name field",
      onAction: () => focusStepFourTarget("name"),
    };

    const stepFourNameHint: GuideHintState = {
      id: "step4-name-required",
      message: isZh
        ? "先填写一个简单的群体名称，例如“学生群体”。"
        : "Give the group a simple name first, for example “student cohort.”",
      actionLabel: isZh ? "去填写名称" : "Go to the name field",
      onAction: () => focusStepFourTarget("name"),
    };

    const stepFourReadyHint: GuideHintState = {
      id: "step4-first-type-ready",
      message: isZh
        ? "已创建第一个参与者类型，可以继续添加，也可以进入下一步。"
        : "The first participant type is ready. You can add more or continue to the next step.",
      actionLabel: isZh ? "查看参与者列表" : "Review participant registry",
      onAction: () => focusStepFourTarget("registry"),
    };

    const stepFiveTemplateHint: GuideHintState = {
      id: "step5-choose-template",
      message: isZh
        ? "先从一个关系结构模板开始，后面仍然可以继续微调连接规则。"
        : "Start with a structure template first. You can still refine the connection rules later.",
      actionLabel: isZh ? "带我去模板区" : "Take me to templates",
      onAction: () => focusStepFiveTarget("templates"),
    };

    const stepFiveIdleHint: GuideHintState = {
      id: "step5-idle-template",
      message: isZh
        ? "关系结构会影响谁能和谁互动。先选一个最接近你研究场景的连接方式。"
        : "The structure decides who can interact with whom. Start with the template closest to your research setting.",
      actionLabel: isZh ? "带我去模板区" : "Take me to templates",
      onAction: () => focusStepFiveTarget("templates"),
    };

    const stepFivePresetMessages: Record<string, string> = {
      full: isZh
        ? "当前选择“全连接”，表示每个参与者都能与其他人互动，适合高密度、充分接触的场景。"
        : "Fully connected means every participant can interact with every other participant. Use it for dense, high-contact settings.",
      random: isZh
        ? "当前选择“随机”，表示连接按概率生成，适合先观察扩散和偶遇式互动。"
        : "Random creates ties probabilistically, which is useful for diffusion and chance encounters.",
      ring: isZh
        ? "当前选择“环形”，表示互动主要发生在邻近个体之间。"
        : "Ring keeps interaction mostly among nearby neighbors.",
      star: isZh
        ? "当前选择“星形”，表示互动集中在一个中心节点周围。"
        : "Star concentrates interaction around a central hub.",
      "newman-watts": isZh
        ? "当前选择“小世界”，表示局部连接为主，同时保留少量跨区捷径。"
        : "Small world keeps local ties while adding a few long-range shortcuts.",
      "core-periphery": isZh
        ? "当前选择“核心-边缘”，表示少量核心成员更活跃，外围成员连接较少。"
        : "Core-periphery keeps a small active core and a sparser periphery.",
      sbm: isZh
        ? "当前选择“社区”，表示参与者先在群组内连接，再通过少量桥接互动。"
        : "Community structure connects participants within groups first, with a few bridging ties between them.",
      custom: isZh
        ? "当前选择“自定义结构”，可以先确认基础框架，再按需细调局部连接。"
        : "Custom structure lets you confirm the basic frame first and then refine local ties only where needed.",
    };

    const stepFiveSelectedHint: GuideHintState = {
      id: `step5-preset-${stepFiveSelectedPreset || "selected"}`,
      message:
        stepFivePresetMessages[stepFiveSelectedPreset || ""] ||
        (isZh
          ? "当前结构已经选定，可以先查看摘要，再决定是否展开详细设置。"
          : "The structure is selected. Review the summary first and open the detailed settings only if you need them."),
      actionLabel: isZh ? "查看当前摘要" : "Review the summary",
      onAction: () => focusStepFiveTarget("summary"),
    };

    const stepFiveAdvancedHint: GuideHintState = {
      id: `step5-advanced-${stepFiveAdvancedTarget || "details"}`,
      message: isZh
        ? "建议先确认基础结构，再继续细调局部连接。"
        : "Confirm the base structure first, then fine-tune local links only when needed.",
      actionLabel: isZh ? "查看当前摘要" : "Review the summary",
      onAction: () => focusStepFiveTarget("summary"),
    };

    const stepSixEntryHint: GuideHintState = {
      id: "step6-launch-entry",
      message: isZh
        ? "这是最后一步。先确认当前配置，再决定是否启动实验。"
        : "This is the final step. Review the configuration first, then decide whether to launch the experiment.",
      actionLabel: isZh ? "查看启动检查单" : "Review launch checklist",
      onAction: () => focusStepSixTarget("checklist"),
    };

    const stepSixReadyHint: GuideHintState = {
      id: "step6-launch-ready",
      message: isZh
        ? "当前实验已满足基础运行条件，可以直接启动。"
        : "The experiment already meets the basic run requirements and can be launched now.",
      actionLabel: isZh ? "查看启动状态" : "Review launch status",
      onAction: () => focusStepSixTarget("status"),
    };

    const stepSixMissingHint: GuideHintState = {
      id: `step6-launch-missing-${firstLaunchGap || "review"}`,
      message: !launchProviderReady
        ? isZh
          ? "还差一步才能启动，先去配置模型提供商。"
          : "One more step is required before launch. Configure the model provider first."
        : isZh
          ? `当前还缺少 ${launchMissingItems.length} 项关键配置，补齐后即可启动。`
          : `${launchMissingItems.length} required item(s) are still missing. Complete them before launch.`,
      actionLabel: isZh ? "去补充缺失项" : "Go fix missing items",
      onAction: jumpToLaunchGap,
    };

    const candidate =
      currentStep === 1
        ? templateReady
          ? stepOneReadyHint
          : stepOneIdleReady
            ? stepOneHint
            : null
        : currentStep === 2
          ? templateReady
            ? stepTwoHint
            : null
          : currentStep === 3
            ? stepThreeHint
            : currentStep === 4
              ? !hasParticipantType
                ? stepFourEntryHint
                : !hasNamedParticipantType
                  ? stepFourNameHint
                  : agentTypes.length === 1
                    ? stepFourReadyHint
                    : null
            : currentStep === 5
              ? stepFiveAdvancedTarget
                ? stepFiveAdvancedHint
                : stepFiveSelectedPreset
                  ? stepFiveSelectedHint
                  : stepFiveIdleReady
                    ? stepFiveIdleHint
                    : stepFiveTemplateHint
              : currentStep === 6
                ? stepSixEntryWindow
                  ? stepSixEntryHint
                  : launchReady
                    ? stepSixReadyHint
                    : stepSixMissingHint
              : null;

    if (!candidate || dismissedGuideHints.includes(candidate.id)) {
      return null;
    }

    return candidate;
  }, [
    agentTypes.length,
    currentStep,
    dismissedGuideHints,
    isZh,
    firstLaunchGap,
    hasNamedParticipantType,
    hasParticipantType,
    launchMissingItems.length,
    launchProviderReady,
    launchReady,
    scenarioConfigChangeCount,
    actionsReady,
    minimumActionCount,
    selectedActionIds.length,
    stepFiveAdvancedTarget,
    stepFiveIdleReady,
    stepFiveSelectedPreset,
    stepSixEntryWindow,
    stepOneIdleReady,
    templateReady,
    jumpToLaunchGap,
  ]);

  const guidePopoverConfig = React.useMemo(() => {
    if (currentStep === 1) {
      return {
        stepLabel: isZh ? "第 1 步 / 共 6 步" : "Step 1 / 6",
        title: isZh ? "场景选择" : "Scenario selection",
        goal: isZh
          ? "先选一个起始场景模板，后面仍然可以继续修改变量和规则。"
          : "Choose one starting scenario template first. Variables and rules can still be adjusted later.",
        tasks: stepOneTasks,
        actions: [
          {
            label: isZh ? "去模板区" : "Go to templates",
            onClick: () => focusGuideElement("ss-step1-template-library"),
          },
        ] satisfies GuideAction[],
      };
    }

    if (currentStep === 2) {
      return {
        stepLabel: isZh ? "第 2 步 / 共 6 步" : "Step 2 / 6",
        title: isZh ? "关键参数" : "Key parameters",
        goal: isZh
          ? "先确认场景框架，再调整最关键的 1~2 个参数。"
          : "Confirm the scenario frame first, then tune the one or two parameters that matter most.",
        tasks: stepTwoTasks.map((task) => ({ label: task.label, done: task.done })),
        actions: [
          scenarioConfigChangeCount > 0
            ? {
                label: isZh ? "去推进机制" : "Go to schedule",
                onClick: () => focusStepTwoTarget("schedule"),
              }
            : {
                label: isZh ? "去参数区" : "Go to parameters",
                onClick: () => focusStepTwoTarget("params"),
              },
        ] satisfies GuideAction[],
      };
    }

    if (currentStep === 3) {
      return {
        stepLabel: isZh ? "第 3 步 / 共 6 步" : "Step 3 / 6",
        title: isZh ? "行为规则" : "Behavior rules",
        goal: isZh
          ? minimumActionCount === 1
            ? "保留当前场景的核心动作即可进入下一步。"
            : `至少保留 ${minimumActionCount} 个动作，并让动作之间保持清晰差异。`
          : minimumActionCount === 1
            ? "Keep the core action for this scene and continue."
            : `Keep at least ${minimumActionCount} actions and make sure they remain meaningfully distinct.`,
        tasks: stepThreeTasks.map((task) => ({ label: task.label, done: task.done })),
        actions: [
          actionsReady
            ? {
                label: isZh ? "查看行为空间" : "Review behavior space",
                onClick: () => focusGuideElement("ss-step3-behavior-space"),
              }
            : {
                label: isZh ? "去动作区" : "Go to actions",
                onClick: () => focusGuideElement("ss-step3-action-library"),
              },
        ] satisfies GuideAction[],
      };
    }

    if (currentStep === 4) {
      return {
        stepLabel: isZh ? "第 4 步 / 共 6 步" : "Step 4 / 6",
        title: isZh ? "参与者定义" : "Participant setup",
        goal: isZh
          ? "先创建一个基础参与者类型，再决定是否继续补充更多群体。"
          : "Create one basic participant type first, then decide whether to add more groups.",
        tasks: [
          {
            label: isZh ? "创建一个基础参与者类型" : "Create one basic participant type",
            done: hasParticipantType,
          },
          {
            label: isZh ? "填写一个简单的群体名称" : "Add a simple group name",
            done: hasNamedParticipantType,
          },
        ],
        actions: [
          {
            label: isZh ? "去填写名称" : "Go to the name field",
            onClick: () => focusStepFourTarget("name"),
          },
          hasParticipantType
            ? {
                label: isZh ? "查看参与者列表" : "Review participant registry",
                onClick: () => focusStepFourTarget("registry"),
                tone: "secondary",
              }
            : {
                label: isZh ? "查看参与者模式" : "Review setup modes",
                onClick: () => focusStepFourTarget("mode"),
                tone: "secondary",
              },
        ] satisfies GuideAction[],
      };
    }

    if (currentStep === 5) {
      return {
        stepLabel: isZh ? "第 5 步 / 共 6 步" : "Step 5 / 6",
        title: isZh ? "关系结构" : "Relationship structure",
        goal: isZh
          ? "先选择一种关系结构模板，再按需展开 graph 或高级连接。"
          : "Choose a structure template first, then open the graph or advanced links only if you need them.",
        tasks: [
          {
            label: isZh ? "选择一种关系结构模板" : "Choose a relationship structure template",
            done: structureConfirmed,
          },
          {
            label: isZh ? "确认当前连接方式是否符合研究场景" : "Confirm the selected structure fits the study",
            done: structureConfirmed,
          },
        ],
        actions: [
          stepFiveSelectedPreset
            ? {
                label: isZh ? "查看当前摘要" : "Review summary",
                onClick: () => focusStepFiveTarget("summary"),
              }
            : {
                label: isZh ? "去模板区" : "Go to templates",
                onClick: () => focusStepFiveTarget("templates"),
              },
        ] satisfies GuideAction[],
      };
    }

    if (currentStep === 6) {
      return {
        stepLabel: isZh ? "第 6 步 / 共 6 步" : "Step 6 / 6",
        title: isZh ? "启动前确认" : "Launch review",
        goal: isZh
          ? "先确认当前配置是否齐备，再决定是否立即启动实验。"
          : "Confirm the current configuration before deciding whether to launch the experiment now.",
        tasks: [
          {
            label: isZh ? "检查关键配置是否齐备" : "Confirm the critical configuration is complete",
            done: launchReady,
          },
          {
            label: isZh ? "如有缺失，先跳转补齐对应步骤" : "Jump back to fill any missing setup",
            done: launchReady,
          },
        ],
        actions: launchReady
          ? ([
              {
                label: isZh ? "查看检查单" : "Review checklist",
                onClick: () => focusStepSixTarget("checklist"),
              },
              {
                label: isZh ? "稍后再说" : "Later",
                onClick: () => setGuideOpen(false),
                tone: "secondary",
              },
            ] satisfies GuideAction[])
          : !launchProviderReady
            ? ([
                {
                  label: isZh ? "去配置模型" : "Configure provider",
                  onClick: () => {
                    setGuideOpen(false);
                    navigate("/settings?tab=providers_llm");
                  },
                },
                {
                  label: isZh ? "稍后再说" : "Later",
                  onClick: () => setGuideOpen(false),
                  tone: "secondary",
                },
              ] satisfies GuideAction[])
            : ([
                {
                  label: isZh ? "查看检查单" : "Review checklist",
                  onClick: () => focusStepSixTarget("checklist"),
                },
                {
                  label: isZh ? "去补充缺失项" : "Go fix missing items",
                  onClick: jumpToLaunchGap,
                  tone: "secondary",
                },
              ] satisfies GuideAction[]),
      };
    }

    return null;
  }, [
    agentTypes.length,
    currentStep,
    firstLaunchGap,
    hasNamedParticipantType,
    hasParticipantType,
    isZh,
    jumpToLaunchGap,
    launchMissingItems.length,
    launchProviderReady,
    launchReady,
    scenarioConfigChangeCount,
    selectedActionIds.length,
    stepFiveSelectedPreset,
    stepSixEntryWindow,
    structureConfirmed,
    stepOneTasks,
    stepThreeTasks,
    stepTwoTasks,
    templateReady,
    jumpToWorkflowStep,
  ]);

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1InteractionType />;
      case 2:
        return <Step2StarterTemplate />;
      case 3:
        return <Step3Scenario />;
      case 4:
        return <Step4Agents />;
      case 5:
        return <Step5Network />;
      case 6:
        return <Step6Structure />;
      default:
        return null;
    }
  };

  const handleStepSelect = (step: number) => {
    if (step > currentStep) {
      return;
    }
    setCurrentStep(step as StepId);
  };

  const handlePrimaryAction = () => {
    if (currentStep < 6) {
      if (currentStep === 1 && !templateReady) {
        setSaveState(null);
        setStepOneActionHint(
          isZh
            ? "请先选择一个场景模板。"
            : "Please choose a scenario template first."
        );
        return;
      }
      if (!stepReady) return;
      nextStep();
      return;
    }
    if (!launchReady) {
      return;
    }
    if (!validate()) return;
    onComplete();
  };

  React.useEffect(() => {
    if (currentStep !== 1 || templateReady) {
      setStepOneActionHint(null);
    }
  }, [currentStep, templateReady]);

  const handleSaveDraft = () => {
    const state = useExperimentBuilder.getState();
    localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        currentStep: state.currentStep,
        selectedScenarioId: state.selectedScenarioId,
        scenarioDescription: state.scenarioDescription,
        scenarioParams: state.scenarioParams,
        roundVisibility: state.roundVisibility,
        turnOrder: state.turnOrder,
        selectedActionIds: state.selectedActionIds,
        agentMode: state.agentMode,
        agentTypes: state.agentTypes,
        selectedProviderId: state.selectedProviderId,
        socialNetwork: state.socialNetwork,
      })
    );
    setSaveState(
      `${labels.saveStatePrefix} · ${new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`
    );
  };

  return (
    <div className="ss-setup-builder ss-workflow-builder">
      <div
        className={`ss-workflow-builder__shell${currentStep === 1 ? " is-step-one" : ""}`}
      >
        <WorkflowSidebar
          title={labels.workflowTitle}
          subtitle={labels.workflowSubtitle}
          steps={workflowSteps}
          onSelectStep={handleStepSelect}
        />

        <div className="ss-workflow-builder__main">
          <section className="ss-workflow-builder__stage">{renderStep()}</section>
          <FloatingActionBar
            prevLabel={labels.actionPrev}
            onPrev={prevStep}
            prevDisabled={currentStep === 1}
            saveLabel={labels.actionSave}
            onSave={handleSaveDraft}
            saveState={saveState}
            primaryLabel={
              currentStep === 6
                ? labels.actionLaunch
                : currentStep === 1
                  ? labels.actionNextQuestion
                  : currentStep === 2
                    ? scenarioConfigChangeCount > 0
                      ? isZh
                        ? "继续配置行为规则"
                        : "Continue to heuristics"
                      : isZh
                        ? "保存并进入下一步"
                        : "Save and continue"
                    : currentStep === 3
                      ? actionsReady
                        ? isZh
                          ? "继续配置参与者"
                          : "Continue to participants"
                        : isZh
                          ? `至少保留 ${minimumActionCount} 个动作`
                          : `Keep at least ${minimumActionCount} action${minimumActionCount > 1 ? "s" : ""}`
                      : currentStep === 5
                        ? stepReady
                          ? isZh
                            ? "进入运行预览"
                            : "Go to launch preview"
                          : isZh
                            ? "请先选择一种关系结构"
                            : "Choose a structure first"
                    : stepReady
                      ? labels.actionNext
                      : labels.actionNeedCurrent
            }
            onPrimary={handlePrimaryAction}
            primaryDisabled={
              currentStep === 1 ? false : !stepReady
            }
            hint={
              currentStep === 1
                ? stepOneActionHint
                  : currentStep === 2 && !templateReady
                    ? isZh
                      ? "请先确认当前场景。"
                      : "Please confirm the current scenario first."
                  : currentStep === 3 && !actionsReady
                    ? isZh
                      ? `请至少启用 ${minimumActionCount} 个动作。`
                      : `Please enable at least ${minimumActionCount} action${minimumActionCount > 1 ? "s" : ""}.`
                  : currentStep === 5 && !stepReady
                    ? isZh
                      ? "请先选择一种关系结构。"
                      : "Please choose a relationship structure first."
                  : currentStep === 6 && !launchReady
                    ? !launchProviderReady
                      ? isZh
                        ? "请先配置模型提供商。"
                        : "Please configure a model provider first."
                      : isZh
                        ? `请先补齐 ${launchMissingItems.length} 项关键配置。`
                        : `Please complete the remaining ${launchMissingItems.length} required item(s).`
                  : null
            }
          />
        </div>

        {currentStep !== 1 ? (
          <ResearchNotebookPanel
            subtitle={
              currentStep === 2
                ? isZh
                  ? "这里只保留当前步骤、状态与下一步。"
                  : "Current step, status, and next."
                : currentStep === 3
                  ? isZh
                    ? "这里只保留当前步骤、已启用动作与下一步。"
                    : "Step status, enabled actions, and next."
                  : currentStep === 4
                    ? isZh
                      ? "这里只保留当前步骤、参与者状态与下一步。"
                      : "Step status, participant state, and next."
                    : currentStep === 5
                      ? isZh
                        ? "这里只保留当前步骤、结构确认与下一步。"
                        : "Step status, structure confirmation, and next."
                      : currentStep === 6
                        ? isZh
                          ? "这里只保留启动状态、当前场景与启动后去向。"
                          : "Launch status, scenario, and what happens next."
                : labels.notebookSubtitle
            }
            title={
              currentStep === 6
                ? isZh
                  ? "启动状态栏"
                  : "Launch status"
                : isZh
                  ? "状态栏"
                  : "Step status"
            }
            status={
              currentStep === 2
                ? isZh
                  ? "关键参数"
                  : "Key parameters"
                : currentStep === 3
                  ? isZh
                    ? "行为空间"
                    : "Behavior space"
                  : currentStep === 4
                    ? isZh
                      ? "参与者状态"
                      : "Participant state"
                    : currentStep === 5
                      ? isZh
                        ? "关系结构"
                        : "Relationship structure"
                      : currentStep === 6
                        ? isZh
                          ? "启动前确认"
                          : "Pre-launch review"
                        : labels.notebookStatus
            }
            progress={
              currentStep === 2
                ? {
                    stepLabel: isZh ? "第 2 步 / 共 6 步" : "Step 2 / 6",
                    completionLabel: isZh
                      ? `已完成 ${stepTwoTasks.filter((task) => task.done).length} / 3 项`
                      : `${stepTwoTasks.filter((task) => task.done).length} / 3 done`,
                  }
                : currentStep === 3
                  ? {
                      stepLabel: isZh ? "第 3 步 / 共 6 步" : "Step 3 / 6",
                      completionLabel: isZh
                        ? `已完成 ${stepThreeTasks.filter((task) => task.done).length} / 2 项`
                        : `${stepThreeTasks.filter((task) => task.done).length} / 2 done`,
                    }
                  : currentStep === 4
                    ? {
                        stepLabel: isZh ? "第 4 步 / 共 6 步" : "Step 4 / 6",
                        completionLabel: isZh
                          ? `已完成 ${[hasParticipantType, hasNamedParticipantType].filter(Boolean).length} / 2 项`
                          : `${[hasParticipantType, hasNamedParticipantType].filter(Boolean).length} / 2 done`,
                      }
                  : currentStep === 5
                    ? {
                        stepLabel: isZh ? "第 5 步 / 共 6 步" : "Step 5 / 6",
                        completionLabel: isZh
                          ? `已完成 ${[templateReady, totalAgents > 0, structureConfirmed].filter(Boolean).length} / 3 项`
                          : `${[templateReady, totalAgents > 0, structureConfirmed].filter(Boolean).length} / 3 done`,
                      }
                    : currentStep === 6
                      ? {
                          stepLabel: isZh ? "第 6 步 / 共 6 步" : "Step 6 / 6",
                          completionLabel: launchReady
                            ? isZh
                              ? "可启动"
                              : "Ready to launch"
                            : !launchProviderReady
                              ? isZh
                                ? "需配置模型"
                                : "Provider required"
                              : isZh
                                ? `已完成 ${launchCompletedCount} / 5 项`
                                : `${launchCompletedCount} / 5 done`,
                        }
                : undefined
            }
            sections={
              currentStep === 2
                ? stepTwoSections
                : currentStep === 3
                  ? stepThreeSections
                  : currentStep === 4
                    ? stepFourSections
                  : currentStep === 5
                    ? stepFiveSections
                    : currentStep === 6
                      ? stepSixSections
                  : notebookSections
            }
            summaryCards={
              currentStep === 2
                ? stepTwoSummaryCards
                : currentStep === 3
                  ? null
                  : currentStep === 4
                    ? stepFourSummaryCards
                  : currentStep === 5
                    ? null
                    : currentStep === 6
                      ? stepSixSummaryCards
                  : notebookSummary
            }
            tip={
              currentStep === 2 ||
              currentStep === 3 ||
              currentStep === 4 ||
              currentStep === 5 ||
              currentStep === 6
                ? null
                : {
                    title: isZh ? "当前模板摘要" : "Current template summary",
                    body: isZh
                      ? `${scenarioName} · ${providerLabel} · ${scheduleLabel}`
                      : `${scenarioName} · ${providerLabel} · ${scheduleLabel}`,
                  }
            }
          />
        ) : null}

        {(currentStep <= 6) && guidePopoverConfig ? (
          <div className="ss-guide-system">
            {!guideOpen && activeGuideHint ? (
              <GuideHintBubble
                message={activeGuideHint.message}
                actionLabel={activeGuideHint.actionLabel}
                onAction={activeGuideHint.onAction}
                onClose={() => dismissGuideHint(activeGuideHint.id)}
              />
            ) : null}

            {guideOpen ? (
              <GuidePopover
                stepLabel={guidePopoverConfig.stepLabel}
                title={guidePopoverConfig.title}
                goal={guidePopoverConfig.goal}
                tasks={guidePopoverConfig.tasks}
                actions={guidePopoverConfig.actions}
                onClose={() => setGuideOpen(false)}
              />
            ) : null}

            <GuideMascotTrigger
              open={guideOpen}
              hasNotice={!guideOpen && Boolean(activeGuideHint)}
              onClick={() => setGuideOpen((value) => !value)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ExperimentBuilder;
