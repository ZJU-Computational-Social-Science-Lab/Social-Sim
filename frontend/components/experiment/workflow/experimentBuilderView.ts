import type { ReactNode } from "react";

import type {
  NotebookSection,
  ResearchNotebookPanelProps,
} from "./ResearchNotebookPanel";

export type ExperimentBuilderStepId = 1 | 2 | 3 | 4 | 5 | 6;

interface ActionBarLabels {
  actionLaunch: string;
  actionNeedCurrent: string;
  actionNext: string;
  actionNextQuestion: string;
}

interface NotebookViewInput {
  currentStep: Exclude<ExperimentBuilderStepId, 1>;
  isZh: boolean;
  templateReady: boolean;
  totalAgents: number;
  structureConfirmed: boolean;
  hasParticipantType: boolean;
  hasNamedParticipantType: boolean;
  launchReady: boolean;
  launchProviderReady: boolean;
  launchCompletedCount: number;
  stepTwoCompletedCount: number;
  stepThreeCompletedCount: number;
  stepTwoSections: NotebookSection[];
  stepThreeSections: NotebookSection[];
  stepFourSections: NotebookSection[];
  stepFiveSections: NotebookSection[];
  stepSixSections: NotebookSection[];
  stepTwoSummaryCards: ReactNode;
  stepFourSummaryCards: ReactNode;
  stepSixSummaryCards: ReactNode;
}

interface ActionBarViewInput {
  currentStep: ExperimentBuilderStepId;
  isZh: boolean;
  stepReady: boolean;
  templateReady: boolean;
  scenarioConfigChangeCount: number;
  actionsReady: boolean;
  minimumActionCount: number;
  stepOneActionHint: string | null;
  launchReady: boolean;
  launchProviderReady: boolean;
  launchMissingCount: number;
  labels: ActionBarLabels;
}

interface ActionBarViewState {
  primaryLabel: string;
  primaryDisabled: boolean;
  hint: string | null;
}

const createProgress = (step: number, completionLabel: string, isZh: boolean) => ({
  stepLabel: isZh ? `第 ${step} 步 / 共 6 步` : `Step ${step} / 6`,
  completionLabel,
});

export function getExperimentBuilderNotebookProps(
  input: NotebookViewInput
): ResearchNotebookPanelProps {
  const {
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
  } = input;

  switch (currentStep) {
    case 2:
      return {
        title: isZh ? "状态栏" : "Step status",
        subtitle: isZh ? "这里只保留当前步骤、状态与下一步。" : "Current step, status, and next.",
        status: isZh ? "关键参数" : "Key parameters",
        progress: createProgress(
          2,
          isZh ? `已完成 ${stepTwoCompletedCount} / 3 项` : `${stepTwoCompletedCount} / 3 done`,
          isZh
        ),
        sections: stepTwoSections,
        summaryCards: stepTwoSummaryCards,
      };
    case 3:
      return {
        title: isZh ? "状态栏" : "Step status",
        subtitle: isZh
          ? "这里只保留当前步骤、已启用动作与下一步。"
          : "Step status, enabled actions, and next.",
        status: isZh ? "行为空间" : "Behavior space",
        progress: createProgress(
          3,
          isZh ? `已完成 ${stepThreeCompletedCount} / 2 项` : `${stepThreeCompletedCount} / 2 done`,
          isZh
        ),
        sections: stepThreeSections,
      };
    case 4: {
      const completedCount = [hasParticipantType, hasNamedParticipantType].filter(Boolean).length;
      return {
        title: isZh ? "状态栏" : "Step status",
        subtitle: isZh
          ? "这里只保留当前步骤、参与者状态与下一步。"
          : "Step status, participant state, and next.",
        status: isZh ? "参与者状态" : "Participant state",
        progress: createProgress(
          4,
          isZh ? `已完成 ${completedCount} / 2 项` : `${completedCount} / 2 done`,
          isZh
        ),
        sections: stepFourSections,
        summaryCards: stepFourSummaryCards,
      };
    }
    case 5: {
      const completedCount = [templateReady, totalAgents > 0, structureConfirmed].filter(Boolean)
        .length;
      return {
        title: isZh ? "状态栏" : "Step status",
        subtitle: isZh
          ? "这里只保留当前步骤、结构确认与下一步。"
          : "Step status, structure confirmation, and next.",
        status: isZh ? "关系结构" : "Relationship structure",
        progress: createProgress(
          5,
          isZh ? `已完成 ${completedCount} / 3 项` : `${completedCount} / 3 done`,
          isZh
        ),
        sections: stepFiveSections,
      };
    }
    case 6:
      return {
        title: isZh ? "启动状态栏" : "Launch status",
        subtitle: isZh
          ? "这里只保留启动状态、当前场景与启动后去向。"
          : "Launch status, scenario, and what happens next.",
        status: isZh ? "启动前确认" : "Pre-launch review",
        progress: createProgress(
          6,
          launchReady
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
          isZh
        ),
        sections: stepSixSections,
        summaryCards: stepSixSummaryCards,
      };
  }
}

export function getExperimentBuilderActionBarState(
  input: ActionBarViewInput
): ActionBarViewState {
  const {
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
    launchMissingCount,
    labels,
  } = input;

  const primaryLabel =
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
          : labels.actionNeedCurrent;

  const hint =
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
            ? `请先补齐 ${launchMissingCount} 项关键配置。`
            : `Please complete the remaining ${launchMissingCount} required item(s).`
      : null;

  return {
    primaryLabel,
    primaryDisabled: currentStep === 1 ? false : !stepReady,
    hint,
  };
}
