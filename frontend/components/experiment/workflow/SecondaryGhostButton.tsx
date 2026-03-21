import React from "react";

type SecondaryGhostButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: React.ReactNode;
};

export const SecondaryGhostButton: React.FC<SecondaryGhostButtonProps> = ({
  children,
  icon,
  className = "",
  ...props
}) => (
  <button
    {...props}
    className={`ss-workflow-button ss-workflow-button--ghost ${className}`.trim()}
  >
    {icon ? <span className="ss-workflow-button__icon">{icon}</span> : null}
    <span>{children}</span>
  </button>
);

export default SecondaryGhostButton;
