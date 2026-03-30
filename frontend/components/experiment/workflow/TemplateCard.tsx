import React from "react";

interface TemplateCardProps {
  eyebrow: string;
  title: string;
  description?: string;
  meta?: string;
  selected?: boolean;
  selectedLabel?: string;
  onClick?: () => void;
}

export const TemplateCard: React.FC<TemplateCardProps> = ({
  eyebrow,
  title,
  description,
  meta,
  selected = false,
  selectedLabel,
  onClick,
}) => {
  const content = (
    <>
      <div className="ss-template-card__topline">
        <div className="ss-template-card__eyebrow">{eyebrow}</div>
        {selected && selectedLabel ? (
          <div className="ss-template-card__selected-label">{selectedLabel}</div>
        ) : null}
      </div>
      <h3 className="ss-template-card__title">{title}</h3>
      {description ? <p className="ss-template-card__copy">{description}</p> : null}
      {meta ? <div className="ss-template-card__meta">{meta}</div> : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`ss-template-card ${selected ? "is-selected" : ""}`.trim()}
      >
        {content}
      </button>
    );
  }

  return <article className={`ss-template-card ${selected ? "is-selected" : ""}`.trim()}>{content}</article>;
};

export default TemplateCard;
