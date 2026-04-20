import React from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface GuidePopoverTask {
  label: string;
  done?: boolean;
}

interface GuidePopoverAction {
  label: string;
  onClick: () => void;
  tone?: "primary" | "secondary";
}

interface GuidePopoverProps {
  stepLabel: string;
  title: string;
  goal: string;
  tasks: GuidePopoverTask[];
  actions?: GuidePopoverAction[];
  onClose: () => void;
}

export const GuidePopover: React.FC<GuidePopoverProps> = ({
  stepLabel,
  title,
  goal,
  tasks,
  actions,
  onClose,
}) => {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");

  return (
    <section
      className="ss-guide-popover"
      aria-label={isZh ? "流程引导面板" : "Workflow guide panel"}
    >
      <div className="ss-guide-popover__head">
        <div>
          <div className="ss-workflow-kicker">{stepLabel}</div>
          <h3 className="ss-guide-popover__title">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ss-guide-popover__close"
          aria-label={isZh ? "关闭流程引导" : "Close workflow guide"}
        >
          <X size={16} />
        </button>
      </div>

      <section className="ss-guide-popover__section">
        <h4>{isZh ? "本步目标" : "Current goal"}</h4>
        <p>{goal}</p>
      </section>

      <section className="ss-guide-popover__section">
        <h4>{isZh ? "本步需完成" : "This step"}</h4>
        <ul className="ss-guide-popover__tasks">
          {tasks.map((task) => (
            <li key={task.label} className={task.done ? "is-done" : ""}>
              <span className="ss-guide-popover__task-check" aria-hidden="true">
                {task.done ? "✓" : ""}
              </span>
              <span>{task.label}</span>
            </li>
          ))}
        </ul>
      </section>

      {actions && actions.length > 0 ? (
        <div className="ss-guide-popover__action-row">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className={`ss-workflow-button ${
                action.tone === "secondary"
                  ? "ss-workflow-button--secondary"
                  : "ss-workflow-button--primary"
              } ss-guide-popover__action`.trim()}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
};

export default GuidePopover;
