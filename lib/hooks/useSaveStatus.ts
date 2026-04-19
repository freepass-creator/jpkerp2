'use client';

import { useEffect } from 'react';
import { create } from 'zustand';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface SaveStore {
  status: SaveStatus;
  message?: string;
  lastSavedAt?: number;
  errorMsg?: string;
  begin: (msg?: string) => void;
  success: (msg?: string) => void;
  fail: (msg: string) => void;
  reset: () => void;
}

export const useSaveStore = create<SaveStore>((set) => ({
  status: 'idle',
  begin: (message) => set({ status: 'saving', message, errorMsg: undefined }),
  success: (message) =>
    set({ status: 'saved', message, lastSavedAt: Date.now(), errorMsg: undefined }),
  fail: (errorMsg) => set({ status: 'error', errorMsg }),
  reset: () => set({ status: 'idle', message: undefined, errorMsg: undefined }),
}));

/**
 * `saved` 상태를 2.5초 후 자동 idle로 돌림.
 */
export function useSaveStatusAutoReset() {
  const status = useSaveStore((s) => s.status);
  const reset = useSaveStore((s) => s.reset);
  useEffect(() => {
    if (status !== 'saved') return;
    const t = setTimeout(() => reset(), 2500);
    return () => clearTimeout(t);
  }, [status, reset]);
}

/**
 * 비동기 작업을 자동으로 저장 상태에 래핑.
 */
export async function withSaveStatus<T>(
  op: () => Promise<T>,
  opts?: { begin?: string; success?: string },
): Promise<T> {
  const store = useSaveStore.getState();
  store.begin(opts?.begin ?? '저장 중');
  try {
    const r = await op();
    store.success(opts?.success ?? '저장됨');
    return r;
  } catch (err) {
    store.fail((err as Error).message || '저장 실패');
    throw err;
  }
}
