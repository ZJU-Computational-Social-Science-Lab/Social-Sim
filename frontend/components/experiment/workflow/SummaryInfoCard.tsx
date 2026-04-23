import React from "react";

interface SummaryInfoCardProps {
  label: string;
  value: React.ReactNode;
  helper?: string;
}

export const SummaryInfoCard: React.FC<SummaryInfoCardProps> = ({
  label,
  value,
  helper,
}) => (
  <article className="ss-summary-card">
    <div className="ss-summary-card__label">{label}</div>
    <div className="ss-summary-card__value">{value}</div>
    {helper ? <p className="ss-summary-card__helper">{helper}</p> : null}
  </article>
);

export default SummaryInfoCard;
