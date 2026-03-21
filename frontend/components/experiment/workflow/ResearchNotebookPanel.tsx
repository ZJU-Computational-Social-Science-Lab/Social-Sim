import React from "react";

export interface NotebookSection {
  title: string;
  items: string[];
}

export interface NotebookTask {
  id: string;
  label: string;
  helper?: string;
  done: boolean;
  onClick?: () => void;
}

export interface NotebookTip {
  title: string;
  body: string;
}

export interface NotebookProgress {
  stepLabel: string;
  completionLabel: string;
}

interface ResearchNotebookPanelProps {
  title: string;
  subtitle: string;
  status: string;
  sections: NotebookSection[];
  progress?: NotebookProgress;
  tasks?: NotebookTask[];
  tasksTitle?: string;
  summaryCards?: React.ReactNode;
  tip?: NotebookTip | null;
}

export const ResearchNotebookPanel: React.FC<ResearchNotebookPanelProps> = ({
  title,
  subtitle,
  status,
  sections,
  progress,
  tasks,
  tasksTitle,
  summaryCards,
  tip,
}) => (
  <aside className="ss-research-notebook">
    <header className="ss-research-notebook__head">
      <div className="ss-workflow-kicker">Research Notebook</div>
      <h2 className="ss-research-notebook__title">{title}</h2>
      <p className="ss-research-notebook__copy">{subtitle}</p>
      <div className="ss-research-notebook__status">{status}</div>
    </header>

    {progress ? (
      <section className="ss-research-notebook__progress">
        <div className="ss-research-notebook__progress-row">
          <span>{progress.stepLabel}</span>
          <strong>{progress.completionLabel}</strong>
        </div>
      </section>
    ) : null}

    {tasks && tasks.length > 0 ? (
      <section className="ss-research-notebook__tasks">
        <h3>{tasksTitle || "Tasks"}</h3>
        <div className="ss-research-notebook__task-list">
          {tasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={task.onClick}
              className={`ss-research-notebook__task${task.done ? " is-done" : ""}`.trim()}
            >
              <span className="ss-research-notebook__task-check" aria-hidden="true">
                {task.done ? "✓" : ""}
              </span>
              <span className="ss-research-notebook__task-copy">
                <strong>{task.label}</strong>
                {task.helper ? <small>{task.helper}</small> : null}
              </span>
            </button>
          ))}
        </div>
      </section>
    ) : null}

    {summaryCards ? <div className="ss-research-notebook__summary">{summaryCards}</div> : null}

    <div className="ss-research-notebook__sections">
      {sections.map((section) => (
        <section key={section.title} className="ss-research-notebook__section">
          <h3>{section.title}</h3>
          <ul>
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>

    {tip ? (
      <section className="ss-research-notebook__tip">
        <h3>{tip.title}</h3>
        <p>{tip.body}</p>
      </section>
    ) : null}
  </aside>
);

export default ResearchNotebookPanel;
