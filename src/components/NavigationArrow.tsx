interface NavigationArrowProps {
  direction: 'left' | 'right';
  onClick: () => void;
  disabled: boolean;
  ariaLabel: string;
}

export function NavigationArrow({
  direction,
  onClick,
  disabled,
  ariaLabel
}: NavigationArrowProps) {
  return (
    <button
      className={`navigation-arrow navigation-arrow--${direction}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      type="button"
    >
      {direction === 'left' ? '←' : '→'}
    </button>
  );
}
