import React from "react";

type ButtonVariant = "default" | "outline" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  default: "button",
  outline: "button-ghost",
  ghost: "button-ghost bg-transparent border-transparent shadow-none",
  destructive: "button-danger",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "button-sm",
  md: "",
  lg: "min-h-[54px] px-6 text-[1rem] rounded-[18px]",
};

export const Button: React.FC<ButtonProps> = ({
  variant = "default",
  size = "md",
  className = "",
  children,
  type = "button",
  ...props
}) => {
  return (
    <button
      type={type}
      className={`${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
