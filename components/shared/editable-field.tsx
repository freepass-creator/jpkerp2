'use client';

import { useRef } from 'react';
import { useAutoSave, type SaveState } from '@/lib/hooks/useAutoSave';
import { cn } from '@/lib/utils';

interface EditableFieldProps {
  label?: string;
  value: string;
  onSave: (v: string) => Promise<void>;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  inputClassName?: string;
  type?: 'text' | 'number' | 'date' | 'tel';
  numeric?: boolean;
}

/**
 * 저장 버튼 없는 필드 — 클릭→편집→blur 자동 저장.
 * 저장 중/완료/실패를 오른쪽 아이콘으로 표시.
 */
export function EditableField({
  label,
  value,
  onSave,
  placeholder,
  readOnly,
  className,
  inputClassName,
  type = 'text',
  numeric = false,
}: EditableFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { value: v, setValue, state, commitNow } = useAutoSave({
    initial: value,
    save: onSave,
    label,
    enabled: !readOnly,
  });

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && <label className="text-xs text-text-muted">{label}</label>}
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type={type}
          value={v}
          placeholder={placeholder}
          readOnly={readOnly}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commitNow}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              setValue(value);
              e.currentTarget.blur();
            }
          }}
          className={cn(
            'input',
            readOnly && 'bg-bg-sub cursor-default',
            numeric && 'text-right num',
            inputClassName,
          )}
          style={{ height: 26 }}
        />
        <StateIndicator state={state} />
      </div>
    </div>
  );
}

function StateIndicator({ state }: { state: SaveState }) {
  if (state === 'saving')
    return (
      <i
        className="ph ph-spinner absolute right-2 text-text-muted spin text-xs"
      />
    );
  if (state === 'saved')
    return (
      <i
        className="ph ph-check absolute right-2 text-success text-xs"
      />
    );
  if (state === 'error')
    return (
      <i
        className="ph ph-warning-circle absolute right-2 text-danger text-xs"
      />
    );
  return null;
}
