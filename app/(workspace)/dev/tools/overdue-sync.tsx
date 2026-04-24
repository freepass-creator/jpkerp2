'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ref, update, serverTimestamp } from 'firebase/database';
import { getRtdb } from '@/lib/firebase/rtdb';
import { useRtdbCollection } from '@/lib/collections/rtdb';
import { useAuth } from '@/lib/auth/context';
import { hasRole } from '@/lib/auth/rbac';
import { JpkGrid } from '@/components/shared/jpk-grid';
import { typedColumn } from '@/lib/grid/typed-column';
import { StatusBadge } from '@/components/shared/status-badge';
import { fmt, fmtDate } from '@/lib/utils';
import { today } from '@/lib/date-utils';
import type { RtdbContract, RtdbBilling } from '@/lib/types/rtdb-entities';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';

interface Row {
  _key: string;
  contract_code: string;
  car_number: string;
  contractor_name: string;
  rent_amount: number;
  current_overdue: number;
  expected_unpaid: number;       // 예상 미납 회차 수
  past_bill_count: number;       // 현재까지 경과한 회차
  actual_unpaid: number;         // 현재 billings 기준 실제 미납
  sync_status: 'pending' | 'synced' | 'manual';
  synced_at?: number;
}

/**
 * 계약 업로드 시 current_overdue 필드를 기반으로 billings 을 자동 정산.
 *
 * 로직:
 *   1. 과거 due_date (오늘 이전) 회차 목록 추출
 *   2. current_overdue 만큼 최근 회차부터 미납 처리
 *   3. 나머지 이전 회차는 paid_total = amount (완납)
 *   4. 미래 회차는 그대로 (paid_total=0, 결제대기)
 */
