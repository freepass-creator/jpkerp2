'use client';

import { useEffect, useRef, useState } from 'react';
import { useMenuCounts } from '@/lib/stores/menu-counts';
import Link from 'next/link';

interface Alert {
  href: string;
  label: string;
  count: number;
  icon: string;
  tone: 'danger' | 'warn' | 'primary';
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const counts = useMenuCounts((s) => s.counts);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const alerts: Alert[] = [
    counts.overdue > 0 && { href: '/status/overdue', label: '미납 건', count: counts.overdue, icon: 'ph-warning-circle', tone: 'danger' as const },
    counts.pending > 0 && { href: '/status/pending', label: '미결업무', count: counts.pending, icon: 'ph-shield-check', tone: 'danger' as const },
    counts.ignition > 0 && { href: '/status/ignition', label: '시동제어 진행', count: counts.ignition, icon: 'ph-warning-octagon', tone: 'danger' as const },
    counts.expiring > 0 && { href: '/status/expiring', label: '만기 임박 계약', count: counts.expiring, icon: 'ph-clock-countdown', tone: 'warn' as const },
    counts.idle > 0 && { href: '/status/idle', label: '휴차 차량', count: counts.idle, icon: 'ph-pause-circle', tone: 'warn' as const },
  ].filter(Boolean) as Alert[];

  const totalUrgent = counts.overdue + counts.pending + counts.ignition;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="알림"
        className="btn btn-icon relative"
      >
        <i className="ph ph-bell" />
        {totalUrgent > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 3,
              right: 3,
              width: 6,
              height: 6,
              background: 'var(--c-danger)',
              borderRadius: '50%',
              boxShadow: '0 0 0 2px var(--c-bg)',
            }}
          />
        )}
      </button>
      {open && (
        <div
          className="absolute right-0 top-9 bg-surface border border-border shadow-md overflow-hidden z-40"
          style={{ borderRadius: 2, width: 300 }}
        >
          <div className="flex items-center px-3 h-9 border-b border-border">
            <div className="font-bold">알림</div>
            <div className="ml-auto text-xs text-text-muted">
              {alerts.length > 0 ? `긴급 ${totalUrgent}건` : '모든 업무 완료'}
            </div>
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-text-muted text-xs">
                <i className="ph ph-check-circle text-success" style={{ fontSize: 32 }} />
                <div>처리할 알림이 없습니다</div>
              </div>
            ) : (
              alerts.map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 h-11 hover:bg-bg-hover"
                  style={{ textDecoration: 'none', borderBottom: '1px solid var(--c-border)' }}
                >
                  <i
                    className={`ph ${a.icon} text-[15px]`} style={{ color: a.tone === 'danger' ? 'var(--c-danger)' : a.tone === 'warn' ? 'var(--c-warn)' : 'var(--c-primary)' }}
                  />
                  <div className="text-base" style={{ flex: 1 }}>{a.label}</div>
                  <span
                    className={`badge ${a.tone === 'danger' ? 'badge-danger' : a.tone === 'warn' ? 'badge-warn' : 'badge-primary'}`}
                    style={{ fontWeight: 700 }}
                  >
                    {a.count}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
