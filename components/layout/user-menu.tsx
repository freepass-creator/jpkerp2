'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/context';

const ROLE_LABEL: Record<string, string> = {
  admin: '관리자',
  manager: '매니저',
  operator: '운영자',
  viewer: '열람자',
  staff: '직원',
};

export function UserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="사용자 메뉴"
        className="h-7 flex items-center gap-2 px-2 text-text-sub hover:bg-bg-hover rounded-sm transition-colors duration-fast"
      >
        <div className="w-5 h-5 bg-primary-bg text-primary rounded-xs flex items-center justify-center font-medium text-[10px]">
          {(user.displayName || user.email || '?').slice(0, 1).toUpperCase()}
        </div>
        <span className="text-xs">{user.displayName || user.email}</span>
      </button>
      {open && (
        <div className="absolute top-8 right-0 w-56 bg-surface border border-border shadow-md overflow-hidden z-40 rounded-sm">
          <div className="px-3 py-2 border-b border-border">
            <div className="text-sm font-medium truncate">
              {user.displayName || '이름 없음'}
            </div>
            <div className="text-xs text-text-muted truncate">{user.email}</div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[10px]">
              <span className="badge badge-primary">
                <i className="ph ph-shield-check text-2xs" />
                {ROLE_LABEL[user.role] ?? user.role}
              </span>
              {user.assignedPartners.length > 0 && (
                <span className="text-text-muted">
                  {user.assignedPartners.length}개 회원사
                </span>
              )}
            </div>
          </div>
          <Link
            href="/mypage"
            className="w-full h-8 px-3 text-sm text-left hover:bg-bg-hover flex items-center gap-2"
            onClick={() => setOpen(false)}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <i className="ph ph-user-circle text-text-sub" />
            내 정보
          </Link>
          <button
            type="button"
            onClick={async () => {
              await signOut();
              setOpen(false);
              window.location.href = '/login';
            }}
            className="w-full h-8 px-3 text-sm text-left hover:bg-danger-bg text-danger flex items-center gap-2 border-t border-border"
          >
            <i className="ph ph-sign-out" />
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
