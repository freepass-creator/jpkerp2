'use client';

import { useSaveStore, useSaveStatusAutoReset } from '@/lib/hooks/useSaveStatus';

/**
 * 상단바에 저장 상태 표시 — 저장중 / 저장됨 / 저장실패.
 * idle 상태면 아무것도 렌더링하지 않음 (공간 낭비 방지).
 */
export function SaveStatusIndicator() {
  useSaveStatusAutoReset();
  const { status, message, errorMsg } = useSaveStore();

  if (status === 'idle') return null;

  if (status === 'saving') {
    return (
      <span className="save-status is-saving" title={message || '저장 중'}>
        <i className="ph ph-spinner spin" />
        <span>{message ?? '저장 중'}</span>
      </span>
    );
  }

  if (status === 'saved') {
    return (
      <span className="save-status is-saved" title={message || '저장됨'}>
        <i className="ph ph-check-circle" />
        <span>{message ?? '저장됨'}</span>
      </span>
    );
  }

  return (
    <span className="save-status is-error" title={errorMsg}>
      <i className="ph ph-warning-circle" />
      <span>저장 실패</span>
    </span>
  );
}
