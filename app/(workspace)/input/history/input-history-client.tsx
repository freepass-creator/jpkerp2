'use client';

import { useEffect, useMemo, useState, type Ref } from 'react';
import { JpkGrid, type JpkGridApi } from '@/components/shared/jpk-grid';
import { typedColumn } from '@/lib/grid/typed-column';
import { fmt } from '@/lib/utils';
import type { ColDef } from 'ag-grid-community';
import type { UploadRow } from './types';
import { useInputHistory } from './use-input-history';

interface Props {
  onSelect: (row: UploadRow | null) => void;
  selectedId?: string;
  gridRef?: React.RefObject<JpkGridApi<UploadRow> | null>;
  onCountChange?: (n: number) => void;
}

function fmtTs(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${String(d.getFullYear()).slice(2)}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function InputHistoryClient({ onSelect, gridRef, onCountChange }: Props) {
  const { data: rows = [], isLoading } = useInputHistory();
  const [filterType, setFilterType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filtered = useMemo(() => {
    let r = rows;
    if (filterType) r = r.filter((x) => x.type === filterType);
    if (dateFrom) {
      const ts = new Date(dateFrom).getTime();
      r = r.filter((x) => (x.uploaded_at ?? 0) >= ts);
    }
    if (dateTo) {
      const ts = new Date(dateTo).getTime() + 86400000;
      r = r.filter((x) => (x.uploaded_at ?? 0) <= ts);
    }
    return r;
  }, [rows, filterType, dateFrom, dateTo]);

  useEffect(() => { onCountChange?.(filtered.length); }, [filtered.length, onCountChange]);

  const cols = useMemo<ColDef<UploadRow>[]>(() => [
    typedColumn('date',   { headerName: '일시', field: 'uploaded_at', width: 120, valueFormatter: (p) => fmtTs(Number(p.value)), sort: 'desc' }),
    typedColumn('select', {
      headerName: '방식', field: 'method_label', width: 65,
      cellStyle: (p: { value: unknown }) => p.value === '대량' ? { color: 'var(--c-primary)', fontWeight: 600 } : { color: 'var(--c-text-muted)' },
    }),
    typedColumn('select', { headerName: '종류', field: 'type_label', width: 85, cellStyle: { fontWeight: 500 } }),
    typedColumn('text',   { headerName: '파일/주소', field: 'filename', flex: 1, minWidth: 180 }),
    typedColumn('number', { headerName: '총', field: 'total', width: 65, valueFormatter: (p) => fmt(Number(p.value ?? 0)) }),
    typedColumn('number', {
      headerName: '신규', field: 'ok', width: 65, valueFormatter: (p) => fmt(Number(p.value ?? 0)),
      cellStyle: (p: { value: unknown }) => {
        const v = Number(p.value) || 0;
        return v > 0 ? { color: 'var(--c-success)', fontWeight: 600 } : { color: 'var(--c-text-muted)' };
      },
    }),
    typedColumn('number', {
      headerName: '중복', field: 'skip', width: 65, valueFormatter: (p) => fmt(Number(p.value ?? 0)),
      cellStyle: (p: { value: unknown }) => {
        const v = Number(p.value) || 0;
        return v > 0 ? { color: 'var(--c-warn)' } : { color: 'var(--c-text-muted)' };
      },
    }),
    typedColumn('number', {
      headerName: '오류', field: 'fail', width: 65, valueFormatter: (p) => fmt(Number(p.value ?? 0)),
      cellStyle: (p: { value: unknown }) => {
        const v = Number(p.value) || 0;
        return v > 0 ? { color: 'var(--c-danger)', fontWeight: 600 } : { color: 'var(--c-text-muted)' };
      },
    }),
    typedColumn('select', {
      headerName: '반영', field: 'committed_label', width: 70,
      cellStyle: (p: { value: unknown }) => {
        if (p.value === '완료') return { color: 'var(--c-success)', fontWeight: 600 };
        if (p.value === '부분') return { color: 'var(--c-warn)', fontWeight: 500 };
        if (p.value === '대기') return { color: 'var(--c-text-muted)' };
        if (p.value === '오류') return { color: 'var(--c-danger)', fontWeight: 600 };
        return {};
      },
    }),
  ], []);

  return (
    <div className="flex flex-col" style={{ height: '100%' }}>
      <div
        className="flex items-center gap-1 px-4 py-2 border-b border-border overflow-x-auto scrollbar-thin"
        style={{ flexWrap: 'wrap' }}
      >
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="ctrl"
          style={{ width: 110, height: 28, fontSize: 12 }}
        >
          <option value="">전체 종류</option>
          <option value="asset">자산</option>
          <option value="contract">계약</option>
          <option value="customer">고객</option>
          <option value="member">회원사</option>
          <option value="vendor">거래처</option>
          <option value="insurance">보험</option>
          <option value="loan">할부</option>
          <option value="autodebit">자동이체</option>
          <option value="fund">입출금</option>
          <option value="event">운영</option>
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="ctrl"
          style={{ width: 130, height: 28, fontSize: 12 }}
          placeholder="시작일"
        />
        <span style={{ color: 'var(--c-text-muted)' }}>~</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="ctrl"
          style={{ width: 130, height: 28, fontSize: 12 }}
          placeholder="종료일"
        />
        <span className="ml-auto text-xs text-text-muted num">{filtered.length}건</span>
      </div>
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 text-text-muted" style={{ height: '100%', minHeight: 200 }}>
            <i className="ph ph-spinner spin" /> 로드 중...
          </div>
        ) : (
          <JpkGrid<UploadRow>
            ref={gridRef as Ref<JpkGridApi<UploadRow>>}
            columnDefs={cols}
            rowData={filtered}
            getRowId={(d) => d._id}
            storageKey="jpk.grid.input-history"
            onRowClicked={onSelect}
          />
        )}
      </div>
    </div>
  );
}
