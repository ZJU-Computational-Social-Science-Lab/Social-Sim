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
import { SummaryInfoCard } from "./workflow/SummaryInfoCard";

type StepId = 1 | 2 | 3 | 4 | 5 | 6;

interface ExperimentBuilderProps {
  onComplete: () => void;
  onCancel: () => void;
}

const getEdgeCount = (network: Record<string, string[]>) => {
  const dedup = new Set<string>();
  Object.entries(network).forEach(([source, targets]) => {
    targets.forEach((target) => {
      const key = source < target ? `${source}|${target}` : `${target}|${source}`;
      dedup.add(key);
    });
  });
  return dedup.size;
};

const getDraftStorageKey = () => "socialsim4.experiment-draft";

export const ExperimentBuilder: React.FC<ExperimentBuilderProps> = ({
  onComplete,
  onCancel,
}) => {
  const { t, i18n } = useTranslation();
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
      notebookTitle: isZh ? "Research Notebook" : "Research notebook",
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
  const networkEdges = React.useMemo(() => getEdgeCount(socialNetwork), [socialNetwork]);
  const providerLabel =
    llmProviders.find((provider) => provider.id === selectedProviderId)?.name ??
    t("experimentDesk.summary.none");
  const scheduleLabel =
    roundVisibility === "simultaneous"
      ? t("experimentDesk.summary.simultaneous")
      : turnOrder === "random"
        ? t("experimentDesk.summary.random")
        : t("experimentDesk.summary.fixed");
  const scenarioName = selectedScenarioData?.name ?? t("experimentDesk.summary.none");
  const templateReady = selectedScenarioId !== null;
  const [saveState, setSaveState] = React.useState<string | null>(null);
  const [stepOneActionHint, setStepOneActionHint] = React.useState<string | null>(null);

  const stepReady =
    currentStep === 1
      ? templateReady
      : currentStep === 2
        ? scenarioDescription.trim() !== ""
        : currentStep === 3
          ? selectedActionIds.length > 0
          : currentStep === 4
            ? totalAgents > 0
        : true;

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
      getDraftStorageKey(),
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
                  : stepReady
                  ? labels.actionNext
                  : labels.actionNeedCurrent
            }
            onPrimary={handlePrimaryAction}
            primaryDisabled={currentStep === 1 ? false : currentStep < 6 && !stepReady}
            hint={currentStep === 1 ? stepOneActionHint : null}
          />
        </div>

        {currentStep !== 1 ? (
          <ResearchNotebookPanel
            title={labels.notebookTitle}
            subtitle={labels.notebookSubtitle}
            status={labels.notebookStatus}
            sections={notebookSections}
            summaryCards={notebookSummary}
            tip={{
              title: isZh ? "当前模板摘要" : "Current template summary",
              body: isZh
                ? `${scenarioName} · ${providerLabel} · ${scheduleLabel}`
                : `${scenarioName} · ${providerLabel} · ${scheduleLabel}`,
            }}
          />
        ) : null}
      </div>
    </div>
  );
};

export default ExperimentBuilder;
