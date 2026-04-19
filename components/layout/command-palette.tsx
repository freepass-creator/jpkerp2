'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useRtdbCollection } from '@/lib/collections/rtdb';
import { computeTotalDue, today } from '@/lib/date-utils';
import type { RtdbAsset, RtdbBilling, RtdbContract } from '@/lib/types/rtdb-entities';
import { cn } from '@/lib/utils';

type CmdKind = 'page' | 'action' | 'asset' | 'contract' | 'customer' | 'unpaid';

interface CmdItem {
  id: string;
  label: string;
  hint?: string;
  kind: CmdKind;
  href?: string;
  sub?: string;
}

const PAGE_ITEMS: CmdItem[] = [
  { id: 'home', label: '대시보드', hint: '⌘1', kind: 'page', href: '/' },
  { id: 'report', label: '통합 리포트', kind: 'page', href: '/status/operation' },
  { id: 'my', label: '내 일감 (대시보드)', kind: 'page', href: '/' },
  { id: 'input-op', label: '운영업무 입력', kind: 'action', href: '/input/operation' },
  { id: 'asset', label: '자산 목록', kind: 'page', href: '/asset' },
  { id: 'contract', label: '계약 관리', kind: 'page', href: '/contract' },
  { id: 'customer', label: '고객 관리', kind: 'page', href: '/customer' },
  { id: 'billing', label: '수납 관리', kind: 'page', href: '/billing' },
  { id: 'ledger', label: '입출금 내역', kind: 'page', href: '/ledger' },
  { id: 'finance', label: '재무 보고', kind: 'page', href: '/finance' },
  { id: 'status-overdue', label: '미납 현황', kind: 'page', href: '/status/overdue' },
  { id: 'status-idle', label: '휴차 현황', kind: 'page', href: '/status/idle' },
  { id: 'status-expiring', label: '만기도래', kind: 'page', href: '/status/expiring' },
  { id: 'status-pending', label: '미결업무', kind: 'page', href: '/status/pending' },
];

type RtdbCustomer = { _key?: string; name?: string; phone?: string; partner_code?: string };

const KIND_LABEL: Record<CmdKind, string> = {
  page: '페이지',
  action: '액션',
  asset: '차량',
  contract: '계약',
  customer: '고객',
  unpaid: '미수',
};

