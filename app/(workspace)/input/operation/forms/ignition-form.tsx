'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useRtdbCollection } from '@/lib/collections/rtdb';
import { isActiveContractStatus } from '@/lib/data/contract-status';
import { computeTotalDue, today } from '@/lib/date-utils';
import { fmt } from '@/lib/utils';
import { syncContractActionStatus } from '../op-form-base';
import { saveEvent } from '@/lib/firebase/events';
import { useAuth } from '@/lib/auth/context';
import { CarNumberPicker } from '@/components/form/car-number-picker';
import { useOpContext } from '../op-context-store';
import type { RtdbAsset, RtdbContract, RtdbBilling, RtdbEvent } from '@/lib/types/rtdb-entities';

const REASONS = ['미납', '검사미이행', '계약위반', '연락두절', '기타'];

interface Row {
  contract: RtdbContract;
  asset: RtdbAsset | null;
  unpaidAmount: number;
  maxOverdueDays: number;
  lastIgnitionDate: string;
  lastIgnitionReason: string;
}

export function IgnitionForm() {
  const { user } = useAuth();
  const contracts = useRtdbCollection<RtdbContract>('contracts');
  const billings = useRtdbCollection<RtdbBilling>('billings');
  const assets = useRtdbCollection<RtdbAsset>('assets');
  const events = useRtdbCollection<RtdbEvent>('events');
  const { setCarNumber } = useOpContext();
  const [selectedCarNumber, setSelectedCarNumber] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [reasonMap, setReasonMap] = useState<Record<string, string>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addCarNumber, setAddCarNumber] = useState('');
  const [addReason, setAddReason] = useState('검사미이행');
  // 수동 추가된 차량번호 (미납 아닌 사유)
  const [manualCars, setManualCars] = useState<Set<string>>(new Set());

  const rows = useMemo<Row[]>(() => {
    const t = today();
    const active = contracts.data.filter(
      (c) => c.status !== 'deleted' && isActiveContractStatus(c.contract_status) && c.car_number,
    );
    const assetMap = new Map<string, RtdbAsset>();
    for (const a of assets.data) {
      if (a.status !== 'deleted' && a.car_number) assetMap.set(a.car_number, a);
    }
    // 차량별 최근 시동제어 이벤트
    const ignitionMap = new Map<string, { date: string; reason: string }>();
    for (const e of events.data) {
      if (e.type !== 'ignition' || !e.car_number || !e.date) continue;
      const cur = ignitionMap.get(e.car_number);
      if (!cur || String(e.date) > cur.date) {
        ignitionMap.set(e.car_number, {
          date: String(e.date),
          reason: String((e as Record<string, unknown>).ignition_reason ?? ''),
        });
      }
    }

    const list: Row[] = [];
    for (const c of active) {
      let unpaidAmount = 0;
      let maxOverdueDays = 0;
      for (const b of billings.data) {
        if (b.contract_code !== c.contract_code) continue;
        const due = computeTotalDue(b);
        const paid = Number(b.paid_total) || 0;
        if (paid >= due || !b.due_date || b.due_date >= t) continue;
        unpaidAmount += due - paid;
        const days = Math.floor((new Date(t).getTime() - new Date(b.due_date).getTime()) / 86400000);
        if (days > maxOverdueDays) maxOverdueDays = days;
      }

      // 미납이 있거나, 이미 시동제어 중이거나, 수동 추가된 차량이면 표시
      const isLocked = c.action_status === '시동제어';
      const isManual = c.car_number ? manualCars.has(c.car_number) : false;
      if (unpaidAmount > 0 || isLocked || isManual) {
        const ign = c.car_number ? ignitionMap.get(c.car_number) : undefined;
        list.push({
          contract: c,
          asset: c.car_number ? assetMap.get(c.car_number) ?? null : null,
          unpaidAmount,
          maxOverdueDays,
          lastIgnitionDate: ign?.date ?? '',
          lastIgnitionReason: ign?.reason ?? '',
        });
      }
    }
    return list.sort((a, b) => {
      const aLocked = a.contract.action_status === '시동제어' ? 1 : 0;
      const bLocked = b.contract.action_status === '시동제어' ? 1 : 0;
      if (aLocked !== bLocked) return bLocked - aLocked;
      return b.maxOverdueDays - a.maxOverdueDays;
    });
  }, [contracts.data, billings.data, assets.data, events.data, manualCars]);

  const toggle = async (row: Row) => {
    const c = row.contract;
    if (!c._key || !c.car_number) return;
    const isLocked = c.action_status === '시동제어';
    const nextAction = isLocked ? '제어해제' : '시동제어';
    const reason = isLocked ? '납부완료' : (reasonMap[c._key!] ?? '미납');

    setBusyKey(c._key);
    try {
      await saveEvent({
        type: 'ignition',
        date: today(),
        car_number: c.car_number,
        contract_code: c.contract_code,
        title: `${nextAction} · ${reason}`,
        ignition_action: nextAction,
        ignition_reason: reason,
        unpaid_amount: row.unpaidAmount,
        handler_uid: user?.uid,
        handler: user?.displayName ?? user?.email ?? undefined,
      });
      await syncContractActionStatus(c._key, nextAction);
      toast.success(`${c.car_number} → ${nextAction}`);
    } catch (err) {
      toast.error(`실패: ${(err as Error).message}`);
    } finally {
      setBusyKey(null);
    }
  };

  const lockedCount = rows.filter((r) => r.contract.action_status === '시동제어').length;

  return (
    <div style={{ overflow: 'auto', height: '100%' }}>
      {/* 추가 버튼 */}
      <div style={{ padding: '8px 6px', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="text-xs text-text-sub" style={{ fontWeight: 500 }}>
          총 {rows.length}대 · 제어중 {lockedCount}대
        </span>
        <span style={{ flex: 1 }} />
        {showAdd ? (
          <>
            <div style={{ width: 120 }}>
              <CarNumberPicker
                value={addCarNumber}
                onChange={(v) => setAddCarNumber(v)}
                placeholder="차량번호"
                showCreate={false}
              />
            </div>
            <select
              className="text-xs"
              value={addReason}
              onChange={(e) => setAddReason(e.target.value)}
              style={{ border: '1px solid var(--c-border)', borderRadius: 2, padding: '4px 6px', background: 'var(--c-surface)', fontFamily: 'inherit' }}
            >
              {REASONS.filter((r) => r !== '미납').map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={!addCarNumber.trim()}
              onClick={() => {
                if (!addCarNumber.trim()) return;
                setManualCars((s) => new Set(s).add(addCarNumber.trim()));
                setReasonMap((m) => ({ ...m }));
                // 해당 계약 찾아서 reason 기본값 설정
                const target = contracts.data.find((c) => c.car_number === addCarNumber.trim() && c.status !== 'deleted' && isActiveContractStatus(c.contract_status));
                if (target?._key) setReasonMap((m) => ({ ...m, [target._key!]: addReason }));
                setAddCarNumber('');
                setShowAdd(false);
              }}
            >
              확인
            </button>
            <button type="button" className="btn btn-sm" onClick={() => { setShowAdd(false); setAddCarNumber(''); }}>
              취소
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-sm btn-outline" onClick={() => setShowAdd(true)}>
            <i className="ph ph-plus" /> 추가
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="text-text-muted text-xs" style={{ padding: '40px 0', textAlign: 'center' }}>
          시동제어 대상 차량이 없습니다
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--c-bg-sub)' }}>
            <tr className="text-xs text-text-sub" style={{ borderBottom: '1px solid var(--c-border)' }}>
              <th style={{ padding: '6px', textAlign: 'center', fontWeight: 500, width: 32 }}>#</th>
              <th style={{ padding: '6px', textAlign: 'left', fontWeight: 500 }}>차량번호</th>
              <th style={{ padding: '6px', textAlign: 'left', fontWeight: 500 }}>회사</th>
              <th style={{ padding: '6px', textAlign: 'left', fontWeight: 500 }}>세부모델</th>
              <th style={{ padding: '6px', textAlign: 'right', fontWeight: 500 }}>미납금액</th>
              <th style={{ padding: '6px', textAlign: 'center', fontWeight: 500 }}>결제</th>
              <th style={{ padding: '6px', textAlign: 'right', fontWeight: 500 }}>연체</th>
              <th style={{ padding: '6px', textAlign: 'left', fontWeight: 500 }}>제어사유</th>
              <th style={{ padding: '6px', textAlign: 'center', fontWeight: 500 }}>제어일</th>
              <th style={{ padding: '6px', textAlign: 'center', fontWeight: 500 }}>상태</th>
              <th style={{ padding: '6px', textAlign: 'center', fontWeight: 500, width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const isLocked = r.contract.action_status === '시동제어';
              const isBusy = busyKey === r.contract._key;
              const key = r.contract._key!;
              return (
                <tr
                  key={key}
                  onClick={() => { setSelectedCarNumber(r.contract.car_number!); setCarNumber(r.contract.car_number!); }}
                  style={{ borderBottom: '1px solid var(--c-border)', cursor: 'pointer', background: selectedCarNumber === r.contract.car_number ? 'var(--c-bg-active)' : undefined }}
                >
                  <td className="text-xs text-text-muted" style={{ padding: '6px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                    {idx + 1}
                  </td>
                  <td className="text-xs" style={{ padding: '6px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {r.contract.car_number}
                  </td>
                  <td className="text-xs text-text-sub" style={{ padding: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.contract.partner_code ?? '—'}
                  </td>
                  <td className="text-xs text-text-sub" style={{ padding: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.asset?.detail_model ?? r.asset?.car_model ?? '—'}
                  </td>
                  <td className="text-xs" style={{ padding: '6px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: r.unpaidAmount > 0 ? 'var(--c-danger)' : 'var(--c-text-muted)' }}>
                    {r.unpaidAmount > 0 ? fmt(r.unpaidAmount) : '—'}
                  </td>
                  <td className="text-xs text-text-sub" style={{ padding: '6px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                    {r.contract.auto_debit_day ? `${r.contract.auto_debit_day}일` : '—'}
                  </td>
                  <td className="text-xs" style={{ padding: '6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: r.maxOverdueDays > 30 ? 'var(--c-danger)' : r.maxOverdueDays > 0 ? 'var(--c-warn)' : 'var(--c-text-muted)' }}>
                    {r.maxOverdueDays > 0 ? `${r.maxOverdueDays}일` : '—'}
                  </td>
                  <td className="text-xs" style={{ padding: '6px' }}>
                    {isLocked ? (
                      <span className="text-text-sub">{r.lastIgnitionReason || '미납'}</span>
                    ) : (
                      <select
                        className="text-xs"
                        value={reasonMap[key] ?? '미납'}
                        onChange={(e) => setReasonMap((m) => ({ ...m, [key]: e.target.value }))}
                        style={{ border: '1px solid var(--c-border)', borderRadius: 2, padding: '2px 4px', background: 'var(--c-surface)', fontFamily: 'inherit', color: 'var(--c-text-sub)' }}
                      >
                        {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="text-xs text-text-sub" style={{ padding: '6px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                    {r.lastIgnitionDate ? r.lastIgnitionDate.slice(5) : '—'}
                  </td>
                  <td style={{ padding: '6px', textAlign: 'center' }}>
                    <i className={`ph ${isLocked ? 'ph-lock' : 'ph-lock-open'}`} style={{ fontSize: 14, color: isLocked ? 'var(--c-danger)' : 'var(--c-text-muted)' }} />
                  </td>
                  <td style={{ padding: '6px', textAlign: 'center' }}>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => toggle(r)}
                      className="btn btn-sm"
                      style={{
                        padding: '0 8px',
                        height: 22,
                        color: isLocked ? 'var(--c-success)' : 'var(--c-danger)',
                        opacity: isBusy ? 0.4 : 1,
                      }}
                    >
                      {isBusy ? <i className="ph ph-spinner spin" /> : isLocked ? '해제' : '제어'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
