'use client';

import { SimpleRtdbGrid } from '@/components/shared/simple-rtdb-grid';
import { MONO_CELL_STYLE, rowNumColumn, typedColumn } from '@/lib/grid/typed-column';
import { fmt, fmtDate } from '@/lib/utils';
import type { ColDef } from 'ag-grid-community';

const cols: ColDef[] = [
  rowNumColumn(),
  typedColumn('text', {
    headerName: '차량번호',
    field: 'car_number',
    width: 100,
    cellStyle: { fontWeight: '600' },
  }),
  typedColumn('text', { headerName: '계약자', field: 'contractor_name', width: 90 }),
  typedColumn('text', { headerName: '예금주', field: 'account_holder', width: 90 }),
  typedColumn('select', { headerName: '은행', field: 'bank_name', width: 85 }),
  typedColumn('text', {
    headerName: '계좌번호',
    field: 'account_no',
    width: 150,
    cellStyle: MONO_CELL_STYLE,
  }),
  typedColumn('select', { headerName: '이체일', field: 'debit_day', width: 70 }),
  typedColumn('number', {
    headerName: '이체액',
    field: 'debit_amount',
    width: 110,
    valueFormatter: (p) => (p.value ? fmt(Number(p.value)) : '-'),
  }),
  typedColumn('date', {
    headerName: '시작일',
    field: 'start_date',
    width: 100,
    valueFormatter: (p) => fmtDate(p.value as string),
  }),
  typedColumn('date', {
    headerName: '종료일',
    field: 'end_date',
    width: 100,
    valueFormatter: (p) => fmtDate(p.value as string),
  }),
  typedColumn('select', {
    headerName: '상태',
    field: 'status',
    width: 80,
    cellStyle: (p) => {
      const v = p.value as string;
      const color =
        v === '정상' || v === 'active'
          ? 'var(--c-success)'
          : v === '중지' || v === 'paused'
            ? 'var(--c-warn)'
            : v === '해지' || v === 'closed'
              ? 'var(--c-danger)'
              : 'var(--c-text-muted)';
      return { color, fontWeight: '600' };
    },
  }),
];

/**
 * 자동이체 grid (CMS 자동이체 등록 현황) — 컬럼/스토리지키 그대로 v2 page 와 동일.
 * v3 sub-tab 에서 panel chrome 없이 grid 만 노출하기 위한 wrapper.
 */
export function AutoDebitClient() {
  return (
    <SimpleRtdbGrid
      path="autodebits"
      columnDefs={cols}
      storageKey="jpk.grid.autodebit"
      emptyMessage="등록된 자동이체가 없습니다"
    />
  );
}
