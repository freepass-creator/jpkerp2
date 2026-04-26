'use client';

import { JpkGrid, type JpkGridApi } from '@/components/shared/jpk-grid';
import { useRtdbCollection } from '@/lib/collections/rtdb';
import { computeTotalDue, today } from '@/lib/date-utils';
import { rowNumColumn, typedColumn } from '@/lib/grid/typed-column';
import type { RtdbBilling, RtdbContract } from '@/lib/types/rtdb-entities';
import { fmt } from '@/lib/utils';
import type { ColDef } from 'ag-grid-community';
import { type Ref, type RefObject, useEffect, useMemo, useRef } from 'react';

export interface ScheduleRow {
  _key: string;
  partner_code: string;
  car_number: string;
  contract_code: string;
  contractor_name: string;
  deposit_amount: number;
  deposit_paid: boolean;
  rent_amount: number;
  auto_debit_day: string;
  total_months: number;
  due_count: number;
  paid_count: number;
  unpaid_count: number;
  wait_count: number;
  unpaid_amount: number;
  contract_status: string;
}

interface Props {
  gridRef?: RefObject<JpkGridApi<ScheduleRow> | null>;
  onCountChange?: (count: number) => void;
  onRowClick?: (row: ScheduleRow) => void;
}

/**
 * 수납 스케줄 grid (계약별 1행 — 보증금·월대여료·납부·미납·대기 회차).
 * v3 sub-tab 용 단일 grid 컴포넌트. v2 page 의 좌측 grid 와 동일 데이터.
 */
export function BillingScheduleClient({
  gridRef: externalRef,
  onCountChange,
  onRowClick,
}: Props = {}) {
  const internalRef = useRef<JpkGridApi<ScheduleRow> | null>(null);
  const gridRef = externalRef ?? internalRef;
  const contracts = useRtdbCollection<RtdbContract>('contracts');
  const billings = useRtdbCollection<RtdbBilling>('billings');

  const rows = useMemo<ScheduleRow[]>(() => {
    const t = today();
    return contracts.data
      .filter((c) => c.status !== 'deleted' && c.contract_code)
      .map((c) => {
        const cBillings = billings.data.filter(
          (b) => b.contract_code === c.contract_code && b.status !== 'deleted',
        );
        const rentBillings = cBillings.filter(
          (b) => (b as Record<string, unknown>).bill_type !== '보증금',
        );
        const depositBilling = cBillings.find(
          (b) => (b as Record<string, unknown>).bill_type === '보증금',
        );

        let dueCount = 0;
        let paidCount = 0;
        let unpaidCount = 0;
        let unpaidAmount = 0;
        const totalMonths = Number(c.rent_months) || rentBillings.length;
        for (const b of rentBillings) {
          const due = computeTotalDue(b);
          const paid = Number(b.paid_total) || 0;
          const isPast = b.due_date && b.due_date <= t;
          if (isPast) {
            dueCount++;
            if (paid >= due) paidCount++;
            else {
              unpaidCount++;
              unpaidAmount += due - paid;
            }
          }
        }
        const waitCount = totalMonths - dueCount;

        const depositAmt = depositBilling
          ? computeTotalDue(depositBilling)
          : Number(c.deposit_amount) || 0;
        const depositPaid = depositBilling
          ? (Number(depositBilling.paid_total) || 0) >= depositAmt
          : false;

        return {
          _key: c._key ?? '',
          partner_code: c.partner_code ?? '',
          car_number: c.car_number ?? '',
          contract_code: c.contract_code ?? '',
          contractor_name: c.contractor_name ?? '',
          deposit_amount: depositAmt,
          deposit_paid: depositPaid,
          rent_amount: Number(c.rent_amount) || 0,
          auto_debit_day: c.auto_debit_day ? `${c.auto_debit_day}일` : '',
          total_months: totalMonths,
          due_count: dueCount,
          paid_count: paidCount,
          unpaid_count: unpaidCount,
          wait_count: waitCount,
          unpaid_amount: unpaidAmount,
          contract_status: c.contract_status ?? '',
        };
      });
  }, [contracts.data, billings.data]);

  useEffect(() => {
    onCountChange?.(rows.length);
  }, [rows.length, onCountChange]);

  const cols = useMemo<ColDef<ScheduleRow>[]>(
    () => [
      rowNumColumn({ width: 40, pinned: 'left' }),
      typedColumn('select', {
        headerName: '상태',
        field: 'contract_status',
        width: 70,
        pinned: 'left',
      }),
      typedColumn('select', {
        headerName: '회사코드',
        field: 'partner_code',
        width: 80,
        pinned: 'left',
      }),
      typedColumn('text', {
        headerName: '차량번호',
        field: 'car_number',
        width: 90,
        pinned: 'left',
        cellStyle: { fontWeight: 600 },
      }),
      typedColumn('text', { headerName: '계약자', field: 'contractor_name', width: 80 }),
      typedColumn('number', {
        headerName: '보증금',
        field: 'deposit_amount',
        width: 80,
        valueFormatter: (p) => (Number(p.value) > 0 ? fmt(Number(p.value)) : '무보증'),
      }),
      typedColumn('action', {
        headerName: '보증금',
        width: 55,
        valueGetter: (p) => (p.data?.deposit_amount ? (p.data.deposit_paid ? '납부' : '미납') : ''),
        cellStyle: (p) => ({
          color:
            p.value === '납부'
              ? 'var(--c-success)'
              : p.value === '미납'
                ? 'var(--c-danger)'
                : 'var(--c-text-muted)',
          fontWeight: 600,
          textAlign: 'center',
        }),
      }),
      typedColumn('number', {
        headerName: '월대여료',
        field: 'rent_amount',
        width: 90,
        valueFormatter: (p) => (p.value ? fmt(Number(p.value)) : ''),
      }),
      typedColumn('text', { headerName: '결제일', field: 'auto_debit_day', width: 60 }),
      typedColumn('number', { headerName: '총회차', field: 'total_months', width: 55 }),
      typedColumn('number', { headerName: '경과', field: 'due_count', width: 50 }),
      typedColumn('number', {
        headerName: '납부',
        field: 'paid_count',
        width: 50,
        cellStyle: { color: 'var(--c-success)' },
      }),
      typedColumn('number', {
        headerName: '미납',
        field: 'unpaid_count',
        width: 50,
        cellStyle: (p) => ({
          color: Number(p.value) > 0 ? 'var(--c-danger)' : 'var(--c-text-muted)',
          fontWeight: Number(p.value) > 0 ? 600 : 400,
        }),
      }),
      typedColumn('number', {
        headerName: '대기',
        field: 'wait_count',
        width: 50,
        cellStyle: { color: 'var(--c-text-muted)' },
      }),
      typedColumn('number', {
        headerName: '미납금액',
        field: 'unpaid_amount',
        width: 90,
        valueFormatter: (p) => (Number(p.value) > 0 ? fmt(Number(p.value)) : ''),
        cellStyle: (p) => ({
          color: Number(p.value) > 0 ? 'var(--c-danger)' : 'var(--c-text-muted)',
          fontWeight: 600,
        }),
      }),
    ],
    [],
  );

  return (
    <JpkGrid<ScheduleRow>
      ref={gridRef as Ref<JpkGridApi<ScheduleRow>>}
      columnDefs={cols}
      rowData={rows}
      getRowId={(d) => d._key}
      storageKey="jpk.grid.billing-schedule"
      onRowClicked={onRowClick}
    />
  );
}
