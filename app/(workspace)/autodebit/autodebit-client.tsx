'use client';

import { JpkGrid, type JpkGridApi } from '@/components/shared/jpk-grid';
import {
  type AutoDebitMatchResult,
  type AutoDebitRecord,
  type BankTxn,
  matchAutoDebits,
} from '@/lib/autodebit-match';
import { useRtdbCollection } from '@/lib/collections/rtdb';
import { MONO_CELL_STYLE, rowNumColumn, typedColumn } from '@/lib/grid/typed-column';
import type { RtdbEvent } from '@/lib/types/rtdb-entities';
import { fmt, fmtDate } from '@/lib/utils';
import type { ColDef } from 'ag-grid-community';
import { type Ref, useMemo, useRef } from 'react';

type AutoDebitRow = AutoDebitRecord & { _key: string };

/**
 * 자동이체 grid (CMS 자동이체 등록 현황) — 통장 입금과 자동 매칭.
 *
 * 매월 referenceDate(오늘) 기준 자동이체 1건당:
 *   matchAutoDebits()로 events.bank_tx 입금 매칭 → 점수 5+ 매칭 / 7+ 자동확정
 *
 * 컬럼: 차량번호 · 계약자 · 예금주 · 은행 · 계좌번호 · 이체일 · 이체액 · 시작/종료일 · 상태
 *      + [매칭상태] [예정일] [실수신일] [점수]
 */
export function AutoDebitClient() {
  const debits = useRtdbCollection<AutoDebitRow>('autodebits');
  const events = useRtdbCollection<RtdbEvent>('events');
  const gridRef = useRef<JpkGridApi<AutoDebitRow> | null>(null);

  // 통장 입금 트랜잭션만 추출
  const bankTxns = useMemo<BankTxn[]>(() => {
    return events.data
      .filter((e) => e.type === 'bank_tx' && e.status !== 'deleted')
      .map((e) => {
        const amt = Number(e.amount) || 0;
        const counterparty = String(
          (e as { counterparty?: unknown }).counterparty ?? e.title ?? '',
        );
        const summary = String((e as { summary?: unknown }).summary ?? '');
        return {
          date: e.date,
          amount: amt,
          direction: amt > 0 ? 'in' : 'out',
          counterparty,
          summary,
          memo: e.memo,
          event_id: e._key,
        } as BankTxn;
      });
  }, [events.data]);

  // 자동이체별 매칭 결과 Map (key = debit._key)
  const matchMap = useMemo<Map<string, AutoDebitMatchResult>>(() => {
    const m = new Map<string, AutoDebitMatchResult>();
    if (debits.loading || events.loading) return m;
    const results = matchAutoDebits(debits.data, bankTxns);
    for (const r of results) {
      const key = r.autodebit?._key;
      if (typeof key === 'string') m.set(key, r);
    }
    return m;
  }, [debits.data, debits.loading, bankTxns, events.loading]);

  const cols = useMemo<ColDef<AutoDebitRow>[]>(
    () => [
      rowNumColumn<AutoDebitRow>(),
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
      // ── 매칭 결과 (이번달 기준) ──
      {
        headerName: '매칭',
        colId: '_match_status',
        width: 90,
        valueGetter: (p) =>
          matchMap.get((p.data as AutoDebitRow | undefined)?._key ?? '')?.status ?? '',
        cellStyle: (p) => {
          const v = p.value as string;
          const color =
            v === 'matched'
              ? 'var(--c-success)'
              : v === 'candidate'
                ? 'var(--c-info)'
                : v === 'overdue'
                  ? 'var(--c-danger)'
                  : v === 'pending'
                    ? 'var(--c-warn)'
                    : 'var(--c-text-muted)';
          return { color, fontWeight: '600' };
        },
        valueFormatter: (p) => {
          switch (p.value as string) {
            case 'matched':
              return '확정';
            case 'candidate':
              return '후보';
            case 'overdue':
              return '미입금';
            case 'pending':
              return '대기';
            default:
              return '-';
          }
        },
      },
      {
        headerName: '예정일',
        colId: '_scheduled_date',
        width: 95,
        valueGetter: (p) =>
          matchMap.get((p.data as AutoDebitRow | undefined)?._key ?? '')?.scheduled_date ?? '',
        valueFormatter: (p) => fmtDate(p.value as string),
        cellStyle: { color: 'var(--c-text-sub)' } as Record<string, string>,
      },
      {
        headerName: '실수신일',
        colId: '_actual_date',
        width: 95,
        valueGetter: (p) =>
          matchMap.get((p.data as AutoDebitRow | undefined)?._key ?? '')?.actual_date ?? '',
        valueFormatter: (p) => fmtDate(p.value as string),
      },
      {
        headerName: '점수',
        colId: '_score',
        width: 65,
        filter: false,
        valueGetter: (p) =>
          matchMap.get((p.data as AutoDebitRow | undefined)?._key ?? '')?.score ?? '',
        cellStyle: {
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--c-text-muted)',
        } as Record<string, string>,
      },
    ],
    [matchMap],
  );

  if (debits.loading) {
    return (
      <div
        className="flex items-center justify-center gap-2 text-text-muted"
        style={{ height: '100%', minHeight: 200 }}
      >
        <i className="ph ph-spinner spin" /> 로드 중...
      </div>
    );
  }

  if (debits.data.length === 0) {
    return (
      <div
        className="flex items-center justify-center gap-2 text-text-muted"
        style={{ height: '100%', minHeight: 200 }}
      >
        <i className="ph ph-inbox text-[24px]" />
        <span>등록된 자동이체가 없습니다</span>
      </div>
    );
  }

  return (
    <JpkGrid<AutoDebitRow>
      ref={gridRef as Ref<JpkGridApi<AutoDebitRow>>}
      columnDefs={cols}
      rowData={debits.data}
      getRowId={(d) => d._key}
      storageKey="jpk.grid.autodebit"
    />
  );
}
