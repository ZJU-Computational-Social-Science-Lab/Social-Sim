import React from "react";
import { CheckCircle2, Circle } from "lucide-react";

interface ValidationChecklistCardProps {
  title: string;
  description: string;
  complete?: boolean;
}

export const ValidationChecklistCard: React.FC<ValidationChecklistCardProps> = ({
  title,
  description,
  complete = false,
}) => (
  <article className={`ss-validation-card ${complete ? "is-complete" : ""}`.trim()}>
    <div className="ss-validation-card__icon">
      {complete ? <CheckCircle2 size={18} /> : <Circle size={18} />}
    </div>
    <div className="ss-validation-card__body">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  </article>
);

export default ValidationChecklistCard;
