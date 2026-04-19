'use client';

import { type FormEvent, type ReactNode, useRef } from 'react';
import { toast } from 'sonner';
import { ref, push, serverTimestamp } from 'firebase/database';
import { getRtdb } from '@/lib/firebase/rtdb';
import { useAuth } from '@/lib/auth/context';
import { useSaveStore } from '@/lib/hooks/useSaveStatus';

interface Props {
  /** RTDB collection path (예: 'customers', 'assets', 'contracts', 'tasks') */
  collection: string;
  /** 폼 제출 시 저장할 payload 빌드 */
  buildPayload: (data: Record<string, string>) => Record<string, unknown>;
  /** 저장 후 추가 작업 (ID 연결, 이벤트 생성 등) */
  afterSave?: (key: string, payload: Record<string, unknown>) => Promise<void>;
  /** 저장 성공 후 폼 초기화 콜백 */
  onSaved?: () => void;
  /** 저장 전 유효성 체크 — false 반환 시 중단 */
  validate?: (data: Record<string, string>) => string | null;
  children: ReactNode;
}

/**
 * 개별입력 공통 폼 shell — panel-head 버튼(form="inputForm")과 연결.
 * 운영업무 폼(OpFormBase)와 동일한 save flow.
 */
export function InputFormShell({ collection, buildPayload, afterSave, onSaved, validate, children }: Props) {
  const { user } = useAuth();
  const formRef = useRef<HTMLFormElement | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const saveStore = useSaveStore.getState();
    const fd = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    fd.forEach((v, k) => { data[k] = String(v ?? ''); });

    if (validate) {
      const err = validate(data);
      if (err) {
        toast.error(err);
        return;
      }
    }

    saveStore.begin('등록 중');
    try {
      const payload = {
        ...buildPayload(data),
        handler_uid: user?.uid,
        handler: user?.displayName ?? user?.email ?? undefined,
        created_at: Date.now(),
        updated_at: serverTimestamp(),
        status: 'active',
      };
      const r = push(ref(getRtdb(), collection));
      const key = r.key!;
      const { set } = await import('firebase/database');
      await set(r, payload);
      if (afterSave) await afterSave(key, payload);
      saveStore.success('등록 완료');
      toast.success('등록 완료');
      formRef.current?.reset();
      onSaved?.();
    } catch (err) {
      saveStore.fail((err as Error).message || '등록 실패');
      toast.error(`등록 실패: ${(err as Error).message}`);
    }
  }

  return (
    <form
      ref={formRef}
      id="inputForm"
      onSubmit={onSubmit}
      className="p-5 overflow-y-auto scrollbar-thin"
      style={{ height: '100%' }}
    >
      {children}
    </form>
  );
}
