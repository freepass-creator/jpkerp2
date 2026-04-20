'use client';

import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useSaveStore } from './useSaveStatus';

interface UseFormSaveOptions {
  /** 저장 성공 시 reset할 form ref */
  formRef: React.RefObject<HTMLFormElement | null>;
  /** 저장 성공 후 콜백 */
  onSaved?: () => void;
  /** 저장 성공 후 추가 정리 (업로더 clear 등) */
  onCleanup?: () => void;
  /** 시작 메시지 */
  beginMsg?: string;
  /** 성공 메시지 */
  successMsg?: string;
  /** 실패 메시지 prefix */
  failPrefix?: string;
}

/**
 * �� 저장 패턴 공통 훅.
 * begin → save 함수 실행 → success/fail + toast + form reset.
 *
 * InputFormShell, OpFormBase 둘 다 이 훅으로 save flow를 공유.
 */
export function useFormSave({
  formRef,
  onSaved,
  onCleanup,
  beginMsg = '등록 중',
  successMsg = '등록 완료',
  failPrefix = '등록 실패',
}: UseFormSaveOptions) {
  const saving = useRef(false);

  const run = useCallback(
    async (saveFn: () => Promise<void>) => {
      if (saving.current) return;
      saving.current = true;
      const saveStore = useSaveStore.getState();
      saveStore.begin(beginMsg);
      try {
        await saveFn();
        saveStore.success(successMsg);
        toast.success(successMsg);
        formRef.current?.reset();
        onCleanup?.();
        onSaved?.();
      } catch (err) {
        const msg = (err as Error).message || failPrefix;
        saveStore.fail(msg);
        toast.error(`${failPrefix}: ${msg}`);
      } finally {
        saving.current = false;
      }
    },
    [formRef, onSaved, onCleanup, beginMsg, successMsg, failPrefix],
  );

  return { run };
}
