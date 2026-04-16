/**
 * Card UI Component
 *
 * Reusable card component for containing content with consistent styling.
 */

import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div className={`rounded-lg shadow-sm ${className}`.trim()} style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)' }}>
      {children}
    </div>
  );
};

export interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ children, className = '' }) => {
  return (
    <div className={`px-6 py-4 ${className}`.trim()} style={{ borderBottom: '1px solid var(--ss-border)' }}>
      {children}
    </div>
  );
};

export interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export const CardContent: React.FC<CardContentProps> = ({ children, className = '' }) => {
  return (
    <div className={`p-6 ${className}`.trim()}>
      {children}
    </div>
  );
};

export interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
}

export const CardTitle: React.FC<CardTitleProps> = ({ children, className = '' }) => {
  return (
    <h3 className={`text-lg font-semibold ${className}`.trim()} style={{ color: 'var(--ss-heading)' }}>
      {children}
    </h3>
  );
};

export default Card;
