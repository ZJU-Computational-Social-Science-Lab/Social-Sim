import React from "react";

export interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = "",
}) => {
  return <div className={`card ${className}`.trim()}>{children}</div>;
};

export interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  children,
  className = "",
}) => {
  return (
    <div
      className={`flex items-start justify-between gap-4 border-b border-[var(--sim-border)] pb-4 ${className}`.trim()}
    >
      {children}
    </div>
  );
};

export interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export const CardContent: React.FC<CardContentProps> = ({
  children,
  className = "",
}) => {
  return <div className={`flex flex-col gap-4 ${className}`.trim()}>{children}</div>;
};

export interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
}

export const CardTitle: React.FC<CardTitleProps> = ({
  children,
  className = "",
}) => {
  return (
    <h3
      className={`font-[var(--sim-font-display)] text-[1.05rem] font-bold text-[var(--sim-text-strong)] ${className}`.trim()}
    >
      {children}
    </h3>
  );
};

export default Card;
