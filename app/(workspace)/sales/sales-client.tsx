'use client';

import { useEffect, useMemo, useRef, type Ref, type RefObject } from 'react';
import { useRtdbCollection } from '@/lib/collections/rtdb';
import { JpkGrid, type JpkGridApi } from '@/components/shared/jpk-grid';
import { typedColumn } from '@/lib/grid/typed-column';
import { KpiCard } from '@/components/shared/kpi-card';
import type { RtdbContract } from '@/lib/types/rtdb-entities';
import { fmt } from '@/lib/utils';
import type { ColDef } from 'ag-grid-community';

export interface SalesRow {
  month: string;
  count: number;
  amount: number;
  deposits: number;
}

interface Props {
  gridRef?: RefObject<JpkGridApi<SalesRow> | null>;
  onCountChange?: (count: number) => void;
}

/**
 * 실적 관리 — 월별 신규 계약 집계.
 */
export function SalesClient({ gridRef: externalRef, onCountChange }: Props = {}) {
  const internalRef = useRef<JpkGridApi<SalesRow> | null>(null);
  const gridRef = externalRef ?? internalRef;
  const contracts = useRtdbCollection<RtdbContract>('contracts');

  const byMonth = useMemo<SalesRow[]>(() => {
    const map = new Map<string, SalesRow>();
    for (const c of contracts.data) {
      if (c.status === 'deleted') continue;
      if (!c.contractor_name?.trim()) continue;
      const created = c.created_at ? new Date(Number(c.created_at)) : c.start_date ? new Date(c.start_date) : null;
      if (!created) continue;
      const mo = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
      let row = map.get(mo);
      if (!row) {
        row = { month: mo, count: 0, amount: 0, deposits: 0 };
        map.set(mo, row);
      }
      row.count++;
      row.amount += Number(c.rent_amount) || 0;
      row.deposits += Number(c.deposit_amount) || 0;
    }
    return [...map.values()].sort((a, b) => b.month.localeCompare(a.month));
  }, [contracts.data]);

  useEffect(() => { onCountChange?.(byMonth.length); }, [byMonth.length, onCountChange]);

  const totals = useMemo(() => ({
    count: byMonth.reduce((s, r) => s + r.count, 0),
    amount: byMonth.reduce((s, r) => s + r.amount, 0),
    deposits: byMonth.reduce((s, r) => s + r.deposits, 0),
    thisMonth: byMonth[0]?.count ?? 0,
  }), [byMonth]);

  const cols = useMemo<ColDef[]>(
    () => [
      typedColumn('text',   { headerName: '월', field: 'month', width: 100, sort: 'desc', cellStyle: { fontWeight: '600' } }),
      typedColumn('number', { headerName: '신규 계약', field: 'count', width: 100, valueFormatter: (p) => (p.value ? `${p.value}건` : '-') }),
      typedColumn('number', { headerName: '월 매출 합계', field: 'amount', width: 140, valueFormatter: (p) => fmt(Number(p.value)), cellStyle: { textAlign: 'right', color: 'var(--c-success)', fontWeight: '600' } }),
      typedColumn('number', { headerName: '보증금 합계', field: 'deposits', width: 140, valueFormatter: (p) => fmt(Number(p.value)) }),
    ],
    [],
  );

  if (contracts.loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-text-muted" style={{ height: '100%', minHeight: 200 }}>
        <i className="ph ph-spinner spin" /> 로드 중...
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: '100%' }}>
      <div className="grid grid-cols-4 gap-3 p-4 border-b border-border">
        <KpiCard label="누적 신규" value={`${fmt(totals.count)}건`} tone="primary" />
        <KpiCard label="이번달 신규" value={`${fmt(totals.thisMonth)}건`} tone="success" />
        <KpiCard label="누적 월매출액" value={`${fmt(totals.amount)}원`} />
        <KpiCard label="누적 보증금" value={`${fmt(totals.deposits)}원`} />
      </div>
      <div className="flex-1 min-h-0">
        <JpkGrid<SalesRow>
          ref={gridRef as Ref<JpkGridApi<SalesRow>>}
          columnDefs={cols}
          rowData={byMonth}
          getRowId={(d) => d.month}
          storageKey="jpk.grid.sales"
        />
      </div>
    </div>
  );
}
