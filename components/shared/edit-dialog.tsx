'use client';

import { useEffect, type ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSave: () => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  saving?: boolean;
  children: ReactNode;
  width?: number;
  /** 하단 액션바 좌측에 추가 버튼 (예: 인쇄, 복제) */
  extraActions?: ReactNode;
}

/**
 * 공용 편집 모달 — ESC 닫힘, 바깥 클릭 닫힘, 저장/삭제/취소 버튼.
 */
export function EditDialog({
  open, title, subtitle, onClose, onSave, onDelete, saving, children, width = 560, extraActions,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="edit-dialog-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="edit-dialog"
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="edit-dialog-head">
          <div style={{ minWidth: 0 }}>
            <div className="edit-dialog-title">{title}</div>
            {subtitle && <div className="edit-dialog-subtitle">{subtitle}</div>}
          </div>
          <button
            type="button"
            aria-label="닫기"
            className="edit-dialog-close"
            onClick={onClose}
          >
            <i className="ph ph-x" />
          </button>
        </div>
        <form
          className="edit-dialog-body"
          onSubmit={async (e) => {
            e.preventDefault();
            if (saving) return;
            await onSave();
          }}
        >
          <div className="edit-dialog-content">{children}</div>
          <div className="edit-dialog-actions">
            {onDelete && (
              <button
                type="button"
                className="btn btn-sm btn-danger"
                disabled={saving}
                onClick={async () => {
                  if (!confirm('정말 삭제하시겠습니까?')) return;
                  await onDelete();
                }}
              >
                <i className="ph ph-trash" />삭제
              </button>
            )}
            {extraActions}
            <span style={{ flex: 1 }} />
            <button type="button" className="btn btn-sm btn-outline" onClick={onClose} disabled={saving}>
              취소
            </button>
            <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>
              <i className={`ph ${saving ? 'ph-spinner spin' : 'ph-check'}`} />
              {saving ? '저장 중' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
