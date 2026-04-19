'use client';

import { ref, onValue, off, type Database, type DatabaseReference } from 'firebase/database';
import { useCallback, useSyncExternalStore } from 'react';
import { getRtdb } from '@/lib/firebase/rtdb';

/** 앱 선택: 'main' = jpkerp (기본), 'freepass' = freepasserp3 (공유 마스터) */
export type DbApp = 'main' | 'freepass';

/**
 * RTDB 컬렉션 실시간 구독 — 모듈 레벨 캐시 + 단일 리스너 공유.
 * 같은 path를 여러 컴포넌트가 호출해도 리스너 1개, 데이터 레퍼런스 1개 공유.
 *
 * useSyncExternalStore 사용 — 이중 구독/무한 리렌더 방지.
 */

interface Snapshot<T = Record<string, unknown>> {
  data: T[];
  loading: boolean;
  error: Error | null;
}

interface CacheEntry {
  snapshot: Snapshot;
  ref: DatabaseReference;
  unsubscribe: () => void;
  subscribers: Set<() => void>;
  disposeTimer: number | null;
}

const cache = new Map<string, CacheEntry>();

// lazy-loaded db getters (freepass는 dynamic import로 cycle 회피)
const dbGetters: Record<DbApp, () => Promise<Database>> = {
  main: async () => getRtdb(),
  freepass: async () => {
    const m = await import('@/lib/firebase/freepass');
    return m.getFpDb();
  },
};

/** cache key = app:path */
function cacheKey(app: DbApp, path: string) { return `${app}:${path}`; }

const EMPTY_SNAPSHOT: Snapshot = Object.freeze({ data: [], loading: true, error: null });
const EMPTY_SERVER_SNAPSHOT: Snapshot = Object.freeze({ data: [], loading: true, error: null });

function ensureEntry(app: DbApp, path: string): CacheEntry {
  const key = cacheKey(app, path);
  let entry = cache.get(key);
  if (entry) {
    if (entry.disposeTimer !== null) {
      window.clearTimeout(entry.disposeTimer);
      entry.disposeTimer = null;
    }
    return entry;
  }

  const e: CacheEntry = {
    snapshot: EMPTY_SNAPSHOT,
    ref: null as unknown as DatabaseReference,
    unsubscribe: () => { /* patched below */ },
    subscribers: new Set(),
    disposeTimer: null,
  };
  cache.set(key, e);

  // 비동기 db 획득 후 리스너 등록
  dbGetters[app]().then((db) => {
    if (!cache.has(key)) return; // 이미 disposed
    const r = ref(db, path);
    e.ref = r;
    const handler = onValue(
      r,
      (snap) => {
        const val = snap.val() || {};
        const items = Object.entries(val).map(([k, v]) => ({
          ...(v as Record<string, unknown>),
          _key: k,
        }));
        const filtered = items.filter((it) => (it as { status?: string }).status !== 'deleted');
        filtered.sort(
          (a, b) =>
            (Number((b as { created_at?: number }).created_at) || 0) -
            (Number((a as { created_at?: number }).created_at) || 0),
        );
        e.snapshot = { data: filtered, loading: false, error: null };
        for (const cb of e.subscribers) cb();
      },
      (err) => {
        e.snapshot = { data: [], loading: false, error: err };
        for (const cb of e.subscribers) cb();
      },
    );
    e.unsubscribe = () => off(r, 'value', handler);
  }).catch((err) => {
    e.snapshot = { data: [], loading: false, error: err as Error };
    for (const cb of e.subscribers) cb();
  });

  return e;
}

function subscribe(app: DbApp, path: string, cb: () => void): () => void {
  if (!path) return () => { /* noop */ };
  const key = cacheKey(app, path);
  const entry = ensureEntry(app, path);
  entry.subscribers.add(cb);
  return () => {
    entry.subscribers.delete(cb);
    if (entry.subscribers.size === 0) {
      entry.disposeTimer = window.setTimeout(() => {
        if (entry.subscribers.size === 0) {
          entry.unsubscribe();
          cache.delete(key);
        }
      }, 3000);
    }
  };
}

function getSnapshot<T extends Record<string, unknown>>(app: DbApp, path: string): Snapshot<T> {
  const entry = cache.get(cacheKey(app, path));
  return (entry?.snapshot ?? EMPTY_SNAPSHOT) as Snapshot<T>;
}

export function useRtdbCollection<T extends Record<string, unknown>>(
  path: string,
  opts: { app?: DbApp } = {},
): Snapshot<T> {
  const app = opts.app ?? 'main';
  const sub = useCallback((cb: () => void) => subscribe(app, path, cb), [app, path]);
  const snap = useCallback(() => getSnapshot<T>(app, path), [app, path]);
  const server = useCallback(() => EMPTY_SERVER_SNAPSHOT as Snapshot<T>, []);
  return useSyncExternalStore(sub, snap, server);
}
