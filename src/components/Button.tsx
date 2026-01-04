import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

type ButtonVariant = "primary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "ghost",
  icon = false,
  children,
  className = "",
  ...props
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    icon && styles.icon,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
