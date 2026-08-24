import type { ReactNode } from 'react';
export interface Segment<T extends string | number> {
  readonly id: T;
  readonly label: ReactNode;
  readonly disabled?: boolean;
}
export interface SegmentedOption<T extends string | number> {
  readonly value: T;
  readonly label: string;
}
export function SegmentedControl<T extends string | number>({
  label,
  segments,
  options,
  value,
  onChange,
}: {
  readonly label?: ReactNode;
  readonly segments?: readonly Segment<T>[];
  readonly options?: readonly SegmentedOption<T>[];
  readonly value: T;
  readonly onChange: (v: T) => void;
}) {
  const items: readonly Segment<T>[] = segments ?? (options ?? []).map((o) => ({ id: o.value, label: o.label }));
  return (
    <fieldset>
      {label !== undefined && <legend>{label}</legend>}
      {items.map((s) => (
        <button
          className="rw-button"
          type="button"
          key={String(s.id)}
          aria-pressed={s.id === value}
          disabled={s.disabled}
          onClick={() => { onChange(s.id); }}
        >
          {s.label}
        </button>
      ))}
    </fieldset>
  );
}
