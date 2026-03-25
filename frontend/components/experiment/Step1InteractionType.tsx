import React, { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useExperimentBuilder } from "../../store/experiment-builder";
import { getAllScenarios, ScenarioData, ScenarioParam } from "../../services/scenarios";
import { ResearchInputPanel } from "./workflow/ResearchInputPanel";
import { SecondaryGhostButton } from "./workflow/SecondaryGhostButton";
import { SummaryInfoCard } from "./workflow/SummaryInfoCard";
import { TemplateCard } from "./workflow/TemplateCard";

const CATEGORY_ORDER = [
  "game_theory",
  "social_dynamics",
  "discussion",
  "spatial",
  "social_deduction",
  "sociology",
  "custom",
] as const;

const formatParamRange = (param: ScenarioParam) => {
  if (param.type === "number" && param.min !== undefined && param.max !== undefined) {
    return `${param.min} — ${param.max}`;
  }

  if (param.options && param.options.length > 0) {
    return param.options.slice(0, 3).join(" / ");
  }

  return String(param.default);
};

const getScenarioActionCount = (scenario: ScenarioData) =>
  (scenario.category_actions || scenario.actions || []).length;

const emitStepOneInteraction = () => {
  window.dispatchEvent(new CustomEvent("ss-step1-interaction"));
};

