'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ref, get, update } from 'firebase/database';
import { toast } from 'sonner';
import { getRtdb } from '@/lib/firebase/rtdb';
import { useAuth } from '@/lib/auth/context';
import { can } from '@/lib/auth/rbac';
import { fmt } from '@/lib/utils';
import { ToolActions } from '../tool-actions-context';

const COLLECTIONS = [
  { key: 'assets', label: '자산', icon: 'ph-car' },
  { key: 'contracts', label: '계약', icon: 'ph-handshake' },
  { key: 'customers', label: '고객', icon: 'ph-user-circle' },
  { key: 'partners', label: '회원사', icon: 'ph-buildings' },
  { key: 'vendors', label: '거래처', icon: 'ph-briefcase' },
  { key: 'events', label: '운영이력', icon: 'ph-stack' },
  { key: 'billings', label: '수납', icon: 'ph-receipt' },
  { key: 'uploads', label: '업로드 이력', icon: 'ph-upload-simple' },
  { key: 'insurances', label: '보험', icon: 'ph-shield-check' },
  { key: 'loans', label: '할부', icon: 'ph-bank' },
  { key: 'autodebits', label: '자동이체', icon: 'ph-arrows-clockwise' },
  { key: 'users', label: '사용자', icon: 'ph-users-three' },
  { key: 'tasks', label: '업무', icon: 'ph-check-square' },
  { key: 'gps_devices', label: 'GPS', icon: 'ph-navigation-arrow' },
] as const;

async function fetchCounts() {
  const db = getRtdb();
  const snaps = await Promise.all(
    COLLECTIONS.map(async (c) => {
      try {
        const snap = await get(ref(db, c.key));
        if (!snap.exists()) return { key: c.key, total: 0, active: 0, deleted: 0, size: 0 };
        const val = snap.val() as Record<string, { status?: string }>;
        const entries = Object.values(val);
        const deleted = entries.filter((r) => r?.status === 'deleted').length;
        return {
          key: c.key,
          total: entries.length,
          active: entries.length - deleted,
          deleted,
          size: JSON.stringify(val).length,
        };
      } catch {
        return { key: c.key, total: 0, active: 0, deleted: 0, size: 0 };
      }
    }),
  );
  return snaps;
}

