'use client';

import { useState } from 'react';
import { ref, get, update, remove } from 'firebase/database';
import { toast } from 'sonner';
import { getRtdb } from '@/lib/firebase/rtdb';
import { useAuth } from '@/lib/auth/context';
import { can } from '@/lib/auth/rbac';
import { EVENT_META } from '@/lib/event-meta';
import { ToolActions } from '../tool-actions-context';

/* ── 마스터 컬렉션 ── */
const MASTER_COLLECTIONS = [
  { key: 'assets', label: '자산 (차량)', icon: 'ph-car' },
  { key: 'contracts', label: '계약', icon: 'ph-handshake' },
  { key: 'customers', label: '고객', icon: 'ph-user-circle' },
  { key: 'partners', label: '회원사', icon: 'ph-buildings' },
  { key: 'vendors', label: '거래처', icon: 'ph-briefcase' },
  { key: 'billings', label: '수납', icon: 'ph-receipt' },
  { key: 'insurances', label: '보험 마스터', icon: 'ph-shield-check' },
  { key: 'loans', label: '할부', icon: 'ph-bank' },
  { key: 'autodebits', label: '자동이체', icon: 'ph-arrows-clockwise' },
  { key: 'gps_devices', label: 'GPS', icon: 'ph-navigation-arrow' },
  { key: 'tasks', label: '업무', icon: 'ph-check-square' },
  { key: 'uploads', label: '업로드 이력', icon: 'ph-upload-simple' },
] as const;

/* ── 이벤트 타입 (events 컬렉션 내 type별) ── */
const EVENT_TYPES = [
  'contact', 'delivery', 'return', 'force', 'transfer', 'key',
  'maint', 'accident', 'repair', 'penalty', 'product',
  'insurance', 'collect', 'wash', 'fuel', 'bank_tx', 'card_tx',
] as const;

type DeleteMode = 'soft' | 'hard';