export const Step1InteractionType: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");
  const {
    selectedScenarioId,
    setSelectedScenarioId,
    setSelectedScenarioData,
    markStepComplete,
  } = useExperimentBuilder();

  const [scenarios, setScenarios] = useState<ScenarioData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const [showScenarioDetails, setShowScenarioDetails] = useState(false);

  useEffect(() => {
    const fetchScenarios = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await getAllScenarios();
        setScenarios(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("dashboard.error"));
      } finally {
        setLoading(false);
      }
    };

    fetchScenarios();
  }, [t]);

  const filteredScenarios = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return scenarios.filter((scenario) => {
      if (activeCategory !== "all" && scenario.category !== activeCategory) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const translatedName = t(`scenario.${scenario.category}.${scenario.id}.name`, {
        defaultValue: scenario.name,
      }).toLowerCase();
      const translatedDescription = t(`scenario.${scenario.category}.${scenario.id}.description`, {
        defaultValue: scenario.description,
      }).toLowerCase();

      return `${translatedName} ${translatedDescription} ${scenario.category}`.includes(
        normalizedQuery
      );
    });
  }, [activeCategory, scenarios, searchQuery, t]);

  const selectedScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? null,
    [scenarios, selectedScenarioId]
  );

  const availableCategories = useMemo(
    () =>
      CATEGORY_ORDER.filter((category) =>
        scenarios.some((scenario) => scenario.category === category)
      ),
    [scenarios]
  );

  const recommendedScenarios = filteredScenarios.slice(0, 4);
  const visibleScenarios = showAllTemplates ? filteredScenarios : recommendedScenarios;
  const activeScenario = selectedScenario ?? null;
  const hasMoreScenarios = filteredScenarios.length > recommendedScenarios.length;
  const selectedCustomScenario = activeScenario?.category === "custom";

  const handleSelectScenario = (scenario: ScenarioData) => {
    emitStepOneInteraction();
    setSelectedScenarioId(scenario.id);
    setSelectedScenarioData(scenario);
    markStepComplete(1);
    setShowScenarioDetails(false);
  };

  const jumpToTemplateSection = (category: string) => {
    emitStepOneInteraction();
    setActiveCategory(category);
    if (category === "custom") {
      setShowAllTemplates(true);
    }
    window.setTimeout(() => {
      document
        .getElementById("ss-step1-template-library")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  };

  if (loading) {
    return (
      <div className="ss-setup-scenarios__state">
        <div className="lab-meta">{t("common.loading")}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ss-setup-scenarios__state is-error">
        <div className="section-title">{t("dashboard.error")}</div>
        <p className="lab-meta">{error}</p>
      </div>
    );
  }

  if (scenarios.length === 0) {
    return (
      <div className="ss-setup-scenarios__state">
        <div className="section-title">{t("scenarioLibrary.emptyTitle")}</div>
        <p className="lab-meta">{t("scenarioLibrary.emptyBody")}</p>
      </div>
    );
  }

  return (
    <div className="ss-research-question">
      <section className="ss-research-question__guide">
        <div className="ss-research-question__guide-copy">
          <div className="ss-workflow-kicker">
            {isZh ? "新建实验 / 第 1 步" : "New experiment / Step 1"}
          </div>
          <h1 className="ss-research-question__guide-title">
            {isZh
              ? "先选择一个社会情境作为实验起点"
              : "Start from one social situation"}
          </h1>
        </div>

        <div className="ss-research-question__guide-meta">
          <span className="ss-research-question__guide-step">
            {isZh ? "第 1 步 / 共 6 步" : "Step 1 of 6"}
          </span>
          <div className="ss-research-question__guide-tasks">
            <button
              type="button"
              onClick={() => jumpToTemplateSection("all")}
              className={`ss-research-question__guide-task${activeScenario && !selectedCustomScenario ? " is-done" : ""}`.trim()}
            >
              <span className="ss-research-question__guide-check" aria-hidden="true">
                {activeScenario && !selectedCustomScenario ? "✓" : ""}
              </span>
              <span>{isZh ? "选择一个场景模板" : "Choose a scenario template"}</span>
            </button>
            <button
              type="button"
              onClick={() => jumpToTemplateSection("custom")}
              className={`ss-research-question__guide-task${selectedCustomScenario ? " is-done" : ""}`.trim()}
            >
              <span className="ss-research-question__guide-check" aria-hidden="true">
                {selectedCustomScenario ? "✓" : ""}
              </span>
              <span>{isZh ? "或创建自定义场景" : "Or create a custom scenario"}</span>
            </button>
          </div>
        </div>
      </section>

      <ResearchInputPanel
        eyebrow={isZh ? "场景目录" : "Scenario library"}
        title={isZh ? "选择一个起始情境" : "Choose a starting scenario"}
        description={
          isZh
            ? "先确定一个研究起点；推荐场景优先展示，完整场景库可稍后展开。"
            : "Pick one research starting point first. The recommended scenarios are shown first and the full library can stay secondary."
        }
        footer={
          <div className="ss-research-question__recommended-foot">
            <span>
              {isZh
                ? `当前已选择模板：${activeScenario ? t(`scenario.${activeScenario.category}.${activeScenario.id}.name`, { defaultValue: activeScenario.name }) : "尚未选择"}`
                : `Current template: ${activeScenario ? t(`scenario.${activeScenario.category}.${activeScenario.id}.name`, { defaultValue: activeScenario.name }) : "Not selected yet"}`}
            </span>
            <div className="ss-research-question__recommended-actions">
              {hasMoreScenarios ? (
                <SecondaryGhostButton
                  type="button"
                  onClick={() => {
                    emitStepOneInteraction();
                    setShowAllTemplates((value) => !value);
                  }}
                >
                  {showAllTemplates
                    ? isZh
                      ? "收起完整场景库"
                      : "Show fewer templates"
                    : isZh
                      ? "打开完整场景库"
                      : "Open full library"}
                </SecondaryGhostButton>
              ) : null}
              {activeScenario ? (
                <SecondaryGhostButton
                  type="button"
                  onClick={() => {
                    emitStepOneInteraction();
                    setShowScenarioDetails((value) => !value);
                  }}
                >
                  {showScenarioDetails
                    ? isZh
                      ? "收起场景详细设定"
                      : "Hide scenario details"
                    : isZh
                      ? "查看场景详细设定"
                      : "View scenario details"}
                </SecondaryGhostButton>
              ) : null}
            </div>
          </div>
        }
      >
        <div
          className="ss-research-question__recommended ss-guide-focus-target"
          id="ss-step1-template-library"
        >
          <div className="ss-research-question__category-tabs">
            <button
              type="button"
              onClick={() => {
                emitStepOneInteraction();
                setActiveCategory("all");
              }}
              className={`ss-research-question__category-tab${activeCategory === "all" ? " is-active" : ""}`}
            >
              {t("scenarioLibrary.allCategories")}
            </button>
            {availableCategories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => {
                  emitStepOneInteraction();
                  setActiveCategory(category);
                }}
                className={`ss-research-question__category-tab${activeCategory === category ? " is-active" : ""}`}
              >
                {t(`scenario.category.${category}`)}
              </button>
            ))}
          </div>

          <div className="ss-research-question__search-row">
            <label className="ss-research-question__search">
              <Search size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => {
                  emitStepOneInteraction();
                  setSearchQuery(event.target.value);
                }}
                placeholder={
                  isZh
                    ? "搜索模板（可选）"
                    : "Search templates (optional)"
                }
              />
            </label>
            <div className="ss-research-question__results">
              <span>{t("scenarioLibrary.resultsCount", { count: filteredScenarios.length })}</span>
            </div>
          </div>

          {filteredScenarios.length === 0 ? (
            <div className="ss-setup-scenarios__state">
              <div className="section-title">{t("scenarioLibrary.emptyTitle")}</div>
              <p className="lab-meta">{t("scenarioLibrary.emptyBody")}</p>
            </div>
          ) : (
            <div className="ss-research-question__library is-compact">
              {visibleScenarios.map((scenario) => {
                const name = t(`scenario.${scenario.category}.${scenario.id}.name`, {
                  defaultValue: scenario.name,
                });
                const description = t(
                  `scenario.${scenario.category}.${scenario.id}.description`,
                  { defaultValue: scenario.description }
                );

                return (
                  <TemplateCard
                    key={scenario.id}
                    eyebrow={t(`scenario.category.${scenario.category}`)}
                    title={name}
                    description={description}
                    selected={selectedScenarioId === scenario.id}
                    selectedLabel={isZh ? "已选" : "Selected"}
                    onClick={() => handleSelectScenario(scenario)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </ResearchInputPanel>

      {activeScenario && showScenarioDetails ? (
        <ResearchInputPanel
          eyebrow={isZh ? "场景详细设定 / Scenario details" : "Scenario details"}
          title={t(`scenario.${activeScenario.category}.${activeScenario.id}.name`, {
            defaultValue: activeScenario.name,
          })}
          description={t(
            `scenario.${activeScenario.category}.${activeScenario.id}.description`,
            { defaultValue: activeScenario.description }
          )}
          actions={<span className="ss-workflow-inline-status">{t("scenarioLibrary.selected")}</span>}
        >
          <div className="ss-research-question__detail-meta">
            <SummaryInfoCard
              label={isZh ? "研究方向" : "Research lens"}
              value={t(`scenario.category.${activeScenario.category}`)}
              helper={t(`scenarioLibrary.lenses.${activeScenario.category}`)}
            />
            <SummaryInfoCard
              label={isZh ? "交互模式" : "Interaction"}
              value={t(
                `scenarioLibrary.interactionLabels.${activeScenario.interaction_mode || "simultaneous"}`
              )}
            />
            <SummaryInfoCard
              label={isZh ? "行为规则" : "Heuristics"}
              value={getScenarioActionCount(activeScenario)}
            />
            <SummaryInfoCard
              label={isZh ? "参数数量" : "Parameters"}
              value={activeScenario.parameters.length}
            />
          </div>

          <div className="ss-research-question__parameter-table">
            <div className="ss-research-question__parameter-head">
              <span>{t("experimentStudio.variableId")}</span>
              <span>{t("experimentStudio.metricType")}</span>
              <span>{t("experimentStudio.valueRange")}</span>
            </div>
            {activeScenario.parameters.length === 0 ? (
              <div className="ss-research-question__parameter-row is-empty">
                <span>{t("experimentDesk.summary.none")}</span>
                <span>{t("experimentDesk.summary.none")}</span>
                <span>{t("experimentDesk.summary.none")}</span>
              </div>
            ) : (
              activeScenario.parameters.slice(0, 6).map((param) => (
                <div key={param.key} className="ss-research-question__parameter-row">
                  <span>{param.key}</span>
                  <span>{param.ui_hint || param.type}</span>
                  <span>{formatParamRange(param)}</span>
                </div>
              ))
            )}
          </div>
        </ResearchInputPanel>
      ) : null}
    </div>
  );
};
