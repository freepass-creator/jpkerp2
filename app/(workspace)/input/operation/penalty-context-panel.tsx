'use client';

import { useMemo } from 'react';
import { toast } from 'sonner';
import { saveEvent } from '@/lib/firebase/events';
import { useAuth } from '@/lib/auth/context';
import { useSaveStore } from '@/lib/hooks/useSaveStatus';
import { usePenaltyStore, type PenaltyWorkItem } from './penalty-notice-store';
import { JpkGrid } from '@/components/shared/jpk-grid';
import { typedColumn } from '@/lib/grid/typed-column';
import type { ColDef } from 'ag-grid-community';

const PRINT_KEY = 'jpk.print.penalty';

function openPrintWindow(items: PenaltyWorkItem[]) {
  try {
    sessionStorage.setItem(PRINT_KEY, JSON.stringify(items));
  } catch (e) {
    toast.error(`인쇄 데이터 저장 실패: ${(e as Error).message}`);
    return;
  }
  window.open('/print/penalty?auto=1', '_blank', 'width=900,height=1000');
}

export function usePenaltyComplete() {
  const { items, remove, update } = usePenaltyStore();
  const { user } = useAuth();

  const completeItem = async (item: PenaltyWorkItem) => {
    update(item.id, { _saving: true });
    const saveStore = useSaveStore.getState();
    saveStore.begin('처리 중');
    try {
      await saveEvent({
        type: 'penalty',
        doc_type: item.doc_type,
        car_number: item.car_number,
        date: item.date,
        title: item.description || item.doc_type,
        penalty_amount: item.penalty_amount,
        fine_amount: item.fine_amount,
        demerit_points: item.demerit_points,
        toll_amount: item.toll_amount,
        amount: item.amount,
        location: item.location,
        description: item.description,
        law_article: item.law_article,
        due_date: item.due_date,
        notice_no: item.notice_no,
        issuer: item.issuer,
        issue_date: item.issue_date,
        payer_name: item.payer_name,
        pay_account: item.pay_account,
        customer_name: item._contract?.contractor_name,
        customer_phone: item._contract?.contractor_phone,
        contract_code: item._contract?.contract_code,
        partner_code: item._asset?.partner_code ?? item._contract?.partner_code,
        paid_status: '미납',
        direction: 'out',
        handler_uid: user?.uid,
        handler: user?.displayName ?? user?.email ?? undefined,
        note: `과태료처리 (${item.fileName})`,
      });
      saveStore.success(`처리완료: ${item.car_number || '—'}`);
      toast.success(`처리완료: ${item.car_number || '—'}`);
      remove(item.id);
    } catch (err) {
      update(item.id, { _saving: false });
      saveStore.fail((err as Error).message || '저장 실패');
      toast.error(`저장 실패: ${(err as Error).message}`);
    }
  };

  const completeAll = async () => {
    for (const item of [...items]) await completeItem(item);
  };

  return { completeItem, completeAll };
}

export function PenaltyContextPanel() {
  const { items, remove } = usePenaltyStore();
  const { completeItem } = usePenaltyComplete();

  const cols = useMemo<ColDef<PenaltyWorkItem>[]>(() => [
    // ── pinned left ──
    typedColumn('number', { headerName: 'p', field: 'pageNumber' as keyof PenaltyWorkItem, width: 36, pinned: 'left' }),
    typedColumn('action', {
      headerName: 'PDF',
      width: 44,
      pinned: 'left',
      cellRenderer: (p: { data: PenaltyWorkItem }) => {
        const it = p.data;
        if (!it) return null;
        return (
          <button type="button" onClick={() => openPrintWindow([it])} title="PDF 다운로드" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'var(--c-text-sub)' }}>
            <i className="ph ph-file-pdf" style={{ fontSize: 14 }} />
          </button>
        );
      },
    }),
    // ── scrollable ──
    typedColumn('text', {
      headerName: '회사',
      width: 70,
      valueGetter: (p) => p.data?._asset?.partner_code ?? p.data?._contract?.partner_code ?? '—',
    }),
    typedColumn('text', { headerName: '차량번호', field: 'car_number', width: 90, pinned: 'left', cellStyle: { fontWeight: 600 } }),
    typedColumn('text', {
      headerName: '계약자',
      width: 80,
      valueGetter: (p) => p.data?._contractor || '—',
      cellStyle: (p) => ({ color: p.data?._contract ? 'var(--c-text)' : 'var(--c-danger)' }),
    }),
    typedColumn('select', { headerName: '유형', field: 'doc_type', width: 70 }),
    typedColumn('text', { headerName: '부과기관', field: 'issuer', width: 90 }),
    typedColumn('text', { headerName: '위반일시', field: 'date', width: 120 }),
    typedColumn('text', { headerName: '위반장소', field: 'location', flex: 1, minWidth: 120 }),
    typedColumn('text', { headerName: '위반내용', field: 'description', width: 140 }),
    typedColumn('number', {
      headerName: '금액',
      field: 'amount',
      width: 80,
      valueFormatter: (p) => p.value ? Number(p.value).toLocaleString() : '—',
      cellStyle: { fontWeight: 600 },
    }),
    typedColumn('number', { headerName: '벌점', field: 'demerit_points', width: 50 }),
    typedColumn('text', { headerName: '납부기한', field: 'due_date', width: 90 }),
    typedColumn('text', { headerName: '고지서번호', field: 'notice_no', width: 140 }),
    typedColumn('text', { headerName: '납부계좌', field: 'pay_account', width: 140 }),
  ], [completeItem, remove]);

  if (!items.length) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 text-text-muted"
        style={{ padding: 24, height: '100%' }}
      >
        <i className="ph ph-receipt" style={{ fontSize: 32 }} />
        <div className="text-xs">
          고지서 업로드 시<br />여기에 매칭 결과가 표시됩니다
        </div>
      </div>
    );
  }

  return (
    <JpkGrid<PenaltyWorkItem>
      columnDefs={cols}
      rowData={items}
      getRowId={(d) => d.id}
      storageKey="jpk.grid.penalty-context"
    />
  );
}