export function RtdbStatusTool() {
  const { user } = useAuth();
  const canDelete = user ? can(user.role, 'delete.master') : false;
  const qc = useQueryClient();
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['dev', 'rtdb-status'],
    queryFn: fetchCounts,
    staleTime: 10_000,
  });
  const [uploadId, setUploadId] = useState('');
  const [deletingCol, setDeletingCol] = useState<string | null>(null);
  const [deletingUpload, setDeletingUpload] = useState(false);

  const deleteAll = async (col: string, label: string, count: number) => {
    if (!canDelete) { toast.error('삭제 권한 없음 (admin 필요)'); return; }
    if (count === 0) { toast.info('삭제할 데이터 없음'); return; }
    if (!confirm(`⚠ "${label}" ${count}건 전체 소프트 삭제합니다.\n복구 가능하지만 조회에서 빠집니다.\n진행?`)) return;
    if (!confirm(`마지막 확인: "${label}" 전체 삭제`)) return;
    setDeletingCol(col);
    try {
      const snap = await get(ref(getRtdb(), col));
      if (!snap.exists()) { toast.info('데이터 없음'); return; }
      const updates: Record<string, unknown> = {};
      for (const k of Object.keys(snap.val() as Record<string, unknown>)) {
        updates[`${col}/${k}/status`] = 'deleted';
        updates[`${col}/${k}/deleted_at`] = Date.now();
      }
      await update(ref(getRtdb()), updates);
      toast.success(`${label} ${Object.keys(updates).length / 2}건 삭제`);
      qc.invalidateQueries({ queryKey: ['dev', 'rtdb-status'] });
    } catch (err) {
      toast.error(`삭제 실패: ${(err as Error).message}`);
    } finally {
      setDeletingCol(null);
    }
  };

  const deleteByUpload = async () => {
    if (!canDelete) { toast.error('삭제 권한 없음'); return; }
    const id = uploadId.trim();
    if (!id) { toast.info('upload_id 입력 필요'); return; }
    setDeletingUpload(true);
    try {
      const db = getRtdb();
      const paths = ['events', 'assets', 'contracts', 'customers', 'billings', 'insurances', 'loans'];
      const updates: Record<string, unknown> = {};
      let count = 0;
      for (const p of paths) {
        const snap = await get(ref(db, p));
        if (!snap.exists()) continue;
        for (const [k, v] of Object.entries(snap.val() as Record<string, { upload_id?: string }>)) {
          if (v?.upload_id === id) {
            updates[`${p}/${k}/status`] = 'deleted';
            updates[`${p}/${k}/deleted_at`] = Date.now();
            count++;
          }
        }
      }
      if (count === 0) { toast.info('해당 upload_id로 생성된 데이터 없음'); return; }
      if (!confirm(`upload_id=${id}로 생성된 ${count}건을 소프트 삭제합니다. 진행?`)) return;
      await update(ref(db), updates);
      toast.success(`${count}건 삭제`);
      setUploadId('');
      qc.invalidateQueries({ queryKey: ['dev', 'rtdb-status'] });
    } catch (err) {
      toast.error(`삭제 실패: ${(err as Error).message}`);
    } finally {
      setDeletingUpload(false);
    }
  };

  const total = data?.reduce((s, c) => s + c.total, 0) ?? 0;
  const totalActive = data?.reduce((s, c) => s + c.active, 0) ?? 0;
  const totalSize = data?.reduce((s, c) => s + c.size, 0) ?? 0;

  return (
    <div className="overflow-y-auto scrollbar-thin" style={{ height: '100%', padding: 16 }}>
      <ToolActions>
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <i className={`ph ${isFetching ? 'ph-spinner spin' : 'ph-arrows-clockwise'}`} />
          새로고침
        </button>
      </ToolActions>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div>
          <span className="text-text-muted" style={{ fontSize: 11 }}>전체</span>
          <span style={{ fontSize: 18, fontWeight: 700, marginLeft: 6 }}>{fmt(total)}</span>
          <span className="text-text-muted" style={{ fontSize: 11, marginLeft: 4 }}>건</span>
          <span className="text-text-muted" style={{ fontSize: 11, marginLeft: 10 }}>활성 {fmt(totalActive)}</span>
          <span className="text-text-muted" style={{ fontSize: 11, marginLeft: 10 }}>용량 ≈ {fmt(Math.round(totalSize / 1024))} KB</span>
        </div>
      </div>

      {!canDelete && (
        <div style={{ padding: 8, background: 'var(--c-bg-sub)', fontSize: 11, color: 'var(--c-text-muted)', marginBottom: 12, borderRadius: 2 }}>
          <i className="ph ph-info" style={{ marginRight: 4 }} />
          삭제는 admin 이상 권한 필요. 현재 역할: <b>{user?.role ?? '—'}</b>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center text-text-muted" style={{ padding: 40 }}>
          <i className="ph ph-spinner spin" />로드 중
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10, marginBottom: 20 }}>
            {COLLECTIONS.map((c) => {
              const row = data?.find((x) => x.key === c.key);
              const busy = deletingCol === c.key;
              return (
                <div key={c.key} className="panel" style={{ padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <i className={`ph ${c.icon}`} style={{ fontSize: 20, color: 'var(--c-text-sub)' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>
                        {c.label} <span style={{ fontFamily: 'monospace', fontSize: 10 }}>/{c.key}</span>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>
                        {fmt(row?.active ?? 0)}
                        {(row?.deleted ?? 0) > 0 && (
                          <span className="text-text-muted" style={{ fontSize: 10, fontWeight: 400, marginLeft: 4 }}>
                            (+{fmt(row?.deleted ?? 0)} del)
                          </span>
                        )}
                      </div>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--c-text-muted)' }}>
                      {fmt(Math.round((row?.size ?? 0) / 1024))}KB
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    style={{ width: '100%', color: 'var(--c-danger)', fontSize: 11 }}
                    onClick={() => deleteAll(c.key, c.label, row?.active ?? 0)}
                    disabled={!canDelete || busy || (row?.active ?? 0) === 0}
                  >
                    <i className={`ph ${busy ? 'ph-spinner spin' : 'ph-trash'}`} />
                    전체 삭제
                  </button>
                </div>
              );
            })}
          </div>

          {/* upload_id 기준 삭제 */}
          <div className="panel" style={{ padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>업로드 단위 삭제</div>
            <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginBottom: 8 }}>
              특정 <code style={{ fontFamily: 'monospace' }}>upload_id</code>로 생성된 레코드를 모든 컬렉션에서 일괄 soft-delete
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={uploadId}
                onChange={(e) => setUploadId(e.target.value)}
                placeholder="upload_id"
                className="ctrl"
                style={{ flex: 1, height: 30, fontSize: 12 }}
              />
              <button
                type="button"
                className="btn btn-sm btn-outline"
                style={{ color: 'var(--c-danger)' }}
                onClick={deleteByUpload}
                disabled={!canDelete || deletingUpload || !uploadId.trim()}
              >
                <i className={`ph ${deletingUpload ? 'ph-spinner spin' : 'ph-trash'}`} />
                삭제
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
