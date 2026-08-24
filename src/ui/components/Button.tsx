import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { LocalizedText } from '../../locales/LocalizedText.js';
export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>,'children'> {
  readonly labelKey?: string;
  readonly label?: string;
  readonly variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  readonly loading?: boolean;
  readonly icon?: ReactNode;
}
export function Button({ labelKey, label, variant = 'secondary', loading = false, disabled = false, icon, ...props }: ButtonProps) {
  const className = ['rw-button', variant === 'primary' && 'rw-button--primary', variant === 'danger' && 'rw-button--danger'].filter(Boolean).join(' ');
  return (
    <button {...props} className={className} disabled={disabled || loading} aria-busy={loading || undefined}>
      {icon}
      <span>{label ?? (labelKey !== undefined ? <LocalizedText messageKey={labelKey} /> : '')}</span>
      {loading ? <span aria-hidden="true">…</span> : null}
    </button>
  );
}
