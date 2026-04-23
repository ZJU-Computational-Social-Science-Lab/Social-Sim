import React from "react";

interface ResearchInputPanelProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export const ResearchInputPanel: React.FC<ResearchInputPanelProps> = ({
  eyebrow,
  title,
  description,
  actions,
  footer,
  children,
}) => (
  <section className="ss-workflow-panel">
    <header className="ss-workflow-panel__head">
      <div>
        {eyebrow ? <div className="ss-workflow-kicker">{eyebrow}</div> : null}
        <h2 className="ss-workflow-panel__title">{title}</h2>
        {description ? <p className="ss-workflow-panel__copy">{description}</p> : null}
      </div>
      {actions ? <div className="ss-workflow-panel__actions">{actions}</div> : null}
    </header>
    <div className="ss-workflow-panel__body">{children}</div>
    {footer ? <footer className="ss-workflow-panel__footer">{footer}</footer> : null}
  </section>
);

export default ResearchInputPanel;
