interface NavigationArrowProps {
  direction: 'left' | 'right';
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
  className
}: NavigationArrowProps) {
  return (
    <button
      className={`navigation-arrow navigation-arrow--${direction}${className ? ` ${className}` : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      type="button"
    >
      {direction === 'left' ? '←' : '→'}
    </button>
  );
}
