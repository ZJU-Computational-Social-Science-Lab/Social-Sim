import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Compass, Layers3, Plus, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useExperimentBuilder } from "../../store/experiment-builder";
import { getAllScenarios, ScenarioData } from "../../services/scenarios";
import { PrimaryGradientButton } from "./workflow/PrimaryGradientButton";
import { SecondaryGhostButton } from "./workflow/SecondaryGhostButton";

type LocaleKey = "zh" | "en";

type CategoryGuide = {
  explanation: string;
  fit: string[];
  examples: string[];
  difficulty: string;
  recommended?: boolean;
};

type TemplateGuide = {
  fit: string;
  includes: string[];
  difficulty: string;
  readiness: string;
};

const CATEGORY_ORDER = [
  "social_dynamics",
  "game_theory",
  "discussion",
  "spatial",
  "social_deduction",
  "sociology",
  "custom",
];

const RECOMMENDED_CATEGORY = "social_dynamics";

const CATEGORY_GUIDES: Record<string, Record<LocaleKey, CategoryGuide>> = {
  game_theory: {
    zh: {
      explanation: "研究个体在激励、约束与收益差异下，如何选择合作、背离或协调。",
      fit: ["合作困境", "搭便车", "制度激励", "信任建立"],
      examples: ["囚徒困境", "公共物品", "猎鹿博弈"],
      difficulty: "中等难度",
    },
    en: {
      explanation: "Study how people cooperate, defect, coordinate, or compete under different incentives.",
      fit: ["Cooperation dilemmas", "Free-riding", "Institution design", "Trust formation"],
      examples: ["Prisoner's dilemma", "Public goods", "Stag hunt"],
      difficulty: "Intermediate",
    },
  },
  social_dynamics: {
    zh: {
      explanation: "研究观念、行为或政策影响如何在人群中传播、扩散与变化。",
      fit: ["参保扩散", "谣言传播", "政策采纳", "从众行为"],
      examples: ["参保扩散", "西湖益联保参保扩散"],
      difficulty: "适合新手",
      recommended: true,
    },
    en: {
      explanation: "Explore how ideas, behaviors, or policy influence spread and change across a population.",
      fit: ["Enrollment diffusion", "Rumor spread", "Policy adoption", "Conformity"],
      examples: ["Enrollment Diffusion", "Community adoption"],
      difficulty: "Beginner friendly",
      recommended: true,
    },
  },
  discussion: {
    zh: {
      explanation: "研究群体在交流、协商与意见碰撞中如何形成共识或分裂。",
      fit: ["会议讨论", "意见极化", "协商治理", "集体选择"],
      examples: ["小组讨论", "协商决策"],
      difficulty: "中等难度",
    },
    en: {
      explanation: "Study how groups form consensus, disagreement, or polarization through conversation.",
      fit: ["Meeting discussion", "Opinion polarization", "Deliberation", "Collective choice"],
      examples: ["Group discussion", "Deliberative decision"],
      difficulty: "Intermediate",
    },
  },
  spatial: {
    zh: {
      explanation: "研究空间邻近、流动路径与局部互动如何改变整体格局。",
      fit: ["社区扩散", "邻里影响", "局部传播", "区域聚集"],
      examples: ["网格扩散", "邻里互动"],
      difficulty: "进阶",
    },
    en: {
      explanation: "Analyze how proximity, movement, and local contact reshape the wider pattern.",
      fit: ["Neighborhood diffusion", "Local influence", "Regional clustering", "Spatial spread"],
      examples: ["Grid diffusion", "Neighborhood interaction"],
      difficulty: "Advanced",
    },
  },
  sociology: {
    zh: {
      explanation: "研究社会规范、角色关系与制度安排如何影响个体选择。",
      fit: ["规范遵从", "身份角色", "制度约束", "群体影响"],
      examples: ["社会规范", "角色互动"],
      difficulty: "中等难度",
    },
    en: {
      explanation: "Investigate how norms, roles, and institutions shape individual choices.",
      fit: ["Norm compliance", "Social roles", "Institutional constraints", "Group influence"],
      examples: ["Social norms", "Role interaction"],
      difficulty: "Intermediate",
    },
  },
  social_deduction: {
    zh: {
      explanation: "研究隐藏身份、信息不对称与推理过程如何改变群体判断。",
      fit: ["信任推理", "隐藏身份", "投票博弈", "集体判断"],
      examples: ["狼人杀", "身份推理"],
      difficulty: "进阶",
    },
    en: {
      explanation: "Explore hidden roles, asymmetric information, and group inference.",
      fit: ["Trust inference", "Hidden identity", "Voting games", "Collective judgment"],
      examples: ["Werewolf", "Role deduction"],
      difficulty: "Advanced",
    },
  },
  custom: {
    zh: {
      explanation: "从空白实验开始，自行定义变量、规则、智能体与关系结构。",
      fit: ["自定义问题", "新场景原型", "非预设流程"],
      examples: ["空白实验"],
      difficulty: "进阶",
    },
    en: {
      explanation: "Start with a blank experiment and define variables, rules, agents, and relationships yourself.",
      fit: ["Custom question", "New prototype", "Non-template flow"],
      examples: ["Blank experiment"],
      difficulty: "Advanced",
    },
  },
};

