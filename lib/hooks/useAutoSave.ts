'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface AutoSaveOptions<T> {
  initial: T;
  save: (value: T) => Promise<void>;
  debounceMs?: number;
  label?: string;         // 토스트에 쓰일 필드 이름 ("계약자명" 등)
  enabled?: boolean;
}

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

/**
 * 인라인 편집 + 자동 저장 + Undo 토스트 패턴
 *
 * - 값 변경 후 debounce(기본 500ms) 경과하면 save()
 * - 저장 성공 시 Undo 토스트 5초 노출
 * - 사용자가 Undo 누르면 이전 값으로 setValue() + save(prev)
 */
export function useAutoSave<T>({
  initial,
  save,
  debounceMs = 500,
  label,
  enabled = true,
}: AutoSaveOptions<T>) {
  const [value, setValue] = useState<T>(initial);
  const [state, setState] = useState<SaveState>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCommittedRef = useRef<T>(initial);

  useEffect(() => {
    setValue(initial);
    lastCommittedRef.current = initial;
  }, [initial]);

  const flush = useCallback(
    async (next: T) => {
      const prev = lastCommittedRef.current;
      if (Object.is(prev, next)) {
        setState('idle');
        return;
      }
      setState('saving');
      try {
        await save(next);
        lastCommittedRef.current = next;
        setState('saved');

        // Undo 토스트
        toast.success(label ? `${label} 저장됨` : '저장됨', {
          action: {
            label: '되돌리기',
            onClick: async () => {
              setValue(prev);
              setState('saving');
              try {
                await save(prev);
                lastCommittedRef.current = prev;
                setState('saved');
                setTimeout(() => setState('idle'), 1500);
              } catch (err) {
                setState('error');
                toast.error('되돌리기 실패');
              }
            },
          },
          duration: 5000,
        });

        // 2초 뒤 idle
        setTimeout(() => {
          setState((s) => (s === 'saved' ? 'idle' : s));
        }, 2000);
      } catch (err) {
        setState('error');
        toast.error(`${label ?? '저장'} 실패 — ${(err as Error).message}`);
      }
    },
    [save, label],
  );

  const schedule = useCallback(
    (next: T) => {
      setValue(next);
      if (!enabled) return;
      setState('dirty');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => flush(next), debounceMs);
    },
    [flush, debounceMs, enabled],
  );

  // 언마운트 시 pending flush
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const commitNow = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    flush(value);
  }, [flush, value]);

  return { value, setValue: schedule, state, commitNow };
}
