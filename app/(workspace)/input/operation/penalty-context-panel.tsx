'use client';

import { toast } from 'sonner';
import { saveEvent } from '@/lib/firebase/events';
import { useAuth } from '@/lib/auth/context';
import { useSaveStore } from '@/lib/hooks/useSaveStatus';
import { usePenaltyStore, type PenaltyWorkItem } from './penalty-notice-store';

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

export function PenaltyContextPanel() {
  const { items, remove, update, clear } = usePenaltyStore();
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

  const clearAll = () => {
    if (!items.length) return;
    if (!confirm(`대기 ${items.length}건을 모두 비우시겠습니까?`)) return;
    clear();
  };

  const printOne = (item: PenaltyWorkItem) => openPrintWindow([item]);
  const printAll = () => {
    if (!items.length) return;
    openPrintWindow(items);
  };

  const totalAmount = items.reduce((s, i) => s + (i.amount || 0), 0);

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
    <div className="flex flex-col" style={{ height: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          borderBottom: '1px solid var(--c-border)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600 }}>{items.length}건</span>
        <span className="text-text-muted" style={{ fontSize: 11 }}>
          합계 {totalAmount.toLocaleString()}원
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={printAll}
            title="모든 고지서 인쇄 / PDF 저장"
          >
            <i className="ph ph-printer" />
            전체 인쇄
          </button>
          <button type="button" className="btn btn-sm btn-outline" onClick={clearAll}>
            <i className="ph ph-trash" />초기화
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={completeAll}>
            <i className="ph ph-check-circle" />전체 처리완료
          </button>
        </div>
      </div>

      <div className="overflow-auto scrollbar-thin" style={{ flex: 1 }}>
        <table className="jpk-item-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 32, textAlign: 'center' }}>매칭</th>
              <th style={{ width: 86 }}>차량번호</th>
              <th style={{ width: 90 }}>부과기관</th>
              <th style={{ width: 110 }}>위반일시</th>
              <th>위반장소</th>
              <th style={{ width: 70, textAlign: 'right' }}>금액</th>
              <th style={{ width: 70 }}>계약자</th>
              <th style={{ width: 86 }} />
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const matched = !!it._contract;
              return (
                <tr key={it.id}>
                  <td
                    style={{
                      textAlign: 'center',
                      color: matched ? 'var(--c-success)' : 'var(--c-danger)',
                      fontWeight: 700,
                    }}
                  >
                    {matched ? '✓' : '✗'}
                  </td>
                  <td style={{ fontWeight: 600 }}>{it.car_number || '—'}</td>
                  <td
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 90,
                    }}
                  >
                    {it.issuer || '—'}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{it.date || '—'}</td>
                  <td
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 180,
                    }}
                    title={it.location}
                  >
                    {it.location || '—'}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {it.amount ? it.amount.toLocaleString() : '—'}
                  </td>
                  <td style={{ color: matched ? 'var(--c-text)' : 'var(--c-danger)' }}>
                    {it._contractor || '—'}
                  </td>
                  <td style={{ display: 'flex', gap: 2, padding: '4px' }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => printOne(it)}
                      style={{ padding: '0 6px', fontSize: 10 }}
                      title="개별 인쇄 / PDF 저장"
                    >
                      <i className="ph ph-printer" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      disabled={it._saving}
                      onClick={() => completeItem(it)}
                      style={{ padding: '0 6px', fontSize: 10 }}
                    >
                      {it._saving ? '저장중' : '완료'}
                    </button>
                    <button
                      type="button"
                      aria-label="삭제"
                      className="jpk-item-del"
                      onClick={() => remove(it.id)}
                    >
                      <i className="ph ph-x" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
