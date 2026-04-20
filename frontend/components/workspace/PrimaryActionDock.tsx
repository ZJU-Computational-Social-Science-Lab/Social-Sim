import React from "react";
import { ArrowUpLeft, GitCompareArrows, GitFork, Play, Rows3 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PrimaryActionDockProps {
  isGenerating: boolean;
  isCompareMode: boolean;
  canReturnToParent: boolean;
  disableContinue: boolean;
  disableCreateBranch: boolean;
  onContinue: () => void;
  onCreateBranch: () => void;
  onViewDetails: () => void;
  onReturnToParent: () => void;
  onToggleCompare: () => void;
}

export const PrimaryActionDock: React.FC<PrimaryActionDockProps> = ({
  isGenerating,
  isCompareMode,
  canReturnToParent,
  disableContinue,
  disableCreateBranch,
  onContinue,
  onCreateBranch,
  onViewDetails,
  onReturnToParent,
  onToggleCompare,
}) => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");

  return (
    <section className="ss-primary-dock">
      <div className="ss-primary-dock__content">
        <div className="ss-primary-dock__copy">
          <div className="ss-kicker">{isZh ? "主操作区" : "Primary actions"}</div>
          <h2>{isZh ? "继续推进实验" : "Continue the experiment"}</h2>
          <p>
            {isZh
              ? "主线只保留推进，分支、详情与对比保持次级。"
              : "Keep advancing as the primary action while branch, details, and compare stay secondary."}
          </p>
        </div>

        <button type="button" onClick={onContinue} className="ss-primary-dock__cta" disabled={disableContinue}>
          <Play size={20} />
          <span>{isGenerating ? t("simulationWorkspace.running") : t("controlRoom.continueSimulation")}</span>
        </button>
      </div>

      <div className="ss-primary-dock__secondary">
        <button type="button" onClick={onCreateBranch} className="ss-button-secondary" disabled={disableCreateBranch}>
          <GitFork size={15} />
          {t("controlRoom.createBranchPrimary")}
        </button>
        <button type="button" onClick={onViewDetails} className="ss-button-secondary">
          <Rows3 size={15} />
          {t("controlRoom.viewDetails")}
        </button>
        <button
          type="button"
          onClick={onReturnToParent}
          className="ss-button-secondary"
          disabled={!canReturnToParent}
        >
          <ArrowUpLeft size={15} />
          {t("controlRoom.returnToParentBranch")}
        </button>
        <button type="button" onClick={onToggleCompare} className="ss-button-secondary">
          <GitCompareArrows size={15} />
          {isCompareMode ? t("simulationWorkspace.compareExit") : t("simulationWorkspace.compare")}
        </button>
      </div>
    </section>
  );
};

export default PrimaryActionDock;
