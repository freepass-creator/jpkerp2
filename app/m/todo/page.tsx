'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRtdbCollection } from '@/lib/collections/rtdb';
import { computeDashboardStats } from '@/lib/dashboard-stats';
import { fmt } from '@/lib/utils';

export default function MobileTodo() {
  const assets = useRtdbCollection<Record<string, unknown>>('assets');
  const contracts = useRtdbCollection<Record<string, unknown>>('contracts');
  const billings = useRtdbCollection<Record<string, unknown>>('billings');
  const events = useRtdbCollection<Record<string, unknown>>('events');

  const stats = useMemo(() => {
    if (assets.loading || contracts.loading || billings.loading || events.loading) return null;
    return computeDashboardStats({
      assets: assets.data,
      contracts: contracts.data,
      billings: billings.data,
      events: events.data,
    });
  }, [assets, contracts, billings, events]);

  if (!stats) {
    return (
      <div className="m-title">
        할 일<div className="m-subtitle">집계 중...</div>
      </div>
    );
  }

  const items = [
    { icon: 'ph-warning-circle', label: '미납', count: stats.overdue_count, sub: `${fmt(Math.round(stats.overdue_amount))}원`, href: '/status/overdue' },
    { icon: 'ph-clock-countdown', label: '만기 임박 (14일)', count: stats.month_expiring_14d, sub: '계약 만기', href: '/status/expiring' },
    { icon: 'ph-truck', label: '출고 대기', count: stats.pending_tasks.not_delivered, sub: '', href: '/status/pending' },
    { icon: 'ph-warning-octagon', label: '사고 미종결', count: stats.pending_tasks.open_accidents, sub: '', href: '/status/pending' },
    { icon: 'ph-wrench', label: '차량케어 진행중', count: stats.pending_tasks.open_works, sub: '', href: '/status/pending' },
    { icon: 'ph-phone', label: '응대 진행중', count: stats.pending_tasks.open_contacts, sub: '', href: '/operation/contact' },
    { icon: 'ph-warning-circle', label: '통장·카드 미매칭', count: stats.pending_tasks.unmatched_bank, sub: '', href: '/ledger' },
  ];

  return (
    <div>
      <div className="m-title">할 일</div>
      <div className="m-subtitle">오늘 처리해야 할 업무</div>

      {items.map((it) => (
        <Link key={it.label} href={it.href} className="m-list-item">
          <i className={`ph ${it.icon}`} style={{ color: it.count > 0 ? 'var(--c-warn)' : 'var(--c-text-muted)' }} />
          <div className="m-list-item-body">
            <div className="m-list-item-label">{it.label}</div>
            {it.sub && <div className="m-list-item-sub">{it.sub}</div>}
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: it.count > 0 ? 'var(--c-text)' : 'var(--c-text-muted)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {it.count}
          </div>
        </Link>
      ))}
    </div>
  );
}
