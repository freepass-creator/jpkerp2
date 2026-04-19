'use client';

interface Props<T extends string> {
  name?: string;
  options: Array<T | { value: T; label: string }>;
  value: T | '';
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}

/**
 * 버튼 그룹 선택 — select 대체. jpkerp .btn-group/.btn-opt 동등.
 * 선택 시 담백하게: 인디고 보더 + 연한 primary 배경 + 진한 글씨.
 */
export function BtnGroup<T extends string>({ name, options, value, onChange, size = 'md' }: Props<T>) {
  const h = size === 'sm' ? 24 : 28;
  return (
    <div role="radiogroup" style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
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
            style={{
              height: h,
              padding: '0 10px',
              fontSize: 12,
              fontFamily: 'inherit',
              border: `1px solid ${active ? 'var(--c-primary)' : 'var(--c-border)'}`,
              borderRadius: 2,
              background: active ? 'var(--c-primary-bg)' : 'var(--c-surface)',
              color: active ? 'var(--c-primary)' : 'var(--c-text-sub)',
              fontWeight: active ? 600 : 500,
              cursor: 'pointer',
              letterSpacing: '-0.02em',
              transition: 'background 100ms, border-color 100ms, color 100ms',
            }}
          >
            {l}
          </button>
        );
      })}
      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
}