const TEMPLATE_GUIDES_BY_ID: Record<string, Record<LocaleKey, TemplateGuide>> = {
  xihu_yilianbao: {
    zh: {
      fit: "模拟政策信息在社区中如何传播，并影响居民参保决策。",
      includes: ["居民节点", "邻里关系", "信息传播", "采纳阈值"],
      difficulty: "适合新手",
      readiness: "可直接运行",
    },
    en: {
      fit: "Model how policy information spreads through a community and changes enrollment decisions.",
      includes: ["Resident nodes", "Neighborhood ties", "Information spread", "Adoption threshold"],
      difficulty: "Beginner friendly",
      readiness: "Runnable now",
    },
  },
  enrollment_diffusion: {
    zh: {
      fit: "观察信息触达、同伴影响与采纳阈值如何推动参保扩散。",
      includes: ["居民群体", "传播网络", "采纳状态", "影响阈值"],
      difficulty: "适合新手",
      readiness: "可直接运行",
    },
    en: {
      fit: "Observe how exposure, peer influence, and thresholds drive enrollment adoption.",
      includes: ["Resident group", "Diffusion network", "Adoption state", "Influence threshold"],
      difficulty: "Beginner friendly",
      readiness: "Runnable now",
    },
  },
};

const TEMPLATE_GUIDES_BY_CATEGORY: Record<string, Record<LocaleKey, TemplateGuide>> = {
  game_theory: {
    zh: {
      fit: "比较不同收益结构下，智能体为什么选择合作、背离或协调。",
      includes: ["智能体角色", "行动选项", "收益矩阵", "回合规则"],
      difficulty: "中等难度",
      readiness: "可直接运行",
    },
    en: {
      fit: "Compare why agents cooperate, defect, or coordinate under different payoff structures.",
      includes: ["Agent roles", "Action options", "Payoff matrix", "Turn rules"],
      difficulty: "Intermediate",
      readiness: "Runnable now",
    },
  },
  social_dynamics: {
    zh: {
      fit: "分析信息、观点或行为如何在人群中扩散，并形成新的整体趋势。",
      includes: ["群体节点", "影响关系", "状态变量", "扩散规则"],
      difficulty: "适合新手",
      readiness: "可直接运行",
    },
    en: {
      fit: "Analyze how information, opinions, or behaviors spread and create population-level change.",
      includes: ["Population nodes", "Influence ties", "State variables", "Diffusion rules"],
      difficulty: "Beginner friendly",
      readiness: "Runnable now",
    },
  },
  discussion: {
    zh: {
      fit: "观察不同角色在交流中如何交换意见、推动共识或产生分歧。",
      includes: ["讨论角色", "发言规则", "观点变量", "互动记录"],
      difficulty: "中等难度",
      readiness: "可直接运行",
    },
    en: {
      fit: "Observe how roles exchange views, build consensus, or create disagreement through discussion.",
      includes: ["Discussion roles", "Speaking rules", "Opinion variables", "Interaction log"],
      difficulty: "Intermediate",
      readiness: "Runnable now",
    },
  },
  spatial: {
    zh: {
      fit: "研究位置、邻近关系与局部接触如何影响扩散路径和区域格局。",
      includes: ["空间网格", "邻近关系", "移动或传播规则", "区域状态"],
      difficulty: "进阶",
      readiness: "可直接运行",
    },
    en: {
      fit: "Study how location, proximity, and local contact affect spread paths and regional patterns.",
      includes: ["Spatial grid", "Neighbor links", "Movement or spread rules", "Area states"],
      difficulty: "Advanced",
      readiness: "Runnable now",
    },
  },
  sociology: {
    zh: {
      fit: "分析规范、角色或制度约束如何影响群体中的个体选择。",
      includes: ["社会角色", "规范变量", "互动关系", "行为规则"],
      difficulty: "中等难度",
      readiness: "可直接运行",
    },
    en: {
      fit: "Analyze how norms, roles, or institutional constraints shape individual choices in a group.",
      includes: ["Social roles", "Norm variables", "Interaction ties", "Behavior rules"],
      difficulty: "Intermediate",
      readiness: "Runnable now",
    },
  },
  social_deduction: {
    zh: {
      fit: "探索隐藏身份、信任变化与投票选择如何影响群体判断。",
      includes: ["隐藏角色", "公共讨论", "投票规则", "信任状态"],
      difficulty: "进阶",
      readiness: "可直接运行",
    },
    en: {
      fit: "Explore how hidden roles, changing trust, and votes shape group judgment.",
      includes: ["Hidden roles", "Public discussion", "Voting rules", "Trust state"],
      difficulty: "Advanced",
      readiness: "Runnable now",
    },
  },
  custom: {
    zh: {
      fit: "用于完全自定义的实验问题，不套用任何预设逻辑。",
      includes: ["空白参数", "自定义规则", "自定义智能体", "自定义关系"],
      difficulty: "进阶",
      readiness: "需要配置",
    },
    en: {
      fit: "Use this when the question needs a fully custom setup without preset logic.",
      includes: ["Blank parameters", "Custom rules", "Custom agents", "Custom relationships"],
      difficulty: "Advanced",
      readiness: "Needs setup",
    },
  },
};

