'use client';

interface SingleProps<T extends string> {
  name?: string;
  options: Array<T | { value: T; label: string }>;
  value: T | '';
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}

const BTN_STYLE = (active: boolean, h: number): React.CSSProperties => ({
  height: h,
  padding: '0 10px',
  fontFamily: 'inherit',
  border: `1px solid ${active ? 'var(--c-border-strong)' : 'var(--c-border)'}`,
  borderRadius: 2,
  background: active ? 'var(--c-bg-active)' : 'var(--c-surface)',
  color: active ? 'var(--c-text)' : 'var(--c-text-muted)',
  fontWeight: active ? 600 : 400,
  cursor: 'pointer',
  letterSpacing: '-0.02em',
  transition: 'background 100ms, border-color 100ms, color 100ms',
});

/**
 * 단일 선택 버튼 그룹 — radio 대체.
 */
export function BtnGroup<T extends string>({ name, options, value, onChange, size = 'md' }: SingleProps<T>) {
  const h = size === 'sm' ? 24 : 28;
  return (
    <div role="radiogroup" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {options.map((opt) => {
        const v = typeof opt === 'string' ? opt : opt.value;
        const l = typeof opt === 'string' ? opt : opt.label;
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(v)}
            className="text-base"
            style={BTN_STYLE(active, h)}
          >
            {l}
          </button>
        );
      })}
      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
}

interface MultiProps {
  options: Array<string | { value: string; label: string }>;
  values: Record<string, boolean>;
  onChange: (values: Record<string, boolean>) => void;
  size?: 'sm' | 'md';
}

/**
 * 복수 선택 버튼 그룹 — checkbox 대체. 동일한 버튼 스타일.
 */
export function BtnGroupMulti({ options, values, onChange, size = 'md' }: MultiProps) {
  const h = size === 'sm' ? 24 : 28;
  const toggle = (key: string) => {
    onChange({ ...values, [key]: !values[key] });
  };
  return (
    <div role="group" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {options.map((opt) => {
        const v = typeof opt === 'string' ? opt : opt.value;
        const l = typeof opt === 'string' ? opt : opt.label;
        const active = !!values[v];
        return (
          <button
            key={v}
            type="button"
            role="checkbox"
            aria-checked={active}
            onClick={() => toggle(v)}
            className="text-base"
            style={BTN_STYLE(active, h)}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}
