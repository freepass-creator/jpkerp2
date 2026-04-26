import {
  equalTo,
  get,
  orderByChild,
  push,
  query,
  ref,
  serverTimestamp,
  update,
} from 'firebase/database';
/**
 * uploads — 업로드 통합 이력 저장소 (V1 패턴 이식).
 *
 * 어떤 파일이든 업로드 시 원본 데이터 + 매칭 결과를 보관 → 재처리·중복방지·감사 추적.
 *
 * RTDB 경로: `uploads/{push-key}`
 *   {
 *     filename, file_type, file_size,
 *     detected_type, detected_label,
 *     row_count, status,
 *     fingerprint,                        // 동일파일 중복방지 해시
 *     uploaded_at, processed_at,
 *     results: { ok, skip, fail },
 *     rows: [{ ...원본 데이터, _match }],
 *     handler_uid, handler,
 *   }
 */
import { getRtdb } from './rtdb';

export type UploadStatus = 'pending' | 'processed' | 'partial' | 'error';
export type UploadFileType = 'csv' | 'pdf' | 'image' | 'xlsx' | 'sheet' | 'unknown';

export interface UploadRecord {
  _key?: string;
  filename: string;
  file_type: UploadFileType;
  file_size?: number;
  detected_type?: string; // 'bank_shinhan' | 'card_shinhan' | 'asset' | 'contract' | ...
  detected_label?: string; // '신한은행 통장내역'
  row_count?: number;
  status: UploadStatus;
  fingerprint?: string;
  uploaded_at: number;
  processed_at?: number;
  results?: { ok: number; skip: number; fail: number };
  rows?: Array<Record<string, unknown>>;
  handler_uid?: string;
  handler?: string;
  note?: string;
}

export type SaveUploadInput = Omit<UploadRecord, 'uploaded_at' | 'status' | '_key'> & {
  status?: UploadStatus;
};

/** 새 업로드 이력 저장 — push key 반환 */
export async function saveUpload(data: SaveUploadInput): Promise<string> {
  const db = getRtdb();
  const r = push(ref(db, 'uploads'));
  const now = Date.now();
  await update(r, {
    ...data,
    status: data.status ?? 'pending',
    uploaded_at: now,
    created_at: now,
    updated_at: serverTimestamp(),
  });
  return r.key as string;
}

/** 결과 갱신 (처리 완료 시) */
export async function updateUpload(key: string, patch: Partial<UploadRecord>): Promise<void> {
  const db = getRtdb();
  await update(ref(db, `uploads/${key}`), {
    ...patch,
    updated_at: serverTimestamp(),
  });
}

/**
 * 파일 지문 — 같은 파일 중복 업로드 방지.
 * filename + rowCount + 첫 행 일부 → 단순 문자열 해시.
 */
export function fileFingerprint(
  filename: string,
  rowCount: number,
  firstRow?: Record<string, unknown> | string,
): string {
  const head = typeof firstRow === 'string' ? firstRow : JSON.stringify(firstRow ?? {});
  return `${filename}|${rowCount}|${head.slice(0, 120)}`;
}

/** 동일 fingerprint 의 기존 업로드가 있는지 확인 */
export async function findUploadByFingerprint(fingerprint: string): Promise<UploadRecord | null> {
  if (!fingerprint) return null;
  const db = getRtdb();
  const snap = await get(
    query(ref(db, 'uploads'), orderByChild('fingerprint'), equalTo(fingerprint)),
  );
  if (!snap.exists()) return null;
  const val = snap.val() as Record<string, UploadRecord>;
  const [key, rec] = Object.entries(val)[0];
  return { ...rec, _key: key };
}
