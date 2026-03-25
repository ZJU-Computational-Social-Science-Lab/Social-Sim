import React from "react";
import { useTranslation } from "react-i18next";

export interface WorkflowSidebarStep {
  id: number;
  title: string;
  subtitle: string;
  state: "current" | "complete" | "upcoming";
}

interface WorkflowSidebarProps {
  title: string;
  subtitle: string;
  steps: WorkflowSidebarStep[];
  onSelectStep: (id: number) => void;
}

export const WorkflowSidebar: React.FC<WorkflowSidebarProps> = ({
  title,
  subtitle,
  steps,
  onSelectStep,
}) => {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");

  return (
    <aside className="ss-workflow-sidebar">
      <div className="ss-workflow-sidebar__head">
        <div className="ss-workflow-kicker">{isZh ? "研究流程" : "Research Workflow"}</div>
        <h2 className="ss-workflow-sidebar__title">{title}</h2>
        <p className="ss-workflow-sidebar__copy">{subtitle}</p>
      </div>

      <nav className="ss-workflow-sidebar__list" aria-label={title}>
        {steps.map((step) => (
          <button
            key={step.id}
            type="button"
            onClick={() => onSelectStep(step.id)}
            className={`ss-workflow-step ${step.state === "current" ? "is-current" : ""} ${step.state === "complete" ? "is-complete" : ""}`.trim()}
          >
            <span className="ss-workflow-step__index">{String(step.id).padStart(2, "0")}</span>
            <span className="ss-workflow-step__body">
              <strong>{step.title}</strong>
              <span>{step.subtitle}</span>
            </span>
          </button>
        ))}
      </nav>
    </aside>
  );
};

export default WorkflowSidebar;
