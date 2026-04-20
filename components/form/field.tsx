'use client';

import { useRef, useState, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { formatPhone, formatBizRegNo, formatResRegNo, sanitizeCarNumber } from '@/lib/format-input';

interface FieldProps {
  label: string;
  required?: boolean;
  span?: number; // grid col span
  children: React.ReactNode;
  hint?: string;
}

/**
 * jpkerp .field 이식 — `<div class="field [is-required]"><label>{label}</label>{children}</div>`
 * 필수 표시는 label::after ' *' (CSS에서 처리)
 */
export function Field({ label, required, span, children, hint }: FieldProps) {
  const cls = required ? 'field is-required' : 'field';
  return (
    <div className={cls} style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <label>{label}</label>
      {children}
      {hint && <div className="form-hint">{hint}</div>}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" {...props} />;
}

export function NumberInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="text"
      inputMode="numeric"
      {...props}
      className={`num ${props.className ?? ''}`.trim()}
      style={{ textAlign: 'right', ...(props.style ?? {}) }}
    />
  );
}

export function DateInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="date" {...props} />;
}

/**
 * 컴팩트 날짜 입력 — 공간 따라 표시 포맷 가변.
 * - ≥120px: 2026-04-18 (기본 full)
 * - 90~119px: 26-04-18
 * - <90px: 4/18
 * 클릭 시 네이티브 달력 picker 열림 (showPicker API).
 */
export function CompactDateInput({ value, onChange, required, name }: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  name?: string;
}) {
  return (
    <div className="date-compact">
      <input
        type="date"
        value={value}
        required={required}
        name={name}
        onChange={(e) => onChange(e.target.value)}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          opacity: 0, cursor: 'pointer', zIndex: 1,
        }}
      />
      <span className="date-compact-full">{value || '날짜 선택'}</span>
      <span className="date-compact-short">{value ? value.slice(2) : '—'}</span>
      <span className="date-compact-mini">{value ? value.slice(5).replace('-', '/') : '—'}</span>
      <i className="ph ph-calendar-dots" />
    </div>
  );
}

export function Select({
  options,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  options: Array<{ value: string; label: string } | string>;
}) {
  return (
    <select {...props}>
      <option value="">선택</option>
      {options.map((opt) => {
        const v = typeof opt === 'string' ? opt : opt.value;
        const l = typeof opt === 'string' ? opt : opt.label;
        return (
          <option key={v} value={v}>
            {l}
          </option>
        );
      })}
    </select>
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} rows={props.rows ?? 3} />;
}

type FormatProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  value: string;
  onChange: (v: string) => void;
};

/** 전화번호 — 숫자만 입력, 자동 `-` 삽입 */
export function PhoneInput({ value, onChange, ...rest }: FormatProps) {
  return (
    <input
      type="tel"
      inputMode="numeric"
      placeholder="010-0000-0000"
      {...rest}
      value={formatPhone(value)}
      onChange={(e) => onChange(formatPhone(e.target.value))}
    />
  );
}

/** 차량번호 — `\d{2,3}[가-힣]\d{0,4}` 이외 입력 거부 */
export function CarNumberInput({ value, onChange, ...rest }: FormatProps) {
  return (
    <input
      type="text"
      autoComplete="off"
      placeholder="예: 98고1234"
      {...rest}
      value={value}
      onChange={(e) => onChange(sanitizeCarNumber(e.target.value))}
    />
  );
}

/** 사업자등록번호 — 10자리 3-2-5 */
export function BizRegInput({ value, onChange, ...rest }: FormatProps) {
  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="000-00-00000"
      {...rest}
      value={formatBizRegNo(value)}
      onChange={(e) => onChange(formatBizRegNo(e.target.value))}
    />
  );
}

/** 주민등록번호/법인등록번호 — 13자리 6-7 */
export function ResRegInput({ value, onChange, ...rest }: FormatProps) {
  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="000000-0000000"
      {...rest}
      value={formatResRegNo(value)}
      onChange={(e) => onChange(formatResRegNo(e.target.value))}
    />
  );
}
