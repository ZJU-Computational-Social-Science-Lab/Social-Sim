import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

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
  getExperimentBuilderActionBarState,
  getExperimentBuilderNotebookProps,
  type ExperimentBuilderStepId,
} from "./workflow/experimentBuilderView";
import {
  focusStepTwoTarget,
  focusStepFourTarget,
  focusStepFiveTarget,
  focusStepSixTarget,
  focusGuideElement,
} from "./workflow/guideHelpers";
import { summarizeActionStructure } from "./workflow/summarizeActionStructure";
import { useBuilderNavigation, useDismissedHints } from "./workflow/useBuilderNavigation";
import { useGuideIdleState } from "./workflow/useGuideIdleState";
import { getLocalizedScenarioName } from "../../utils/scenarioLocalization";

type StepId = ExperimentBuilderStepId;

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

const getSocialNetworkEdgeCount = (network: Record<string, string[]>) => {
  const edges = new Set<string>();
  Object.entries(network).forEach(([source, targets]) => {
    targets.forEach((target) => {
      const key = source < target ? `${source}|${target}` : `${target}|${source}`;
      edges.add(key);
    });
  });
  return edges.size;
};

export const ExperimentBuilder: React.FC<ExperimentBuilderProps> = ({
  onComplete,
  onCancel,
}) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isZh = i18n.language.startsWith("zh");
  const {
    currentStep,
    setCurrentStep,
    nextStep,
    prevStep,
    validate,
    selectedScenarioId,
    selectedScenarioData,
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
      actionPrev: isZh ? "上一步" : "Previous",
      actionSave: isZh ? "保存草稿" : "Save draft",
      actionNextQuestion: isZh ? "继续下一步" : "Continue",
      actionNext: isZh ? "保存并继续" : "Save and continue",
      actionLaunch: isZh ? "启动实验" : "Launch experiment",
      actionNeedCurrent: isZh ? "先补全当前步骤" : "Complete this step first",
      saveStatePrefix: isZh ? "草稿已保存" : "Draft saved",
    }),
    [isZh]
  );

  const workflowSteps = React.useMemo<WorkflowSidebarStep[]>(
    () => [
      {
        id: 1,
        title: isZh ? "选择起点" : "Starting point",
        subtitle: isZh ? "选一个最接近你研究问题的场景" : "Pick the closest scenario to your question",
        state: currentStep === 1 ? "current" : currentStep > 1 ? "complete" : "upcoming",
      },
      {
        id: 2,
        title: isZh ? "整理变量" : "Variables",
        subtitle: isZh ? "明确你要观察哪些关键因素" : "Decide which key factors to observe",
        state: currentStep === 2 ? "current" : currentStep > 2 ? "complete" : "upcoming",
      },
      {
        id: 3,
        title: isZh ? "设定规则" : "Rules",
        subtitle: isZh ? "定义个体如何行动、互动与变化" : "Define how individuals act, interact, and change",
        state: currentStep === 3 ? "current" : currentStep > 3 ? "complete" : "upcoming",
      },
      {
        id: 4,
        title: isZh ? "配置智能体" : "Agents",
        subtitle: isZh ? "确定有哪些角色、数量和属性" : "Set roles, counts, and attributes",
        state: currentStep === 4 ? "current" : currentStep > 4 ? "complete" : "upcoming",
      },
      {
        id: 5,
        title: isZh ? "建立关系" : "Relationships",
        subtitle: isZh ? "设置谁与谁之间会产生影响" : "Decide who can influence whom",
        state: currentStep === 5 ? "current" : currentStep > 5 ? "complete" : "upcoming",
      },
      {
        id: 6,
        title: isZh ? "预览运行" : "Run preview",
        subtitle: isZh ? "检查配置并启动实验" : "Review the setup and launch",
        state: currentStep === 6 ? "current" : currentStep > 6 ? "complete" : "upcoming",
      },
    ],
    [currentStep, isZh]
  );

  const totalAgents = agentTypes.reduce((sum, type) => sum + (type.count || 0), 0);
  const namedParticipantTypes = agentTypes.filter((agent) => agent.label.trim().length > 0).length;
  const hasParticipantType = agentTypes.length > 0;
  const hasNamedParticipantType = namedParticipantTypes > 0;
  const socialNetworkNodeCount = Object.keys(socialNetwork).length;
  const socialNetworkEdgeCount = React.useMemo(
    () => getSocialNetworkEdgeCount(socialNetwork),
    [socialNetwork]
  );
  const structureConfirmed =
    socialNetworkNodeCount > 0 && (totalAgents <= 1 || socialNetworkEdgeCount > 0);
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
  const scenarioName =
    getLocalizedScenarioName(t, selectedScenarioData) || t("experimentDesk.summary.none");
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
            ? "下一步进入“行为规则”页，确定智能体在这个场景中可以采取哪些行动。"
            : "Next, move to Heuristic Set and define which actions agents can take in this scenario.",
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
  const stepTwoCompletedCount = stepTwoTasks.filter((task) => task.done).length;
  const stepThreeCompletedCount = stepThreeTasks.filter((task) => task.done).length;

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
            ? "进入“智能体”页，为不同智能体类型绑定行为逻辑。"
            : "Move to Agents and attach these behaviors to agent groups.",
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
              ? `已创建智能体类型：${agentTypes.length}`
              : `Agent types created: ${agentTypes.length}`
            : isZh
              ? "尚未创建智能体类型"
              : "No agent type created yet",
          hasNamedParticipantType
            ? isZh
              ? `已命名智能体类型：${namedParticipantTypes}`
              : `Named agent types: ${namedParticipantTypes}`
            : isZh
              ? "尚未填写智能体名称"
              : "Agent names are still empty",
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
            ? "下一步进入“关系结构”页，为不同智能体决定如何连接。"
            : "Next, move to Structure and decide how agent groups connect.",
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
          label={isZh ? "智能体类型" : "Agent types"}
          value={agentTypes.length}
        />
        <SummaryInfoCard label={isZh ? "智能体数量" : "Agents"} value={totalAgents} />
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
          ? `已定义智能体：${totalAgents}`
          : `Agents defined: ${totalAgents}`
        : isZh
          ? "尚未定义智能体"
          : "Agents not defined yet",
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
            ? "尚未定义智能体"
            : "Agents are not defined yet"
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
  const notebookPanelProps = React.useMemo(() => {
    if (currentStep === 1) {
      return null;
    }

    return getExperimentBuilderNotebookProps({
      currentStep,
      isZh,
      templateReady,
      totalAgents,
      structureConfirmed,
      hasParticipantType,
      hasNamedParticipantType,
      launchReady,
      launchProviderReady,
      launchCompletedCount,
      stepTwoCompletedCount,
      stepThreeCompletedCount,
      stepTwoSections,
      stepThreeSections,
      stepFourSections,
      stepFiveSections,
      stepSixSections,
      stepTwoSummaryCards,
      stepFourSummaryCards,
      stepSixSummaryCards,
    });
  }, [
    currentStep,
    hasNamedParticipantType,
    hasParticipantType,
    isZh,
    launchCompletedCount,
    launchMissingItems.length,
    launchProviderReady,
    launchReady,
    stepFiveSections,
    stepFourSections,
    stepFourSummaryCards,
    stepSixSections,
    stepSixSummaryCards,
    stepThreeCompletedCount,
    stepThreeSections,
    stepTwoCompletedCount,
    stepTwoSections,
    stepTwoSummaryCards,
    structureConfirmed,
    templateReady,
    totalAgents,
  ]);

  const stepOneTasks = React.useMemo<GuideTask[]>(
    () => [
      {
        label: isZh ? "选择实验起点" : "Choose a starting point",
        done: templateReady,
      },
      {
        label: isZh ? "必要时从空白开始" : "Start blank if needed",
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
        ? "先创建一个基础智能体类型，不需要一次定义所有群体。"
        : "Start with one basic agent type. You do not need to define every group at once.",
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
        ? "已创建第一个智能体类型，可以继续添加，也可以进入下一步。"
        : "The first agent type is ready. You can add more or continue to the next step.",
      actionLabel: isZh ? "查看智能体列表" : "Review agent registry",
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
        ? "当前选择“全连接”，表示每个智能体都能与其他智能体互动，适合高密度、充分接触的场景。"
        : "Fully connected means every agent can interact with every other agent. Use it for dense, high-contact settings.",
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
        ? "当前选择“核心-边缘”，表示少量核心智能体更活跃，外围智能体连接较少。"
        : "Core-periphery keeps a small active core and a sparser periphery.",
      sbm: isZh
        ? "当前选择“社区”，表示智能体先在群组内连接，再通过少量桥接互动。"
        : "Community structure connects agents within groups first, with a few bridging ties between them.",
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
        title: isZh ? "智能体定义" : "Agent setup",
        goal: isZh
          ? "先创建一个基础智能体类型，再决定是否继续补充更多群体。"
          : "Create one basic agent type first, then decide whether to add more groups.",
        tasks: [
          {
            label: isZh ? "创建一个基础智能体类型" : "Create one basic agent type",
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
                label: isZh ? "查看智能体列表" : "Review agent registry",
                onClick: () => focusStepFourTarget("registry"),
                tone: "secondary",
              }
            : {
                label: isZh ? "查看智能体模式" : "Review setup modes",
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
            ? "请先选择一个实验起点。"
            : "Please choose an experiment starting point first."
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
  const actionBarState = getExperimentBuilderActionBarState({
    currentStep,
    isZh,
    stepReady,
    templateReady,
    scenarioConfigChangeCount,
    actionsReady,
    minimumActionCount,
    stepOneActionHint,
    launchReady,
    launchProviderReady,
    launchMissingCount: launchMissingItems.length,
    labels,
  });

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
            primaryLabel={actionBarState.primaryLabel}
            onPrimary={handlePrimaryAction}
            primaryDisabled={actionBarState.primaryDisabled}
            hint={actionBarState.hint}
          />
        </div>

        {notebookPanelProps ? <ResearchNotebookPanel {...notebookPanelProps} /> : null}

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
