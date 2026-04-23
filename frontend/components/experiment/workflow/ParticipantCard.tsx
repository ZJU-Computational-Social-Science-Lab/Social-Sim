import React from "react";

interface ParticipantCardProps {
  title: string;
  tag?: string;
  description?: string;
  meta?: string[];
  selected?: boolean;
  onClick?: () => void;
}

export const ParticipantCard: React.FC<ParticipantCardProps> = ({
  title,
  tag,
  description,
  meta = [],
  selected = false,
  onClick,
}) => {
  const body = (
    <>
      <div className="ss-participant-card__top">
        <div>
          <h3 className="ss-participant-card__title">{title}</h3>
          {description ? <p className="ss-participant-card__copy">{description}</p> : null}
        </div>
        {tag ? <span className="ss-participant-card__tag">{tag}</span> : null}
      </div>
      {meta.length > 0 ? (
        <div className="ss-participant-card__meta">
          {meta.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`ss-participant-card ${selected ? "is-selected" : ""}`.trim()}
      >
        {body}
      </button>
    );
  }

  return <article className={`ss-participant-card ${selected ? "is-selected" : ""}`.trim()}>{body}</article>;
};

export default ParticipantCard;
