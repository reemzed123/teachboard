import type { LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: LucideIcon;
  /** הטקסט שמוצג בריחוף ומוקרא לקוראי מסך. */
  label: string;
  /** היכן יופיע ההסבר בריחוף. */
  tooltipSide?: 'below' | 'start' | 'end' | 'above';
  pressed?: boolean;
}

export function IconButton({
  icon: Icon,
  label,
  tooltipSide = 'below',
  pressed,
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={`tb-icon-btn${className ? ` ${className}` : ''}`}
      aria-label={label}
      aria-pressed={pressed}
      data-tooltip={label}
      data-tooltip-side={tooltipSide}
      {...rest}
    >
      <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}