const KIND_CLASS: Record<CmdKind, string> = {
  page: 'badge badge-primary',
  action: 'badge badge-success',
  asset: 'badge badge-info',
  contract: 'badge badge-warn',
  customer: 'badge',
  unpaid: 'badge badge-danger',
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  // 엔티티 데이터 — palette 열릴 때만 구독
  const assets = useRtdbCollection<RtdbAsset>(open ? 'assets' : '');
  const contracts = useRtdbCollection<RtdbContract>(open ? 'contracts' : '');
  const customers = useRtdbCollection<RtdbCustomer>(open ? 'customers' : '');
  const billings = useRtdbCollection<RtdbBilling>(open ? 'billings' : '');

  // 미수 집계 (계약별 unpaid amount + count)
  const unpaidByContract = useMemo(() => {
    if (!open) return new Map<string, { amount: number; count: number }>();
    const t = today();
    const map = new Map<string, { amount: number; count: number }>();
    for (const b of billings.data) {
      if (!b.contract_code) continue;
      const due = computeTotalDue(b);
      const paid = Number(b.paid_total) || 0;
      if (paid < due && b.due_date && b.due_date < t) {
        const cur = map.get(b.contract_code) ?? { amount: 0, count: 0 };
        cur.amount += due - paid;
        cur.count += 1;
        map.set(b.contract_code, cur);
      }
    }
    return map;
  }, [billings.data, open]);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const items = useMemo<CmdItem[]>(() => {
    const q = query.trim().toLowerCase();

    // 페이지 먼저
    const pagesFiltered = q
      ? PAGE_ITEMS.filter((it) => it.label.toLowerCase().includes(q))
      : PAGE_ITEMS.slice(0, 8);

    if (!q) return pagesFiltered;

    // 엔티티 검색 (20개까지)
    const assetHits: CmdItem[] = assets.data
      .filter((a) => {
        if (a.status === 'deleted') return false;
        return (a.car_number?.toLowerCase().includes(q) || a.vin?.toLowerCase().includes(q) || a.manufacturer?.toLowerCase().includes(q) || a.car_model?.toLowerCase().includes(q));
      })
      .slice(0, 10)
      .map((a) => ({
        id: `asset-${a._key}`,
        label: a.car_number ?? '-',
        sub: `${a.manufacturer ?? ''} ${a.car_model ?? ''} · ${a.partner_code ?? ''}`.trim(),
        kind: 'asset',
        href: `/asset/${encodeURIComponent(a.car_number ?? '')}`,
      }));

    const contractHits: CmdItem[] = contracts.data
      .filter((c) => {
        if (c.status === 'deleted') return false;
        return (c.contract_code?.toLowerCase().includes(q) || c.contractor_name?.toLowerCase().includes(q) || c.contractor_phone?.includes(q) || c.car_number?.toLowerCase().includes(q));
      })
      .slice(0, 10)
      .map((c) => ({
        id: `contract-${c._key}`,
        label: c.contractor_name ?? c.contract_code ?? '-',
        sub: `${c.contract_code ?? ''} · ${c.car_number ?? ''} · ${c.contract_status ?? ''}`,
        kind: 'contract',
        href: c.car_number ? `/asset/${encodeURIComponent(c.car_number)}` : '/contract',
      }));

    const customerHits: CmdItem[] = customers.data
      .filter((c) => c.name?.toLowerCase().includes(q) || c.phone?.includes(q))
      .slice(0, 10)
      .map((c) => ({
        id: `customer-${c._key}`,
        label: c.name ?? '-',
        sub: `${c.phone ?? ''} · ${c.partner_code ?? ''}`,
        kind: 'customer',
        href: '/customer',
      }));

    // 미수 검색 — 차량번호 / 계약자명 매치 + 미수 있는 것만
    const unpaidHits: CmdItem[] = contracts.data
      .filter((c) => {
        if (c.status === 'deleted' || !c.contract_code) return false;
        if (!unpaidByContract.has(c.contract_code)) return false;
        return (c.contractor_name?.toLowerCase().includes(q) || c.car_number?.toLowerCase().includes(q));
      })
      .slice(0, 10)
      .map((c) => {
        const u = unpaidByContract.get(c.contract_code!)!;
        return {
          id: `unpaid-${c._key}`,
          label: `${c.contractor_name ?? '-'} · ${c.car_number ?? '-'}`,
          sub: `미납 ${u.amount.toLocaleString()}원 (${u.count}회)`,
          kind: 'unpaid' as const,
          href: c.car_number ? `/asset/${encodeURIComponent(c.car_number)}` : '/billing',
        };
      });

    return [...pagesFiltered, ...assetHits, ...contractHits, ...customerHits, ...unpaidHits];
  }, [query, assets.data, contracts.data, customers.data, unpaidByContract]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  function navigate(it: CmdItem) {
    if (it.href) {
      router.push(it.href);
      setOpen(false);
      setQuery('');
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/30"
      onClick={() => setOpen(false)}
      onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
    >
      <div
        className="w-full max-w-2xl bg-surface border border-border shadow-md overflow-hidden"
        style={{ borderRadius: 2 }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, items.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (items[activeIndex]) navigate(items[activeIndex]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        role="presentation"
      >
        <div className="flex items-center gap-2 px-3 h-11 border-b border-border">
          <i className="ph ph-magnifying-glass text-text-muted" style={{ fontSize: 14 }} />
          <input
            autoFocus
            type="text"
            placeholder="차량번호 · 계약자 · 고객명 · 페이지 검색..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none border-none"
            style={{ fontSize: 13, letterSpacing: '-0.01em' }}
          />
          <kbd className="kbd">Esc</kbd>
        </div>
        <div className="overflow-y-auto scrollbar-thin" style={{ maxHeight: '60vh' }}>
          {items.length === 0 ? (
            <div className="py-10 text-center text-text-muted text-xs">결과 없음</div>
          ) : (
            items.map((it, i) => (
              <button
                type="button"
                key={it.id}
                onClick={() => navigate(it)}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 h-10 text-left cursor-pointer',
                  i === activeIndex ? 'bg-bg-hover' : 'hover:bg-bg-hover',
                )}
                style={{ border: 'none', background: 'transparent' }}
              >
                <span className={KIND_CLASS[it.kind]} style={{ width: 50, justifyContent: 'center', flexShrink: 0 }}>
                  {KIND_LABEL[it.kind]}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{it.label}</div>
                  {it.sub && (
                    <div className="text-text-muted" style={{ fontSize: 11, marginTop: 1 }}>
                      {it.sub}
                    </div>
                  )}
                </div>
                {it.hint && <kbd className="kbd">{it.hint}</kbd>}
              </button>
            ))
          )}
        </div>
        <div className="border-t border-border px-3 py-1.5 text-text-muted flex items-center gap-3" style={{ fontSize: 10 }}>
          <span>↑↓ 이동</span>
          <span>Enter 선택</span>
          <span className="ml-auto">{items.length}개 결과</span>
        </div>
      </div>
    </div>
  );
}
