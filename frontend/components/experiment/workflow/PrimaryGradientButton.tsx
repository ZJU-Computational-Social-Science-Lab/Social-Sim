import React from "react";

type PrimaryGradientButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: React.ReactNode;
};

export const PrimaryGradientButton: React.FC<PrimaryGradientButtonProps> = ({
  children,
  icon,
  className = "",
  ...props
}) => (
  <button
    {...props}
    className={`ss-workflow-button ss-workflow-button--primary ${className}`.trim()}
  >
    <span>{children}</span>
    {icon ? <span className="ss-workflow-button__icon">{icon}</span> : null}
  </button>
);

export default PrimaryGradientButton;
