import { ref, push, set, get, query, orderByChild, equalTo, serverTimestamp, update } from 'firebase/database';
import { getRtdb } from './rtdb';
import { reconcilePayment } from '@/lib/derive/payment-match';
import { genEventCode } from '@/lib/code-gen';
import type { RtdbEvent } from '@/lib/types/rtdb-entities';

function shouldReconcile(data: Partial<RtdbEvent>): boolean {
  return (data.type === 'bank_tx' || data.type === 'card_tx') &&
    !!data.contract_code &&
    (Number(data.amount) || 0) > 0;
}

/**
 * 운영업무 이벤트 저장 — RTDB /events 컬렉션에 push.
 * bank_tx/card_tx + contract_code 있으면 billings 자동 매칭.
 */
export async function saveEvent(
  data: Partial<RtdbEvent> & { type: string; handler_uid?: string },
): Promise<string> {
  const r = push(ref(getRtdb(), 'events'));
  const payload = {
    ...data,
    event_code: data.event_code || genEventCode(),
    created_at: Date.now(),
    updated_at: serverTimestamp(),
    status: 'active',
  };
  await set(r, payload);

  // 결제 이벤트 자동 매칭
  if (shouldReconcile(data)) {
    try { await reconcilePayment({ ...data, _key: r.key! }); }
    catch { /* 매칭 실패는 이벤트 저장 결과에 영향 없음 */ }
  }

  return r.key!;
}

/**
 * raw_key 기반 멱등 저장 — 같은 raw_key 있으면 update, 없으면 insert.
 * 은행/카드 CSV 업로드 시 중복 방지용.
 */
export async function upsertEventByRawKey(
  data: Partial<RtdbEvent> & { type: string; raw_key: string },
): Promise<string> {
  const db = getRtdb();
  const eventsRef = ref(db, 'events');
  const q = query(eventsRef, orderByChild('raw_key'), equalTo(data.raw_key));
  const snap = await get(q);
  let key: string;
  let isNew = false;
  if (snap.exists()) {
    const entries = Object.entries(snap.val() as Record<string, unknown>);
    key = entries[0][0];
    await update(ref(db, `events/${key}`), { ...data, updated_at: serverTimestamp() });
  } else {
    const r = push(eventsRef);
    key = r.key!;
    isNew = true;
    await set(r, {
      ...data,
      created_at: Date.now(),
      updated_at: serverTimestamp(),
      status: 'active',
    });
  }

  // 신규 저장 + 매칭 조건 부합 시 reconcile
  if (isNew && shouldReconcile(data)) {
    try { await reconcilePayment({ ...data, _key: key }); }
    catch { /* silent */ }
  }

  return key;
}
