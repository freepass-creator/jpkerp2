'use client';

import { useQuery } from '@tanstack/react-query';
import { ref, get } from 'firebase/database';
import { getRtdb } from '@/lib/firebase/rtdb';
import type { UploadRow } from './types';

const DIRECT_SOURCES: Array<{ path: string; type: string; label: string }> = [
  { path: 'assets', type: 'asset', label: '자산' },
  { path: 'contracts', type: 'contract', label: '계약' },
  { path: 'customers', type: 'customer', label: '고객' },
  { path: 'members', type: 'member', label: '회원사' },
  { path: 'vendors', type: 'vendor', label: '거래처' },
  { path: 'insurances', type: 'insurance', label: '보험' },
  { path: 'loans', type: 'loan', label: '할부' },
  { path: 'autodebits', type: 'autodebit', label: '자동이체' },
  { path: 'events', type: 'event', label: '운영' },
];

function normalizeType(t?: string): string {
  if (!t) return '';
  const s = String(t).toLowerCase();
  if (/자산|asset/.test(s)) return 'asset';
  if (/계약|contract/.test(s)) return 'contract';
  if (/고객|customer/.test(s)) return 'customer';
  if (/회원사|member/.test(s)) return 'member';
  if (/거래처|vendor/.test(s)) return 'vendor';
  if (/보험|insurance/.test(s)) return 'insurance';
  if (/할부|loan/.test(s)) return 'loan';
  if (/자동이체|autodebit/.test(s)) return 'autodebit';
  if (/통장|카드|입출금|bank|card|fund/.test(s)) return 'fund';
  if (/운영|event|penalty/.test(s)) return 'event';
  return '';
}

async function fetchInputHistory(): Promise<UploadRow[]> {
  const out: UploadRow[] = [];
  const db = getRtdb();

  // 1) 대량 업로드 + 개별입력 9개 컬렉션 병렬 로드
  const [uploadsSnap, directSnaps] = await Promise.all([
    get(ref(db, 'uploads')).catch(() => null),
    Promise.all(DIRECT_SOURCES.map((s) => get(ref(db, s.path)).catch(() => null))),
  ]);

  // 업로드 배치
  if (uploadsSnap?.exists()) {
    for (const [id, uRaw] of Object.entries(uploadsSnap.val() as Record<string, unknown>)) {
      const u = uRaw as {
        uploaded_at?: number;
        created_at?: number;
        detected_type?: string;
        detected_label?: string;
        filename?: string;
        row_count?: number;
        results?: { ok?: number; skip?: number; fail?: number };
        status?: string;
        rows?: unknown[];
      };
      if (u.status === 'deleted') continue;
      const results = u.results ?? {};
      const st = String(u.status ?? '').toLowerCase();
      const committed_label =
        st === 'processed' ? '완료'
        : st === 'partial' ? '부분'
        : st === 'error' ? '오류'
        : st === 'pending' ? '대기'
        : (u.status || '-');
      out.push({
        _id: id,
        _direct: false,
        _raw: u,
        uploaded_at: u.uploaded_at ?? u.created_at,
        method: 'bulk',
        method_label: '대량',
        type: normalizeType(u.detected_type ?? u.detected_label),
        type_label: u.detected_label ?? u.detected_type ?? '-',
        filename: u.filename ?? '',
        total: u.row_count ?? 0,
        ok: results.ok ?? 0,
        skip: results.skip ?? 0,
        fail: results.fail ?? 0,
        committed_label,
      });
    }
  }

  // 개별입력 집계
  directSnaps.forEach((snap, i) => {
    if (!snap?.exists()) return;
    const src = DIRECT_SOURCES[i];
    const buckets: Record<string, { ts: number; records: Record<string, unknown>[] }> = {};
    const all = snap.val() as Record<string, Record<string, unknown>>;
    for (const r of Object.values(all)) {
      if (!r || (r as { status?: string }).status === 'deleted') continue;
      if ((r as { upload_id?: string }).upload_id) continue;
      const ts = Number((r as { created_at?: number }).created_at ?? 0);
      if (!ts) continue;
      const d = new Date(ts);
      const p = (n: number) => String(n).padStart(2, '0');
      const dayKey = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).getTime();
      if (!buckets[dayKey]) buckets[dayKey] = { ts: endOfDay, records: [] };
      buckets[dayKey].records.push(r);
    }
    for (const [dayKey, bucket] of Object.entries(buckets)) {
      out.push({
        _id: `direct_${src.type}_${dayKey}`,
        _direct: true,
        _records: bucket.records,
        uploaded_at: bucket.ts,
        method: 'single',
        method_label: '개별',
        type: src.type,
        type_label: src.label,
        filename: `개별입력 · ${dayKey}`,
        total: bucket.records.length,
        ok: bucket.records.length,
        skip: 0,
        fail: 0,
        committed_label: '완료',
      });
    }
  });

  out.sort((a, b) => (b.uploaded_at ?? 0) - (a.uploaded_at ?? 0));
  return out;
}

export function useInputHistory() {
  return useQuery({
    queryKey: ['input-history'],
    queryFn: fetchInputHistory,
    staleTime: 30_000,
  });
}
