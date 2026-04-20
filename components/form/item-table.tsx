'use client';

import { useEffect, useMemo, useState } from 'react';
import { useItemFavs } from '@/lib/hooks/useOpPrefs';

export interface ItemRow {
  id: string;
  item: string;
  vendor?: string;
  amount: number;
}

interface Col {
  key: 'item' | 'vendor' | 'amount';
  label: string;
  width?: number;
}

interface Props {
  title: string;
  icon?: string; // phosphor class
  columns: Col[];
  rows: ItemRow[];
  onChange: (rows: ItemRow[]) => void;
  /** item column 기본 추천 목록 (프로젝트 상수) */
  itemSuggestions?: string[];
  /** vendor column datalist */
  vendorSuggestions?: string[];
  /** 사용자 즐겨찾기 저장 키 (지정 시 기본 + 저장분 chip 표시) */
  favKey?: string;
}

let _rowId = 0;
function newRow(item = ''): ItemRow {
  _rowId++;
  return { id: `r${Date.now()}_${_rowId}`, item, vendor: '', amount: 0 };
}

/**
 * 정비·상품화용 항목 테이블.
 * - + 항목 추가 / 삭제 / 자동합계
 * - 빈 상태 박스 클릭 = 행 추가
 * - favKey 지정 시 즐겨찾기 chip 표시 (클릭=행 추가, ✕=즐겨찾기 해제)
 */
export function ItemTable({ title, icon, columns, rows, onChange, itemSuggestions, vendorSuggestions, favKey }: Props) {
  const [local, setLocal] = useState<ItemRow[]>(rows);
  const favs = useItemFavs(favKey ?? '_disabled');

  useEffect(() => setLocal(rows), [rows]);

  const itemListId = useMemo(() => `il_${title.replace(/[^a-z0-9]/gi, '_')}_${Math.random().toString(36).slice(2, 6)}`, [title]);
  const vendorListId = useMemo(() => `vl_${title.replace(/[^a-z0-9]/gi, '_')}_${Math.random().toString(36).slice(2, 6)}`, [title]);

  function push(next: ItemRow[]) {
    setLocal(next);
    onChange(next);
  }
  function add(prefill = '') { push([...local, newRow(prefill)]); }
  function remove(id: string) { push(local.filter((r) => r.id !== id)); }
  function update(id: string, patch: Partial<ItemRow>) {
    push(local.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  const total = local.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const hasVendor = columns.some((c) => c.key === 'vendor');

  // 기본 + 사용자 즐겨찾기 병합 (중복 제거, 사용자 순서 우선)
  const chips = useMemo(() => {
    const defaults = itemSuggestions ?? [];
    const merged = [...favs.list, ...defaults.filter((d) => !favs.list.includes(d))];
    return merged;
  }, [favs.list, itemSuggestions]);

  const isUserFav = (name: string) => favs.list.includes(name);

  return (
    <div className="form-section">
      <div className="form-section-title">
        {icon && <i className={`ph ${icon}`} />}
        {title}
        <span className="text-text-muted text-2xs" style={{ marginLeft: 6, fontWeight: 500 }}>
          {local.length > 0 && `${local.length}건 · ${total.toLocaleString()}원`}
        </span>
        <button
          type="button"
          onClick={() => add()}
          className="btn btn-sm btn-ghost"
          style={{ marginLeft: 'auto' }}
        >
          <i className="ph ph-plus" />
          항목 추가
        </button>
      </div>

      {/* 즐겨찾기 chip 바 */}
      {favKey && chips.length > 0 && (
        <div className="loc-favs" style={{ marginBottom: 8 }}>
          {chips.map((name) => (
            <span
              key={name}
              className="loc-fav-btn"
              onClick={(e) => {
                if ((e.target as HTMLElement).classList.contains('loc-fav-del')) return;
                add(name);
              }}
            >
              {name}
              {isUserFav(name) && (
                <button
                  type="button"
                  className="loc-fav-del"
                  aria-label="즐겨찾기 해제"
                  onClick={(e) => { e.stopPropagation(); favs.remove(name); }}
                >
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {local.length === 0 ? (
        <button
          type="button"
          onClick={() => add()}
          className="text-text-muted text-xs text-text-muted" style={{ width: '100%', padding: '16px', textAlign: 'center', border: '1px dashed var(--c-border)', borderRadius: 2, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', transition: 'background var(--t-fast), color var(--t-fast), border-color var(--t-fast)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--c-bg-hover)';
            e.currentTarget.style.borderColor = 'var(--c-border-strong)';
            e.currentTarget.style.color = 'var(--c-text-sub)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'var(--c-border)';
            e.currentTarget.style.color = 'var(--c-text-muted)';
          }}
        >
          + 클릭하여 항목 추가
        </button>
      ) : (
        <table className="jpk-item-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={{ width: c.width }}>
                  {c.label}
                </th>
              ))}
              {favKey && <th style={{ width: 24 }} />}
              <th style={{ width: 32 }} />
            </tr>
          </thead>
          <tbody>
            {local.map((r) => (
              <tr key={r.id}>
                {columns.map((c) => (
                  <td key={c.key}>
                    {c.key === 'item' && (
                      <input
                        type="text"
                        value={r.item}
                        onChange={(e) => update(r.id, { item: e.target.value })}
                        placeholder="항목"
                        list={itemSuggestions ? itemListId : undefined}
                      />
                    )}
                    {c.key === 'vendor' && (
                      <input
                        type="text"
                        value={r.vendor ?? ''}
                        onChange={(e) => update(r.id, { vendor: e.target.value })}
                        placeholder="업체"
                        list={vendorSuggestions ? vendorListId : undefined}
                      />
                    )}
                    {c.key === 'amount' && (
                      <input
                        type="text"
                        inputMode="numeric"
                        value={r.amount ? r.amount.toLocaleString() : ''}
                        onChange={(e) => {
                          const n = Number(String(e.target.value).replace(/,/g, ''));
                          update(r.id, { amount: Number.isFinite(n) ? n : 0 });
                        }}
                        placeholder="0"
                        style={{ textAlign: 'right' }}
                      />
                    )}
                  </td>
                ))}
                {favKey && (
                  <td>
                    <button
                      type="button"
                      onClick={() => r.item.trim() && favs.add(r.item.trim())}
                      aria-label="즐겨찾기 등록"
                      title="즐겨찾기 등록"
                      disabled={!r.item.trim() || isUserFav(r.item.trim())}
                      className="jpk-item-star"
                    >
                      <i className={`ph ${isUserFav(r.item.trim()) ? 'ph-star-fill' : 'ph-star'}`} />
                    </button>
                  </td>
                )}
                <td>
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    aria-label="삭제"
                    className="jpk-item-del"
                  >
                    <i className="ph ph-x" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {itemSuggestions && (
        <datalist id={itemListId}>
          {itemSuggestions.map((s) => <option key={s} value={s} />)}
        </datalist>
      )}
      {hasVendor && vendorSuggestions && (
        <datalist id={vendorListId}>
          {vendorSuggestions.map((s) => <option key={s} value={s} />)}
        </datalist>
      )}
    </div>
  );
}
