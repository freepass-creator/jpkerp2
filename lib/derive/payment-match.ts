/**
 * 결제 이벤트 → billings 자동 매칭.
 *
 * 대상: type=bank_tx | card_tx, amount>0, contract_code 존재하는 이벤트
 * 매칭: 해당 계약의 가장 오래된 미납 billing부터 순차 적용
 * 초과금: 다음 미납 billing으로 이월 (cascade)
 *
 * billings 필드 업데이트:
 *   - paid_total += 적용액
 *   - installments.push({ amount, date, event_key })
 */
import { ref, get, query, orderByChild, equalTo, update, serverTimestamp } from 'firebase/database';
import { getRtdb } from '@/lib/firebase/rtdb';
import type { RtdbBilling, RtdbEvent } from '@/lib/types/rtdb-entities';
import { computeTotalDue } from '@/lib/date-utils';

export interface MatchResult {
  matched: number;          // 반영된 billing 수
  applied: number;          // 총 적용 금액
  remainder: number;        // 미배분 잔액 (모든 billing 완납된 경우 초과분)
  billingKeys: string[];    // 업데이트된 billing _key들
}

/**
 * 이벤트 저장 직후 호출 — 조건 맞으면 billings 업데이트.
 * 실패·조건 미충족 시 조용히 { matched:0 } 반환 (저장 실패 안 함).
 */
export async function reconcilePayment(
  event: Partial<RtdbEvent> & { _key?: string; type?: string; amount?: number; contract_code?: string; date?: string },
): Promise<MatchResult> {
  const empty = { matched: 0, applied: 0, remainder: 0, billingKeys: [] };
  if (!event) return empty;
  if (event.type !== 'bank_tx' && event.type !== 'card_tx') return empty;
  if (!event.contract_code) return empty;
  const amt = Number(event.amount) || 0;
  if (amt <= 0) return empty;

  const db = getRtdb();

  // 해당 계약의 billings 조회 (orderByChild + equalTo)
  const snap = await get(
    query(ref(db, 'billings'), orderByChild('contract_code'), equalTo(event.contract_code)),
  );
  if (!snap.exists()) return empty;

  const entries = Object.entries(snap.val() as Record<string, RtdbBilling>);
  const unpaid = entries
    .map(([key, b]) => ({ key, ...b }))
    .filter((b) => b.status !== 'deleted')
    .filter((b) => (Number(b.paid_total) || 0) < computeTotalDue(b))
    .sort((a, b) => String(a.due_date ?? '').localeCompare(String(b.due_date ?? '')));

  if (unpaid.length === 0) return { ...empty, remainder: amt };

  let remaining = amt;
  const billingKeys: string[] = [];
  let matched = 0;
  let applied = 0;

  for (const b of unpaid) {
    if (remaining <= 0) break;
    const due = computeTotalDue(b);
    const paid = Number(b.paid_total) || 0;
    const short = due - paid;
    if (short <= 0) continue;
    const apply = Math.min(short, remaining);
    const newPaid = paid + apply;
    const installments = Array.isArray(b.installments) ? [...b.installments] : [];
    installments.push({
      amount: apply,
      date: event.date,
      event_key: event._key,
      event_type: event.type,
    } as { amount: number });

    await update(ref(db, `billings/${b.key}`), {
      paid_total: newPaid,
      installments,
      updated_at: serverTimestamp(),
    });
    billingKeys.push(b.key);
    matched++;
    applied += apply;
    remaining -= apply;
  }

  // 이벤트에 back-reference (첫 매칭 billing만)
  if (billingKeys.length > 0 && event._key) {
    await update(ref(db, `events/${event._key}`), {
      billing_key: billingKeys[0],
      match_status: remaining > 0 ? '부분' : '완료',
      matched_amount: applied,
      updated_at: serverTimestamp(),
    });
  }

  return { matched, applied, remainder: remaining, billingKeys };
}
