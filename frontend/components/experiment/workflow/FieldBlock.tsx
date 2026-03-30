import React from "react";

interface FieldBlockProps {
  label: string;
  helper?: string;
  className?: string;
  children: React.ReactNode;
}

export const FieldBlock: React.FC<FieldBlockProps> = ({
  label,
  helper,
  className = "",
  children,
}) => (
  <section className={`ss-workflow-field ${className}`.trim()}>
    <div className="ss-workflow-field__head">
      <label className="ss-workflow-field__label">{label}</label>
      {helper ? <p className="ss-workflow-field__helper">{helper}</p> : null}
    </div>
    <div className="ss-workflow-field__body">{children}</div>
  </section>
);

export default FieldBlock;
