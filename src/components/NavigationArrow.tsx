import styles from "./NavigationArrow.module.css";

interface NavigationArrowProps {
  direction: "left" | "right";
  onClick: () => void;
  disabled: boolean;
  ariaLabel: string;
  className?: string;
}

export function NavigationArrow({
  direction,
  onClick,
  disabled,
  ariaLabel,
  className,
}: NavigationArrowProps) {
  return (
    <button
      className={[styles.arrow, className].filter(Boolean).join(" ")}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      type="button"
    >
      {direction === "left" ? "←" : "→"}
    </button>
  );
}
