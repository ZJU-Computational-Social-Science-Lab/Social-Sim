/**
 * Button UI Component
 *
 * Reusable button component with variants for different visual styles.
 */

import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'default',
  size = 'md',
  className = '',
  children,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-[0.01em] transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

  const variantClasses = {
    default:
      'bg-slate-900 text-white shadow-[0_16px_40px_rgba(15,23,42,0.16)] hover:-translate-y-0.5 hover:bg-slate-800 focus:ring-slate-400',
    outline:
      'border border-slate-300 bg-white/70 text-slate-700 hover:-translate-y-0.5 hover:bg-white hover:border-slate-400 focus:ring-slate-300',
    ghost:
      'bg-transparent text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 focus:ring-slate-300',
    destructive:
      'bg-rose-700 text-white shadow-[0_14px_32px_rgba(159,18,57,0.18)] hover:-translate-y-0.5 hover:bg-rose-800 focus:ring-rose-300',
  };

  const sizeClasses = {
    sm: 'px-3.5 py-2 text-sm',
    md: 'px-4.5 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