export function DataPurgeTool() {
  const { user } = useAuth();
  const canDelete = user ? can(user.role, 'delete.master') : false;
  const [mode, setMode] = useState<DeleteMode>('soft');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const toggleMaster = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleEvent = (type: string) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  };

  const selectAllMasters = () => {
    if (selected.size === MASTER_COLLECTIONS.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(MASTER_COLLECTIONS.map((c) => c.key)));
    }
  };

  const selectAllEvents = () => {
    if (selectedEvents.size === EVENT_TYPES.length) {
      setSelectedEvents(new Set());
    } else {
      setSelectedEvents(new Set(EVENT_TYPES));
    }
  };

  const run = async () => {
    if (!canDelete) { toast.error('삭제 권한 없음 (admin 필요)'); return; }
    if (selected.size === 0 && selectedEvents.size === 0) {
      toast.info('삭제할 항목을 선택하세요');
      return;
    }

    const targets: string[] = [
      ...Array.from(selected).map((k) => MASTER_COLLECTIONS.find((c) => c.key === k)?.label ?? k),
      ...Array.from(selectedEvents).map((t) => EVENT_META[t]?.label ?? t),
    ];
    const modeLabel = mode === 'hard' ? '완전 삭제 (복구 불가)' : '소프트 삭제 (복구 가능)';

    if (!confirm(`⚠ ${modeLabel}\n\n대상:\n${targets.map((t) => `  • ${t}`).join('\n')}\n\n진행하시겠습니까?`)) return;
    if (mode === 'hard' && !confirm('⛔ 완전 삭제는 복구할 수 없습니다.\n정말 진행하시겠습니까?')) return;

    setBusy(true);
    setResult(null);
    const log: string[] = [];

    try {
      const db = getRtdb();

      // 1) 마스터 컬렉션 삭제
      for (const key of selected) {
        const snap = await get(ref(db, key));
        if (!snap.exists()) { log.push(`${key}: 데이터 없음`); continue; }
        const entries = snap.val() as Record<string, Record<string, unknown>>;
        const keys = Object.keys(entries);
        if (keys.length === 0) { log.push(`${key}: 0건`); continue; }

        if (mode === 'hard') {
          await remove(ref(db, key));
          log.push(`${key}: ${keys.length}건 완전 삭제`);
        } else {
          const updates: Record<string, unknown> = {};
          for (const k of keys) {
            if (entries[k]?.status !== 'deleted') {
              updates[`${key}/${k}/status`] = 'deleted';
              updates[`${key}/${k}/deleted_at`] = Date.now();
            }
          }
          const count = Object.keys(updates).length / 2;
          if (count > 0) {
            await update(ref(db), updates);
            log.push(`${key}: ${count}건 소프트 삭제`);
          } else {
            log.push(`${key}: 삭제 대상 없음 (이미 삭제됨)`);
          }
        }
      }

      // 2) 이벤트 타입별 삭제
      if (selectedEvents.size > 0) {
        const snap = await get(ref(db, 'events'));
        if (snap.exists()) {
          const events = snap.val() as Record<string, { type?: string; status?: string }>;
          const updates: Record<string, unknown> = {};
          const hardDeleteKeys: string[] = [];
          let countByType: Record<string, number> = {};

          for (const [k, v] of Object.entries(events)) {
            if (!v?.type || !selectedEvents.has(v.type)) continue;
            if (mode === 'soft' && v.status === 'deleted') continue;
            countByType[v.type] = (countByType[v.type] || 0) + 1;

            if (mode === 'hard') {
              hardDeleteKeys.push(k);
            } else {
              updates[`events/${k}/status`] = 'deleted';
              updates[`events/${k}/deleted_at`] = Date.now();
            }
          }

          if (mode === 'hard' && hardDeleteKeys.length > 0) {
            const delUpdates: Record<string, null> = {};
            for (const k of hardDeleteKeys) delUpdates[`events/${k}`] = null;
            await update(ref(db), delUpdates);
          } else if (Object.keys(updates).length > 0) {
            await update(ref(db), updates);
          }

          for (const type of selectedEvents) {
            const meta = EVENT_META[type];
            const count = countByType[type] || 0;
            log.push(`이벤트/${meta?.label ?? type}: ${count}건 ${mode === 'hard' ? '완전' : '소프트'} 삭제`);
          }
        } else {
          log.push('events: 데이터 없음');
        }
      }

      setResult(log.join('\n'));
      toast.success('삭제 완료');
      setSelected(new Set());
      setSelectedEvents(new Set());
    } catch (err) {
      toast.error(`삭제 실패: ${(err as Error).message}`);
      setResult(`에러: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const totalSelected = selected.size + selectedEvents.size;

  return (
    <div className="overflow-y-auto scrollbar-thin" style={{ height: '100%', padding: 16 }}>
      <ToolActions>
        <button
          type="button"
          className="btn btn-sm btn-danger"
          onClick={run}
          disabled={!canDelete || busy || totalSelected === 0}
        >
          <i className={`ph ${busy ? 'ph-spinner spin' : 'ph-trash'}`} />
          선택 {totalSelected}건 삭제
        </button>
      </ToolActions>

      {!canDelete && (
        <div className="text-xs text-text-muted" style={{ padding: 8, background: 'var(--c-bg-sub)', marginBottom: 12, borderRadius: 2 }}>
          <i className="ph ph-info" style={{ marginRight: 4 }} />
          삭제는 admin 이상 권한 필요. 현재 역할: <b>{user?.role ?? '—'}</b>
        </div>
      )}

      {/* 삭제 모드 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          className={`btn btn-sm ${mode === 'soft' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setMode('soft')}
        >
          <i className="ph ph-eye-slash" />
          소프트 삭제
        </button>
        <button
          type="button"
          className={`btn btn-sm ${mode === 'hard' ? 'btn-danger' : 'btn-outline'}`}
          onClick={() => setMode('hard')}
        >
          <i className="ph ph-fire" />
          완전 삭제
        </button>
        <span className="text-xs text-text-muted" style={{ alignSelf: 'center' }}>
          {mode === 'soft' ? 'status=deleted 처리 (복구 가능)' : '⛔ DB에서 영구 제거 (복구 불가)'}
        </span>
      </div>

      {/* 마스터 데이터 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span className="text-sm" style={{ fontWeight: 600 }}>마스터 데이터</span>
          <button type="button" className="btn btn-2xs btn-outline" onClick={selectAllMasters}>
            {selected.size === MASTER_COLLECTIONS.length ? '전체 해제' : '전체 선택'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
          {MASTER_COLLECTIONS.map((c) => {
            const checked = selected.has(c.key);
            return (
              <label
                key={c.key}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', borderRadius: 2, cursor: 'pointer',
                  border: `1px solid ${checked ? 'var(--c-danger)' : 'var(--c-border)'}`,
                  background: checked ? 'var(--c-danger-bg, #fef2f2)' : 'transparent',
                }}
              >
                <input type="checkbox" checked={checked} onChange={() => toggleMaster(c.key)} style={{ accentColor: 'var(--c-danger)' }} />
                <i className={`ph ${c.icon} text-text-sub`} />
                <span className="text-sm">{c.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 운영 이벤트 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span className="text-sm" style={{ fontWeight: 600 }}>운영 이벤트 (유형별)</span>
          <button type="button" className="btn btn-2xs btn-outline" onClick={selectAllEvents}>
            {selectedEvents.size === EVENT_TYPES.length ? '전체 해제' : '전체 선택'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6 }}>
          {EVENT_TYPES.map((type) => {
            const meta = EVENT_META[type];
            const checked = selectedEvents.has(type);
            return (
              <label
                key={type}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', borderRadius: 2, cursor: 'pointer',
                  border: `1px solid ${checked ? 'var(--c-danger)' : 'var(--c-border)'}`,
                  background: checked ? 'var(--c-danger-bg, #fef2f2)' : 'transparent',
                }}
              >
                <input type="checkbox" checked={checked} onChange={() => toggleEvent(type)} style={{ accentColor: 'var(--c-danger)' }} />
                <i className={`ph ${meta?.icon ?? 'ph-circle'}`} style={{ color: meta?.color }} />
                <span className="text-sm">{meta?.label ?? type}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 결과 로그 */}
      {result && (
        <div style={{ padding: 12, background: 'var(--c-bg-sub)', borderRadius: 2, marginTop: 12 }}>
          <div className="text-sm" style={{ fontWeight: 600, marginBottom: 6 }}>
            <i className="ph ph-check-circle" style={{ color: 'var(--c-success)', marginRight: 4 }} />
            삭제 결과
          </div>
          <pre className="text-xs" style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.6 }}>{result}</pre>
        </div>
      )}
    </div>
  );
}
