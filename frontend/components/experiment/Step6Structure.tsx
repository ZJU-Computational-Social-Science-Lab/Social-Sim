import React from "react";
import { AlertCircle, Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useExperimentBuilder } from "../../store/experiment-builder";
import { buildAgentCollections } from "../../utils/agentCollections";
import { PrimaryGradientButton } from "./workflow/PrimaryGradientButton";
import { ResearchInputPanel } from "./workflow/ResearchInputPanel";
import { SummaryInfoCard } from "./workflow/SummaryInfoCard";
import { TemplateCard } from "./workflow/TemplateCard";
import { ValidationChecklistCard } from "./workflow/ValidationChecklistCard";

interface PromptPreviewPanelProps {
  agentTypeLabel: string;
  agentTypeProfile: string;
  agentTypeRolePrompt: string;
  agentTypeProperties: Record<string, unknown>;
  scenarioDescription: string;
  scenarioParams: Record<string, unknown>;
  availableActions: Array<{ name: string; description: string }>;
  selectedActionIds: string[];
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

const PromptPreviewPanel: React.FC<PromptPreviewPanelProps> = ({
  agentTypeLabel,
  agentTypeProfile,
  agentTypeRolePrompt,
  agentTypeProperties,
  scenarioDescription,
  scenarioParams,
  availableActions,
  selectedActionIds,
}) => {
  const { t, i18n } = useTranslation();
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
              ? "以下内容展示该参与者在实验开始前会收到的说明摘要。"
              : "This shows the instruction summary the participant will receive before the run starts."}
          </p>
        </div>
      </div>

      <div className="ss-launch-preview__prompt-body">
        <section>
          <h4>{isZh ? "参与者定位" : "Participant framing"}</h4>
          <p>
            {[agentTypeRolePrompt, agentTypeProfile].filter(Boolean).join(" ") ||
              (isZh ? "尚未补充具体定位。" : "No participant framing has been added yet.")}
          </p>
        </section>

        <section>
          <h4>{isZh ? "研究场景" : "Scenario"}</h4>
          <p>
            {scenarioDescription ||
              (isZh ? "尚未填写研究问题与场景说明。" : "No research framing has been entered yet.")}
          </p>
        </section>

