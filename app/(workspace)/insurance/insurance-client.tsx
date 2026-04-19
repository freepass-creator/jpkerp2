'use client';

import { useEffect, useMemo, useRef, type Ref, type RefObject } from 'react';
import { useRtdbCollection } from '@/lib/collections/rtdb';
import { JpkGrid, type JpkGridApi } from '@/components/shared/jpk-grid';
import { typedColumn } from '@/lib/grid/typed-column';
import { today, daysBetween } from '@/lib/date-utils';
import { fmt, fmtDate } from '@/lib/utils';
import type { ColDef } from 'ag-grid-community';

export type RtdbInsurance = {
  _key?: string;
  car_number?: string;
  partner_code?: string;
  insurance_company?: string;
  policy_no?: string;
  start_date?: string;
  end_date?: string;
  premium?: number;
  age_limit?: string;
  driver_range?: string;
  deductible?: number;
  coverage?: string;
  contract_type?: string;
  status?: string;
  [k: string]: unknown;
};

interface Props {
  gridRef?: RefObject<JpkGridApi<RtdbInsurance> | null>;
  onCountChange?: (count: number) => void;
}

export function InsuranceClient({ gridRef: externalRef, onCountChange }: Props = {}) {
  const internalRef = useRef<JpkGridApi<RtdbInsurance> | null>(null);
  const gridRef = externalRef ?? internalRef;
  const insurances = useRtdbCollection<RtdbInsurance>('insurances');

  const rows = useMemo(() => {
    const t = today();
    return insurances.data.map((i) => ({
      ...i,
      _days_to_end: i.end_date ? daysBetween(t, i.end_date) : null,
    }));
  }, [insurances.data]);

  const cols = useMemo<ColDef[]>(
    () => [
      typedColumn('action', { headerName: '#', valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1, width: 45, cellStyle: { color: 'var(--c-text-muted)' } }),
      typedColumn('select', { headerName: '회원사', field: 'partner_code', width: 75 }),
      typedColumn('text',   { headerName: '차량번호', field: 'car_number', width: 100, cellStyle: { fontWeight: '600' } }),
      typedColumn('select', { headerName: '보험사', field: 'insurance_company', width: 110 }),
      typedColumn('text',   { headerName: '증권번호', field: 'policy_no', width: 130, cellStyle: { fontFamily: 'var(--font-mono)', fontSize: 11 } }),
      typedColumn('select', { headerName: '계약구분', field: 'contract_type', width: 90 }),
      typedColumn('date',   { headerName: '개시일', field: 'start_date', width: 100, valueFormatter: (p) => fmtDate(p.value as string) }),
      typedColumn('date',   { headerName: '만기일', field: 'end_date', width: 100, valueFormatter: (p) => fmtDate(p.value as string) }),
      typedColumn('number', {
        headerName: '만기까지',
        field: '_days_to_end',
        width: 90,
        valueFormatter: (p) => (p.value === null ? '-' : Number(p.value) > 0 ? `D-${p.value}` : `D+${-Number(p.value)}`),
        cellStyle: (p) => {
          const v = Number(p.value);
          return {
            textAlign: 'right',
            fontWeight: '600',
            color: p.value === null ? 'var(--c-text-muted)' : v < 0 ? 'var(--c-danger)' : v <= 30 ? 'var(--c-warn)' : 'var(--c-success)',
          };
        },
      }),
      typedColumn('number', { headerName: '보험료', field: 'premium', width: 110, valueFormatter: (p) => fmt(Number(p.value)) }),
      typedColumn('select', { headerName: '연령한정', field: 'age_limit', width: 90 }),
      typedColumn('select', { headerName: '운전자범위', field: 'driver_range', width: 100 }),
      typedColumn('number', { headerName: '자기부담금', field: 'deductible', width: 100, valueFormatter: (p) => fmt(Number(p.value)) }),
      typedColumn('text',   { headerName: '담보', field: 'coverage', flex: 1, minWidth: 140 }),
    ],
    [],
  );

  useEffect(() => { onCountChange?.(rows.length); }, [rows.length, onCountChange]);

  if (insurances.loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-text-muted" style={{ height: '100%', minHeight: 200 }}>
        <i className="ph ph-spinner spin" /> 로드 중...
      </div>
    );
  }

  return <JpkGrid<RtdbInsurance> ref={gridRef as Ref<JpkGridApi<RtdbInsurance>>} columnDefs={cols} rowData={rows} getRowId={(d) => d._key ?? d.policy_no ?? ''} storageKey="jpk.grid.insurance" />;
}