const emitStepOneInteraction = (type: string, detail: Record<string, unknown> = {}) => {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent("ss-step1-interaction", {
      detail: {
        type,
        ...detail,
      },
    }),
  );
};

const getScenarioActionCount = (scenario: ScenarioData) =>
  scenario.template?.default_actions?.length ?? scenario.category_actions?.length ?? scenario.actions?.length ?? 0;

const getLocaleKey = (language: string): LocaleKey => (language.startsWith("zh") ? "zh" : "en");

const joinItems = (items: string[], locale: LocaleKey) => items.join(locale === "zh" ? "、" : ", ");

const getCategoryTemplateCountLabel = (count: number, locale: LocaleKey) =>
  locale === "zh" ? `${count} 个模板` : `${count} template${count === 1 ? "" : "s"}`;

const getCategoryGuide = (category: string, locale: LocaleKey): CategoryGuide => {
  const guide = CATEGORY_GUIDES[category]?.[locale];
  if (guide) {
    return guide;
  }
  return {
    explanation:
      locale === "zh"
        ? "从这个问题类型出发，快速找到一个可运行的实验模板。"
        : "Start from this question type and choose a runnable experiment template.",
    fit: locale === "zh" ? ["探索变量影响", "比较不同行为", "测试规则变化"] : ["Explore drivers", "Compare behavior", "Test rule changes"],
    examples: locale === "zh" ? ["可运行模板"] : ["Runnable template"],
    difficulty: locale === "zh" ? "中等难度" : "Intermediate",
  };
};

