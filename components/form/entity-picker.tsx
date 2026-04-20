'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRtdbCollection, type DbApp } from '@/lib/collections/rtdb';

export interface PickerRecord extends Record<string, unknown> {
  _key?: string;
}

interface Props<T extends PickerRecord> {
  /** RTDB collection path (예: 'assets', 'partners', 'customers') */
  collection: string;
  /** 어느 DB? 기본 main(jpkerp). 공유 마스터는 'freepass'(freepasserp3). */
  app?: DbApp;
  /** 현재 값 (= primary field의 문자열) */
  value: string;
  /** 변경 콜백. record는 선택된 row 전체 — 자동채움에 씀 */
  onChange: (value: string, record: T | null) => void;
  /** 입력·표시 기본 필드 (예: 'car_number', 'partner_code', 'name') */
  primaryField: keyof T & string;
  /** 보조 표시 필드 (dropdown 우측 · 연락처·모델 등) */
  secondaryField?: keyof T & string;
  /** 보조2 표시 필드 (dropdown 맨 오른쪽) */
  tertiaryField?: keyof T & string;
  /** 검색 대상 필드들 (primary 포함) */
  searchFields?: Array<keyof T & string>;
  /** placeholder */
  placeholder?: string;
  /** HTML input name — 폼 submit에 포함 */
  name?: string;
  /** required */
  required?: boolean;
  autoFocus?: boolean;
  /** 자동완성 최대 표시 */
  limit?: number;
  /** 없을 때 인라인 생성 링크 — /input?type=xxx */
  createHref?: string;
  createLabel?: string;
  /** status='deleted' 레코드 제외 (기본 true) */
  excludeDeleted?: boolean;
  /** 추가 filter (예: partner_code 일치 차량만) */
  filter?: (record: T) => boolean;
}

export function EntityPicker<T extends PickerRecord>({
  collection,
  app,
  value,
  onChange,
  primaryField,
  secondaryField,
  tertiaryField,
  searchFields,
  placeholder,
  name,
  required,
  autoFocus,
  limit = 10,
  createHref,
  createLabel = '새로 등록',
  excludeDeleted = true,
  filter,
}: Props<T>) {
  const { data } = useRtdbCollection<T>(collection, { app });
  const [open, setOpen] = useState(false);
  const [hoverIdx, setHoverIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const fields = useMemo(
    () => (searchFields && searchFields.length ? searchFields : [primaryField]),
    [searchFields, primaryField],
  );

  const filtered = useMemo(() => {
    const q = String(value ?? '').trim().toLowerCase();
    const base = data.filter((r) => {
      if (excludeDeleted && (r as { status?: string }).status === 'deleted') return false;
      if (filter && !filter(r)) return false;
      return true;
    });
    // 정확히 일치하는 값이 있으면 드롭다운 안 띄움 (이미 선택됨)
    const exactMatch = q && base.some((r) => String(r[primaryField] ?? '').toLowerCase() === q);
    if (exactMatch) return [];
    if (!q) return base.slice(0, limit);
    return base
      .filter((r) => fields.some((f) => String(r[f] ?? '').toLowerCase().includes(q)))
      .slice(0, limit);
  }, [data, value, fields, primaryField, excludeDeleted, filter, limit]);

  useEffect(() => { setHoverIdx(0); }, [value]);

  const select = (rec: T) => {
    onChange(String(rec[primaryField] ?? ''), rec);
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHoverIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHoverIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(filtered[hoverIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const renderMarked = (s: string) => {
    const q = String(value ?? '').trim();
    if (!q) return s;
    const idx = s.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return s;
    return (
      <>
        {s.slice(0, idx)}
        <mark className="text-primary" style={{ background: 'var(--c-primary-bg)', padding: 0 }}>
          {s.slice(idx, idx + q.length)}
        </mark>
        {s.slice(idx + q.length)}
      </>
    );
  };

  const showEmpty = open && value.trim().length > 0 && filtered.length === 0;

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        name={name}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value, null);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 2px)',
            left: 0,
            right: 0,
            zIndex: 20,
            background: 'var(--c-surface)',
            border: '1px solid var(--c-border)',
            borderRadius: 2,
            maxHeight: 260,
            overflow: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}
        >
          {filtered.map((r, i) => (
            <div
              key={r._key ?? i}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHoverIdx(i)}
              onClick={() => select(r)}
              className="text-base" style={{ padding: '6px 10px', display: 'grid', gridTemplateColumns: secondaryField && tertiaryField ? '1fr 1fr 1fr' : secondaryField ? '1fr 1fr' : '1fr', gap: 8, cursor: 'pointer', background: i === hoverIdx ? 'var(--c-bg-hover)' : 'transparent', borderBottom: '1px solid var(--c-border)' }}
            >
              <span className="text-text" style={{ fontWeight: 600 }}>
                {renderMarked(String(r[primaryField] ?? ''))}
              </span>
              {secondaryField && (
                <span className="text-text-sub">
                  {renderMarked(String(r[secondaryField] ?? '—'))}
                </span>
              )}
              {tertiaryField && (
                <span className="text-text-muted" style={{ textAlign: 'right' }}>
                  {String(r[tertiaryField] ?? '')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {showEmpty && createHref && (
        <div
          className="text-base text-text-muted" style={{ position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 20, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 2, padding: '8px 10px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
          onMouseDown={(e) => e.preventDefault()}
        >
          매칭 없음 —{' '}
          <Link
            href={createHref}
            target="_blank"
            className="text-primary" style={{ fontWeight: 600 }}
          >
            <i className="ph ph-plus" style={{ marginRight: 4 }} />
            {createLabel}
          </Link>
        </div>
      )}
    </div>
  );
}
