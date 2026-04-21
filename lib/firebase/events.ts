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

/** 과태료는 같은 차량에 여러 건 가능하므로 중복 체크 제외 */
const DEDUP_SKIP_TYPES = new Set(['penalty']);

/**
 * 이벤트 중복 키 생성. type별로 의미 있는 필드 조합.
 * - insurance: car_number + type + ins_kind + insurance_company + date
 * - 기타: car_number + type + date + title
 */
function buildDedupKey(data: Record<string, unknown>): string | null {
  const type = String(data.type ?? '');
  if (DEDUP_SKIP_TYPES.has(type)) return null;
  const car = String(data.car_number ?? '');
  if (!car) return null;

  if (type === 'insurance') {
    return `${car}|${type}|${data.ins_kind ?? ''}|${data.insurance_company ?? ''}|${data.date ?? ''}`;
  }
  return `${car}|${type}|${data.date ?? ''}|${data.title ?? ''}`;
}

/**
 * 기존 이벤트 중 동일 dedup_key가 있는지 확인.
 * 있으면 기존 이벤트 코드를 반환, 없으면 null.
 */
export async function checkEventDuplicate(
  data: Partial<RtdbEvent> & { type: string },
): Promise<{ exists: boolean; eventCode?: string }> {
  const dedupKey = buildDedupKey(data as Record<string, unknown>);
  if (!dedupKey) return { exists: false };

  const q = query(ref(getRtdb(), 'events'), orderByChild('dedup_key'), equalTo(dedupKey));
  const snap = await get(q);
  if (!snap.exists()) return { exists: false };

  // status=deleted 제외
  for (const [, v] of Object.entries(snap.val() as Record<string, { status?: string; event_code?: string }>)) {
    if (v?.status !== 'deleted') {
      return { exists: true, eventCode: v.event_code };
    }
  }
  return { exists: false };
}

/**
 * 운영업무 이벤트 저장 — RTDB /events 컬렉션에 push.
 * bank_tx/card_tx + contract_code 있으면 billings 자동 매칭.
 * dedup_key로 중복 방지 (과태료 제외).
 */
export async function saveEvent(
  data: Partial<RtdbEvent> & { type: string; handler_uid?: string },
): Promise<string> {
  const dedupKey = buildDedupKey(data as Record<string, unknown>);

  const r = push(ref(getRtdb(), 'events'));
  const payload = {
    ...data,
    event_code: data.event_code || genEventCode(),
    dedup_key: dedupKey ?? undefined,
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