const getTemplateGuide = (scenario: ScenarioData, locale: LocaleKey): TemplateGuide => {
  return (
    TEMPLATE_GUIDES_BY_ID[scenario.id]?.[locale] ??
    TEMPLATE_GUIDES_BY_CATEGORY[scenario.category]?.[locale] ??
    TEMPLATE_GUIDES_BY_CATEGORY.custom[locale]
  );
};

export const Step1InteractionType: React.FC = () => {
  const { t, i18n } = useTranslation();
  const {
    selectedScenarioId,
    selectedScenarioData,
    setSelectedScenarioId,
    setSelectedScenarioData,
    markStepComplete,
  } = useExperimentBuilder();
  const [scenarios, setScenarios] = useState<ScenarioData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const locale = getLocaleKey(i18n.language);
  const isZh = locale === "zh";

  useEffect(() => {
    let cancelled = false;

    const loadScenarios = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getAllScenarios();
        if (!cancelled) {
          setScenarios(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load scenarios");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadScenarios();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedScenario = useMemo(() => {
    if (selectedScenarioId) {
      return scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? null;
    }
    if (selectedScenarioData) {
      return selectedScenarioData;
    }
    return null;
  }, [scenarios, selectedScenarioData, selectedScenarioId]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    scenarios.forEach((scenario) => {
      counts.set(scenario.category, (counts.get(scenario.category) ?? 0) + 1);
    });
    return CATEGORY_ORDER.filter((category) => counts.has(category))
      .concat([...counts.keys()].filter((category) => !CATEGORY_ORDER.includes(category)))
      .filter((category) => category !== "custom")
      .map((category) => ({
        id: category,
        count: counts.get(category) ?? 0,
      }));
  }, [scenarios]);

  const recommendedCategory = useMemo(() => {
    const categoryIds = categories.map((category) => category.id);
    if (categoryIds.includes(RECOMMENDED_CATEGORY)) {
      return RECOMMENDED_CATEGORY;
    }
    if (categoryIds.includes("game_theory")) {
      return "game_theory";
    }
    return categoryIds[0] ?? null;
  }, [categories]);

  useEffect(() => {
    if (categories.length === 0) {
      return;
    }
    if (activeCategory && categories.some((category) => category.id === activeCategory)) {
      return;
    }
    const selectedCategory =
      selectedScenario?.category && selectedScenario.category !== "custom" ? selectedScenario.category : null;
    setActiveCategory(selectedCategory ?? recommendedCategory);
  }, [activeCategory, categories, recommendedCategory, selectedScenario?.category]);

  const recommendedScenario = useMemo(() => {
    const xihuScenario = scenarios.find((scenario) => scenario.id === "xihu_yilianbao");
    if (xihuScenario) {
      return xihuScenario;
    }
    const categoryScenario = scenarios.find((scenario) => scenario.category === recommendedCategory);
    if (categoryScenario) {
      return categoryScenario;
    }
    return scenarios.find((scenario) => scenario.category !== "custom") ?? scenarios[0] ?? null;
  }, [recommendedCategory, scenarios]);

  const customScenario = useMemo(
    () => scenarios.find((scenario) => scenario.category === "custom") ?? null,
    [scenarios],
  );

  const effectiveActiveCategory =
    activeCategory ??
    (selectedScenario?.category && selectedScenario.category !== "custom" ? selectedScenario.category : null) ??
    recommendedCategory;

  const activeCategoryScenarios = useMemo(
    () => scenarios.filter((scenario) => scenario.category === effectiveActiveCategory),
    [effectiveActiveCategory, scenarios],
  );

  const getCategoryLabel = (category: string) =>
    t(`scenario.category.${category}`, {
      defaultValue: category.replace(/_/g, " "),
    });

  const getScenarioName = (scenario: ScenarioData) =>
    t(`scenario.${scenario.category}.${scenario.id}.name`, {
      defaultValue: scenario.name,
    });

  const getScenarioDescription = (scenario: ScenarioData) =>
    t(`scenario.${scenario.category}.${scenario.id}.description`, {
      defaultValue: scenario.description || getTemplateGuide(scenario, locale).fit,
    });

  const scrollToSection = (id: string) => {
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleSelectScenario = (scenario: ScenarioData) => {
    setSelectedScenarioId(scenario.id);
    setSelectedScenarioData(scenario);
    markStepComplete(1);
    emitStepOneInteraction("scenario_selected", {
      scenarioId: scenario.id,
      category: scenario.category,
      actionCount: getScenarioActionCount(scenario),
    });
  };

  const handleUseRecommended = () => {
    if (recommendedScenario) {
      setActiveCategory(recommendedScenario.category);
      handleSelectScenario(recommendedScenario);
      scrollToSection("ss-step1-template-preview");
    }
  };

  const handleViewRecommended = () => {
    setActiveCategory(recommendedScenario?.category ?? recommendedCategory);
    scrollToSection("ss-step1-template-preview");
  };

  const handleBrowseCategories = () => {
    scrollToSection("ss-step1-category-grid");
  };

  const handleStartBlank = () => {
    if (customScenario) {
      handleSelectScenario(customScenario);
      return;
    }
    setActiveCategory(recommendedCategory);
    scrollToSection("ss-step1-template-preview");
  };

  const handleSelectCategory = (category: string) => {
    setActiveCategory(category);
    emitStepOneInteraction("category_selected", { category });
    scrollToSection("ss-step1-template-preview");
  };

  const activeCategoryGuide = effectiveActiveCategory ? getCategoryGuide(effectiveActiveCategory, locale) : null;
  const activeCategoryLabel = effectiveActiveCategory ? getCategoryLabel(effectiveActiveCategory) : "";

  const startModes = [
    {
      key: "recommended",
      icon: <Sparkles size={18} />,
      badge: isZh ? "推荐" : "Recommended",
      title: isZh ? "快速开始" : "Quick start",
      description: isZh
        ? "根据常见研究目标，直接进入一个可运行的模板。适合先跑通一次实验，再逐步修改参数。"
        : "Jump into a runnable template based on common research goals, then adjust parameters after the first run.",
      action: isZh ? "查看推荐模板" : "View recommended templates",
      onClick: handleViewRecommended,
      emphasized: true,
    },
    {
      key: "categories",
      icon: <Compass size={18} />,
      title: isZh ? "按研究问题选择" : "Choose by question",
      description: isZh
        ? "按“合作、扩散、讨论、空间互动”等问题类型选择起点。每个分类都附带适用说明和示例场景。"
        : "Choose by problem type such as cooperation, diffusion, discussion, or spatial interaction.",
      action: isZh ? "浏览研究分类" : "Browse research categories",
      onClick: handleBrowseCategories,
      emphasized: false,
    },
    {
      key: "blank",
      icon: <Plus size={18} />,
      title: isZh ? "从空白开始" : "Start blank",
      description: isZh
        ? "不使用预设逻辑，自行定义变量、规则、智能体与关系结构。"
        : "Skip presets and define variables, rules, agents, and relationships yourself.",
      action: isZh ? "创建空白实验" : "Create blank experiment",
      onClick: handleStartBlank,
      emphasized: false,
    },
  ];

  if (loading) {
    return <div className="ss-loading-state">{t("common.loading", { defaultValue: "Loading..." })}</div>;
  }

  if (error) {
    return (
      <div className="ss-error-state">
        <p>{t("scenario.loadError", { defaultValue: "Failed to load scenarios." })}</p>
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="ss-research-question">
      <section className="ss-start-hero">
        <div className="ss-start-hero__copy">
          <span className="ss-start-hero__step">
            {isZh ? "第 1 步 / 共 6 步" : "Step 1 / 6"}
          </span>
          <h1>{isZh ? "选择实验起点" : "Choose experiment starting point"}</h1>
          <p>
            {isZh
              ? "先从一个最接近你研究问题的场景开始。系统会推荐合适的实验模板，你后续仍可修改。"
              : "Start from the scenario closest to your research question. The system recommends runnable templates, and you can still revise later."}
          </p>
          <div className="ss-start-hero__meta">
            <CheckCircle2 size={16} />
            <span>{isZh ? "预计 1 分钟完成｜后续步骤可继续调整" : "About 1 minute · Later steps remain editable"}</span>
          </div>
        </div>
        <div className="ss-start-hero__actions">
          <PrimaryGradientButton onClick={handleUseRecommended} disabled={!recommendedScenario}>
            {isZh ? "使用推荐模板" : "Use recommended template"}
            <ArrowRight size={16} />
          </PrimaryGradientButton>
          <SecondaryGhostButton onClick={handleStartBlank}>
            {isZh ? "从空白实验开始" : "Start from blank experiment"}
          </SecondaryGhostButton>
        </div>
      </section>

      <section className="ss-start-section ss-start-section--modes">
        <div className="ss-start-section__head">
          <span>{isZh ? "开始方式" : "Start options"}</span>
          <h2>{isZh ? "你可以这样开始" : "You can start this way"}</h2>
        </div>
        <div className="ss-start-mode-grid">
          {startModes.map((mode) => (
            <article
              key={mode.key}
              className={`ss-start-mode-card${mode.emphasized ? " is-recommended" : ""}`}
            >
              <div className="ss-start-mode-card__top">
                <span className="ss-start-mode-card__icon">{mode.icon}</span>
                {mode.badge ? <span className="ss-start-badge">{mode.badge}</span> : null}
              </div>
              <h3>{mode.title}</h3>
              <p>{mode.description}</p>
              <button type="button" className="ss-start-link-button" onClick={mode.onClick}>
                {mode.action}
                <ArrowRight size={15} />
              </button>
            </article>
          ))}
        </div>
      </section>

      <section id="ss-step1-category-grid" className="ss-start-section ss-guide-focus-target">
        <div className="ss-start-section__head ss-start-section__head--split">
          <div>
            <span>{isZh ? "研究问题" : "Research question"}</span>
            <h2>{isZh ? "按研究问题选择分类" : "Choose a category by question"}</h2>
            <p>
              {isZh
                ? "选择一个最接近你研究问题的分类，再从中挑选一个可直接运行的模板。"
                : "Pick the closest category, then choose a runnable template inside it."}
            </p>
          </div>
        </div>
        <div className="ss-start-category-grid">
          {categories.map((category) => {
            const guide = getCategoryGuide(category.id, locale);
            const isSelected = category.id === effectiveActiveCategory;
            const isRecommended = category.id === recommendedCategory || guide.recommended;
            return (
              <article
                key={category.id}
                className={`ss-start-category-card${isSelected ? " is-selected" : ""}${
                  isRecommended ? " is-recommended" : ""
                }`}
              >
                <div className="ss-start-category-card__heading">
                  <div>
                    <span className="ss-start-category-card__eyebrow">
                      {isRecommended ? (isZh ? "推荐路径" : "Recommended path") : isZh ? "可选分类" : "Category"}
                    </span>
                    <h3>{getCategoryLabel(category.id)}</h3>
                  </div>
                  {isSelected ? <span className="ss-start-selected-tag">{isZh ? "当前查看" : "Viewing"}</span> : null}
                </div>
                <p className="ss-start-category-card__summary">{guide.explanation}</p>
                <dl className="ss-start-category-card__details">
                  <div>
                    <dt>{isZh ? "适合问题" : "Good for"}</dt>
                    <dd>{joinItems(guide.fit, locale)}</dd>
                  </div>
                  <div>
                    <dt>{isZh ? "示例" : "Examples"}</dt>
                    <dd>{joinItems(guide.examples, locale)}</dd>
                  </div>
                </dl>
                <div className="ss-start-card-tags">
                  <span>{getCategoryTemplateCountLabel(category.count, locale)}</span>
                  <span>{guide.difficulty}</span>
                </div>
                <button
                  type="button"
                  className="ss-start-card-button"
                  onClick={() => handleSelectCategory(category.id)}
                >
                  {isZh ? "查看这个分类" : "View this category"}
                  <ArrowRight size={15} />
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section id="ss-step1-template-preview" className="ss-start-section ss-template-preview">
        <div className="ss-start-section__head ss-start-section__head--split">
          <div>
            <span>{isZh ? "模板预览" : "Template preview"}</span>
            <h2>{isZh ? "这个分类下可用的模板" : "Templates in this category"}</h2>
            <p>
              {activeCategoryGuide
                ? isZh
                  ? `${activeCategoryLabel}适合：${joinItems(activeCategoryGuide.fit, locale)}。`
                  : `${activeCategoryLabel} is useful for: ${joinItems(activeCategoryGuide.fit, locale)}.`
                : isZh
                  ? "选择一个分类后，在这里查看可直接运行的模板。"
                  : "Select a category to preview runnable templates here."}
            </p>
          </div>
          <div className="ss-template-preview__count">
            <Layers3 size={16} />
            <span>{getCategoryTemplateCountLabel(activeCategoryScenarios.length, locale)}</span>
          </div>
        </div>

        {activeCategoryScenarios.length > 0 ? (
          <div className="ss-start-template-grid">
            {activeCategoryScenarios.map((scenario) => {
              const templateGuide = getTemplateGuide(scenario, locale);
              const isSelected = selectedScenario?.id === scenario.id;
              const isRecommended = recommendedScenario?.id === scenario.id;
              return (
                <article
                  key={scenario.id}
                  className={`ss-start-template-card${isSelected ? " is-selected" : ""}${
                    isRecommended ? " is-recommended" : ""
                  }`}
                >
                  <div className="ss-start-template-card__heading">
                    <div>
                      {isRecommended ? (
                        <span className="ss-start-badge">{isZh ? "推荐" : "Recommended"}</span>
                      ) : null}
                      <h3>{getScenarioName(scenario)}</h3>
                    </div>
                    {isSelected ? <span className="ss-start-selected-tag">{isZh ? "已选择" : "Selected"}</span> : null}
                  </div>
                  <p className="ss-start-template-card__description">{getScenarioDescription(scenario)}</p>
                  <dl className="ss-start-template-card__details">
                    <div>
                      <dt>{isZh ? "适合研究" : "Best for"}</dt>
                      <dd>{templateGuide.fit}</dd>
                    </div>
                    <div>
                      <dt>{isZh ? "默认包含" : "Includes"}</dt>
                      <dd>{joinItems(templateGuide.includes, locale)}</dd>
                    </div>
                  </dl>
                  <div className="ss-start-card-tags">
                    <span>{templateGuide.difficulty}</span>
                    <span>{templateGuide.readiness}</span>
                    <span>
                      {isZh
                        ? `${getScenarioActionCount(scenario)} 个行动`
                        : `${getScenarioActionCount(scenario)} action${getScenarioActionCount(scenario) === 1 ? "" : "s"}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="ss-start-template-card__button"
                    onClick={() => handleSelectScenario(scenario)}
                  >
                    {isSelected ? (isZh ? "已选择这个模板" : "Template selected") : isZh ? "选择这个模板" : "Select this template"}
                    <ArrowRight size={15} />
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="ss-start-empty">
            <h3>{isZh ? "这个分类暂时没有可用模板" : "No templates in this category yet"}</h3>
            <p>
              {isZh
                ? "你仍然可以从推荐模板开始，或创建一个空白实验后手动配置。"
                : "You can still use the recommended template or start blank and configure it yourself."}
            </p>
            <PrimaryGradientButton onClick={handleUseRecommended} disabled={!recommendedScenario}>
              {isZh ? "使用推荐模板" : "Use recommended template"}
              <ArrowRight size={16} />
            </PrimaryGradientButton>
          </div>
        )}
      </section>
    </div>
  );
};