export function OverdueSyncTool() {
  const { user } = useAuth();
  const isAdmin = hasRole(user?.role ?? null, 'admin');

  const contracts = useRtdbCollection<RtdbContract>('contracts');
  const billings = useRtdbCollection<RtdbBilling>('billings');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'synced' | 'all'>('pending');

  const rows: Row[] = useMemo(() => {
    const t = today();
    // contract_code → billings 맵
    const byContract = new Map<string, RtdbBilling[]>();
    for (const b of billings.data) {
      if (b.status === 'deleted') continue;
      if (!b.contract_code) continue;
      if (!byContract.has(b.contract_code)) byContract.set(b.contract_code, []);
      byContract.get(b.contract_code)!.push(b);
    }

    const out: Row[] = [];
    for (const c of contracts.data) {
      if (c.status === 'deleted') continue;
      if (!c.contract_code) continue;
      const overdue = Number((c as Record<string, unknown>).current_overdue ?? 0);
      if (overdue <= 0) continue;

      const rent = Number(c.rent_amount) || 0;
      const expectedUnpaid = rent > 0 ? Math.ceil(overdue / rent) : 0;

      const bs = byContract.get(c.contract_code) ?? [];
      const past = bs.filter((b) => b.due_date && b.due_date <= t);
      const actualUnpaid = past.filter((b) => (b.paid_total ?? 0) < (Number(b.amount) || 0)).length;

      const synced = !!(c as Record<string, unknown>).initial_overdue_synced;
      const syncedAt = Number((c as Record<string, unknown>).initial_overdue_synced_at ?? 0);

      out.push({
        _key: c._key ?? '',
        contract_code: c.contract_code,
        car_number: c.car_number ?? '',
        contractor_name: c.contractor_name ?? '',
        rent_amount: rent,
        current_overdue: overdue,
        expected_unpaid: expectedUnpaid,
        past_bill_count: past.length,
        actual_unpaid: actualUnpaid,
        sync_status: synced ? 'synced' : 'pending',
        synced_at: syncedAt || undefined,
      });
    }

    return out.filter((r) => filter === 'all' ? true : r.sync_status === filter);
  }, [contracts.data, billings.data, filter]);

  const syncOne = async (row: Row) => {
    if (!isAdmin) { toast.error('admin 권한 필요'); return; }
    const c = contracts.data.find((x) => x._key === row._key);
    if (!c) return;
    setBusyKey(row._key);
    try {
      const db = getRtdb();
      const t = today();
      const bs = billings.data
        .filter((b) => b.contract_code === c.contract_code && b.status !== 'deleted')
        .sort((a, b) => String(a.due_date ?? '').localeCompare(String(b.due_date ?? '')));

      // 과거 회차만 대상 — 미래는 결제대기로 유지
      const past = bs.filter((b) => b.due_date && b.due_date <= t);
      if (past.length === 0) {
        toast.warning('과거 회차 없음 — billings 가 아직 파생되지 않았습니다');
        setBusyKey(null);
        return;
      }

      const rent = Number(c.rent_amount) || 0;
      let remaining = Number((c as Record<string, unknown>).current_overdue ?? 0);

      // 뒤에서부터 (최근 회차부터) 미수 금액 차감
      // 차감된 금액 = 미납, 나머지 앞 회차 = 완납
      const updates: Record<string, unknown> = {};
      for (let i = past.length - 1; i >= 0; i--) {
        const b = past[i];
        if (!b._key) continue;
        const amt = Number(b.amount) || rent;
        if (remaining >= amt) {
          // 완전 미납
          updates[`billings/${b._key}/paid_total`] = 0;
          updates[`billings/${b._key}/updated_at`] = serverTimestamp();
          remaining -= amt;
        } else if (remaining > 0) {
          // 부분납부 (amt - remaining 만큼 납부됨)
          updates[`billings/${b._key}/paid_total`] = amt - remaining;
          updates[`billings/${b._key}/updated_at`] = serverTimestamp();
          remaining = 0;
        } else {
          // 완납
          updates[`billings/${b._key}/paid_total`] = amt;
          updates[`billings/${b._key}/updated_at`] = serverTimestamp();
        }
      }

      // 계약에 sync 플래그 기록
      updates[`contracts/${c._key}/initial_overdue_synced`] = true;
      updates[`contracts/${c._key}/initial_overdue_synced_at`] = Date.now();
      updates[`contracts/${c._key}/initial_overdue_synced_by`] = user?.uid ?? '';
      updates[`contracts/${c._key}/updated_at`] = serverTimestamp();

      await update(ref(db), updates);
      const paidCount = past.length - row.expected_unpaid;
      toast.success(
        `${row.car_number} 정산 완료 — 완납 ${Math.max(paidCount, 0)}회차 / 미납 ${row.expected_unpaid}회차`,
      );
    } catch (e) {
      toast.error(`실패: ${(e as Error).message}`);
    } finally {
      setBusyKey(null);
    }
  };

  const syncAll = async () => {
    if (!isAdmin) { toast.error('admin 권한 필요'); return; }
    const targets = rows.filter((r) => r.sync_status === 'pending');
    if (targets.length === 0) { toast.info('정산할 계약 없음'); return; }
    if (!confirm(`정산 대기 ${targets.length}건을 일괄 처리합니다.\n각 계약의 current_overdue 기준으로 billings 를 조정.\n진행?`)) return;
    let ok = 0; let fail = 0;
    for (const r of targets) {
      try {
        await syncOne(r);
        ok++;
      } catch { fail++; }
    }
    toast.success(`일괄 정산 완료 — 성공 ${ok} / 실패 ${fail}`);
  };

  const columns: ColDef<Row>[] = [
    typedColumn<Row>('text', { headerName: '차량번호', field: 'car_number', width: 100, pinned: 'left' }),
    typedColumn<Row>('text', { headerName: '계약자', field: 'contractor_name', width: 100 }),
    typedColumn<Row>('text', { headerName: '계약코드', field: 'contract_code', width: 110 }),
    typedColumn<Row>('number', {
      headerName: '월렌트료', field: 'rent_amount', width: 100,
      valueFormatter: (p) => fmt(Number(p.value ?? 0)),
    }),
    typedColumn<Row>('number', {
      headerName: '현재미수', field: 'current_overdue', width: 110,
      valueFormatter: (p) => fmt(Number(p.value ?? 0)),
      cellStyle: { color: 'var(--c-danger)', fontWeight: 600 },
    }),
    typedColumn<Row>('number', { headerName: '예상 미납 회차', field: 'expected_unpaid', width: 110 }),
    typedColumn<Row>('number', { headerName: '경과 회차', field: 'past_bill_count', width: 90 }),
    typedColumn<Row>('number', { headerName: '현재 미납 회차', field: 'actual_unpaid', width: 110 }),
    {
      field: 'sync_status',
      headerName: '정산',
      width: 120,
      cellRenderer: (p: ICellRendererParams<Row>) => {
        if (!p.data) return null;
        if (p.data.sync_status === 'synced') {
          return (
            <span className="jpk-pill tone-success">
              정산됨 {p.data.synced_at ? `· ${fmtDate(new Date(p.data.synced_at).toISOString().slice(0, 10))}` : ''}
            </span>
          );
        }
        return <span className="jpk-pill tone-warn">대기</span>;
      },
    },
    {
      headerName: '액션',
      width: 100,
      pinned: 'right',
      cellRenderer: (p: ICellRendererParams<Row>) => {
        if (!p.data) return null;
        const row = p.data;
        if (row.sync_status === 'synced') {
          return <span className="text-text-muted text-xs">—</span>;
        }
        return (
          <button
            type="button"
            className="btn btn-xs btn-primary"
            disabled={busyKey === row._key || !isAdmin}
            onClick={() => syncOne(row)}
          >
            {busyKey === row._key ? '...' : '정산'}
          </button>
        );
      },
    },
  ];

  const pendingCount = rows.filter((r) => r.sync_status === 'pending').length;

  return (
    <div className="flex flex-col" style={{ height: '100%' }}>
      {/* 툴바 */}
      <div
        className="flex items-center gap-2 px-4 py-2 text-xs"
        style={{ borderBottom: '1px solid var(--c-border)', background: 'var(--c-bg-sub)' }}
      >
        <span className="text-text-muted">필터:</span>
        {(['pending', 'synced', 'all'] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={`btn btn-xs ${filter === f ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter(f)}
          >
            {f === 'pending' ? '대기' : f === 'synced' ? '정산완료' : '전체'}
          </button>
        ))}
        <span className="text-text-muted" style={{ marginLeft: 12 }}>
          대기 <StatusBadge tone="warn">{pendingCount}</StatusBadge>
        </span>
        <div style={{ marginLeft: 'auto' }}>
          {!isAdmin && (
            <span className="text-danger text-xs" style={{ marginRight: 8 }}>
              admin 권한 필요 (현재: {user?.role ?? '—'})
            </span>
          )}
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={syncAll}
            disabled={!isAdmin || pendingCount === 0}
          >
            <i className="ph ph-check-circle" />전체 정산 ({pendingCount})
          </button>
        </div>
      </div>

      {/* 그리드 */}
      <div className="flex-1 min-h-0">
        <JpkGrid<Row>
          rowData={rows}
          columnDefs={columns}
          getRowId={(d) => d._key}
          storageKey="jpk.grid.dev.overdue-sync"
        />
      </div>

      {/* 설명 */}
      <div
        className="text-xs text-text-sub px-4 py-2"
        style={{ borderTop: '1px solid var(--c-border)', background: 'var(--c-bg-sub)', lineHeight: 1.6 }}
      >
        💡 <b>정산 로직</b>: 과거 회차 중 최근 N회차 → 미납 (paid_total=0), 그 이전 → 완납 (paid_total=amount).
        부분납부는 마지막 1건에만 적용. 미래 회차(결제대기)는 건드리지 않음.
      </div>
    </div>
  );
}
