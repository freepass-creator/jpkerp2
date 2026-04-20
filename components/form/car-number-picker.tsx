'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRtdbCollection } from '@/lib/collections/rtdb';
import { sanitizeCarNumber } from '@/lib/format-input';
import { isActiveContractStatus } from '@/lib/data/contract-status';
import type { RtdbAsset, RtdbContract } from '@/lib/types/rtdb-entities';

interface Props {
  value: string;
  /** 변경 콜백 — sanitize된 값과 매칭된 자산(없으면 null) */
  onChange: (value: string, asset: RtdbAsset | null) => void;
  name?: string;
  required?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  /** 매칭 결과 dropdown 상한 */
  limit?: number;
  /** 없을 때 새 차량 등록 링크 표시 */
  showCreate?: boolean;
  /** 추가 filter (예: 회원사별 차량만) */
  filter?: (asset: RtdbAsset) => boolean;
}

/**
 * 차량번호 입력 전용 통일 위젯.
 *   - sanitizeCarNumber 자동
 *   - assets 자동완성 (차량번호·모델·제조사 검색)
 *   - 3컬럼 드롭다운: 차량번호 / 모델 / 계약자 or 상태(휴차·상품)
 *   - 매칭 없으면 "➕ 새 차량 등록" 링크
 *   - 키보드 ↑↓ Enter Esc
 */
export function CarNumberPicker({
  value,
  onChange,
  name,
  required,
  autoFocus,
  placeholder = '예: 98고1234',
  limit = 10,
  showCreate = true,
  filter,
}: Props) {
  const { data: assets } = useRtdbCollection<RtdbAsset>('assets');
  const { data: contracts } = useRtdbCollection<RtdbContract>('contracts');
  const [open, setOpen] = useState(false);
  const [hoverIdx, setHoverIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // car_number → 활성 계약자 이름 맵
  const contractByCar = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of contracts) {
      if ((c as { status?: string }).status === 'deleted') continue;
      if (!isActiveContractStatus(c.contract_status)) continue;
      if (!c.car_number || !c.contractor_name?.trim()) continue;
      if (!m.has(c.car_number)) m.set(c.car_number, c.contractor_name);
    }
    return m;
  }, [contracts]);

  const filtered = useMemo(() => {
    const q = String(value ?? '').trim().toLowerCase();
    // 빈 입력엔 드롭다운 안 띄움 (타이핑 시작할 때만 자동완성)
    if (!q) return [];
    const base = assets.filter((a) => {
      if ((a as { status?: string }).status === 'deleted') return false;
      if (filter && !filter(a)) return false;
      return true;
    });
    // 정확 일치면 드롭다운 숨김 (이미 선택됨)
    const exact = base.some((a) => String(a.car_number ?? '').toLowerCase() === q);
    if (exact) return [];
    return base
      .filter((a) => {
        const cn = String(a.car_number ?? '').toLowerCase();
        const mk = String(a.manufacturer ?? '').toLowerCase();
        const md = String(a.car_model ?? '').toLowerCase();
        return cn.includes(q) || mk.includes(q) || md.includes(q);
      })
      .slice(0, limit);
  }, [assets, value, filter, limit]);

  useEffect(() => { setHoverIdx(0); }, [value]);

  const select = (a: RtdbAsset) => {
    onChange(a.car_number ?? '', a);
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || filtered.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHoverIdx((i) => Math.min(filtered.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHoverIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); select(filtered[hoverIdx]); }
    else if (e.key === 'Escape') { setOpen(false); }
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

  const statusLabel = (a: RtdbAsset) => {
    const contractor = contractByCar.get(a.car_number ?? '');
    if (contractor) return { text: contractor, color: 'var(--c-primary)' };
    const s = (a as { asset_status?: string }).asset_status;
    if (s === '매각' || (a as { disposed_at?: number }).disposed_at) return { text: '처분', color: 'var(--c-danger)' };
    if ((a as { status?: string }).status === 'product') return { text: '상품', color: 'var(--c-warn)' };
    return { text: '휴차', color: 'var(--c-text-muted)' };
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
          const v = sanitizeCarNumber(e.target.value);
          onChange(v, null);
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
          {filtered.map((a, i) => {
            const st = statusLabel(a);
            const model = a.car_model || a.manufacturer || '';
            return (
              <div
                key={a._key ?? i}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHoverIdx(i)}
                onClick={() => select(a)}
                className="text-base" style={{ padding: '6px 10px', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 8, cursor: 'pointer', background: i === hoverIdx ? 'var(--c-bg-hover)' : 'transparent', borderBottom: '1px solid var(--c-border)', alignItems: 'center' }}
              >
                <span className="text-text" style={{ fontWeight: 600 }}>
                  {renderMarked(String(a.car_number ?? ''))}
                </span>
                <span
                  title={model}
                  className="text-text-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {model}
                </span>
                <span
                  style={{
                    color: st.color,
                    textAlign: 'right',
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {st.text}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {showEmpty && showCreate && (
        <div
          className="text-base text-text-muted" style={{ position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 20, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 2, padding: '8px 10px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
          onMouseDown={(e) => e.preventDefault()}
        >
          매칭 없음 —{' '}
          <Link
            href="/input?type=asset"
            target="_blank"
            className="text-primary" style={{ fontWeight: 600 }}
          >
            <i className="ph ph-plus" style={{ marginRight: 4 }} />새 차량 등록
          </Link>
        </div>
      )}
    </div>
  );
}