        <section>
          <h4>{isZh ? "当前参数" : "Current parameters"}</h4>
          {Object.keys(scenarioParams).length > 0 ? (
            <ul>
              {Object.entries(scenarioParams).map(([key, value]) => (
                <li key={key}>
                  <strong>{key}</strong>
                  <span>{String(value)}</span>
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
            <h4>{isZh ? "参与者属性" : "Participant properties"}</h4>
            <ul>
              {previewProperties.map(([key, value]) => (
                <li key={key}>
                  <strong>{key}</strong>
                  <span>{String(value)}</span>
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
  const isZh = i18n.language.startsWith("zh");
  const {
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
  const [selectedCollectionKey, setSelectedCollectionKey] = React.useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = React.useState<string | null>(null);
  const [collectionQuery, setCollectionQuery] = React.useState("");

  const totalAgents = agentTypes.reduce((sum, type) => sum + type.count, 0);
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
  const scenarioName =
    selectedScenarioData?.name ||
    (isZh ? "未命名实验" : "Untitled study");

  const agentCollections = React.useMemo(
    () => buildAgentCollections(agentTypes, () => ""),
    [agentTypes]
  );
  const filteredCollections = React.useMemo(() => {
    const query = collectionQuery.trim().toLowerCase();
    if (!query) {
      return agentCollections;
    }

    return agentCollections.filter((collection) => {
      const haystack = [
        collection.title,
        collection.representative.userProfile || "",
        collection.representative.rolePrompt || "",
        ...collection.members.map((member) => member.label),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [agentCollections, collectionQuery]);

  const selectedCollection = React.useMemo(
    () =>
      filteredCollections.find((collection) => collection.key === selectedCollectionKey) ||
      agentCollections.find((collection) => collection.key === selectedCollectionKey) ||
      filteredCollections[0] ||
      agentCollections[0] ||
      null,
    [agentCollections, filteredCollections, selectedCollectionKey]
  );
  const selectedPreviewAgent = React.useMemo(
    () =>
      selectedCollection?.members.find((member) => member.id === selectedMemberId) ||
      selectedCollection?.representative ||
      null,
    [selectedCollection, selectedMemberId]
  );

  React.useEffect(() => {
    if (!selectedCollection) {
      setSelectedCollectionKey(null);
      setSelectedMemberId(null);
      return;
    }
    if (selectedCollection.key !== selectedCollectionKey) {
      setSelectedCollectionKey(selectedCollection.key);
    }
  }, [selectedCollection, selectedCollectionKey]);

  React.useEffect(() => {
    if (!selectedPreviewAgent) {
      setSelectedMemberId(null);
      return;
    }
    if (selectedPreviewAgent.id !== selectedMemberId) {
      setSelectedMemberId(selectedPreviewAgent.id);
    }
  }, [selectedMemberId, selectedPreviewAgent]);

  if (agentTypes.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
            <AlertCircle className="w-8 h-8 text-amber-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t("experimentBuilder.step6.noAgentsDefined")}
          </h3>
          <p className="text-gray-600">{t("experimentBuilder.step6.goBackToStep4")}</p>
        </div>
      </div>
    );
  }

  const checklist = [
    {
      title: isZh ? "研究场景已确定" : "Scenario selected",
      description: isZh
        ? "已选择实验模板，后续运行会以此作为基础场景。"
        : "A scenario template has been selected as the study base.",
      complete: Boolean(selectedScenarioId),
    },
    {
      title: isZh ? "研究说明已补充" : "Research framing drafted",
      description: isZh
        ? "研究问题与背景说明已经写入当前草稿。"
        : "The research question and framing are already in the draft.",
      complete: scenarioDescription.trim().length > 0,
    },
    {
      title: isZh ? "行为规则已整理" : "Heuristics selected",
      description: isZh
        ? "已为实验挑选可执行动作。"
        : "The experiment already has executable heuristics.",
      complete: selectedActionIds.length > 0,
    },
    {
      title: isZh ? "参与者已录入" : "Participants defined",
      description: isZh
        ? "至少有一组参与者会进入实验。"
        : "At least one participant group will enter the study.",
      complete: totalAgents > 0,
    },
    {
      title: isZh ? "关系结构已准备" : "Structure prepared",
      description: isZh
        ? "网络连接或关系结构已经建立。"
        : "The structural ties or network summary has been prepared.",
      complete: networkEdges > 0,
    },
  ];

  return (
    <div className="ss-launch-preview">
      <ResearchInputPanel
        eyebrow={isZh ? "运行预览 / Launch preview" : "Launch preview"}
        title={isZh ? "运行预览" : "Launch preview"}
        description={
          isZh
            ? "在启动实验前，先确认研究设置是否完整，并查看系统说明的代表性预览。"
            : "Review the study configuration and inspect a representative system prompt before launch."
        }
      >
        <div className="ss-launch-preview__intro-grid">
          <div className="ss-launch-preview__checklist">
            {checklist.map((item) => (
              <ValidationChecklistCard
                key={item.title}
                title={item.title}
                description={item.description}
                complete={item.complete}
              />
            ))}
          </div>

          <div className="ss-launch-preview__summary">
            <SummaryInfoCard
              label={isZh ? "实验名称" : "Experiment"}
              value={scenarioName}
              helper={isZh ? "当前草稿将以该场景名称进入实验。" : "The run will launch with this scenario."}
            />
            <SummaryInfoCard
              label={isZh ? "实验类型" : "Study type"}
              value={
                selectedScenarioData
                  ? t(`scenario.category.${selectedScenarioData.category}`)
                  : t("experimentDesk.summary.none")
              }
            />
            <SummaryInfoCard
              label={isZh ? "参与者数量" : "Participants"}
              value={totalAgents}
            />
            <SummaryInfoCard
              label={isZh ? "行为规则" : "Heuristics"}
              value={selectedActionIds.length}
            />
            <SummaryInfoCard
              label={isZh ? "结构摘要" : "Structure"}
              value={networkEdges}
              helper={isZh ? "连接数量" : "Network ties"}
            />
            <SummaryInfoCard
              label={isZh ? "推进方式" : "Schedule"}
              value={scheduleLabel}
              helper={providerLabel}
            />
          </div>
        </div>
      </ResearchInputPanel>

      <ResearchInputPanel
        eyebrow={isZh ? "当前模板摘要 / Template summary" : "Template summary"}
        title={isZh ? "系统说明预览" : "System prompt preview"}
        description={
          isZh
            ? "默认先显示每个参与者集合中的代表说明；只有在需要时才继续下钻到具体成员。"
            : "Preview a representative instruction first, then inspect individual members only when needed."
        }
        footer={
          selectedCollection ? (
            <div className="ss-launch-preview__panel-foot">
              <span>
                {isZh
                  ? `当前集合：${selectedCollection.title}`
                  : `Current collection: ${selectedCollection.title}`}
              </span>
              <PrimaryGradientButton
                type="button"
                disabled
                aria-disabled="true"
              >
                {isZh ? "启动实验" : "Launch experiment"}
              </PrimaryGradientButton>
            </div>
          ) : null
        }
      >
        <div className="ss-launch-preview__workspace">
          <aside className="ss-launch-preview__directory">
            <label className="ss-launch-preview__search">
              <Search size={14} />
              <input
                value={collectionQuery}
                onChange={(event) => setCollectionQuery(event.target.value)}
                placeholder={
                  isZh
                    ? "搜索参与者集合或代表说明"
                    : "Search collections or representative prompts"
                }
              />
            </label>

            <div className="ss-launch-preview__collection-list">
              {filteredCollections.length > 0 ? (
                filteredCollections.map((collection) => (
                  <TemplateCard
                    key={collection.key}
                    eyebrow={isZh ? "参与者集合" : "Collection"}
                    title={collection.title}
                    description={
                      collection.representative.userProfile ||
                      collection.representative.rolePrompt ||
                      (isZh ? "尚未补充描述。" : "No description yet.")
                    }
                    meta={
                      isZh ? `${collection.count} 名成员` : `${collection.count} members`
                    }
                    selected={selectedCollection?.key === collection.key}
                    onClick={() => {
                      setSelectedCollectionKey(collection.key);
                      setSelectedMemberId(collection.representative.id);
                    }}
                  />
                ))
              ) : (
                <div className="ss-launch-preview__empty">
                  {isZh ? "没有匹配的参与者集合。" : "No collections match the current search."}
                </div>
              )}
            </div>
          </aside>

          <div className="ss-launch-preview__stage">
            {selectedCollection && selectedPreviewAgent ? (
              <>
                <div className="ss-launch-preview__stage-meta">
                  <SummaryInfoCard
                    label={isZh ? "集合成员" : "Members"}
                    value={selectedCollection.count}
                  />
                  <SummaryInfoCard
                    label={isZh ? "共享属性" : "Shared properties"}
                    value={selectedCollection.propertyCount}
                  />
                  <SummaryInfoCard
                    label={isZh ? "当前代表" : "Representative"}
                    value={selectedCollection.representative.label}
                  />
                  <SummaryInfoCard
                    label={isZh ? "当前预览成员" : "Current preview"}
                    value={selectedPreviewAgent.label}
                  />
                </div>

                <PromptPreviewPanel
                  agentTypeLabel={selectedPreviewAgent.label}
                  agentTypeProfile={selectedPreviewAgent.userProfile || ""}
                  agentTypeRolePrompt={selectedPreviewAgent.rolePrompt || ""}
                  agentTypeProperties={selectedPreviewAgent.properties || {}}
                  scenarioDescription={scenarioDescription}
                  scenarioParams={scenarioParams}
                  availableActions={availableActions}
                  selectedActionIds={selectedActionIds}
                />

                {selectedCollection.members.length > 1 ? (
                  <div className="ss-launch-preview__member-grid">
                    {selectedCollection.members.map((member) => (
                      <TemplateCard
                        key={member.id}
                        eyebrow={isZh ? "成员" : "Member"}
                        title={member.label}
                        description={
                          member.userProfile ||
                          member.rolePrompt ||
                          (isZh ? "尚未补充描述。" : "No description yet.")
                        }
                        selected={member.id === selectedPreviewAgent.id}
                        onClick={() => setSelectedMemberId(member.id)}
                      />
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </ResearchInputPanel>
    </div>
  );
};
